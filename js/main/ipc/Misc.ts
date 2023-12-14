import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    ConnectionStatus,
    IPC_CONSTANTS_TO_RENDERER, ToastData,
    ToastSeverity,
    UD3ConfigOption,
} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {config} from "../init";
import {playMidiData} from "../midi/midi";
import {getUIConfig, setUIConfig} from "../UIConfig";
import {ipcs, MultiWindowIPC} from "./IPCProvider";
import {TermSetupResult} from "./terminal";

export class ByCoilMiscIPC {
    private readonly processIPC: MultiWindowIPC;
    private lastConnectionState: ConnectionStatus = ConnectionStatus.IDLE;
    private coil: CoilID;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        this.coil = coil;
        this.processIPC = processIPC;
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.requestFullSync, async (source: object) => {
            const terminalSuccessful = await ipcs.terminal(coil).setupTerminal(source);
            if (terminalSuccessful === TermSetupResult.no_terminal_available) {
                ipcs.terminal(coil).println("No free terminal slot available. Will assign one when available.", source);
            }
            ipcs.coilMenu(coil).sendFullState(source);
            this.processIPC.sendToWindow(
                IPC_CONSTANTS_TO_RENDERER.updateConnectionState, source, this.lastConnectionState,
            );
            ipcs.scope(coil).sendConfig(source);
            ipcs.meters(coil).sendConfig(source);
            ipcs.sliders(coil).sendSliderSync();
        });
    }

    public setConnectionState(newState: ConnectionStatus) {
        this.lastConnectionState = newState;
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.updateConnectionState, newState);
        console.log("Setting to ", newState);
    }

    public openUDConfig(configToSync: UD3ConfigOption[], target: object) {
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.udConfig, target, configToSync);
    }

    public openToast(title: string, message: string, level: ToastSeverity, mergeKey?: string, target?: object) {
        const msg: ToastData = {level, title, message, mergeKey};
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.openToast, target, msg);
    }

    public sendUDName(name: string) {
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.udName, name);
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

    public init() {
    }
}
