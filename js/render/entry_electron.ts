import {ipcRenderer} from 'electron';
import {IPCToMainKey} from "../common/IPCConstantsToMain";
import {IPCToRendererKey} from "../common/IPCConstantsToRenderer";
import {init} from './App';
import {IPCListenerRef, IPCProvider, setIPC} from "./ipc/IPCProvider";

class ElectronIPC implements IPCProvider {
    public on<T>(channel: IPCToRendererKey<T>, callback: (arg: T) => void): IPCListenerRef {
        ipcRenderer.addListener(channel.channel, (ev, args) => callback(args));
        const listeners = ipcRenderer.listeners(channel.channel);
        return {channel: channel.channel, realCB: listeners[listeners.length - 1]};
    }

    public send<T>(channel: IPCToMainKey<T>, data: T) {
        ipcRenderer.send(channel.channel, data);
    }

    public removeListener(listener: IPCListenerRef) {
        ipcRenderer.removeListener(listener.channel, listener.realCB);
    }

    public once<T>(channel: IPCToRendererKey<T>, callback: (arg: T) => void) {
        ipcRenderer.once(channel.channel, (ev, args) => callback(args));
    }
}

setIPC(new ElectronIPC());
init();
