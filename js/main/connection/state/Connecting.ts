import {ConnectionStatus} from "../../../common/IPCConstantsToRenderer";
import {ipcs} from "../../ipc/IPCProvider";
import {startConf} from "../connection";
import * as telemetry from "../telemetry";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {Connected} from "./Connected";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";

enum State {
    waiting_for_ud_connection,
    connecting,
    initializing,
    connected,
    failed,
}

export class Connecting implements IConnectionState {
    private connection: UD3Connection | undefined;
    private autoTerminal: TerminalHandle | undefined;
    private state: State = State.waiting_for_ud_connection;
    private readonly stateOnFailure: IConnectionState;
    private doneInitializingAt: number;

    public constructor(connection: Promise<UD3Connection | undefined>, onFailure: IConnectionState) {
        this.stateOnFailure = onFailure;
        connection.then(async (c) => {
            this.connection = c;
            if (c) {
                this.state = State.connecting;
                let error: {
                    message: string;
                } = undefined;
                try {
                    await c.connect();
                    this.autoTerminal = c.setupNewTerminal((data) =>
                        telemetry.receive_main(
                            data,
                            // After connecting the UD3 will send one alarm per 100 ms, generally less than 20 total. We
                            // do not want to show toasts for these alarms that happened before TT connected, so
                            // consider these 2000 ms as "initializing"
                            this.state === State.initializing || (Date.now() - this.doneInitializingAt) < 2000,
                            undefined,
                        ));
                    if (this.autoTerminal === undefined) {
                        error = {message: "Failed to create a terminal for automatic commands"};
                    } else {
                        await c.startTerminal(this.autoTerminal);
                        this.state = State.initializing;
                        await startConf();
                        await ipcs.terminal.onSlotsAvailable(true);
                        this.doneInitializingAt = Date.now();
                        this.state = State.connected;
                    }
                } catch (x) {
                    error = x;
                }
                if (error) {
                    ipcs.connectionUI.sendConnectionError(error.message || ('Error: ' + error));
                    console.log("While connecting: ", error);
                    c.disconnect();
                    this.state = State.failed;
                }
            } else {
                this.state = State.failed;
            }
        });
    }

    public getActiveConnection(): UD3Connection | undefined {
        if (this.state === State.initializing || this.state === State.connected) {
            return this.connection;
        } else {
            return undefined;
        }
    }

    public getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.CONNECTING;
    }

    public async pressButton(window: object): Promise<IConnectionState> {
        console.log("Aborting connection");
        return new Idle();
    }

    public tickFast(): IConnectionState {
        switch (this.state) {
            case State.waiting_for_ud_connection:
                return this;
            case State.connecting:
            case State.initializing:
                this.connection.tick();
                return this;
            case State.connected:
                return new Connected(this.connection, this.autoTerminal);
            case State.failed:
                return this.stateOnFailure;
            default:
                throw new Error("Unexpected state: " + this.state);
        }
    }

    public tickSlow() {
    }

    getAutoTerminal(): TerminalHandle | undefined {
        return undefined;
    }
}
