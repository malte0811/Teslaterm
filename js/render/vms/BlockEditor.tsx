import {useState} from "react";
import {Block, BlockId, BlockIO} from "../../common/VMS";
import {addConnection, findBlock, findBlockIndex, removeConnectionAt} from "../../common/VMSOperations";
import {VMSBlockProps} from "./Block";
import {ArrowProps} from "./BlockConnections";
import {getPosition} from "./VMSBlockOffsets";
import {StartedArrow} from "./VMSEditor";
import {VMSEditorCanvas} from "./VMSEditorCanvas";

export interface BlockEditorProps {
    blocks: Block[];
    setBlocks: (newBlocks: Block[]) => void;
    // TODO some sort of unselect mechanism
    selectedBlock?: BlockId;
    startBlock: BlockId;
    selectBlock: (selectedId: BlockId) => void;
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
            setStartedArrow({startBlock: blockId, startIO: clickedIO});
        } else {
            addConnection(newBlocks, startedArrow.startBlock, startedArrow.startIO, blockId, clickedIO);
            setStartedArrow(undefined);
            console.log(newBlocks);
        }
        props.setBlocks(newBlocks);
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
        addArrow(startedArrow.startBlock, startedArrow.startIO, undefined);
    }
    return <VMSEditorCanvas arrows={arrows} blocks={blockElements} onAuxClick={() => setStartedArrow(undefined)}/>;
}
