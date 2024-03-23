import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    AvailableSerialPort,
    ConnectionPreset,
    IPC_CONSTANTS_TO_RENDERER,
    IUDPConnectionSuggestion,
} from "../../common/IPCConstantsToRenderer";
import {clearCoils, multiConnect, singleConnect} from "../connection/connection";
import {sendConnectionSuggestions} from "../connection/types/Suggestions";
import {getUIConfig, setUIConfig} from "../UIConfig";
import {MainIPC} from "./IPCProvider";

export class ConnectionUIIPC {
    private readonly processIPC: MainIPC;

    constructor(processIPC: MainIPC) {
        this.processIPC = processIPC;
        this.processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.connect.connect,
            async (args) => await singleConnect(args),
        );
        this.processIPC.onAsync(
            IPC_CONSTANTS_TO_MAIN.connect.multiconnect,
            async (args) => await multiConnect(args),
        );
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.connect.requestSuggestions, sendConnectionSuggestions);
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.connect.getPresets, () => this.processIPC.send(
            IPC_CONSTANTS_TO_RENDERER.connect.syncPresets, getUIConfig().connectionPresets,
        ));
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.connect.setPresets, (presets) => this.setPresets(presets));
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.clearCoils, clearCoils);
    }

    public suggestUDP(suggestions: IUDPConnectionSuggestion[]) {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.connect.setUDPSuggestions, suggestions);
    }

    public suggestSerial(ports: AvailableSerialPort[]) {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.connect.setSerialSuggestions, ports);
    }

    public sendConnectionError(error: string) {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.connect.connectionError, error);
    }

    private setPresets(presets: ConnectionPreset[]) {
        setUIConfig({...getUIConfig(), connectionPresets: presets});
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.connect.syncPresets, presets);
    }
}
