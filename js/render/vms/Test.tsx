import {useRef, useState} from "react";
import {FullVMSData} from "../../common/VMS";
import {parseLegacyVMSFile} from "../../main/vms/LegacyVMSParser";
import {useDropCallback} from "../ScreenWithDrop";
import {VMSEditor} from "./VMSEditor";

export function VMSTest() {
    const [programs, setPrograms] = useState<FullVMSData>([{
        maps: [
            {
                ENA_PORTAMENTO: false,
                blocks: [],
                enableDamper: false,
                enablePitchbend: false,
                enableStereo: false,
                enableVolume: false,
                endNote: 0,
                noteFrequency: {
                    midiNotes: 0,
                    type: "offset",
                },
                startBlock: 0,
                startNote: 0,
                volumeModifier: 0,
            },
        ],
        name: 'Default',
    }]);
    const mainRef = useRef<HTMLDivElement>();
    useDropCallback(mainRef, async (ev) => {
        const fileData = await ev.dataTransfer.files[0].arrayBuffer();
        const newPrograms = parseLegacyVMSFile(Buffer.from(fileData));
        setPrograms(newPrograms);
    });
    return <div style={{height: '100vh', width: '100vw'}} ref={mainRef}>
        <VMSEditor programs={programs} setPrograms={setPrograms}/>
    </div>;
}
