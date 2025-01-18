import {CoilID} from "../../../common/constants";
import {DroppedFile} from "../../../common/IPCConstantsToMain";
import {ChannelID, FaderID} from "../../../common/IPCConstantsToRenderer";
import {MediaFileType} from "../../../common/MediaTypes";
import {MixerLayer, VolumeChannel, VolumeKey, VolumeUpdate} from "../../../common/MixerTypes";
import {PhysicalMixerConfig} from "../../../common/Options";
import {forEachCoil, getCoilCommands} from "../../connection/connection";
import {ipcs} from "../../ipc/IPCProvider";
import {sendProgramChange, sendVolume} from "../../midi/midi";
import {getActiveSIDConnection, SidCommand} from "../../sid/ISidConnection";
import {updateDefaultProgram, updateDefaultVolumes} from "../../UIConfigHandler";
import {media_state} from "../media_player";
import {NUM_SPECIFIC_FADERS, VolumeMap} from "../VolumeMap";
import {makeMixer, PhysicalMixer} from "./PhysicalMixer";
import {Playlist} from "./Playlist";

export const UD3_MAX_VOLUME = (1 << 15) - 1;

export class MixerState {
    private programByVoice: Map<ChannelID, number> = new Map<ChannelID, number>();
    private nameByVoice: Map<ChannelID, string> = new Map<ChannelID, string>();
    private readonly volumes: VolumeMap = new VolumeMap();
    private currentLayer: MixerLayer = 'coilMaster';
    private readonly changedVolumes = new Map<VolumeChannel, Set<CoilID>>();
    private playlist?: Playlist;
    private readonly physicalMixer: PhysicalMixer;

    constructor(config: PhysicalMixerConfig) {
        this.physicalMixer = makeMixer(config, this);
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
        if (faderKey && faderKey.channel !== undefined && faderKey.channel !== 'sidSpecial') {
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

    public sendFullState() {
        this.setChannels(this.volumes.getChannelMap());
        this.setProgramsByVoice(this.programByVoice);
        if (this.playlist) {
            ipcs.mixer.sendSongList(this.playlist.getSyncState());
        }
        this.syncFaderStatesToRenderer();
    }

    public setVolumeFromPhysical(fader: number, update: VolumeUpdate) {
        // are we updating the master?
        if (fader === NUM_SPECIFIC_FADERS) {
            this.updateVolume({}, update, false);
        } else {
            const key = this.getFaderStates().specificFaders[fader]?.key;
            if (key) {
                this.updateVolume(key, update, true);
            }
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

    public getCoilVolumeMultiplier(coil: CoilID) {
        return this.volumes.getCoilMasterFraction(coil);
    }

    public getCurrentLayer() {
        return this.currentLayer;
    }

    public setLayer(layer: MixerLayer) {
        this.currentLayer = layer;
        this.updatePhysicalMixer();
        this.syncFaderStatesToRenderer();
    }

    public async cycleMediaFile(forward: boolean) {
        await this.playlist?.cycle(forward);
        ipcs.mixer.sendSongList(this.playlist.getSyncState());
    }

    public updatePhysicalMixer() {
        this.physicalMixer.movePhysicalSliders(this.getFaderStates());
        this.physicalMixer.updateLayer(this.currentLayer);
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
        this.markForUpdate({coil, channel: 'sidSpecial'});
    }

    public async loadPlaylist(loadedZip: DroppedFile[]) {
        this.playlist = await Playlist.load(loadedZip);
        ipcs.mixer.sendSongList(this.playlist.getSyncState());
    }

    public async setPlaylistIndex(choice: number) {
        await this.playlist.setIndex(choice);
        ipcs.mixer.sendSongList(this.playlist.getSyncState());
    }

    public close() {
        this.physicalMixer.close();
    }

    private markForUpdate(changedKey: VolumeKey) {
        if (!this.changedVolumes.has(changedKey.channel)) {
            this.changedVolumes.set(changedKey.channel, new Set<CoilID>());
        }
        const coils = this.changedVolumes.get(changedKey.channel);
        if (changedKey.coil === undefined) {
            forEachCoil((coil) => coils.add(coil));
        } else {
            coils.add(changedKey.coil);
        }
    }

    private processVolumeUpdates() {
        if (this.changedVolumes.size > 0) {
            this.updatePhysicalMixer();
            this.syncFaderStatesToRenderer();
        }
        const promises: Array<Promise<any>> = [];
        for (const [channel, updatedCoils] of this.changedVolumes) {
            for (const coil of updatedCoils) {
                promises.push(this.sendVolume(coil, channel));
            }
        }
        this.changedVolumes.clear();
        return Promise.all(promises);
    }

    private async sendVolume(coil: number, channel: VolumeChannel | undefined) {
        if (channel === undefined) {
            await getCoilCommands(coil).setVolumeFraction(this.volumes.getCoilMasterFraction(coil));
        } else if (channel === 'sidSpecial') {
            const sidConnection = getActiveSIDConnection(coil);
            if (sidConnection) {
                const sidVolume = this.volumes.getCoilSIDVolume(coil);
                const ud3sidVolume = sidVolume.volumePercent / 100 * UD3_MAX_VOLUME;
                await Promise.all([
                    sidConnection.sendCommand(SidCommand.noiseVolume, 0, ud3sidVolume),
                    sidConnection.sendCommand(SidCommand.hpvEnable, 0, sidVolume.muted ? 0 : 1),
                ]);
            }
        } else {
            const volumeFraction = this.volumes.getCoilVoiceMultiplier(coil, channel);
            if (media_state.type === MediaFileType.midi) {
                await sendVolume(coil, channel, volumeFraction * 100);
            } else {
                await getActiveSIDConnection(coil)?.sendCommand(
                    SidCommand.setVolume, channel, volumeFraction * UD3_MAX_VOLUME,
                );
            }
        }
    }

    private syncFaderStatesToRenderer() {
        ipcs.mixer.sendMixerLayer(this.currentLayer, this.getFaderStates());
    }

    private getFaderStates() {
        return this.volumes.getFaderStates(
            this.currentLayer,
            this.nameByVoice,
            media_state.type === MediaFileType.midi && this.programByVoice,
        );
    }
}
