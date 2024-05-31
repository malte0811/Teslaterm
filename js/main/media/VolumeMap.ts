import {CoilID} from "../../common/constants";
import {ChannelID} from "../../common/IPCConstantsToRenderer";
import {MediaFileType} from "../../common/MediaTypes";
import {
    AllFaders,
    DEFAULT_VOLUME,
    FaderData,
    MixerLayer, VolumeChannel,
    VolumeKey,
    VolumeSetting,
    VolumeUpdate,
} from "../../common/MixerTypes";
import {forEachCoil, getOptionalUD3Connection} from "../connection/connection";
import {media_state} from "./media_player";

export const NUM_SPECIFIC_FADERS = 8;

class CoilVolumes {
    public masterVolume = DEFAULT_VOLUME;
    public readonly voiceVolume = new Map<ChannelID, VolumeSetting>();
    // A bit of a hack:
    // - Volume is the noise volume
    // - Mute only refers to hypervoice, so muted=>no HPV, unmuted=>HPV
    public sidSettings = DEFAULT_VOLUME;

    public updateChannel(channel: VolumeChannel, update: VolumeUpdate) {
        const newVolume = {...this.getVolumeSetting(channel), ...update};
        if (channel === undefined) {
            this.masterVolume = newVolume;
        } else if (channel === 'sidSpecial') {
            this.sidSettings = newVolume;
        } else {
            this.voiceVolume.set(channel, newVolume);
        }
    }

    public getVolumeSetting(channel: VolumeChannel): VolumeSetting {
        if (channel === undefined) {
            return this.masterVolume;
        } else if (channel === 'sidSpecial') {
            return this.sidSettings;
        } else {
            return this.voiceVolume.get(channel) || DEFAULT_VOLUME;
        }
    }

    public clearChannelSpecifics() {
        this.voiceVolume.clear();
    }

    public getNondefaultChannelKeys(): VolumeChannel[] {
        const keys: VolumeChannel[] = [];
        const addIfChanged = (key: VolumeChannel) => {
            const volume = this.getVolumeSetting(key);
            if (volume.muted !== DEFAULT_VOLUME.muted || volume.volumePercent !== DEFAULT_VOLUME.volumePercent) {
                keys.push(key);
            }
        };
        addIfChanged(undefined);
        addIfChanged('sidSpecial');
        for (const voice of this.voiceVolume.keys()) {
            addIfChanged(voice);
        }
        return keys;
    }
}

export class VolumeMap {
    private readonly channelMasters = new CoilVolumes();
    private readonly coilVolumes = new Map<CoilID, CoilVolumes>();
    private channelByFader: number[] = [0, 1, 2];

    public getCoilMasterFraction(coil: CoilID) {
        return this.getIndividualVolume({coil}) / 100 * this.getIndividualVolume({}) / 100;
    }

    public getCoilVoiceMultiplier(coil: CoilID, channel: ChannelID) {
        return this.getIndividualVolume({coil, channel}) / 100 * this.getIndividualVolume({channel}) / 100;
    }

    public getCoilSIDVolume(coil: CoilID): VolumeSetting {
        const globalSetting = this.getVolumeSetting({channel: 'sidSpecial'});
        const coilSetting = this.getVolumeSetting({coil, channel: 'sidSpecial'});
        return {
            muted: globalSetting.muted || coilSetting.muted,
            volumePercent: globalSetting.volumePercent / 100 * coilSetting.volumePercent,
        };
    }

    public setChannelMap(channelByFader: number[]) {
        this.channelByFader = [...channelByFader];
    }

    public getFaderStates(
        currentLayer: MixerLayer, channelNames: Map<ChannelID, string>, channelPrograms?: Map<ChannelID, number>,
    ): AllFaders {
        const specificFaders = (() => {
            if (currentLayer === 'coilMaster') {
                const result: FaderData[] = [];
                forEachCoil((coil) => result.push({
                    key: {coil},
                    // TODO do not reset on connection loss
                    title: getOptionalUD3Connection(coil)?.getUDName() || `Coil ${coil}`,
                    volume: this.getVolumeSetting({coil}),
                }));
                return result;
            } else if (currentLayer === 'voiceMaster') {
                return this.getFadersForCoil(undefined, channelNames, channelPrograms);
            } else {
                return this.getFadersForCoil(currentLayer, channelNames, channelPrograms);
            }
        })();
        return {
            masterVolumePercent: this.channelMasters.masterVolume.volumePercent,
            specificFaders,
        };
    }

    public getChannelMap() {
        return this.channelByFader;
    }

    public applyVolumeUpdate(key: VolumeKey, update: VolumeUpdate) {
        if (key.coil === undefined) {
            this.channelMasters.updateChannel(key.channel, update);
        } else {
            if (!this.coilVolumes.has(key.coil)) {
                this.coilVolumes.set(key.coil, new CoilVolumes());
            }
            this.coilVolumes.get(key.coil).updateChannel(key.channel, update);
        }
    }

    public getVolumeSetting(key: VolumeKey): VolumeSetting {
        if (key.coil === undefined) {
            return this.channelMasters.getVolumeSetting(key.channel);
        } else if (this.coilVolumes.has(key.coil)) {
            return this.coilVolumes.get(key.coil).getVolumeSetting(key.channel);
        } else {
            return DEFAULT_VOLUME;
        }
    }

    public clearChannelSpecifics() {
        this.channelMasters.clearChannelSpecifics();
        for (const coilMap of this.coilVolumes.values()) {
            coilMap.clearChannelSpecifics();
        }
    }

    public getNondefaultChannelKeys() {
        const result: VolumeKey[] = [];
        const addFor = (coil: CoilID | undefined, volumes: CoilVolumes) => {
            result.push(...volumes.getNondefaultChannelKeys().map((channel) => ({coil, channel})));
        };
        addFor(undefined, this.channelMasters);
        for (const [coil, settings] of this.coilVolumes) {
            addFor(coil, settings);
        }
        return result;
    }

    private getIndividualVolume(key: VolumeKey) {
        const setting = this.getVolumeSetting(key);
        return setting.muted ? 0 : setting.volumePercent;
    }

    private getFadersForCoil(
        coil: CoilID | undefined, channelNames: Map<ChannelID, string>, channelPrograms?: Map<ChannelID, number>,
    ) {
        const isSID = media_state.type === MediaFileType.sid_dmp || media_state.type === MediaFileType.sid_emulated;
        const result: FaderData[] = [];
        const channelOrder = isSID ? [0, 1, 2] : [1, 2, 3, 4, 5, 6, 7, 10];
        for (const channel of channelOrder) {
            if (this.channelByFader.includes(channel)) {
                const key = {coil, channel};
                result.push({
                    key,
                    programID: channelPrograms ? channelPrograms.get(channel) : undefined,
                    title: channelNames.get(channel) || `Channel ${result.length}`,
                    volume: this.getVolumeSetting(key),
                });
            } else {
                result.push(undefined);
            }
        }
        if (isSID) {
            const key: VolumeKey = {coil, channel: 'sidSpecial'};
            result.push({
                key,
                muteSuffix: ' HPV',
                title: 'Noise volume',
                volume: this.getVolumeSetting(key),
            });
        }
        return result;
    }
}
