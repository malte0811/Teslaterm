import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN, IPCToMainKey} from "../../common/IPCConstantsToMain";
import {getToRenderIPCPerCoil} from "../../common/IPCConstantsToRenderer";
import {CommandInterface} from "../connection/commands";
import {
    forEachCoilAsync,
    getCoilCommands,
} from "../connection/connection";
import {ipcs, MainIPC} from "./IPCProvider";
import {TemporaryIPC} from "./TemporaryIPC";

let relativeOntime: number = 0;

export async function setRelativeOntime(newRelative: number) {
    relativeOntime = newRelative;
    await forEachCoilAsync(async (coil) => {
        const coilIPC = ipcs.sliders(coil);
        coilIPC.sendSliderSync();
        coilIPC.scheduleOntimeUpdate();
    });
}

export class SliderState {
    public ontimeAbs: number;
    public volumeFraction: number = 1;
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
    private readonly processIPC: TemporaryIPC;
    private readonly coil: CoilID;
    private readonly commands: CommandInterface;
    private multicoil: boolean;
    private readonly delayedCommands = new Map<string, () => any>();

    constructor(processIPC: TemporaryIPC, coil: CoilID) {
        this.reinitState(false);
        this.processIPC = processIPC;
        this.coil = coil;
        this.commands = getCoilCommands(coil);
        const channels = getToMainIPCPerCoil(coil);
        this.addDelayedListener(channels.sliders.setOntimeAbsolute, (ot) => this.setAbsoluteOntime(ot));
        this.addDelayedListener(channels.sliders.setVolumeFraction, (vol) => this.setVolume(vol));
        this.addDelayedListener(channels.sliders.setBPS, (bps) => this.setBPS(bps));
        this.addDelayedListener(channels.sliders.setBurstOntime, (bon) => this.setBurstOntime(bon));
        this.addDelayedListener(channels.sliders.setBurstOfftime, (boff) => this.setBurstOfftime(boff));
    }

    public tick100() {
        for (const setter of this.delayedCommands.values()) {
            setter();
        }
        this.delayedCommands.clear();
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

    public async setVolume(volumeFraction: number) {
        this.state.volumeFraction = volumeFraction;
        await this.commands.setVolumeFraction(this.state.volumeFraction);
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
            this.processIPC.send(
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

    public scheduleOntimeUpdate() {
        this.delayedCommands.set('ontimeUpdate', () => this.commands.setOntime(this.state.ontime));
    }

    private addDelayedListener(key: IPCToMainKey<number>, run: (value: number) => any) {
        this.processIPC.on(
            key, (value) => this.delayedCommands.set(key.channel, () => run(value)),
        );
    }
}

export function registerCommonSliderIPC(processIPC: MainIPC) {
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setBPS, (c) => c.sliders.setBPS);
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOfftime, (c) => c.sliders.setBurstOfftime);
    processIPC.distributeTo(IPC_CONSTANTS_TO_MAIN.sliders.setBurstOntime, (c) => c.sliders.setBurstOntime);
    processIPC.onAsync(IPC_CONSTANTS_TO_MAIN.sliders.setOntimeRelative, (val) => setRelativeOntime(val));
}
