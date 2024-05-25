import fs from "fs";
import * as path from "node:path";
import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ChannelID, FaderID, IPC_CONSTANTS_TO_RENDERER, SongListData} from "../../common/IPCConstantsToRenderer";
import {MediaFileType} from "../../common/MediaTypes";
import {MixerLayer, VolumeKey, VolumeUpdate} from "../../common/MixerTypes";
import {forEachCoil, getCoilCommands, getPhysicalMixer} from "../connection/connection";
import {config} from "../init";
import {loadMediaFile, media_state} from "../media/media_player";
import {VolumeMap} from "../media/VolumeMap";
import {sendProgramChange, sendVolume} from "../midi/midi";
import {getActiveSIDConnection, SidCommand} from "../sid/ISidConnection";
import {getUIConfig, updateDefaultProgram, updateDefaultVolumes} from "../UIConfigHandler";
import {MainIPC} from "./IPCProvider";
import {BehringerXTouch} from "../media/PhysicalMixer";

const UD3_MAX_VOLUME = 1 << 15 - 1;

export class MixerIPC {
    private programByVoice: Map<ChannelID, number> = new Map<ChannelID, number>();
    private nameByVoice: Map<ChannelID, string> = new Map<ChannelID, string>();
    private readonly volumes: VolumeMap = new VolumeMap();
    private currentLayer: MixerLayer = 'coilMaster';
    private readonly processIPC: MainIPC;
    private readonly changedCoilMasters = new Set<CoilID>();
    private readonly changedSID = new Set<CoilID>();
    private readonly changedSpecificVolumes = new Map<ChannelID, Set<CoilID>>();
    private readonly songlist?: SongListData;

    constructor(processIPC: MainIPC) {
        this.processIPC = processIPC;
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride,
            async ([fader, program]) => this.setProgramForFader(fader, program),
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setMixerLayer,
            async (layer) => this.setLayer(layer),
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setVolume,
            async ([key, volume]) => {
                this.updateVolume(key, volume, true);
            },
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setVolume,
            async ([key, volume]) => {
                this.updateVolume(key, volume, true);
            },
        );
        if (config.mainMediaPath !== '') {
            const files = fs.readdirSync(config.mainMediaPath, {withFileTypes: true})
                .filter((entry) => entry.isFile())
                .map((entry) => entry.name);
            this.songlist = {songs: files, current: 0};
            processIPC.on(
                IPC_CONSTANTS_TO_MAIN.centralTab.switchMediaFile, (choice) => this.cycleMediaFile(choice.next),
            );
        }
    }

    public tick100() {
        this.processVolumeUpdates().catch((x) => console.error("Sending volume updates", x));
    }

    public getProgramFor(channel: ChannelID) {
        return this.programByVoice.get(channel);
    }

    public setChannels(channelIDs: number[]) {
        this.volumes.setChannelMap(channelIDs);
    }

    public setProgramForChannel(channel: ChannelID, program: number) {
        this.programByVoice.set(channel, program);
        updateDefaultProgram(media_state.title, channel, program);
        sendProgramChange(channel, program).catch((x) => console.error('Sending program change', x));
        this.syncFaderStatesToRenderer();
    }

    public setProgramForFader(fader: FaderID, program: number) {
        const faderKey = this.getFaderStates().specificFaders[fader]?.key;
        if (faderKey && faderKey !== 'sidSpecial' && faderKey.channel !== undefined) {
            this.setProgramForChannel(faderKey.channel, program);
        }
    }

    public setProgramsByVoice(programByVoice: Map<ChannelID, number>) {
        this.programByVoice = programByVoice;
        this.syncFaderStatesToRenderer();
    }

    public setChannelNames(nameByVoice: Map<ChannelID, string>) {
        this.nameByVoice = nameByVoice;
        this.syncFaderStatesToRenderer();
    }

    public sendAvailablePrograms() {
        this.processIPC.send(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setAvailableMIDIPrograms, getUIConfig().syncedConfig.midiPrograms,
        );
        if (this.songlist) {
            this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setSongList, this.songlist);
        }
    }

    public sendFullState() {
        this.setChannels(this.volumes.getChannelMap());
        this.setProgramsByVoice(this.programByVoice);
        this.sendAvailablePrograms();
        this.syncFaderStatesToRenderer();
    }

    public setVolumeFromPhysical(fader: number, update: VolumeUpdate) {
        const key = this.getFaderStates().specificFaders[fader]?.key;
        if (key) {
            this.updateVolume(key, update, true);
        }
    }

    public updateVolume(key: VolumeKey, update: VolumeUpdate, updateDefault: boolean) {
        this.volumes.applyVolumeUpdate(key, update);
        this.markForUpdate(key);
        if (updateDefault) {
            updateDefaultVolumes(media_state.title, key, update);
        }
    }

    public getVolumeMultiplier(coil: CoilID, channel: ChannelID) {
        return this.volumes.getCoilVoiceMultiplier(coil, channel);
    }

    public getCurrentLayer() {
        return this.currentLayer;
    }

    public setLayer(layer: MixerLayer) {
        this.currentLayer = layer;
        this.updatePhysicalMixer();
        this.syncFaderStatesToRenderer();
    }

    public cycleMediaFile(forward: boolean) {
        const nonWrapped = this.songlist.current + (forward ? 1 : -1);
        this.songlist.current = (nonWrapped + this.songlist.songs.length) % this.songlist.songs.length;
        this.loadSelectedFile();
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setSongList, this.songlist);
    }

    public updatePhysicalMixer() {
        const faders = this.volumes.getFaderStates(this.currentLayer, numCoils());
        const mixer = getPhysicalMixer();
        if (mixer !== undefined) {
            mixer.movePhysicalSliders(faders);

            switch (this.currentLayer) {
                case 'voiceMaster':
                    mixer.set7SegmentText(0, 'CH');
                    break;
                case 'coilMaster':
                    mixer.set7SegmentText(0, 'GC');
                    break;
                default:
                    mixer.set7SegmentText(0, 'C' + this.currentLayer);
                    break;
            }

            mixer.setDisplay(0, 'test123', 'test345', 5);
            mixer.setDisplay(1, 'test11251257845', 'test2', 5);
            mixer.setDisplay(2, 'test1', 'test2', 4);
            mixer.setDisplay(3, 'test1', 'test2', 3);


            mixer.setDisplay(4, 'test1', 'test2', 6);
            mixer.setDisplay(5, 'test1', 'test2', 3);
            mixer.setDisplay(6, 'test1', 'test2', 1);
            mixer.setDisplay(7, 'test1', 'test2', 5);
        }
    }

    public resetBeforeSongLoad() {
        this.programByVoice.clear();
        this.nameByVoice.clear();
        this.volumes.getNondefaultChannelKeys().forEach((key) => this.markForUpdate(key));
        this.volumes.clearChannelSpecifics();
        this.sendFullState();
        this.updatePhysicalMixer();
    }

    public sendVolumesTo(coil: CoilID) {
        for (const channel of this.volumes.getChannelMap()) {
            this.markForUpdate({coil, channel});
        }
        this.markForUpdate({coil});
        this.markForUpdate('sidSpecial');
    }

    private markForUpdate(changedKey: VolumeKey) {
        const addAffectedCoils = (coils: Set<CoilID>) => {
            if (changedKey === 'sidSpecial' || changedKey.coil === undefined) {
                forEachCoil((coil) => coils.add(coil));
            } else {
                coils.add(changedKey.coil);
            }
        };
        if (changedKey === 'sidSpecial') {
            addAffectedCoils(this.changedSID);
        } else if (changedKey.channel === undefined) {
            addAffectedCoils(this.changedCoilMasters);
        } else {
            if (!this.changedSpecificVolumes.has(changedKey.channel)) {
                this.changedSpecificVolumes.set(changedKey.channel, new Set<CoilID>());
            }
            addAffectedCoils(this.changedSpecificVolumes.get(changedKey.channel));
        }
    }

    private loadSelectedFile() {
        if (this.songlist) {
            const fileName = this.songlist.songs[this.songlist.current];
            const filePath = path.join(config.mainMediaPath, fileName);
            const data = fs.readFileSync(filePath);
            loadMediaFile({contents: data, name: fileName})
                .catch((e) => console.error('Loading media file', e));
        }
    }

    private processVolumeUpdates() {
        if (this.changedCoilMasters.size + this.changedSID.size + this.changedSpecificVolumes.size > 0) {
            this.updatePhysicalMixer();
            this.syncFaderStatesToRenderer();
        }
        const promises: Array<Promise<any>> = [];
        for (const coil of this.changedCoilMasters) {
            const coilVolume = this.volumes.getCoilMasterFraction(coil) * UD3_MAX_VOLUME;
            promises.push(getCoilCommands(coil).setParam('vol', coilVolume.toFixed(0)));
        }
        this.changedCoilMasters.clear();
        const sidVolume = this.volumes.getVolumeSetting('sidSpecial');
        for (const coil of this.changedSID) {
            promises.push(getActiveSIDConnection(coil)?.sendCommand(
                SidCommand.noiseVolume, 0, sidVolume.volumePercent / 100 * UD3_MAX_VOLUME,
            ));
            promises.push(getActiveSIDConnection(coil)?.sendCommand(
                SidCommand.hpvEnable, 0, sidVolume.muted ? 0 : 1,
            ));
        }
        this.changedSID.clear();
        for (const [channel, updatedCoils] of this.changedSpecificVolumes) {
            for (const coil of updatedCoils) {
                promises.push(this.sendVolume(coil, channel));
            }
        }
        this.changedSpecificVolumes.clear();
        return Promise.all(promises);
    }

    private async sendVolume(coil: number, channel: number) {
        const volumeFraction = this.volumes.getCoilVoiceMultiplier(coil, channel);
        console.log("updating at " + Date.now());
        if (media_state.type === MediaFileType.midi) {
            await sendVolume(coil, channel, volumeFraction * 100);
        } else {
            await getActiveSIDConnection(coil)?.sendCommand(
                SidCommand.setVolume, channel, volumeFraction * UD3_MAX_VOLUME,
            );
        }
    }

    private syncFaderStatesToRenderer() {
        this.processIPC.send(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setMixerLayer,
            [this.currentLayer, this.getFaderStates()],
        );
    }

    private getFaderStates() {
        return this.volumes.getFaderStates(
            this.currentLayer,
            this.nameByVoice,
            media_state.type === MediaFileType.midi && this.programByVoice,
        );
    }
}
