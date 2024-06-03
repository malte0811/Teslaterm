import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    AvailableSerialPort,
    ConnectionPreset,
    IPC_CONSTANTS_TO_RENDERER,
    IUDPConnectionSuggestion,
    ToastSeverity,
} from "../../common/IPCConstantsToRenderer";
import {clearCoils, multiConnect, singleConnect} from "../connection/connection";
import {sendConnectionSuggestions} from "../connection/types/Suggestions";
import {getUIConfig, setUIConfig} from "../UIConfigHandler";
import {ipcs, MainIPC} from "./IPCProvider";

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
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.connect.setPresets, (presets) => this.setPresets(presets));
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.clearCoils, clearCoils);
    }

    public suggestUDP(suggestions: IUDPConnectionSuggestion[]) {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.connect.setUDPSuggestions, suggestions);
    }

    public suggestSerial(ports: AvailableSerialPort[]) {
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.connect.setSerialSuggestions, ports);
    }

    public sendConnectionError(coil: CoilID, error: string) {
        ipcs.coilMisc(coil).openToast('Connection Error', error, ToastSeverity.error, 'connect-error');
    }

    private setPresets(presets: ConnectionPreset[]) {
        setUIConfig({...getUIConfig(), connectionPresets: presets});
    }
}
