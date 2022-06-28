import {
    IPCConstantsToRenderer, MediaState,
    ScopeLine,
    ScopeText,
    ScopeTraceConfig, ScopeValues,
} from "../../common/IPCConstantsToRenderer";
import {
    beginControlledDraw,
    drawChart,
    drawLine,
    drawString,
    redrawInfo,
    redrawMediaInfo,
    traces,
} from "../gui/oscilloscope/oscilloscope";
import {processIPC} from "./IPCProvider";

export namespace ScopeIPC {
    export function init() {
        processIPC.on(IPCConstantsToRenderer.scope.configure, (cfg: ScopeTraceConfig) => {
            traces[cfg.id].configure(cfg.min, cfg.max, cfg.offset, cfg.div, cfg.unit, cfg.name);
            redrawInfo();
        });
        processIPC.on(IPCConstantsToRenderer.scope.addValues, (cfg: ScopeValues) => {
            for (const tick of cfg.values) {
                for (const [id, val] of Object.entries(tick)) {
                    traces[id].addValue(val);
                }
                drawChart();
            }
        });
        processIPC.on(IPCConstantsToRenderer.scope.startControlled, () => {
            beginControlledDraw();
        });
        processIPC.on(IPCConstantsToRenderer.scope.drawLine, (cfg: ScopeLine) => {
            drawLine(cfg.x1, cfg.y1, cfg.x2, cfg.y2, cfg.color);
        });
        processIPC.on(IPCConstantsToRenderer.scope.drawString, (cfg: ScopeText) => {
            drawString(cfg.x, cfg.y, cfg.color, cfg.size, cfg.str, cfg.center);
        });
        processIPC.on(IPCConstantsToRenderer.scope.redrawMedia, (state: MediaState) => {
            redrawMediaInfo(state);
        });
    }
}
