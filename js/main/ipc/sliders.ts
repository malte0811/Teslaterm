import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, SliderState} from "../../common/IPCConstantsToRenderer";
import {commands} from "../connection/connection";
import {MultiWindowIPC} from "./IPCProvider";

export class SlidersIPC {
    private readonly state = new SliderState();
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

    public sendSliderSync(connection?: object) {
        this.processIPC.sendToAllExcept(IPC_CONSTANTS_TO_RENDERER.sliders.syncSettings, connection, this.state);
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
