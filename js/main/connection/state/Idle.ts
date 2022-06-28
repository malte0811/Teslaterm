import {
    baudrate,
    connection_type,
    midi_port,
    remote_ip,
    serial_port,
    sid_port,
    telnet_port, udp_min_port,
} from "../../../common/ConnectionOptions";
import {connection_types, dummy, eth_node, serial_min, serial_plain, udp_min} from "../../../common/constants";
import {ipcs} from "../../ipc/IPCProvider";
import {config} from "../../init";
import {DummyConnection} from "../types/DummyConnection";
import {createEthernetConnection} from "../types/ethernet";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {createMinSerialConnection} from "../types/SerialMinConnection";
import {createPlainSerialConnection} from "../types/serial_plain";
import {createMinUDPConnection} from "../types/UDPMinConnection";
import {Connecting} from "./Connecting";
import {IConnectionState} from "./IConnectionState";
import {SerialPort} from "serialport";

export class Idle implements IConnectionState {
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

    public static async connectWithOptions(options: any): Promise<UD3Connection | undefined> {
        const type = options[connection_type];
        switch (type) {
            case serial_plain:
                return this.connectSerial(options, createPlainSerialConnection);
            case serial_min:
                return this.connectSerial(options, createMinSerialConnection);
            case eth_node:
                return createEthernetConnection(options[remote_ip], options[telnet_port], options[midi_port], options[sid_port]);
            case udp_min:
                return createMinUDPConnection(options[udp_min_port], options[remote_ip]);
            case dummy:
                return new DummyConnection();
            default:
                ipcs.terminal.println("Connection type \"" + connection_types.get(type) +
                    "\" (" + type + ") is currently not supported");
                return undefined;
        }
    }

    private static async connectInternal(window: object): Promise<UD3Connection | undefined> {
        try {
            const options = await ipcs.connectionUI.openConnectionUI(window);
            return Idle.connectWithOptions(options);
        } catch (e) {
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
}
