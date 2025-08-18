import {ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {
    Block,
    BlockMap,
    ConstantOrValue,
    FullVMSData,
    Modulation,
    ModulationType,
    OUTPUTS,
    Program,
} from "../../common/VMS";
import {UD3Connection} from "../connection/types/UD3Connection";
import {ipcs} from "../ipc/IPCProvider";
import {AmbiguousValue, getConstantScale, VARIABLE_VALUE_DATA} from "./LegacyVMSParser";

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

    public writeConstOrValue(value: ConstantOrValue, position: AmbiguousValue, modulation: ModulationType) {
        if (value.type === 'constant') {
            this.writeUint32(value.value * getConstantScale(position, modulation));
        } else {
            const combinedValue = value.value | (value.rangeStart << 8) | (value.rangeEnd << 20);
            this.writeUint32(combinedValue);
        }
    }

    public getBuffer() {
        return Buffer.from(this.buffer);
    }
}

// Packet format/conversion
function prepareBlockBuffer() {
    const buffer = new VMSBuffer(45, true);
    buffer.writeUint8(1);
    return buffer;
}

function prepareHeaderBuffer() {
    const buffer = new VMSBuffer(29, true);
    buffer.writeUint8(2);
    return buffer;
}

function getModulationParms(modulation: Modulation) {
    switch (modulation.type) {
        case ModulationType.step:
            return [];
        case ModulationType.exp:
        case ModulationType.exp_inverse:
            return [modulation.growthFactor];
        case ModulationType.linear:
            return [modulation.slope];
        case ModulationType.sine:
            return [modulation.scale, modulation.offset, modulation.timeIncrement];
    }
}

function gatherBlockFlage(targetFactor: ConstantOrValue, parms: ConstantOrValue[]) {
    let result = 0;
    const addSubflag = (type: AmbiguousValue, value: ConstantOrValue) => {
        result += value.type === 'value' ? VARIABLE_VALUE_DATA.get(type).flagMask : 0;
    };
    addSubflag(AmbiguousValue.targetFactor, targetFactor);
    addSubflag(AmbiguousValue.param1, parms[0]);
    addSubflag(AmbiguousValue.param2, parms[1]);
    addSubflag(AmbiguousValue.param3, parms[2]);
    return result;
}

function serializeBlock(block: Block) {
    const buf = prepareBlockBuffer();
    const writeBlockID = (id: number) => buf.writeUint(id ?? 0xFFFF, 16);
    buf.writeUint32(block.uid);
    for (let i = 0; i < OUTPUTS; ++i) {
        writeBlockID(block.outputBlocks[i]);
    }
    writeBlockID(block.offBlock);

    buf.writeUint(block.offBehavior, 8);
    buf.writeUint(block.modulation.type, 8);
    buf.writeUint(block.target, 16);
    buf.writeConstOrValue(block.targetFactor, AmbiguousValue.targetFactor, block.modulation.type);
    const parameters = getModulationParms(block.modulation);
    while (parameters.length < 3) {
        parameters.push({type: 'constant', value: 0});
    }
    buf.writeConstOrValue(parameters[0], AmbiguousValue.param1, block.modulation.type);
    buf.writeConstOrValue(parameters[1], AmbiguousValue.param2, block.modulation.type);
    buf.writeConstOrValue(parameters[2], AmbiguousValue.param3, block.modulation.type);
    buf.writeUint32(block.periodMS);
    buf.writeUint32(gatherBlockFlage(block.targetFactor, parameters));
    return buf.getBuffer();
}

function buildNullBlock(nullID: number) {
    const buffer = prepareBlockBuffer();
    buffer.writeUint32(nullID);
    return buffer.getBuffer();
}

function serializeProgramHeader(programID: number, program: Program) {
    const buf = prepareHeaderBuffer();
    buf.writeUint32(programID);
    buf.writeUint8(program.maps.length);
    buf.writeUint8(programID);
    buf.writeUint8(programID);
    new TextEncoder().encode(program.name).forEach((c) => buf.writeUint8(c));
    return buf.getBuffer();
}

function buildNullHeader() {
    return prepareHeaderBuffer().getBuffer();
}

enum FLAGS {
    MAP_ENA_PITCHBEND = 0x80,
    MAP_ENA_STEREO = 0x40,
    MAP_ENA_VOLUME = 0x20,
    MAP_ENA_DAMPER = 0x10,
    MAP_ENA_PORTAMENTO = 0x08,
    MAP_FREQ_MODE = 0x01,
}

function serializeMapEntry(entry: BlockMap, littleEndian: boolean) {
    const buf = new VMSBuffer(11, littleEndian);
    buf.writeUint8(3);
    buf.writeUint8(entry.startNote);
    buf.writeUint8(entry.endNote);
    const frequency = entry.noteFrequency;
    buf.writeUint16(frequency.type === 'fixed' ? frequency.frequencyHz : frequency.midiNotes);
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
    if (frequency.type === 'offset') {
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

export function sendBlocks(programs: FullVMSData, connection: UD3Connection) {
    let maxID = 0;
    const messages: Buffer[] = [];
    for (const program of programs) {
        for (const map of program.maps) {
            for (const block of map.blocks) {
                const buffer = serializeBlock(block);
                if (buffer) {
                    messages.push(buffer);
                }
                maxID = Math.max(maxID, block.uid);
            }
        }
    }
    messages.push(buildNullBlock(maxID + 1));
    programs.forEach((program, id) => {
        messages.push(serializeProgramHeader(id, program));
        messages.push(...program.maps.map((map) => serializeMapEntry(map, true)));
    });
    messages.push(buildNullHeader());
    messages.push(buildFlush());
    sendVMSFramesToUD(connection, messages).catch((e) => {
        ipcs.coilMisc(connection.getCoil())
            .openToast('VMS error', 'Failed to transmit VMS frames, check log for details', ToastSeverity.error);
        console.error('Sending VMS frames', e);
    });
}

export async function sendVMSFramesToUD(connection: UD3Connection, messages: Buffer[]) {
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
