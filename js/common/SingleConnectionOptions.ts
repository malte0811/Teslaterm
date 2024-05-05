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

export type UD3ConnectionOptions = {
    connectionType: UD3ConnectionType.serial_min | UD3ConnectionType.serial_plain;
    options: SerialConnectionOptions;
} | {
    connectionType: UD3ConnectionType.udp_min;
    options: UDPConnectionOptions;
};

export type SingleConnectionOptions = UD3ConnectionOptions & { advanced: AdvancedOptions };

export interface MultiConnectionOptions {
    ud3Options: UD3ConnectionOptions[];
    advanced: AdvancedOptions;
}

export interface FullConnectionOptions {
    type?: UD3ConnectionType;
    serialOptions: SerialConnectionOptions;
    udpOptions: UDPConnectionOptions;
}
