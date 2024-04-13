import {jspack} from "jspack";
import {withTimeout} from "../../helper";
import {CyacdRow} from "./CyacdRow";

const DATA = 0x37;
const ENTER_BOOTLOADER = 0x38;
const PROGRAM = 0x39;
const VERIFY_ROW = 0x3A;
const EXIT = 0x3B;

const PACKET_START = 0x01;
const PACKET_END = 0x17;

const CYRET_SUCCESS = 0x00;

class BootloaderReply {
    public readonly code: number;
    public readonly payload: number[];

    constructor(code: number, payload: number[]) {
        this.code = code;
        this.payload = payload;
    }
}

export class Bootloader {
    public last_commands: Array<{ callback: (reply: BootloaderReply) => void }>;
    public chip_id_from_cyacd: string;
    public cyacdRows: CyacdRow[];
    public info_cb: (info: string) => void;
    public progress_cb: (progress: number) => void;
    public write_cb: (data: Uint8Array) => Promise<void>;
    public receive_buffer: number[];
    public chunk_size: number;

    constructor() {
        this.last_commands = [];
        this.cyacdRows = [];
        this.info_cb = null;
        this.progress_cb = null;
        this.receive_buffer = [];
        this.chunk_size = 128;
    }

    public async onDataReceived(raw_data: Uint8Array) {
        for (const byte of raw_data) {
            this.receive_buffer.push(byte);
            if (this.receive_buffer.length > 6 && byte === PACKET_END) {
                if (this.last_commands.length > 0) {
                    console.assert(
                        this.receive_buffer[0] === PACKET_START,
                        "Packet did not start correctly",
                        this.receive_buffer,
                    );
                    const code = this.receive_buffer[1];
                    const data = this.receive_buffer.slice(4, this.receive_buffer.length - 3);
                    // TODO check CRC?
                    const last_command = this.last_commands[0];
                    last_command.callback(new BootloaderReply(code, data));
                    this.last_commands = this.last_commands.slice(1);
                    this.receive_buffer = [];
                } else {
                    console.warn("Received unexpected packet:", this.receive_buffer);
                    this.receive_buffer = [];
                }
            }
        }
    }

    public async connectAndProgram() {
        this.receive_buffer = [];
        const infoReply = await this.sendBootloaderCommand(ENTER_BOOTLOADER, []);
        if (!this.checkChipCompatibility(infoReply)) {
            return;
        }
        await this.programAll();
    }


    public set_progress_cb(cb_func: (progress: number) => any) {
        this.progress_cb = cb_func;
    }

    public set_write_cb(cb_func: (data: Uint8Array) => Promise<void>) {
        this.write_cb = cb_func;
    }

    public set_info_cb(cb_func: (info: string) => void) {
        this.info_cb = cb_func;
    }

    public async loadCyacd(data: Uint8Array) {
        const cyacd_file = new TextDecoder().decode(data)
            .replace(/\r/g, "")
            .split('\n');
        this.chip_id_from_cyacd = cyacd_file[0].substr(0, 8);
        this.send_info('INFO: Cyacd loaded, found chip-ID: ' + this.chip_id_from_cyacd);

        for (const line of cyacd_file) {
            if (line.startsWith(":")) {
                this.cyacdRows[this.cyacdRows.length] = new CyacdRow(line, this.cyacdRows.length);
            }
        }
    }

    public async finishRow(row: CyacdRow, remainingBytes: Uint8Array): Promise<void> {
        const rowReference = jspack.Pack("<BH", [row.arrayId, row.cyRowId]);
        const programReply = await this.sendBootloaderCommand(PROGRAM, [...rowReference, ...remainingBytes]);
        if (programReply.code !== CYRET_SUCCESS) {
            await this.exit();
            throw new Error('ERROR: Failed to program row: ' + row.humanRowId + ", return code " + programReply.code);
        }
        // Check CRC
        const crcReply = await this.sendBootloaderCommand(VERIFY_ROW, rowReference);
        if (crcReply.code !== CYRET_SUCCESS || crcReply.payload.length !== 1 || crcReply.payload[0] !== row.crc) {
            throw new Error('CRC error at row ' + row.humanRowId + ": expected " + row.crc.toString()
                + ", got " + crcReply.payload);
        }
    }

    public send_info(str: string) {
        if (this.info_cb === null) {
            return;
        }
        this.info_cb(str);
    }

    public async programAll() {
        let currentRow: number = 0;
        while (currentRow !== this.cyacdRows.length) {
            const row = this.cyacdRows[currentRow];
            const completeRow = row.bytes;
            let start = 0;
            while (start + this.chunk_size < completeRow.length) {
                const data = completeRow.slice(start, start + this.chunk_size);
                const buf = await this.sendBootloaderCommand(DATA, data);
                if (buf.code !== CYRET_SUCCESS) {
                    await this.exit();
                    throw new Error('ERROR: Error at Row: ' + currentRow);
                }
                start += this.chunk_size;
            }
            const data = completeRow.slice(start);
            await this.finishRow(row, data);
            currentRow++;
            const percent_done = Math.floor((currentRow / (this.cyacdRows.length - 1)) * 100.0);
            this.progress_cb(percent_done);
        }
        this.send_info('\r\nINFO: Programming done');
        await this.exit();
    }

    public async sendBootloaderCommand(
        command: number, data: number[] | Uint8Array, no_reply?: boolean,
    ): Promise<BootloaderReply> {
        const buffer: number[] = [];
        buffer.push(PACKET_START, command, data.length & 0xFF, (data.length >>> 8) & 0xFF);
        buffer.push(...data);

        let sum = 0;
        for (const element of buffer) {
            sum += element;
        }
        const crc = (1 + (~sum)) & 0xFFFF;

        buffer.push(crc & 0xFF, (crc >>> 8) & 0xFF, PACKET_END);
        return withTimeout(new Promise<BootloaderReply>((res) => {
            if (!no_reply) {
                this.last_commands.push({callback: res});
            }
            this.write_cb(new Uint8Array(buffer)).then(() => {
                if (no_reply) {
                    res(new BootloaderReply(CYRET_SUCCESS, []));
                }
            });
        }), 1000);
    }

    public checkChipCompatibility(reply: BootloaderReply): boolean {
        if (reply.payload.length !== 8 || reply.code !== CYRET_SUCCESS) {
            console.error("Got boot info ", reply);
            this.send_info("Invalid boot info");
            return false;
        }
        const [chip_id, silicon_rev, ldr_version, ldr_version_2] = jspack.Unpack("<IBHB", reply.payload);
        const chip_id_from_ud3 = chip_id.toString(16).toUpperCase();

        if (this.chip_id_from_cyacd === chip_id_from_ud3) {
            this.send_info('INFO: Chip-ID matches, start programming of flash');
        } else {
            this.send_info('INFO: Chip-ID match failed... exit');
            return false;
        }

        this.send_info('\r\nINFO: Connected to bootloader chip-id: ' + this.chip_id_from_cyacd +
            ' silicon-rev: ' + silicon_rev.toString(16).toUpperCase() +
            ' bootloader version: ' + ldr_version.toString(10) + "." + ldr_version_2.toString(10),
        );
        return true;
    }

    private async exit() {
        await this.sendBootloaderCommand(EXIT, [], true);
    }
}
