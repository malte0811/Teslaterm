import * as dgram from "dgram";
import {promisify} from "util";

function createSocket(onError: (err) => any): dgram.Socket {
    let socket = dgram.createSocket("udp4");
    socket.on('end', () => {
    });
    socket.on('error', onError);
    return socket;
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
