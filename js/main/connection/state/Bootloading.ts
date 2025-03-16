import {CoilID} from "../../../common/constants";
import {DroppedFile} from "../../../common/IPCConstantsToMain";
import {ConnectionStatus, ToastSeverity} from "../../../common/IPCConstantsToRenderer";
import {sleep} from "../../helper";
import {ipcs} from "../../ipc/IPCProvider";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {Bootloader} from "../bootloader/bootloader";
import {uploadFibernetFirmware, uploadUD3FirmwareFTP} from "../bootloader/FibernetFTP";
import {getCoils, getConnectionState, setConnectionState} from "../connection";
import {UD3Connection} from "../types/UD3Connection";
import {Connected} from "./Connected";
import {IConnectionState} from "./IConnectionState";
import {Idle} from "./Idle";
import {Reconnecting} from "./Reconnecting";

export enum FirmwareFiletype {
    ud3 = 'cyacd',
    fibernet = 'hex',
}

export class Bootloading implements IConnectionState {
    private readonly connection: BootloadableConnection;
    private readonly idleState: Idle;
    private done: boolean = false;
    private inBootloadMode: boolean = false;

    constructor(
        connection: BootloadableConnection, idleState: Idle, file: number[],
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

    private async bootload(file: number[]) {
        try {
            const ftpAddress = this.connection.getFTPAddress();
            if (ftpAddress !== undefined) {
                await uploadUD3FirmwareFTP(ftpAddress, file);
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

    private async bootloadDirectly(file: number[]) {
        const terminal = ipcs.terminal(this.coil);
        // Ignore result: The UD3 won't ACK this command since it immediately goes into bootloader mode
        this.connection.commands().sendCommand('\rbootloader\r').catch(() => {});
        terminal.println("Waiting for bootloader to start...");
        await sleep(3000);
        const ldr = new Bootloader();
        await ldr.loadCyacd(file);
        this.connection.enterBootloaderMode((data) => {
            ldr.onDataReceived([...data]);
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

    private get coil() {
        return this.connection.getCoil();
    }
}

function bootloaderToast(desc: string, severity: ToastSeverity = ToastSeverity.error) {
    ipcs.misc.openGenericToast('Bootloader', desc, severity);
}

function startBootloading(coil: CoilID, coilState: Connected, cyacd: number[]) {
    const newConnection = coilState.startBootloading(cyacd);
    if (newConnection) {
        setConnectionState(coil, newConnection);
    } else {
        bootloaderToast("Connection does not support bootloading");
    }
}

export async function handleBootloaderFileDrop(type: FirmwareFiletype, file: DroppedFile) {
    const coils = [...getCoils()];
    if (coils.length !== 1) {
        bootloaderToast("Bootloading not supported in multicoil mode");
        return;
    }
    const coilState = getConnectionState(coils[0]);
    if (!(coilState instanceof Connected)) {
        bootloaderToast('Need to be connected to a coil to run bootloader');
        return;
    }
    if (type === FirmwareFiletype.fibernet) {
        const connection = coilState.getActiveConnection();
        if (connection instanceof BootloadableConnection && connection.getFTPAddress()) {
            bootloaderToast('Starting Fibernet firmware update', ToastSeverity.info);
            await uploadFibernetFirmware(connection, file.bytes);
            bootloaderToast('Updated Fibernet firmware, reconnecting', ToastSeverity.info);
            setConnectionState(coils[0], coilState.makeConnectionLostState());
        } else {
            bootloaderToast('Not a fibernet connection?');
        }
    } else {
        startBootloading(coils[0], coilState, file.bytes);
    }
}
