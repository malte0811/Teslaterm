import {CoilID} from "./constants";
import {ChannelID} from "./IPCConstantsToRenderer";

export interface VolumeKey {
    coil?: CoilID;
    channel?: ChannelID;
}

export type MixerLayer = CoilID | 'coilMaster' | 'voiceMaster';

export const DEFAULT_MIXER_LAYER = 'coilMaster';

export const NUM_SPECIFIC_FADERS = 8;

export const DEFAULT_VOLUME = 100;

export class VolumeMap {
    // All volumes in percent (0-100)
    private readonly masterVolume: number;
    private readonly coilVolume: Map<CoilID, number>;
    private readonly voiceVolume: Map<ChannelID, number>;
    private readonly specificVolumes: Map<CoilID, Map<ChannelID, number>>;
    private readonly channelByFader: number[];

    public constructor(
        masterVolume?: number,
        coilVolume?: Map<CoilID, number>,
        voiceVolume?: Map<ChannelID, number>,
        specificVolumes?: Map<CoilID, Map<ChannelID, number>>,
        channelByFader?: number[],
    ) {
        this.masterVolume = masterVolume !== undefined ? masterVolume : DEFAULT_VOLUME;
        this.coilVolume = coilVolume || new Map<CoilID, number>();
        this.voiceVolume = voiceVolume || new Map<ChannelID, number>();
        this.specificVolumes = specificVolumes || new Map<CoilID, Map<ChannelID, number>>();
        this.channelByFader = channelByFader || [0, 1, 2];
    }

    public getIndividualVolume(key: VolumeKey) {
        const rawResult = (() => {
            if (key.channel !== undefined && key.coil !== undefined) {
                return this.specificVolumes.get(key.coil)?.get(key.channel);
            } else if (key.channel !== undefined) {
                return this.voiceVolume.get(key.channel);
            } else if (key.coil !== undefined) {
                return this.coilVolume.get(key.coil);
            } else {
                return this.masterVolume;
            }
        })();
        return rawResult !== undefined ? rawResult : DEFAULT_VOLUME;
    }

    public getTotalVolume(coil: CoilID, voice: ChannelID) {
        return this.getIndividualVolume({coil, channel: voice}) / 100 *
            this.getIndividualVolume({coil}) / 100 *
            this.getIndividualVolume({channel: voice}) / 100 *
            this.getIndividualVolume({});
    }

    public with(key: VolumeKey, newValue: number) {
        const newCoilVolume = new Map<CoilID, number>(this.coilVolume);
        const newVoiceVolume = new Map<ChannelID, number>(this.voiceVolume);
        const newSpecificVolume = new Map<CoilID, Map<ChannelID, number>>(this.specificVolumes);
        let masterVolume = this.masterVolume;
        if (key.channel !== undefined && key.coil !== undefined) {
            const submap = new Map<ChannelID, number>(newSpecificVolume.get(key.coil));
            submap.set(key.channel, newValue);
            newSpecificVolume.set(key.coil, submap);
        } else if (key.channel !== undefined) {
            newVoiceVolume.set(key.channel, newValue);
        } else if (key.coil !== undefined) {
            newCoilVolume.set(key.coil, newValue);
        } else {
            masterVolume = newValue;
        }
        return new VolumeMap(masterVolume, newCoilVolume, newVoiceVolume, newSpecificVolume, this.channelByFader);
    }

    public withChannelMap(channelByFader: number[]) {
        return new VolumeMap(
            this.masterVolume, this.coilVolume, this.voiceVolume, this.specificVolumes, channelByFader
        );
    }

    public getFaderStates(currentLayer: MixerLayer, numCoils: number): Map<number, number> {
        const resultMap = new Map<number, number>();
        const numActive = currentLayer === 'coilMaster' ? numCoils : this.channelByFader.length;
        for (let i = 0; i < NUM_SPECIFIC_FADERS; ++i) {
            resultMap.set(i, i < numActive ? DEFAULT_VOLUME : 0);
        }
        if (currentLayer === 'coilMaster') {
            for (const [coil, volume] of this.coilVolume) {
                resultMap.set(coil, volume);
            }
        } else {
            const baseMap = (() => {
                if (currentLayer === 'voiceMaster') {
                    return this.voiceVolume;
                } else {
                    return this.specificVolumes.get(currentLayer);
                }
            })();
            for (const [channel, volume] of (baseMap || new Map<ChannelID, number>())) {
                const volume = baseMap?.get(channel);
                const fader = this.getFaderID(channel);
                if (fader >= 0) {
                    resultMap.set(fader, volume);
                }
            }
        }
        resultMap.set(NUM_SPECIFIC_FADERS, this.masterVolume);
        return resultMap;
    }

    public getFaderID(channel: ChannelID) {
        return this.channelByFader.indexOf(channel);
    }

    public getChannelMap() {
        return this.channelByFader;
    }
}
