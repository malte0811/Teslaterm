import {UD3ConnectionType} from "./constants";
import {AdvancedOptions} from "./Options";

export interface SerialConnectionOptions {
    baudrate: number;
    serialPort: string;
    autoVendorID: string;
    autoProductID: string;
    autoconnect: boolean;
}

export interface UDPConnectionOptions {
    remoteIP: string;
    udpMinPort: number;
}

export type ConnectionOptionsBase = {
    connectionType: UD3ConnectionType.serial_min | UD3ConnectionType.serial_plain;
    options: SerialConnectionOptions;
} | {
    connectionType: UD3ConnectionType.udp_min;
    options: UDPConnectionOptions;
};

export type ConnectionOptions = ConnectionOptionsBase & { advanced: AdvancedOptions };

export interface FullConnectionOptions {
    defaultConnectionType?: UD3ConnectionType;
    serialOptions: SerialConnectionOptions;
    udpOptions: UDPConnectionOptions;
}
