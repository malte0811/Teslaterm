import {CoilID} from "../../common/constants";
import {TelemetryFrame} from "../../common/TelemetryTypes";
import {ipcs} from "../ipc/IPCProvider";
import {resetResponseTimeout} from "./state/Connected";
import {TelemetryChannel} from "./telemetry/TelemetryChannel";
import {sendTelemetryFrame} from "./telemetry/TelemetryFrame";

const channels: Map<CoilID, Map<object, TelemetryChannel>> = new Map();

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
    resetResponseTimeout(coil);

    const print = (s: string) => {
        if (!onAutoTerminal) {
            ipcs.terminal(coil).print(s);
        }
    };
    const handleFrame = (frame: TelemetryFrame) => sendTelemetryFrame(frame, coil, initializing);

    const buf = new Uint8Array(data);
    getOrCreateChannel(coil).processBytes(buf, print, handleFrame);
}
