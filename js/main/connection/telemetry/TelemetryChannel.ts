import {getUD3Connection} from "../connection";
import {TelemetryFrame} from "./TelemetryFrame";

enum TelemetryFrameState {
    idle,
    frame,
    collect,
}

export class TelemetryChannel {
    private currentFrame: TelemetryFrame | undefined;
    private state: TelemetryFrameState = TelemetryFrameState.idle;
    private readonly source: object;

    constructor(source: object) {
        this.source = source;
    }

    public processByte(byte: number, print: (s: string) => void) {
        switch (this.state) {
            case TelemetryFrameState.idle:
                if (byte === 0xff) {
                    this.state = TelemetryFrameState.frame;
                } else {
                    const asString = String.fromCharCode(byte);
                    print(asString);
                }
                break;
            case TelemetryFrameState.frame:
                this.currentFrame = new TelemetryFrame(byte);
                this.state = TelemetryFrameState.collect;
                break;
            case TelemetryFrameState.collect:
                this.currentFrame.addByte(byte);
                if (this.currentFrame.isFull()) {
                    if (!this.source || getUD3Connection().isMultiTerminal()) {
                        this.currentFrame.process(this.source);
                    }
                    this.currentFrame = undefined;
                    this.state = TelemetryFrameState.idle;
                }
                break;
        }
    }
}
