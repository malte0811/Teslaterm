import * as fs from "fs";
import {ConnectionPreset} from "../common/IPCConstantsToRenderer";
import {getDefaultAdvancedOptions} from "../common/TTConfig";
import {convertArrayBufferToString} from "./helper";
import {config} from "./init";

export interface UIConfig {
    connectionPresets: ConnectionPreset[];
}

let uiConfig: UIConfig | undefined;
const FILENAME = 'tt-ui-config.json';

function getFileData() {
    try {
        const json = convertArrayBufferToString(fs.readFileSync(FILENAME));
        const object: UIConfig = JSON.parse(json);
        for (const preset of object.connectionPresets) {
            if (!preset.options.advanced) {
                preset.options.advanced = getDefaultAdvancedOptions(config);
            }
        }
        return object;
    } catch (x) {
        console.log("Failed to read UI config:", x);
    }
}

export function getUIConfig() {
    if (!uiConfig) {
        uiConfig = {connectionPresets: [], ...getFileData()};
    }
    return uiConfig;
}

export function setUIConfig(newConfig: UIConfig) {
    uiConfig = newConfig;
    fs.writeFileSync(FILENAME, JSON.stringify(newConfig));
}
