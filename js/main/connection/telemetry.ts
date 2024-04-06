import {CoilID} from "../../common/constants";
import {ipcs} from "../ipc/IPCProvider";
import {getUD3Connection} from "./connection";
import {resetResponseTimeout} from "./state/Connected";
import {TelemetryChannel} from "./telemetry/TelemetryChannel";
import {sendTelemetryFrame} from "./telemetry/TelemetryFrame";

const channels: Map<CoilID, Map<object, TelemetryChannel>> = new Map();
let consoleLine: string = "";

function getOrCreateChannel(coil: CoilID, source?: object) {
    if (!channels.has(coil)) {
        channels.set(coil, new Map());
    }
    const innerMap = channels.get(coil);
    if (!innerMap.has(source)) {
        innerMap.set(source, new TelemetryChannel());
    }
    return innerMap.get(source);
}

export function receive_main(coil: CoilID, data: Buffer, initializing: boolean, onAutoTerminal: boolean) {
    const buf = new Uint8Array(data);
    resetResponseTimeout(coil);
    let print: (s: string) => void;

    if (!onAutoTerminal) {
        print = (s) => ipcs.terminal(coil).print(s);
    } else {
        print = (s) => {
            if (s === '\n' || s === '\r') {
                if (consoleLine !== "") {
                    consoleLine = "";
                }
            } else if (s !== '\u0000') {
                consoleLine += s;
            }
        };
    }
    const handleFrame = (frame) => sendTelemetryFrame(frame, coil, initializing);
    getOrCreateChannel(coil).processBytes(buf, print, handleFrame);
}
