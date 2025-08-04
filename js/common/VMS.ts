export type BlockId = number;

export const OUTPUTS = 4;
export type BlockOutput = number | 'off';
export type BlockIO = BlockOutput | 'in';

export enum NoteOffBehavior { NORMAL, INVERTED }
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
export enum ThresholdDirection { RISING, FALLING, ANY, NONE }

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
        case "step":
            return 'Step';
        case "exp":
            return 'Exponential';
        case "exp-reverse":
            return 'Reverse Exponential';
        case "linear":
            return 'Linear';
        case "sine":
            return 'Sine';
    }
    mType satisfies never;
}

interface ConstantRef {
    type: 'constant';
    // TODO may have a 1e6 factor to it?
    value: number;
}
interface KnownValueRef {
    type: 'value';
    value: KnownValue;
    // Rescale and shift the range of the KnownValue to this range
    rangeStart: number;
    rangeEnd: number;
}
export type ConstantOrValue = ConstantRef | KnownValueRef;

interface ExpModulation {
    type: 'exp';
    // Multiply absolute value by this every cycle
    growthFactor: ConstantOrValue;
}
interface InverseExpModulation {
    type: 'exp-reverse';
    // Decrease difference to target by factor (1 - this) every cycle
    growthFactor: ConstantOrValue;
}
interface LinearModulation {
    type: 'linear';
    // Add this value every cycle
    slope: ConstantOrValue;
}
interface SineModulation {
    type: 'sine';
    // Set current value as "offset + scale * sin(timeIncrement * t)" (for correctly scaled t)
    scale: ConstantOrValue;
    offset: ConstantOrValue;
    // Scaled by pi/256 (TODO is there any scaling done within the UD3?)
    timeIncrement: ConstantOrValue;
}
interface StepModulation {
    type: 'step';
}
export type Modulation = ExpModulation | InverseExpModulation | LinearModulation | SineModulation | StepModulation;
export type ModulationType = Modulation['type'];

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
    // Move on to next block once the target value exceeds the targetFactor in this direction
    thresholdDirection: ThresholdDirection;
    targetFactor: ConstantOrValue;
    // Length of the "cycle" referred to in the modulation descriptions
    periodMS: number;
}

export type MapFrequency = { type: 'offset', midiNotes: number } | { type: 'fixed', frequencyHz: number };

export interface BlockMap {
    // Note range (closed interval) for which this map should be used
    startNote: number;
    endNote: number;
    noteFrequency: MapFrequency;
    // Scale note volume by value/255 while map is active
    volumeModifier: number;
    // Should MIDI pitchbend affect notes handled by this block?
    enablePitchbend: boolean;
    // TODO seem to be various volume multipliers? enableVolume also depends on note velocity
    enableStereo: boolean;
    enableVolume: boolean;
    enableDamper: boolean;
    // TODO a bit magical, not clear if this is active in the current UD3 code?
    ENA_PORTAMENTO: boolean;
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
