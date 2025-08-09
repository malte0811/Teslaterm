import React from "react";
import {
    Block,
    BlockId,
    BlockIO,
    BlockOutput, ConstantOrValue, Modulation,
    modulationToString,
    ModulationType,
    NoteOffBehavior
} from "../../common/VMS";

// TODO may want a general sanitization function! Also for cleaning up IDs over the whole program set

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
        case "step":
            return {type};
        case "exp":
            return {type, growthFactor: constant(1.1)};
        case "exp-reverse":
            return {type, growthFactor: constant(1.1)};
        case "linear":
            return {type, slope: constant(1)};
        case "sine":
            return {type, scale: constant(1), offset: constant(0), timeIncrement: constant(1)};
    }
}
