import {
    baudrate,
    connection_type,
    getDefaultConnectOptions, midi_port, remote_ip,
    serial_port, sid_port, telnet_port, udp_min_port
} from "../../common/ConnectionOptions";
import {connection_types, eth_node, serial_min, serial_plain, udp_min} from "../../common/constants";
import {ConnectionCandidates} from "../../common/IPCConstantsToRenderer";
import {config} from "../ipc/Misc";
import * as ui_helper from "./ui_helper";
import ChangeEvent = W2UI.ChangeEvent;

interface ScreenInfo {
    candidates: ConnectionCandidates;
    resolve: (cfg: object) => void;
    reject: (e: any) => void;
}

export async function openUI(candidates: ConnectionCandidates): Promise<any> {
    await ui_helper.openPopup({
        body: '<div id="form" style="width: 100%; height: 100%;"></div>',
        style: 'padding: 15px 0px 0px 0px',
        title: 'Connection UI',
    });
    return new Promise<any>((res, rej) => {
        recreateForm(undefined, {
            candidates: candidates, resolve: res, reject: rej
        });
    });
}

function recreateForm(selected_type: string | undefined, info: ScreenInfo) {
    let defaultValues = getDefaultConnectOptions(false, config);
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
    let fields = [
        {
            name: connection_type,
            type: "list",
            html: {
                caption: "Connection type",
            }
        }
    ];
    switch (selected_type) {
        case serial_min:
        case serial_plain: {
            let portSuggestions: W2UI.Suggestion[] = [];
            for (const port of info.candidates.serialPorts) {
                portSuggestions.push({
                    id: portSuggestions.length,
                    text: port,
                });
            }
            addWithSuggestions(fields, serial_port, "Serial port", portSuggestions, "Autoconnect");
            addField(fields, baudrate, "Baudrate", "int");
            break;
        }
        case eth_node:
            addField(fields, remote_ip, "Remote IP");
            addField(fields, telnet_port, "Telnet port", "int");
            addField(fields, midi_port, "MIDI port", "int");
            addField(fields, sid_port, "SID port", "int");
            break;
        case udp_min: {
            let suggestions: W2UI.Suggestion[] = [];
            for (const candidate of info.candidates.udpCandidates) {
                suggestions.push({
                    id: suggestions.length,
                    text: candidate.toString(),
                });
            }
            addWithSuggestions(fields, remote_ip, "Remote IP", suggestions);
            addField(fields, udp_min_port, "Remote port");
            break;
        }
        default:
            throw new Error("Unknown connection type: " + selected_type);
    }
    $().w2form({
        name: "connection_ui",
        fields: fields,
        focus: 1,
        record: defaultValues,
        actions: {
            Cancel: () => {
                w2popup.close();
                info.reject("Cancelled");
            },
            Connect: () => {
                w2popup.close();
                let ret = {};
                for (const [key, value] of Object.entries(w2ui.connection_ui.record)) {
                    if (key === connection_type) {
                        ret[key] = value["id"];
                    } else {
                        ret[key] = value;
                    }
                }
                info.resolve(ret);
            }
        }
    });
    $('#w2ui-popup #form').w2render('connection_ui');
    const selector = $("input[name=" + connection_type + "]");
    const selectorItems: { id: string, text: string }[] = [];
    for (const [id, text] of connection_types.entries()) {
        selectorItems.push({id, text});
    }
    selector.w2field("list", {
        items: selectorItems,
    });
    selector.data("selected", {id: selected_type, text: connection_types.get(selected_type)});
    selector.change();
    for (const field of fields) {
        if (field["items"]) {
            const fieldObj = $("input[name=" + field["name"] + "]");
            fieldObj.w2field(field.type, {items: field["items"]});
        }
    }
    w2ui.connection_ui.on("change", ev => onChange(ev, info));
}

function onChange(event: ChangeEvent, info: ScreenInfo) {
    if (event.target === connection_type) {
        if (!event.value_old || event.value_new !== event.value_old) {
            recreateForm(event.value_new.id, info);
        }
    }
}

function addField(fields: any[], id: string, title: string, type: string = "text", placeholder?: string): any {
    const added = {
        name: id,
        type: type,
        autoFormat: false,
        html: {
            caption: title,
            attr: placeholder ? ("placeholder=" + placeholder) : undefined
        }
    };
    fields.push(added);
    return added;
}

/**
 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
 *
 * @param {String} text The text to be rendered.
 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
 *
 * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
let canvas;

function getTextWidth(text, font) {
    // re-use canvas object for better performance
    canvas = canvas || document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = font;
    const metrics = context.measureText(text);
    return metrics.width;
}

function addWithSuggestions(fields: any[], id: string, title: string, suggestions: W2UI.Suggestion[], placeholder?: string) {
    const added = addField(fields, id, title, "combo", placeholder);
    let maxLength = 161;
    for (const suggestion of suggestions) {
        maxLength = Math.max(maxLength, getTextWidth(suggestion.text, "12px Arial") + 10);
    }
    added.html.attr += " style=\"width: " + maxLength.toString() + "px\"";
    added.items = suggestions;
}
