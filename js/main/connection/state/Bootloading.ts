import {ConnectionStatus, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {sleep} from "../../helper";
import {ipcs} from "../../ipc/IPCProvider";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {Bootloader} from "../bootloader/bootloader";
import {commands} from "../connection";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";
import {Reconnecting} from "./Reconnecting";

export class Bootloading implements IConnectionState {
    private readonly connection: BootloadableConnection;
    private readonly autoTerminal: TerminalHandle;
    private done: boolean = false;
    private cancelled: boolean = false;
    private inBootloadMode: boolean = false;

    constructor(connection: BootloadableConnection, autoTerm: TerminalHandle, file: Uint8Array) {
        this.connection = connection;
        this.autoTerminal = autoTerm;
        this.bootload(file)
            .catch(
                (e) => {
                    console.error(e);
                    ipcs.misc.openToast('Bootloader', 'Error while bootloading: ' + e, ToastSeverity.error);
                }
            )
            .then(
                () => {
                    this.done = true;
                }
            );
    }

    getActiveConnection(): UD3Connection | undefined {
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

    getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.BOOTLOADING;
    }

    public async pressButton(window: object): Promise<IConnectionState> {
        this.cancelled = true;
        await this.connection.releaseResources();
        return new Idle();
    }

    public tickFast(): IConnectionState {
        if (this.done) {
            this.connection.releaseResources();
            return new Reconnecting(this.connection);
        } else {
            return this;
        }
    }

    private async bootload(file: Uint8Array) {
        try {
            const ldr = new Bootloader();
            await ldr.loadCyacd(file);
            // Ignore result: The UD3 won't ACK this command since it immediately goes into bootloader mode
            commands.sendCommand('\rbootloader\r').catch(() => {});
            ipcs.terminal.println("Waiting for bootloader to start...");
            await sleep(3000);
            this.connection.enterBootloaderMode((data) => {
                ldr.onDataReceived(data);
            });
            this.inBootloadMode = true;
            ipcs.terminal.println("Connecting to bootloader...");
            ldr.set_info_cb((str: string) => ipcs.terminal.println(str));
            ldr.set_progress_cb((percentage) => {
                ipcs.terminal.print('\x1B[2K');
                ipcs.terminal.print('\r|');
                for (let i = 0; i < 50; i++) {
                    if (percentage >= (i * 2)) {
                        ipcs.terminal.print('=');
                    } else {
                        ipcs.terminal.print('.');
                    }
                }
                ipcs.terminal.print('| ' + percentage + '%');
            });
            ldr.set_write_cb((data) => {
                return this.connection.sendBootloaderData(data);
            });
            await ldr.connectAndProgram();
        } catch (e) {
            console.error(e);
            ipcs.misc.openToast('Bootloader', 'Error while bootloading: ' + e, ToastSeverity.error);
        }
        if (this.inBootloadMode) {
            this.connection.leaveBootloaderMode();
        }
    }

    public tickSlow() {
    }
}
