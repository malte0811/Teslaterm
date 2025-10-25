import {KeyboardEvent, useState} from "react";
import {ControlPosition} from "react-draggable";
import {Block, BlockId, BlockIO} from "../../common/vms/VMS";
import {
    addConnection, deleteBlock,
    findBlock,
    findBlockIndex, makeDefaultBlock,
    removeConnectionAt,
} from "../../common/vms/VMSOperations";
import {VMSBlockProps} from "./Block";
import {ArrowProps} from "./BlockConnections";
import {BlockEditorCanvas} from "./BlockEditorCanvas";
import {getPosition} from "./VMSBlockOffsets";
import {StartedArrow} from "./VMSEditor";

export interface BlockEditorProps {
    blocks: Block[];
    setBlocks: (newBlocks: Block[]) => void;
    selectedBlock?: BlockId;
    startBlock: BlockId;
    selectBlock: (selectedId: BlockId) => void;
    nextFreeId: BlockId;
}

export function BlockEditor(props: BlockEditorProps) {
    const [startedArrow, setStartedArrow] = useState<StartedArrow>();
    const onIOClick = (blockId: BlockId, clickedIO: BlockIO) => {
        const newBlocks = structuredClone(props.blocks);
        if (startedArrow === undefined) {
            const clickedBlock = findBlock(newBlocks, blockId);
            if (clickedIO !== 'in') {
                removeConnectionAt(clickedBlock, clickedIO);
            }
            setStartedArrow({fromBlock: blockId, fromIO: clickedIO});
        } else {
            addConnection(newBlocks, startedArrow.fromBlock, startedArrow.fromIO, blockId, clickedIO);
            setStartedArrow(undefined);
            console.log(newBlocks);
        }
        props.setBlocks(newBlocks);
    };
    const onKeyPress = (ev: KeyboardEvent) => {
        if (ev.key === 'Delete' && props.selectedBlock !== undefined) {
            if (props.startBlock === props.selectedBlock) {
                // TODO toast or something
            } else {
                const newBlocks = structuredClone(props.blocks);
                deleteBlock(newBlocks, props.selectedBlock);
                props.setBlocks(newBlocks);
                props.selectBlock(undefined);
            }
        } else if (ev.key === 'Escape') {
            props.selectBlock(undefined);
        }
    };
    const addBlockAt = (position: ControlPosition) => {
        const addedBlock = makeDefaultBlock(props.nextFreeId);
        addedBlock.visualX = position.x;
        addedBlock.visualY = position.y;
        props.setBlocks([...props.blocks, addedBlock]);
    };

    const updateBlock = (blockId: number, update: Partial<Block>) => {
        const updated = [...props.blocks];
        const index = findBlockIndex(updated, blockId);
        updated[index] = {...updated[index], ...update};
        props.setBlocks(updated);
    };
    const blockElements: VMSBlockProps[] = [];
    props.blocks.forEach((block) => {
        blockElements.push({
            block,
            onClick: () => props.selectBlock(block.uid),
            onIOClick: (io) => onIOClick(block.uid, io),
            selected: block.uid === props.selectedBlock,
            updateBlock: (update) => updateBlock(block.uid, update),
        });
    });
    const arrows: ArrowProps[] = [];
    const addArrow = (fromBlock: BlockId, outputId: BlockIO, toBlockId: BlockId) => {
        const toBlock = findBlock(props.blocks, toBlockId);
        arrows.push({
            fromIO: outputId,
            startPosition: getPosition(findBlock(props.blocks, fromBlock), outputId),
            toBlock: toBlock && {x: toBlock.visualX, y: toBlock.visualY},
        });
    };
    for (const block of props.blocks) {
        block.outputBlocks.forEach((next, i) => addArrow(block.uid, i, next));
        if (block.offBlock !== undefined) {
            addArrow(block.uid, 'off', block.offBlock);
        }
    }
    if (startedArrow) {
        addArrow(startedArrow.fromBlock, startedArrow.fromIO, undefined);
    }
    const startBlock = findBlock(props.blocks, props.startBlock);
    return <BlockEditorCanvas
        arrows={arrows}
        blocks={blockElements}
        onAuxClick={() => setStartedArrow(undefined)}
        startPos={startBlock && getPosition(startBlock, 'in')}
        onKeyPress={onKeyPress}
        addBlock={addBlockAt}
    />;
}
