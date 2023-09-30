import {IPC_CONSTANTS_TO_RENDERER, MeterConfig} from "../../common/IPCConstantsToRenderer";
import {MultiWindowIPC} from "./IPCProvider";

export class MetersIPC {
    private state: number[] = [];
    private lastState: number[] = [];
    private readonly configs: MeterConfig[] = [];
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
        setInterval(() => this.tick(), 100);
    }

    public setValue(id: number, value: number) {
        this.state[id] = value;
    }

    public configure(meterId: number, min: number, max: number, scale: number, name: string) {
        const config: MeterConfig = {meterId, min, max, scale, name};
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.meters.configure, config);
        this.configs[meterId] =  config;
    }

    public sendConfig(source: object) {
        for (const cfg of Object.values(this.configs)) {
            this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.meters.configure, source, cfg);
        }
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.meters.setValue, source, {values: this.lastState});
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
            this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.meters.setValue, {values: update});
        }
    }
}
