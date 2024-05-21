import fs from "fs";
import * as path from "node:path";
import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ChannelID, IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {MediaFileType} from "../../common/MediaTypes";
import {MixerLayer, NUM_SPECIFIC_FADERS, VolumeKey, VolumeMap, VolumeUpdate} from "../../common/VolumeMap";
import {forEachCoil, forEachCoilAsync, getPhysicalMixer, numCoils} from "../connection/connection";
import {config} from "../init";
import {loadMediaFile, media_state} from "../media/media_player";
import {sendProgramChange, sendVolume} from "../midi/midi";
import {getActiveSIDConnection, SidCommand} from "../sid/ISidConnection";
import {getUIConfig, updateDefaultProgram, updateDefaultVolumes} from "../UIConfigHandler";
import {MainIPC} from "./IPCProvider";

export class MixerIPC {
    private programByVoice: Map<ChannelID, number> = new Map<ChannelID, number>();
    private nameByVoice: Map<ChannelID, string> = new Map<ChannelID, string>();
    private volumes: VolumeMap = new VolumeMap();
    private currentLayer: MixerLayer = 'coilMaster';
    private readonly processIPC: MainIPC;
    private readonly updates = new Map<CoilID, Set<ChannelID>>();
    // TODO hack, needs to move elsewhere and become more configurable
    private readonly availableFiles: string[];
    private fileIndex: number = 0;

    constructor(processIPC: MainIPC) {
        this.processIPC = processIPC;
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride,
            async ([channel, program]) => this.setProgramForChannel(channel, program),
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setMixerLayer,
            async (layer) => this.setLayer(layer),
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setVolume,
            async ([key, volume]) => {
                this.updateVolume(key, volume);
            },
        );
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.centralTab.setVolume,
            async ([key, volume]) => {
                this.updateVolume(key, volume);
            },
        );
        if (config.mainMediaPath !== '') {
            this.availableFiles = fs.readdirSync(config.mainMediaPath, {withFileTypes: true})
                .filter((entry) => entry.isFile())
                .map((entry) => entry.name);
            processIPC.on(
                IPC_CONSTANTS_TO_MAIN.centralTab.switchMediaFile, (choice) => this.cycleMediaFile(choice.next),
            );
        }
    }

    public tick100() {
        for (const [coil, updatedChannels] of this.updates) {
            for (const channel of updatedChannels) {
                this.sendVolume(coil, channel)
                    .catch((x) => console.error("Sending volume update to ", coil, channel, x));
            }
        }
        this.updates.clear();
    }

    public getProgramFor(channel: ChannelID) {
        return this.programByVoice.get(channel);
    }

    public setChannels(channelIDs: number[]) {
        this.volumes = this.volumes.withChannelMap(channelIDs);
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMediaChannels, this.volumes.getChannelMap());
    }

    public setProgramForChannel(channel: ChannelID, program: number) {
        this.programByVoice.set(channel, program);
        updateDefaultProgram(media_state.title, channel, program);
        sendProgramChange(channel, program).catch((x) => console.error('Sending program change', x));
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIProgramsByChannel, this.programByVoice);
    }

    public setProgramsByVoice(programByVoice: Map<ChannelID, number>) {
        this.programByVoice = programByVoice;
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIProgramsByChannel, this.programByVoice);
    }

    public setChannelNames(nameByVoice: Map<ChannelID, string>) {
        this.nameByVoice = nameByVoice;
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIChannelNames, this.nameByVoice);
    }

    public sendAvailablePrograms() {
        this.processIPC.send(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setAvailableMIDIPrograms, getUIConfig().syncedConfig.midiPrograms,
        );
    }

    public sendFullState() {
        this.setChannels(this.volumes.getChannelMap());
        this.setProgramsByVoice(this.programByVoice);
        this.sendAvailablePrograms();
    }

    public setVolumeFromPhysical(fader: number, update: VolumeUpdate) {
        const channelID = this.volumes.getChannelMap()[fader];
        const key: VolumeKey = (() => {
            if (fader >= NUM_SPECIFIC_FADERS) {
                return {};
            } else if (this.currentLayer === 'voiceMaster') {
                return channelID && {channel: channelID};
            } else if (this.currentLayer === 'coilMaster') {
                return fader < numCoils() && {coil: fader};
            } else {
                return channelID !== undefined ? {coil: this.currentLayer, channel: channelID} : undefined;
            }
        })();
        if (key) {
            this.updateVolume(key, update);
        }
    }

    public updateVolume(key: VolumeKey, update: VolumeUpdate) {
        this.volumes = this.volumes.with(key, update);
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setVolume, [key, update]);
        this.sendVolumeToCoil(key);
        this.updatePhysicalMixer();
        updateDefaultVolumes(media_state.title, key, update);
    }

    public getVolume(coil: CoilID, channel: ChannelID) {
        return this.volumes.getTotalVolume(coil, channel);
    }

    public getCurrentLayer() {
        return this.currentLayer;
    }

    public setLayer(layer: MixerLayer) {
        this.currentLayer = layer;
        this.updatePhysicalMixer();
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setMixerLayer, layer);
    }

    public cycleMediaFile(forward: boolean) {
        if (forward) {
            this.fileIndex = (this.fileIndex + 1) % this.availableFiles.length;
        } else {
            this.fileIndex = (this.fileIndex + this.availableFiles.length - 1) % this.availableFiles.length;
        }
        this.loadSelectedFile();
    }

    public updatePhysicalMixer() {
        const faders = this.volumes.getFaderStates(this.currentLayer, numCoils());
        getPhysicalMixer()?.movePhysicalSliders(faders);
    }

    private sendVolumeToCoil(changedKey: VolumeKey) {
        const sendUpdate = (coil: CoilID, voice: ChannelID) => {
            if (!this.updates.has(coil)) {
                this.updates.set(coil, new Set<ChannelID>());
            }
            this.updates.get(coil).add(voice);
        };
        const sendUpdatesToCoil = (coil: CoilID) => {
            if (changedKey.channel) {
                sendUpdate(coil, changedKey.channel);
            } else {
                this.volumes.getChannelMap().map((voice) => sendUpdate(coil, voice));
            }
        };
        if (changedKey.coil) {
            sendUpdatesToCoil(changedKey.coil);
        } else {
            forEachCoil(sendUpdatesToCoil);
        }
    }

    private loadSelectedFile() {
        if (this.availableFiles) {
            const fileName = this.availableFiles[this.fileIndex];
            const filePath = path.join(config.mainMediaPath, fileName);
            const data = fs.readFileSync(filePath);
            loadMediaFile({contents: data, name: fileName})
                .catch((e) => console.error('Loading media file', e));
        }
    }

    private async sendVolume(coil: number, channel: number) {
        const volumePercent = this.volumes.getTotalVolume(coil, channel);
        if (media_state.type === MediaFileType.midi) {
            await sendVolume(coil, channel, volumePercent);
        } else {
            await getActiveSIDConnection(coil)?.sendCommand(
                SidCommand.setVolume, channel, volumePercent * ((1 << 15) / 100),
            );
        }
    }
}
