import {IPCConstantsToMain} from "../../common/IPCConstantsToMain";
import {IPCConstantsToRenderer} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {openUI} from "../gui/ConnectionUI";
import {terminal} from "../gui/constants";
import {ud_settings} from "../gui/UDConfig";
import {processIPC} from "./IPCProvider";

export let config: TTConfig = new TTConfig();

export namespace MiscIPC {

    export function init() {
        processIPC.on(IPCConstantsToRenderer.terminal, (s: string) => {
            terminal.io.print(s);
        });
        processIPC.on(IPCConstantsToRenderer.ttConfig, (cfg: TTConfig) => {
            config = cfg;
        });
        processIPC.on(IPCConstantsToRenderer.udConfig, (cfg: string[][]) => {
            ud_settings(cfg);
        });
        processIPC.on(IPCConstantsToRenderer.openConnectionUI, async () => {
            let reply: any | null;
            try {
                reply = await openUI();
            } catch (e) {
                reply = null;
            }
            processIPC.send(IPCConstantsToMain.connect, reply);
        });
        processIPC.send(IPCConstantsToMain.rendererReady);
    }

    export function sendMidi(data: Uint8Array) {
        processIPC.send(IPCConstantsToMain.midiMessage, data);
    }
}
