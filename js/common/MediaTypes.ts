export const enum MediaFileType {
    none,
    midi,
    sid_dmp,
    sid_emulated,
}

export enum SynthType {
    NONE = 0x04,
    MIDI = 0x03,
    SID = 0x02,
}

export function synthTypeToString(type: SynthType) {
    switch (type) {
        case SynthType.NONE:
            return 'none';
        case SynthType.MIDI:
            return 'midi';
        case SynthType.SID:
            return 'sid';
        default:
            return 'Unknown synth type ' + type;
    }
}

export const enum PlayerActivity {
    playing,
    idle,
}

export function synthTypeFor(fileType: MediaFileType): SynthType {
    switch (fileType) {
        case MediaFileType.none:
            return SynthType.NONE;
        case MediaFileType.midi:
            return SynthType.MIDI;
        case MediaFileType.sid_dmp:
        case MediaFileType.sid_emulated:
            return SynthType.SID;
    }
    throw new Error("Unknown media file type: " + fileType);
}
