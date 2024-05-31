import {ipcMain} from "electron";
import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, IPCToMainKey, PerCoilMainIPCs} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, IPCToRendererKey} from "../../common/IPCConstantsToRenderer";
import {forEachCoil, isMulticoil} from "../connection/connection";
import {initAlarms} from "../connection/telemetry/Alarms";
import {mainWindow} from "../main_electron";
import {CommandIPC, registerCommonCommandsIPC} from "./Commands";
import {ConnectionUIIPC} from "./ConnectionUI";
import {FileUploadIPC} from "./FileUpload";
import {FlightRecorderIPC} from "./FlightRecorderIPC";
import {CommonMenuIPC, PerCoilMenuIPC} from "./Menu";
import {MetersIPC} from "./Meters";
import {ByCoilMiscIPC, CommonMiscIPC, sendCoilSync} from "./Misc";
import {MixerIPC} from "./MixerIPC";
import {ScopeIPC} from "./Scope";
import {ScriptingIPC} from "./Scripting";
import {registerCommonSliderIPC, SlidersIPC} from "./sliders";
import {TemporaryIPC} from "./TemporaryIPC";
import {TerminalIPC} from "./terminal";

type IIPCCallback = (d: any) => void;

export interface IPCListenerRegistration {
    channel: IPCToMainKey<any>;
    directCallback: IIPCCallback;
    electronCallback: any;
}

export class MainIPC {
    private callbacks: Map<string, IIPCCallback[]> = new Map();

    public on<T>(channel: IPCToMainKey<T>, callback: (data: T) => void): IPCListenerRegistration {
        const electronCallback = (ev, ...args) => callback(args[0] as T);
        ipcMain.on(channel.channel, electronCallback);
        if (!this.callbacks.has(channel.channel)) {
            this.callbacks.set(channel.channel, []);
        }
        this.callbacks.get(channel.channel).push(callback);
        return {channel, directCallback: callback, electronCallback};
    }

    public onAsync<T>(channel: IPCToMainKey<T>, callback: (data: T) => Promise<any>) {
        return this.on(channel, (data) => {
            callback(data).catch((err) => {
                console.error("While processing message on", channel.channel, ", payload", data, ":", err);
            });
        });
    }

    public unregister(listener: IPCListenerRegistration) {
        ipcMain.off(listener.channel.channel, listener.electronCallback);
        const listeners = this.callbacks.get(listener.channel.channel);
        listeners.splice(listeners.indexOf(listener.directCallback), 1);
    }

    // TODO look at "all except" calls
    public send<T>(channel: IPCToRendererKey<T>, data: T) {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send(channel.channel, data);
        }
    }

    public distributeTo<T>(global: IPCToMainKey<T>, perCoil: (channels: PerCoilMainIPCs) => IPCToMainKey<T>) {
        this.on(global, (data) => {
            forEachCoil((coil) => {
                const channel = perCoil(getToMainIPCPerCoil(coil));
                for (const cb of this.callbacks.get(channel.channel) || []) {
                    cb(data);
                }
            });
        });
    }
}

export class IPCCollection {
    public readonly connectionUI: ConnectionUIIPC;
    public readonly fileUpload: FileUploadIPC;
    public readonly flightRecorder: FlightRecorderIPC;
    public readonly misc: CommonMiscIPC;
    public readonly scripting: ScriptingIPC;
    public readonly menu: CommonMenuIPC;
    public readonly mixer: MixerIPC;
    private readonly commandsByCoil: Map<CoilID, CommandIPC> = new Map<CoilID, CommandIPC>();
    private readonly terminalByCoil: Map<CoilID, TerminalIPC> = new Map<CoilID, TerminalIPC>();
    private readonly menuByCoil: Map<CoilID, PerCoilMenuIPC> = new Map<CoilID, PerCoilMenuIPC>();
    private readonly slidersByCoil: Map<CoilID, SlidersIPC> = new Map<CoilID, SlidersIPC>();
    private readonly metersByCoil: Map<CoilID, MetersIPC> = new Map<CoilID, MetersIPC>();
    private readonly scopeByCoil: Map<CoilID, ScopeIPC> = new Map<CoilID, ScopeIPC>();
    private readonly miscByCoil: Map<CoilID, ByCoilMiscIPC> = new Map<CoilID, ByCoilMiscIPC>();
    private readonly ipcScopeByCoil: Map<CoilID, TemporaryIPC> = new Map<CoilID, TemporaryIPC>();
    private readonly processIPC: MainIPC;

    constructor(process: MainIPC) {
        this.connectionUI = new ConnectionUIIPC(process);
        this.fileUpload = new FileUploadIPC(process);
        this.flightRecorder = new FlightRecorderIPC(process);
        this.misc = new CommonMiscIPC(process);
        this.scripting = new ScriptingIPC(process);
        this.menu = new CommonMenuIPC(process);
        this.mixer = new MixerIPC(process);
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

    public initCoilIPC(coil: CoilID) {
        const tempIPC = new TemporaryIPC();
        this.ipcScopeByCoil.set(coil, tempIPC);
        this.slidersByCoil.set(coil, new SlidersIPC(tempIPC, coil));
        this.menuByCoil.set(coil, new PerCoilMenuIPC(tempIPC, coil));
        this.terminalByCoil.set(coil, new TerminalIPC(tempIPC, coil));
        this.commandsByCoil.set(coil, new CommandIPC(tempIPC, coil));
        this.metersByCoil.set(coil, new MetersIPC(tempIPC, coil));
        this.scopeByCoil.set(coil, new ScopeIPC(tempIPC, coil));
        this.miscByCoil.set(coil, new ByCoilMiscIPC(tempIPC, coil));
        initAlarms(coil);
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.registerCoil, [coil, isMulticoil()]);
        sendCoilSync(coil);
    }

    public clearCoils() {
        this.ipcScopeByCoil.forEach((ipc) => ipc.clear());
        this.ipcScopeByCoil.clear();
        this.slidersByCoil.clear();
        this.menuByCoil.clear();
        this.terminalByCoil.clear();
        this.commandsByCoil.clear();
        this.metersByCoil.clear();
        this.scopeByCoil.clear();
        this.miscByCoil.clear();
    }

    public tick100() {
        this.metersByCoil.forEach((ipc) => ipc.tick());
        this.slidersByCoil.forEach((ipc) => ipc.tick100());
        this.mixer.tick100();
    }
}

export let processIPC: MainIPC;
export let ipcs: IPCCollection;

export function init() {
    processIPC = new MainIPC();
    ipcs = new IPCCollection(processIPC);
    registerCommonCommandsIPC(processIPC);
    registerCommonSliderIPC(processIPC);
}
