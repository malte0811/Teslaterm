import {getEnumValues} from "../helper";

export type BlockId = number;

export const OUTPUTS = 4;
export type BlockOutput = number | 'off';
export type BlockIO = BlockOutput | 'in';

export enum NoteOffBehavior { INVERTED, NORMAL }
export enum KnownValue {
    maxOnTime, minOnTime, onTime,
    otCurrent, otTarget, otFactor,
    frequency, freqCurrent, freqTarget, freqFactor,
    noise,
    pTime,
    // Only used to pass values between blocks (?)
    circ1, circ2, circ3, circ4,
    // Values of various MIDI CC parameters
    CC_102, CC_103, CC_104, CC_105, CC_106, CC_107,
    CC_108, CC_109, CC_110, CC_111, CC_112, CC_113,
    CC_114, CC_115, CC_116, CC_117, CC_118, CC_119,
    HyperVoice_Count, HyperVoice_Phase, HyperVoice_Volume,
    volume, volumeCurrent, volumeTarget, volumeFactor,
}
export type AffectedValue = KnownValue.onTime | KnownValue.frequency | KnownValue.freqCurrent | KnownValue.noise |
    KnownValue.circ1 | KnownValue.circ2 | KnownValue.circ3 | KnownValue.circ4 | KnownValue.HyperVoice_Count |
    KnownValue.HyperVoice_Phase | KnownValue.HyperVoice_Volume;
export const AFFECTED_VALUES: AffectedValue[] = [
    KnownValue.onTime, KnownValue.frequency, KnownValue.freqCurrent, KnownValue.noise, KnownValue.circ1,
    KnownValue.circ2, KnownValue.circ3, KnownValue.circ4, KnownValue.HyperVoice_Count, KnownValue.HyperVoice_Phase,
    KnownValue.HyperVoice_Volume,
];
export const KNOWN_VALUES = getEnumValues(KnownValue);

export function vmsValueToString(value: KnownValue) {
    return KnownValue[value];
}

export function modulationToString(mType: ModulationType) {
    switch (mType) {
        case ModulationType.step:
            return 'Step';
        case ModulationType.exp:
            return 'Exponential';
        case ModulationType.exp_inverse:
            return 'Reverse Exponential';
        case ModulationType.linear:
            return 'Linear';
        case ModulationType.sine:
            return 'Sine';
    }
    mType satisfies never;
}

interface ConstantRef {
    type: 'constant';
    value: number;
}
interface KnownValueRef {
    type: 'value';
    // On wire: Packed, from LSB to MSB (TODO verify):
    //  - 8 bits value
    //  - 12 bits rangeStart
    //  - 12 bits rangeEnd
    value: KnownValue;
    // Rescale and shift the range of the KnownValue to this range
    // TODO may not be encoded this way in legacy files? Those have tFRangeEnd etc?
    rangeStart: number;
    rangeEnd: number;
}
export type ConstantOrValue = ConstantRef | KnownValueRef;

export enum ModulationType {
    exp = 1,
    exp_inverse,
    linear,
    sine,
    step,
}

export interface ExpModulation {
    type: ModulationType.exp;
    // Multiply absolute value by this every cycle
    growthFactor: ConstantOrValue;
}
export interface InverseExpModulation {
    type: ModulationType.exp_inverse;
    // Decrease difference to target by factor (1 - this) every cycle
    growthFactor: ConstantOrValue;
}
export interface LinearModulation {
    type: ModulationType.linear;
    // Add this value every cycle
    slope: ConstantOrValue;
}
export interface SineModulation {
    type: ModulationType.sine;
    // Set current value as "offset + scale * sin(timeIncrement * t)" (for correctly scaled t)
    scale: ConstantOrValue;
    offset: ConstantOrValue;
    // Scaled by pi/256 (TODO is there any scaling done within the UD3?)
    timeIncrement: ConstantOrValue;
}

export interface StepModulation {
    type: ModulationType.step;
}
export type Modulation = ExpModulation | InverseExpModulation | LinearModulation | SineModulation | StepModulation;

export interface Block {
    // Own ID
    uid: BlockId;
    // Blocks to start after this one is done, assuming the note is still playing
    outputBlocks: BlockId[];
    // Block to jump to if the note stops during this block, at least if offBehavior=NORMAL
    offBlock?: BlockId;
    // "INVERTED" means (currently?) that the offBlock is ignored. This is intended for the "decay chain" describing the
    // sound after the key has been released.
    offBehavior: NoteOffBehavior;
    // How fast/with what waveform should the target value be updated
    modulation: Modulation;
    // The value to be updated
    target: AffectedValue;
    targetFactor: ConstantOrValue;
    // Length of the "cycle" referred to in the modulation descriptions
    periodMS: number;
    // Only for editor, not relevant for actual synth
    visualX: number;
    visualY: number;
}

export type MapFrequency = { type: 'offset', midiNotes: number } | { type: 'fixed', frequencyHz: number };

export interface MapOptions {
    // Note range (closed interval) for which this map should be used. It is valid for multiple maps in the same program
    // to include the same note, in this case multiple voices will be added for a single NoteOn event.
    startNote: number;
    endNote: number;
    noteFrequency: MapFrequency;
    // Scale note volume by this while map is active
    volumeScale: number;
    // Should MIDI pitchbend affect notes handled by this block?
    enablePitchbend: boolean;
    enableStereo: boolean;
    enableVolume: boolean;
    enableDamper: boolean;
    // TODO Currently not in UI since it is not supported in the UD3 yet
    enablePortamento: boolean;
}

export interface BlockMap {
    options: MapOptions;
    // ID of the first block of this map
    startBlock: number;
    // Blocks used by this map
    blocks: Block[];
}

export interface Program {
    maps: BlockMap[];
    name: string;
}

export interface MapReference {
    programId: number;
    mapId: number;
}

export type FullVMSData = Program[];
