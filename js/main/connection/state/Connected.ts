import {ConnectionStatus, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {PlayerActivity, SynthType} from "../../../common/MediaTypes";
import {AdvancedOptions, CommandRole} from "../../../common/Options";
import {ipcs} from "../../ipc/IPCProvider";
import * as media from "../../media/media_player";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {ExtraConnections} from "../ExtraConnections";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {Bootloading} from "./Bootloading";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";
import {Reconnecting} from "./Reconnecting";

const TIMEOUT = 1000;
let lastResponseTime = Date.now();

export function resetResponseTimeout() {
    lastResponseTime = Date.now();
}

export class Connected implements IConnectionState {
    private readonly activeConnection: UD3Connection;
    private readonly autoTerminal: TerminalHandle;
    private readonly extraState: ExtraConnections;
    private readonly advOptions: AdvancedOptions;

    public constructor(conn: UD3Connection, autoTerm: TerminalHandle, advOptions: AdvancedOptions) {
        this.activeConnection = conn;
        this.autoTerminal = autoTerm;
        this.extraState = new ExtraConnections(advOptions);
        this.advOptions = advOptions;
    }

    public getActiveConnection(): UD3Connection {
        return this.activeConnection;
    }

    public getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.CONNECTED;
    }

    public async pressButton(window: object): Promise<IConnectionState> {
        try {
            await this.disconnectInternal();
            ipcs.terminal(this.activeConnection.getCoil()).onConnectionClosed();
        } catch (err) {
            console.error("While disconnecting:", err);
        }
        return new Idle();
    }

    public tickFast(): IConnectionState {
        this.activeConnection.tick();
        this.extraState.tickFast();

        if (this.isConnectionLost()) {
            ipcs.coilMisc(this.activeConnection.getCoil()).openToast(
                'Connection lost',
                'Lost connection,' +
                ' will attempt to reconnect',
                ToastSeverity.warning,
                'will-reconnect',
            );
            this.activeConnection.disconnect();
            this.closeAdditionalConnections();
            ipcs.terminal(this.activeConnection.getCoil()).onConnectionClosed();
            return new Reconnecting(this.activeConnection, this.advOptions);
        }

        return this;
    }

    public tickSlow() {
        this.activeConnection.resetWatchdog();
        this.extraState.tickSlow();
    }

    public startBootloading(cyacd: Uint8Array): IConnectionState | undefined {
        if (this.activeConnection instanceof BootloadableConnection) {
            this.closeAdditionalConnections();
            return new Bootloading(this.activeConnection, this.autoTerminal, this.advOptions, cyacd);
        } else {
            return undefined;
        }
    }

    public getAutoTerminal(): TerminalHandle | undefined {
        return this.autoTerminal;
    }

    public async sendMIDI(data: Buffer) {
        await this.activeConnection.sendMidi(data);
        await this.activeConnection.setSynth(SynthType.MIDI, true);
        this.getCommandServer().sendMIDI(data);
    }

    public getCommandServer() {
        return this.extraState.getCommandServer();
    }

    public getCommandRole(): CommandRole {
        return this.advOptions.commandOptions.state;
    }

    private isConnectionLost(): boolean {
        if (this.activeConnection instanceof BootloadableConnection) {
            const bootConnection = this.activeConnection as BootloadableConnection;
            if (bootConnection.isBootloading()) {
                // TODO detect lost connection in bootloader mode (and fully disconnect)?
                return false;
            }
        }
        return Date.now() - lastResponseTime > TIMEOUT;
    }

    private async disconnectInternal() {
        try {
            this.closeAdditionalConnections();
            await this.activeConnection.commands().stop();
        } catch (e) {
            console.error("Failed to send stop command:", e);
        }
        await this.activeConnection.disconnect();
    }

    private closeAdditionalConnections() {
        this.extraState.close();
        if (media.media_state.state === PlayerActivity.playing) {
            media.media_state.stopPlaying();
        }
    }
}
