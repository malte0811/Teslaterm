import {getUD3Connection} from "../connection";
import {sendTelemetryFrame, TelemetryFrameParser} from "./TelemetryFrame";

enum TelemetryFrameState {
    idle,
    frame,
    collect,
}

export class TelemetryChannel {
    private frameParser: TelemetryFrameParser | undefined;
    private state: TelemetryFrameState = TelemetryFrameState.idle;
    private readonly source: object;

    constructor(source: object) {
        this.source = source;
    }

    public processByte(byte: number, print: (s: string) => void, initializing: boolean) {
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
                this.frameParser = new TelemetryFrameParser(byte);
                this.state = TelemetryFrameState.collect;
                break;
            case TelemetryFrameState.collect:
                const frame = this.frameParser.addByte(byte);
                if (frame) {
                    if (!this.source || getUD3Connection().isMultiTerminal()) {
                        sendTelemetryFrame(frame, this.source, initializing);
                    }
                    this.frameParser = undefined;
                    this.state = TelemetryFrameState.idle;
                }
                break;
        }
    }
}
