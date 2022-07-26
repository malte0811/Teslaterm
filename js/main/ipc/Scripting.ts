import {ConfirmReply, IPC_CONSTANTS_TO_MAIN, TransmittedFile} from "../../common/IPCConstantsToMain";
import {ConfirmationRequest, IPC_CONSTANTS_TO_RENDERER, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {Script} from "../scripting";
import {ipcs, MultiWindowIPC} from "./IPCProvider";

export class ScriptingIPC {
    private currentScript: Script | null = null;
    private activeConfirmationID = 0;
    private confirmationResolve: (confirmed: boolean) => void;
    private confirmationReject: () => void;
    private readonly processIPC: MultiWindowIPC;

    constructor(processIPC: MultiWindowIPC) {
        this.processIPC = processIPC;
        processIPC.on(IPC_CONSTANTS_TO_MAIN.script.confirmOrDeny, (src, msg: ConfirmReply) => {
            if (msg.requestID === this.activeConfirmationID && this.confirmationResolve) {
                this.confirmationResolve(msg.confirmed);
                this.confirmationReject = this.confirmationResolve = undefined;
            }
        });
        processIPC.on(IPC_CONSTANTS_TO_MAIN.script.startScript, (src) => this.startScript(src));
        processIPC.on(IPC_CONSTANTS_TO_MAIN.script.stopScript, () => this.stopScript());
    }

    public async startScript(source: object) {
        if (this.currentScript === null) {
            ipcs.misc.openToast('Script', "Please select a script file using drag&drop first", ToastSeverity.info);
        } else {
            await this.currentScript.start(source);
        }
    }

    public stopScript() {
        if (this.currentScript === null) {
            ipcs.misc.openToast('Script', "Please select a script file using drag&drop first", ToastSeverity.info);
        } else if (!this.currentScript.isRunning()) {
            ipcs.misc.openToast('Script', "The script can not be stopped since it isn't running", ToastSeverity.info);
        } else {
            this.currentScript.cancel();
        }
    }

    public async loadScript(file: TransmittedFile) {
        try {
            this.currentScript = await Script.create(file.contents);
            ipcs.menu.setScriptName(file.name);
        } catch (e) {
            ipcs.misc.openToast('Script', "Failed to load script: " + e, ToastSeverity.error);
            console.log(e);
        }
    }

    public requestConfirmation(key: object, msg: string, title?: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if (this.confirmationReject) {
                this.confirmationReject();
            }
            if (this.processIPC.isValidWindow(key)) {
                ++this.activeConfirmationID;
                this.confirmationResolve = resolve;
                this.confirmationReject = reject;
                this.processIPC.sendToWindow(
                    IPC_CONSTANTS_TO_RENDERER.script.requestConfirm,
                    key,
                    new ConfirmationRequest(this.activeConfirmationID, msg, title),
                );
            } else {
                reject();
            }
        });
    }
}
