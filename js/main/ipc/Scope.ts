import {
    IPC_CONSTANTS_TO_RENDERER,
    ScopeLine,
    ScopeText,
    ScopeTraceConfig,
    ScopeValues,
} from "../../common/IPCConstantsToRenderer";
import {MediaState} from "../../common/IPCConstantsToRenderer";
import {media_state} from "../media/media_player";
import {MultiWindowIPC} from "./IPCProvider";

export class ScopeIPC {
    private tickSummary: Array<{ [id: number]: number }> = [];
    private sinceLastDraw: { [id: number]: number } = {};
    private configs: Map<number, ScopeTraceConfig> = new Map();
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
        setInterval(() => this.tick(), 50);
    }

    public drawChart() {
        this.tickSummary.push(this.sinceLastDraw);
        this.sinceLastDraw = {};
    }

    public addValue(traceId: number, value: number) {
        this.sinceLastDraw[traceId] = value;
    }

    public startControlledDraw(source?: object) {
        this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.scope.startControlled, source, undefined);
    }

    public drawLine(x1: number, y1: number, x2: number, y2: number, traceColorIndex: number, source?: object) {
        this.processIPC.sendToWindow(
            IPC_CONSTANTS_TO_RENDERER.scope.drawLine, source, {x1, y1, x2, y2, traceColorIndex},
        );
    }

    public drawText(
        x: number, y: number, traceColorIndex: number, size: number, str: string, center: boolean, source?: object
    ) {
        this.processIPC.sendToWindow(
            IPC_CONSTANTS_TO_RENDERER.scope.drawString, source, {x, y, traceColorIndex, size, str, center},
        );
    }

    public configure(
        id: number, min: number, max: number, offset: number, div: number, unit: string, name: string,
    ) {
        const config: ScopeTraceConfig = {id, min, max, offset, div, unit, name};
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.scope.configure, config);
        this.configs.set(id, config);
    }

    public updateMediaInfo() {
        this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.scope.redrawMedia,
            {
                progress: media_state.progress,
                state: media_state.state,
                title: media_state.title,
                type: media_state.type,
            });
    }

    public sendConfig(source: object) {
        for (const cfg of this.configs.values()) {
            this.processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.scope.configure, source, cfg);
        }
    }

    private tick() {
        if (Object.keys(this.tickSummary).length > 0) {
            this.processIPC.sendToAll(IPC_CONSTANTS_TO_RENDERER.scope.addValues, {values: this.tickSummary});
            this.tickSummary = [];
        }
    }
}
