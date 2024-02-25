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
    midiOptions: MidiConfig;
    netSidOptions: NetSidConfig;
}

