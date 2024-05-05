import {FullConnectionOptions} from "./SingleConnectionOptions";
import {AdvancedOptions, MidiConfig, NetSidConfig} from "./Options";

export interface TTConfig {
    readonly defaultConnectOptions: FullConnectionOptions;
    readonly defaultMidiConfig: MidiConfig;
    readonly defaultNetSIDConfig: NetSidConfig;
    readonly useMIDIPorts: boolean;

    readonly udConfigPages: Map<string, number>;
    readonly defaultUDFeatures: Map<string, string>;
}

export function getDefaultAdvancedOptions(cfg: TTConfig): AdvancedOptions {
    return {
        midiOptions: cfg.defaultMidiConfig,
        netSidOptions: cfg.defaultNetSIDConfig,
    };
}
