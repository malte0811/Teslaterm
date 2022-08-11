import {BoolOptionCommand, NumberOptionCommand} from "../command/CommandMessages";
import {commandServer} from "../init";
import {getAutoTerminal, getUD3Connection, hasUD3Connection} from "./connection";

export class CommandInterface {
    public async stop() {
        await this.sendCommand('tterm stop\rcls\r');
    }

    public async startTelemetry() {
        await this.sendCommand('tterm start alarm\r');
    }

    public async busOff() {
        await this.sendCommand('bus off\r');
        commandServer.setBoolOption(BoolOptionCommand.bus, false);
    }

    public async busOn() {
        await this.sendCommand('bus on\r');
        commandServer.setBoolOption(BoolOptionCommand.bus, true);
    }

    public async eepromSave() {
        await this.sendCommand('eeprom save\r');
    }

    public async setKill() {
        await this.sendCommand('kill set\r');
        commandServer.setBoolOption(BoolOptionCommand.kill, true);
    }

    public async resetKill() {
        await this.sendCommand('kill reset\r');
        commandServer.setBoolOption(BoolOptionCommand.kill, false);
    }

    public async setOntime(ontime: number) {
        await this.setParam('pw', ontime.toFixed(0));
    }

    public async setBurstOntime(ontime: number) {
        await this.setParam('bon', ontime.toFixed(0));
        commandServer.setNumberOption(NumberOptionCommand.burst_on, ontime);
    }

    public async setBurstOfftime(offtime: number) {
        await this.setParam('boff', offtime.toFixed(0));
        commandServer.setNumberOption(NumberOptionCommand.burst_off, offtime);
    }

    public async setOfftime(offtime: number) {
        await this.setParam('pwd', offtime.toFixed(0));
        commandServer.setNumberOption(NumberOptionCommand.offtime, offtime);
    }

    public async setBPS(bps: number) {
        const pwd = Math.floor(1000000 / bps);
        await this.setOfftime(Number(pwd));
    }

    public async setParam(param: string, value: string) {
        await this.sendCommand('set ' + param + ' ' + value + '\r');
    }

    public async setTransientEnabled(enable: boolean) {
        await this.sendCommand('tr ' + (enable ? 'start' : 'stop') + '\r');
        commandServer.setBoolOption(BoolOptionCommand.transient, enable);
    }

    public async sendCommand(c: string) {
        try {
            if (hasUD3Connection()) {
                await getUD3Connection().sendTelnet(Buffer.from(c), getAutoTerminal());
            }
        } catch (x) {
            console.log("Error while sending: ", x);
        }
    }
}
