import {CoilID} from "./constants";
import {ChannelID} from "./IPCConstantsToRenderer";

export interface VolumeKey {
    coil?: CoilID;
    channel?: ChannelID;
}

export type MixerLayer = CoilID | 'coilMaster' | 'voiceMaster';

export const DEFAULT_MIXER_LAYER = 'coilMaster';

export const NUM_SPECIFIC_FADERS = 8;

export interface VolumeSetting {
    muted: boolean;
    volumePercent: number;
}

export type VolumeUpdate = Partial<VolumeSetting>;

export const DEFAULT_VOLUME: VolumeSetting = {muted: false, volumePercent: 100};
const OFF_VOLUME: VolumeSetting = {muted: false, volumePercent: 0};

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

    public constructor(
        masterVolume?: number,
        coilVolume?: Map<CoilID, VolumeSetting>,
        voiceVolume?: Map<ChannelID, VolumeSetting>,
        specificVolumes?: Map<CoilID, Map<ChannelID, VolumeSetting>>,
        channelByFader?: number[],
    ) {
        this.masterVolume = masterVolume !== undefined ? masterVolume : DEFAULT_VOLUME.volumePercent;
        this.coilVolume = coilVolume || new Map<CoilID, VolumeSetting>();
        this.voiceVolume = voiceVolume || new Map<ChannelID, VolumeSetting>();
        this.specificVolumes = specificVolumes || new Map<CoilID, Map<ChannelID, VolumeSetting>>();
        this.channelByFader = channelByFader || [0, 1, 2];
    }

    public getIndividualVolume(key: VolumeKey) {
        const setting = this.getVolumeSetting(key);
        return setting.muted ? 0 : setting.volumePercent;
    }

    public getCoilMasterFraction(coil: CoilID) {
        return this.getIndividualVolume({coil}) / 100 * this.getIndividualVolume({}) / 100;
    }

    public getCoilVoiceMultiplier(coil: CoilID, channel: ChannelID) {
        return this.getIndividualVolume({coil, channel}) / 100 * this.getIndividualVolume({channel}) / 100;
    }

    public withChannelMap(channelByFader: number[]) {
        return new VolumeMap(
            this.masterVolume, this.coilVolume, this.voiceVolume, this.specificVolumes, channelByFader,
        );
    }

    public getFaderStates(currentLayer: MixerLayer, numCoils: number) {
        const resultMap = new Map<number, VolumeSetting>();
        const numActive = currentLayer === 'coilMaster' ? numCoils : this.channelByFader.length;
        for (let i = 0; i < NUM_SPECIFIC_FADERS; ++i) {
            resultMap.set(i, i < numActive ? DEFAULT_VOLUME : OFF_VOLUME);
        }
        if (currentLayer === 'coilMaster') {
            for (const coil of this.coilVolume.keys()) {
                resultMap.set(coil, this.getVolumeSetting({coil}));
            }
        } else {
            const coil = currentLayer === 'voiceMaster' ? undefined : currentLayer;
            this.channelByFader.forEach(
                (channel, fader) => resultMap.set(fader, this.getVolumeSetting({coil, channel})),
            );
        }
        resultMap.set(NUM_SPECIFIC_FADERS, this.getVolumeSetting({}));
        return resultMap;
    }

    public getChannelMap() {
        return this.channelByFader;
    }

    public with(key: VolumeKey, update: VolumeUpdate) {
        let newCoilVolume = this.coilVolume;
        let newVoiceVolume = this.voiceVolume;
        const newSpecificVolume = new Map<CoilID, Map<ChannelID, VolumeSetting>>(this.specificVolumes);
        let masterVolume = this.masterVolume;
        if (key.channel !== undefined && key.coil !== undefined) {
            newSpecificVolume.set(key.coil, updateVolume(newSpecificVolume.get(key.coil), key.channel, update));
        } else if (key.channel !== undefined) {
            newVoiceVolume = updateVolume(newVoiceVolume, key.channel, update);
        } else if (key.coil !== undefined) {
            newCoilVolume = updateVolume(newCoilVolume, key.coil, update);
        } else {
            masterVolume = update.volumePercent === undefined ? masterVolume : update.volumePercent;
        }
        return new VolumeMap(masterVolume, newCoilVolume, newVoiceVolume, newSpecificVolume, this.channelByFader);
    }

    public getVolumeSetting(key: VolumeKey) {
        if (key.channel !== undefined && key.coil !== undefined) {
            return this.specificVolumes.get(key.coil)?.get(key.channel) || DEFAULT_VOLUME;
        } else if (key.channel !== undefined) {
            return this.voiceVolume.get(key.channel) || DEFAULT_VOLUME;
        } else if (key.coil !== undefined) {
            return this.coilVolume.get(key.coil) || DEFAULT_VOLUME;
        } else {
            return {muted: false, volumePercent: this.masterVolume};
        }
    }
}
