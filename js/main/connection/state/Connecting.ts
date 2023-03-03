import {ConnectionStatus} from "../../../common/IPCConstantsToRenderer";
import {AdvancedOptions, CommandRole} from "../../../common/Options";
import {DUMMY_SERVER, ICommandServer} from "../../command/CommandServer";
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
    private readonly connection: UD3Connection;
    private readonly advOptions: AdvancedOptions;
    private autoTerminal: TerminalHandle | undefined;
    private state: State = State.waiting_for_ud_connection;
    private readonly stateOnFailure: IConnectionState;
    private doneInitializingAt: number;

    public constructor(connection: UD3Connection, onFailure: IConnectionState, advOptions: AdvancedOptions) {
        this.stateOnFailure = onFailure;
        this.connection = connection;
        this.advOptions = advOptions;
        this.connect().catch((error) => {
            ipcs.connectionUI.sendConnectionError(this.removeErrorPrefixes(error + ''));
            console.log("While connecting: ", error);
            connection.releaseResources();
            this.state = State.failed;
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
        this.connection.releaseResources();
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
                return new Connected(this.connection, this.autoTerminal, this.advOptions);
            case State.failed:
                return this.stateOnFailure;
            default:
                throw new Error("Unexpected state: " + this.state);
        }
    }

    public tickSlow() {
    }

    public getAutoTerminal(): TerminalHandle | undefined {
        return undefined;
    }

    public getCommandServer(): ICommandServer {
        return DUMMY_SERVER;
    }

    public getCommandRole(): CommandRole {
        return this.advOptions.commandOptions.state;
    }

    private async connect() {
        this.state = State.connecting;
        ipcs.sliders.reinitState(this.advOptions.commandOptions.state);
        await this.connection.connect();
        this.autoTerminal = this.connection.setupNewTerminal((data) =>
            telemetry.receive_main(
                data,
                // After connecting the UD3 will send one alarm per 100 ms, generally less than 20 total. We
                // do not want to show toasts for these alarms that happened before TT connected, so
                // consider these 2000 ms as "initializing"
                this.state === State.initializing || (Date.now() - this.doneInitializingAt) < 2000,
                undefined,
            ));
        if (this.autoTerminal === undefined) {
            throw new Error("Failed to create a terminal for automatic commands");
        }
        await this.connection.startTerminal(this.autoTerminal);
        this.state = State.initializing;
        await startConf(this.advOptions.commandOptions.state);
        await ipcs.terminal.onSlotsAvailable(true);
        this.doneInitializingAt = Date.now();
        this.state = State.connected;
    }

    private removeErrorPrefixes(withError: string): string {
        const prefix = "Error:";
        while (withError.startsWith(prefix)) {
            withError = withError.substring(prefix.length).trim();
        }
        return withError;
    }
}
