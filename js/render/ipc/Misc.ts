import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {openUI} from "../gui/ConnectionUI";
import {terminal} from "../gui/constants";
import {ud_settings} from "../gui/UDConfig";
import {processIPC} from "./IPCProvider";

export let config: TTConfig = new TTConfig();

export namespace MiscIPC {

    export function init() {
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.terminal, (s: string) => {
            terminal.io.print(s);
        });
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.ttConfig, (cfg: TTConfig) => {
            config = cfg;
        });
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.udConfig, (cfg: string[][]) => {
            ud_settings(cfg);
        });
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.openConnectionUI, async () => {
            let reply: any | null;
            try {
                reply = await openUI();
            } catch (e) {
                reply = null;
            }
            processIPC.send(IPC_CONSTANTS_TO_MAIN.connect, reply);
        });
        processIPC.send(IPC_CONSTANTS_TO_MAIN.rendererReady);
    }

    export function sendMidi(data: Uint8Array) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.midiMessage, data);
    }
}
