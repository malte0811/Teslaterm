import {SynthType} from "../../../common/CommonTypes";
import {FEATURE_TIMEBASE, FEATURE_TIMECOUNT} from "../../../common/constants";
import {Endianness, to_ud3_time} from "../../helper";
import {config} from "../../init";
import {TerminalIPC} from "../../ipc/terminal";
import {ISidConnection} from "../../sid/ISidConnection";

export function toCommandID(type: SynthType): number {
    switch (type) {
        case SynthType.NONE:
            return 0;
        case SynthType.MIDI:
            return 1;
        case SynthType.SID:
            return 2;
    }
    throw new Error("Unknown synth type: " + type);
}

export type TerminalHandle = number;

export class TerminalData {
    public readonly callback: (data: Buffer) => void;
    public active: boolean = false;

    constructor(callback: (data: Buffer) => void) {
        this.callback = callback;
    }
}

export abstract class UD3Connection {
    protected terminalCallbacks: Map<TerminalHandle, TerminalData> = new Map<TerminalHandle, TerminalData>();

    abstract sendTelnet(data: Buffer, handle: TerminalHandle): Promise<void>;

    abstract sendMidi(data: Buffer): Promise<void>;

    abstract getSidConnection(): ISidConnection;

    abstract connect(): Promise<void>;

    abstract disconnect(): void;

    abstract resetWatchdog(): void;

    abstract tick(): void;

    abstract setSynth(type: SynthType): Promise<void>;

    abstract getMaxTerminalID(): number;

    abstract isMultiTerminal(): boolean;

    public setupNewTerminal(dataCallback: (data: Buffer) => void): TerminalHandle | undefined {
        for (let i = 0; !this.isMultiTerminal() || i < this.getMaxTerminalID(); ++i) {
            if (!this.terminalCallbacks.has(i)) {
                this.terminalCallbacks.set(i, new TerminalData(dataCallback));
                return i;
            }
        }
        return undefined;
    }

    async startTerminal(handle: TerminalHandle): Promise<void> {
        if (!this.terminalCallbacks.has(handle)) {
            throw new Error("Trying to connect start terminal that has not been set up yet");
        }
        if (this.terminalCallbacks.get(handle).active) {
            throw new Error("Trying to connect start terminal that is already active");
        }
        this.terminalCallbacks.get(handle).active = true;
    }

    async closeTerminal(handle: TerminalHandle): Promise<void> {
        this.terminalCallbacks.delete(handle);
        await TerminalIPC.onSlotsAvailable(false);
    }

    public getFeatureValue(feature: string): string {
        return config.defaultUDFeatures.get(feature);
    }

    public toUD3Time(now: number) {
        const timebase = Number(this.getFeatureValue(FEATURE_TIMEBASE));
        let direction = this.getFeatureValue(FEATURE_TIMECOUNT);
        if (direction === "up" || direction === "down") {
            return to_ud3_time(now, timebase, direction, Endianness.BIG_ENDIAN);
        } else {
            return to_ud3_time(now, timebase, "down", Endianness.BIG_ENDIAN);
        }
    }
}
