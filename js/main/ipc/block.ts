import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {ToastSeverity, VoiceID} from "../../common/IPCConstantsToRenderer";
import {forEachCoil, getConnectionState} from "../connection/connection";
import {setUIConfig} from "../UIConfigHandler";
import {ipcs} from "./IPCProvider";

class VMSDataMap {
    public readonly map = new Map<string, string | VMSDataMap>();

    public getAsInt(key: string) {
        const value = Number.parseInt(this.getAsString(key), 10);
        return isNaN(value) ? 0 : value;
    }

    public getAsBool(key: string) {
        return this.getAsString(key) === 'true';
    }

    public getMapped(key: string, map: Map<string, number>) {
        return map.get(this.getAsString(key));
    }

    public getAsMap(key: string) {
        return this.map.get(key) as VMSDataMap;
    }

    public getAsString(key: string) {
        return this.map.get(key) as string;
    }
}

interface Block {
    uid: number;
    outsEnabled: boolean;
    nextBlock0: number;
    nextBlock1: number;
    nextBlock2: number;
    nextBlock3: number;
    offBlock: number;
    offBehavior: number;
    type: number;
    target: number;
    thresholdDirection: number;
    targetValue: number;
    param0: number;
    param1: number;
    param2: number;
    param3: number;
    flags: number;
}

interface BlockMap {
    startNote: number;
    endNote: number;
    noteFrequency: number;
    volumeModifier: number;
    enablePitchbend: boolean;
    enableStereo: boolean;
    enableVolume: boolean;
    enableDamper: boolean;
    ENA_PORTAMENTO: boolean;
    frequencyMode: boolean;
    startBlock: number;
    blocks: Block[];
}

interface Program {
    maps: BlockMap[];
    name: string;
}

// "Main" function
export function loadVMS(file: TransmittedFile) {
    try {
        ipcs.misc.openGenericToast('VMS', "Load VMS file: " + file.name, ToastSeverity.info);
        const data = parseVMSToStructuredMap(file.contents);
        const programs = parseProgramsFromStructure(data.getAsMap('MidiPrograms'));
        const totalBlocks = programs.map(
            p => p.maps.map(map => map.blocks.length).reduce((a, b) => a + b),
        ).reduce((a, b) => a + b);
        ipcs.misc.openGenericToast('VMS', "Found " + totalBlocks + " blocks", ToastSeverity.info);
        sendBlocks(programs);
        ipcs.mixer.setProgramsByVoice(new Map<VoiceID, number>());
        setUIConfig({midiPrograms: programs.map((p) => p.name)});
        ipcs.mixer.sendAvailablePrograms();
    } catch (e) {
        ipcs.misc.openGenericToast('VMS', "Failed to load blocks: " + e, ToastSeverity.error);
        console.error(e);
    }
}

// File parsing
function parseVMSToStructuredMap(data: Uint8Array) {
    const lines = Buffer.from(data)
        .toString('utf8')
        .replace(/[\t,\u0000]*/g, '')
        .split('\r\n');
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

function parseBlocksFromStructure(mapData: VMSDataMap, keyPrefix: string): Block[] {
    const blocks: Block[] = [];
    for (const key of mapData.map.keys()) {
        if (!key.startsWith(keyPrefix)) {
            continue;
        }
        const blockMap = mapData.map.get(key) as VMSDataMap;
        blocks.push({
            uid: blockMap.getAsInt('uid'),
            outsEnabled: blockMap.getAsBool('outsEnabled'),
            nextBlock0: blockMap.getAsInt('nextBlock[0]'),
            nextBlock1: blockMap.getAsInt('nextBlock[1]'),
            nextBlock2: blockMap.getAsInt('nextBlock[2]'),
            nextBlock3: blockMap.getAsInt('nextBlock[3]'),
            offBlock: blockMap.getAsInt('offBlock'),
            offBehavior: blockMap.getMapped('offBehavior', NOTEOFF_BEHAVIOR),
            type: blockMap.getMapped('type', VMS_MODTYPE),
            target: blockMap.getMapped('target', KNOWN_VALUE),
            thresholdDirection: blockMap.getMapped('thresholdDirection', DIRECTION),
            targetValue: blockMap.getAsInt('targetValue'),
            param0: blockMap.getAsInt('param[0]'),
            param1: blockMap.getAsInt('param[1]'),
            param2: blockMap.getAsInt('param[2]'),
            param3: blockMap.getAsInt('param[3]'),
            flags: blockMap.getAsInt('flags'),
        });
    }
    return blocks;
}

function parseMapFromStructure(mapData: VMSDataMap): BlockMap {
    const blocks = parseBlocksFromStructure(mapData, 'block');
    return {
        startNote: mapData.getAsInt('startNote'),
        endNote: mapData.getAsInt('endNote'),
        noteFrequency: mapData.getAsInt('noteFrequency'),
        volumeModifier: mapData.getAsInt('volumeModifier'),
        enablePitchbend: mapData.getAsBool('ENA_PITCHBEND'),
        enableStereo: mapData.getAsBool('ENA_STEREO'),
        enableVolume: mapData.getAsBool('ENA_VOLUME'),
        enableDamper: mapData.getAsBool('ENA_DAMPER'),
        ENA_PORTAMENTO: mapData.getAsBool('ENA_PORTAMENTO'),
        frequencyMode: mapData.getAsBool('FREQ_MODE'),
        startBlock: mapData.getAsInt('startBlock'),
        blocks: blocks,
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

// Packet format/conversion
function prepareBlockBuffer(): [ArrayBuffer, DataView] {
    const buf = new ArrayBuffer(65);
    const view = new DataView(buf);
    view.setUint8(0, 1);
    return [buf, view];
}

function prepareHeaderBuffer(): [ArrayBuffer, DataView] {
    const buf = new ArrayBuffer(20);
    const view = new DataView(buf);
    view.setUint8(0, 2);
    return [buf, view];
}

function sendToAll(frame: ArrayBuffer) {
    forEachCoil(
        (coil) => getConnectionState(coil).getActiveConnection().sendVMSFrames(Buffer.from(frame)),
    );
}

function sendBlock(block: Block) {
    const [buf, view] = prepareBlockBuffer();
    let index: number = 1;
    const writeUint32 = (value: number) => {
        view.setUint32(index, value);
        index += 4;
    };
    writeUint32(block.uid);
    if (block.outsEnabled === false) {
        writeUint32(0xDEADBEEF);
    } else {
        writeUint32(block.nextBlock0);
    }
    writeUint32(block.nextBlock1);
    writeUint32(block.nextBlock2);
    writeUint32(block.nextBlock3);
    writeUint32(block.offBlock);

    writeUint32(block.offBehavior);
    writeUint32(block.type);
    writeUint32(block.target);
    writeUint32(block.thresholdDirection);
    writeUint32(block.targetValue);
    writeUint32(block.param0);
    writeUint32(block.param1);
    writeUint32(block.param2);
    writeUint32(block.param3);
    writeUint32(block.flags);
    sendToAll(buf);
}

function sendNullBlock() {
    sendToAll(prepareBlockBuffer()[0]);
}

function sendProgramHeader(programID: number, program: Program) {
    const [buf, view] = prepareHeaderBuffer();
    let index: number = 1;
    view.setUint8(index, program.maps.length);
    index++;
    view.setUint8(index, programID);
    index++;
    new TextEncoder().encode(program.name).forEach((c) => {
        view.setUint8(index, c);
        index++;
    });
    sendToAll(buf);
}

function sendNullHeader() {
    sendToAll(prepareHeaderBuffer()[0]);
}

function sendMapEntry(entry: BlockMap) {
    const buf = new ArrayBuffer(11);
    const view = new DataView(buf);
    let index: number = 0;
    view.setUint8(index, 3);
    index++;
    view.setUint8(index, entry.startNote);
    index++;
    view.setUint8(index, entry.endNote);
    index++;
    view.setUint16(index, entry.noteFrequency);
    index += 2;
    view.setUint8(index, entry.volumeModifier);
    index++;
    let flag = 0;
    if (entry.enablePitchbend) {
        flag |= FLAGS.MAP_ENA_PITCHBEND;
    }
    if (entry.enableStereo) {
        flag |= FLAGS.MAP_ENA_STEREO;
    }
    if (entry.enableVolume) {
        flag |= FLAGS.MAP_ENA_VOLUME;
    }
    if (entry.enableDamper) {
        flag |= FLAGS.MAP_ENA_DAMPER;
    }
    if (entry.ENA_PORTAMENTO) {
        flag |= FLAGS.MAP_ENA_PORTAMENTO;
    }
    if (entry.frequencyMode) {
        flag |= FLAGS.MAP_FREQ_MODE;
    }
    view.setUint8(index, flag);
    index++;
    view.setUint32(index, entry.startBlock);
    sendToAll(buf);
}

function sendFlush() {
    const buf = new ArrayBuffer(1);
    new DataView(buf).setUint8(0, 4);
    sendToAll(buf);
}

function sendBlocks(programs: Program[]) {
    for (const program of programs) {
        for (const map of program.maps) {
            for (const block of map.blocks) {
                if (block.uid !== -1) {
                    sendBlock(block);
                }
            }
        }
    }
    sendNullBlock();
    programs.forEach((program, id) => {
        sendProgramHeader(id, program);
        program.maps.forEach(sendMapEntry);
    });
    sendNullHeader();
    sendFlush();
}

// Magic numbers

const NOTEOFF_BEHAVIOR = new Map<string, number>().set('INVERTED', 0).set('NORMAL', 1);

const VMS_MODTYPE = new Map<string, number>()
    .set('VMS_EXP', 0).set('VMS_EXP_INV', 1).set('VMS_LIN', 2).set('VMS_SIN', 3).set('VMS_JUMP', 4);

const KNOWN_VALUE = new Map<string, number>()
    .set('maxOnTime', 0).set('minOnTime', 1).set('onTime', 2)
    .set('otCurrent', 3).set('otTarget', 4).set('otFactor', 5)
    .set('frequency', 6).set('freqCurrent', 7).set('freqTarget', 8).set('freqFactor', 9)
    .set('noise', 10)
    .set('pTime', 11)
    .set('circ1', 12).set('circ2', 13).set('circ3', 14).set('circ4', 15)
    .set('CC_102', 16).set('CC_103', 17).set('CC_104', 18).set('CC_105', 19).set('CC_106', 20).set('CC_107', 21)
    .set('CC_108', 22).set('CC_109', 23).set('CC_110', 24).set('CC_111', 25).set('CC_112', 26).set('CC_113', 27)
    .set('CC_114', 28).set('CC_115', 29).set('CC_116', 30).set('CC_117', 31).set('CC_118', 32).set('CC_119', 33)
    .set('HyperVoice_Count', 34).set('HyperVoice_Phase', 35)
    .set('KNOWNVAL_MAX', 36);

const DIRECTION = new Map<string, number>().set('RISING', 0).set('FALLING', 1).set('ANY', 2).set('NONE', 3);

enum FLAGS {
    MAP_ENA_PITCHBEND = 0x80,
    MAP_ENA_STEREO = 0x40,
    MAP_ENA_VOLUME = 0x20,
    MAP_ENA_DAMPER = 0x10,
    MAP_ENA_PORTAMENTO = 0x08,
    MAP_FREQ_MODE = 0x01,
}
