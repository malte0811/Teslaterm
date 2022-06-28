import {UD3State} from "../../common/IPCConstantsToRenderer";
import {commands, manualCommands} from "../ipc/commands";
import {MenuIPC} from "../ipc/Menu";
import {ScriptingIPC} from "../ipc/Scripting";
import * as sliders from "./sliders";
import * as ui_helper from "./ui_helper";

export const KILL_STATUS_OK = '<p class="kill_status_ok">OK</p>';
export const KILL_STATUS_ERR = '<p class="kill_status_err">ERR</p>';

export function init() {
    const port = $("#toolbar #tb_toolbar_item_port");
    port.on("keypress", (e) => {
        console.log(e);
        if (e.originalEvent.key === "Enter") {
            w2ui.toolbar.set("port", {value: this.value});
            w2ui.toolbar.refresh();
            w2ui.toolbar.click("connect");
        }
    });
}

export function onCtrlMenuClick(event) {
    switch (event.target) {
        case "connect":
            MenuIPC.connectButton();
            break;
        case "cls":
            manualCommands.clear();
            break;
        case "mnu_command:bus":
            if (ud3State.busActive) {
                commands.setBusState(false);
            } else {
                ui_helper.warn(
                    "WARNING!<br>The coil will be energized.", () => commands.setBusState(true),
                );
            }
            break;
        case "mnu_command:transient":
            commands.setTransientEnabled(!ud3State.transientActive);
            break;
        case "mnu_command:settings":
            MenuIPC.requestUDConfig();
            break;
        case "mnu_command:Save EEPROM-Config":
            ui_helper.warn("WARNING!<br>Are you sure to save the configuration to EEPROM?", commands.saveEEPROM);
            break;
        case "mnu_midi:Play":
            MenuIPC.startPlaying();
            break;
        case "mnu_midi:Stop":
            MenuIPC.stopPlaying();
            break;
        case "mnu_script:Start":
            ScriptingIPC.startScript();
            break;
        case "mnu_script:Stop":
            ScriptingIPC.stopScript();
            break;
        case "kill_set":
            commands.setKillState(true);
            break;
        case "kill_reset":
            commands.setKillState(false);
            break;
    }
}

let ud3State: UD3State = UD3State.DEFAULT_STATE;

export function updateUD3State(newState: UD3State) {
    if (newState.transientActive !== ud3State.transientActive) {
        ui_helper.changeMenuEntry("mnu_command", "transient", "TR " + (newState.transientActive ? "Stop" : "Start"));
    }

    if (newState.busControllable && !ud3State.busControllable) {
        ui_helper.addFirstMenuEntry("mnu_command", "bus", "Bus " + (newState.busActive ? "OFF" : "ON"), "fa fa-bolt");
    } else if (!newState.busControllable && ud3State.busControllable) {
        ui_helper.removeMenuEntry("mnu_command", "bus");
    } else if (newState.busActive !== ud3State.busActive) {
        ui_helper.changeMenuEntry("mnu_command", "bus", "Bus " + (newState.busActive ? "OFF" : "ON"));
    }
    if (ud3State.killBitSet !== newState.killBitSet) {
        const kill_item = w2ui.toolbar.get("kill_status", false);
        kill_item.html = newState.killBitSet ? KILL_STATUS_ERR : KILL_STATUS_OK;
        w2ui.toolbar.refresh("kill_status");
    }

    sliders.updateSliderAvailability(newState);
    ud3State = newState;
}

export function updateConnectionButton(buttonText: string) {
    const button = w2ui.toolbar.get("connect");
    button.text = buttonText;
    w2ui.toolbar.refresh();
}
