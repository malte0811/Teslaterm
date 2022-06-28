import {MiscIPC} from "../ipc/Misc";

interface IMidiInput {
    cancel: (reason?: any) => void;
    isActive: () => boolean;
    data: any;
    source: string;
}

const midiNone: IMidiInput = {
    cancel: () => setMidiInAsNone(),
    data: null,
    isActive: () => false,
    source: "",
};

let midiIn: IMidiInput = midiNone;
let selectMidiIn: HTMLSelectElement;
let midiAccess: WebMidi.MIDIAccess;

export async function init() {
    if (navigator.requestMIDIAccess) {
        try {
            midiAccess = await navigator.requestMIDIAccess();
            midiAccess.onstatechange = midiConnectionStateChange;
            selectMidiIn = (document.getElementById("midiIn") as HTMLSelectElement);
            selectMidiIn.onchange = onSelectMidiIn;
            populateMIDISelects();
        } catch (e) {

        }
    } else {
        alert("No MIDI support in your browser.");
    }
}

export function populateMIDISelects() {
    // clear the MIDI input select
    selectMidiIn.options.length = 0;

    addElementKeepingSelected("None", "", midiIn.source, selectMidiIn);
    for (const input of midiAccess.inputs.values()) {
        const str = input.name.toString();
        const preferred = !midiIn.isActive() &&
            ((str.indexOf("Tesla") !== -1) || (str.toLowerCase().indexOf("keyboard") !== -1));
        addElementKeepingSelected(input.name, input.id, midiIn.source, selectMidiIn, preferred);
    }
    onSelectMidiIn();
}

export function select(sel: number) {
    selectMidiIn.selectedIndex = sel;
}

function onSelectMidiIn() {
    const selected = selectMidiIn.selectedIndex;
    const id = (selectMidiIn[selected] as HTMLOptionElement).value;
    if (id !== midiIn.source) {
        if (midiIn.isActive()) {
            midiIn.cancel(null);
        }

        selectMidiIn.selectedIndex = selected;
        if (id) {
            const midiSource = midiAccess.inputs.get(id);
            setMidiInToPort(midiSource);
        } else {
            setMidiInAsNone();
        }
    }
}

function addElementKeepingSelected(name: string, id: string, oldId: string, selector: HTMLSelectElement, forceSelect: boolean = false) {
    const preferred = forceSelect || id === oldId;
    selector.appendChild(new Option(name, id, preferred, preferred));
}

function midiConnectionStateChange(e) {
    console.log("connection: " + e.port.name + " " + e.port.connection + " " + e.port.state);
    populateMIDISelects();
}

export function setMidiInAsNone() {
    if (midiIn.isActive()) {
        midiIn.cancel();
    }
    midiIn = midiNone;
    select(0);
    populateMIDISelects();
}

export function setMidiInToPort(source: WebMidi.MIDIInput) {
    source.onmidimessage = msg => {
        MiscIPC.sendMidi(msg.data);
    };
    let canceled = false;
    midiIn = {
        cancel: () => {
            source.onmidimessage = null;
            canceled = true;
            setMidiInAsNone();
        },
        data: null,
        isActive: () => (!canceled && source.state !== "disconnected"),
        source: source.id,
    };
    populateMIDISelects();
}
