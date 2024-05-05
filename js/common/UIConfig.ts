import {ConnectionPreset} from "./IPCConstantsToRenderer";
import {AdvancedOptions} from "./Options";
import {FullConnectionOptions} from "./SingleConnectionOptions";

export interface UIConfig {
    connectionPresets: ConnectionPreset[];
    darkMode: boolean;
    centralTelemetry: string[];
    midiPrograms: string[];

    lastConnectOptions: FullConnectionOptions;
    advancedOptions: AdvancedOptions;
}
