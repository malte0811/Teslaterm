import {CoilID, FEATURE_NOTELEMETRY} from "../../common/constants";
import {getToMainIPCPerCoil} from "../../common/IPCConstantsToMain";
import {getToRenderIPCPerCoil, PerCoilRenderIPCs} from "../../common/IPCConstantsToRenderer";
import {getUD3Connection, hasUD3Connection} from "../connection/connection";
import {receive_main} from "../connection/telemetry";
import {MultiWindowIPC} from "./IPCProvider";

export class TerminalIPC {
    private buffer: string = '';
    private readonly processIPC: MultiWindowIPC;
    private readonly coil: CoilID;
    private readonly renderIPCs: PerCoilRenderIPCs;

    constructor(processIPC: MultiWindowIPC, coil: CoilID) {
        this.coil = coil;
        this.processIPC = processIPC;
        this.renderIPCs = getToRenderIPCPerCoil(this.coil);
        processIPC.on(getToMainIPCPerCoil(coil).manualCommand, async (msg) => {
            try {
                if (hasUD3Connection(coil)) {
                    const connection = getUD3Connection(coil);
                    await connection.sendTelnet(Buffer.from(msg), connection.getManualTerminalID());
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
            connection.getManualTerminalID(),
            (d) => receive_main(this.coil, d, false, false),
        );
        if (connection.getFeatureValue(FEATURE_NOTELEMETRY) === "1") {
            await connection.sendTelnet(
                Buffer.from("\rtterm notelemetry\rcls\r"),
                connection.getManualTerminalID(),
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
