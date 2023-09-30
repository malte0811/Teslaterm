import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {getFlightRecorder} from "../connection/flightrecorder/FlightRecorder";
import {
    parseEventsForDisplay,
    parseEventsFromFile,
    parseMINEvents,
} from "../connection/flightrecorder/FlightRecordingParser";
import {MultiWindowIPC} from "./IPCProvider";

export class FlightRecorderIPC {
    private readonly processIPC: MultiWindowIPC;

    public constructor(processIPC: MultiWindowIPC) {
        processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.flightRecorder.loadFlightRecording,
            (source, data) => this.loadRecording(source, data),
        );
        processIPC.on(
            IPC_CONSTANTS_TO_MAIN.flightRecorder.dumpFlightRecorder,
            async () => getFlightRecorder().exportAsFile(),
        );
        this.processIPC = processIPC;
    }

    private async loadRecording(source: object, data: number[]) {
        const [flightEvents, initialState] = await parseEventsFromFile(Buffer.from(data));
        const minEvents = parseMINEvents(flightEvents);
        const displayEvents = parseEventsForDisplay(minEvents, false);
        this.processIPC.sendToWindow(
            IPC_CONSTANTS_TO_RENDERER.flightRecorder.fullList, source, {events: displayEvents, initial: initialState},
        );
    }
}
