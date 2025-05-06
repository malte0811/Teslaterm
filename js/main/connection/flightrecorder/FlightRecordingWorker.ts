import fs from "fs";
import JSZip from "jszip";
import {isMainThread, parentPort, Worker} from "worker_threads";
import {
    FlightEventType,
    FlightRecordingBuffer,
    FR_HEADER_BYTES,
    FRMeterConfigs,
    FRScopeConfigs,
} from "../../../common/FlightRecorderTypes";
import {ToastSeverity} from "../../../common/IPCConstantsToRenderer";

export interface PassedToast {
    text: string;
    level?: ToastSeverity;
}

export function makeFlightRecorderWorker(showToast: (toast: PassedToast) => any) {
    const worker = new Worker(__filename);
    worker.on('message', showToast);
    return worker;
}

export interface StoredFlightEvent {
    type: FlightEventType;
    data: string;
    time_us: number;
}

export interface FlightRecorderJSON {
    initialScopeConfig: FRScopeConfigs;
    initialMeterConfig: FRMeterConfigs;
    events: StoredFlightEvent[];
}

/**
 * The below code runs in a worker thread: If the export is done on the main thread, it will lock up communication with
 * the UD3 for a few seconds, which we would like to avoid.
 */

function extractEvents(buffer: FlightRecordingBuffer): StoredFlightEvent[] {
    const events: StoredFlightEvent[] = [];
    const bufferView = new DataView(buffer.buffer);
    let i = 0;
    while (i < buffer.writeIndex) {
        const type: FlightEventType = bufferView.getUint8(i);
        const time_us = bufferView.getUint32(i + 1);
        const length = bufferView.getUint32(i + 5);
        const dataView = new Uint8Array(buffer.buffer, i + FR_HEADER_BYTES, length);
        const data = Buffer.from(dataView).toString('base64');
        events.push({type, data, time_us});
        i += length + FR_HEADER_BYTES;
    }
    return events;
}

async function doExport(filename: string, oldBuffer: FlightRecordingBuffer, newBuffer: FlightRecordingBuffer) {
    const eventJSONArray = [...extractEvents(oldBuffer), ...extractEvents(newBuffer)];
    const jsonData: FlightRecorderJSON = {
        events: eventJSONArray,
        initialMeterConfig: oldBuffer.initialMeterConfig,
        initialScopeConfig: oldBuffer.initialScopeConfig,
    };
    const jsonString = JSON.stringify(jsonData, null, 2);
    const zip = JSZip();
    zip.file('data.json', jsonString);
    const data = await zip.generateAsync({
        compression: 'DEFLATE',
        type: 'uint8array',
    });
    await fs.promises.writeFile(filename, data);
}

function sendToastToMain(toast: PassedToast) {
    parentPort.postMessage(toast);
}

if (!isMainThread) {
    parentPort.on('message', ([oldBuffer, newBuffer]: [FlightRecordingBuffer, FlightRecordingBuffer]) => {
        const file = 'tt-flight-recording-' + Date.now().toString() + '.zip';
        sendToastToMain({text: 'Exporting flight recording to ' + file});
        doExport(file, oldBuffer, newBuffer)
            .then(() => {
                sendToastToMain({text: 'Exported flight recording to ' + file});
            })
            .catch((error) => {
                console.error('While writing flight recording', error);
                sendToastToMain({level: ToastSeverity.error, text: 'Failed to write flight recording!'});
            });
    });
}
