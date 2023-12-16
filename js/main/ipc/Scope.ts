import {CoilID} from "../../common/constants";
import {getToRenderIPCPerCoil, ScopeTraceConfig} from "../../common/IPCConstantsToRenderer";
import {MultiWindowIPC} from "./IPCProvider";

export class ScopeIPC {
    private tickSummary: number[][] = [];
    private sinceLastDraw: number[] = [];
    private configs: ScopeTraceConfig[] = [];
    private readonly processIPC: MultiWindowIPC;
    private coil: CoilID;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        this.processIPC = processIPC;
        this.coil = coil;
        setInterval(() => this.tick(), 50);
    }

    public drawChart() {
        this.tickSummary.push(this.sinceLastDraw);
        this.sinceLastDraw = [];
    }

    public addValue(traceId: number, value: number) {
        this.sinceLastDraw[traceId] = value;
    }

    public startControlledDraw(title: string, source?: object) {
        this.processIPC.sendToWindow(getToRenderIPCPerCoil(this.coil).scope.startControlled, source, title);
    }

    public drawLine(x1: number, y1: number, x2: number, y2: number, traceColorIndex: number, source?: object) {
        this.processIPC.sendToWindow(
            getToRenderIPCPerCoil(this.coil).scope.drawLine, source, {x1, y1, x2, y2, traceColorIndex},
        );
    }

    public drawText(
        x: number, y: number, traceColorIndex: number, size: number, str: string, center: boolean, source?: object,
    ) {
        this.processIPC.sendToWindow(
            getToRenderIPCPerCoil(this.coil).scope.drawString, source, {x, y, traceColorIndex, size, str, center},
        );
    }

    public configure(
        id: number, min: number, max: number, offset: number, div: number, unit: string, name: string,
    ) {
        const config: ScopeTraceConfig = {id, min, max, offset, div, unit, name};
        this.processIPC.sendToAll(getToRenderIPCPerCoil(this.coil).scope.configure, config);
        this.configs[id] = config;
    }

    public sendConfig(source: object) {
        for (const cfg of Object.values(this.configs)) {
            this.processIPC.sendToWindow(getToRenderIPCPerCoil(this.coil).scope.configure, source, cfg);
        }
    }

    public getCurrentConfigs() {
        return this.configs;
    }

    private tick() {
        if (Object.keys(this.tickSummary).length > 0) {
            this.processIPC.sendToAll(getToRenderIPCPerCoil(this.coil).scope.addValues, {values: this.tickSummary});
            this.tickSummary = [];
        }
    }
}
