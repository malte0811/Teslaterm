import {Client} from "basic-ftp";
import * as net from "net";
import {promisify} from "util";
import {ConnectionStatus, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {sleep, withTimeout} from "../../helper";
import {ipcs} from "../../ipc/IPCProvider";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {Bootloader} from "../bootloader/bootloader";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";
import {Reconnecting} from "./Reconnecting";

export class Bootloading implements IConnectionState {
    private readonly connection: BootloadableConnection;
    private readonly idleState: Idle;
    private done: boolean = false;
    private inBootloadMode: boolean = false;

    constructor(
        connection: BootloadableConnection, idleState: Idle, file: Uint8Array,
    ) {
        this.connection = connection;
        this.idleState = idleState;
        this.bootload(file).then(() => this.done = true);
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
            return this.connection.getAutoTerminalID();
        }
    }

    public getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.BOOTLOADING;
    }

    public async disconnectFromCoil(): Promise<Idle> {
        this.connection.releaseResources();
        return this.idleState;
    }

    public tickFast(): IConnectionState {
        if (this.done) {
            this.connection.releaseResources();
            return new Reconnecting(this.connection, this.idleState);
        } else if (!this.inBootloadMode) {
            this.connection.tick();
        }
        return this;
    }

    public tickSlow() {
    }

    private async bootload(file: Uint8Array) {
        try {
            const ftpAddress = this.connection.getFTPAddress();
            if (ftpAddress !== undefined) {
                await this.bootloadFTP(file, ftpAddress);
            } else {
                await this.bootloadDirectly(file);
            }
        } catch (e) {
            ipcs.coilMisc(this.coil).openToast('Bootloader', 'Error while bootloading: ' + e, ToastSeverity.error);
            console.error(e);
        }
        if (this.inBootloadMode) {
            this.connection.leaveBootloaderMode();
        }
    }

    private async bootloadDirectly(file: Uint8Array) {
        const terminal = ipcs.terminal(this.coil);
        // Ignore result: The UD3 won't ACK this command since it immediately goes into bootloader mode
        this.connection.commands().sendCommand('\rbootloader\r').catch(() => {});
        terminal.println("Waiting for bootloader to start...");
        await sleep(3000);
        const ldr = new Bootloader();
        await ldr.loadCyacd(file);
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
    }

    private async getConnectingSocket(localPort: number) {
        return new Promise<net.Socket>((res, rej) => {
            const server = new net.Server((socket) => {
                res(socket);
                server.close();
            });
            server.on('error', rej);
            server.listen(localPort);
        });
    }

    private async bootloadFTP(file: Uint8Array, remoteAddress: string) {
        const ftpClient = new Client();
        await ftpClient.access({
            host: remoteAddress,
            // Both of these are currently ignored by Fibernet
            password: 'ignored',
            user: 'ignored',
        });

        // The FTP library does not support active mode, the FTP server in FiberNet does not support passive mode. So we
        // have to write our own rudimentary active mode logic.
        const dataPort = ftpClient.ftp.socket.localPort + 1;
        const addressForPort = ftpClient.ftp.socket.localAddress.replace(/\./g, ',');
        await ftpClient.send(`PORT ${addressForPort},${Math.floor(dataPort / 256)},${dataPort % 256}`);

        const remoteImageName = 'image.cyacd';
        const dataSocketPromise = this.getConnectingSocket(dataPort);
        await ftpClient.send(`STOR ${remoteImageName}`);
        const dataSocket = await withTimeout(dataSocketPromise, 1000, 'Waiting for data connection');
        await promisify((cb: () => any) => dataSocket.end(file, cb))();

        await ftpClient.send(`FLASH ${remoteImageName}`);
        ftpClient.close();
    }

    private get coil() {
        return this.connection.getCoil();
    }
}
