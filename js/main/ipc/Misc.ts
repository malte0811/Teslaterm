import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {config} from "../init";
import {playMidiData} from "../midi/midi";
import {ipcs, MultiWindowIPC} from "./IPCProvider";
import {TermSetupResult} from "./terminal";

export class MiscIPC {
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.rendererReady, async (source: object) => {
            const terminalSuccessful = await ipcs.terminal.setupTerminal(source);
            if (terminalSuccessful === TermSetupResult.no_terminal_available) {
                ipcs.terminal.println("No free terminal slot available. Will assign one when available.", source);
            }
            ipcs.menu.sendFullState(source);
            ipcs.scope.sendConfig(source);
            ipcs.meters.sendConfig(source);
            this.syncTTConfig(config, source);
        });
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.midiMessage, (source: object, msg: Uint8Array) => {
            playMidiData(msg);
        });
    }

    public openUDConfig(configToSync: string[][], target: object) {
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.udConfig, target, configToSync);
    }

    public syncTTConfig(configToSync: TTConfig, target: object) {
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.ttConfig, target, configToSync);
    }

    public init() {
    }
}
