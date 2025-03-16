export class CyacdRow {
    public readonly humanRowId: number;
    public readonly arrayId: number;
    public readonly cyRowId: number;
    public readonly crc: number;
    public readonly bytes: number[];

    constructor(line: string, humanRowID: number) {
        this.arrayId = parseInt(line.substr(1, 2), 16);
        this.cyRowId = parseInt(line.substr(3, 4), 16);
        const size = parseInt(line.substr(7, 4), 16);
        const data = line.substring(11, line.length - 2);
        this.bytes = [];
        for (let byte = 0; byte < size; ++byte) {
            this.bytes.push(parseInt(data.substr(2 * byte, 2), 16));
        }
        let payloadSum = 0;
        for (const b of this.bytes) {
            payloadSum += b;
            payloadSum &= 0xff;
        }
        const rowCRC = (0x100 - ((payloadSum + this.arrayId
            + (this.cyRowId & 0xff) + (this.cyRowId >> 8)
            + (size & 0xff) + (size >> 8)) & 0xff)) & 0xff;
        const crcFromFile = parseInt(line.substring(line.length - 2), 16);
        if (rowCRC !== crcFromFile) {
            throw new Error("CRC in file is " + crcFromFile.toString() + ", but should be " + rowCRC.toString());
        }
        this.crc = (0x100 - (payloadSum & 0xff)) & 0xff;
        this.humanRowId = humanRowID;
    }
}
