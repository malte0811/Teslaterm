import {CoilID} from "../../../common/constants";
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
const lastResponseTime = new Map<CoilID, number>();

export function resetResponseTimeout(coil: CoilID) {
    lastResponseTime.set(coil, Date.now());
}

function getResponseTime(coil: CoilID) {
    if (!lastResponseTime.has(coil)) {
        lastResponseTime.set(coil, Date.now());
    }
    return lastResponseTime.get(coil);
}

export class Connected implements IConnectionState {
    private readonly activeConnection: UD3Connection;
    private readonly autoTerminal: TerminalHandle;
    private readonly extraState: ExtraConnections;
    private readonly idleState: Idle;

    public constructor(conn: UD3Connection, autoTerm: TerminalHandle, idleState: Idle) {
        this.activeConnection = conn;
        this.autoTerminal = autoTerm;
        this.extraState = new ExtraConnections(idleState.getAdvancedOptions());
        this.idleState = idleState;
    }

    public getActiveConnection(): UD3Connection {
        return this.activeConnection;
    }

    public getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.CONNECTED;
    }

    public async disconnectFromCoil(): Promise<Idle> {
        try {
            await this.disconnectInternal();
            ipcs.terminal(this.activeConnection.getCoil()).onConnectionClosed();
        } catch (err) {
            console.error("While disconnecting:", err);
        }
        return this.idleState;
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
            return new Reconnecting(this.activeConnection, this.idleState);
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
            return new Bootloading(this.activeConnection, this.autoTerminal, this.idleState, cyacd);
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
        return this.idleState.getAdvancedOptions().commandOptions.state;
    }

    private isConnectionLost(): boolean {
        if (this.activeConnection instanceof BootloadableConnection) {
            const bootConnection = this.activeConnection as BootloadableConnection;
            if (bootConnection.isBootloading()) {
                // TODO detect lost connection in bootloader mode (and fully disconnect)?
                return false;
            }
        }
        const coil = this.getActiveConnection().getCoil();
        return Date.now() - getResponseTime(coil) > TIMEOUT;
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
