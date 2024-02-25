import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    getToRenderIPCPerCoil,
    IPC_CONSTANTS_TO_RENDERER,
    PerCoilRenderIPCs,
    UD3State
} from "../../common/IPCConstantsToRenderer";
import {disconnectFrom, getConnectionState} from "../connection/connection";
import {Idle} from "../connection/state/Idle";
import {requestConfig} from "../connection/telemetry/TelemetryFrame";
import {media_state} from "../media/media_player";
import {ipcs, MultiWindowIPC} from "./IPCProvider";

export class PerCoilMenuIPC {
    private lastUD3State: UD3State = UD3State.DEFAULT_STATE;
    private readonly processIPC: MultiWindowIPC;
    private readonly coil: CoilID;
    private readonly renderIPCs: PerCoilRenderIPCs;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        this.coil = coil;
        this.processIPC = processIPC;
        this.renderIPCs = getToRenderIPCPerCoil(this.coil);
        const mainIPCs = getToMainIPCPerCoil(coil);
        processIPC.on(mainIPCs.menu.requestUDConfig, async (source) => {
            requestConfig(this.coil, (cfg) => ipcs.coilMisc(coil).openUDConfig(cfg, source));
        });
        processIPC.on(mainIPCs.menu.disconnect, (source) => disconnectFrom(coil));
        processIPC.on(mainIPCs.menu.reconnect, (source) => {
            const coilState = getConnectionState(coil);
            if (coilState instanceof Idle) {
                coilState.connect(coil).catch((err) => console.error("While reconnecting", err));
            }
        });
    }

    public setUD3State(newState: UD3State) {
        if (!newState.equals(this.lastUD3State)) {
            this.lastUD3State = newState;
            this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.menu.ud3State, [this.coil, this.lastUD3State]);
        }
    }

    public sendFullState(target: object) {
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.menu.ud3State, target, [this.coil, this.lastUD3State]);
    }
}

export class CommonMenuIPC {
    private lastScriptName: string = "Script: none";
    private lastMediaName: string = "MIDI-File: none";
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
        processIPC.on(IPC_CONSTANTS_TO_MAIN.menu.startMedia, (source) => media_state.startPlaying(source));
        processIPC.on(IPC_CONSTANTS_TO_MAIN.menu.stopMedia, () => media_state.stopPlaying());
    }

    public setScriptName(scriptName: string) {
        this.lastScriptName = "Script: " + scriptName;
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.menu.setScriptName, this.lastScriptName);
    }

    public setMediaName(buttonText: string) {
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.menu.setMediaTitle, buttonText);
        this.lastMediaName = buttonText;
    }

    public sendFullState(target: object) {
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.menu.setScriptName, target, this.lastScriptName);
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.menu.setMediaTitle, target, this.lastMediaName);
    }
}
