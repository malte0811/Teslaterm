import {ipcs} from "../../ipc/IPCProvider";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {Connecting} from "./Connecting";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";

export class Reconnecting implements IConnectionState {
    private static readonly MAX_RETRIES = 5;
    private static readonly TICKS_BETWEEN_RETRIES = 100;
    private ticksSinceLastFailure: number = 0;
    private failedAttempts: number = 0;
    private readonly connectionToReestablish: UD3Connection;

    public constructor(connection: UD3Connection) {
        this.connectionToReestablish = connection;
    }

    getActiveConnection(): UD3Connection | undefined {
        return undefined;
    }

    public getAutoTerminal(): TerminalHandle | undefined {
        return undefined;
    }

    getButtonText(): string {
        return "Abort reconnection attempt";
    }

    public async pressButton(window: object): Promise<IConnectionState> {
        return new Idle();
    }

    tickFast(): IConnectionState {
        if (this.failedAttempts >= Reconnecting.MAX_RETRIES) {
            ipcs.terminal.println("Aborting attempts to reconnect");
            return new Idle();
        }
        ++this.ticksSinceLastFailure;
        if (this.ticksSinceLastFailure > Reconnecting.TICKS_BETWEEN_RETRIES) {
            ++this.failedAttempts;
            this.ticksSinceLastFailure = 0;
            ipcs.terminal.println("Attempting to reconnect (attempt " +
                this.failedAttempts.toString(10) + " of " + Reconnecting.MAX_RETRIES.toString(10) + ")...");
            return new Connecting(Promise.resolve(this.connectionToReestablish), this);
        } else {
            return this;
        }
    }

    public tickSlow() {
    }
}
