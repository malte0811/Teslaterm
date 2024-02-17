import * as net from "net";
import {forEachCoil} from "../connection/connection";
import {getActiveSIDConnection} from "./ISidConnection";
import {queueSIDFrame, shouldQueueSIDFrames} from "./sid";
import {FRAME_LENGTH, SidFrame} from "./sid_api";
import {Command, NTSC, PAL, ReplyCode, TimingStandard} from "./SIDConstants";

export class NetworkSIDServer {
    private serverSocket?: net.Server;
    private activeSocket?: net.Socket;
    private readonly port: number;
    private timeSinceLastFrame: number = 0;
    private currentSIDState: Uint8Array = new Uint8Array(FRAME_LENGTH);
    private timeStandard: TimingStandard = PAL;
    private firstAfterReset: boolean = false;
    private sendTimer: NodeJS.Timeout;

    public constructor(port: number) {
        this.port = port;
        this.startListening();
    }

    public close() {
        if (this.activeSocket) {
            this.activeSocket.resetAndDestroy();
        }
        this.stopListening();
    }

    private startListening() {
        if (!this.serverSocket) {
            this.activeSocket = undefined;
            this.serverSocket = net.createServer(conn => this.onConnected(conn));
            this.serverSocket.listen(this.port);
        }
    }

    private stopListening() {
        if (this.serverSocket) {
            this.serverSocket.close();
            this.serverSocket = undefined;
        }
    }

    private onConnected(socket: net.Socket) {
        this.activeSocket = socket;
        console.log("start");
        this.stopListening();
        socket.once("close", () => {
            this.startListening();
            clearTimeout(this.sendTimer);
            console.log("stop");
        });
        socket.on("error", err => {
            console.log("Error in NetSID connection: ", err);
        });
        socket.on("data", async (data) => {
            this.handleMessage(data, d => socket.write(d));
        });
    }

    private processFrames(data: number[] | Buffer) {
        for (let i = 0; i + 3 < data.length; i += 4) {
            const delay = (data[i] << 8) | data[i + 1];
            const register = data[i + 2];
            const value = data[i + 3];
            this.timeSinceLastFrame = delay + this.timeSinceLastFrame;
            const cyclesPerFrame = this.timeStandard.cycles_per_frame;
            this.currentSIDState[register] = value;

            if (this.timeSinceLastFrame > 19000) {
                // console.log(delay , this.timeSinceLastFrame);
                let frameTime = cyclesPerFrame;
                if (this.firstAfterReset) {
                    frameTime *= 20;
                    this.firstAfterReset = false;
                }
                queueSIDFrame(new SidFrame(Uint8Array.from(this.currentSIDState), this.timeSinceLastFrame));
                this.timeSinceLastFrame = 0;
            }

        }
    }

    private handleMessage(data: Buffer, sendReply: (data) => void) {
        const command = data[0];
        const sidNum = data[1];
        const additional = data.subarray(4);
        const len = additional.length;
        let returnCode = Buffer.of(ReplyCode.OK);
        let toRead: undefined | number[] | Buffer;
        switch (command) {
            case Command.FLUSH:
                forEachCoil((coil) => {
                    getActiveSIDConnection(coil)?.flush();
                    getActiveSIDConnection(coil)?.onStart();
                });
                this.firstAfterReset = true;
                break;
            case Command.TRY_SET_SID_COUNT:
                if (sidNum > 1) {
                    console.warn("Trying to enabled " + sidNum + " SIDs, only one is supported!");
                }
                break;
            case Command.MUTE:
                // Not supported (?)
                break;
            case Command.TRY_RESET:
                this.currentSIDState.fill(0);
                this.firstAfterReset = true;
                break;
            case Command.TRY_DELAY: {
                const delay = (additional[0] << 8) | additional[1];
                this.timeSinceLastFrame += delay;
                break;
            }
            case Command.TRY_WRITE:
                if (!shouldQueueSIDFrames()) {
                    returnCode = Buffer.of(ReplyCode.BUSY);
                } else {
                    toRead = additional;
                }

                break;
            case Command.TRY_READ: {
                if (!shouldQueueSIDFrames()) {
                    returnCode = Buffer.of(ReplyCode.BUSY);
                } else {
                    toRead = additional.slice(0, len - 3);
                    const delay = (additional[len - 3] << 8) | additional[len - 2];
                    this.timeSinceLastFrame += delay;
                    // we do not have registers to read from, so we need to hope always reading 0 doesn't break anything
                    returnCode = Buffer.of(ReplyCode.READ, 0);
                }
                break;
            }
            case Command.GET_VERSION:
                returnCode = Buffer.of(ReplyCode.VERSION, 2);
                break;
            case Command.TRY_SET_SAMPLING:
                // Not supported
                break;
            case Command.SET_CLOCKING:
                if (additional[0] === 0) {
                    this.timeStandard = PAL;
                } else {
                    this.timeStandard = NTSC;
                }
                break;
            case Command.GET_CONFIG_COUNT:
                returnCode = Buffer.of(ReplyCode.COUNT, 1);
                break;
            case Command.GET_CONFIG_INFO:
                returnCode = Buffer.concat([
                    Buffer.of(ReplyCode.INFO, 1),
                    Buffer.from("UD3\0"),
                ]);
                break;
            case Command.SET_SID_POSITION:
            case Command.SET_SID_LEVEL:
            case Command.SET_SID_MODEL:
                // Not supported
                break;
            default:
                console.warn("Unexpected command in SID data packet:", data);
                break;
        }
        sendReply(returnCode);
        if (toRead) {
            this.processFrames(toRead);
        }
    }
}
