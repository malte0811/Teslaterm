// Fields
import {connection_types, serial_min} from "./constants";
import {TTConfig} from "./TTConfig";

export const connection_type = "connection_type";
export const serial_port = "serial_port";
export const baudrate = "baudrate";
export const remote_ip = "remote_ip";
export const udp_min_port = "udp_min_port";


export function getDefaultConnectOptions(for_autoconnect: boolean, config: TTConfig): any {
    const ret = {
        baudrate: config.serial.baudrate,
        remote_ip: config.ethernet.remote_ip,
        serial_port: config.serial.serial_port,
        udp_min_port: config.ethernet.udpMinPort,
    };
    if (connection_types.has(config.autoconnect)) {
        ret[connection_type] = config.autoconnect;
    }
    if (for_autoconnect && !ret[connection_type]) {
        return undefined;
    } else {
        if (!ret[connection_type]) {
            ret[connection_type] = serial_min;
        }
        return ret;
    }
}
