import {Allotment} from "allotment";
import React, {useState} from "react";
import {Block, BlockId, BlockIO, FullVMSData, MapReference} from "../../common/VMS";
import {findBlockIndex} from "../../common/VMSOperations";
import {BlockConfig} from "./BlockConfig";
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
    const isValidMap = currentMap !== undefined &&
        programs[currentMap.programId] !== undefined &&
         programs[currentMap.programId].maps[currentMap.mapId] !== undefined;
    const {programId, mapId} = currentMap || {programId: 0, mapId: 0};
    const currentBlocks = isValidMap && programs[programId].maps[mapId].blocks;
    const [selectedBlockId, setSelectedBlockId] = useState<number>(undefined);
    const [canvas, blockConfig] = (() => {
        if (!isValidMap) {
            return [<div/>, <div/>];
        }
        const setBlocks = (newBlocks: Block[]) => {
            const newPrograms = [...programs];
            const newProgram = {...newPrograms[programId]};
            const newMap = {...newProgram.maps[mapId]};
            newMap.blocks = newBlocks;
            newProgram.maps[mapId] = newMap;
            newPrograms[programId] = newProgram;
            setPrograms(newPrograms);
        };
        const canvas = <BlockEditor
            blocks={currentBlocks}
            setBlocks={setBlocks}
            key={`${programId}/${mapId}`}
            selectBlock={setSelectedBlockId}
        />;
        if (selectedBlockId !== undefined) {
            const index = findBlockIndex(currentBlocks, selectedBlockId);
            const updateBlock = (update: Partial<Block>) => {
                const updated = [...currentBlocks];
                updated[index] = {...updated[index], ...update};
                setBlocks(updated);
            };
            return [canvas, <BlockConfig block={currentBlocks[index]} updateBlock={(update) => updateBlock(update)}/>];
        } else {
            return [canvas, <div></div>];
        }
    })();
    // TODO area separators
    return <Allotment defaultSizes={[1, 4, 1]} >
        <MapSelector data={programs} currentSelection={currentMap} setSelection={(newMap) => {
            setCurrentMap(newMap);
            setSelectedBlockId(undefined);
        }}/>
        {canvas}
        {blockConfig}
    </Allotment>;
}
