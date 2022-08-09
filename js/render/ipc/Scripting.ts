import {ConfirmReply, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ConfirmationRequest, IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {processIPC} from "./IPCProvider";

export module ScriptingIPC {
    export function startScript() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.script.startScript, undefined);
    }

    export function stopScript() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.script.stopScript, undefined);
    }

    export function init() {
        /*
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.script.requestConfirm, async (msg: ConfirmationRequest) => {
            const accepted = await confirmPromise(msg.message, msg.title);
            processIPC.send(IPC_CONSTANTS_TO_MAIN.script.confirmOrDeny, new ConfirmReply(accepted, msg.confirmationID));
        });
         */
    }
}
