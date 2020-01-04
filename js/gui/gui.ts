import * as cmd from '../network/commands';
import {loadMidiFile} from "../midi/midi_file";
import * as scripting from '../scripting';
import {setScript} from "./menu";
import * as gauges from './gauges';
import {loadSidFile} from "../sid/sid";

export function init(): void {
    document.getElementById('layout').addEventListener("drop", ondrop);
    document.getElementById('layout').addEventListener("dragover", ondragover);
    terminal.onTerminalReady = function() {
        const io = terminal.io.push();

        terminal.processInput = cmd.sendCommand;
        io.onVTKeystroke = terminal.processInput;

        io.sendString = terminal.processInput;
    };
    gauges.init();
}

hterm.defaultStorage = new lib.Storage.Memory();

export let terminal = new hterm.Terminal();
export const MEAS_SPACE = 20;
export const INFO_SPACE = 150;
export const TOP_SPACE = 20;
export const TRIGGER_SPACE = 10;
export const CONTROL_SPACE = 15;
export const MEAS_POSITION = 4;

function ondrop(e: DragEvent): void {
    e.stopPropagation();
    e.preventDefault();
    if(e.dataTransfer.items.length == 1){//only one file
        const file = e.dataTransfer.files[0];
        const extension = file.name.substring(file.name.lastIndexOf(".")+1);
        if (extension==="mid"){
            loadMidiFile(file);
        } else if (extension=="js") {
            scripting.loadScript(file.path)
                .then((script)=> {
                    setScript(script);
                    w2ui['toolbar'].get('mnu_script').text = 'Script: '+file.name;
                    w2ui['toolbar'].refresh();
                })
                .catch((err)=>{
                    terminal.io.println("Failed to load script: "+err);
                    console.log(err);
                });
        } else if (extension=="dmp"||extension=="sid") {
            loadSidFile(file);
        }
    }
}

function ondragover(e: DragEvent): void {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}
