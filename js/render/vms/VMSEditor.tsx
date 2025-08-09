import React, {useState} from "react";
import {Block, BlockId, BlockIO, FullVMSData} from "../../common/VMS";
import {BlockEditor} from "./BlockEditor";

export interface VMSEditorProps {
    programs: FullVMSData;
    setPrograms: (newPrograms: FullVMSData) => void;
}

export interface StartedArrow {
    startBlock: BlockId;
    startIO: BlockIO;
}

export function VMSEditor({programs, setPrograms}: VMSEditorProps) {
    const [currentProgram, setCurrentProgram] = useState(0);
    const [currentMap, setCurrentMap] = useState(0);
    const setBlocks = (newBlocks: Block[]) => {
        const newPrograms = [...programs];
        const newProgram = {...newPrograms[currentProgram]};
        const newMap = {...newProgram.maps[currentMap]};
        newMap.blocks = newBlocks;
        newProgram.maps[currentMap] = newMap;
        newPrograms[currentProgram] = newProgram;
        setPrograms(newPrograms);
    };
    // TODO area separators
    return <div style={{height: '100%', width: '100%', flexDirection: 'row', display: 'flex'}}>
        <div style={{width: '20%', height: '100%'}}>TODO program selector etc</div>
        <BlockEditor blocks={programs[currentProgram].maps[currentMap].blocks} setBlocks={setBlocks}/>
    </div>;
}
