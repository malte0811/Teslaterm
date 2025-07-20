import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, SimpleQCWPulseKey} from "../../common/IPCConstantsToMain";
import {getCoilCommands} from "../connection/connection";
import {TemporaryIPC} from "./TemporaryIPC";

export class QCWIPC {
    constructor(processIPC: TemporaryIPC, coil: CoilID) {
        const ipcs = getToMainIPCPerCoil(coil).qcw;
        const startWithRepeat = async (repeatMS: number) => {
            await getCoilCommands(coil).setQCWRepeat(repeatMS);
            await getCoilCommands(coil).startQCW();
        };
        processIPC.onAsync(ipcs.stop, async () => await getCoilCommands(coil).stopQCW());
        processIPC.onAsync(ipcs.start, async (start) => await startWithRepeat(start.repeat));
        processIPC.onAsync(ipcs.setRepeat, async (value) => await getCoilCommands(coil).setQCWRepeat(value));
        processIPC.onAsync(ipcs.singleShot, async () => await startWithRepeat(0));
        processIPC.onAsync(
            ipcs.setSimplePulseProp,
            async ({key, value}) => await getCoilCommands(coil).setParam(this.getParameter(key), value.toFixed(2)),
        );
    }

    private getParameter(key: SimpleQCWPulseKey) {
        switch (key) {
            case "pulseWidth":
                return 'qcw_pw';
            case "slope":
                return 'qcw_ramp';
            case "initialValue":
                return 'qcw_offset';
            case "initialTime":
                return 'qcw_hold';
            case "maxValue":
                return 'qcw_max';
            case "modulationFreq":
                return 'qcw_freq';
            case "modulationAmplitude":
                return 'qcw_vol';
            default:
                key satisfies never;
        }
        // All keys have been handled
    }
}
