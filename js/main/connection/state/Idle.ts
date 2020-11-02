import * as dgram from "dgram";
import {
    baudrate,
    connection_type,
    midi_port,
    remote_ip,
    serial_port,
    sid_port,
    telnet_port, udp_min_port,
} from "../../../common/ConnectionOptions";
import {connection_types, eth_node, serial_min, serial_plain, udp_min} from "../../../common/constants";
import {convertArrayBufferToString, sleep} from "../../helper";
import {ConnectionUIIPC} from "../../ipc/ConnectionUI";
import {TerminalIPC} from "../../ipc/terminal";
import {config} from "../../init";
import {createBroadcastSocket} from "../tcp_helper";
import {createEthernetConnection} from "../types/ethernet";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {createMinSerialConnection} from "../types/SerialMinConnection";
import {createPlainSerialConnection} from "../types/serial_plain";
import {createMinUDPConnection} from "../types/UDPMinConnection";
import {Connecting} from "./Connecting";
import {IConnectionState} from "./IConnectionState";
import SerialPort = require("serialport");

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

    public pressButton(window: object): IConnectionState {
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
                return createMinUDPConnection(options[udp_min_port], Idle.addressFromString(options[remote_ip]));
            default:
                TerminalIPC.println("Connection type \"" + connection_types.get(type) +
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
            let udpCandidates: string[] = [];
            const udpSocket = await createBroadcastSocket();
            udpSocket.send("FINDReq=1;\0", 50022, "255.255.255.255");
            udpSocket.on('message', (msg, rinfo) => {
                const asString = convertArrayBufferToString(msg);
                if (asString.startsWith("FIND=1;")) {
                    const parts = asString.split(";");
                    let name = undefined;
                    let isUD3 = false;
                    for (const field of parts) {
                        const eq = field.indexOf("=");
                        if (eq >= 0) {
                            const fieldName = field.substring(0, eq);
                            const fieldValue = field.substring(eq + 1);
                            if (fieldName === "deviceType") {
                                isUD3 = fieldValue === "UD3";
                            } else if (fieldName === "DeviceName") {
                                name = fieldValue;
                            }
                        }
                    }
                    if (isUD3) {
                        if (this.name) {
                            udpCandidates.push(name + " (" + rinfo.address + ")");
                        } else {
                            udpCandidates.push(rinfo.address);
                        }
                    }
                }
            });
            let serialPorts: string[] = [];
            for (const port of await SerialPort.list()) {
                serialPorts.push(port.path);
            }
            //TODO send the "fast" data right away and send FIND replies as they arrive
            await sleep(250);
            const options = await ConnectionUIIPC.openConnectionUI(window, {
                serialPorts: serialPorts,
                udpCandidates: udpCandidates
            });
            udpSocket.close();
            return Idle.connectWithOptions(options);
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
                TerminalIPC.println("Auto connecting to " + port.path);
                return create(port.path, baudrate);
            }
        }
        TerminalIPC.println("Did not find port to auto-connect to");
        return undefined;
    }
}
