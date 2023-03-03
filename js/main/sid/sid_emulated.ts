// Based on https://github.com/og2t/jsSID/blob/master/source/jsSID.js
import {convertArrayBufferToString} from "../helper";
import {ISidSource, SidFrame} from "./sid_api";
import {NTSC, PAL, TimingStandard} from "./SIDConstants";

enum CPUStatus {
    running,
    done_0xFE,
    done_0xFF,
}

class InstructionResult {
    public readonly num_cycles: number;
    public readonly status: CPUStatus;

    constructor(num_cycles: number, status: CPUStatus) {
        this.num_cycles = num_cycles;
        this.status = status;
    }
}

class SidFileInfo {
    public readonly title: string;
    public readonly author: string;
    public readonly info: string;
    public readonly timermodes: Uint8Array;
    public readonly initAddr: number;
    public readonly playAddr: number;
    public readonly timing: TimingStandard;

    constructor(
        title: string,
        author: string,
        info: string,
        timermodes: Uint8Array,
        initAddr: number,
        playAddr: number,
        timing: TimingStandard,
    ) {
        this.title = title;
        this.author = author;
        this.info = info;
        this.timermodes = timermodes;
        this.initAddr = initAddr;
        this.playAddr = playAddr;
        this.timing = timing;
    }
}

const branchflag = [0x80, 0x40, 0x01, 0x02];
const flagsw = [0x01, 0x21, 0x04, 0x24, 0x00, 0x40, 0x08, 0x28];
const SID_BASE_ADDR = 0xD400;

export class EmulationSidSource implements ISidSource {
    private memory: Uint8Array = new Uint8Array(1 << 16);
    private cpu_time: number;
    public readonly sid_info: SidFileInfo;
    private subtune: number;
    private current_frame: number = 0;
    // Various registers
    private PC: number;
    private X: number;
    private Y: number;
    private T: number;
    private ST: number;
    private SP: number;
    private A: number;

    constructor(file: Uint8Array) {
        this.sid_info = this.load(file);
        this.init(this.sid_info);
    }

    public getTotalFrameCount(): number | null {
        return null;
    }

    public getCurrentFrameCount(): number {
        throw this.current_frame;
    }

    public isDone(): boolean {
        return false;
    }

    public next_frame(): SidFrame {
        let finished: boolean = false;
        this.PC = this.sid_info.playAddr;
        this.SP = 0xFF;
        while (this.cpu_time <= this.sid_info.timing.cycles_per_frame) {
            const prev_pc = this.PC;
            const instr_result = this.run_single_instruction();
            if (instr_result.status !== CPUStatus.running) {
                finished = true;
                break;
            } else {
                this.cpu_time += instr_result.num_cycles;
            }
            if ((this.memory[1] & 3) > 1 && prev_pc < 0xE000 && (this.PC === 0xEA31 || this.PC === 0xEA81)) {
                finished = true;
                break;
            }
        }
        this.cpu_time -= this.sid_info.timing.cycles_per_frame;
        const data = new Uint8Array(25);
        for (let i = 0; i < data.byteLength; ++i) {
            data[i] = this.memory[SID_BASE_ADDR + i];
        }
        ++this.current_frame;
        return new SidFrame(data, 1e6 / this.sid_info.timing.framerate);
    }

    private load(filedata: Uint8Array): SidFileInfo {
        let strend;
        const offs = filedata[7];
        let loadaddr: number;
        if (filedata[8] + filedata[9]) {
            loadaddr = filedata[8] * 256 + filedata[9];
        } else {
            loadaddr = filedata[offs] + filedata[offs + 1] * 256;
        }
        const timermode: Uint8Array = new Uint8Array(32);
        const sidTitle: Uint8Array = new Uint8Array(32);
        const sidAuthor: Uint8Array = new Uint8Array(32);
        const sidInfo: Uint8Array = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            timermode[31 - i] = filedata[0x12 + (i >> 3)] & Math.pow(2, 7 - i % 8);
        }
        for (let i = 0; i < this.memory.length; i++) {
            this.memory[i] = 0;
        }
        for (let i = offs + 2; i < filedata.byteLength; i++) {
            if (loadaddr + i - (offs + 2) < this.memory.length) {
                this.memory[loadaddr + i - (offs + 2)] = filedata[i];
            }
        }
        strend = 1;
        for (let i = 0; i < 32; i++) {
            if (strend !== 0) {
                strend = sidTitle[i] = filedata[0x16 + i];
            } else {
                strend = sidTitle[i] = 0;
            }
        }
        strend = 1;
        for (let i = 0; i < 32; i++) {
            if (strend !== 0) {
                strend = sidAuthor[i] = filedata[0x36 + i];
            } else {
                strend = sidAuthor[i] = 0;
            }
        }
        strend = 1;
        for (let i = 0; i < 32; i++) {
            if (strend !== 0) {
                strend = sidInfo[i] = filedata[0x56 + i];
            } else {
                strend = sidInfo[i] = 0;
            }
        }
        const initaddr = filedata[0xA] + filedata[0xB] ? filedata[0xA] * 256 + filedata[0xB] : loadaddr;
        const playaddr = filedata[0xC] * 256 + filedata[0xD];
        let timing: TimingStandard = PAL;
        if (offs >= 0x7C) {
            // SID file standard >= 2
            if ((filedata[0x77] & 0x0C) === 8) {
                timing = NTSC;
            }
        }
        return new SidFileInfo(
            convertArrayBufferToString(sidTitle),
            convertArrayBufferToString(sidAuthor),
            convertArrayBufferToString(sidInfo),
            timermode,
            initaddr,
            playaddr,
            timing,
        );
    }

    private init(info: SidFileInfo) {
        this.subtune = 0; // TODO?
        this.initCPU(info.initAddr);
        this.A = this.subtune;
        this.memory[1] = 0x37;
        this.memory[0xDC05] = 0;
        for (let timeout = 100000; timeout >= 0; timeout--) {
            if (this.run_single_instruction().status !== CPUStatus.running) {
                break;
            }
        }
        if ((info.timermodes[this.subtune] || this.memory[0xDC05]) && !this.memory[0xDC05]) {
            this.memory[0xDC04] = 0x24;
            this.memory[0xDC05] = 0x40;
        }

        if (info.playAddr >= 0xE000 && this.memory[1] === 0x37) {
            this.memory[1] = 0x35;
        }
        // player under KERNAL (Crystal Kingdom Dizzy)
        this.initCPU(info.playAddr);
        this.cpu_time = 0;
        this.PC = info.playAddr;
        this.SP = 0xFF;
    }

    private initCPU(mempos: number): void {
        this.PC = mempos;
        this.A = 0;
        this.X = 0;
        this.Y = 0;
        this.ST = 0;
        this.SP = 0xFF;
    }

    // the CPU emulation for SID/PRG playback (ToDo: CIA/VIC-IRQ/NMI/RESET vectors, BCD-mode)
    private run_single_instruction(): InstructionResult {
        // 'IR' is the instruction-register, naming after the hardware-equivalent
        const IR = this.memory[this.PC];
        const originalPC = this.PC;
        let cycles: number = 2;
        let storadd: number = 0;
        let addr: number = 0;
        // 'cycle': ensure smallest 6510 runtime (for implied/register instructions)

        if (IR & 1) {
            // nybble2:  1/5/9/D:accu.instructions, 3/7/B/F:illegal opcodes
            switch (IR & 0x1F) {
                // addressing modes (begin with more complex cases)
                // this.PC wraparound not handled inside to savecodespace
                case 1:
                case 3: {
                    // (zp,x)
                    const lo = this.memory[this.memory[++this.PC] + this.X];
                    const hi = this.memory[this.memory[this.PC] + this.X + 1];
                    addr = lo + hi * 256;
                    cycles = 6;
                    break;
                }
                case 0x11:
                case 0x13:
                    addr = this.memory[this.memory[++this.PC]] + this.memory[this.memory[this.PC] + 1] * 256 + this.Y;
                    cycles = 6;
                    break;
                // (zp),y
                case 0x19:
                case 0x1F:
                    addr = this.memory[++this.PC] + this.memory[++this.PC] * 256 + this.Y;
                    cycles = 5;
                    break;
                // abs,y
                case 0x1D:
                    addr = this.memory[++this.PC] + this.memory[++this.PC] * 256 + this.X;
                    cycles = 5;
                    break;
                // abs,x
                case 0xD:
                case 0xF:
                    addr = this.memory[++this.PC] + this.memory[++this.PC] * 256;
                    cycles = 4;
                    break;
                // abs
                case 0x15:
                    addr = this.memory[++this.PC] + this.X;
                    cycles = 4;
                    break;
                // zp,x
                case 5:
                case 7:
                    addr = this.memory[++this.PC];
                    cycles = 3;
                    break;
                // zp
                case 0x17:
                    addr = this.memory[++this.PC] + this.Y;
                    cycles = 4;
                    break;
                // zp,y for LAX/SAX illegal opcodes
                case 9:
                case 0xB:
                    addr = ++this.PC;
                    cycles = 2;
                // immediate
            }
            addr &= 0xFFFF;
            switch (IR & 0xE0) {
                case 0x60:
                    this.T = this.A;
                    this.A += this.memory[addr] + (this.ST & 1);
                    this.ST &= 20;
                    this.ST |= (this.A & 128) | Number(this.A > 255);
                    this.A &= 0xFF;
                    this.ST |= Number(!this.A) << 1 | (!((this.T ^ this.memory[addr]) & 0x80) && ((this.T ^ this.A) & 0x80)) >> 1;
                    break;
                // ADC
                case 0xE0:
                    this.T = this.A;
                    this.A -= this.memory[addr] + Number(!(this.ST & 1));
                    this.ST &= 20;
                    this.ST |= (this.A & 128) | Number(this.A >= 0);
                    this.A &= 0xFF;
                    this.ST |= Number(!this.A) << 1 | (((this.T ^ this.memory[addr]) & 0x80) && ((this.T ^ this.A) & 0x80)) >> 1;
                    break;
                // SBC
                case 0xC0:
                    this.T = this.A - this.memory[addr];
                    this.ST &= 124;
                    this.ST |= Number(!(this.T & 0xFF)) << 1 | (this.T & 128) | Number(this.T >= 0);
                    break;
                // CMP
                case 0x00:
                    this.A |= this.memory[addr];
                    this.ST &= 125;
                    this.ST |= Number(!this.A) << 1 | (this.A & 128);
                    break;
                // ORA
                case 0x20:
                    this.A &= this.memory[addr];
                    this.ST &= 125;
                    this.ST |= Number(!this.A) << 1 | (this.A & 128);
                    break;
                // AND
                case 0x40:
                    if (IR === 0x4B) {
                        console.log("ALR at " + originalPC.toString(16));
                        this.A = (this.A & this.memory[addr]) >> 1;
                        // ALR
                    } else if (IR === 0x4f) {
                        console.log("SRE at " + originalPC.toString(16));
                        this.memory[addr] = this.memory[addr] >> 1;
                        this.A ^= this.memory[addr];
                        this.ST &= 125;
                        this.ST |= Number(!this.A) << 1 | (this.A & 128);
                    } else {
                        this.A ^= this.memory[addr];
                        this.ST &= 125;
                        this.ST |= Number(!this.A) << 1 | (this.A & 128);
                        // EOR
                    }
                    break;
                case 0xA0:
                    this.A = this.memory[addr];
                    this.ST &= 125;
                    this.ST |= Number(!this.A) << 1 | (this.A & 128);
                    if ((IR & 3) === 3) {
                        this.X = this.A;
                    }
                    break;
                // LDA / LAX (illegal, used by my 1 rasterline player)
                case 0x80:
                    this.memory[addr] = this.A & (((IR & 3) === 3) ? this.X : 0xFF);
                    storadd = addr;
                // this.STA / SAX (illegal)
            }
        } else if (IR & 2) {
            // nybble2:
            // 2:illegal/LDX,
            // 6:this.A/this.X/INC/DEC,
            // this.A:Accu-shift/reg.transfer/NOP,
            // E:shift/this.X/INC/DEC
            switch (IR & 0x1F) {
                // addressing modes
                case 0x1E:
                    const offset = ((IR & 0xC0) !== 0x80) ? this.X : this.Y;
                    addr = this.memory[++this.PC] + this.memory[++this.PC] * 256 + offset;
                    cycles = 5;
                    break;
                // abs,x / abs,y
                case 0xE:
                    addr = this.memory[++this.PC] + this.memory[++this.PC] * 256;
                    cycles = 4;
                    break;
                // abs
                case 0x16:
                    addr = this.memory[++this.PC] + (((IR & 0xC0) !== 0x80) ? this.X : this.Y);
                    cycles = 4;
                    break;
                // zp,x / zp,y
                case 6:
                    addr = this.memory[++this.PC];
                    cycles = 3;
                    break;
                // zp
                case 2:
                    addr = ++this.PC;
                    cycles = 2;
                // imm.
            }
            addr &= 0xFFFF;
            switch (IR & 0xE0) {
                case 0x00:
                    this.ST &= 0xFE;
                case 0x20:
                    if ((IR & 0xF) === 0xA) {
                        this.A = (this.A << 1) + (this.ST & 1);
                        this.ST &= 60;
                        this.ST |= (this.A & 128) | Number(this.A > 255);
                        this.A &= 0xFF;
                        this.ST |= Number(!this.A) << 1;
                    } else {
                        this.T = (this.memory[addr] << 1) + (this.ST & 1);
                        this.ST &= 60;
                        this.ST |= (this.T & 128) | Number(this.T > 255);
                        this.T &= 0xFF;
                        this.ST |= Number(!this.T) << 1;
                        this.memory[addr] = this.T;
                        cycles += 2;
                    }
                    break;
                // RMW (Read-Write-Modify)
                case 0x40:
                    this.ST &= 0xFE;
                case 0x60:
                    if ((IR & 0xF) === 0xA) {
                        this.T = this.A;
                        this.A = (this.A >> 1) + (this.ST & 1) * 128;
                        this.ST &= 60;
                        this.ST |= (this.A & 128) | (this.T & 1);
                        this.A &= 0xFF;
                        this.ST |= Number(!this.A) << 1;
                    } else {
                        this.T = (this.memory[addr] >> 1) + (this.ST & 1) * 128;
                        this.ST &= 60;
                        this.ST |= (this.T & 128) | (this.memory[addr] & 1);
                        this.T &= 0xFF;
                        this.ST |= Number(!this.T) << 1;
                        this.memory[addr] = this.T;
                        cycles += 2;
                    }
                    break;
                // RMW
                case 0xC0:
                    if (IR & 4) {
                        this.memory[addr]--;
                        this.memory[addr] &= 0xFF;
                        this.ST &= 125;
                        this.ST |= Number(!this.memory[addr]) << 1 | (this.memory[addr] & 128);
                        cycles += 2;
                    } else {
                        this.X--;
                        this.X &= 0xFF;
                        this.ST &= 125;
                        this.ST |= Number(!this.X) << 1 | (this.X & 128);
                    }
                    break;
                // DEX
                case 0xA0:
                    if ((IR & 0xF) !== 0xA) {
                        this.X = this.memory[addr];
                    } else if (IR & 0x10) {
                        this.X = this.SP;
                        break;
                    } else {
                        this.X = this.A;
                    }
                    this.ST &= 125;
                    this.ST |= Number(!this.X) << 1 | (this.X & 128);
                    break;
                // LDX/TSX/TAX
                case 0x80:
                    if (IR & 4) {
                        this.memory[addr] = this.X;
                        storadd = addr;
                    } else if (IR & 0x10) {
                        this.SP = this.X;
                    } else {
                        this.A = this.X;
                        this.ST &= 125;
                        this.ST |= Number(!this.A) << 1 | (this.A & 128);
                    }
                    break;
                // this.STX/TXS/TXA
                case 0xE0:
                    if (IR & 4) {
                        this.memory[addr]++;
                        this.memory[addr] &= 0xFF;
                        this.ST &= 125;
                        this.ST |= Number(!this.memory[addr]) << 1 | (this.memory[addr] & 128);
                        cycles += 2;
                    }
                // INC/NOP
            }
        } else if ((IR & 0xC) === 8) {
            // nybble2:  8:register/status
            switch (IR & 0xF0) {
                case 0x60:
                    this.SP++;
                    this.SP &= 0xFF;
                    this.A = this.memory[0x100 + this.SP];
                    this.ST &= 125;
                    this.ST |= Number(!this.A) << 1 | (this.A & 128);
                    cycles = 4;
                    break;
                // PLA
                case 0xC0:
                    this.Y++;
                    this.Y &= 0xFF;
                    this.ST &= 125;
                    this.ST |= Number(!this.Y) << 1 | (this.Y & 128);
                    break;
                // INY
                case 0xE0:
                    this.X++;
                    this.X &= 0xFF;
                    this.ST &= 125;
                    this.ST |= Number(!this.X) << 1 | (this.X & 128);
                    break;
                // INX
                case 0x80:
                    this.Y--;
                    this.Y &= 0xFF;
                    this.ST &= 125;
                    this.ST |= Number(!this.Y) << 1 | (this.Y & 128);
                    break;
                // DEY
                case 0x00:
                    this.memory[0x100 + this.SP] = this.ST;
                    this.SP--;
                    this.SP &= 0xFF;
                    cycles = 3;
                    break;
                // PHP
                case 0x20:
                    this.SP++;
                    this.SP &= 0xFF;
                    this.ST = this.memory[0x100 + this.SP];
                    cycles = 4;
                    break;
                // PLP
                case 0x40:
                    this.memory[0x100 + this.SP] = this.A;
                    this.SP--;
                    this.SP &= 0xFF;
                    cycles = 3;
                    break;
                // PHA
                case 0x90:
                    this.A = this.Y;
                    this.ST &= 125;
                    this.ST |= Number(!this.A) << 1 | (this.A & 128);
                    break;
                // TYA
                case 0xA0:
                    this.Y = this.A;
                    this.ST &= 125;
                    this.ST |= Number(!this.Y) << 1 | (this.Y & 128);
                    break;
                // TAY
                default:
                    if (flagsw[IR >> 5] & 0x20) {
                        this.ST |= (flagsw[IR >> 5] & 0xDF);
                    } else {
                        this.ST &= 255 - (flagsw[IR >> 5] & 0xDF);
                    }
                // CLC/SEC/CLI/SEI/CLV/CLD/SED
            }
        } else {
            // nybble2:  0: control/branch/this.Y/compare  4: this.Y/compare  C:this.Y/compare/JMP
            if ((IR & 0x1F) === 0x10) {
                this.PC++;
                this.T = this.memory[this.PC];
                if (this.T & 0x80) {
                    this.T -= 0x100;
                }
                // BPL/BMI/BVC/BVS/BCC/BCS/BNE/BEQ  relative branch
                if (IR & 0x20) {
                    if (this.ST & branchflag[IR >> 6]) {
                        this.PC += this.T;
                        cycles = 3;
                    }
                } else {
                    if (!(this.ST & branchflag[IR >> 6])) {
                        this.PC += this.T;
                        cycles = 3;
                    }
                }
            } else {
                // nybble2:  0:this.Y/control/this.Y/compare  4:this.Y/compare  C:this.Y/compare/JMP
                switch (IR & 0x1F) {
                    // addressing modes
                    case 0:
                        addr = ++this.PC;
                        cycles = 2;
                        break;
                    // imm. (or abs.low for JSR/BRK)
                    case 0x1C:
                        addr = this.memory[++this.PC] + this.memory[++this.PC] * 256 + this.X;
                        cycles = 5;
                        break;
                    // abs,x
                    case 0xC:
                        addr = this.memory[++this.PC] + this.memory[++this.PC] * 256;
                        cycles = 4;
                        break;
                    // abs
                    case 0x14:
                        addr = this.memory[++this.PC] + this.X;
                        cycles = 4;
                        break;
                    // zp,x
                    case 4:
                        addr = this.memory[++this.PC];
                        cycles = 3;
                    // zp
                }
                addr &= 0xFFFF;
                switch (IR & 0xE0) {
                    case 0x00:
                        if (IR === 0) {
                            this.memory[0x100 + this.SP] = this.PC % 256;
                            this.SP--;
                            this.SP &= 0xFF;
                            this.memory[0x100 + this.SP] = this.PC / 256;
                            this.SP--;
                            this.SP &= 0xFF;
                            this.memory[0x100 + this.SP] = this.ST;
                            this.SP--;
                            this.SP &= 0xFF;
                            this.PC = this.memory[0xFFFE] + this.memory[0xFFFF] * 256 - 1;
                            cycles = 7;
                        }// TODO else cycles?
                        break;
                    // BRK
                    case 0x20:
                        if (IR & 0xF) {
                            this.ST &= 0x3D;
                            this.ST |= (this.memory[addr] & 0xC0) | Number(!(this.A & this.memory[addr])) << 1;
                        } else {
                            this.memory[0x100 + this.SP] = (this.PC + 2) % 256;
                            this.SP--;
                            this.SP &= 0xFF;
                            this.memory[0x100 + this.SP] = (this.PC + 2) / 256;
                            this.SP--;
                            this.SP &= 0xFF;
                            this.PC = this.memory[addr] + this.memory[addr + 1] * 256 - 1;
                            cycles = 6;
                        }
                        break;
                    // JSR
                    case 0x40:
                        if (IR & 0xF) {
                            this.PC = addr - 1;
                            cycles = 3;
                        } else {
                            if (this.SP >= 0xFF) {
                                return new InstructionResult(cycles, CPUStatus.done_0xFE);
                            }
                            this.SP++;
                            this.SP &= 0xFF;
                            this.ST = this.memory[0x100 + this.SP];
                            this.SP++;
                            this.SP &= 0xFF;
                            this.T = this.memory[0x100 + this.SP];
                            this.SP++;
                            this.SP &= 0xFF;
                            this.PC = this.memory[0x100 + this.SP] + this.T * 256 - 1;
                            cycles = 6;
                        }
                        break;
                    // RTI
                    case 0x60:
                        if (IR & 0xF) {
                            this.PC = this.memory[addr] + this.memory[addr + 1] * 256 - 1;
                            cycles = 5;
                        } else {
                            if (this.SP >= 0xFF) {
                                return new InstructionResult(cycles, CPUStatus.done_0xFF);
                            }
                            this.SP++;
                            this.SP &= 0xFF;
                            this.T = this.memory[0x100 + this.SP];
                            this.SP++;
                            this.SP &= 0xFF;
                            this.PC = this.memory[0x100 + this.SP] + this.T * 256 - 1;
                            cycles = 6;
                        }
                        break;
                    // RTS
                    case 0xC0:
                        this.T = this.Y - this.memory[addr];
                        this.ST &= 124;
                        this.ST |= Number(!(this.T & 0xFF)) << 1 | (this.T & 128) | Number(this.T >= 0);
                        break;
                    // CPY
                    case 0xE0:
                        this.T = this.X - this.memory[addr];
                        this.ST &= 124;
                        this.ST |= Number(!(this.T & 0xFF)) << 1 | (this.T & 128) | Number(this.T >= 0);
                        break;
                    // CPX
                    case 0xA0:
                        this.Y = this.memory[addr];
                        this.ST &= 125;
                        this.ST |= Number(!this.Y) << 1 | (this.Y & 128);
                        break;
                    // LDY
                    case 0x80:
                        this.memory[addr] = this.Y;
                        storadd = addr;
                    // this.STY
                }
            }
        }
        this.PC++;
        this.PC &= 0xFFFF;
        return new InstructionResult(cycles, CPUStatus.running);
    }
}
