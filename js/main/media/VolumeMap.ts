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

function updateVolume<K>(map: Map<K, VolumeSetting> | undefined, key: K, update: VolumeUpdate) {
    const newMapping = new Map<K, VolumeSetting>(map);
    newMapping.set(key, {...DEFAULT_VOLUME, ...map?.get(key), ...update});
    return newMapping;
}

export class VolumeMap {
    // All volumes in percent (0-100)
    private readonly masterVolume: number;
    private readonly coilVolume: Map<CoilID, VolumeSetting>;
    private readonly voiceVolume: Map<ChannelID, VolumeSetting>;
    private readonly specificVolumes: Map<CoilID, Map<ChannelID, VolumeSetting>>;
    private readonly channelByFader: number[];
    // A bit of a hack:
    // - Volume is the noise volume
    // - Mute only refers to hypervoice, so muted=>no HPV, unmuted=>HPV
    private readonly sidExtraVolumes: VolumeSetting;

    public constructor(
        masterVolume?: number,
        coilVolume?: Map<CoilID, VolumeSetting>,
        sidExtraVolumes?: VolumeSetting,
        voiceVolume?: Map<ChannelID, VolumeSetting>,
        specificVolumes?: Map<CoilID, Map<ChannelID, VolumeSetting>>,
        channelByFader?: number[],
    ) {
        this.masterVolume = masterVolume !== undefined ? masterVolume : DEFAULT_VOLUME.volumePercent;
        this.coilVolume = coilVolume || new Map<CoilID, VolumeSetting>();
        this.voiceVolume = voiceVolume || new Map<ChannelID, VolumeSetting>();
        this.specificVolumes = specificVolumes || new Map<CoilID, Map<ChannelID, VolumeSetting>>();
        this.channelByFader = channelByFader || [0, 1, 2];
        this.sidExtraVolumes = sidExtraVolumes || DEFAULT_VOLUME;
    }

    public getCoilMasterFraction(coil: CoilID) {
        return this.getIndividualVolume({coil}) / 100 * this.getIndividualVolume({}) / 100;
    }

    public getCoilVoiceMultiplier(coil: CoilID, channel: ChannelID) {
        return this.getIndividualVolume({coil, channel}) / 100 * this.getIndividualVolume({channel}) / 100;
    }

    public withChannelMap(channelByFader: number[]) {
        return new VolumeMap(
            this.masterVolume,
            this.coilVolume,
            this.sidExtraVolumes,
            this.voiceVolume,
            this.specificVolumes,
            channelByFader,
        );
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

    public with(key: VolumeKey, update: VolumeUpdate) {
        let newSIDSettings = this.sidExtraVolumes;
        let newCoilVolume = this.coilVolume;
        let newVoiceVolume = this.voiceVolume;
        const newSpecificVolume = new Map<CoilID, Map<ChannelID, VolumeSetting>>(this.specificVolumes);
        let masterVolume = this.masterVolume;
        if (key === 'sidSpecial') {
            newSIDSettings = {...newSIDSettings, ...update};
        } else if (key.channel !== undefined && key.coil !== undefined) {
            newSpecificVolume.set(key.coil, updateVolume(newSpecificVolume.get(key.coil), key.channel, update));
        } else if (key.channel !== undefined) {
            newVoiceVolume = updateVolume(newVoiceVolume, key.channel, update);
        } else if (key.coil !== undefined) {
            newCoilVolume = updateVolume(newCoilVolume, key.coil, update);
        } else {
            masterVolume = update.volumePercent === undefined ? masterVolume : update.volumePercent;
        }
        return new VolumeMap(
            masterVolume, newCoilVolume, newSIDSettings, newVoiceVolume, newSpecificVolume, this.channelByFader,
        );
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

    public withoutChannelSpecifics() {
        return new VolumeMap(this.masterVolume, this.coilVolume, this.sidExtraVolumes);
    }

    private getIndividualVolume(key: VolumeKey) {
        const setting = this.getVolumeSetting(key);
        return setting.muted ? 0 : setting.volumePercent;
    }

    private getFadersForCoil(
        coil: CoilID | undefined, channelNames: Map<ChannelID, string>, channelPrograms?: Map<ChannelID, number>,
    ) {
        const result: FaderData[] = [];
        for (const channel of this.channelByFader) {
            const key = {coil, channel};
            result.push({
                key,
                programID: channelPrograms ? channelPrograms.get(channel) : undefined,
                title: channelNames.get(channel) || `Channel ${result.length}`,
                volume: this.getVolumeSetting(key),
            });
        }
        if (media_state.type === MediaFileType.sid_dmp || media_state.type === MediaFileType.sid_emulated) {
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
