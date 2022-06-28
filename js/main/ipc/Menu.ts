import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, UD3State} from "../../common/IPCConstantsToRenderer";
import {commands, pressButton} from "../connection/connection";
import {configRequestQueue} from "../connection/telemetry/TelemetryFrame";
import {media_state} from "../media/media_player";
import {MultiWindowIPC} from "./IPCProvider";

export class MenuIPC {
    private lastUD3State: UD3State = UD3State.DEFAULT_STATE;
    private lastConnectText: string = "Connect";
    private lastScriptName: string = "Script: none";
    private lastMediaName: string = "MIDI-File: none";
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        processIPC.on(IPC_CONSTANTS_TO_MAIN.menu.startMedia, () => media_state.startPlaying());
        processIPC.on(IPC_CONSTANTS_TO_MAIN.menu.stopMedia, () => media_state.stopPlaying());
        processIPC.on(IPC_CONSTANTS_TO_MAIN.menu.connectButton, pressButton);
        processIPC.on(IPC_CONSTANTS_TO_MAIN.menu.requestUDConfig, async (source) => {
            configRequestQueue.push(source);
            try {
                await commands.sendCommand("config_get\r");
            } catch (err) {
                console.error("While getting config:", err);
            }
        });
        this.processIPC = processIPC;
    }


    public setUD3State(busActive: boolean, busControllable: boolean, transientActive: boolean, killBitSet: boolean) {
        const newState = new UD3State(busActive, busControllable, transientActive, killBitSet);
        if (!newState.equals(this.lastUD3State)) {
            this.lastUD3State = newState;
            this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.menu.ud3State, this.lastUD3State);
        }
    }

    public setConnectionButtonText(newText: string) {
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.menu.connectionButtonText, newText);
        this.lastConnectText = newText;
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
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.menu.ud3State, target, this.lastUD3State);
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.menu.connectionButtonText, target, this.lastConnectText);
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.menu.setScriptName, target, this.lastScriptName);
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.menu.setMediaTitle, target, this.lastMediaName);
    }
}
