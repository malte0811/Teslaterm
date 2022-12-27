export type CommandRole = 'disable' | 'server' | 'client';

export interface CommandConnectionConfig {
    readonly state: CommandRole;
    readonly port: number;
    readonly remoteName: string;
}

export interface MidiConfig {
    readonly runMidiServer: boolean;
    readonly port: number;
    readonly localName: string;
    readonly bonjourName: string;
}

export interface NetSidConfig {
    readonly enabled: boolean;
    readonly port: number;
}

export interface AdvancedOptions {
    commandOptions: CommandConnectionConfig,
    midiOptions: MidiConfig,
    netSidOptions: NetSidConfig,
}

