import {IPCConstantsToMain} from "../../common/IPCConstantsToMain";
import {IPCConstantsToRenderer, UD3State} from "../../common/IPCConstantsToRenderer";
import {updateConnectionButton, updateUD3State} from "../gui/menu";
import {processIPC} from "./IPCProvider";

export let ud3State: UD3State;

export namespace MenuIPC {
    export function requestUDConfig(): void {
        processIPC.send(IPCConstantsToMain.menu.requestUDConfig);
    }

    export function startPlaying(): void {
        processIPC.send(IPCConstantsToMain.menu.startMedia);
    }

    export function stopPlaying(): void {
        processIPC.send(IPCConstantsToMain.menu.stopMedia);
    }

    export function connectButton() {
        processIPC.send(IPCConstantsToMain.menu.connectButton);
    }

    export function init() {
        processIPC.on(IPCConstantsToRenderer.menu.ud3State, (state: UD3State) => {
            updateUD3State(state);
            ud3State = state;
        });
        processIPC.on(IPCConstantsToRenderer.menu.connectionButtonText, (txt: string) => {
            updateConnectionButton(txt);
        });
        processIPC.on(IPCConstantsToRenderer.menu.setMediaTitle, (newTitle: string) => {
            w2ui.toolbar.get('mnu_midi').text = newTitle;
            w2ui.toolbar.refresh();
        });
        processIPC.on(IPCConstantsToRenderer.menu.setScriptName, (newName: string) => {
            w2ui.toolbar.get('mnu_script').text = newName;
            w2ui.toolbar.refresh();
        });
    }
}
