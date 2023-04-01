import {FullConnectionOptions} from "./ConnectionOptions";
import {AdvancedOptions, CommandConnectionConfig, MidiConfig, NetSidConfig} from "./Options";

export interface TTConfig {
    readonly defaultConnectOptions: FullConnectionOptions;
    readonly defaultMidiConfig: MidiConfig;
    readonly defaultNetSIDConfig: NetSidConfig;
    readonly defaultCommandOptions: CommandConnectionConfig;

    readonly udConfigPages: Map<string, number>;
    readonly defaultUDFeatures: Map<string, string>;
}

export function getDefaultAdvancedOptions(cfg: TTConfig): AdvancedOptions {
    return {
        commandOptions: cfg.defaultCommandOptions,
        midiOptions: cfg.defaultMidiConfig,
        netSidOptions: cfg.defaultNetSIDConfig,
    };
}
