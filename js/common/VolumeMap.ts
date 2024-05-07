import {CoilID} from "./constants";
import {VoiceID} from "./IPCConstantsToRenderer";

export interface VolumeKey {
    coil?: CoilID;
    voice?: VoiceID;
}

export type MixerLayer = CoilID | 'coilMaster' | 'voiceMaster';

export const DEFAULT_MIXER_LAYER = 'coilMaster';

export const NUM_SPECIFIC_FADERS = 8;

export const DEFAULT_VOLUME = 100;

export class VolumeMap {
    // All volumes in percent (0-100)
    private readonly masterVolume: number;
    private readonly coilVolume: Map<CoilID, number>;
    private readonly voiceVolume: Map<VoiceID, number>;
    private readonly specificVolumes: Map<CoilID, Map<VoiceID, number>>;

    public constructor(
        masterVolume?: number,
        coilVolume?: Map<CoilID, number>,
        voiceVolume?: Map<VoiceID, number>,
        specificVolumes?: Map<CoilID, Map<VoiceID, number>>,
    ) {
        this.masterVolume = masterVolume !== undefined ? masterVolume : DEFAULT_VOLUME;
        this.coilVolume = coilVolume || new Map<CoilID, number>();
        this.voiceVolume = voiceVolume || new Map<VoiceID, number>();
        this.specificVolumes = specificVolumes || new Map<CoilID, Map<VoiceID, number>>();
    }

    public getIndividualVolume(key: VolumeKey) {
        const rawResult = (() => {
            if (key.voice !== undefined && key.coil !== undefined) {
                return this.specificVolumes.get(key.coil)?.get(key.voice);
            } else if (key.voice !== undefined) {
                return this.voiceVolume.get(key.voice);
            } else if (key.coil !== undefined) {
                return this.coilVolume.get(key.coil);
            } else {
                return this.masterVolume;
            }
        })();
        return rawResult !== undefined ? rawResult : DEFAULT_VOLUME;
    }

    public getTotalVolume(coil: CoilID, voice: VoiceID) {
        return this.getIndividualVolume({coil, voice}) / 100 *
            this.getIndividualVolume({coil}) / 100 *
            this.getIndividualVolume({voice}) / 100 *
            this.getIndividualVolume({});
    }

    public with(key: VolumeKey, newValue: number) {
        const newCoilVolume = new Map<CoilID, number>(this.coilVolume);
        const newVoiceVolume = new Map<VoiceID, number>(this.voiceVolume);
        const newSpecificVolume = new Map<CoilID, Map<VoiceID, number>>(this.specificVolumes);
        let masterVolume = this.masterVolume;
        if (key.voice !== undefined && key.coil !== undefined) {
            const submap = new Map<VoiceID, number>(newSpecificVolume.get(key.coil));
            submap.set(key.voice, newValue);
            newSpecificVolume.set(key.coil, submap);
        } else if (key.voice !== undefined) {
            newVoiceVolume.set(key.voice, newValue);
        } else if (key.coil !== undefined) {
            newCoilVolume.set(key.coil, newValue);
        } else {
            masterVolume = newValue;
        }
        return new VolumeMap(masterVolume, newCoilVolume, newVoiceVolume, newSpecificVolume);
    }

    public withoutVoiceVolumes() {
        return new VolumeMap(this.masterVolume, this.coilVolume);
    }

    public getFaderStates(currentLayer: MixerLayer): Map<number, number> {
        const baseMap = (() => {
            if (currentLayer === 'coilMaster') {
                return this.coilVolume;
            } else if (currentLayer === 'voiceMaster') {
                return this.voiceVolume;
            } else {
                return this.specificVolumes.get(currentLayer);
            }
        })();
        const resultMap = new Map<number, number>(baseMap);
        for (let i = 0; i < NUM_SPECIFIC_FADERS; ++i) {
            const volume = baseMap?.get(i);
            resultMap.set(i, volume === undefined ? DEFAULT_VOLUME : volume);
        }
        return resultMap;
    }

    public getFaderID(key: VolumeKey) {
        if (key.coil === undefined && key.voice === undefined) {
            // Master
            return NUM_SPECIFIC_FADERS;
        } else if (key.voice === undefined) {
            // Coil master is the only other case without a specified void
            return key.coil;
        } else {
            return key.voice;
        }
    }
}
