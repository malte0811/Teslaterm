import {SerialPort} from "serialport";
import {AvailableSerialPort, IUDPConnectionSuggestion} from "../../../common/IPCConstantsToRenderer";
import {convertArrayBufferToString, sleep} from "../../helper";
import {ipcs} from "../../ipc/IPCProvider";
import {createBroadcastSocket} from "../udp_helper";

export function sendConnectionSuggestions(windowKey: any) {
    Promise.all([sendSerialConnectionSuggestions(windowKey), sendUDPConnectionSuggestions(windowKey)])
        .catch((err) => console.error("While sending connection suggestions: ", err));
}

async function sendUDPConnectionSuggestions(windowKey: any) {
    const suggestions: IUDPConnectionSuggestion[] = [];
    const udpSocket = await createBroadcastSocket();
    udpSocket.send("FINDReq=1;\0", 50022, "255.255.255.255");
    udpSocket.on('message', (msg, rinfo) => {
        const asString = convertArrayBufferToString(msg);
        if (asString.startsWith("FIND=1;")) {
            const parts = asString.split(";");
            let name;
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
                suggestions.push({remoteIP: rinfo.address, desc: name});
                ipcs.connectionUI.suggestUDP(windowKey, suggestions);
            }
        }
    });
    await sleep(1000);
    udpSocket.close();
}

async function sendSerialConnectionSuggestions(windowKey: any) {
    const serialPorts: AvailableSerialPort[] = (await SerialPort.list())
        .filter((port) => port.productId)
        .map((port) => ({
            manufacturer: port.manufacturer,
            path: port.path,
            productID: port.productId,
            vendorID: port.vendorId,
        }));
    ipcs.connectionUI.suggestSerial(windowKey, serialPorts);
}
