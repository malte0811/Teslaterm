import {FullConnectionOptions} from "./ConnectionOptions";
import {AdvancedOptions, CommandConnectionConfig, MidiConfig, NetSidConfig} from "./Options";

export interface TTConfig {
    readonly defaultConnectOptions: FullConnectionOptions;
    readonly midi: MidiConfig;
    readonly netsid: NetSidConfig;
    // TODO remove more references
    readonly command: CommandConnectionConfig;

    readonly udConfigPages: Map<string, number>;
    readonly defaultUDFeatures: Map<string, string>;
}

export function getDefaultAdvancedOptions(cfg: TTConfig): AdvancedOptions {
    return {
        commandOptions: cfg.command,
        midiOptions: cfg.midi,
        netSidOptions: cfg.netsid,
    };
}
