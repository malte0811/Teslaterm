import {ipcs} from "../../ipc/IPCProvider";
import {MenuIPC} from "../../ipc/Menu";

export let busActive: boolean = false;
export let busControllable: boolean = false;
export let transientActive: boolean = false;
export let killBitSet: boolean = false;

export function updateStateFromTelemetry(packedData) {
    busActive = (packedData & 1) !== 0;
    transientActive = (packedData & 2) !== 0;
    busControllable = (packedData & 4) !== 0;
    killBitSet = (packedData & 8) !== 0;
    ipcs.menu.setUD3State(busActive, busControllable, transientActive, killBitSet);
}
