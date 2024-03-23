import {IPCToMainKey} from "../../common/IPCConstantsToMain";
import {IPCToRendererKey} from "../../common/IPCConstantsToRenderer";
import {IPCListenerRegistration, processIPC} from "./IPCProvider";

export class TemporaryIPC {
    private registeredListeners: IPCListenerRegistration[] = [];

    public on<T>(channel: IPCToMainKey<T>, callback: (data: T) => void) {
        this.registeredListeners.push(processIPC.on(channel, callback));
    }

    public onAsync<T>(channel: IPCToMainKey<T>, callback: (data: T) => Promise<any>) {
        this.registeredListeners.push(processIPC.onAsync(channel, callback));
    }

    public clear() {
        this.registeredListeners.forEach((reg) => processIPC.unregister(reg));
    }

    public send<T>(channel: IPCToRendererKey<T>, data: T) {
        processIPC.send(channel, data);
    }
}
