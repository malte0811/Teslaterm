import {Allotment} from "allotment";
import React, {useState} from "react";
import {Block, BlockId, BlockIO, BlockMap, FullVMSData, MapReference} from "../../common/vms/VMS";
import {findBlockIndex, findFreeId} from "../../common/vms/VMSOperations";
import {BlockConfig} from "./BlockConfig";
import {BlockEditor} from "./BlockEditor";
import {MapSelector} from "./MapSelector";

export interface VMSEditorProps {
    programs: FullVMSData;
    setPrograms: (newPrograms: FullVMSData) => void;
}

export interface StartedArrow {
    fromBlock: BlockId;
    fromIO: BlockIO;
}

export function VMSEditor({programs, setPrograms}: VMSEditorProps) {
    const [currentMapId, setCurrentMapId] = useState<MapReference>();
    const isValidMap = currentMapId !== undefined &&
        programs[currentMapId.programId] !== undefined &&
        programs[currentMapId.programId].maps[currentMapId.mapId] !== undefined;
    const {programId, mapId} = currentMapId || {programId: 0, mapId: 0};
    const currentMap = isValidMap && programs[programId].maps[mapId];
    const [selectedBlockId, setSelectedBlockId] = useState<number>(undefined);
    const newBlockId = findFreeId(programs);
    const [mainCanvas, blockConfig] = (() => {
        if (!isValidMap) {
            return [<div/>, <div/>];
        }
        const updateMap = (update: Partial<BlockMap>) => {
            const newPrograms = [...programs];
            const newProgram = {...newPrograms[programId]};
            newProgram.maps[mapId] = {...currentMap, ...update};
            newPrograms[programId] = newProgram;
            setPrograms(newPrograms);
        };
        const canvas = <BlockEditor
            blocks={currentMap.blocks}
            setBlocks={(blocks) => updateMap({blocks})}
            key={`${programId}/${mapId}`}
            selectBlock={setSelectedBlockId}
            selectedBlock={selectedBlockId}
            startBlock={programs[programId].maps[mapId].startBlock}
            nextFreeId={newBlockId}
        />;
        if (selectedBlockId !== undefined) {
            const arrayIndex = findBlockIndex(currentMap.blocks, selectedBlockId);
            const updateBlock = (update: Partial<Block>) => {
                const updated = [...currentMap.blocks];
                updated[arrayIndex] = {...updated[arrayIndex], ...update};
                updateMap({blocks: updated});
            };
            return [canvas, <BlockConfig
                block={currentMap.blocks[arrayIndex]}
                updateBlock={(update) => updateBlock(update)}
                isStart={currentMap.startBlock === selectedBlockId}
                useAsStart={() => updateMap({startBlock: selectedBlockId})}
            />];
        } else {
            return [canvas, <div></div>];
        }
    })();
    return <Allotment defaultSizes={[1, 4, 1]}>
        <MapSelector
            data={programs}
            currentSelection={currentMapId}
            setSelection={(newMap) => {
                setCurrentMapId(newMap);
                setSelectedBlockId(undefined);
            }}
            newBlockId={newBlockId}
            setData={setPrograms}
        />
        <div style={{width: '100%', height: '100%'}}>
            {mainCanvas}
        </div>
        <div style={{width: '100%', height: '100%'}}>
            {blockConfig}
        </div>
    </Allotment>;
}
