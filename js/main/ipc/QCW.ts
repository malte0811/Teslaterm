import {CoilID} from "../../common/constants";
import {
    getToMainIPCPerCoil,
    makeDefaultSimplePulse,
    SimpleQCWPulse,
    SimpleQCWPulseKey,
} from "../../common/IPCConstantsToMain";
import {getToRenderIPCPerCoil, PerCoilRenderIPCs} from "../../common/IPCConstantsToRenderer";
import {getCoilCommands} from "../connection/connection";
import {TemporaryIPC} from "./TemporaryIPC";

export class QCWIPC {
    // TODO reset PW on reconnect like for TR
    private readonly processIPC: TemporaryIPC;
    private readonly simplePulse: SimpleQCWPulse = makeDefaultSimplePulse();
    private currentRamp: number[] = undefined;
    private readonly coil: CoilID;
    private readonly renderIPCs: PerCoilRenderIPCs;

    constructor(processIPC: TemporaryIPC, coil: CoilID) {
        this.processIPC = processIPC;
        this.coil = coil;
        this.renderIPCs = getToRenderIPCPerCoil(coil);
        const coilIPCs = getToMainIPCPerCoil(coil).qcw;
        const startWithRepeat = async (repeatMS: number) => {
            await getCoilCommands(coil).setQCWRepeat(repeatMS);
            await getCoilCommands(coil).startQCW();
        };
        processIPC.onAsync(coilIPCs.stop, async () => await getCoilCommands(coil).stopQCW());
        processIPC.onAsync(coilIPCs.start, async (start) => await startWithRepeat(start.repeat));
        processIPC.onAsync(coilIPCs.setRepeat, async (value) => await getCoilCommands(coil).setQCWRepeat(value));
        processIPC.onAsync(coilIPCs.singleShot, async () => await startWithRepeat(0));
        processIPC.onAsync(coilIPCs.setSimplePulseProp, async ({key, value}) => {
            this.simplePulse[key] = value;
            await this.setParameterFromMap(key);
        });
    }

    public async syncAllParameters() {
        for (const key in this.simplePulse) {
            if (key !== 'type') {
                await this.setParameterFromMap(key as SimpleQCWPulseKey);
            }
        }
    }

    public async receiveRampFromCoil(expectedPosition: number, isLast: boolean, rampPoints: number[]) {
        if (expectedPosition === 0) {
            this.currentRamp = [];
        }
        if (this.currentRamp !== undefined && expectedPosition === this.currentRamp.length) {
            this.currentRamp.push(...rampPoints);
            if (isLast) {
                this.sendQCWRamp();
            }
        }
    }

    public sendQCWRamp() {
        this.processIPC.send(this.renderIPCs.qcwRamp, this.currentRamp);
    }

    private async setParameterFromMap(key: SimpleQCWPulseKey) {
        await getCoilCommands(this.coil).setParam(this.getParameter(key), this.simplePulse[key].toFixed(2));
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
        }
        // All keys have been handled
        key satisfies never;
    }
}
