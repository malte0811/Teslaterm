import React, {useRef, useState} from "react";
import {Button, ButtonGroup, ButtonToolbar} from "react-bootstrap";
import {VMS_LEGACY_SUFFIX} from "../../common/vms/LegacyVMSParser";
import {FullVMSData} from "../../common/vms/VMS";
import {loadVMSFromFile, VMS_JSON_SUFFIX, vmsToJSON} from "../../common/vms/VMSFileIO";
import {downloadJSON, uploadFile} from "../FileHelper";
import {useDropCallback} from "../ScreenWithDrop";
import {VMSEditor} from "./VMSEditor";

export function StandaloneVMSEditor(props: {exit: () => void}) {
    const [programs, setPrograms] = useState<FullVMSData>([]);
    const [name, setName] = useState('example');
    const mainRef = useRef<HTMLDivElement>();
    const loadVMSFrom = (fileName: string, content: string) => {
        const[vmsName, vmsData] = loadVMSFromFile(fileName, content);
        setPrograms(vmsData);
        setName(vmsName);
    };
    useDropCallback(mainRef, async (ev) => {
        const file = ev.dataTransfer.files[0];
        const reader = new FileReader();
        reader.addEventListener('load', () => loadVMSFrom(file.name, reader.result as string));
        reader.readAsText(file);
    });
    const loadFromFile = async () => {
        const file = await uploadFile([VMS_JSON_SUFFIX, VMS_LEGACY_SUFFIX]);
        loadVMSFrom(file.fileName, file.content);
    };
    const downloadJson = () => {
        const jsonData = vmsToJSON(programs);
        downloadJSON(jsonData, name + '.vms.json');
    };
    return <div style={{height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column'}} ref={mainRef}>
        <ButtonToolbar className="justify-content-between">
            <ButtonGroup>
                <Button onClick={downloadJson}>Save to file</Button>
                <Button onClick={loadFromFile}>Load from file</Button>
            </ButtonGroup>
            <Button onClick={props.exit} variant={'warning'}>Exit</Button>
        </ButtonToolbar>
        <div style={{flexGrow: 1}}>
            <VMSEditor programs={programs} setPrograms={setPrograms}/>
        </div>
    </div>;
}
