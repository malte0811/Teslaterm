import {CoilID} from "./constants";
import {ChannelID} from "./IPCConstantsToRenderer";

export type VolumeKey = {
    coil?: CoilID;
    channel?: ChannelID;
} | 'sidSpecial';

export type MixerLayer = CoilID | 'coilMaster' | 'voiceMaster';

export const DEFAULT_MIXER_LAYER = 'coilMaster';

export interface VolumeSetting {
    muted: boolean;
    volumePercent: number;
}

export type VolumeUpdate = Partial<VolumeSetting>;

export const DEFAULT_VOLUME: VolumeSetting = {muted: false, volumePercent: 100};

export interface FaderData {
    key: VolumeKey;
    volume: VolumeSetting;
    title: string;
    programID?: number;
    muteSuffix?: string;
}

export interface AllFaders {
    specificFaders: Array<FaderData | undefined>;
    masterVolumePercent: number;
}
