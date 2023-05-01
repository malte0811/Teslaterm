export class CRCCalculator {
    private currentCRC: number;

    constructor() {
        this.init();
    }


    public init() {
        this.currentCRC = 0xFFFFFFFF;
    }

    public step(byte: number) {
        this.currentCRC ^= byte;
        for (let j = 0; j < 8; j++) {
            const mask = -(this.currentCRC & 1);
            this.currentCRC = (this.currentCRC >>> 1) ^ (0xedb88320 & mask);
        }
    }

    public getValue() {
        return ~this.currentCRC;
    }
}
