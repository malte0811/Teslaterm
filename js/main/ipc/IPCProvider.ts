import {ipcMain} from "electron";
import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, IPCToMainKey, PerCoilMainIPCs} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, IPCToRendererKey} from "../../common/IPCConstantsToRenderer";
import {forEachCoil} from "../connection/connection";
import {initAlarms} from "../connection/telemetry/Alarms";
import {mainWindow} from "../main_electron";
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

type IIPCCallback = (d: any) => void;

export class MultiWindowIPC {
    private callbacks: Map<string, IIPCCallback[]> = new Map();

    public on<T>(channel: IPCToMainKey<T>, callback: (data: T) => void) {
        ipcMain.on(channel.channel, (ev, ...args) => callback(args[0] as T));
        if (!this.callbacks.has(channel.channel)) {
            this.callbacks.set(channel.channel, []);
        }
        this.callbacks.get(channel.channel).push(callback);
    }

    public onAsync<T>(channel: IPCToMainKey<T>, callback: (data: T) => Promise<any>) {
        this.on(channel, (data) => {
            callback(data).catch((err) => {
                console.error("While processing message on", channel.channel, ", payload", data, ":", err);
            });
        });
    }

    // TODO look at "all except" calls
    public send<T>(channel: IPCToRendererKey<T>, data: T) {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send(channel.channel, data);
        }
    }

    public distributeTo<T>(global: IPCToMainKey<T>, perCoil: (channels: PerCoilMainIPCs) => IPCToMainKey<T>) {
        this.on(global, (data) => {
            forEachCoil((coil) => this.triggerFromWindow(perCoil(getToMainIPCPerCoil(coil)), data));
        });
    }

    private triggerFromWindow<T>(channel: IPCToRendererKey<T>, data: T) {
        for (const cb of this.callbacks.get(channel.channel) || []) {
            cb(data);
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
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.registerCoil, [coil, multicoil]);
    }

    public clearCoils() {
        this.metersByCoil.forEach((ipc) => ipc.clear());
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
