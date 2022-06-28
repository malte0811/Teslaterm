import {IPCConstantsToRenderer, MeterConfig, SetMeters} from "../../common/IPCConstantsToRenderer";
import {MultiWindowIPC} from "./IPCProvider";

export class MetersIPC {
    private state: { [id: number]: number } = {};
    private lastState: { [id: number]: number } = {};
    private readonly configs: Map<number, MeterConfig> = new Map();
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
        setInterval(() => this.tick(), 100);
    }

    public setValue(id: number, value: number) {
        this.state[id] = value;
    }

    public configure(id: number, min: number, max: number, div: number, name: string) {
        const config = new MeterConfig(id, min, max, div, name);
        this.processIPC.sendToAll(IPCConstantsToRenderer.meters.configure, config);
        this.configs.set(id, config);
    }

    public sendConfig(source: object) {
        for (const cfg of this.configs.values()) {
            this.processIPC.sendToWindow(IPCConstantsToRenderer.meters.configure, source, cfg);
        }
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
            this.processIPC.sendToAll(IPCConstantsToRenderer.meters.setValue, new SetMeters(update));
        }
    }
}
