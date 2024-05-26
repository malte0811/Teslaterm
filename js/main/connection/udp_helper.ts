import * as dgram from "dgram";
import os from "os";
import {promisify} from "util";

function createSocket(onError: (err) => any): dgram.Socket {
    let socket = dgram.createSocket("udp4");
    socket.on('end', () => {
    });
    socket.on('error', onError);
    return socket;
}

function ipv4ToBytes(ipv4Address: string) {
    return ipv4Address.split('.').map((s) => Number.parseInt(s, 10));
}

function bytesToIPv4(parts: number[]) {
    return parts.map((i) => i.toString()).join('.');
}

export function computeBroadcastAddress(netInterface: os.NetworkInterfaceInfoIPv4) {
    const netmaskParts = ipv4ToBytes(netInterface.netmask);
    const addressParts = ipv4ToBytes(netInterface.address);
    // Broadcast matches address where netmask is 1, and is 1 where netmask is 0
    const broadcastParts = netmaskParts.map((mask, i) => ((mask & addressParts[i]) | ~mask) & 0xff);
    return bytesToIPv4(broadcastParts);
}

function bind(socket: dgram.Socket): Promise<void> {
    return promisify<void>(cb => socket.bind(() => cb(undefined)))();
}

export async function createBroadcastSocket(): Promise<dgram.Socket> {
    const socket = createSocket((e) => {
        throw e;
    });
    await bind(socket);
    socket.setBroadcast(true);
    return socket;
}

export async function createUDPSocket(remotePort: number, remoteAddress: string): Promise<dgram.Socket> {
    return new Promise<dgram.Socket>((res, rej) => {
        const socket = createSocket(rej);
        socket.connect(remotePort, remoteAddress, () => res(socket));
    });
}
