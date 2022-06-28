import {ipcs} from "../ipc/IPCProvider";
import {resetResponseTimeout} from "./state/Connected";
import {TelemetryChannel} from "./telemetry/TelemetryChannel";

const channels: Map<object, TelemetryChannel> = new Map();
let consoleLine: string = "";

export function receive_main(data: Buffer, source?: object) {
    const buf = new Uint8Array(data);
    resetResponseTimeout();
    if (!channels.has(source)) {
        channels.set(source, new TelemetryChannel(source));
    }
    let print: (s: string) => void;

    if (source) {
        print = (s) => ipcs.terminal.print(s, source);
    } else {
        print = (s) => {
            if (s === '\n' || s === '\r') {
                if (consoleLine !== "") {
                    console.log(consoleLine);
                    consoleLine = "";
                }
            } else {
                if (s !== '\u0000') {
                    consoleLine += s;
                }
            }
        };
    }
    for (const byte of buf) {
        channels.get(source).processByte(byte, print);
    }
}
