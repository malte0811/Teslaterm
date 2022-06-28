import {ConnectionUIIPC} from "./ConnectionUI";
import {FileUploadIPC} from "./FileUpload";
import {MenuIPC} from "./Menu";
import {MetersIPC} from "./Meters";
import {MiscIPC} from "./Misc";
import {ScopeIPC} from "./Scope";
import {ScriptingIPC} from "./Scripting";
import {SlidersIPC} from "./sliders";
import {TerminalIPC} from "./terminal";

export interface ISingleWindowIPC {
    on(channel: string, callback: (data: object) => void);

    once(channel: string, callback: (data: object) => void);

    send(channel: string, ...data: any[]);
}

interface IIPCCallback {
    cb: (source: object, ...data: any[]) => void;
    once: boolean;
}

export class MultiWindowIPC {
    private windows: Map<object, ISingleWindowIPC> = new Map();
    private callbacks: Map<string, IIPCCallback[]> = new Map();
    private activeSingleCallbacks: Map<object, Set<string>> = new Map();
    private disconnectCallbacks: Map<object, Array<() => void>> = new Map();

    public on(channel: string, callback: (source: object, ...data: any[]) => void) {
        this.addListener(channel, callback, false);
    }

    public once(channel: string, callback: (source: object, ...data: any[]) => void) {
        this.addListener(channel, callback, true);
    }

    public addWindow(key: object, windowIPC: ISingleWindowIPC) {
        this.windows.set(key, windowIPC);
        for (const channel of this.callbacks.keys()) {
            this.addSingleCallback(channel, key);
        }
    }

    public isValidWindow(key: object): boolean {
        return this.windows.has(key);
    }

    public removeWindow(key: object) {
        this.windows.delete(key);
        this.activeSingleCallbacks.delete(key);
        if (this.disconnectCallbacks.has(key)) {
            for (const cb of this.disconnectCallbacks.get(key)) {
                cb();
            }
            this.disconnectCallbacks.delete(key);
        }
    }

    public sendToAll(channel: string, ...data: any[]) {
        for (const ipc of this.windows.values()) {
            ipc.send(channel, ...data);
        }
    }

    public sendToAllExcept(channel: string, key: object, ...data: any[]) {
        if (key && !this.isValidWindow(key)) {
            console.trace("Tried to send to all except invalid window " + key);
        } else {
            for (const k of this.windows.keys()) {
                if (k !== key) {
                    this.sendToWindow(channel, k, ...data);
                }
            }
        }
    }

    public sendToWindow(channel: string, key: object, ...data: any[]) {
        if (key) {
            if (this.isValidWindow(key)) {
                this.windows.get(key).send(channel, ...data);
            } else {
                console.trace("Tried to send to invalid window " + key);
            }
        } else {
            this.sendToAll(channel, ...data);
        }
    }

    public addDisconnectCallback(key: object, cb: () => void) {
        if (!this.disconnectCallbacks.has(key)) {
            this.disconnectCallbacks.set(key, [cb]);
        } else {
            const arr = this.disconnectCallbacks.get(key);
            arr[arr.length] = cb;
        }
    }

    private addListener(channel: string, callback: (source: object, ...data: any[]) => void, once: boolean) {
        if (!this.callbacks.has(channel)) {
            this.callbacks.set(channel, []);
            for (const key of this.windows.keys()) {
                this.addSingleCallback(channel, key);
            }
        }
        const arr = this.callbacks.get(channel);
        arr.push({cb: callback, once});
    }

    private addSingleCallback(channel: string, key: object) {
        if (!this.activeSingleCallbacks.has(key)) {
            this.activeSingleCallbacks.set(key, new Set());
        }
        const activeSet = this.activeSingleCallbacks.get(key);
        if (!activeSet.has(channel)) {
            activeSet.add(channel);
            this.windows.get(key).on(channel, (...data: any[]) => {
                const callbacks = this.callbacks.get(channel);
                if (callbacks) {
                    for (let i = 0; i < callbacks.length; ++i) {
                        callbacks[i].cb(key, ...data);
                        if (callbacks[i].once) {
                            callbacks[i] = callbacks[callbacks.length - 1];
                            --callbacks.length;
                            --i;
                        }
                    }
                }
            });
        }
    }
}

export class IPCCollection {
    public readonly connectionUI: ConnectionUIIPC;
    public readonly fileUpload: FileUploadIPC;
    public readonly menu: MenuIPC;
    public readonly meters: MetersIPC;
    public readonly misc: MiscIPC;
    public readonly scope: ScopeIPC;
    public readonly scripting: ScriptingIPC;
    public readonly sliders: SlidersIPC;
    public readonly terminal: TerminalIPC;

    constructor(process: MultiWindowIPC) {
        this.connectionUI = new ConnectionUIIPC(process);
        this.fileUpload = new FileUploadIPC(process);
        this.menu = new MenuIPC(process);
        this.meters = new MetersIPC(process);
        this.misc = new MiscIPC(process);
        this.scope = new ScopeIPC(process);
        this.scripting = new ScriptingIPC(process);
        this.sliders = new SlidersIPC(process);
        this.terminal = new TerminalIPC(process);
    }
}

export let processIPC: MultiWindowIPC;
export let ipcs: IPCCollection;

export function init() {
    processIPC = new MultiWindowIPC();
    ipcs = new IPCCollection(processIPC);
}
