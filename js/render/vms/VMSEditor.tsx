import React, {useState} from "react";
import {ControlPosition} from "react-draggable";
import {Block, BlockId, BlockIO, BlockOutput} from "../../common/VMS";
import {VMSBlockProps} from "./Block";
import {ArrowProps} from "./BlockConnections";
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
    if (output === 'off') {
        block.offBlock = value;
    } else {
        block.outputBlocks[output] = value;
    }
}

export function VMSEditor({blocks, setBlocks}: VMSEditorProps) {
    const [startedArrow, setStartedArrow] = useState<StartedArrow>();
    const findBlockArrayIndex = (block: BlockId) => {
        for (let i = 0; i < blocks.length; ++i) {
            if (blocks[i].uid === block) {
                return i;
            }
        }
        throw new Error("Did not find block " + block);
    };
    const onIOClick = (block: BlockId, clickedIO: BlockIO) => {
        if (startedArrow !== undefined && (startedArrow.startIO === 'in') === (clickedIO === 'in')) {
            // Cannot connect in to in/out to out
            return;
        }
        const blockIndex = findBlockArrayIndex(block);
        const newBlocks = blocks.map((b): Block => ({...b}));
        if (clickedIO !== 'in') {
            setOutput(newBlocks[blockIndex], clickedIO, undefined);
        }
        if (startedArrow !== undefined) {
            if (clickedIO !== 'in') {
                setOutput(newBlocks[blockIndex], clickedIO, startedArrow.startBlock);
            } else if (startedArrow.startIO !== 'in') {
                setOutput(newBlocks[findBlockArrayIndex(startedArrow.startBlock)], startedArrow.startIO, block);
            }
            setStartedArrow(undefined);
        } else {
            setStartedArrow({startBlock: block, startIO: clickedIO});
        }
        setBlocks(newBlocks);
    };

    const [positions, setPositions] = useState<ControlPosition[]>(() => {
        const initPositions: ControlPosition[] = [];
        for (const block of blocks) {
            initPositions[block.uid] = {x: 0, y: block.uid};
        }
        return initPositions;
    });
    const blockElements: VMSBlockProps[] = [];
    for (const block of blocks) {
        blockElements.push({
            block,
            onClick: (io) => onIOClick(block.uid, io),
            position: positions[block.uid],
            setPosition: (newPos) => {
                const newPositions = [...positions];
                newPositions[block.uid] = newPos;
                setPositions(newPositions);
            },
        });
    }
    const arrows: ArrowProps[] = [];
    const addArrow = (fromBlock: BlockId, outputId: BlockOutput, toBlock: BlockId) => {
        if (toBlock !== undefined) {
            arrows.push(
                {fromBlock: positions[fromBlock], fromOutput: outputId, toBlock: positions[toBlock], toType: 'in'},
            );
        }
    };
    for (const block of blocks) {
        for (let i = 0; i < 4; ++i) {
            addArrow(block.uid, i, block.outputBlocks[i]);
        }
        addArrow(block.uid, 'off', block.offBlock);
    }
    return <VMSEditorCanvas
        arrows={arrows}
        blocks={blockElements}
        onAuxClick={() => setStartedArrow(undefined)}
        startedArrow={startedArrow && {blockPosition: positions[startedArrow.startBlock], io: startedArrow.startIO}}
    />;
}
