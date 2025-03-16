import {Client} from "basic-ftp";
import net from "net";
import {promisify} from "util";
import {withTimeout} from "../../helper";
import {getCoilCommands} from "../connection";
import {BootloadableConnection} from "./bootloadable_connection";

export async function uploadFibernetFirmware(connection: BootloadableConnection, file: number[]) {
    const ftpClient = await setupConnection(connection.getFTPAddress());
    await sendFile(ftpClient, file, 'boot.hex');
    // Delete BootDone if present, ignore if not present
    await ftpClient.remove('bootDone.hex', true);
    ftpClient.close();
    // Enter Fibernet shell
    await getCoilCommands(connection.getCoil()).sendCommand('debug fn\r');
    // Reset fibernet, and leave fibernet debug at the same time (0x03 = Ctrl+C). Since this is sent as a single frame,
    // either all or none of it should arrive.
    try {
        await getCoilCommands(connection.getCoil()).sendCommand('reset\r\u0003');
    } catch (e) {
        console.error('During fibernet reset', e);
    }
}

export async function uploadUD3FirmwareFTP(remoteAddress: string, file: number[]) {
    const remoteImageName = 'image.cyacd';

    const ftpClient = await setupConnection(remoteAddress);
    await sendFile(ftpClient, file, remoteImageName);
    await ftpClient.send(`FLASH ${remoteImageName}`);
    ftpClient.close();
}

async function setupConnection(remoteAddress: string) {
    console.log('Create client');
    const ftpClient = new Client();
    console.log('Access client');
    await ftpClient.access({
        host: remoteAddress,
        // Both of these are currently ignored by Fibernet
        password: 'ignored',
        user: 'ignored',
    });
    console.log('Return client');
    return ftpClient;
}

async function sendFile(client: Client, data: number[], fileName: string) {
    // The FTP library does not support active mode, the FTP server in FiberNet does not support passive mode. So we
    // have to write our own rudimentary active mode logic.
    const dataPort = client.ftp.socket.localPort + 1;
    const addressForPort = client.ftp.socket.localAddress.replace(/\./g, ',');
    await client.send(`PORT ${addressForPort},${Math.floor(dataPort / 256)},${dataPort % 256}`);

    const dataSocketPromise = getConnectingSocket(dataPort);
    await client.send(`STOR ${fileName}`);
    const dataSocket = await withTimeout(dataSocketPromise, 1000, 'Waiting for data connection');
    await promisify((cb: () => any) => dataSocket.end(new Uint8Array(data), cb))();
}

async function getConnectingSocket(localPort: number) {
    return new Promise<net.Socket>((res, rej) => {
        const server = new net.Server((socket) => {
            res(socket);
            server.close();
        });
        server.on('error', rej);
        server.listen(localPort);
    });
}
