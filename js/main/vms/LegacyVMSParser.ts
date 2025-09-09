import {
    AffectedValue,
    Block,
    BlockMap,
    ConstantOrValue,
    KnownValue,
    Modulation,
    ModulationType,
    NoteOffBehavior,
    Program,
} from "../../common/VMS";
import {cleanVMSConfig} from "../../common/VMSOperations";
import {parseEnumValue} from "../helper";

// TODO mvoe to wire serializer?
export enum AmbiguousValue { param1, param2, param3, targetFactor }
export interface AmbiguousValueData {
    flagMask: number;
    mainKey: string;
    rangePrefix: string;
}
export const VARIABLE_VALUE_DATA = new Map<AmbiguousValue, AmbiguousValueData>([
    [AmbiguousValue.param1, {flagMask: 1, mainKey: 'param[0]', rangePrefix: 'p1'}],
    [AmbiguousValue.param2, {flagMask: 2, mainKey: 'param[1]', rangePrefix: 'p2'}],
    [AmbiguousValue.param3, {flagMask: 4, mainKey: 'param[2]', rangePrefix: 'p3'}],
    [AmbiguousValue.targetFactor, {flagMask: 8, mainKey: 'targetValue', rangePrefix: 'tF'}],
]);

export function getConstantScale(value: AmbiguousValue, modulation: ModulationType) {
    if (value === AmbiguousValue.targetFactor) {
        return 1e6;
    }
    switch (modulation) {
        case ModulationType.exp:
        case ModulationType.exp_inverse:
            return 1e3;
        case ModulationType.linear:
            return 1e6;
        case ModulationType.sine:
            switch (value) {
                case AmbiguousValue.param1:
                    return 2e3;
                case AmbiguousValue.param2:
                    return 1e6;
                case AmbiguousValue.param3:
                    return 1;
            }
    }
    return 1;
}

class VMSDataMap {
    public readonly map = new Map<string, string | VMSDataMap>();

    public getAsInt(key: string) {
        const value = Number.parseInt(this.getAsString(key), 10);
        return isNaN(value) ? 0 : value;
    }

    public getAsIntOrUndef(key: string) {
        const value = Number.parseInt(this.getAsString(key), 10);
        return isNaN(value) ? undefined : value;
    }

    public getAsBool(key: string) {
        const value = this.getAsString(key);
        if (value === 'true') {
            return true;
        } else if (value === 'false') {
            return false;
        } else {
            console.log('Unexpected boolean: "' + value + '"');
            throw new Error('Failed to parse VMS file');
        }
    }

    public getAsMap(key: string) {
        return this.map.get(key) as VMSDataMap;
    }

    public getAsString(key: string) {
        return this.map.get(key) as string;
    }
}

function parseVMSToStructuredMap(data: Buffer) {
    const lines = data.toString('utf8')
        .replace(/[\t,\u0000\r]*/g, '')
        .split('\n');
    const toplevel = new VMSDataMap();
    const currentStack: VMSDataMap[] = [toplevel];
    for (const line of lines) {
        if (line.length === 0) { continue; }
        const currentMap = currentStack[currentStack.length - 1];
        if (line.includes('}')) {
            currentStack.pop();
        } else if (line.includes('=')) {
            const split = line.split('=');
            currentMap.map.set(split[0], split[1]);
        } else if (line.includes(':')) {
            let name = line.substring(0, line.indexOf(':'));
            if (name.startsWith('"') && name.endsWith('"')) {
                name = name.substring(1, name.length - 1);
            }
            const newMap = new VMSDataMap();
            currentMap.map.set(name, newMap);
            currentStack.push(newMap);
        } else {
            console.log(`Ignoring unknown line "${line}"`);
        }
    }
    return toplevel;
}

function parseConstOrValue(
    blockData: VMSDataMap, valueInBlock: AmbiguousValue, modulation: ModulationType,
): ConstantOrValue {
    const data = VARIABLE_VALUE_DATA.get(valueInBlock);
    const rawValue = blockData.getAsInt(data.mainKey);
    const flags = blockData.getAsInt('flags');
    if ((flags & data.flagMask) !== 0) {
        const value = rawValue;
        const rangeStart = blockData.getAsInt(data.rangePrefix + 'RangeStart');
        const rangeEnd = blockData.getAsInt(data.rangePrefix + 'RangeEnd');
        return {type: 'value', value, rangeStart, rangeEnd};
    } else {
        return {type: 'constant', value: rawValue / getConstantScale(valueInBlock, modulation)};
    }
}

const MODULATION_TYPE_NAMES = new Map<string, ModulationType>([
    ['VMS_EXP',  ModulationType.exp],
    ['VMS_EXP_INV',  ModulationType.exp_inverse],
    ['VMS_JUMP',  ModulationType.step],
    ['VMS_LIN',  ModulationType.linear],
    ['VMS_SIN',  ModulationType.sine],
]);

function parseModulation(blockData: VMSDataMap): Modulation {
    const type = MODULATION_TYPE_NAMES.get(blockData.getAsString('type'));
    const param1 = parseConstOrValue(blockData, AmbiguousValue.param1, type);
    const param2 = parseConstOrValue(blockData, AmbiguousValue.param2, type);
    const param3 = parseConstOrValue(blockData, AmbiguousValue.param3, type);
    switch (type) {
        case ModulationType.exp:
            return {type: ModulationType.exp, growthFactor: param1};
        case ModulationType.exp_inverse:
            return {type: ModulationType.exp_inverse, growthFactor: param1};
        case ModulationType.linear:
            return {type: ModulationType.linear, slope: param1};
        case ModulationType.sine:
            return {type: ModulationType.sine, timeIncrement: param3, offset: param2, scale: param1};
        case ModulationType.step:
            return {type: ModulationType.step};
    }
}

function parseBlocksFromStructure(mapData: VMSDataMap, keyPrefix: string): Block[] {
    const blocks: Block[] = [];
    for (const key of mapData.map.keys()) {
        if (!key.startsWith(keyPrefix)) {
            continue;
        }
        const blockMap = mapData.getAsMap(key);
        const modulation = parseModulation(blockMap);
        const newBlock: Block = {
            modulation,
            offBehavior: parseEnumValue(blockMap.getAsString('offBehavior'), NoteOffBehavior),
            offBlock: blockMap.getAsIntOrUndef('offBlock'),
            outputBlocks: [
                blockMap.getAsIntOrUndef('nextBlock[0]'),
                blockMap.getAsIntOrUndef('nextBlock[1]'),
                blockMap.getAsIntOrUndef('nextBlock[2]'),
                blockMap.getAsIntOrUndef('nextBlock[3]'),
            ],
            periodMS: blockMap.getAsInt('param[3]'),
            target: parseEnumValue(blockMap.getAsString('target'), KnownValue) as AffectedValue,
            targetFactor: parseConstOrValue(blockMap, AmbiguousValue.targetFactor, modulation.type),
            uid: blockMap.getAsInt('uid'),
            visualX: blockMap.getAsInt('x'),
            visualY: blockMap.getAsInt('y'),
        };
        newBlock.outputBlocks = newBlock.outputBlocks.filter((b) => b !== undefined && b !== -1);
        if (newBlock.offBlock === -1) {
            newBlock.offBlock = undefined;
        }
        // TODO for wire serializer: Blocks with no outputs should get VMS_FLAG_ISBLOCKPERSISTENT (?)

        // "block -1" is used as the start block, and does not contain any useful data
        // TODO find good concept for this in new data and editor!
        if (newBlock.uid !== -1) {
            blocks.push(newBlock);
        }
    }
    return blocks;
}

export function parseLegacyVMSFile(bytes: Buffer) {
    const data = parseVMSToStructuredMap(bytes);
    const initialResult = parseProgramsFromStructure(data.getAsMap('MidiPrograms'));
    return cleanVMSConfig(initialResult);
}

function parseMapFromStructure(mapData: VMSDataMap): BlockMap {
    const blocks = parseBlocksFromStructure(mapData, 'block');
    const freqIsOffset = mapData.getAsBool('FREQ_MODE');
    const freqValue = mapData.getAsInt('noteFrequency');
    return {
        blocks,
        options: {
            enablePortamento: mapData.getAsBool('ENA_PORTAMENTO'),
            enableDamper: mapData.getAsBool('ENA_DAMPER'),
            enablePitchbend: mapData.getAsBool('ENA_PITCHBEND'),
            enableStereo: mapData.getAsBool('ENA_STEREO'),
            enableVolume: mapData.getAsBool('ENA_VOLUME'),
            endNote: mapData.getAsInt('endNote'),
            noteFrequency: freqIsOffset ? {type: 'offset', midiNotes: freqValue} : {
                frequencyHz: freqValue,
                type: 'fixed',
            },
            startNote: mapData.getAsInt('startNote'),
            volumeScale: mapData.getAsInt('volumeModifier') / 255,
        },
        startBlock: mapData.getAsInt('startBlock'),
    };
}

function parseProgramsFromStructure(programsMap: VMSDataMap): Program[] {
    const programs: Program[] = [];
    for (const name of programsMap.map.keys()) {
        const maps: BlockMap[] = [];
        for (const mapData of programsMap.getAsMap(name).map.values()) {
            maps.push(parseMapFromStructure(mapData as VMSDataMap));
        }
        programs.push({maps, name});
    }
    return programs;
}
