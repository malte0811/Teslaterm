import React, {useState} from "react";
import {Block, BlockId, BlockIO, FullVMSData, MapReference} from "../../common/VMS";
import {BlockEditor} from "./BlockEditor";
import {MapSelector} from "./MapSelector";

export interface VMSEditorProps {
    programs: FullVMSData;
    setPrograms: (newPrograms: FullVMSData) => void;
}

export interface StartedArrow {
    startBlock: BlockId;
    startIO: BlockIO;
}

export function VMSEditor({programs, setPrograms}: VMSEditorProps) {
    const [currentMap, setCurrentMap] = useState<MapReference>();
    console.log(programs, currentMap);
    const editorCanvas = (() => {
        if (currentMap !== undefined) {
            const {programId, mapId} = currentMap;
            if (programId < programs.length && mapId < programs[programId].maps.length) {
                const setBlocks = (newBlocks: Block[]) => {
                    const newPrograms = [...programs];
                    const newProgram = {...newPrograms[programId]};
                    const newMap = {...newProgram.maps[mapId]};
                    newMap.blocks = newBlocks;
                    newProgram.maps[mapId] = newMap;
                    newPrograms[programId] = newProgram;
                    setPrograms(newPrograms);
                };
                return <BlockEditor
                    blocks={programs[programId].maps[mapId].blocks}
                    setBlocks={setBlocks}
                    key={`${programId}/${mapId}`}
                />;
            }
        }
        return <BlockEditor blocks={[]} setBlocks={() => 0}/>;
    })();
    // TODO area separators
    return <div style={{height: '100%', width: '100%', flexDirection: 'row', display: 'flex'}}>
        <div style={{width: '20%', height: '100%', overflowY: 'auto'}}>
            <MapSelector data={programs} currentSelection={currentMap} setSelection={setCurrentMap}/>
        </div>
        {editorCanvas}
    </div>;
}
