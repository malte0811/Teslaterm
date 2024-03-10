import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, IPCToMainKey, PerCoilMainIPCs} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, IPCToRendererKey} from "../../common/IPCConstantsToRenderer";
import {forEachCoil} from "../connection/connection";
import {initAlarms} from "../connection/telemetry/Alarms";
import {CommandIPC, registerCommonCommandsIPC} from "./Commands";
import {ConnectionUIIPC} from "./ConnectionUI";
import {FileUploadIPC} from "./FileUpload";
import {FlightRecorderIPC} from "./FlightRecorderIPC";
import {CommonMenuIPC, PerCoilMenuIPC} from "./Menu";
import {MetersIPC} from "./Meters";
import {ByCoilMiscIPC, CommonMiscIPC} from "./Misc";
import {ScopeIPC} from "./Scope";
import {ScriptingIPC} from "./Scripting";
import {registerCommonSliderIPC, SlidersIPC} from "./sliders";
import {TerminalIPC} from "./terminal";

export interface ISingleWindowIPC {
    on(channel: string, callback: (data: object) => void): void;

    once(channel: string, callback: (data: object) => void): void;

    send(channel: string, ...data: any[]): void;
}

interface IIPCCallback {
    cb: (source: object, ...data: any[]) => void;
}

export class MultiWindowIPC {
    private windows: Map<object, ISingleWindowIPC> = new Map();
    private callbacks: Map<string, IIPCCallback[]> = new Map();
    private activeSingleCallbacks: Map<object, Set<string>> = new Map();
    private disconnectCallbacks: Map<object, Array<() => void>> = new Map();

    public on<T>(channel: IPCToMainKey<T>, callback: (source: object, data: T) => void) {
        if (!this.callbacks.has(channel.channel)) {
            this.callbacks.set(channel.channel, []);
            for (const key of this.windows.keys()) {
                this.addSingleCallback(channel.channel, key);
            }
        }
        this.callbacks.get(channel.channel).push({cb: callback});
    }

    public onAsync<T>(channel: IPCToMainKey<T>, callback: (source: object, data: T) => Promise<any>) {
        this.on(channel, (source, data) => {
            callback(source, data).catch((err) => {
                console.error("While processing message on", channel.channel, "from", source, ", payload", data, ":", err);
            });
        });
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

    public sendToAll<T>(channel: IPCToRendererKey<T>, data: T) {
        for (const ipc of this.windows.values()) {
            ipc.send(channel.channel, data);
        }
    }

    public sendToAllExcept<T>(channel: IPCToRendererKey<T>, key: object, data: T) {
        if (key && !this.isValidWindow(key)) {
            console.trace("Tried to send to all except invalid window " + key);
        } else {
            for (const k of this.windows.keys()) {
                if (k !== key) {
                    this.sendToWindow(channel, k, data);
                }
            }
        }
    }

    public sendToWindow<T>(channel: IPCToRendererKey<T>, key: object, data: T) {
        if (key) {
            if (this.isValidWindow(key)) {
                this.windows.get(key).send(channel.channel, data);
            } else {
                console.trace("Tried to send to invalid window " + key);
            }
        } else {
            this.sendToAll(channel, data);
        }
    }

    public triggerFromWindow<T>(channel: IPCToRendererKey<T>, key: object, data: T) {
        for (const cb of this.callbacks.get(channel.channel) || []) {
            cb.cb(key, data);
        }
    }

    public distributeTo<T>(global: IPCToMainKey<T>, perCoil: (channels: PerCoilMainIPCs) => IPCToMainKey<T>) {
        processIPC.on(global, (source, data) => {
            forEachCoil((coil) => processIPC.triggerFromWindow(perCoil(getToMainIPCPerCoil(coil)), source, data));
        });
    }

    public addDisconnectCallback(key: object, cb: () => void) {
        if (!this.disconnectCallbacks.has(key)) {
            this.disconnectCallbacks.set(key, [cb]);
        } else {
            const arr = this.disconnectCallbacks.get(key);
            arr[arr.length] = cb;
        }
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
                    }
                }
            });
        }
    }
}

export class IPCCollection {
    public readonly connectionUI: ConnectionUIIPC;
    public readonly fileUpload: FileUploadIPC;
    public readonly flightRecorder: FlightRecorderIPC;
    public readonly misc: CommonMiscIPC;
    public readonly scripting: ScriptingIPC;
    public readonly menu: CommonMenuIPC;
    private readonly commandsByCoil: Map<CoilID, CommandIPC> = new Map<CoilID, CommandIPC>();
    private readonly terminalByCoil: Map<CoilID, TerminalIPC> = new Map<CoilID, TerminalIPC>();
    private readonly menuByCoil: Map<CoilID, PerCoilMenuIPC> = new Map<CoilID, PerCoilMenuIPC>();
    private readonly slidersByCoil: Map<CoilID, SlidersIPC> = new Map<CoilID, SlidersIPC>();
    private readonly metersByCoil: Map<CoilID, MetersIPC> = new Map<CoilID, MetersIPC>();
    private readonly scopeByCoil: Map<CoilID, ScopeIPC> = new Map<CoilID, ScopeIPC>();
    private readonly miscByCoil: Map<CoilID, ByCoilMiscIPC> = new Map<CoilID, ByCoilMiscIPC>();
    private readonly processIPC: MultiWindowIPC;

    constructor(process: MultiWindowIPC) {
        this.connectionUI = new ConnectionUIIPC(process);
        this.fileUpload = new FileUploadIPC(process);
        this.flightRecorder = new FlightRecorderIPC(process);
        this.misc = new CommonMiscIPC(process);
        this.scripting = new ScriptingIPC(process);
        this.menu = new CommonMenuIPC(process);
        this.processIPC = process;
    }

    public sliders(coil: CoilID): SlidersIPC {
        return this.slidersByCoil.get(coil);
    }

    public coilMenu(coil: CoilID): PerCoilMenuIPC {
        return this.menuByCoil.get(coil);
    }

    public terminal(coil: CoilID): TerminalIPC {
        return this.terminalByCoil.get(coil);
    }

    public commands(coil: CoilID): CommandIPC {
        return this.commandsByCoil.get(coil);
    }

    public scope(coil: CoilID): ScopeIPC {
        return this.scopeByCoil.get(coil);
    }

    public meters(coil: CoilID): MetersIPC {
        return this.metersByCoil.get(coil);
    }

    public coilMisc(coil: CoilID): ByCoilMiscIPC {
        return this.miscByCoil.get(coil);
    }

    public initCoilIPC(coil: CoilID, multicoil: boolean) {
        this.slidersByCoil.set(coil, new SlidersIPC(this.processIPC, coil));
        this.menuByCoil.set(coil, new PerCoilMenuIPC(this.processIPC, coil));
        this.terminalByCoil.set(coil, new TerminalIPC(this.processIPC, coil));
        this.commandsByCoil.set(coil, new CommandIPC(this.processIPC, coil));
        this.metersByCoil.set(coil, new MetersIPC(this.processIPC, coil));
        this.scopeByCoil.set(coil, new ScopeIPC(this.processIPC, coil));
        this.miscByCoil.set(coil, new ByCoilMiscIPC(this.processIPC, coil));
        initAlarms(coil);
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.registerCoil, [coil, multicoil]);
    }
}

export let processIPC: MultiWindowIPC;
export let ipcs: IPCCollection;

export function init() {
    processIPC = new MultiWindowIPC();
    ipcs = new IPCCollection(processIPC);
    registerCommonCommandsIPC(processIPC);
    registerCommonSliderIPC(processIPC);
}
