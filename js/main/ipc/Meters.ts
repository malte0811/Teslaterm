import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    CentralTelemetryValue,
    getToRenderIPCPerCoil, IPC_CONSTANTS_TO_RENDERER,
    MeterConfig,
    PerCoilRenderIPCs,
} from "../../common/IPCConstantsToRenderer";
import {getUIConfig} from "../UIConfig";
import {TemporaryIPC} from "./TemporaryIPC";

export class MetersIPC {
    private rawValues: number[] = [];
    private lastScaledValues: number[] = [];
    private readonly configs: MeterConfig[] = [];
    private readonly processIPC: TemporaryIPC;
    private readonly coil: CoilID;
    private readonly renderIPCs: PerCoilRenderIPCs;

    constructor(processIPC: TemporaryIPC, coil: CoilID) {
        this.processIPC = processIPC;
        this.coil = coil;
        this.renderIPCs = getToRenderIPCPerCoil(this.coil);
        this.processIPC.on(IPC_CONSTANTS_TO_MAIN.centralTab.requestTelemetryNames, () => this.processIPC.send(
            IPC_CONSTANTS_TO_RENDERER.centralTab.informTelemetryNames,
            this.configs.map((cfg) => cfg.name),
        ));
    }

    public setValue(id: number, value: number) {
        this.rawValues[id] = value;
    }

    public configure(meterId: number, min: number, max: number, scale: number, name: string) {
        const config: MeterConfig = {meterId, min, max, scale, name};
        this.processIPC.send(this.renderIPCs.meters.configure, config);
        this.configs[meterId] =  config;
    }

    public sendConfig() {
        for (const cfg of Object.values(this.configs)) {
            this.processIPC.send(this.renderIPCs.meters.configure, cfg);
        }
        this.sendCentralTelemetry();
        this.processIPC.send(this.renderIPCs.meters.setValue, {values: this.lastScaledValues});
    }

    public getCurrentConfigs() {
        return this.configs;
    }

    public tick() {
        const update: { [id: number]: number } = {};
        this.rawValues.forEach((value, id) => {
            const scale = this.configs[id] ? this.configs[id].scale : 1;
            const scaled = value / scale;
            if (this.lastScaledValues[id] !== scaled) {
                this.lastScaledValues[id] = scaled;
                update[id] = scaled;
            }
        });
        if (Object.keys(update).length > 0) {
            this.processIPC.send(this.renderIPCs.meters.setValue, {values: update});
            this.sendCentralTelemetry();
        }
    }

    public sendCentralTelemetry() {
        const values: CentralTelemetryValue[] = [];
        for (const nameToSend of getUIConfig().centralTelemetry) {
            const config = this.configs.find((cfg) => cfg && cfg.name === nameToSend);
            if (config) {
                const value = this.lastScaledValues[config.meterId];
                values.push({max: config.max, min: config.min, value, valueName: config.name});
            } else {
                values.push(undefined);
            }
        }
        this.processIPC.send(IPC_CONSTANTS_TO_RENDERER.centralTab.setCentralTelemetry, [this.coil, values]);
    }
}
