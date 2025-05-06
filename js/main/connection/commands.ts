import {CoilID} from "../../common/constants";
import {getConnectionState, getOptionalUD3Connection} from "./connection";
import {TerminalHandle} from "./types/UD3Connection";

export class CommandInterface {
    private readonly coil: CoilID;

    public constructor(coil: CoilID) {
        this.coil = coil;
    }

    public async stop() {
        await this.sendCommand('tterm stop\rcls\r');
    }

    public async startTelemetry() {
        await this.sendCommand('tterm start alarm\r');
    }

    public async busOff() {
        await this.sendCommand('bus off\r');
    }

    public async busOn() {
        await this.sendCommand('bus on\r');
    }

    public async eepromSave() {
        await this.sendCommand('eeprom save\r');
    }

    public async setKill() {
        await this.sendCommand('kill set\r');
    }

    public async resetKill() {
        await this.sendCommand('kill reset\r');
    }

    public async setOntime(ontime: number) {
        await this.setParam('pw', ontime.toFixed(0));
    }

    public async setBurstOntime(ontime: number) {
        await this.setParam('bon', ontime.toFixed(0));
    }

    public async setBurstOfftime(offtime: number) {
        await this.setParam('boff', offtime.toFixed(0));
    }

    public async setBPS(bps: number) {
        const pwd = Math.floor(1000000 / bps);
        await this.setParam('pwd', pwd.toFixed(0));
    }

    public async setParam(param: string, value: string) {
        await this.sendCommand('set ' + param + ' ' + value + '\r');
    }

    public async setTransientEnabled(enable: boolean) {
        getOptionalUD3Connection(this.coil)?.clearLastSynth();
        await this.sendCommand('tr ' + (enable ? 'start' : 'stop') + '\r');
    }

    public async sendCommand(c: string) {
        try {
            await getOptionalUD3Connection(this.coil)?.sendTelnet(Buffer.from(c), TerminalHandle.automatic);
        } catch (x) {
            console.log("Error while sending: ", x);
        }
    }

    private get connectionState() {
        return getConnectionState(this.coil);
    }
}
