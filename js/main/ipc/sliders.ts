import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {getToRenderIPCPerCoil} from "../../common/IPCConstantsToRenderer";
import {CommandInterface} from "../connection/commands";
import {
    forEachCoilAsync,
    getCoilCommands,
} from "../connection/connection";
import {ipcs, MultiWindowIPC} from "./IPCProvider";

let relativeOntime: number = 0;

export async function setRelativeOntime(newRelative: number) {
    relativeOntime = newRelative;
    await forEachCoilAsync(async (coil) => {
        const coilIPC = ipcs.sliders(coil);
        coilIPC.sendSliderSync();
        await getCoilCommands(coil).setOntime(coilIPC.ontime);
    });
}

export class SliderState {
    public ontimeAbs: number;
    public bps: number = 20;
    public burstOntime: number = 500;
    public burstOfftime: number = 0;
    public onlyMaxOntimeSettable: boolean = false;
    public maxOntime: number = 400;
    public maxBPS: number = 1000;

    constructor(multicoil: boolean) {
        this.ontimeAbs = multicoil ? this.maxOntime : 0;
    }

    public get ontime() {
        return this.ontimeAbs * relativeOntime / 100;
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
    private state: SliderState;
    private readonly processIPC: MultiWindowIPC;
    private readonly coil: CoilID;
    private readonly commands: CommandInterface;
    private multicoil: boolean;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        this.reinitState(false);
        const channels = getToMainIPCPerCoil(coil);
        processIPC.on(channels.sliders.setOntimeAbsolute, this.callSwapped(this.setAbsoluteOntime));
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

    public get ontime() {
        return this.state.ontime;
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

    public async resetOntimeOnConnect() {
        await this.setAbsoluteOntime(this.multicoil ? this.state.ontimeAbs : 0);
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
        if (this.processIPC) {
            this.processIPC.sendToAll(
                getToRenderIPCPerCoil(this.coil).sliders.syncSettings,
                {...this.state, ontimeRel: relativeOntime},
            );
        }
    }

    public reinitState(multicoil: boolean) {
        this.state = new SliderState(multicoil);
        this.multicoil = multicoil;
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

export function registerCommonSliderIPC(processIPC: MultiWindowIPC) {
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setBPS, (c) => c.sliders.setBPS);
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOfftime, (c) => c.sliders.setBurstOfftime);
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOntime, (c) => c.sliders.setBurstOntime);
    processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.sliders.setOntimeRelative, (c, val) => setRelativeOntime(val));
}
