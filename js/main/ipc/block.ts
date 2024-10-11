import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {ChannelID, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {forEachCoil, getMixer, getOptionalUD3Connection} from "../connection/connection";
import {UD3Connection} from "../connection/types/UD3Connection";
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

class VMSBuffer {
    private readonly buffer: ArrayBuffer;
    private readonly view: DataView;
    private readonly littleEndian: boolean;
    private nextIndex: number = 0;

    public constructor(size: number, littleEndian: boolean) {
        this.buffer = new ArrayBuffer(size);
        this.view = new DataView(this.buffer);
        this.littleEndian = littleEndian;
    }

    public writeUint(value: number, bits: number) {
        switch (bits) {
            case 8:
                return this.writeUint8(value);
            case 16:
                return this.writeUint16(value);
            case 32:
                return this.writeUint32(value);
            default:
                throw new Error(`Invalid bit count ${bits}`);
        }
    }

    public writeUint32(value: number) {
        this.view.setUint32(this.nextIndex, value, this.littleEndian);
        this.nextIndex += 4;
    }

    public writeUint16(value: number) {
        this.view.setUint16(this.nextIndex, value, this.littleEndian);
        this.nextIndex += 2;
    }

    public writeUint8(value: number) {
        this.view.setUint8(this.nextIndex, value);
        ++this.nextIndex;
    }

    public getBuffer() {
        return Buffer.from(this.buffer);
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
    behavior: number;
    type: number;
    target: number;
    thresholdDirection: number;
    targetFactor: number;
    param1: number;
    param2: number;
    param3: number;
    periodUS: number;
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
        forEachCoil((coil) => {
            const connection = getOptionalUD3Connection(coil);
            if (connection) {
                sendBlocks(programs, connection, connection.getProtocolVersion() >= 3.0);
            }
        });
        getMixer()?.setProgramsByVoice(new Map<ChannelID, number>());
        setUIConfig({midiPrograms: programs.map((p) => p.name)});
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
        .replace('\r', '')
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

function parseBlocksFromStructure(mapData: VMSDataMap, keyPrefix: string): Block[] {
    const blocks: Block[] = [];
    for (const key of mapData.map.keys()) {
        if (!key.startsWith(keyPrefix)) {
            continue;
        }
        const blockMap = mapData.getAsMap(key);
        const newBlock: Block = {
            uid: blockMap.getAsInt('uid'),
            outsEnabled: blockMap.getAsBool('outsEnabled'),
            // TODO what to use as default in new setup?
            nextBlock0: blockMap.getAsInt('nextBlock[0]'),
            nextBlock1: blockMap.getAsInt('nextBlock[1]'),
            nextBlock2: blockMap.getAsInt('nextBlock[2]'),
            nextBlock3: blockMap.getAsInt('nextBlock[3]'),
            offBlock: blockMap.getAsInt('offBlock'),
            behavior: blockMap.getMapped('offBehavior', NOTEOFF_BEHAVIOR),
            type: blockMap.getMapped('type', VMS_MODTYPE),
            target: blockMap.getMapped('target', KNOWN_VALUE),
            thresholdDirection: blockMap.getMapped('thresholdDirection', DIRECTION),
            targetFactor: blockMap.getAsInt('targetValue'),
            param1: blockMap.getAsInt('param[0]'),
            param2: blockMap.getAsInt('param[1]'),
            param3: blockMap.getAsInt('param[2]'),
            periodUS: blockMap.getAsInt('param[3]'),
            flags: blockMap.getAsInt('flags'),
        };

        // apply flag fix
        if (!newBlock.outsEnabled) {
            newBlock.flags |= 0x80000000;
        }

        blocks.push(newBlock);
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
        blocks,
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
function prepareBlockBuffer(newFormat: boolean) {
    const buffer = new VMSBuffer(newFormat ? 45 : 65, newFormat);
    buffer.writeUint8(1);
    return buffer;
}

function prepareHeaderBuffer(newFormat: boolean) {
    const buffer = new VMSBuffer(newFormat ? 29 : 20, newFormat);
    buffer.writeUint8(2);
    return buffer;
}

function serializeBlock(block: Block, newFormat: boolean) {
    if (block.uid === -1) {
        return undefined;
    }

    const buf = prepareBlockBuffer(newFormat);
    const writeBlockID = (id: number) => buf.writeUint(id, newFormat ? 16 : 32);
    buf.writeUint32(block.uid);
    if (block.outsEnabled === false) {
        writeBlockID(newFormat ? 0xFFFF : 0xDEADBEEF);
    } else {
        writeBlockID(block.nextBlock0);
    }
    writeBlockID(block.nextBlock1);
    writeBlockID(block.nextBlock2);
    writeBlockID(block.nextBlock3);
    writeBlockID(block.offBlock);

    buf.writeUint(block.behavior, newFormat ? 8 : 32);
    buf.writeUint(block.type + (newFormat ? 1 : 0), newFormat ? 8 : 32);
    buf.writeUint(block.target, newFormat ? 16 : 32);
    if (!newFormat) {
        // TODO Did this just get removed?
        buf.writeUint32(block.thresholdDirection);
    }
    buf.writeUint32(block.targetFactor);
    buf.writeUint32(block.param1);
    buf.writeUint32(block.param2);
    buf.writeUint32(block.param3);
    // new format uses period in milliseconds instead of microseconds
    buf.writeUint32(newFormat ? (block.periodUS / 1000) : (block.periodUS));
    buf.writeUint32(block.flags);
    return buf.getBuffer();
}

function buildNullBlock(newFormat: boolean, nullID: number) {
    const buffer = prepareBlockBuffer(newFormat);
    if (newFormat) {
        buffer.writeUint32(nullID);
    }
    return buffer.getBuffer();
}

function serializeProgramHeader(programID: number, program: Program, newFormat: boolean) {
    const buf = prepareHeaderBuffer(newFormat);
    if (newFormat) {
        buf.writeUint32(programID);
    }
    buf.writeUint8(program.maps.length);
    buf.writeUint8(programID);
    if (newFormat) {
        buf.writeUint8(programID);
    }
    new TextEncoder().encode(program.name).forEach((c) => buf.writeUint8(c));
    return buf.getBuffer();
}

function buildNullHeader(littleEndian: boolean) {
    return prepareHeaderBuffer(littleEndian).getBuffer();
}

function serializeMapEntry(entry: BlockMap, littleEndian: boolean) {
    const buf = new VMSBuffer(11, littleEndian);
    buf.writeUint8(3);
    buf.writeUint8(entry.startNote);
    buf.writeUint8(entry.endNote);
    buf.writeUint16(entry.noteFrequency);
    buf.writeUint8(entry.volumeModifier);
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
    buf.writeUint8(flag);
    buf.writeUint32(entry.startBlock);
    return buf.getBuffer();
}

function buildFlush() {
    const buf = new VMSBuffer(1, false);
    buf.writeUint8(4);
    return buf.getBuffer();
}

function sendBlocks(programs: Program[], connection: UD3Connection, newFormat: boolean) {
    let maxID = 0;
    const messages: Buffer[] = [];
    for (const program of programs) {
        for (const map of program.maps) {
            for (const block of map.blocks) {
                const buffer = serializeBlock(block, newFormat);
                if (buffer) {
                    messages.push(buffer);
                }
                maxID = Math.max(maxID, block.uid);
            }
        }
    }
    messages.push(buildNullBlock(newFormat, maxID + 1));
    programs.forEach((program, id) => {
        messages.push(serializeProgramHeader(id, program, newFormat));
        messages.push(...program.maps.map((map) => serializeMapEntry(map, newFormat)));
    });
    messages.push(buildNullHeader(newFormat));
    messages.push(buildFlush());
    sendVMSFramesToUD(connection, messages).catch((e) => {
        ipcs.coilMisc(connection.getCoil())
            .openToast('VMS error', 'Failed to transmit VMS frames, check log for details', ToastSeverity.error);
        console.error('Sending VMS frames', e);
    });
}

async function sendVMSFramesToUD(connection: UD3Connection, messages: Buffer[]) {
    const showToast = (message: string) => {
        ipcs.coilMisc(connection.getCoil()).openToast('VMS progress', message, ToastSeverity.info, 'vms-progress');
    };
    for (let i = 0; i < messages.length; ++i) {
        if (i === 0 || i % 10 === 9) {
            showToast(`Transmitting frame ${i + 1} of ${messages.length}`);
        }
        await connection.sendVMSFrame(messages[i]);
    }
    showToast(`Transmitted ${messages.length} frames`);
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
    .set('HyperVoice_Count', 34).set('HyperVoice_Phase', 35).set('HyperVoice_Volume', 36)
    .set('volume', 37).set('volumeCurrent', 38).set('volumeTarget', 39).set('volumeFactor', 40)
    .set('KNOWNVAL_MAX', 41);

const DIRECTION = new Map<string, number>().set('RISING', 0).set('FALLING', 1).set('ANY', 2).set('NONE', 3);

enum FLAGS {
    MAP_ENA_PITCHBEND = 0x80,
    MAP_ENA_STEREO = 0x40,
    MAP_ENA_VOLUME = 0x20,
    MAP_ENA_DAMPER = 0x10,
    MAP_ENA_PORTAMENTO = 0x08,
    MAP_FREQ_MODE = 0x01,
}
