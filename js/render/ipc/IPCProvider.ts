import {IPCToMainKey} from "../../common/IPCConstantsToMain";
import {IPCToRendererKey} from "../../common/IPCConstantsToRenderer";

export interface IPCListenerRef {
    channel: string;
    realCB: any;
}

export interface IPCProvider {
    send<T>(channel: IPCToMainKey<T>, data: T);

    on<T>(channel: IPCToRendererKey<T>, callback: (arg: T) => void): IPCListenerRef;

    removeListener(listener: IPCListenerRef);
}

export class DummyIPC implements IPCProvider {
    public on<T>(channel: IPCToRendererKey<T>, callback: (arg: T) => void): IPCListenerRef {
        return {channel: channel.channel, realCB: undefined};
    }

    public send<T>(channel: IPCToMainKey<T>, data: T) {
    }

    public removeListener(listener: IPCListenerRef) {
    }
}

export let processIPC: IPCProvider = new DummyIPC();

export function setIPC(ipc: IPCProvider) {
    processIPC = ipc;
}
