import {ConnectionStatus, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {AdvancedOptions, CommandRole} from "../../../common/Options";
import {DUMMY_SERVER, ICommandServer} from "../../command/CommandServer";
import {sleep} from "../../helper";
import {ipcs} from "../../ipc/IPCProvider";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {Bootloader} from "../bootloader/bootloader";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";
import {Reconnecting} from "./Reconnecting";

export class Bootloading implements IConnectionState {
    private readonly connection: BootloadableConnection;
    private readonly autoTerminal: TerminalHandle;
    private readonly idleState: Idle;
    private done: boolean = false;
    private cancelled: boolean = false;
    private inBootloadMode: boolean = false;

    constructor(
        connection: BootloadableConnection, autoTerm: TerminalHandle, idleState: Idle, file: Uint8Array,
    ) {
        this.connection = connection;
        this.autoTerminal = autoTerm;
        this.idleState = idleState;
        this.bootload(file)
            .catch((e) => {
                console.error(e);
                ipcs.coilMisc(this.coil).openToast('Bootloader', 'Error while bootloading: ' + e, ToastSeverity.error);
            })
            .then(() => {
                this.done = true;
            });
    }

    public getActiveConnection(): UD3Connection | undefined {
        if (this.inBootloadMode) {
            return undefined;
        } else {
            return this.connection;
        }
    }

    public getAutoTerminal(): TerminalHandle | undefined {
        if (this.inBootloadMode) {
            return undefined;
        } else {
            return this.autoTerminal;
        }
    }

    public getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.BOOTLOADING;
    }

    public async disconnectFromCoil(): Promise<Idle> {
        this.cancelled = true;
        this.connection.releaseResources();
        return this.idleState;
    }

    public tickFast(): IConnectionState {
        if (!this.inBootloadMode) {
            this.connection.tick();
        } else if (this.done) {
            this.connection.releaseResources();
            return new Reconnecting(this.connection, this.idleState);
        }
        return this;
    }

    public tickSlow() {
    }

    public getCommandServer(): ICommandServer {
        return DUMMY_SERVER;
    }

    public getCommandRole(): CommandRole {
        return this.idleState.getAdvancedOptions().commandOptions.state;
    }

    private async bootload(file: Uint8Array) {
        try {
            const terminal = ipcs.terminal(this.coil);
            const ldr = new Bootloader();
            await ldr.loadCyacd(file);
            // Ignore result: The UD3 won't ACK this command since it immediately goes into bootloader mode
            this.connection.commands().sendCommand('\rbootloader\r').catch(() => {});
            terminal.println("Waiting for bootloader to start...");
            await sleep(3000);
            this.connection.enterBootloaderMode((data) => {
                ldr.onDataReceived(data);
            });
            this.inBootloadMode = true;
            terminal.println("Connecting to bootloader...");
            ldr.set_info_cb((str: string) => terminal.println(str));
            ldr.set_progress_cb((percentage) => {
                terminal.print('\x1B[2K');
                terminal.print('\r|');
                for (let i = 0; i < 50; i++) {
                    if (percentage >= (i * 2)) {
                        terminal.print('=');
                    } else {
                        terminal.print('.');
                    }
                }
                terminal.print('| ' + percentage + '%');
            });
            ldr.set_write_cb((data) => {
                return this.connection.sendBootloaderData(data);
            });
            await ldr.connectAndProgram();
        } catch (e) {
            console.error(e);
            ipcs.coilMisc(this.coil).openToast('Bootloader', 'Error while bootloading: ' + e, ToastSeverity.error);
        }
        if (this.inBootloadMode) {
            this.connection.leaveBootloaderMode();
        }
    }

    private get coil() {
        return this.connection.getCoil();
    }
}
