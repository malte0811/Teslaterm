import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {processIPC} from "./IPCProvider";

export namespace SlidersIPC {
    export function init() {
        //processIPC.on(IPC_CONSTANTS_TO_RENDERER.sliders.syncSettings, updateSliderState);
    }

    export function setRelativeOntime(val: number) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.sliders.setOntimeRelative, val);
    }

    export function setAbsoluteOntime(val: number) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.sliders.setOntimeAbsolute, val);
    }

    export function setBPS(val: number) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.sliders.setBPS, val);
    }

    export function setBurstOntime(val: number) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOntime, val);
    }

    export function setBurstOfftime(val: number) {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOfftime, val);
    }
}
