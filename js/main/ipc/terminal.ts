import {CoilID, FEATURE_NOTELEMETRY} from "../../common/constants";
import {getToMainIPCPerCoil} from "../../common/IPCConstantsToMain";
import {getToRenderIPCPerCoil, PerCoilRenderIPCs} from "../../common/IPCConstantsToRenderer";
import {getUD3Connection, hasUD3Connection} from "../connection/connection";
import {receive_main} from "../connection/telemetry";
import {TerminalHandle} from "../connection/types/UD3Connection";
import {TemporaryIPC} from "./TemporaryIPC";

export class TerminalIPC {
    private buffer: string = '';
    private readonly processIPC: TemporaryIPC;
    private readonly coil: CoilID;
    private readonly renderIPCs: PerCoilRenderIPCs;

    constructor(processIPC: TemporaryIPC, coil: CoilID) {
        this.coil = coil;
        this.processIPC = processIPC;
        this.renderIPCs = getToRenderIPCPerCoil(this.coil);
        processIPC.on(getToMainIPCPerCoil(coil).manualCommand, async (msg) => {
            try {
                if (hasUD3Connection(coil)) {
                    const connection = getUD3Connection(coil);
                    await connection.sendTelnet(Buffer.from(msg), TerminalHandle.manual);
                }
            } catch (x) {
                console.log("Error while sending: ", x);
            }
        });
        // TODO one of the main tickers?
        setInterval(() => this.tick(), 20);
    }

    public print(s: string) {
        this.buffer += s;
    }

    public println(s: string) {
        this.print(s + "\r\n");
    }

    public async setupManualTerminal(): Promise<any> {
        const connection = getUD3Connection(this.coil);
        await connection.startTerminal(
            TerminalHandle.manual,
            (d) => receive_main(this.coil, d, false, false),
        );
        if (connection.getFeatureValue(FEATURE_NOTELEMETRY) === "1") {
            await connection.sendTelnet(
                Buffer.from("\rtterm notelemetry\rcls\r"),
                TerminalHandle.manual,
            );
        }
    }

    public onConnectionClosed() {
        this.buffer = '';
    }

    private tick() {
        if (this.buffer.length > 0) {
            this.processIPC.send(this.renderIPCs.terminal, this.buffer);
            this.buffer = '';
        }
    }
}
