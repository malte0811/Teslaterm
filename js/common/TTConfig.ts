import {FullConnectionOptions} from "./ConnectionOptions";
import {AdvancedOptions, CommandConnectionConfig, MidiConfig, NetSidConfig} from "./Options";

export interface TTConfig {
    readonly defaultConnectOptions: FullConnectionOptions;
    readonly midi: MidiConfig;
    readonly netsid: NetSidConfig;
    readonly command: CommandConnectionConfig;

    readonly udConfigPages: Map<string, number>;
    readonly defaultUDFeatures: Map<string, string>;
}

export function getDefaultAdvanccedOptions(cfg: TTConfig): AdvancedOptions {
    return {
        commandOptions: cfg.command,
        midiOptions: cfg.midi,
        netSidOptions: cfg.netsid,
    };
}

