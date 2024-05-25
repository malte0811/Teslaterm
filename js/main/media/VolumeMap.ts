import {CoilID} from "../../common/constants";
import {ChannelID} from "../../common/IPCConstantsToRenderer";
import {MediaFileType} from "../../common/MediaTypes";
import {
    AllFaders,
    DEFAULT_VOLUME,
    FaderData,
    MixerLayer,
    VolumeKey,
    VolumeSetting,
    VolumeUpdate,
} from "../../common/MixerTypes";
import {forEachCoil, getOptionalUD3Connection} from "../connection/connection";
import {media_state} from "./media_player";

export const NUM_SPECIFIC_FADERS = 8;

function applyVolumeUpdate<K>(map: Map<K, VolumeSetting>, key: K, update: VolumeUpdate) {
    map.set(key, {...DEFAULT_VOLUME, ...map?.get(key), ...update});
}

export class VolumeMap {
    // All volumes in percent (0-100)
    private masterVolume: number = DEFAULT_VOLUME.volumePercent;
    private readonly coilVolume = new Map<CoilID, VolumeSetting>();
    private readonly voiceVolume = new Map<ChannelID, VolumeSetting>();
    private readonly specificVolumes = new Map<CoilID, Map<ChannelID, VolumeSetting>>();
    private channelByFader: number[] = [0, 1, 2];
    // A bit of a hack:
    // - Volume is the noise volume
    // - Mute only refers to hypervoice, so muted=>no HPV, unmuted=>HPV
    private sidExtraVolumes: VolumeSetting = DEFAULT_VOLUME;

    public getCoilMasterFraction(coil: CoilID) {
        return this.getIndividualVolume({coil}) / 100 * this.getIndividualVolume({}) / 100;
    }

    public getCoilVoiceMultiplier(coil: CoilID, channel: ChannelID) {
        return this.getIndividualVolume({coil, channel}) / 100 * this.getIndividualVolume({channel}) / 100;
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
            masterVolumePercent: this.masterVolume,
            specificFaders,
        };
    }

    public getChannelMap() {
        return this.channelByFader;
    }

    public applyVolumeUpdate(key: VolumeKey, update: VolumeUpdate) {
        if (key === 'sidSpecial') {
            this.sidExtraVolumes = {...this.sidExtraVolumes, ...update};
        } else if (key.channel !== undefined && key.coil !== undefined) {
            if (!this.specificVolumes.has(key.coil)) {
                this.specificVolumes.set(key.coil, new Map<ChannelID, VolumeSetting>());
            }
            applyVolumeUpdate(this.specificVolumes.get(key.coil), key.channel, update);
        } else if (key.channel !== undefined) {
            applyVolumeUpdate(this.voiceVolume, key.channel, update);
        } else if (key.coil !== undefined) {
            applyVolumeUpdate(this.coilVolume, key.coil, update);
        } else if (update.volumePercent !== undefined) {
            this.masterVolume = update.volumePercent;
        }
    }

    public getVolumeSetting(key: VolumeKey): VolumeSetting {
        if (key === 'sidSpecial') {
            return this.sidExtraVolumes;
        } else if (key.channel !== undefined && key.coil !== undefined) {
            return this.specificVolumes.get(key.coil)?.get(key.channel) || DEFAULT_VOLUME;
        } else if (key.channel !== undefined) {
            return this.voiceVolume.get(key.channel) || DEFAULT_VOLUME;
        } else if (key.coil !== undefined) {
            return this.coilVolume.get(key.coil) || DEFAULT_VOLUME;
        } else {
            return {muted: false, volumePercent: this.masterVolume};
        }
    }

    public clearChannelSpecifics() {
        this.specificVolumes.clear();
        this.voiceVolume.clear();
    }

    public getNondefaultChannelKeys() {
        const keys: VolumeKey[] = [];
        const addIfChanged = (key: VolumeKey) => {
            const volume = this.getVolumeSetting(key);
            if (volume.muted !== DEFAULT_VOLUME.muted || volume.volumePercent !== DEFAULT_VOLUME.volumePercent) {
                keys.push(key);
            }
        };
        for (const channel of this.voiceVolume.keys()) {
            addIfChanged({channel});
        }
        for (const [coil, channels] of this.specificVolumes.entries()) {
            for (const channel of channels.keys()) {
                addIfChanged({coil, channel});
            }
        }
        return keys;
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
            while (result.length < NUM_SPECIFIC_FADERS - 1) {
                result.push(undefined);
            }
            result.push({
                key: 'sidSpecial',
                muteSuffix: ' HPV',
                title: 'Noise volume',
                volume: this.sidExtraVolumes,
            });
        }
        return result;
    }
}
