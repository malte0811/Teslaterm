export interface IPCListenerRef {
    channel: string;
    realCB: any;
}

export interface IPCProvider {
    send(channel: string, ...args: any[]);

    on(channel: string, callback: (...args: any[]) => void): IPCListenerRef;

    removeListener(listener: IPCListenerRef);
}

export class DummyIPC implements IPCProvider {
    public on(channel: string, callback: (...args: any[]) => void): IPCListenerRef {
        return {channel, realCB: undefined};
    }

    public send(channel: string, ...args: any[]) {
    }

    public removeListener(listener: IPCListenerRef) {
    }
}

export let processIPC: IPCProvider = new DummyIPC();

export function setIPC(ipc: IPCProvider) {
    processIPC = ipc;
}
