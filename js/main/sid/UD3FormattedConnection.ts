import {CoilID} from "../../common/constants";
import {getOptionalUD3Connection, getUD3Connection} from "../connection/connection";
import * as microtime from "../microtime";
import {ISidConnection, SidCommand} from "./ISidConnection";
import {getFirstQueuedFrameAfter} from "./sid";
import {AbsoluteSIDFrame, FRAME_LENGTH, FRAME_UDTIME_LENGTH, SidFrame} from "./sid_api";

export enum FormatVersion {
    v1,
    v2,
}

export type SIDDataCallback = (data: Buffer, direct: boolean) => Promise<any>;

export class UD3FormattedConnection implements ISidConnection {
    private readonly sendToUD: SIDDataCallback;
    private readonly flushCallback: () => Promise<void>;
    private lastQueuedFrameTime: number | undefined = 0;
    private lastSentFrameTime: number | undefined = 0;
    private busy: boolean = false;
    private ffPrefixBytes: number = 4;
    private needsZeroSuffix: boolean = true;
    private readonly coil: CoilID;

    constructor(flushCallback: () => Promise<void>, sendToUD: SIDDataCallback, coil: CoilID) {
        this.flushCallback = flushCallback;
        this.sendToUD = sendToUD;
        this.coil = coil;
    }

    public flush(): Promise<void> {
        // Offset is only here to make sure we do not get "frame is in the past" warnings from the UD3. The actual
        // start offset is handled in flushAllSID! Note that this offset has to be smaller than the start offset,
        // otherwise the first few frames (the difference) are dropped.
        this.lastQueuedFrameTime = this.lastSentFrameTime = microtime.now() + 10e3;
        return this.flushCallback();
    }

    public onStart(): void {
        this.busy = false;
    }

    public async sendCommand(command: SidCommand, channel: number, value: number): Promise<void> {
        await this.sendToUD(Buffer.of(0, command, channel, value >> 8, value & 255), true);
    }

    public tick() {
        let i = 0;
        while (!this.isBusyImpl(this.lastSentFrameTime) && i < 4) {
            const nextFrame = getFirstQueuedFrameAfter(this.lastSentFrameTime);
            if (nextFrame) {
                this.sendAbsoluteFrame(nextFrame);
            } else {
                break;
            }
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

    public sendAbsoluteFrame(frame: AbsoluteSIDFrame) {
        const connection = getOptionalUD3Connection(this.coil);
        if (!connection) {
            return;
        }
        const ud_time = connection.toUD3Time(frame.time);
        const frameSize = this.ffPrefixBytes + FRAME_LENGTH + FRAME_UDTIME_LENGTH + ( this.needsZeroSuffix ? 1 : 0);
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
        this.lastSentFrameTime = frame.time;
        this.sendToUD(data, false);
    }

    public setBusy(busy: boolean): void {
        this.busy = busy;
    }

    public isBusy(): boolean {
        return this.isBusyImpl(this.lastQueuedFrameTime);
    }

    private isBusyImpl(lastFrameTime: number): boolean {
        // Refuse to send new frames if we're ahead by 1 seconds or more: In this case the UD3 probably sent an "XOFF"
        // already, but it has not arrived yet (e.g. due to noise on the line requiring MIN retransmits). Additionally,
        // the UD3's buffer is only about 1 second (64 entries), so anything much above 1 second will be lost anyway.
        return this.busy || lastFrameTime - microtime.now() > 0.5e6;
    }
}
