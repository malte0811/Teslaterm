import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {getUD3Connection} from "../connection/connection";
import {ipcs} from "./IPCProvider";


export namespace BlockSender {

    const STATE_IDLE = 0;
    const STATE_CONFIG = 1;
    const STATE_PROG = 2;

    let state = STATE_IDLE;
    let temp = new Array;
    let indent: number = 0;
    let indent_old: number = 0;
    let prog;
    let items;
    let blk_cnt: number = 0;
    let arr;
    let spl;
    let progNumber=0;

    enum DIRECTION {RISING = 0, FALLING = 1, ANY = 2, NONE = 3}
    enum NOTEOFF_BEHAVIOR{INVERTED = 0, NORMAL = 1}
    enum VMS_MODTYPE {VMS_EXP = 0, VMS_EXP_INV = 1, VMS_LIN = 2, VMS_SIN = 3, VMS_JUMP = 4}
    enum KNOWN_VALUE {  maxOnTime = 0, minOnTime = 1, onTime = 2, otCurrent = 3, otTarget = 4, otFactor = 5,
                        frequency = 6, freqCurrent = 7, freqTarget = 8, freqFactor = 9, noise = 10, pTime = 11,
                        circ1 = 12, circ2 = 13, circ3 = 14, circ4 = 15, CC_102 = 16, CC_103 = 17, CC_104 = 18,
                        CC_105 = 19, CC_106 = 20, CC_107 = 21, CC_108 = 22, CC_109 = 23, CC_110 = 24, CC_111 = 25,
                        CC_112 = 26, CC_113 = 27, CC_114 = 28, CC_115 = 29, CC_116 = 30, CC_117 = 31, CC_118 = 32,
                        CC_119 = 33, HyperVoice_Count = 34, HyperVoice_Phase = 35, KNOWNVAL_MAX = 36}

    export async function loadBlocks(file: TransmittedFile) {
        try {
             ipcs.terminal.println("Load VMS file: " + file.name);
             const blocks = interpret((utf8ArrayToString(file.contents).split('\r\n')));
             ipcs.terminal.println("Found " + blocks[1].blocks.length + " blocks");
             progNumber = 0;
             blocks[1].blocks.forEach((block) => {
                 if (block.uid !== -1) {
                     sendBlock(block);
                 }
             });
             sendNullBlock();
             blocks[1].items.forEach((item) => {
                sendMapHeader(item);
                item.maps.forEach((entry) => {
                   sendMapEntry(entry);
                });
             });
             sendNullHeader();
             sendFlush();

             // getUD3Connection().sendVMSFrames(buf);

        } catch (e) {
            ipcs.terminal.println("Failed to load blocks: " + e);
            console.log(e);
        }
    }

    function writeUint32(buf: Buffer, index: number, val: number) {
        buf[index] = (val >> 24) & 0xFF;
        buf[index + 1] = (val >> 16) & 0xFF;
        buf[index + 2] = (val >> 8) & 0xFF;
        buf[index + 3] = val & 0xFF;
    }

    function writeUint16(buf: Buffer, index: number, val: number) {
        buf[index] = (val >> 8) & 0xFF;
        buf[index + 1] = val & 0xFF;
    }

    function writeUint8(buf: Buffer, index: number, val: number) {
        buf[index] = val & 0xFF;
    }

    function writeint32(buf: Buffer, index: number, val: number) {
        buf[index] = (val >> 24) & 0xFF;
        buf[index + 1] = (val >> 16) & 0xFF;
        buf[index + 2] = (val >> 8) & 0xFF;
        buf[index + 3] = val & 0xFF;
    }

    function sendMapHeader(header) {
        const buf: Buffer = new Buffer(20);
        let index: number = 0;
        buf[index] = 0x02;
        index++;
        writeUint8(buf, index, header.maps.length);
        index++;
        writeUint8(buf, index, progNumber);
        index++;
        progNumber++;
        const enc = new TextEncoder();
        enc.encode(header.name).forEach((c) => {
            buf[index] = c;
            index++;
        });
        getUD3Connection().sendVMSFrames(buf);
    }

    function sendFlush() {
        const buf: Buffer = new Buffer(1);
        buf[0] = 0x04;
        getUD3Connection().sendVMSFrames(buf);
    }

    enum FLAGS {
        MAP_ENA_PITCHBEND = 0x80,
        MAP_ENA_STEREO = 0x40,
        MAP_ENA_VOLUME = 0x20,
        MAP_ENA_DAMPER = 0x10,
        MAP_ENA_PORTAMENTO = 0x08,
        MAP_FREQ_MODE = 0x01,
    }
    function sendMapEntry(entry) {
        const buf: Buffer = new Buffer(11);
        let index: number = 0;
        buf[index] = 0x03;
        index++;
        writeUint8(buf, index, entry.startNote);
        index++;
        writeUint8(buf, index, entry.endNote);
        index++;
        writeUint16(buf, index, entry.noteFrequency);
        index+=2;
        writeUint8(buf, index, entry.volumeModifier);
        index++;
        let flag=0;
        if (entry.ENA_PITCHBEND) {
            flag |= FLAGS.MAP_ENA_PITCHBEND;
        }
        if (entry.ENA_STEREO) {
            flag |= FLAGS.MAP_ENA_STEREO;
        }
        if (entry.ENA_VOLUME) {
            flag |= FLAGS.MAP_ENA_VOLUME;
        }
        if (entry.ENA_DAMPER) {
            flag |= FLAGS.MAP_ENA_DAMPER;
        }
        if (entry.ENA_PORTAMENTO) {
            flag |= FLAGS.MAP_ENA_PORTAMENTO;
        }
        if (entry.FREQ_MODE) {
            flag |= FLAGS.MAP_FREQ_MODE;
        }
        writeUint8(buf, index, flag);
        index++;
        writeUint32(buf, index, entry.startBlock);
        getUD3Connection().sendVMSFrames(buf);
    }

    function sendNullBlock(){
        const buf: Buffer = new Buffer(65);
        getUD3Connection().sendVMSFrames(buf);
    }

    function sendNullHeader(){
        const buf: Buffer = new Buffer(20);
        getUD3Connection().sendVMSFrames(buf);
    }

    function sendBlock(block) {
        const buf: Buffer = new Buffer(65);
        let index: number = 0;
        let temp=0;
        buf[index] = 0x01;
        index++;
        writeUint32(buf, index, block.uid);
        index += 4;
        if(block.outsEnabled === false) {
            console.log("DEAD");
            writeUint32(buf, index, 0xDEADBEEF);
        } else {
            writeUint32(buf, index, block.nextBlock0);
        }
        index += 4;
        writeUint32(buf, index, block.nextBlock1);
        index += 4;
        writeUint32(buf, index, block.nextBlock2);
        index += 4;
        writeUint32(buf, index, block.nextBlock3);
        index += 4;
        writeUint32(buf, index, block.offBlock);
        index += 4;

        temp = 0;
        switch (block.offBehavior) {
            case 'NORMAL':
                temp = NOTEOFF_BEHAVIOR.NORMAL;
                break;
            case 'INVERTED':
                temp = NOTEOFF_BEHAVIOR.INVERTED;
                break;
        }
        writeUint32(buf, index, temp);
        index += 4;

        temp = 0;
        switch (block.type) {
            case 'VMS_EXP':
                temp = VMS_MODTYPE.VMS_EXP;
                break;
            case 'VMS_EXP_INV':
                temp = VMS_MODTYPE.VMS_EXP_INV;
                break;
            case 'VMS_LIN':
                temp = VMS_MODTYPE.VMS_LIN;
                break;
            case 'VMS_SIN':
                temp = VMS_MODTYPE.VMS_SIN;
                break;
            case 'VMS_JUMP':
                temp = VMS_MODTYPE.VMS_JUMP;
                break;
        }
        writeUint32(buf, index, temp);
        index += 4;

        temp = 0;
        switch (block.target) {
            case 'maxOnTime':
                temp = KNOWN_VALUE.maxOnTime;
                break;
            case 'minOnTime':
                temp = KNOWN_VALUE.minOnTime;
                break;
            case 'onTime':
                temp = KNOWN_VALUE.onTime;
                break;
            case 'otCurrent':
                temp = KNOWN_VALUE.otCurrent;
                break;
            case 'otTarget':
                temp = KNOWN_VALUE.otTarget;
                break;
            case 'otFactor':
                temp = KNOWN_VALUE.otFactor;
                break;
            case 'frequency':
                temp = KNOWN_VALUE.frequency;
                break;
            case 'freqCurrent':
                temp = KNOWN_VALUE.freqCurrent;
                break;
            case 'freqTarget':
                temp = KNOWN_VALUE.freqTarget;
                break;
            case 'freqFactor':
                temp = KNOWN_VALUE.freqFactor;
                break;
            case 'noise':
                temp = KNOWN_VALUE.noise;
                break;
            case 'pTime':
                temp = KNOWN_VALUE.pTime;
                break;
            case 'circ1':
                temp = KNOWN_VALUE.circ1;
                break;
            case 'circ2':
                temp = KNOWN_VALUE.circ2;
                break;
            case 'circ3':
                temp = KNOWN_VALUE.circ3;
                break;
            case 'circ4':
                temp = KNOWN_VALUE.circ4;
                break;
            case 'CC_102':
                temp = KNOWN_VALUE.CC_102;
                break;
            case 'CC_103':
                temp = KNOWN_VALUE.CC_103;
                break;
            case 'CC_104':
                temp = KNOWN_VALUE.CC_104;
                break;
            case 'CC_105':
                temp = KNOWN_VALUE.CC_105;
                break;
            case 'CC_106':
                temp = KNOWN_VALUE.CC_106;
                break;
            case 'CC_107':
                temp = KNOWN_VALUE.CC_107;
                break;
            case 'CC_108':
                temp = KNOWN_VALUE.CC_108;
                break;
            case 'CC_109':
                temp = KNOWN_VALUE.CC_109;
                break;
            case 'CC_110':
                temp = KNOWN_VALUE.CC_110;
                break;
            case 'CC_111':
                temp = KNOWN_VALUE.CC_111;
                break;
            case 'CC_112':
                temp = KNOWN_VALUE.CC_112;
                break;
            case 'CC_113':
                temp = KNOWN_VALUE.CC_113;
                break;
            case 'CC_114':
                temp = KNOWN_VALUE.CC_114;
                break;
            case 'CC_115':
                temp = KNOWN_VALUE.CC_115;
                break;
            case 'CC_116':
                temp = KNOWN_VALUE.CC_116;
                break;
            case 'CC_117':
                temp = KNOWN_VALUE.CC_117;
                break;
            case 'CC_118':
                temp = KNOWN_VALUE.CC_118;
                break;
            case 'CC_119':
                temp = KNOWN_VALUE.CC_119;
                break;
            case 'HyperVoice_Count':
                temp = KNOWN_VALUE.HyperVoice_Count;
                break;
            case 'HyperVoice_Phase':
                temp = KNOWN_VALUE.HyperVoice_Phase;
                break;
            case 'KNOWNVAL_MAX':
                temp = KNOWN_VALUE.KNOWNVAL_MAX;
                break;
        }
        writeUint32(buf, index, temp);
        index += 4;
        temp = 0;
        switch (block.thresholdDirection) {
            case 'RISING':
                temp = DIRECTION.RISING;
                break;
            case 'FALLING':
                temp = DIRECTION.FALLING;
                break;
            case 'ANY':
                temp = DIRECTION.ANY;
                break;
            case 'NONE':
                temp = DIRECTION.NONE;
                break;
        }
        writeUint32(buf, index, temp);
        index += 4;
        writeint32(buf, index, block.targetValue);
        index += 4;
        writeint32(buf, index, block.param0);
        index += 4;
        writeint32(buf, index, block.param1);
        index += 4;
        writeint32(buf, index, block.param2);
        index += 4;
        writeUint32(buf, index, block.param3);
        index += 4;
        writeUint32(buf, index, block.flags);
        
        getUD3Connection().sendVMSFrames(buf);
       // console.log(block);

    }

    function utf8ArrayToString(aBytes) {
        let sView = "";

        for (let nPart, nLen = aBytes.length, nIdx = 0; nIdx < nLen; nIdx++) {
            nPart = aBytes[nIdx];

            sView += String.fromCharCode(
                nPart > 251 && nPart < 254 && nIdx + 5 < nLen ? /* six bytes */
                    /* (nPart - 252 << 30) may be not so safe in ECMAScript! So...: */
                    (nPart - 252) * 1073741824 + (aBytes[++nIdx] - 128 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
                    : nPart > 247 && nPart < 252 && nIdx + 4 < nLen ? /* five bytes */
                    (nPart - 248 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
                    : nPart > 239 && nPart < 248 && nIdx + 3 < nLen ? /* four bytes */
                        (nPart - 240 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
                        : nPart > 223 && nPart < 240 && nIdx + 2 < nLen ? /* three bytes */
                            (nPart - 224 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
                            : nPart > 191 && nPart < 224 && nIdx + 1 < nLen ? /* two bytes */
                                (nPart - 192 << 6) + aBytes[++nIdx] - 128
                                : /* nPart < 127 ? */ /* one byte */
                                nPart,
            );
        }

        return sView;
    }

    function interpret(data) {

        temp = [];
        data.forEach((element: string) => {

            element = element.replace(/\t/g, '');

            element.split('').forEach((c) => {
                if (c === '{') {
                    indent++;
                } else if (c === '}') {
                    indent--;
                }
            });

            element = element.replace('{', '');
            element = element.replace('}', '');
            element = element.replace(',', '');

            if (element !== '') {
                // if(!Array.isArray(temp[blk_cnt])) temp[blk_cnt] = new Array;


                if (indent === 1 && element === 'CoilConfigurations:') {
                    arr = new Array;
                    state = STATE_CONFIG;
                    arr.type = 'config';
                } else if (indent === 1 && element === 'MidiPrograms:') {
                    temp.push(arr);
                    state = STATE_PROG;
                    arr = new Array;
                    arr.type = 'progr';
                } else if (indent === 2) {
                    if (!Array.isArray(arr.items)) {
                        arr.items = new Array;
                    }
                    if (state === STATE_CONFIG) {
                        spl = element.split('=');
                        if (element.endsWith('":')) {
                            element = element.replace('"', '');
                            element = element.replace('":', '');
                            arr.items.name = element;
                        } else {
                            arr.items[spl[0]] = spl[1];
                        }
                    } else if (state === STATE_PROG) {
                        element = element.replace(/\u0000/g, '');
                        element = element.replace('"', '');
                        element = element.replace('":', '');
                        prog = new Array;
                        prog.name = element;
                        arr.items.push(prog);
                    }
                } else if (indent === 3) { // MAP
                    if (!Array.isArray(prog.maps)) { prog.maps = new Array; }
                    if (element.endsWith(':')) {
                        items = new Array;
                        prog.maps.push(items);
                    } else {
                        spl = element.split('=');
                        if (parseInt(spl[1], 10) || spl[1] === '0') {
                            items[spl[0]] = parseInt(spl[1], 10);
                        } else if (spl[1] === 'true') {
                            items[spl[0]] = true;
                        } else if (spl[1] === 'false') {
                            items[spl[0]] = false;
                        } else {
                            items[spl[0]] = spl[1];
                        }
                    }
                } else if (indent === 4 && element.startsWith('block')) {
                    if (!Array.isArray(arr.blocks)) {
                        arr.blocks = new Array;
                    }
                    items = new Array;
                    items.nextBlock0 = 0;
                    items.nextBlock1 = 0;
                    items.nextBlock2 = 0;
                    items.nextBlock3 = 0;
                    items.param0 = 0;
                    items.param1 = 0;
                    items.param2 = 0;
                    items.param3 = 0;
                    arr.blocks.push(items);
                } else if (indent === 4) {
                    element = element.replace('[', '');
                    element = element.replace(']', '');
                    spl = element.split('=');
                    if (parseInt(spl[1], 10) || spl[1] === '0') {
                        items[spl[0]] = parseInt(spl[1], 10);
                    } else if (spl[1] === 'true') {
                        items[spl[0]] = true;
                    } else if (spl[1] === 'false') {
                        items[spl[0]] = false;
                    } else {
                        items[spl[0]] = spl[1];
                    }

                }
            }


            if (indent < indent_old) {
                blk_cnt++;
            }

            indent_old = indent;
        });
        temp.push(arr);

        return temp;
    }

    export function init() {

    }
}
