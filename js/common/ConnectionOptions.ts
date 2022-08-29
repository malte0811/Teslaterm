import {UD3ConnectionType} from "./constants";

export interface SerialConnectionOptions {
    baudrate: number;
    serialPort?: string;
    autoVendorID?: string;
    autoProductID?: string;
}

export interface UDPConnectionOptions {
    remoteIP: string;
    udpMinPort: number;
}

export type ConnectionOptions = {
    connectionType: UD3ConnectionType.serial_min | UD3ConnectionType.serial_plain;
    options: SerialConnectionOptions;
} | {
    connectionType: UD3ConnectionType.udp_min;
    options: UDPConnectionOptions;
} | {
    connectionType: UD3ConnectionType.dummy;
    options: {};
};

export interface FullConnectionOptions {
    defaultConnectionType?: UD3ConnectionType;
    serialOptions: SerialConnectionOptions;
    udpOptions: UDPConnectionOptions;
}
