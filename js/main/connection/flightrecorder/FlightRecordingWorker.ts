import fs from "fs";
import JSZip from "jszip";
import {isMainThread, parentPort, Worker} from "worker_threads";
import {ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {FlightRecorderEvent} from "./FlightRecorder";

export interface PassedToast {
    text: string;
    level?: ToastSeverity;
}

export function makeFlightRecorderWorker(showToast: (toast: PassedToast) => any) {
    const worker = new Worker(__filename);
    worker.on('message', showToast);
    return worker;
}

/**
 * The below code runs in a worker thread: If the export is done on the main thread, it will lock up communication with
 * the UD3 for a few seconds, which we would like to avoid.
 */

const max_stored_bytes = 2.5e6;

/**
 * oldEvents and activeEvents are used to implement a very rough queue-like structure: JS by itself does not have
 * any reasonably fast queue data structures (abusing arrays as queues has linear runtime for each op). As an
 * alternative, we grow the "active" event array until it reaches the size limit. When it does, it replaces the
 * "old events" array and is itself replaced by an empty array.
 */
let oldEvents: FlightRecorderEvent[] = [];
let activeEvents: FlightRecorderEvent[] = [];
let currentPayloadBytes: number = 0;

async function doExport(filename: string) {
    const eventToJSON = (ev) => ({...ev, data: Array.from(ev.data)});
    const jsonArray = [...oldEvents.map(eventToJSON), ...activeEvents.map(eventToJSON)];
    const jsonString = JSON.stringify(jsonArray, null, 2);
    const zip = JSZip();
    zip.file('data.json', jsonString);
    const data = await zip.generateAsync({
        compression: 'DEFLATE',
        type: 'uint8array',
    });
    await fs.promises.writeFile(filename, data);
}

function addEvent(ev: FlightRecorderEvent) {
    activeEvents.push(ev);
    currentPayloadBytes += ev.data.length;
    if (currentPayloadBytes > max_stored_bytes) {
        currentPayloadBytes = 0;
        oldEvents = activeEvents;
        activeEvents = [];
    }
}

function sendToastToMain(toast: PassedToast) {
    parentPort.postMessage(toast);
}

if (!isMainThread) {
    parentPort.on('message', (ev?: FlightRecorderEvent) => {
        if (ev) {
            addEvent(ev);
        } else {
            const file = 'tt-flight-recording-' + Date.now().toString() + '.zip';
            sendToastToMain({text: 'Exporting flight recording to ' + file});
            doExport(file)
                .then(() => {
                    sendToastToMain({text: 'Exported flight recording to ' + file});
                })
                .catch((error) => {
                    console.error('While writing flight recording', error);
                    sendToastToMain({level: ToastSeverity.error, text: 'Failed to write flight recording!'});
                });
        }
    });
}
