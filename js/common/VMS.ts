import {getEnumValues} from "../main/helper";

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
// TODO better way?
export const KNOWN_VALUES = getEnumValues(KnownValue);

export function vmsValueToString(value: KnownValue) {
    // TODO not happy with this, look into alternatives
    switch (value) {
        case KnownValue.maxOnTime:
            return 'maxOnTime';
        case KnownValue.minOnTime:
            return 'minOnTime';
        case KnownValue.onTime:
            return "onTime";
        case KnownValue.otCurrent:
            return 'otCurrent';
        case KnownValue.otTarget:
            return 'otTarget';
        case KnownValue.otFactor:
            return 'otFactor';
        case KnownValue.frequency:
            return 'frequency';
        case KnownValue.freqCurrent:
            return 'freqCurrent';
        case KnownValue.freqTarget:
            return 'freqTarget';
        case KnownValue.freqFactor:
            return 'freqFactor';
        case KnownValue.noise:
            return 'noise';
        case KnownValue.pTime:
            return 'pTime';
        case KnownValue.circ1:
            return 'circ1';
        case KnownValue.circ2:
            return 'circ2';
        case KnownValue.circ3:
            return 'circ3';
        case KnownValue.circ4:
            return 'circ4';
        case KnownValue.CC_102:
            return 'CC_102';
        case KnownValue.CC_103:
            return 'CC_103';
        case KnownValue.CC_104:
            return 'CC_104';
        case KnownValue.CC_105:
            return 'CC_105';
        case KnownValue.CC_106:
            return 'CC_106';
        case KnownValue.CC_107:
            return 'CC_107';
        case KnownValue.CC_108:
            return 'CC_108';
        case KnownValue.CC_109:
            return 'CC_109';
        case KnownValue.CC_110:
            return 'CC_110';
        case KnownValue.CC_111:
            return 'CC_111';
        case KnownValue.CC_112:
            return 'CC_112';
        case KnownValue.CC_113:
            return 'CC_113';
        case KnownValue.CC_114:
            return 'CC_114';
        case KnownValue.CC_115:
            return 'CC_115';
        case KnownValue.CC_116:
            return 'CC_116';
        case KnownValue.CC_117:
            return 'CC_117';
        case KnownValue.CC_118:
            return 'CC_118';
        case KnownValue.CC_119:
            return 'CC_119';
        case KnownValue.HyperVoice_Count:
            return 'HyperVoice Count';
        case KnownValue.HyperVoice_Phase:
            return 'HyperVoice Phase';
        case KnownValue.HyperVoice_Volume:
            return 'HyperVoice Volume';
        case KnownValue.volume:
            return 'Volume';
        case KnownValue.volumeCurrent:
            return 'volumeCurrent';
        case KnownValue.volumeTarget:
            return 'volumeTarget';
        case KnownValue.volumeFactor:
            return 'volumeFactor';
    }
    value satisfies never;
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
    // TODO needs a 1e6 factor to it in legacy parser and wire serializer
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
    // TODO this needs to be derived from whether there is an incoming edge
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
    // TODO seem to be various volume multipliers? enableVolume also depends on note velocity
    enableStereo: boolean;
    enableVolume: boolean;
    enableDamper: boolean;
    // TODO a bit magical, not clear if this is active in the current UD3 code?
    enablePortamento: boolean;
}

export interface BlockMap {
    options: MapOptions;
    // ID of the first block of this map
    // TODO maybe use a different ID concept in memory? In UD3, IDs are global across maps.
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
