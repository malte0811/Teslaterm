import {CoilID, FEATURE_NOTELEMETRY} from "../../common/constants";
import {getToMainIPCPerCoil} from "../../common/IPCConstantsToMain";
import {getToRenderIPCPerCoil, IPC_CONSTANTS_TO_RENDERER, PerCoilRenderIPCs} from "../../common/IPCConstantsToRenderer";
import {getUD3Connection, hasUD3Connection} from "../connection/connection";
import {receive_main} from "../connection/telemetry";
import {TerminalHandle} from "../connection/types/UD3Connection";
import {MultiWindowIPC} from "./IPCProvider";

export enum TermSetupResult {
    not_connected,
    no_terminal_available,
    success,
}

export class TerminalIPC {
    public readonly terminals = new Map<object, TerminalHandle>();
    public waitingConnections: object[] = [];
    private readonly buffers: Map<object, string> = new Map();
    private readonly processIPC: MultiWindowIPC;
    private readonly coil: CoilID;
    private readonly renderIPCs: PerCoilRenderIPCs;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        this.coil = coil;
        this.processIPC = processIPC;
        this.renderIPCs = getToRenderIPCPerCoil(this.coil);
        processIPC.on(getToMainIPCPerCoil(coil).manualCommand, async (source: object, msg) => {
            try {
                if (hasUD3Connection(coil) && this.terminals.has(source)) {
                    await getUD3Connection(coil).sendTelnet(Buffer.from(msg), this.terminals.get(source));
                }
            } catch (x) {
                console.log("Error while sending: ", x);
            }
        });
        //TODO one of the main tickers?
        setInterval(() => this.tick(), 20);
    }

    public print(s: string, target?: object) {
        let base: string = "";
        if (this.buffers.has(target)) {
            base = this.buffers.get(target);
        }
        this.buffers.set(target, base + s);
    }

    public println(s: string, target?: object) {
        this.print(s + "\r\n", target);
    }

    public async setupTerminal(source: object): Promise<TermSetupResult> {
        if (this.terminals.has(source)) {
            return TermSetupResult.success;
        }
        this.processIPC.addDisconnectCallback(source, () => {
            if (this.terminals.has(source)) {
                if (hasUD3Connection(this.coil)) {
                    getUD3Connection(this.coil).closeTerminal(this.terminals.get(source));
                }
                this.terminals.delete(source);
            }
            this.waitingConnections = this.waitingConnections.filter((conn) => conn === source);
        });
        if (!hasUD3Connection(this.coil)) {
            this.waitingConnections.push(source);
            return TermSetupResult.not_connected;
        }
        const connection = getUD3Connection(this.coil);
        const termID = connection.setupNewTerminal((d) => receive_main(this.coil, d, false, source));
        if (termID === undefined) {
            this.waitingConnections.push(source);
            return TermSetupResult.no_terminal_available;
        }
        this.terminals.set(source, termID);
        await connection.startTerminal(termID);
        if (connection.getFeatureValue(FEATURE_NOTELEMETRY) === "1") {
            await connection.sendTelnet(Buffer.from("\rtterm notelemetry\rcls\r"), termID);
        }
        return TermSetupResult.success;
    }

    public onConnectionClosed() {
        for (const source of this.terminals.keys()) {
            this.waitingConnections.push(source);
        }
        this.terminals.clear();
    }

    public async onSlotsAvailable(sendExcuse: boolean) {
        while (this.waitingConnections.length > 0) {
            const newTerminal = this.waitingConnections.pop();
            if (await this.setupTerminal(newTerminal) !== TermSetupResult.success) {
                this.waitingConnections.push(newTerminal);
                break;
            }
        }
        if (sendExcuse) {
            for (const target of this.waitingConnections) {
                this.println("No free terminal slot available. Will assign one when available.", target);
            }
        }
    }

    private tick() {
        for (const [key, text] of this.buffers) {
            if (key) {
                this.processIPC.sendToWindow(this.renderIPCs.terminal, key, text);
            } else {
                this.processIPC.sendToAll(this.renderIPCs.terminal, text);
            }
        }
        this.buffers.clear();
    }
}
