import {ConnectionStatus} from "../../../common/IPCConstantsToRenderer";
import {CommandRole} from "../../../common/Options";
import {ICommandServer} from "../../command/CommandServer";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";

export interface IConnectionState {
    getConnectionStatus(): ConnectionStatus;

    pressButton(window: object): Promise<IConnectionState>;

    getActiveConnection(): UD3Connection | undefined;

    getAutoTerminal(): TerminalHandle | undefined;

    tickFast(): IConnectionState;

    tickSlow(): void;

    getCommandServer(): ICommandServer;

    getCommandRole(): CommandRole;
}

