import {MediaFileType, SynthType, synthTypeFor} from "../../../common/MediaTypes";
import {FEATURE_TIMEBASE, FEATURE_TIMECOUNT} from "../../../common/constants";
import {Endianness, to_ud3_time, withTimeout} from "../../helper";
import {config} from "../../init";
import {ipcs} from "../../ipc/IPCProvider";
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
    protected lastSynthType: SynthType = SynthType.NONE;

    public abstract sendTelnet(data: Buffer, handle: TerminalHandle): Promise<void>;

    public abstract sendMidi(data: Buffer): Promise<void>;

    public abstract sendVMSFrames(data: Buffer);

    public abstract getSidConnection(): ISidConnection;

    public abstract connect(): Promise<void>;

    public async disconnect() {
        try {
            await withTimeout(this.sendDisconnectData(), 500, "Disconnect data");
        } catch (e) {
            console.log("While disconnecting: ", e);
        }
        try {
            this.releaseResources();
        } catch (e) {
            console.log("While releasing connection resources: ", e);
        }
    }

    public abstract sendDisconnectData(): Promise<void>;

    public abstract releaseResources(): void;

    public abstract resetWatchdog(): void;

    public abstract tick(): void;

    public abstract getMaxTerminalID(): number;

    public abstract isMultiTerminal(): boolean;

    public setupNewTerminal(dataCallback: (data: Buffer) => void): TerminalHandle | undefined {
        for (let i = 0; !this.isMultiTerminal() || i < this.getMaxTerminalID(); ++i) {
            if (!this.terminalCallbacks.has(i)) {
                this.terminalCallbacks.set(i, new TerminalData(dataCallback));
                return i;
            }
        }
        return undefined;
    }

    public async startTerminal(handle: TerminalHandle): Promise<void> {
        if (!this.terminalCallbacks.has(handle)) {
            throw new Error("Trying to connect start terminal that has not been set up yet");
        }
        if (this.terminalCallbacks.get(handle).active) {
            throw new Error("Trying to connect start terminal that is already active");
        }
        this.terminalCallbacks.get(handle).active = true;
    }

    public async closeTerminal(handle: TerminalHandle): Promise<void> {
        this.terminalCallbacks.delete(handle);
        await ipcs.terminal.onSlotsAvailable(false);
    }

    public getFeatureValue(feature: string): string {
        return config.defaultUDFeatures.get(feature);
    }

    public toUD3Time(now: number) {
        const timebase = Number(this.getFeatureValue(FEATURE_TIMEBASE));
        const direction = this.getFeatureValue(FEATURE_TIMECOUNT);
        if (direction === "up" || direction === "down") {
            return to_ud3_time(now, timebase, direction, Endianness.BIG_ENDIAN);
        } else {
            return to_ud3_time(now, timebase, "down", Endianness.BIG_ENDIAN);
        }
    }

    public async setSynthByFiletype(type: MediaFileType, onlyIfMismatched: boolean) {
        await this.setSynth(synthTypeFor(type), onlyIfMismatched);
    }

    public async setSynth(type: SynthType, onlyIfMismatched: boolean): Promise<boolean> {
        if (!onlyIfMismatched || type !== this.lastSynthType) {
            await this.setSynthImpl(type);
            this.lastSynthType = type;
            return true;
        } else {
            return false;
        }
    }

    protected abstract setSynthImpl(type: SynthType): Promise<void>;
}
