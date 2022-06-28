import {IPC_CONSTANTS_TO_RENDERER, MeterConfig, SetMeters} from "../../common/IPCConstantsToRenderer";
import {meters} from "../gui/gauges";
import {processIPC} from "./IPCProvider";

export namespace MetersIPC {
    export function init() {
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.meters.configure, (cfg: MeterConfig) => {
            meters[cfg.meterId].setRange(cfg.min, cfg.max, cfg.scale);
            meters[cfg.meterId].setText(cfg.name);
        });
        processIPC.on(IPC_CONSTANTS_TO_RENDERER.meters.setValue, (cfg: SetMeters) => {
            for (const [id, value] of Object.entries(cfg.values)) {
                meters[id].setValue(value);
            }
        });
    }
}
