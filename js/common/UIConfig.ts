import {ConnectionPreset} from "./IPCConstantsToRenderer";
import {AdvancedOptions} from "./Options";
import {FullConnectionOptions} from "./SingleConnectionOptions";
import {VolumeSetting} from "./VolumeMap";

export interface SyncedUIConfig {
    connectionPresets: ConnectionPreset[];
    darkMode: boolean;
    centralTelemetry: string[];
    midiPrograms: string[];

    lastConnectOptions: FullConnectionOptions;
    advancedOptions: AdvancedOptions;
}

export interface CoilMixerState {
    channelSettings: Array<Partial<VolumeSetting>>;
    masterSetting: Partial<VolumeSetting>;
}

export interface SavedMixerState {
    coilSettings: { [coilName: string]: CoilMixerState; };
    masterSettings: CoilMixerState;
    channelPrograms: string[];
}

export interface FullUIConfig {
    syncedConfig: SyncedUIConfig;
    mixerStateBySong: { [filename: string]: SavedMixerState};
}
