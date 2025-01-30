import {MidiEvent} from "midi-file";

export const VOLUME_CC_KEY = 7;
export const ALL_SOUND_OFF_CC_KEY = 0x78;
export const PITCH_BEND_BIAS = 0x2000;

export function eventToWireBytes(event: MidiEvent): number[] {
    switch (event.type) {
        case 'sysEx':
            return [0xF0, ...toVarInt(event.data.length), ...cleanArray(event.data)];
        case 'endSysEx':
            return [0xF7, ...toVarInt(event.data.length), ...cleanArray(event.data)];
        case 'noteOff':
            return [0x80 | event.channel, event.noteNumber, event.velocity];
        case 'noteOn':
            return [0x90 | event.channel, event.noteNumber, event.velocity];
        case 'noteAftertouch':
            return [0xA0 | event.channel, event.noteNumber, event.amount];
        case 'controller':
            return [0xB0 | event.channel, event.controllerType, event.value];
        case 'programChange':
            return [0xC0 | event.channel, event.programNumber];
        case 'channelAftertouch':
            return [0xD0 | event.channel, event.amount];
        case 'pitchBend':
            const biasedValue = PITCH_BEND_BIAS + event.value;
            const lower7Bits = (biasedValue & 0x7F);
            const upper7Bits = (biasedValue >> 7) & 0x7F;
            return [0xE0 | event.channel, lower7Bits, upper7Bits];
        // Skipped events, (currently) not processed by the UD3
        case 'sequenceNumber':
        case 'text':
        case 'copyrightNotice':
        case 'trackName':
        case 'instrumentName':
        case 'lyrics':
        case 'marker':
        case 'cuePoint':
        case 'channelPrefix':
        case 'portPrefix':
        case 'endOfTrack':
        case 'setTempo':
        case 'smpteOffset':
        case 'timeSignature':
        case 'keySignature':
        case 'sequencerSpecific':
        case 'unknownMeta':
            return undefined;
        default:
            console.error(`Unknown MIDI message: ${JSON.stringify(event)}`);
            return undefined;
    }
}

export function buildControllerMessage(controllerType: number, value: number, channel: number): MidiEvent {
    return {channel, controllerType, deltaTime: 0, type: 'controller', value};
}

function toVarInt(value: number) {
    let remaining = value;
    const bytes: number[] = [];
    bytes.push(remaining & 0x7F);
    remaining >>= 7;
    while (remaining) {
        bytes.push(remaining & 0x7F | 0x80);
        remaining >>= 7;
    }
    return bytes.reverse();
}

function cleanArray<T>(data: ArrayLike<T>): T[] {
    const result: T[] = [];
    for (let i = 0; i < data.length; ++i) {
        result.push(data[i]);
    }
    return result;
}
