import * as fs from "fs";
import * as ini from "ini";
import * as os from "os";
import {
    FEATURE_MINSID,
    FEATURE_NOTELEMETRY,
    FEATURE_TIMEBASE,
    FEATURE_TIMECOUNT,
} from "../common/constants";
import {TTConfig} from "../common/TTConfig";
import {convertArrayBufferToString} from "./helper";

interface ChangedFlag {
    changed: boolean;
}

const defaultUDFeatures: Map<string, string> = new Map([
    ["protocol", "2.0"],
    ["build_time", ""],
    [FEATURE_TIMEBASE, "3.125"],
    [FEATURE_TIMECOUNT, "down"],
    [FEATURE_NOTELEMETRY, "0"],
    [FEATURE_MINSID, "0"],
]);

const defaultUDConfigPages: Map<string, number> = new Map([
    ["offtime", 1],
    ["watchdog", 0],
    ["max_tr_pw", 1],
    ["max_tr_prf", 1],
    ["max_qcw_pw", 1],
    ["max_tr_current", 5],
    ["min_tr_current", 5],
    ["max_qcw_current", 5],
    ["temp1_max", 6],
    ["temp2_max", 6],
    ["temp1_setpoint", 6],
    ["temp2_setpoint", 6],
    ["temp2_mode", 6],
    ["ct1_ratio", 2],
    ["ct2_ratio", 2],
    ["ct3_ratio", 2],
    ["ct1_burden", 2],
    ["ct2_burden", 2],
    ["ct3_burden", 2],
    ["ct2_type", 2],
    ["max_fb_errors", 2],
    ["lead_time", 1],
    ["start_freq", 2],
    ["start_cycles", 2],
    ["max_tr_duty", 0],
    ["max_qcw_duty", 0],
    ["batt_lockout_v", 0],
    ["slr_fswitch", 0],
    ["slr_vbus", 0],
    ["ps_scheme", 0],
    ["autotune_s", 0],
    ["ud_name", 3],
    ["ip_addr", 3],
    ["ip_gateway", 3],
    ["ip_subnet", 3],
    ["ip_mac", 3],
    ["min_enable", 4],
    ["max_inst_i", 5],
    ["max_therm_i", 5],
    ["eth_hw", 3],
    ["ssid", 3],
    ["passwd", 3],
    ["vol_mod", 7],
    ["synth_filter", 7],
    ["ntc_b", 6],
    ["ntc_r25", 6],
    ["ntc_idac", 6],
    ["max_dc_curr", 5],
    ["pid_curr_p", 5],
    ["pid_curr_i", 5],
    ["max_const_i", 5],
    ["max_fault_i", 5],
]);


class ConfigEntry {
    public readonly value: any;
    public desc: string | undefined;

    constructor(value: any, desc?: string) {
        this.value = value;
        this.desc = desc;
    }
}

class ConfigSection {
    public readonly contents: Map<string, ConfigEntry>;
    public desc: string | undefined;

    constructor(desc?: string) {
        this.contents = new Map<string, ConfigEntry>();
        this.desc = desc;
    }

    public getOrWrite<T>(key: string, defaultValue: T, changed: ChangedFlag, description?: string): T {
        if (this.contents.has(key)) {
            const retEntry = this.contents.get(key);
            retEntry.desc = description;
            const ret = retEntry.value;
            if (typeof (defaultValue) === "number" && typeof (ret) === "string") {
                return parseInt(ret, 10) as unknown as T;
            } else if (typeof (defaultValue) === "boolean" && typeof (ret) === "string") {
                return (ret === "true") as unknown as T;
            } else {
                return ret as T;
            }
        } else {
            this.contents.set(key, new ConfigEntry(defaultValue, description));
            changed.changed = true;
            return defaultValue;
        }
    }
}

class Config {
    public readonly contents: Map<string, ConfigSection>;

    constructor() {
        this.contents = new Map<string, ConfigSection>();
    }

    public get(section: string, entry: string): ConfigEntry {
        return this.contents.get(section).contents.get(entry);
    }

    public getOrCreateSection(name: string, desc?: string): ConfigSection {
        if (!this.contents.has(name)) {
            this.contents.set(name, new ConfigSection());
        }
        const ret = this.contents.get(name);
        ret.desc = desc;
        return ret;
    }
}

export function loadConfig(filename: string): TTConfig {
    let contents: string = "";
    if (fs.existsSync(filename)) {
        contents = convertArrayBufferToString(fs.readFileSync(filename));
    }
    const config = configFromString(contents);
    const changed: ChangedFlag = {changed: false};

    const udconfig = config.getOrCreateSection(
        "udconfig",
        "Each entry indicates which page the corresponding UD3 option should be shown on in the UD3 config GUI",
    );
    const udFeaturesInConfig = config.getOrCreateSection(
        "defaultUDFeatures",
        "Default values for features of the UD3. These values will only be used if the UD3 does not specify " +
        "the correct values to use.",
    );
    const ttConfig: TTConfig = {
        defaultUDFeatures: readSectionFromMap<string>(defaultUDFeatures, udFeaturesInConfig, changed),
        udConfigPages: readSectionFromMap<number>(defaultUDConfigPages, udconfig, changed),
    };
    if (changed.changed) {
        fs.writeFile(filename, configToString(config), (err) => {
            if (err) {
                console.warn("Failed to write new config!", err);
            } else {
                console.log("Successfully updated config");
            }
        });
    }
    return ttConfig;
}

function readSectionFromMap<T>(defaults: Map<string, T>, section: ConfigSection, changed: ChangedFlag): Map<string, T> {
    const allNames = new Set<string>(defaults.keys());
    for (const key of section.contents.keys()) {
        allNames.add(key);
    }
    const output = new Map<string, T>();
    for (const name of allNames) {
        output.set(name, section.getOrWrite(name, defaults.get(name), changed));
    }
    return output;
}

function configFromString(contents: string): Config {
    const ret = new Config();
    const iniData = ini.parse(contents);
    for (const [key, value] of Object.entries(iniData)) {
        const section = new ConfigSection();
        for (const [subKey, subValue] of Object.entries(value)) {
            section.contents.set(subKey, new ConfigEntry(subValue));
        }
        ret.contents.set(key, section);
    }
    return ret;
}

function configToString(config: Config): string {
    const configObject = {};
    for (const [key, section] of config.contents.entries()) {
        const sectionObject = {};
        for (const [sectionKey, value] of section.contents.entries()) {
            sectionObject[sectionKey] = value.value;
        }
        configObject[key] = sectionObject;
    }
    const iniString = ini.stringify(configObject);
    const iniLines = iniString.split(/\r?\n/);
    const resultLines = [];
    let currentSection: string | undefined;
    for (const iniLine of iniLines) {
        const sectionMatch = /\[(.*)]/.exec(iniLine);
        let comment: string | undefined;
        if (sectionMatch !== null) {
            currentSection = sectionMatch[1];
            comment = config.contents.get(currentSection).desc;
        } else {
            const entryMatch = /(\S*)=\S*/.exec(iniLine);
            if (entryMatch !== null) {
                const currentEntry = entryMatch[1];
                const configEntry = config.get(currentSection, currentEntry);
                comment = configEntry.desc;
            }
        }
        if (comment) {
            resultLines.push(";" + comment);
        }
        resultLines.push(iniLine);
    }
    return resultLines.join(os.EOL);
}
