import React, {useState} from "react";
import {ControlPosition} from "react-draggable";
import {Block, BlockId, BlockIO, BlockOutput} from "../../common/VMS";
import {VMSBlockProps} from "./Block";
import {BlockConfig} from "./BlockConfig";
import {ArrowProps} from "./BlockConnections";
import {getPosition} from "./VMSBlockOffsets";
import {VMSEditorCanvas} from "./VMSEditorCanvas";

export interface VMSEditorProps {
    blocks: Block[];
    setBlocks: (newBlocks: Block[]) => void;
}

export interface StartedArrow {
    startBlock: BlockId;
    startIO: BlockIO;
}

function setOutput(block: Block, output: BlockOutput, value: BlockId) {
    if (value === block.uid) {
        return;
    }
    if (output === 'off') {
        block.offBlock = value;
    } else if (value !== undefined && !block.outputBlocks.includes(value)) {
        block.outputBlocks[output] = value;
        block.outputBlocks = block.outputBlocks.filter((x) => x !== undefined);
    }
}

export function findBlockIndex(blocks: Block[], block: BlockId) {
    return blocks.findIndex((b) => b.uid === block);
}

export function findBlock(blocks: Block[], block: BlockId) {
    return blocks[findBlockIndex(blocks, block)];
}

export function VMSEditor({blocks, setBlocks}: VMSEditorProps) {
    const [startedArrow, setStartedArrow] = useState<StartedArrow>();
    // TODO some sort of unselect mechanism
    const [selectedBlockID, setSelectedBlockID] = useState<BlockId>(undefined);
    const onIOClick = (blockId: BlockId, clickedIO: BlockIO) => {
        if (startedArrow !== undefined && (startedArrow.startIO === 'in') === (clickedIO === 'in')) {
            // Cannot connect in to in/out to out
            return;
        }
        const newBlocks = blocks.map((b): Block => ({...b}));
        const clickedBlock = findBlock(newBlocks, blockId);
        if (clickedIO !== 'in') {
            setOutput(clickedBlock, clickedIO, undefined);
        }
        if (startedArrow !== undefined) {
            if (clickedIO !== 'in') {
                setOutput(clickedBlock, clickedIO, startedArrow.startBlock);
            } else if (startedArrow.startIO !== 'in') {
                setOutput(findBlock(newBlocks, startedArrow.startBlock), startedArrow.startIO, blockId);
            }
            setStartedArrow(undefined);
        } else {
            setStartedArrow({startBlock: blockId, startIO: clickedIO});
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
