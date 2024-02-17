export const FRAME_LENGTH = 25;
export const FRAME_UDTIME_LENGTH = 4;

export class SidFrame {
    public readonly data: Uint8Array;
    public readonly delayMicrosecond: number;

    constructor(data: Uint8Array, delayUS: number) {
        if (data.byteLength !== FRAME_LENGTH) {
            throw new Error("Wrong SID frame size: " + data.byteLength);
        }
        this.data = data;
        this.delayMicrosecond = delayUS;
    }
}

export interface AbsoluteSIDFrame {
    data: Uint8Array;
    time: number;
}

export interface ISidSource {
    next_frame(): SidFrame;

    getTotalFrameCount(): number | null;

    getCurrentFrameCount(): number;

    isDone(): boolean;
}
