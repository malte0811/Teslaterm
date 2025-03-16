export const FRAME_LENGTH = 25;
export const FRAME_UDTIME_LENGTH = 4;

export class SidFrame {
    public readonly data: number[];
    public readonly delayMicrosecond: number;

    constructor(data: number[], delayUS: number) {
        if (data.length !== FRAME_LENGTH) {
            throw new Error("Wrong SID frame size: " + data.length);
        }
        this.data = data;
        this.delayMicrosecond = delayUS;
    }
}

export interface AbsoluteSIDFrame {
    data: number[];
    time: number;
}

export interface ISidSource {
    next_frame(): SidFrame;

    getTotalFrameCount(): number | null;

    getCurrentFrameCount(): number;

    isDone(): boolean;
}
