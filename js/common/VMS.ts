export type BlockId = number;

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
export enum ThresholdDirection { RISING, FALLING, ANY, NONE }

interface ConstantRef {
    type: 'constant';
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

export interface Block {
    // Own ID
    uid: BlockId;
    // Blocks to start after this one is done, assuming the note is still playing
    // TODO does this need to be optional? All outputs can be unconnected, is that different from not present?
    outputBlocks?: BlockId[];
    // Block to jump to if the note stops during this block, at least if offBehavior=NORMAL
    offBlock?: BlockId;
    // "INVERTED" means (currently?) that the offBlock is ignored. This is intended for the "decay chain" describing the
    // sound after the key has been released.
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
