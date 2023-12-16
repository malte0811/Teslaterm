// TODO something's broken about the JSZip type defs, this weird import hides the errors
import * as JSZip from "jszip/dist/jszip.min.js";
import * as vm from 'vm';
import {TransmittedFile} from "../common/IPCConstantsToMain";
import {ToastSeverity} from "../common/IPCConstantsToRenderer";
import {forEachCoil, getCoilCommands} from "./connection/connection";
import {ipcs} from "./ipc/IPCProvider";
import * as media_player from "./media/media_player";
import {isMediaFile} from "./media/media_player";

const maxQueueLength = 1000;

class ScriptQueueEntry {
    public readonly run: () => Promise<void>;
    public readonly assertApplicable: () => Promise<void>;

    constructor(run: () => Promise<void>, assertApplicable: () => Promise<void>) {
        this.run = run;
        this.assertApplicable = assertApplicable;
    }
}

export class Script {
    private running: boolean = false;
    private interruptFunc: (() => any) | null = null;
    private readonly queue: ScriptQueueEntry[];
    private readonly zip: JSZip;
    private starterKey: object;

    private constructor(zip: JSZip, code: string) {
        this.zip = zip;
        this.queue = [];
        const sandbox = vm.createContext({
            // Useful but harmless APIs
            Math,
            // calls for the queue
            delay: this.wrapForSandbox((delay) => this.timeoutSafe(delay)),
            loadMediaFile: this.wrapForSandboxWithCheck(f => this.loadMediaFile(f), f => this.assertFileExists(f)),
            playMediaAsync: this.wrapForSandboxNonPromise(() => media_player.media_state.startPlaying()),
            playMediaBlocking: this.wrapForSandbox(() => this.playMediaBlocking()),
            println: this.wrapForSandbox((s) => {
                ipcs.misc.openGenericToast('Script output', s, ToastSeverity.info);
                return Promise.resolve();
            }),
            setBPS: this.wrapForSandboxNonPromise(d => forEachCoil(coil => ipcs.sliders(coil).setBPS(d))),
            setBurstOfftime: this.wrapForSandboxNonPromise(
                d => forEachCoil(coil => ipcs.sliders(coil).setBurstOfftime(d)),
            ),
            setBurstOntime: this.wrapForSandboxNonPromise(
                d => forEachCoil(coil => ipcs.sliders(coil).setBurstOntime(d)),
            ),
            setOntime: this.wrapForSandboxNonPromise(
                d => forEachCoil(coil => ipcs.sliders(coil).setRelativeOntime(d)),
            ),
            setTransientMode: this.wrapForSandboxNonPromise(
                enabled => forEachCoil(coil => getCoilCommands(coil).setTransientEnabled(enabled)),
            ),
            stopMedia: this.wrapForSandboxNonPromise(() => media_player.media_state.stopPlaying()),
            waitForConfirmation: this.wrapForSandbox((msg, title) => this.waitForConfirmation(msg, title)),
        });
        try {
            vm.runInContext(code, sandbox, {timeout: 1000});
        } catch (e) {
            console.log("Err");
        }
    }

    public static async create(zipData: ArrayBuffer): Promise<Script | null> {
        const loadedZip: JSZip = await JSZip.loadAsync(zipData);

        let scriptName = null;
        for (const name of Object.keys(loadedZip.files)) {
            if (name.endsWith(".js")) {
                if (scriptName) {
                    throw new Error("Multiple scripts in zip: " + scriptName + " and " + name);
                }
                scriptName = name;
            }
        }
        if (scriptName == null) {
            throw new Error("Did not find script in zip file!");
        }
        const script = await loadedZip.file(scriptName).async("string");
        const ret = new Script(loadedZip, script);
        for (const entry of ret.queue) {
            await entry.assertApplicable();
        }
        return ret;
    }

    public cancel() {
        this.running = false;
        if (this.interruptFunc) {
            this.interruptFunc();
            this.interruptFunc = null;
        }
    }

    public isRunning(): boolean {
        return this.running;
    }

    public async start(starterKey: object) {
        if (this.running) {
            ipcs.misc.openGenericToast(
                'Script',
                'The script is already running.',
                ToastSeverity.info,
                'script-info',
                starterKey
            );
            return;
        }
        this.starterKey = starterKey;
        forEachCoil(coil => ipcs.sliders(coil).setOnlyMaxOntimeSettable(true));
        this.running = true;
        try {
            for (const entry of this.queue) {
                if (!this.isRunning()) {
                    ipcs.misc.openGenericToast(
                        'Script', 'Cancelled script', ToastSeverity.info, 'script-info', starterKey
                    );
                    break;
                }
                await entry.run();
            }
            if (this.isRunning()) {
                ipcs.misc.openGenericToast(
                    'Script', 'Script finished normally', ToastSeverity.info, 'script-info', starterKey
                );
            }
        } catch (x) {
            ipcs.misc.openGenericToast(
                'Script', 'Script finished with error: ' + x, ToastSeverity.warning, 'script-info', starterKey
            );
            console.error(x);
        }
        this.running = false;
        forEachCoil(coil => ipcs.sliders(coil).setOnlyMaxOntimeSettable(false));
    }

    private wrapForSandboxNonPromise(func: (...args: any[]) => void): (...args: any[]) => void {
        return this.wrapForSandbox((...args) => {
            func(...args);
            return Promise.resolve();
        });
    }

    private wrapForSandbox(func: (...args: any[]) => Promise<any>): (...args: any[]) => void {
        return this.wrapForSandboxWithCheck(func, () => Promise.resolve());
    }

    private wrapForSandboxWithCheck(
        func: (...args: any[]) => Promise<any>,
        check: (...args: any[]) => Promise<any>,
    ): (...args: any[]) => void {
        return (...args) => {
            if (this.queue.length >= maxQueueLength) {
                throw new Error("Maximum queue length reached! " + this.queue.length);
            }
            this.queue.push(new ScriptQueueEntry(() => func(...args), () => check(...args)));
        };
    }

    private timeoutSafe(delay): Promise<any> {
        return new Promise<void>((res, rej) => {
            const timeoutId = setTimeout(() => {
                this.interruptFunc = null;
                res();
            }, delay);
            this.interruptFunc = () => {
                clearTimeout(timeoutId);
                rej("Canceled");
            };
        });
    }

    private playMediaBlocking(): Promise<any> {
        return new Promise<void>((resolve, reject) => {
            onMediaStopped = () => {
                onMediaStopped = () => {
                };
                this.interruptFunc = null;
                resolve();
            };
            this.interruptFunc = () => {
                media_player.media_state.stopPlaying();
                reject("Canceled");
            };
            media_player.media_state.startPlaying();
        });
    }

    private async assertFileExists(file: string) {
        if (!isMediaFile(file)) {
            throw new Error("\"" + file + "\" cannot be loaded as a media file!");
        }
        const fileInZip = this.zip.file(file);
        if (!fileInZip) {
            throw new Error("File \"" + file + "\" does not exist in zip");
        }
    }

    private async loadMediaFile(file: string) {
        const fileInZip = this.zip.file(file);
        const contents = await fileInZip.async("uint8array");
        await media_player.loadMediaFile(new TransmittedFile(file, contents));
    }

    private async waitForConfirmation(text, title): Promise<any> {
        const confirmed = await ipcs.scripting.requestConfirmation(this.starterKey, text, title);
        if (!confirmed) {
            throw new Error("User did not confirm");
        }
    }
}

export let onMediaStopped = () => {
};
