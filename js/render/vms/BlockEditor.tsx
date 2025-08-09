import {useState} from "react";
import {Block, BlockId, BlockIO, FullVMSData} from "../../common/VMS";
import {addConnection, findBlock, findBlockIndex, removeConnectionAt} from "../../common/VMSOperations";
import {VMSBlockProps} from "./Block";
import {BlockConfig} from "./BlockConfig";
import {ArrowProps} from "./BlockConnections";
import {getPosition} from "./VMSBlockOffsets";
import {StartedArrow} from "./VMSEditor";
import {VMSEditorCanvas} from "./VMSEditorCanvas";

export interface BlockEditorProps {
    blocks: Block[];
    setBlocks: (newBlocks: Block[]) => void;
}

export function BlockEditor({blocks, setBlocks}: BlockEditorProps) {
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
    const blockElements: VMSBlockProps[] = [];
    blocks.forEach((block) => {
        blockElements.push({
            block,
            onClick: () => setSelectedBlockID(block.uid),
            onIOClick: (io) => onIOClick(block.uid, io),
            updateBlock: (update) => updateBlock(block.uid, update),
        });
    });
    const arrows: ArrowProps[] = [];
    const addArrow = (fromBlock: BlockId, outputId: BlockIO, toBlockId: BlockId) => {
        const toBlock = findBlock(blocks, toBlockId);
        arrows.push({
            fromIO: outputId,
            startPosition: getPosition(findBlock(blocks, fromBlock), outputId),
            toBlock: {x: toBlock.visualX, y: toBlock.visualY},
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
    return <>
        <div style={{height: '100%', flexBasis: 'auto', flexGrow: 1, flexShrink: 1}}>
            <VMSEditorCanvas arrows={arrows} blocks={blockElements} onAuxClick={() => setStartedArrow(undefined)}/>
        </div>
        <div style={{width: '20%', height: '100%'}}>{blockConfigElement}</div>
    </>;
}
