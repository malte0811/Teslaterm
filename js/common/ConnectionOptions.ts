import {CONNECTION_TYPES_BY_NAME, UD3ConnectionType} from "./constants";
import {TTConfig} from "./TTConfig";

export interface  ConnectionOptions {
    connectionType: UD3ConnectionType;
    serialPort: string;
    baudrate: number;
    remoteIP: string;
    udpMinPort: number;
}

export function getDefaultConnectOptions(forAutoconnect: boolean, config: TTConfig): ConnectionOptions | undefined {
    let connectionType = CONNECTION_TYPES_BY_NAME.get(config.autoconnect);
    if (!connectionType) {
        if (forAutoconnect) {
            return undefined;
        } else {
            connectionType = UD3ConnectionType.serial_min;
        }
    }
    return {
        connectionType,
        baudrate: config.serial.baudrate,
        remoteIP: config.ethernet.remote_ip,
        serialPort: config.serial.serial_port,
        udpMinPort: config.ethernet.udpMinPort,
    };
}
