import {
    baudrate,
    connection_type,
    getDefaultConnectOptions, remote_ip,
    serial_port, udp_min_port,
} from "../../common/ConnectionOptions";
import {connection_types, dummy, serial_min, serial_plain, udp_min} from "../../common/constants";
import {IUDPConnectionSuggestion} from "../../common/IPCConstantsToRenderer";
import {config} from "../ipc/Misc";
import * as ui_helper from "./ui_helper";
import ChangeEvent = W2UI.ChangeEvent;

interface IScreenInfo {
    resolve: (cfg: object) => void;
    reject: (e: any) => void;
}

let serialSuggestions: string[] = [];
let udpSuggestions: IUDPConnectionSuggestion[] = [];

function getSerialSuggestions(): W2UI.Suggestion[] {
    return serialSuggestions.map((port, id) => {
        return {id, text: port};
    });
}

function getUDPSuggestions(): W2UI.Suggestion[] {
    return udpSuggestions.map((candidate, id) => {
        let text: string;
        if (candidate.desc) {
            text = candidate.desc +" (" + candidate.remoteIP + ")";
        } else {
            text = candidate.remoteIP;
        }
        return {id, text};
    });
}

export function setSerialSuggestions(ports: string[]) {
    serialSuggestions = ports;
    console.log(ports);
    const selector = $("input[name=" + serial_port + "]");
    if (selector.length > 0) {
        selector.w2field("combo", {items: getSerialSuggestions()});
    }
}

export function addUDPSuggestion(added: IUDPConnectionSuggestion) {
    udpSuggestions.push(added);
    const selector = $("input[name=" + remote_ip + "]");
    if (selector.length > 0) {
        selector.w2field("combo", {items: getUDPSuggestions()});
    }
}

export async function openUI(): Promise<any> {
    udpSuggestions = [];
    serialSuggestions = [];
    await ui_helper.openPopup({
        body: '<div id="form" style="width: 100%; height: 100%;"></div>',
        style: 'padding: 15px 0px 0px 0px',
        title: 'Connection UI',
    });
    return new Promise<any>((res, rej) => {
        recreateForm(undefined, {reject: rej, resolve: res});
    });
}

function recreateForm(selected_type: string | undefined, info: IScreenInfo) {
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
    const fields: W2UI.W2FieldData[] = [{
        html: {
            caption: "Connection type",
        },
        name: connection_type,
        type: "list",
    }];
    switch (selected_type) {
        case serial_min:
        case serial_plain: {
            addWithSuggestions(fields, serial_port, "Serial port", getSerialSuggestions(), "Autoconnect");
            addField(fields, baudrate, "Baudrate", "int");
            break;
        }
        case udp_min: {
            addWithSuggestions(fields, remote_ip, "Remote IP", getUDPSuggestions());
            addField(fields, udp_min_port, "Remote port");
            break;
        }
        case dummy: break;
        default:
            throw new Error("Unknown connection type: " + selected_type);
    }
    $().w2form({
        actions: {
            Cancel: () => {
                w2popup.close();
                info.reject("Cancelled");
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
                info.resolve(ret);
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
        selectorItems.push({id, text});
    }
    selector.w2field("list", {
        items: selectorItems,
    });
    selector.data("selected", {id: selected_type, text: connection_types.get(selected_type)});
    selector.change();
    for (const field of fields) {
        if (field.items) {
            const fieldObj = $("input[name=" + field.name + "]");
            fieldObj.w2field(field.type, {items: field.items});
        }
    }
    w2ui.connection_ui.on("change", (ev) => onChange(ev, info));
}

function onChange(event: ChangeEvent, info: IScreenInfo) {
    if (event.target === connection_type) {
        if (!event.value_old || event.value_new !== event.value_old) {
            recreateForm(event.value_new.id, info);
        }
    }
}

function addField(
    fields: W2UI.W2FieldData[], id: string, title: string, type: string = "text", placeholder?: string,
): any {
    const added = {
        autoFormat: false,
        html: {
            attr: placeholder ? ("placeholder=" + placeholder) : undefined,
            caption: title,
        },
        name: id,
        type,
    };
    fields.push(added);
    return added;
}

function addWithSuggestions(
    fields: W2UI.W2FieldData[], id: string, title: string, suggestions: W2UI.Suggestion[], placeholder?: string,
) {
    const added = addField(fields, id, title, "combo", placeholder);
    added.items = suggestions;
}
