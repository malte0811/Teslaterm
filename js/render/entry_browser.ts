import {io} from "socket.io-client";
import {IPCToMainKey} from "../common/IPCConstantsToMain";
import {IPCToRendererKey} from "../common/IPCConstantsToRenderer";
import {init} from './App';
import {IPCListenerRef, IPCProvider, setIPC} from "./ipc/IPCProvider";

const serverComms = io();

class IPC implements IPCProvider {
    public on<T>(channel: IPCToRendererKey<T>, callback: (arg: T) => void): IPCListenerRef {
        serverComms.on(channel.channel, callback);
        const listeners = serverComms.listeners(channel.channel);
        return {channel: channel.channel, realCB:listeners[listeners.length - 1]};
    }

    public send<T>(channel: IPCToMainKey<T>, data: T) {
        serverComms.emit(channel.channel, data);
    }

    public removeListener(listener:IPCListenerRef) {
        serverComms.removeListener(listener.channel, listener.realCB);
    }
}

setIPC(new IPC());
init();
