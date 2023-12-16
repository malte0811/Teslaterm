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
import {PerCoilMenuIPC} from "./Menu";
import {TermSetupResult} from "./terminal";

export class ByCoilMiscIPC {
    private readonly processIPC: MultiWindowIPC;
    private lastConnectionState: ConnectionStatus = ConnectionStatus.IDLE;
    private readonly coil: CoilID;
    private renderIPCs: PerCoilRenderIPCs;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        this.coil = coil;
        this.processIPC = processIPC;
        this.renderIPCs = getToRenderIPCPerCoil(this.coil);
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.requestFullSync, async (source: object) => {
            const terminalSuccessful = await ipcs.terminal(coil).setupTerminal(source);
            if (terminalSuccessful === TermSetupResult.no_terminal_available) {
                ipcs.terminal(coil).println("No free terminal slot available. Will assign one when available.", source);
            }
            ipcs.coilMenu(coil).sendFullState(source);
            this.processIPC.sendToWindow(
                this.renderIPCs.updateConnectionState, source, this.lastConnectionState,
            );
            ipcs.scope(coil).sendConfig(source);
            ipcs.meters(coil).sendConfig(source);
            ipcs.sliders(coil).sendSliderSync();
        });
        processIPC.on(
            getToMainIPCPerCoil(coil).dumpFlightRecorder,
            async ($, coil) => getFlightRecorder(coil).exportAsFile(),
        );
    }

    public setConnectionState(newState: ConnectionStatus) {
        this.lastConnectionState = newState;
        this.processIPC.sendToAll(this.renderIPCs.updateConnectionState, newState);
        console.log("Setting to ", newState);
    }

    public openUDConfig(configToSync: UD3ConfigOption[], target: object) {
        this.processIPC.sendToWindow(this.renderIPCs.udConfig, target, configToSync);
    }

    public openToast(title: string, message: string, level: ToastSeverity, mergeKey?: string, target?: object) {
        const msg: ToastData = {level, title, message, mergeKey};
        this.processIPC.sendToWindow(this.renderIPCs.openToast, target, msg);
    }

    public sendUDName(name: string) {
        this.processIPC.sendToAll(this.renderIPCs.udName, name);
    }

    public init() {
    }
}
export class CommonMiscIPC {
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.requestFullSync, async (source: object) => {
            ipcs.menu.sendFullState(source);
            this.syncTTConfig(config, source);
            this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.syncDarkMode, source, getUIConfig().darkMode);
        });
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.midiMessage, (source: object, msg) => {
            playMidiData(msg);
        });
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.setDarkMode, (source, darkMode) => {
            setUIConfig({darkMode});
            this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.syncDarkMode, darkMode);
        });
    }

    public syncTTConfig(configToSync: TTConfig, target: object) {
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.ttConfig, target, configToSync);
    }

    public openGenericToast(title: string, message: any, severity: ToastSeverity, mergeKey?: string, owner?: any) {
        this.processIPC.sendToWindow(
            IPC_CONSTANTS_TO_RENDERER.openToast, owner, {title, message, level: severity, mergeKey},
        );
    }

    public updateMediaInfo() {
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.scope.redrawMedia,
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
