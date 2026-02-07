import {CoilID} from "../../../common/constants";
import {DEFAULT_UD3_STATE, UD3State} from "../../../common/IPCConstantsToRenderer";
import {ipcs} from "../../ipc/IPCProvider";

const ud3States: Map<CoilID, UD3State> = new Map<CoilID, UD3State>();

export function getUD3State(coil: CoilID) {
    if (!ud3States.has(coil)) {
        setUD3State(coil, DEFAULT_UD3_STATE);
    }
    return ud3States.get(coil);
}

export function setUD3State(coil: CoilID, state: UD3State) {
    ud3States.set(coil, state);
}

export function updateStateFromTelemetry(coil: CoilID, packedData: number) {
    const state: UD3State = {
        busActive: (packedData & 1) !== 0,
        busControllable: (packedData & 4) !== 0,
        isQCW: (packedData & 16) !== 0,
        killBitSet: (packedData & 8) !== 0,
        transientActive: (packedData & 2) !== 0,
    };
    setUD3State(coil, state);
    ipcs.coilMenu(coil).setUD3State(state);
}
