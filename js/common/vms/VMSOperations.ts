import {
    Block,
    BlockId,
    BlockIO,
    BlockMap,
    BlockOutput,
    ConstantOrValue,
    FullVMSData,
    KnownValue,
    Modulation,
    ModulationType,
    NoteOffBehavior, Program,
} from "./VMS";

export function findBlockIndex(blocks: Block[], block: BlockId) {
    return blocks.findIndex((b) => b.uid === block);
}

export function findBlock(blocks: Block[], block: BlockId) {
    return blocks[findBlockIndex(blocks, block)];
}

export function removeConnectionAt(from: Block, to: BlockOutput) {
    if (to === 'off') {
        from.offBlock = undefined;
    } else {
        from.outputBlocks = from.outputBlocks.filter((_, i) => i !== to);
    }
}

export function removeConnectionTo(from: Block, to: BlockId) {
    if (from.offBlock === to) {
        from.offBlock = undefined;
    }
    from.outputBlocks = from.outputBlocks.filter((b) => b !== to);
}

export function removeConnectionsTo(blocks: Block[], to: BlockId) {
    blocks.forEach((b) => removeConnectionTo(b, to));
}

export function deleteBlock(blocks: Block[], toRemove: BlockId) {
    removeConnectionsTo(blocks, toRemove);
    blocks[findBlockIndex(blocks, toRemove)] = blocks[blocks.length - 1];
    blocks.pop();
}

export function makeDefaultBlock(id: BlockId): Block {
    return {
        modulation: {type: ModulationType.step},
        offBehavior: NoteOffBehavior.NORMAL,
        outputBlocks: [],
        periodMS: 1,
        target: KnownValue.frequency,
        targetFactor: {type: 'constant', value: 1},
        uid: id,
        visualX: 0,
        visualY: 0,
    };
}

export function makeDefaultMap(startId: BlockId): BlockMap {
    return {
        blocks: [makeDefaultBlock(startId)],
        options: {
            // TODO (Thorben) good defaults
            enableDamper: true,
            enablePitchbend: true,
            enablePortamento: false,
            enableStereo: true,
            enableVolume: true,
            endNote: 127,
            noteFrequency: {type: 'offset', midiNotes: 0},
            startNote: 0,
            volumeScale: 1,
        },
        startBlock: startId,
    };
}

export function makeDefaultProgram(startId: BlockId): Program {
    return {maps: [makeDefaultMap(startId)], name: 'New Program'};
}

export function findFreeId(programs: FullVMSData): BlockId {
    const usedIds = programs.flatMap((p) => p.maps).flatMap((m) => m.blocks).map((b) => b.uid);
    if (usedIds.length === 0) {
        return 0;
    } else {
        return Math.max(...usedIds) + 1;
    }
}

export function addConnection(blocks: Block[], blockA: BlockId, connA: BlockIO, blockB: BlockId, connB: BlockIO) {
    if ((connA === 'in') === (connB === 'in') || blockA === blockB) {
        // Input to input or output to output, both not valid
        return;
    }
    const [fromBlock, fromIO, toBlock] = (() => {
        if (connA === 'in') {
            return [findBlock(blocks, blockB), connB as BlockOutput, findBlock(blocks, blockA)];
        } else {
            return [findBlock(blocks, blockA), connA, findBlock(blocks, blockB)];
        }
    })();
    // TODO what about "complex" decay chains? Shouldn't all children of off-blocks also be off-blocks?
    const correctOffBehavior = fromIO === 'off' ? NoteOffBehavior.INVERTED : NoteOffBehavior.NORMAL;
    if (toBlock.offBehavior !== correctOffBehavior) {
        removeConnectionsTo(blocks, toBlock.uid);
        toBlock.offBehavior = correctOffBehavior;
    }
    if (fromIO === 'off') {
        fromBlock.offBlock = toBlock.uid;
    } else if (!fromBlock.outputBlocks.includes(toBlock.uid)) {
        fromBlock.outputBlocks.push(toBlock.uid);
    }
}

export function makeInitialModulation(type: ModulationType, existing: Modulation): Modulation {
    if (type === existing.type) { return existing; }
    const constant = (v: number): ConstantOrValue => ({type: 'constant', value: v});
    // TODO double check all of these
    switch (type) {
        case ModulationType.step:
            return {type};
        case ModulationType.exp:
            return {type, growthFactor: constant(1.1)};
        case ModulationType.exp_inverse:
            return {type, growthFactor: constant(1.1)};
        case ModulationType.linear:
            return {type, slope: constant(1)};
        case ModulationType.sine:
            return {type, scale: constant(1), offset: constant(0), timeIncrement: constant(1)};
    }
}

function cleanVMSMap(map: BlockMap, firstBlock: BlockId): BlockId {
    let nextBlock = firstBlock;
    const blockMap = new Map<BlockId, BlockId>();
    for (const block of map.blocks) {
        blockMap.set(block.uid, nextBlock);
        ++nextBlock;
    }
    const getNewId = (oldId: BlockId) => {
        if (oldId === undefined) { return undefined; }
        if (!blockMap.has(oldId)) { throw new Error(`Unknown block ID ${oldId}`); }
        return blockMap.get(oldId);
    };
    map.startBlock = getNewId(map.startBlock);
    for (const block of map.blocks) {
        block.outputBlocks = block.outputBlocks.map(getNewId);
        block.offBlock = getNewId(block.offBlock);
    }
    return nextBlock;
}

export function cleanVMSConfig(programs: FullVMSData) {
    const newPrograms = structuredClone(programs);
    // Avoid using block ID 0 for now, it looks like the VMS code sometimes uses this as the invalid block ID, e.g. for
    // the off-block. TODO (Thorben) is this intended?
    let nextBlock = 1;
    for (const program of newPrograms) {
        for (const map of program.maps) {
            nextBlock = cleanVMSMap(map, nextBlock);
        }
    }
    return newPrograms;
}
