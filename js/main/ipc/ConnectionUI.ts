import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, IUDPConnectionSuggestion} from "../../common/IPCConstantsToRenderer";
import {MultiWindowIPC} from "./IPCProvider";

export class ConnectionUIIPC {
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
    }

    public async openConnectionUI(key: object): Promise<any> {
        return new Promise<any>((res, rej) => {
            this.processIPC.once(IPC_CONSTANTS_TO_MAIN.connect, (source: object, args: any) => {
                if (args !== null) {
                    res(args);
                } else {
                    rej("Cancelled");
                }
            });
            this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.connect.openUI, key);
        });
    }

    public async suggestUDP(key: object, ip: string, desc?: string) {
        const data: IUDPConnectionSuggestion = {remoteIP: ip, desc};
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.connect.addUDPSuggestion, key, data);
    }

    public suggestSerial(key: object, ports: string[]) {
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.connect.setSerialSuggestions, key, ports);
    }
}
