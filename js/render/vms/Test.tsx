import {useRef, useState} from "react";
import {FullVMSData} from "../../common/VMS";
import {makeDefaultProgram} from "../../common/VMSOperations";
import {parseLegacyVMSFile} from "../../main/vms/LegacyVMSParser";
import {useDropCallback} from "../ScreenWithDrop";
import {VMSEditor} from "./VMSEditor";

export function VMSTest() {
    const [programs, setPrograms] = useState<FullVMSData>([]);
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
