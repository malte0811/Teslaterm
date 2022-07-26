import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    ConnectionStatus,
    IPC_CONSTANTS_TO_RENDERER, ToastData,
    ToastSeverity,
    UD3ConfigOption
} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {config} from "../init";
import {playMidiData} from "../midi/midi";
import {ipcs, MultiWindowIPC} from "./IPCProvider";
import {TermSetupResult} from "./terminal";

export class MiscIPC {
    private readonly processIPC: MultiWindowIPC;
    private lastConnectionState: ConnectionStatus = ConnectionStatus.IDLE;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.requestFullSync, async (source: object) => {
            const terminalSuccessful = await ipcs.terminal.setupTerminal(source);
            if (terminalSuccessful === TermSetupResult.no_terminal_available) {
                ipcs.terminal.println("No free terminal slot available. Will assign one when available.", source);
            }
            ipcs.menu.sendFullState(source);
            this.processIPC.sendToWindow(
                IPC_CONSTANTS_TO_RENDERER.updateConnectionState, source, this.lastConnectionState
            );
            ipcs.scope.sendConfig(source);
            ipcs.meters.sendConfig(source);
            ipcs.sliders.sendSliderSync();
            this.syncTTConfig(config, source);
        });
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.midiMessage, (source: object, msg: Uint8Array) => {
            playMidiData(msg);
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

    public syncTTConfig(configToSync: TTConfig, target: object) {
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.ttConfig, target, configToSync);
    }

    public openToast(title: string, message: string, level: ToastSeverity, target?: object) {
        const msg: ToastData = {level, title, message};
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.openToast, target, msg);
    }

    public init() {
    }
}
