import {Worker} from "worker_threads";
import {CoilID} from "../../../common/constants";
import {ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {ipcs} from "../../ipc/IPCProvider";
import * as microtime from "../../microtime";
import {makeFlightRecorderWorker, PassedEventData} from "./FlightRecordingWorker";

export enum FlightEventType {
    data_from_ud3,
    data_to_ud3,
    transmit_error,
    connection_state_change,
}

export interface FlightRecorderEvent {
    type: FlightEventType;
    data: Uint8Array;
    time_us: number;
}

export class FlightRecorder {
    private readonly worker: Worker;
    private readonly coil: CoilID;

    public constructor(coil: CoilID) {
        this.coil = coil;
        this.worker = makeFlightRecorderWorker(toast => {
            ipcs.coilMisc(coil).openToast('Flight Recorder', toast.text, toast.level || ToastSeverity.info, 'flight-record');
        });
    }

    public addEventString(type: FlightEventType, data: string) {
        this.addEvent(type, new TextEncoder().encode(data));
    }

    public addEvent(type: FlightEventType, data?: ArrayLike<number>) {
        data = data || new Uint8Array();
        const message: PassedEventData = {
            event: {type, data: new Uint8Array(data), time_us: microtime.now()},
            meterConfig: ipcs.meters(this.coil).getCurrentConfigs(),
            scopeConfig: ipcs.scope(this.coil).getCurrentConfigs(),
        };
        this.worker.postMessage(message);
    }

    public exportAsFile() {
        this.worker.postMessage(undefined);
    }
}

const flightRecorder = new Map<CoilID, FlightRecorder>();

export function getFlightRecorder(coil: CoilID) {
    if (!flightRecorder.has(coil)) {
        flightRecorder.set(coil, new FlightRecorder(coil));
    }
    return flightRecorder.get(coil);
}
