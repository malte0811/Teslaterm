import {
    baudrate,
    connection_type,
    getDefaultConnectOptions, midi_port, remote_ip,
    serial_port, sid_port, telnet_port, udp_min_port,
} from "../../common/ConnectionOptions";
import {connection_types, dummy, eth_node, serial_min, serial_plain, udp_min} from "../../common/constants";
import {config} from "../ipc/Misc";
import * as ui_helper from "./ui_helper";
import ChangeEvent = W2UI.ChangeEvent;

export async function openUI(): Promise<any> {
    await ui_helper.openPopup({
        body: '<div id="form" style="width: 100%; height: 100%;"></div>',
        style: 'padding: 15px 0px 0px 0px',
        title: 'Connection UI',
    });
    return new Promise<any>((res, rej) => {
        recreateForm(undefined, res, rej);
    });
}

function recreateForm(selected_type: string | undefined, resolve: (cfg: object) => void, reject: (e: any) => void) {
    const defaultValues = getDefaultConnectOptions(false, config);
    if (!defaultValues[connection_type]) {
        defaultValues[connection_type] = selected_type;
    } else if (!selected_type) {
        selected_type = defaultValues[connection_type];
    }
    if (w2ui.connection_ui) {
        for (const field of w2ui.connection_ui.fields) {
            defaultValues[field.name] = w2ui.connection_ui.record[field.name];
        }
        w2ui.connection_ui.destroy();
    }
    const fields = [{
        html: {
            caption: "Connection type",
        },
        name: connection_type,
        type: "list",
    }];
    switch (selected_type) {
        case serial_min:
        case serial_plain:
            addField(fields, serial_port, "Serial port", "text", "Autoconnect");
            addField(fields, baudrate, "Baudrate", "int");
            break;
        case eth_node:
            addField(fields, remote_ip, "Remote IP");
            addField(fields, telnet_port, "Telnet port", "int");
            addField(fields, midi_port, "MIDI port", "int");
            addField(fields, sid_port, "SID port", "int");
            break;
        case udp_min:
            addField(fields, remote_ip, "Remote IP");
            addField(fields, udp_min_port, "Remote port");
            break;
        case dummy: break;
        default:
            throw new Error("Unknown connection type: " + selected_type);
    }
    $().w2form({
        actions: {
            Cancel: () => {
                w2popup.close();
                reject("Cancelled");
            },
            Connect: () => {
                w2popup.close();
                const ret = {};
                for (const [key, value] of Object.entries(w2ui.connection_ui.record)) {
                    if (key === connection_type) {
                        ret[key] = (value as any).id;
                    } else {
                        ret[key] = value;
                    }
                }
                resolve(ret);
            },
        },
        fields,
        focus: 1,
        name: "connection_ui",
        record: defaultValues,
    });
    $('#w2ui-popup #form').w2render('connection_ui');
    const selector = $("input[name=" + connection_type + "]");
    const selectorItems: Array<{ id: string, text: string }> = [];
    for (const [id, text] of connection_types.entries()) {
        // Disable eth_node connection type if command server is in use: Eth-node is not compatible with absolute SID
        // timestamps.
        if (id !== eth_node || config.command.state === "disable") {
            selectorItems.push({id, text});
        }
    }
    selector.w2field("list", {
        items: selectorItems,
    });
    selector.data("selected", {id: selected_type, text: connection_types.get(selected_type)});
    selector.change();
    w2ui.connection_ui.on("change", (ev) => onChange(ev, resolve, reject));
}

function onChange(event: ChangeEvent, resolve: (cfg: object) => void, reject: (e: any) => void) {
    if (event.target === connection_type) {
        if (!event.value_old || event.value_new !== event.value_old) {
            recreateForm(event.value_new.id, resolve, reject);
        }
    }
}

function addField(fields: any[], id: string, title: string, type: string = "text", placeholder?: string) {
    fields[fields.length] = {
        autoFormat: false,
        html: {
            attr: placeholder ? ("placeholder=" + placeholder) : undefined,
            caption: title,
        },
        name: id,
        type,
    };
}
