import {CSSProperties, useRef, useState} from "react";
import Draggable, {ControlPosition} from 'react-draggable';
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {Block, BlockId, KnownValue, NoteOffBehavior, ThresholdDirection} from "../../common/VMS";
import {BlockComponent} from "./Block";
import {BLOCK_HEIGHT, INPUT_CENTER_X_OFFSET, OFFOUT_CENTER_Y_OFFSET, outputCenterXOffset} from "./VMSBlockOffsets";

type BlockOutput = number | 'off';

interface ArrowProps {
    fromBlock: ControlPosition;
    fromOutput: BlockOutput;
    toBlock: ControlPosition;
}

function Arrow({fromBlock, fromOutput, toBlock}: ArrowProps) {
    const bigM = 100;
    const[fromOffset, fromCtrlX, fromCtrlY] = (() => {
        if (fromOutput === 'off') {
            return [{x: 0, y: OFFOUT_CENTER_Y_OFFSET}, -bigM, 0];
        } else {
            return [{x: outputCenterXOffset(fromOutput), y: BLOCK_HEIGHT}, 0, bigM];
        }
    })();
    const realFrom = {x: fromBlock.x + fromOffset.x, y: fromBlock.y + fromOffset.y};
    const realTo = {x: toBlock.x + INPUT_CENTER_X_OFFSET, y: toBlock.y};
    const pt = (point: ControlPosition, xOff: number = 0, yOff: number = 0) => `${point.x + xOff} ${point.y + yOff}`;
    const pathStart = `M ${pt(realFrom)}`;
    const pathToEnd = `C ${pt(realFrom, fromCtrlX, fromCtrlY)} ${pt(realTo, 0, -bigM)} ${pt(realTo)}`;
    return <path d={`${pathStart} ${pathToEnd}`} stroke={'black'} fill={'transparent'} strokeWidth={4}/>;
}

function Background({arrows}: {arrows: ArrowProps[]}) {
    return <svg width="100%" height="100%">
        {arrows.map(Arrow)}
    </svg>;
}

interface DraggableProps {
    block: Block;
    setDragging: (b: boolean) => void;
    scale: number;
    setPosition: (p: ControlPosition) => void;
    position: ControlPosition;
}

function DragStuff(props: DraggableProps) {
    const nodeRef = useRef(null);
    const style: CSSProperties = {
        height: 'min-content',
        left: '0',
        position: 'absolute',
        top: '0',
        width: 'min-content',
    };
    return <Draggable
        defaultPosition={{x: 0, y: 0}}
        position={props.position}
        scale={props.scale}
        onDrag={(_, data) => {
            props.setDragging(true);
            props.setPosition({x: data.x, y: data.y});
        }}
        onStop={(_, data) => {
            props.setDragging(false);
            props.setPosition({x: data.x, y: data.y});
        }}
        nodeRef={nodeRef}
    >
        <div ref={nodeRef} style={style}><BlockComponent block={props.block}/></div>
    </Draggable>;
}

function makeExampleBlock(ownId: BlockId, outputs?: BlockId[], off?: BlockId): Block {
    return {
        uid: ownId,
        outputBlocks: outputs,
        offBlock: off,
        offBehavior: NoteOffBehavior.NORMAL,
        modulation: {type: 'step'},
        target: KnownValue.circ1,
        thresholdDirection: ThresholdDirection.ANY,
        targetFactor: {type: 'constant', value: 0},
        periodMS: 1,
    };
}

export function VMSTest() {
    const blocks: Block[] = [
        makeExampleBlock(0, [17, undefined, 2], 4),
        makeExampleBlock(2, [0, undefined, 4], undefined),
        makeExampleBlock(17, [], 4),
        makeExampleBlock(4, [], undefined),
    ];

    const [draggingElement, setDraggingElement] = useState(false);
    const [scale, setScale] = useState(1);
    const [positions, setPositions] = useState<ControlPosition[]>(() => {
        const initPositions: ControlPosition[] = [];
        for (const block of blocks) {
            initPositions[block.uid] = {x: 0, y: block.uid};
        }
        return initPositions;
    });
    const blockElements: React.JSX.Element[] = [];
    for (const block of blocks) {
        blockElements.push(<DragStuff
            block={block}
            setDragging={setDraggingElement}
            scale={scale}
            position={positions[block.uid]}
            setPosition={(newPos) => {
                const newPositions = [...positions];
                newPositions[block.uid] = newPos;
                setPositions(newPositions);
            }}
        />);
    }
    const arrows: ArrowProps[] = [];
    const addArrow = (fromBlock: BlockId, outputId: BlockOutput, toBlock: BlockId) => {
        if (toBlock !== undefined) {
            arrows.push({fromBlock: positions[fromBlock], fromOutput: outputId, toBlock: positions[toBlock]});
        }
    };
    console.log(arrows);
    for (const block of blocks) {
        for (let i = 0; i < 4; ++i) {
            addArrow(block.uid, i, block.outputBlocks[i]);
        }
        addArrow(block.uid, 'off', block.offBlock);
    }
    return <TransformWrapper
        disabled={draggingElement}
        limitToBounds={false}
        onTransformed={(_, data) => setScale(data.scale)}
    >
        <TransformComponent wrapperStyle={{position: 'relative', height: '100%', width: '100%'}}>
            <div style={{position: 'absolute', zIndex: 0, height: '100vh', width: '100vw'}}>
                <Background arrows={arrows}/>
            </div>
            <div style={{position: 'relative', zIndex: 1, height: '100vh', width: '100vw'}}>
                {...blockElements}
            </div>
        </TransformComponent>
    </TransformWrapper>;
}
