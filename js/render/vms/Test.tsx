import {useState} from "react";
import {Block, BlockId, KnownValue, NoteOffBehavior, ThresholdDirection} from "../../common/VMS";
import {VMSEditor} from "./VMSEditor";

function makeExampleBlock(ownId: BlockId, outputs?: BlockId[], off?: BlockId): Block {
    return {
        modulation: {type: 'step'},
        offBehavior: NoteOffBehavior.NORMAL,
        offBlock: off,
        outputBlocks: outputs,
        periodMS: 1,
        target: KnownValue.circ1,
        targetFactor: {type: 'constant', value: 0},
        thresholdDirection: ThresholdDirection.ANY,
        uid: ownId,
    };
}

export function VMSTest() {
    const [blocks, setBlocks] = useState(() => [
        makeExampleBlock(0, [], undefined),
        makeExampleBlock(2, [], undefined),
        makeExampleBlock(17, [], undefined),
        makeExampleBlock(4, [], undefined),
    ]);
    return <VMSEditor blocks={blocks} setBlocks={setBlocks}/>;
}
