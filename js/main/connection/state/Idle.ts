import * as dgram from "dgram";
import {SerialPort} from "serialport";
import {
    baudrate,
    connection_type,
    remote_ip,
    serial_port,
    udp_min_port,
} from "../../../common/ConnectionOptions";
import {connection_types, dummy, serial_min, serial_plain, udp_min} from "../../../common/constants";
import {config} from "../../init";
import {ipcs} from "../../ipc/IPCProvider";
import {DummyConnection} from "../types/DummyConnection";
import {createPlainSerialConnection} from "../types/serial_plain";
import {createMinSerialConnection} from "../types/SerialMinConnection";
import {sendConnectionSuggestions} from "../types/Suggestions";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {createMinUDPConnection} from "../types/UDPMinConnection";
import {Connecting} from "./Connecting";
import {IConnectionState} from "./IConnectionState";

export class Idle implements IConnectionState {

    public static async connectWithOptions(options: any): Promise<UD3Connection | undefined> {
        const type = options[connection_type];
        switch (type) {
            case serial_plain:
                return this.connectSerial(options, createPlainSerialConnection);
            case serial_min:
                return this.connectSerial(options, createMinSerialConnection);
            case udp_min:
                return createMinUDPConnection(options[udp_min_port], Idle.addressFromString(options[remote_ip]));
            case dummy:
                return new DummyConnection();
            default:
                ipcs.terminal.println("Connection type \"" + connection_types.get(type) +
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

    private static async connectInternal(window: object): Promise<UD3Connection | undefined> {
        try {
            const options = ipcs.connectionUI.openConnectionUI(window);
            sendConnectionSuggestions(window);
            return await Idle.connectWithOptions(await options);
        } catch (e) {
            console.error(e);
            return Promise.resolve(undefined);
        }
    }

    private static async connectSerial(options: any, create: (port: string, baudrate: number) => UD3Connection)
        : Promise<UD3Connection | undefined> {
        if (options[serial_port]) {
            return create(options[serial_port], options[baudrate]);
        } else {
            return this.autoConnectSerial(options[baudrate], create);
        }
    }

    private static async autoConnectSerial(baudrate: number,
                                           create: (port: string, baudrate: number) => UD3Connection)
        : Promise<UD3Connection | undefined> {
        const all = await SerialPort.list();
        for (const port of all) {
            if (port.vendorId === config.serial.vendorID && port.productId === config.serial.productID) {
                ipcs.terminal.println("Auto connecting to " + port.path);
                return create(port.path, baudrate);
            }
        }
        ipcs.terminal.println("Did not find port to auto-connect to");
        return undefined;
    }
    public getActiveConnection(): UD3Connection | undefined {
        return undefined;
    }

    public getAutoTerminal(): TerminalHandle | undefined {
        return undefined;
    }

    public getButtonText(): string {
        return "Connect";
    }

    public async pressButton(window: object): Promise<IConnectionState> {
        return new Connecting(Idle.connectInternal(window), this);
    }

    public tickFast(): IConnectionState {
        return this;
    }

    public tickSlow() {
    }
}
