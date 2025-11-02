import {CoilID} from "../../../common/constants";
import {UD3State} from "../../../common/IPCConstantsToRenderer";
import {ipcs} from "../../ipc/IPCProvider";

const ud3States: Map<CoilID, UD3State> = new Map<CoilID, UD3State>();

export function getUD3State(coil: CoilID) {
    if (!ud3States.has(coil)) {
        setUD3State(coil, UD3State.DEFAULT_STATE);
    }
    return ud3States.get(coil);
}

export function setUD3State(coil: CoilID, state: UD3State) {
    ud3States.set(coil, state);
}

export function updateStateFromTelemetry(coil: CoilID, packedData: number) {
    const busActive = (packedData & 1) !== 0;
    const transientActive = (packedData & 2) !== 0;
    const busControllable = (packedData & 4) !== 0;
    const killBitSet = (packedData & 8) !== 0;
    const isQCW = (packedData & 16) !== 0;
    const state = new UD3State(busActive, busControllable, transientActive, killBitSet, isQCW);
    setUD3State(coil, state);
    ipcs.coilMenu(coil).setUD3State(state);
}
