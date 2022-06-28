import {io} from "socket.io-client";
import {init} from './init';
import {IPCProvider, setIPC} from "./ipc/IPCProvider";

const serverComms = io();

class IPC implements IPCProvider {
    public on(channel: string, callback: (...args: any[]) => void) {
        serverComms.on(channel, callback);
    }

    public once(channel: string, callback: (...args: any[]) => void) {
        serverComms.once(channel, callback);
    }

    public send(channel: string, ...args: any[]) {
        serverComms.emit(channel, ...args);
    }
}

setIPC(new IPC());
init();
