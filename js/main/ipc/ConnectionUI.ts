import {ConnectionCandidates, IPCConstantsToRenderer} from "../../common/IPCConstantsToRenderer";
import {IPCConstantsToMain} from "../../common/IPCConstantsToMain";
import {processIPC} from "./IPCProvider";

export module ConnectionUIIPC {
    export async function openConnectionUI(key: object, candidates: ConnectionCandidates): Promise<Object> {
        return new Promise<any>((res, rej) => {
            processIPC.once(IPCConstantsToMain.connect, (source: object, args: Object) => {
                if (args !== null) {
                    res(args);
                } else {
                    rej("Cancelled");
                }
            });
            processIPC.sendToWindow(IPCConstantsToRenderer.openConnectionUI, key, candidates);
        });
    }
}
