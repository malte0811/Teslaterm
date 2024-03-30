import {CoilID} from "./constants";
import {VoiceID} from "./IPCConstantsToRenderer";

export interface VolumeKey {
    coil?: CoilID;
    voice?: VoiceID;
}

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
        this.masterVolume = masterVolume || 100;
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
        return rawResult !== undefined ? rawResult : 100;
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
}
