import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, UD3State} from "../../common/IPCConstantsToRenderer";
import {processIPC} from "./IPCProvider";

export let ud3State: UD3State;

export namespace MenuIPC {
    export function requestUDConfig(): void {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.menu.requestUDConfig);
    }

    export function startPlaying(): void {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.menu.startMedia);
    }

    export function stopPlaying(): void {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.menu.stopMedia);
    }

    export function connectButton() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.menu.connectButton);
    }

    export function init() {
        /*processIPC.on(IPC_CONSTANTS_TO_RENDERER.menu.ud3State, (state: UD3State) => {
            updateUD3State(state);
            ud3State = state;
        });
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.menu.connectionButtonText, (txt: string) => {
            updateConnectionButton(txt);
        });
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.menu.setMediaTitle, (newTitle: string) => {
            w2ui.toolbar.get('mnu_midi').text = newTitle;
            w2ui.toolbar.refresh();
        });
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.menu.setScriptName, (newName: string) => {
            w2ui.toolbar.get('mnu_script').text = newName;
            w2ui.toolbar.refresh();
        });*/
    }
}
