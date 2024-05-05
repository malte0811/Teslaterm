import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    ConnectionStatus, getToRenderIPCPerCoil,
    IPC_CONSTANTS_TO_RENDERER, PerCoilRenderIPCs, ToastData,
    ToastSeverity,
    UD3ConfigOption,
} from "../../common/IPCConstantsToRenderer";
import {forEachCoil} from "../connection/connection";
import {getFlightRecorder} from "../connection/flightrecorder/FlightRecorder";
import {config} from "../init";
import {media_state} from "../media/media_player";
import {playMidiData} from "../midi/midi";
import {getUIConfig, setUIConfig} from "../UIConfigHandler";
import {ipcs, MainIPC} from "./IPCProvider";
import {TemporaryIPC} from "./TemporaryIPC";

export function sendCoilSync(coil: CoilID) {
    ipcs.coilMenu(coil).sendFullState();
    ipcs.coilMisc(coil).sendSync();
    ipcs.scope(coil).sendConfig();
    ipcs.meters(coil).sendConfig();
    ipcs.sliders(coil).sendSliderSync();
}

export class ByCoilMiscIPC {
    private readonly processIPC: TemporaryIPC;
    private readonly coil: CoilID;
    private lastConnectionState: ConnectionStatus = ConnectionStatus.IDLE;
    private renderIPCs: PerCoilRenderIPCs;
    private udName: string;

    constructor(processIPC: TemporaryIPC, coil: CoilID) {
        this.coil = coil;
        this.processIPC = processIPC;
        this.renderIPCs = getToRenderIPCPerCoil(this.coil);
        processIPC.on(
            getToMainIPCPerCoil(coil).dumpFlightRecorder,
            (coil) => getFlightRecorder(coil).exportAsFile(),
        );
    }

    public setConnectionState(newState: ConnectionStatus) {
        this.lastConnectionState = newState;
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.updateConnectionState, [this.coil, newState]);
    }

    public openUDConfig(configToSync: UD3ConfigOption[]) {
        this.processIPC.send(this.renderIPCs.udConfig, configToSync);
    }

    public openToast(title: string, message: string, level: ToastSeverity, mergeKey?: string) {
        const msg: ToastData = {level, title, message, mergeKey};
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.openToastOn, [msg, this.coil]);
    }

    public sendUDName(name: string) {
        this.udName = name;
        this.sendSync();
    }

    public sendSync() {
        if (this.udName) {
            this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.udName, [this.coil, this.udName]);
        }
        this.processIPC.send(
            IPC_CONSTANTS_TO_RENDERER.updateConnectionState, [this.coil, this.lastConnectionState],
        );
    }

    public init() {
    }
}
export class CommonMiscIPC {
    private readonly processIPC: MainIPC;

    constructor(processIPC: MainIPC) {
        this.processIPC = processIPC;
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.requestFullSync, async () => {
            ipcs.menu.sendFullState();
            this.syncUIConfig();
            this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.ttConfig, config);
        });
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.midiMessage, (msg) => {
            playMidiData(msg);
        });
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.setDarkMode, (darkMode) => {
            setUIConfig({darkMode});
        });
        this.processIPC.on(
            IPC_CONSTANTS_TO_MAIN.centralTab.setCentralTelemetry,
            (newTelemetryNames) => setUIConfig({centralTelemetry: newTelemetryNames}),
        );
        this.processIPC.on(
            IPC_CONSTANTS_TO_MAIN.centralTab.requestCentralTelemetrySync,
            () => forEachCoil((coil) => ipcs.meters(coil).sendCentralTelemetry()),
        );
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.requestFullSync, () => {
            forEachCoil(sendCoilSync);
            ipcs.mixer.sendFullState();
        });
    }

    public openGenericToast(title: string, message: any, severity: ToastSeverity, mergeKey?: string) {
        this.processIPC.send(
            IPC_CONSTANTS_TO_RENDERER.openToastOn, [{title, message, level: severity, mergeKey}, undefined],
        );
    }

    public syncUIConfig() {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.uiConfig, getUIConfig());
    }

    public updateMediaInfo() {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.scope.redrawMedia,
            {
                progress: media_state.progress,
                state: media_state.state,
                title: media_state.title,
                type: media_state.type,
            });
    }

    public init() {
    }
}
