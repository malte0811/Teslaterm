import {commands} from "../ipc/commands";
import {FileUploadIPC} from "../ipc/FileUpload";
import * as gauges from "./gauges";
import {terminal} from "./constants";

export function init(): void {
    document.getElementById("layout").addEventListener("drop", ondrop);
    document.getElementById("layout").addEventListener("dragover", ondragover);

    terminal.onKey((event) => commands.sendManualCommand(event.key));
    // TODO paste etc?
    gauges.init();
}

async function ondrop(e: DragEvent): Promise<void> {
    e.stopPropagation();
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (e.dataTransfer.items.length === 1 && !files[0].name.endsWith(".js")) {// only one file, not a script
        const file = files[0];
        FileUploadIPC.uploadFile(file);
    } else {
        // Multiple files or a JS file => compress and treat as script
        let scriptName: string | null = null;
        for (const file in files) {
            if (file.endsWith(".js")) {
                if (scriptName) {
                    // More than one script => Not able to run
                    return;
                } else {
                    scriptName = file;
                }
            }
        }
        if (!scriptName) {
            return;
        }
        scriptName = scriptName.substr(0, scriptName.length - 2) + "zip";
        const zip = new JSZip();
        // Not actually possible here!
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < files.length; ++i) {
            const file = files[i];
            zip.file(file.name, await file.arrayBuffer());
        }
        const zipContent = await zip.generateAsync({type: "uint8array"});
        FileUploadIPC.upload(scriptName, zipContent);
    }
}

function ondragover(e: DragEvent): void {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
}
