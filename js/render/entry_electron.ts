import {ipcRenderer} from 'electron';
import {init} from './App';
import {IPCListenerRef, IPCProvider, setIPC} from "./ipc/IPCProvider";

class ElectronIPC implements IPCProvider {
    public on(channel: string, callback: (...args: any[]) => void): IPCListenerRef {
        ipcRenderer.addListener(channel, (ev, ...args) => callback(...args));
        const listeners = ipcRenderer.listeners(channel);
        return {channel, realCB: listeners[listeners.length - 1]};
    }

    public send(channel: string, ...args: any[]) {
        ipcRenderer.send(channel, ...args);
    }

    public removeListener(listener:IPCListenerRef) {
        ipcRenderer.removeListener(listener.channel, listener.realCB);
    }
}

setIPC(new ElectronIPC());
init();
