import * as fs from "fs";
import JSZip from "jszip";
import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {ipcs} from "../ipc/IPCProvider";
import {now} from "../microtime";
import * as microtime from "../microtime";

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
    private static readonly max_stored_bytes = 2.5e6;

    /**
     * oldEvents and activeEvents are used to implement a very rough queue-like structure: JS by itself does not have
     * any reasonably fast queue data structures (abusing arrays as queues has linear runtime for each op). As an
     * alternative, we grow the "active" event array until it reaches the size limit. When it does, it replaces the
     * "old events" array and is itself replaced by an empty array.
     */
    private oldEvents: FlightRecorderEvent[] = [];
    private activeEvents: FlightRecorderEvent[] = [];
    private currentPayloadBytes: number = 0;

    public constructor(jsonData?: string) {
        if (jsonData) {
            const rawJSON: any[] = JSON.parse(jsonData);
            for (const element of rawJSON) {
                this.activeEvents.push({
                    data: new Uint8Array(element.data),
                    time_us: element.time_us,
                    type: element.type,
                });
            }
        }
    }

    public addEventString(type: FlightEventType, data: string) {
        this.addEvent(type, new TextEncoder().encode(data));
    }

    public addEvent(type: FlightEventType, data?: ArrayLike<number>) {
        data = data || new Uint8Array();
        this.activeEvents.push({type, data: new Uint8Array(data), time_us: microtime.now()});
        this.currentPayloadBytes += data.length;
        if (this.currentPayloadBytes > FlightRecorder.max_stored_bytes) {
            this.currentPayloadBytes = 0;
            this.oldEvents = this.activeEvents;
            this.activeEvents = [];
        }
    }

    public toPlainObject(): object[] {
        const eventToJSON = (ev) => ({...ev, data: Array.from(ev.data)});
        return [...this.oldEvents.map(eventToJSON), ...this.activeEvents.map(eventToJSON)];
    }

    public toJSONString() {
        return JSON.stringify(this.toPlainObject(), null, 2);
    }

    public async exportAsFile(ipcSource: any) {
        const targetFile = 'tt-flight-recording-' + now().toString() + '.zip';
        const openToast = (msg: string, level?: ToastSeverity) => {
            ipcs.misc.openToast(
                'Flight Recorder', msg, level || ToastSeverity.info, 'flight-record', ipcSource,
            );
        };
        openToast('Exporting flight recording to ' + targetFile);

        const json = getFlightRecorder().toJSONString();
        const zip = JSZip();
        zip.file('data.json', json);
        const zipData = await zip.generateAsync({
            compression: 'DEFLATE',
            type: 'uint8array',
        });

        try {
            await fs.promises.writeFile(targetFile, zipData);
            openToast('Exported flight recording to ' + targetFile);
        } catch (e) {
            console.error('While writing flight recording', e);
            openToast('Failed to write flight recording!', ToastSeverity.error);
        }
    }
}

const GLOBAL_FLIGHT_RECORDER = new FlightRecorder();

export function getFlightRecorder() {
    return GLOBAL_FLIGHT_RECORDER;
}
