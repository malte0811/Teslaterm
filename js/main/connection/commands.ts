import {commandServer} from "../init";
import {getAutoTerminal, getUD3Connection, hasUD3Connection} from "./connection";

export class CommandInterface {
    public async stop() {
        await this.sendCommand('tterm stop\rcls\r');
    }

    public async startTelemetry() {
        await this.sendCommand('tterm start\r');
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
        await this.sendCommand('set pw ' + ontime.toFixed(0) + '\r');
    }

    public async setBurstOntime(ontime: number) {
        await this.sendCommand('set bon ' + ontime.toFixed(0) + '\r');
    }

    public async setBurstOfftime(offtime: number) {
        await this.sendCommand('set boff ' + offtime.toFixed(0) + '\r');
    }

    public async setOfftime(offtime: number) {
        await this.sendCommand('set pwd ' + offtime.toFixed(0) + '\r');
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
    }

    public async sendCommand(c: string) {
        try {
            if (commandServer) {
                // TODO remote and replace by command-specific transmissions
                commandServer.sendTelnet(Buffer.from(c));
            }
            if (hasUD3Connection()) {
                await getUD3Connection().sendTelnet(Buffer.from(c), getAutoTerminal());
            }
        } catch (x) {
            console.log("Error while sending: ", x);
        }
    }
}
