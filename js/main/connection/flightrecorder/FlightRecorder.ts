import {Worker} from "worker_threads";
import {CoilID} from "../../../common/constants";
import {FlightEventType, FlightRecordingBuffer, FR_HEADER_BYTES} from "../../../common/FlightRecorderTypes";
import {ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {ipcs} from "../../ipc/IPCProvider";
import * as microtime from "../../microtime";
import {makeFlightRecorderWorker} from "./FlightRecordingWorker";

export interface FlightRecorderEvent {
    type: FlightEventType;
    data: Uint8Array;
    time_us: number;
}

const MAX_STORED_BYTES = 5e6;

function makeFlightRecordingBuffer(coil: CoilID): FlightRecordingBuffer {
    return {
        buffer: new SharedArrayBuffer(MAX_STORED_BYTES),
        initialMeterConfig: ipcs.meters(coil).getCurrentConfigs(),
        initialScopeConfig: ipcs.scope(coil).getCurrentConfigs(),
        writeIndex: 0,
    };
}

function addEventTo(buffer: FlightRecordingBuffer, type: FlightEventType, data: ArrayLike<number>): boolean {
    const totalBytes = FR_HEADER_BYTES + data.length;
    const newWriterIndex = buffer.writeIndex + totalBytes;
    if (newWriterIndex > buffer.buffer.byteLength) {
        return false;
    }
    const bufferView = new DataView(buffer.buffer, buffer.writeIndex, totalBytes);
    bufferView.setUint8(0, type);
    bufferView.setUint32(1, microtime.now());
    bufferView.setUint32(5, data.length);
    for (let i = 0; i < data.length; ++i) {
        bufferView.setUint8(FR_HEADER_BYTES + i, data[i]);
    }
    buffer.writeIndex = newWriterIndex;
    return true;
}

export class FlightRecorder {
    private readonly worker: Worker;
    private readonly coil: CoilID;
    private activeBuffer: FlightRecordingBuffer;
    private oldBuffer: FlightRecordingBuffer;

    public constructor(coil: CoilID) {
        this.coil = coil;
        this.worker = makeFlightRecorderWorker(toast => {
            ipcs.coilMisc(coil).openToast('Flight Recorder', toast.text, toast.level || ToastSeverity.info, 'flight-record');
        });
        this.activeBuffer = makeFlightRecordingBuffer(coil);
        this.oldBuffer = makeFlightRecordingBuffer(coil);
    }

    public addEventString(type: FlightEventType, data: string) {
        this.addEvent(type, new TextEncoder().encode(data));
    }

    public addEvent(type: FlightEventType, data?: ArrayLike<number>) {
        if (!addEventTo(this.activeBuffer, type, data || [])) {
            this.oldBuffer = this.activeBuffer;
            this.activeBuffer = makeFlightRecordingBuffer(this.coil);
            addEventTo(this.activeBuffer, type, data || []) ;
        }
    }

    public exportAsFile() {
        this.worker.postMessage([this.oldBuffer, this.activeBuffer]);
    }
}

const flightRecorder = new Map<CoilID, FlightRecorder>();

export function getFlightRecorder(coil: CoilID) {
    if (!flightRecorder.has(coil)) {
        flightRecorder.set(coil, new FlightRecorder(coil));
    }
    return flightRecorder.get(coil);
}
