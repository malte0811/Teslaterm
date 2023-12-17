import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil} from "../../common/IPCConstantsToMain";
import {getToRenderIPCPerCoil, ISliderState} from "../../common/IPCConstantsToRenderer";
import {CommandRole} from "../../common/Options";
import {NumberOptionCommand} from "../command/CommandMessages";
import {CommandInterface} from "../connection/commands";
import {getCoilCommands, getConnectionState} from "../connection/connection";
import {MultiWindowIPC} from "./IPCProvider";

export class SliderState implements ISliderState {
    public ontimeAbs: number;
    public ontimeRel: number;
    public bps: number = 20;
    public burstOntime: number = 500;
    public burstOfftime: number = 0;
    public onlyMaxOntimeSettable: boolean = true;
    public maxOntime: number = 400;
    public maxBPS: number = 1000;
    public startAtRelativeOntime: boolean;

    constructor(role: CommandRole) {
        this.ontimeAbs = role !== "disable" ? this.maxOntime : 0;
        this.ontimeRel = role !== "disable" ? 0 : 100;
        this.onlyMaxOntimeSettable = role === "client";
        this.startAtRelativeOntime = role === "server";
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
    private state = new SliderState('disable');
    private readonly processIPC: MultiWindowIPC;
    private readonly coil: CoilID;
    private readonly commands: CommandInterface;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        const channels = getToMainIPCPerCoil(coil);
        processIPC.on(channels.sliders.setOntimeAbsolute, this.callSwapped(this.setAbsoluteOntime));
        processIPC.on(channels.sliders.setOntimeRelative, this.callSwapped(this.setRelativeOntime));
        processIPC.on(channels.sliders.setBPS, this.callSwapped(this.setBPS));
        processIPC.on(channels.sliders.setBurstOntime, this.callSwapped(this.setBurstOntime));
        processIPC.on(channels.sliders.setBurstOfftime, this.callSwapped(this.setBurstOfftime));
        this.processIPC = processIPC;
        this.coil = coil;
        this.commands = getCoilCommands(coil);
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

    public async setAbsoluteOntime(val: number) {
        this.state.ontimeAbs = val;
        await this.commands.setOntime(this.state.ontime);
        this.sendSliderSync();
    }

    public async setRelativeOntime(val: number) {
        this.state.ontimeRel = val;
        await this.commands.setOntime(this.state.ontime);
        getConnectionState(this.coil).getCommandServer().setNumberOption(NumberOptionCommand.relative_ontime, val);
        this.sendSliderSync();
    }

    public async setBPS(val: number) {
        this.state.bps = val;
        await this.commands.setBPS(val);
        this.sendSliderSync();
    }

    public async setBurstOntime(val: number) {
        this.state.burstOntime = val;
        await this.commands.setBurstOntime(val);
        this.sendSliderSync();
    }

    public async setBurstOfftime(val: number) {
        this.state.burstOfftime = val;
        await this.commands.setBurstOfftime(val);
        this.sendSliderSync();
    }

    public setOnlyMaxOntimeSettable(allowed: boolean) {
        this.state.onlyMaxOntimeSettable = allowed;
        this.sendSliderSync();
    }

    public async setSliderRanges(maxOntime: number, maxBPS: number) {
        const oldOntime = this.state.ontime;
        if (this.state.updateRanges(maxOntime, maxBPS)) {
            this.sendSliderSync();
        }
        // The UD3 also adjusts the ontime if it exceeds the new maximum, but with relative ontime we may want to
        // decrease to a lower level than the UD3 did
        if (oldOntime !== this.state.ontime) {
            await this.commands.setOntime(this.state.ontime);
        }
    }

    public sendSliderSync() {
        this.processIPC.sendToAll(getToRenderIPCPerCoil(this.coil).sliders.syncSettings, this.state);
    }

    public reinitState(role: CommandRole) {
        this.state = new SliderState(role);
        this.sendSliderSync();
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
