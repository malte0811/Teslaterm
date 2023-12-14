import {CoilID} from "../../common/constants";
import {BoolOptionCommand, NumberOptionCommand} from "../command/CommandMessages";
import {getAutoTerminal, getConnectionState, getUD3Connection, hasUD3Connection} from "./connection";

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
        this.connectionState.getCommandServer().setBoolOption(BoolOptionCommand.bus, false);
    }

    public async busOn() {
        await this.sendCommand('bus on\r');
        this.connectionState.getCommandServer().setBoolOption(BoolOptionCommand.bus, true);
    }

    public async eepromSave() {
        await this.sendCommand('eeprom save\r');
    }

    public async setKill() {
        await this.sendCommand('kill set\r');
        this.connectionState.getCommandServer().setBoolOption(BoolOptionCommand.kill, true);
    }

    public async resetKill() {
        await this.sendCommand('kill reset\r');
        this.connectionState.getCommandServer().setBoolOption(BoolOptionCommand.kill, false);
    }

    public async setOntime(ontime: number) {
        await this.setParam('pw', ontime.toFixed(0));
    }

    public async setBurstOntime(ontime: number) {
        await this.setParam('bon', ontime.toFixed(0));
        this.connectionState.getCommandServer().setNumberOption(NumberOptionCommand.burst_on, ontime);
    }

    public async setBurstOfftime(offtime: number) {
        await this.setParam('boff', offtime.toFixed(0));
        this.connectionState.getCommandServer().setNumberOption(NumberOptionCommand.burst_off, offtime);
    }

    public async setBPS(bps: number) {
        const pwd = Math.floor(1000000 / bps);
        await this.setParam('pwd', pwd.toFixed(0));
        this.connectionState.getCommandServer().setNumberOption(NumberOptionCommand.bps, bps);
    }

    public async setParam(param: string, value: string) {
        await this.sendCommand('set ' + param + ' ' + value + '\r');
    }

    public async setTransientEnabled(enable: boolean) {
        await this.sendCommand('tr ' + (enable ? 'start' : 'stop') + '\r');
        this.connectionState.getCommandServer().setBoolOption(BoolOptionCommand.transient, enable);
    }

    public async sendCommand(c: string) {
        try {
            if (hasUD3Connection(this.coil)) {
                await getUD3Connection(this.coil).sendTelnet(Buffer.from(c), getAutoTerminal(this.coil));
            }
        } catch (x) {
            console.log("Error while sending: ", x);
        }
    }

    private get connectionState() {
        return getConnectionState(this.coil);
    }
}
