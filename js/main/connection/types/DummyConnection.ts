import {SynthType} from "../../../common/CommonTypes";
import {commandServer} from "../../init";
import {ISidConnection} from "../../sid/ISidConnection";
import {SidFrame} from "../../sid/sid_api";
import {UD3FormattedConnection} from "../../sid/UD3FormattedConnection";
import {resetResponseTimeout} from "../state/Connected";
import {TerminalHandle, UD3Connection} from "./UD3Connection";

export class DummyConnection extends UD3Connection {
    private readonly sidConnection = new UD3FormattedConnection(() => Promise.resolve(), ($) => Promise.resolve());

    public connect(): Promise<void> {
        return Promise.resolve(undefined);
    }

    public async sendDisconnectData() {}

    public releaseResources() {}

    public getMaxTerminalID(): number {
        return 3;
    }

    public getSidConnection(): ISidConnection {
        return this.sidConnection;
    }

    public isMultiTerminal(): boolean {
        return true;
    }

    public resetWatchdog(): void {
    }

    public sendMidi(data: Buffer): Promise<void> {
        return Promise.resolve(undefined);
    }

    public sendTelnet(data: Buffer, handle: TerminalHandle): Promise<void> {
        return Promise.resolve(undefined);
    }

    public tick(): void {
        resetResponseTimeout();
    }

    public sendVMSFrames(data: Buffer) {
    }

    protected setSynthImpl(type: SynthType): Promise<void> {
        return Promise.resolve(undefined);
    }
}
