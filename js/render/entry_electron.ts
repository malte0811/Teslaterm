import {ipcRenderer} from 'electron';
import {init} from './init';
import {IPCProvider, setIPC} from "./ipc/IPCProvider";

class ElectronIPC implements IPCProvider {
    public on(channel: string, callback: (...args: any[]) => void) {
        ipcRenderer.on(channel, (ev, ...args) => callback(...args));
    }

    public send(channel: string, ...args: any[]) {
        ipcRenderer.send(channel, ...args);
    }

    public once(channel: string, callback: (...args: any[]) => void) {
        ipcRenderer.once(channel, (ev, ...args) => callback(...args));
    }
}

setIPC(new ElectronIPC());
init();
