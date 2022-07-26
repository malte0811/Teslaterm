import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, ISliderState} from "../../common/IPCConstantsToRenderer";
import {CommandRole} from "../../common/TTConfig";
import {NumberOptionCommand} from "../command/CommandMessages";
import {commands} from "../connection/connection";
import {commandServer, config} from "../init";
import {MultiWindowIPC} from "./IPCProvider";

export class SliderState implements ISliderState {
    public ontimeAbs: number;
    public ontimeRel: number;
    public bps: number = 20;
    public burstOntime: number = 500;
    public burstOfftime: number = 0;
    public relativeAllowed: boolean = true;
    public maxOntime: number = 400;
    public maxBPS: number = 1000;

    constructor(role: CommandRole) {
        this.ontimeAbs = role !== "disable" ? this.maxOntime : 0;
        this.ontimeRel = role !== "disable" ? 0 : 100;
        this.relativeAllowed = role !== "client";
    }

    public get ontime() {
        return this.ontimeAbs * this.ontimeRel / 100;
    }

    public updateRanges(maxOntime: number, maxBPS: number): boolean {
        let changed = false;
        if (maxOntime !== this.maxOntime) {
            // First case: We had full range using the relative slider, we want to keep that
            // Second case: Current ontime becomes illegal, clamp to new max (i.e. closest to old value we can get)
            if (this.ontimeAbs === this.maxOntime || this.ontimeAbs > maxOntime) {
                this.ontimeAbs = maxOntime;
            }
            this.maxOntime = maxOntime;
            changed = true;
        }
        if (maxBPS !== this.maxBPS) {
            if (this.bps > maxBPS) {
                this.bps = maxBPS;
            }
            this.maxBPS = maxBPS;
            changed = true;
        }
        return changed;
    }
}

export class SlidersIPC {
    private readonly state = new SliderState(config.command.state);
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        processIPC.on(IPC_CONSTANTS_TO_MAIN.sliders.setOntimeAbsolute, this.callSwapped(this.setAbsoluteOntime));
        processIPC.on(IPC_CONSTANTS_TO_MAIN.sliders.setOntimeRelative, this.callSwapped(this.setRelativeOntime));
        processIPC.on(IPC_CONSTANTS_TO_MAIN.sliders.setBPS, this.callSwapped(this.setBPS));
        processIPC.on(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOntime, this.callSwapped(this.setBurstOntime));
        processIPC.on(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOfftime, this.callSwapped(this.setBurstOfftime));
        this.processIPC = processIPC;
    }

    public get bps() {
        return this.state.bps;
    }

    public get burstOntime() {
        return this.state.burstOntime;
    }

    public get burstOfftime() {
        return this.state.burstOfftime;
    }

    public async setAbsoluteOntime(val: number, key?: object) {
        this.state.ontimeAbs = val;
        await commands.setOntime(this.state.ontime);
        this.sendSliderSync(key);
    }

    public async setRelativeOntime(val: number, key?: object) {
        this.state.ontimeRel = val;
        await commands.setOntime(this.state.ontime);
        commandServer.setNumberOption(NumberOptionCommand.relative_ontime, val);
        this.sendSliderSync(key);
    }

    public async setBPS(val: number, key?: object) {
        this.state.bps = val;
        await commands.setBPS(val);
        this.sendSliderSync(key);
    }

    public async setBurstOntime(val: number, key?: object) {
        this.state.burstOntime = val;
        await commands.setBurstOntime(val);
        this.sendSliderSync(key);
    }

    public async setBurstOfftime(val: number, key?: object) {
        this.state.burstOfftime = val;
        await commands.setBurstOfftime(val);
        this.sendSliderSync(key);
    }

    public setRelativeAllowed(allowed: boolean, key?: object) {
        this.state.relativeAllowed = allowed;
        this.sendSliderSync(key);
    }

    public async setSliderRanges(maxOntime: number, maxBPS: number) {
        const oldOntime = this.state.ontime;
        if (this.state.updateRanges(maxOntime, maxBPS)) {
            this.sendSliderSync();
        }
        // The UD3 also adjusts the ontime if it exceeds the new maximum, but with relative ontime we may want to
        // decrease to a lower level than the UD3 did
        if (oldOntime !== this.state.ontime) {
            await commands.setOntime(this.state.ontime);
        }
    }

    public sendSliderSync(excluded?: object) {
        this.processIPC.sendToAllExcept(IPC_CONSTANTS_TO_RENDERER.sliders.syncSettings, excluded, this.state);
    }

    private callSwapped(f: (val: number, key: object) => Promise<any>) {
        return async (key: object, val: number) => {
            try {
                await f.call(this, val, key);
            } catch (r) {
                console.log("Error while sending command: ", r);
            }
        };
    }
}
