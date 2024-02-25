import {TelemetryFrame} from "../../../common/TelemetryTypes";
import {TelemetryFrameParser} from "./TelemetryFrame";

enum TelemetryFrameState {
    idle,
    frame,
    collect,
}

export class TelemetryChannel {
    private frameParser: TelemetryFrameParser | undefined;
    private state: TelemetryFrameState = TelemetryFrameState.idle;

    public processBytes(bytes: Iterable<number>, print: (s: string) => void, handleFrame: (f: TelemetryFrame) => any) {
        for (const byte of bytes) {
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
                        handleFrame(frame);
                        this.frameParser = undefined;
                        this.state = TelemetryFrameState.idle;
                    }
                    break;
            }
        }
    }
}
