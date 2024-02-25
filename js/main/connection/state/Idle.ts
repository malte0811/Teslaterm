import {SerialPort} from "serialport";
import {ConnectionOptions, SerialConnectionOptions} from "../../../common/ConnectionOptions";
import {CoilID, CONNECTION_TYPE_DESCS, UD3ConnectionType} from "../../../common/constants";
import {ConnectionStatus} from "../../../common/IPCConstantsToRenderer";
import {CommandRole} from "../../../common/Options";
import {DUMMY_SERVER, ICommandServer} from "../../command/CommandServer";
import {ipcs} from "../../ipc/IPCProvider";
import {setConnectionState} from "../connection";
import {resetAlarms} from "../telemetry/Alarms";
import {createPlainSerialConnection} from "../types/PlainSerialConnection";
import {createMinSerialConnection} from "../types/SerialMinConnection";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {createMinUDPConnection} from "../types/UDPMinConnection";
import {Connecting} from "./Connecting";
import {IConnectionState} from "./IConnectionState";

export class Idle implements IConnectionState {
    private readonly options: ConnectionOptions;
    private readonly isMultiCoil: boolean;

    constructor(args: ConnectionOptions, isMulticoil: boolean) {
        this.options = args;
        this.isMultiCoil = isMulticoil;
    }

    public async connect(id: CoilID) {
        setConnectionState(id, this);
        const connection = await this.createConnection(id);
        if (connection) {
            setConnectionState(id, new Connecting(connection, this, this));
        } else {
            return undefined;
        }
    }

    public getAdvancedOptions() {
        return this.options.advanced;
    }

    public isMulticoil() {
        return this.isMultiCoil;
    }

    public getActiveConnection(): UD3Connection | undefined {
        return undefined;
    }

    public getAutoTerminal(): TerminalHandle | undefined {
        return undefined;
    }

    public getConnectionStatus(): ConnectionStatus {
        return ConnectionStatus.IDLE;
    }

    public async disconnectFromCoil(): Promise<Idle> {
        return this;
    }

    public tickFast(): IConnectionState {
        return this;
    }

    public tickSlow() {
    }

    public getCommandServer(): ICommandServer {
        return DUMMY_SERVER;
    }

    public getCommandRole(): CommandRole {
        return 'disable';
    }

    private async createConnection(coil: CoilID): Promise<UD3Connection | undefined> {
        resetAlarms();
        const type = this.options.connectionType;
        switch (type) {
            case UD3ConnectionType.serial_plain:
                return this.connectSerial(coil, this.options.options, createPlainSerialConnection);
            case UD3ConnectionType.serial_min:
                return this.connectSerial(coil, this.options.options, createMinSerialConnection);
            case UD3ConnectionType.udp_min:
                return createMinUDPConnection(
                    coil, this.options.options.udpMinPort, Idle.addressFromString(this.options.options.remoteIP),
                );
            default:
                ipcs.connectionUI.sendConnectionError("Connection type \"" + CONNECTION_TYPE_DESCS.get(type) +
                    "\" (" + type + ") is currently not supported");
                return undefined;
        }
    }

    private async connectSerial(
        coil: CoilID,
        options: SerialConnectionOptions,
        create: (coil: CoilID, port: string, baudrate: number) => UD3Connection,
    ): Promise<UD3Connection | undefined> {
        if (options.autoconnect) {
            return Idle.autoConnectSerial(coil, options.baudrate, create, options);
        } else {
            return create(coil, options.serialPort, options.baudrate);
        }
    }

    private static addressFromString(input: string): string {
        const suffixStart = input.lastIndexOf(" (");
        if (suffixStart >= 0 && input[input.length - 1] === ")") {
            return input.substring(suffixStart + 2, input.length - 1);
        } else {
            return input;
        }
    }

    private static async autoConnectSerial(
        coil: CoilID,
        baudrate: number,
        create: (coil: CoilID, port: string, baudrate: number) => UD3Connection,
        options: SerialConnectionOptions,
    ): Promise<UD3Connection | undefined> {
        if (!options.autoVendorID || !options.autoProductID) {
            return undefined;
        }
        const all = await SerialPort.list();
        for (const port of all) {
            if (port.vendorId === options.autoVendorID && port.productId === options.autoProductID) {
                console.log("Auto connecting to " + port.path);
                return create(coil, port.path, baudrate);
            }
        }
        ipcs.connectionUI.sendConnectionError("Did not find device with specified product/vendor ID");
        return undefined;
    }
}
