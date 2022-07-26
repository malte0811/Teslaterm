import {io} from "socket.io-client";
import {init} from './App';
import {IPCListenerRef, IPCProvider, setIPC} from "./ipc/IPCProvider";

const serverComms = io();

class IPC implements IPCProvider {
    public on(channel: string, callback: (...args: any[]) => void): IPCListenerRef {
        serverComms.on(channel, callback);
        const listeners = serverComms.listeners(channel);
        return {channel, realCB:listeners[listeners.length - 1]};
    }

    public send(channel: string, ...args: any[]) {
        serverComms.emit(channel, ...args);
    }

    public removeListener(listener:IPCListenerRef) {
        serverComms.removeListener(listener.channel, listener.realCB);
    }
}

setIPC(new IPC());
init();
