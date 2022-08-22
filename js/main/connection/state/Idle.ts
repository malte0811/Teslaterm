import {SerialPort} from "serialport";
import {ConnectionOptions} from "../../../common/ConnectionOptions";
import {CONNECTION_TYPE_DESCS, UD3ConnectionType} from "../../../common/constants";
import {AutoSerialPort, ConnectionStatus} from "../../../common/IPCConstantsToRenderer";
import {config} from "../../init";
import {ipcs} from "../../ipc/IPCProvider";
import {resetAlarms} from "../telemetry/Alarms";
import {DummyConnection} from "../types/DummyConnection";
import {createPlainSerialConnection} from "../types/serial_plain";
import {createMinSerialConnection} from "../types/SerialMinConnection";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {createMinUDPConnection} from "../types/UDPMinConnection";
import {IConnectionState} from "./IConnectionState";

export class Idle implements IConnectionState {

    public static async connectWithOptions(options: ConnectionOptions): Promise<UD3Connection | undefined> {
        resetAlarms();
        const type = options.connectionType;
        switch (type) {
            case UD3ConnectionType.serial_plain:
                return this.connectSerial(options, createPlainSerialConnection);
            case UD3ConnectionType.serial_min:
                return this.connectSerial(options, createMinSerialConnection);
            case UD3ConnectionType.udp_min:
                return createMinUDPConnection(options.udpMinPort, Idle.addressFromString(options.remoteIP));
            case UD3ConnectionType.dummy:
                return new DummyConnection();
            default:
                ipcs.connectionUI.sendConnectionError("Connection type \"" + CONNECTION_TYPE_DESCS.get(type) +
                    "\" (" + type + ") is currently not supported");
                return undefined;
        }
    }

    private static addressFromString(input: string): string {
        const suffixStart = input.lastIndexOf(" (");
        if (suffixStart >= 0 && input[input.length - 1] == ")") {
            return input.substring(suffixStart + 2, input.length - 1);
        } else {
            return input;
        }
    }

    private static async connectSerial(options: ConnectionOptions, create: (port: string, baudrate: number) => UD3Connection)
        : Promise<UD3Connection | undefined> {
        if (options.serialPort) {
            return create(options.serialPort, options.baudrate);
        } else {
            return this.autoConnectSerial(options.baudrate, create);
        }
    }

    private static async autoConnectSerial(baudrate: number,
                                           create: (port: string, baudrate: number) => UD3Connection)
        : Promise<UD3Connection | undefined> {
        const all = await SerialPort.list();
        const options: AutoSerialPort[] = [];
        for (const port of all) {
            if (port.vendorId === config.serial.vendorID && port.productId === config.serial.productID) {
                console.log("Auto connecting to " + port.path);
                return create(port.path, baudrate);
            }
            if (port.vendorId && port.productId) {
                options.push({
                    path: port.path,
                    manufacturer: port.manufacturer,
                    vendorID: port.vendorId,
                    productID: port.productId,
                });
            }
        }
        ipcs.connectionUI.sendAutoOptions(options);
        return undefined;
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

    public async pressButton(window: object): Promise<IConnectionState> {
        //TODO
        return this;
    }

    public tickFast(): IConnectionState {
        return this;
    }

    public tickSlow() {
    }
}
