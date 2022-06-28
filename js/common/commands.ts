import {MediaFileType, SynthType} from "./CommonTypes";

export const maxOntime = 400;
export const maxBPS = 1000;
export const maxBurstOntime = 1000;
export const maxBurstOfftime = 1000;

export class CommandInterface {
    public readonly sendCommand: (c: string) => Promise<void>;
    public readonly setRelativeOntime: (value: number) => void;
    private readonly preClear: () => void;

    constructor(
        sendCommand: (c: string) => Promise<void>,
        preClear: () => void,
        setRelativeOntime: (value: number) => void,
    ) {
        this.sendCommand = sendCommand;
        this.preClear = preClear;
        this.setRelativeOntime = setRelativeOntime;
    }

    public async clear() {
        this.preClear();
        await this.sendCommand('cls\r');
    }

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

    public async eepromLoad() {
        await this.sendCommand('eeprom load\r');
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

    public async setOntimeRelative(ontime: number) {
        await this.sendCommand('set pwp ' + ontime.toFixed(1) + '\r');
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
}
