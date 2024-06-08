import {CoilID, FEATURE_PROTOCOL_VERSION, FEATURE_TIMEBASE, FEATURE_TIMECOUNT} from "../../../common/constants";
import {MediaFileType, SynthType, synthTypeFor} from "../../../common/MediaTypes";
import {Endianness, to_ud3_time, withTimeout} from "../../helper";
import {config} from "../../init";
import {ISidConnection} from "../../sid/ISidConnection";
import {getCoilCommands} from "../connection";

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

export enum TerminalHandle {
    automatic,
    manual,
}

export interface TerminalData {
    readonly callback: (data: Buffer) => void;
}

export abstract class UD3Connection {
    // TODO simplify a bit?
    protected terminalCallbacks: Map<TerminalHandle, TerminalData> = new Map<TerminalHandle, TerminalData>();
    protected lastSynthType: SynthType = SynthType.NONE;
    private readonly coil: CoilID;

    constructor(coil: CoilID) {
        this.coil = coil;
    }

    public abstract sendTelnet(data: Buffer, handle: TerminalHandle): Promise<void>;

    public abstract sendMidi(data: Buffer): Promise<void>;

    public abstract sendVMSFrame(frames: Buffer): Promise<void>;

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

    public abstract getUDName(): string | undefined;

    public getCoil() {
        return this.coil;
    }

    public commands() {
        return getCoilCommands(this.getCoil());
    }

    public async startTerminal(id: TerminalHandle, dataCallback: (data: Buffer) => void) {
        this.terminalCallbacks.set(id, {callback: dataCallback});
    }

    public async closeTerminal(handle: TerminalHandle): Promise<void> {
        this.terminalCallbacks.delete(handle);
    }

    public getFeatureValue(feature: string): string {
        return config.defaultUDFeatures.get(feature);
    }

    public getProtocolVersion() {
        return Number.parseFloat(this.getFeatureValue(FEATURE_PROTOCOL_VERSION));
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

    public clearLastSynth() {
        this.lastSynthType = undefined;
    }

    protected abstract setSynthImpl(type: SynthType): Promise<void>;
}
