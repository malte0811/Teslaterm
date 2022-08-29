import * as fs from "fs";
import {ConnectionPreset} from "../common/IPCConstantsToRenderer";
import {convertArrayBufferToString} from "./helper";

export interface UIConfig {
    connectionPresets: ConnectionPreset[];
}

let uiConfig: UIConfig | undefined;
const FILENAME = 'tt-ui-config.json';

function getFileData() {
    try {
        const content = convertArrayBufferToString(fs.readFileSync(FILENAME));
        return JSON.parse(content);
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
