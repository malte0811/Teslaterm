import {CoilID} from "../../common/constants";
import {TelemetryFrame} from "../../common/TelemetryTypes";
import {ipcs} from "../ipc/IPCProvider";
import {resetResponseTimeout} from "./state/Connected";
import {TelemetryChannel} from "./telemetry/TelemetryChannel";
import {sendTelemetryFrame} from "./telemetry/TelemetryFrame";

const channels: Map<CoilID, Map<boolean, TelemetryChannel>> = new Map();

function getOrCreateChannel(coil: CoilID, onAuto: boolean) {
    if (!channels.has(coil)) {
        channels.set(coil, new Map());
    }
    const innerMap = channels.get(coil);
    if (!innerMap.has(onAuto)) {
        innerMap.set(onAuto, new TelemetryChannel());
    }
    return innerMap.get(onAuto);
}

export function receive_main(coil: CoilID, data: Buffer, initializing: boolean, onAutoTerminal: boolean) {
    resetResponseTimeout(coil);

    const print = (s: string) => {
        if (!onAutoTerminal) {
            ipcs.terminal(coil).print(s);
        }
    };
    const handleFrame = (frame: TelemetryFrame) => {
        if (onAutoTerminal) {
            sendTelemetryFrame(frame, coil, initializing);
        }
    };

    const buf = new Uint8Array(data);
    getOrCreateChannel(coil, onAutoTerminal).processBytes(buf, print, handleFrame);
}
