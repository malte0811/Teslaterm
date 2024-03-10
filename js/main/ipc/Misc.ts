import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    ConnectionStatus, getToRenderIPCPerCoil,
    IPC_CONSTANTS_TO_RENDERER, PerCoilRenderIPCs, ToastData,
    ToastSeverity,
    UD3ConfigOption,
} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {getFlightRecorder} from "../connection/flightrecorder/FlightRecorder";
import {config} from "../init";
import {media_state} from "../media/media_player";
import {playMidiData} from "../midi/midi";
import {getUIConfig, setUIConfig} from "../UIConfig";
import {ipcs, MultiWindowIPC} from "./IPCProvider";

export class ByCoilMiscIPC {
    private readonly processIPC: MultiWindowIPC;
    private readonly coil: CoilID;
    private lastConnectionState: ConnectionStatus = ConnectionStatus.IDLE;
    private renderIPCs: PerCoilRenderIPCs;
    private udName: string;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        this.coil = coil;
        this.processIPC = processIPC;
        this.renderIPCs = getToRenderIPCPerCoil(this.coil);
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.requestFullSync, async () => {
            // TODO the whole concept of assigning terminals can go away, right?
            ipcs.coilMenu(coil).sendFullState();
            this.processIPC.send(
                IPC_CONSTANTS_TO_RENDERER.updateConnectionState, [coil, this.lastConnectionState],
            );
            ipcs.scope(coil).sendConfig();
            ipcs.meters(coil).sendConfig();
            ipcs.sliders(coil).sendSliderSync();
            if (this.udName) {
                this.sendUDName(this.udName);
            }
        });
        processIPC.on(
            getToMainIPCPerCoil(coil).dumpFlightRecorder,
            async (coil) => getFlightRecorder(coil).exportAsFile(),
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
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.udName, [this.coil, name]);
        this.udName = name;
    }

    public init() {
    }
}
export class CommonMiscIPC {
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.requestFullSync, async () => {
            ipcs.menu.sendFullState();
            this.syncTTConfig(config);
            this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.syncDarkMode, getUIConfig().darkMode);
        });
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.midiMessage, (msg) => {
            playMidiData(msg);
        });
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.setDarkMode, (darkMode) => {
            setUIConfig({darkMode});
            this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.syncDarkMode, darkMode);
        });
    }

    public syncTTConfig(configToSync: TTConfig) {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.ttConfig, configToSync);
    }

    public openGenericToast(title: string, message: any, severity: ToastSeverity, mergeKey?: string) {
        this.processIPC.send(
            IPC_CONSTANTS_TO_RENDERER.openToastOn, [{title, message, level: severity, mergeKey}, undefined],
        );
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
