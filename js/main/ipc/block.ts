import {DroppedFile} from "../../common/IPCConstantsToMain";
import {ChannelID, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {loadVMSFromFile} from "../../common/vms/VMSFileIO";
import {forEachCoil, getMixer, getOptionalUD3Connection} from "../connection/connection";
import {setUIConfig} from "../UIConfigHandler";
import {sendBlocks} from "../vms/VMSWireSerializer";
import {ipcs} from "./IPCProvider";

export function loadVMS(file: DroppedFile) {
    try {
        ipcs.misc.openGenericToast('VMS', "Load VMS file: " + file.name, ToastSeverity.info);
        const [_, programs] = loadVMSFromFile(file.name, Buffer.from(file.bytes).toString());
        const totalBlocks = programs.map(
            p => p.maps.map(map => map.blocks.length).reduce((a, b) => a + b),
        ).reduce((a, b) => a + b);
        ipcs.misc.openGenericToast('VMS', "Found " + totalBlocks + " blocks", ToastSeverity.info);
        forEachCoil((coil) => {
            const connection = getOptionalUD3Connection(coil);
            if (!connection) { return; }
            if (connection.getProtocolVersion() >= 3.0) {
                sendBlocks(programs, connection);
            } else {
                ipcs.coilMisc(connection.getCoil()).openToast(
                    'VMS', 'Please update UD3 firmware to upload VMS', ToastSeverity.error,
                );
            }
        });
        getMixer()?.setProgramsByVoice(new Map<ChannelID, number>());
        setUIConfig({midiPrograms: programs.map((p) => p.name)});
    } catch (e) {
        ipcs.misc.openGenericToast('VMS', "Failed to load blocks: " + e, ToastSeverity.error);
        console.error(e);
    }
}
