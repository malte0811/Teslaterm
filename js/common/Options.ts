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

export enum PhysicalMixerType {
    none,
    behringer_x_touch,
}

export const PHYSICAL_MIXER_TYPES = [PhysicalMixerType.none, PhysicalMixerType.behringer_x_touch];

export function getMixerTypeName(type: PhysicalMixerType) {
    switch (type) {
        case PhysicalMixerType.none:
            return 'None';
        case PhysicalMixerType.behringer_x_touch:
            return 'Behringer X-Touch';
    }
}

export interface PhysicalMixerConfig {
    type: PhysicalMixerType;
    ip: string;
    port: number;
}

export interface AdvancedOptions {
    midiOptions: MidiConfig;
    netSidOptions: NetSidConfig;
    mixerOptions: PhysicalMixerConfig;
    enableMIDIInput: boolean;
}

