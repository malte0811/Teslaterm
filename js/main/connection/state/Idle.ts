import {
    SerialConnectionOptions,
    UD3ConnectionOptions, UDPConnectionOptions
} from "../../../common/SingleConnectionOptions";
import {CoilID, CONNECTION_TYPE_DESCS, UD3ConnectionType} from "../../../common/constants";
import {ConnectionStatus} from "../../../common/IPCConstantsToRenderer";
import {ipcs} from "../../ipc/IPCProvider";
import {setConnectionState} from "../connection";
import {resetAlarms} from "../telemetry/Alarms";
import {createPlainSerialConnection} from "../types/PlainSerialConnection";
import {createMinSerialConnection} from "../types/SerialMinConnection";
import {collectSerialConnectionSuggestions, collectUDPConnectionSuggestions} from "../types/Suggestions";
import {TerminalHandle, UD3Connection} from "../types/UD3Connection";
import {createMinUDPConnection} from "../types/UDPMinConnection";
import {Connecting} from "./Connecting";
import {IConnectionState} from "./IConnectionState";

export class Idle implements IConnectionState {
    private readonly options: UD3ConnectionOptions;
    private readonly isMultiCoil: boolean;

    constructor(args: UD3ConnectionOptions, isMulticoil: boolean) {
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

    private async createConnection(coil: CoilID): Promise<UD3Connection | undefined> {
        resetAlarms();
        const type = this.options.connectionType;
        switch (type) {
            case UD3ConnectionType.serial_plain:
                return connectSerial(coil, this.options.options, createPlainSerialConnection);
            case UD3ConnectionType.serial_min:
                return connectSerial(coil, this.options.options, createMinSerialConnection);
            case UD3ConnectionType.udp_min:
                return connectUDP(coil, this.options.options);
            default:
                ipcs.connectionUI.sendConnectionError(
                    coil,
                    `Connection type "${CONNECTION_TYPE_DESCS.get(type)}" (${type}) is currently not supported`,
                );
                return undefined;
        }
    }
}

function addressFromString(input: string): string {
    const suffixStart = input.lastIndexOf(" (");
    if (suffixStart >= 0 && input[input.length - 1] === ")") {
        return input.substring(suffixStart + 2, input.length - 1);
    } else {
        return input;
    }
}

async function connectSerial(
    coil: CoilID,
    options: SerialConnectionOptions,
    create: (coil: CoilID, port: string, baudrate: number) => UD3Connection,
): Promise<UD3Connection | undefined> {
    if (options.autoconnect && options.autoVendorID && options.autoProductID) {
        for (const port of await collectSerialConnectionSuggestions()) {
            if (port.vendorID === options.autoVendorID && port.productID === options.autoProductID) {
                return create(coil, port.path, options.baudrate);
            }
        }
        ipcs.connectionUI.sendConnectionError(coil, "Did not find device with specified product/vendor ID");
        return undefined;
    } else {
        return create(coil, options.serialPort, options.baudrate);
    }
}

async function connectUDP(coil: CoilID, options: UDPConnectionOptions) {
    if (options.useDesc) {
        for (const port of await collectUDPConnectionSuggestions()) {
            if (port.desc === options.remoteDesc) {
                return createMinUDPConnection(coil, options.udpMinPort, port.remoteIP);
            }
        }
        ipcs.connectionUI.sendConnectionError(coil, "Did not find UD3 with specified name");
        return undefined;
    } else {
        return createMinUDPConnection(coil, options.udpMinPort, addressFromString(options.remoteIP));
    }
}
