import {getUD3Connection} from "../connection/connection";
import {ISidConnection} from "./ISidConnection";
import {FRAME_LENGTH, FRAME_UDTIME_LENGTH, SidFrame} from "./sid_api";
import * as microtime from "../microtime";

export enum FormatVersion {
    v1,
    v2
}

export class UD3FormattedConnection implements ISidConnection {
    public sendToUD: (data: Buffer) => Promise<void>;
    private readonly flushCallback: () => Promise<void>;
    private lastFrameTime: number | undefined;
    private busy: boolean = false;
    private ffPrefixBytes: number = 4;
    private needsZeroSuffix: boolean = true;

    constructor(flushCallback: () => Promise<void>, sendToUD: (data: Buffer) => Promise<void>) {
        this.flushCallback = flushCallback;
        this.sendToUD = sendToUD;
    }

    flush(): Promise<void> {
        return this.flushCallback();
    }

    onStart(): void {
        this.busy = false;
        this.lastFrameTime = microtime.now() + 50e3;
    }

    switch_format(version: FormatVersion) {
        switch (version) {
            case FormatVersion.v1:
                this.ffPrefixBytes = 4;
                this.needsZeroSuffix = true;
                break;
            case FormatVersion.v2:
                this.ffPrefixBytes = 0;
                this.needsZeroSuffix = false;
                break;
        }
    }

    processFrame(frame: SidFrame): Promise<void> {
        if (!this.lastFrameTime) {
            console.error("Processing a frame, but do not have last frame time!");
            this.lastFrameTime = microtime.now();
        } else if (this.lastFrameTime < microtime.now() - 1e6) {
            console.warn("SID playback fell behind by over 1 second, resetting timestamp");
            this.lastFrameTime = microtime.now();
        }
        const ud_time = getUD3Connection().toUD3Time(this.lastFrameTime);
        const frameSize = this.ffPrefixBytes + FRAME_LENGTH + FRAME_UDTIME_LENGTH + (this.needsZeroSuffix ? 1 : 0);
        const data = Buffer.alloc(frameSize);
        let byteCount = 0;

        for (let j = 0; j < this.ffPrefixBytes; ++j) {
            data[byteCount++] = 0xFF;
        }
        for (let j = 0; j < FRAME_LENGTH; ++j) {
            data[byteCount++] = frame.data[j];
        }

        for (let j = 0; j < FRAME_UDTIME_LENGTH; ++j) {
            data[byteCount++] = ud_time[j];
        }
        if (this.needsZeroSuffix) {
            data[byteCount] = 0;
        }

        this.lastFrameTime += frame.delayMicrosecond;
        return this.sendToUD(data);

    }

    public setBusy(busy: boolean): void {
        this.busy = busy;
    }

    isBusy(): boolean {
        return this.busy;
    }
}
