import {CoilID} from "../../common/constants";
import {
    CentralTelemetryValue,
    getToRenderIPCPerCoil, IPC_CONSTANTS_TO_RENDERER,
    MeterConfig,
    PerCoilRenderIPCs
} from "../../common/IPCConstantsToRenderer";
import {getUIConfig} from "../UIConfig";
import {MultiWindowIPC} from "./IPCProvider";

export class MetersIPC {
    private rawValues: number[] = [];
    private lastScaledValues: number[] = [];
    private readonly configs: MeterConfig[] = [];
    private readonly processIPC: MultiWindowIPC;
    private readonly coil: CoilID;
    private readonly renderIPCs: PerCoilRenderIPCs;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        this.processIPC = processIPC;
        this.coil = coil;
        this.renderIPCs = getToRenderIPCPerCoil(this.coil);
        setInterval(() => this.tick(), 100);
    }

    public setValue(id: number, value: number) {
        this.rawValues[id] = value;
    }

    public configure(meterId: number, min: number, max: number, scale: number, name: string) {
        const config: MeterConfig = {meterId, min, max, scale, name};
        this.processIPC.sendToAll(this.renderIPCs.meters.configure, config);
        this.configs[meterId] =  config;
    }

    public sendConfig(source: object) {
        for (const cfg of Object.values(this.configs)) {
            this.processIPC.sendToWindow(this.renderIPCs.meters.configure, source, cfg);
        }
        this.sendCentralTelemetry();
        this.processIPC.sendToWindow(this.renderIPCs.meters.setValue, source, {values: this.lastScaledValues});
    }

    public getCurrentConfigs() {
        return this.configs;
    }

    private tick() {
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
            this.processIPC.sendToAll(this.renderIPCs.meters.setValue, {values: update});
            this.sendCentralTelemetry();
        }
    }

    private sendCentralTelemetry() {
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
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.setCentralTelemetry, [this.coil, values]);
    }
}
