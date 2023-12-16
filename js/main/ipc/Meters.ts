import {CoilID} from "../../common/constants";
import {getToRenderIPCPerCoil, MeterConfig, PerCoilRenderIPCs} from "../../common/IPCConstantsToRenderer";
import {MultiWindowIPC} from "./IPCProvider";

export class MetersIPC {
    private state: number[] = [];
    private lastState: number[] = [];
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
        this.state[id] = value;
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
        this.processIPC.sendToWindow(this.renderIPCs.meters.setValue, source, {values: this.lastState});
    }

    public getCurrentConfigs() {
        return this.configs;
    }

    private tick() {
        const update: { [id: number]: number } = {};
        for (const [id, value] of Object.entries(this.state)) {
            if (this.lastState[id] !== value) {
                this.lastState[id] = value;
                update[id] = value;
            }
        }
        if (Object.keys(update).length > 0) {
            this.processIPC.sendToAll(this.renderIPCs.meters.setValue, {values: update});
        }
    }
}
