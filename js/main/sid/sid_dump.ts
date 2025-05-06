import {FRAME_LENGTH, ISidSource, SidFrame} from "./sid_api";

export class DumpSidSource implements ISidSource {
    private sid_file: number[];
    private processedFrames: number = 0;

    constructor(data: number[]) {
        this.sid_file = data;
    }

    public next_frame(): SidFrame {
        const ret = this.sid_file.slice(FRAME_LENGTH * this.processedFrames, FRAME_LENGTH * (this.processedFrames + 1));
        this.processedFrames++;
        return new SidFrame(ret, 2e4);
    }

    public getTotalFrameCount(): number | null {
        return this.sid_file.length / FRAME_LENGTH;
    }

    public getCurrentFrameCount(): number {
        return this.processedFrames;
    }

    public isDone(): boolean {
        return this.processedFrames * FRAME_LENGTH >= this.sid_file.length;
    }
}
