import fs from "fs";
import JSZip from "jszip";
import {isMainThread, parentPort, Worker} from "worker_threads";
import {MeterConfig, ScopeTraceConfig, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {FlightEventType, FlightRecorderEvent} from "./FlightRecorder";

export interface PassedToast {
    text: string;
    level?: ToastSeverity;
}

export interface FRScopeConfigs {
    [i: number]: ScopeTraceConfig;
}

export interface FRMeterConfigs {
    [i: number]: MeterConfig;
}

export interface PassedEventData {
    event: FlightRecorderEvent;
    scopeConfig: FRScopeConfigs;
    meterConfig: FRMeterConfigs;
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

interface EventBuffer {
    events: FlightRecorderEvent[];
    initialScopeConfig: FRScopeConfigs;
    initialMeterConfig: FRMeterConfigs;
}

/**
 * oldEvents and activeEvents are used to implement a very rough queue-like structure: JS by itself does not have
 * any reasonably fast queue data structures (abusing arrays as queues has linear runtime for each op). As an
 * alternative, we grow the "active" event array until it reaches the size limit. When it does, it replaces the
 * "old events" array and is itself replaced by an empty array.
 */
let oldEvents: EventBuffer;
let activeEvents: EventBuffer;
let currentPayloadBytes: number = 0;

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

async function doExport(filename: string) {
    if (!activeEvents) {
        return;
    }
    const eventToJSON = (ev: FlightRecorderEvent) => ({
        ...ev,
        data: Buffer.from(ev.data).toString('base64'),
    });
    const eventJSONArray = [];
    if (oldEvents) {
        eventJSONArray.push(...oldEvents.events.map(eventToJSON));
    }
    eventJSONArray.push(...activeEvents.events.map(eventToJSON));
    const firstData = oldEvents || activeEvents;
    const jsonData: FlightRecorderJSON = {
        events: eventJSONArray,
        initialMeterConfig: firstData.initialMeterConfig,
        initialScopeConfig: firstData.initialScopeConfig,
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

function newEventBuffer(ev: PassedEventData): EventBuffer {
    return {
        events: [],
        initialMeterConfig: ev.meterConfig,
        initialScopeConfig: ev.scopeConfig,
    };
}

function addEvent(ev: PassedEventData) {
    if (!activeEvents) {
        activeEvents = newEventBuffer(ev);
    }
    activeEvents.events.push(ev.event);
    currentPayloadBytes += ev.event.data.length;
    if (currentPayloadBytes > max_stored_bytes) {
        currentPayloadBytes = 0;
        oldEvents = activeEvents;
        activeEvents = newEventBuffer(ev);
    }
}

function sendToastToMain(toast: PassedToast) {
    parentPort.postMessage(toast);
}

if (!isMainThread) {
    parentPort.on('message', (ev?: PassedEventData) => {
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
