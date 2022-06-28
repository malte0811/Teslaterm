import {IPCConstantsToMain} from "../../common/IPCConstantsToMain";
import {IPCConstantsToRenderer} from "../../common/IPCConstantsToRenderer";
import {MultiWindowIPC} from "./IPCProvider";

export class ConnectionUIIPC {
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
    }


    public async openConnectionUI(key: object): Promise<any> {
        return new Promise<any>((res, rej) => {
            this.processIPC.once(IPCConstantsToMain.connect, (source: object, args: any) => {
                if (args !== null) {
                    res(args);
                } else {
                    rej("Cancelled");
                }
            });
            this.processIPC.sendToWindow(IPCConstantsToRenderer.openConnectionUI, key);
        });
    }
}
