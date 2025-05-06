import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {
    parseEventsForDisplay,
    parseEventsFromFile,
    parseMINEvents,
} from "../connection/flightrecorder/FlightRecordingParser";
import {MainIPC} from "./IPCProvider";

export class FlightRecorderIPC {
    private readonly processIPC: MainIPC;

    public constructor(processIPC: MainIPC) {
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.loadFlightRecording,
            (data) => this.loadRecording(data),
        );
        this.processIPC = processIPC;
    }

    private async loadRecording(data: number[]) {
        const [flightEvents, initialState] = await parseEventsFromFile(Buffer.from(data));
        const minEvents = parseMINEvents(flightEvents);
        const displayEvents = parseEventsForDisplay(minEvents, false);
        this.processIPC.send(
            IPC_CONSTANTS_TO_RENDERER.flightRecorder.fullList, {events: displayEvents, initial: initialState},
        );
    }
}
