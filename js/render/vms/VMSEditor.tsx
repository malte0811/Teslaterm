import React, {useState} from "react";
import {ControlPosition} from "react-draggable";
import {Block, BlockId, BlockIO} from "../../common/VMS";
import {VMSBlockProps} from "./Block";
import {BlockConfig} from "./BlockConfig";
import {ArrowProps} from "./BlockConnections";
import {getPosition} from "./VMSBlockOffsets";
import {VMSEditorCanvas} from "./VMSEditorCanvas";
import {addConnection, findBlock, findBlockIndex, removeConnectionAt} from "./VMSOperations";

export interface VMSEditorProps {
    blocks: Block[];
    setBlocks: (newBlocks: Block[]) => void;
}

export interface StartedArrow {
    startBlock: BlockId;
    startIO: BlockIO;
}

export function VMSEditor({blocks, setBlocks}: VMSEditorProps) {
    const [startedArrow, setStartedArrow] = useState<StartedArrow>();
    // TODO some sort of unselect mechanism
    const [selectedBlockID, setSelectedBlockID] = useState<BlockId>(undefined);
    const onIOClick = (blockId: BlockId, clickedIO: BlockIO) => {
        const newBlocks = structuredClone(blocks);
        if (startedArrow === undefined) {
            const clickedBlock = findBlock(newBlocks, blockId);
            if (clickedIO !== 'in') {
                removeConnectionAt(clickedBlock, clickedIO);
            }
            setStartedArrow({startBlock: blockId, startIO: clickedIO});
        } else {
            addConnection(newBlocks, startedArrow.startBlock, startedArrow.startIO, blockId, clickedIO);
            setStartedArrow(undefined);
            console.log(newBlocks);
        }
        setBlocks(newBlocks);
    };

    const updateBlock = (blockId: number, update: Partial<Block>) => {
        const updated = [...blocks];
        const index = findBlockIndex(updated, blockId);
        updated[index] = {...updated[index], ...update};
        setBlocks(updated);
    };
    const [positions, setPositions] = useState<ControlPosition[]>(() => {
        const initPositions: ControlPosition[] = [];
        for (const block of blocks) {
            initPositions[block.uid] = {x: 0, y: block.uid};
        }
        return initPositions;
    });
    const blockElements: VMSBlockProps[] = [];
    blocks.forEach((block) => {
        blockElements.push({
            block,
            onClick: () => setSelectedBlockID(block.uid),
            onIOClick: (io) => onIOClick(block.uid, io),
            position: positions[block.uid],
            setPosition: (newPos) => {
                const newPositions = [...positions];
                newPositions[block.uid] = newPos;
                setPositions(newPositions);
            },
            updateBlock: (update) => updateBlock(block.uid, update),
        });
    });
    const arrows: ArrowProps[] = [];
    const addArrow = (fromBlock: BlockId, outputId: BlockIO, toBlock: BlockId) => {
        arrows.push({
            fromIO: outputId,
            startPosition: getPosition(findBlock(blocks, fromBlock), positions[fromBlock], outputId),
            toBlock: positions[toBlock],
        });
    };
    for (const block of blocks) {
        block.outputBlocks.forEach((next, i) => addArrow(block.uid, i, next));
        if (block.offBlock !== undefined) {
            addArrow(block.uid, 'off', block.offBlock);
        }
    }
    if (startedArrow) {
        addArrow(startedArrow.startBlock, startedArrow.startIO, undefined);
    }
    const blockConfigElement = (() => {
        if (selectedBlockID !== undefined) {
            const block = findBlock(blocks, selectedBlockID);
            return <BlockConfig
                block={block}
                updateBlock={(update) => updateBlock(block.uid, update)}
            />;
        }
    })();
    // TODO area separators
    return <div style={{height: '100%', width: '100%', flexDirection: 'row', display: 'flex'}}>
        <div style={{width: '20%', height: '100%'}}>TODO program selector etc</div>
        <div style={{height: '100%', flexBasis: 'auto', flexGrow: 1, flexShrink: 1}}>
            <VMSEditorCanvas arrows={arrows} blocks={blockElements} onAuxClick={() => setStartedArrow(undefined)}/>
        </div>
        <div style={{width: '20%', height: '100%'}}>{blockConfigElement}</div>
    </div>;
}
