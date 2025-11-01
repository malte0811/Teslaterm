import {parseLegacyVMSFile, VMS_LEGACY_SUFFIX} from "./LegacyVMSParser";
import {
    Block,
    BlockMap,
    ConstantOrValue,
    FullVMSData,
    KnownValue,
    Modulation,
    ModulationType,
    NoteOffBehavior,
} from "./VMS";

type JsonEquivalent<T> = {
    [k in keyof T]: any;
};

const TYPE_KEY = 'file_type';
const TYPE_VMS = 'UD3-VMS';
export const VMS_JSON_SUFFIX = '.vms.json';

export function loadVMSFromFile(fileName: string, fileContent: string): [string, FullVMSData] {
    for (const {suffix, loadFile} of [
        {suffix: VMS_JSON_SUFFIX, loadFile: jsonToVMS},
        {suffix: VMS_LEGACY_SUFFIX, loadFile: parseLegacyVMSFile},
    ]) {
        if (fileName.endsWith(suffix)) {
            const newPrograms = loadFile(fileContent);
            if (newPrograms) {
                return [fileName.substring(0, fileName.length - suffix.length), newPrograms];
            }
        }
    }
    return undefined;
}

export function jsonToVMS(fileContent: string): FullVMSData {
    const mainJson: object = JSON.parse(fileContent);
    if (mainJson[TYPE_KEY] !== TYPE_VMS) {
        return undefined;
    }
    const constOrValFromJson = (json: JsonEquivalent<ConstantOrValue>): ConstantOrValue => {
        if (json.type === 'value') {
            return {...json, value: KnownValue[json.value as string]};
        } else {
            return json;
        }
    };
    const modulationFromJson = (modulation: JsonEquivalent<Modulation>): Modulation => {
        const type = ModulationType[modulation.type as string];
        switch (type) {
            case ModulationType.step:
                return {type};
            case ModulationType.exp:
            case ModulationType.exp_inverse:
                return {type, growthFactor: constOrValFromJson(modulation['growthFactor'])};
            case ModulationType.linear:
                return {type, slope: constOrValFromJson(modulation['slope'])};
            case ModulationType.sine:
                return {
                    offset: constOrValFromJson(modulation['offset']),
                    scale: constOrValFromJson(modulation['scale']),
                    timeIncrement: constOrValFromJson(modulation['timeIncrement']),
                    type,
                };
        }
    };
    const blockFromJSON = (blockJson: JsonEquivalent<Block>): Block => ({
        ...blockJson,
        modulation: modulationFromJson(blockJson.modulation),
        offBehavior: NoteOffBehavior[blockJson.offBehavior as string],
        target: KnownValue[blockJson.target as string],
        targetFactor: constOrValFromJson(blockJson.targetFactor),
    });
    const mapFromJSON = (mapJson: JsonEquivalent<BlockMap>): BlockMap => ({
        ...mapJson,
        blocks: mapJson.blocks.map(blockFromJSON),
    });
    return mainJson['programs'].map((p) => ({maps: p.maps.map(mapFromJSON), name: p.name}));
}

export function vmsToJSON(vms: FullVMSData): object {
    const constOrValToJson = (constOrVal: ConstantOrValue) => {
        const result: JsonEquivalent<ConstantOrValue> = {...constOrVal};
        if (constOrVal.type === 'value') {
            result.value = KnownValue[constOrVal.value];
        }
        return result;
    };
    const modulationToJson = (modulation: Modulation): JsonEquivalent<Modulation> => {
        const type = ModulationType[modulation.type];
        switch (modulation.type) {
            case ModulationType.step:
                return {type};
            case ModulationType.exp:
            case ModulationType.exp_inverse:
                return {type, growthFactor: constOrValToJson(modulation.growthFactor)};
            case ModulationType.linear:
                return {type, slope: constOrValToJson(modulation.slope)};
            case ModulationType.sine:
                return {
                    offset: constOrValToJson(modulation.offset),
                    scale: constOrValToJson(modulation.scale),
                    timeIncrement: constOrValToJson(modulation.timeIncrement),
                    type,
                };
        }
    };
    const blockToJSON = (block: Block): JsonEquivalent<Block> => ({
        ...block,
        modulation: modulationToJson(block.modulation),
        offBehavior: NoteOffBehavior[block.offBehavior],
        target: KnownValue[block.target],
        targetFactor: constOrValToJson(block.targetFactor),
    });
    const mapToJSON = (map: BlockMap) => ({...map, blocks: map.blocks.map(blockToJSON)});
    const result = {
        formatVersion: 1,
        programs:  vms.map((p) => ({maps: p.maps.map(mapToJSON), name: p.name})),
        type: 'VMS-Programs',
    };
    result[TYPE_KEY] = TYPE_VMS;
    return result;
}
