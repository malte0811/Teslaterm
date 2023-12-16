import {CoilID} from "../../common/constants";
import {ICommandServer} from "../command/CommandServer";
import {getUD3Connection} from "../connection/connection";
import * as microtime from "../microtime";
import {ISidConnection} from "./ISidConnection";
import {FRAME_LENGTH, FRAME_UDTIME_LENGTH, SidFrame} from "./sid_api";

export enum FormatVersion {
    v1,
    v2,
}

export class UD3FormattedConnection implements ISidConnection {
    public sendToUD: (data: Buffer) => Promise<void>;
    private readonly flushCallback: () => Promise<void>;
    private lastFrameTime: number | undefined;
    private busy: boolean = false;
    private ffPrefixBytes: number = 4;
    private needsZeroSuffix: boolean = true;
    private queuedFrames: SidFrame[] = [];
    private coil: CoilID;

    constructor(flushCallback: () => Promise<void>, sendToUD: (data: Buffer) => Promise<void>, coil: CoilID) {
        this.flushCallback = flushCallback;
        this.sendToUD = sendToUD;
        this.coil = coil;
    }

    public flush(): Promise<void> {
        return this.flushCallback();
    }

    public onStart(): void {
        this.busy = false;
        this.lastFrameTime = microtime.now() + 500e3;
    }

    public async tick() {
        let i = 0;
        while (!this.isBusy() && this.queuedFrames.length > 0 && i < 4) {
            await this.processFrame(this.queuedFrames.shift());
            ++i;
        }
    }

    public switch_format(version: FormatVersion) {
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

    public async sendVMSFrames(data: Buffer) {
    }

    public async queueFrame(frame: SidFrame): Promise<void> {
        this.queuedFrames.push(frame);
    }

    public processFrame(frame: SidFrame): Promise<void> {
        if (!this.lastFrameTime) {
            console.warn("SID: No previous frame time?");
            this.lastFrameTime = microtime.now();
            return;
        }
        const absoluteTime = this.lastFrameTime;
        this.lastFrameTime += frame.delayMicrosecond;
        return this.processAbsoluteFrame(frame.data, absoluteTime);
    }

    public processAbsoluteFrame(frameData: Uint8Array, absoluteTime: number): Promise<void> {
        const ud_time = getUD3Connection(this.coil).toUD3Time(absoluteTime);
        const frameSize = this.ffPrefixBytes + FRAME_LENGTH + FRAME_UDTIME_LENGTH + ( this.needsZeroSuffix ? 1 : 0);
        const data = Buffer.alloc(frameSize);
        let byteCount = 0;

        for (let j = 0; j < this.ffPrefixBytes; ++j) {
            data[byteCount++] = 0xFF;
        }
        for (let j = 0; j < FRAME_LENGTH; ++j) {
            data[byteCount++] = frameData[j];
        }

        for (let j = 0; j < FRAME_UDTIME_LENGTH; ++j) {
            data[byteCount++] = ud_time[j];
        }
        if (this.needsZeroSuffix) {
            data[byteCount] = 0;
        }
        // TODO rework command server/client system for multicoil TT
        //  commandServer.sendSIDFrame(frameData, absoluteTime);
        return this.sendToUD(data);
    }

    public setBusy(busy: boolean): void {
        this.busy = busy;
    }

    public isBusy(): boolean {
        // Refuse to send new frames if we're ahead by 1 seconds or more: In this case the UD3 probably sent an "XOFF"
        // already, but it has not arrived yet (e.g. due to noise on the line requiring MIN retransmits). Additionally,
        // the UD3's buffer is only about 1 second (64 entries), so anything much above 1 second will be lost anyway.
        return this.busy || this.lastFrameTime - microtime.now() > 0.5e6;
    }
}
