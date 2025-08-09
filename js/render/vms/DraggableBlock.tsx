import {CSSProperties, useRef} from "react";
import Draggable from "react-draggable";
import {Block} from "../../common/VMS";
import {BlockComponent, VMSBlockProps} from "./Block";

interface DraggableBlockProps extends VMSBlockProps {
    setDragging: (b: boolean) => void;
    scale: number;
}

// TODO move into VMSEditorCanvas with children?
export function DraggableBlock(props: DraggableBlockProps) {
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
        position={{x: props.block.visualX, y: props.block.visualY}}
        scale={props.scale}
        onDrag={(_, data) => {
            props.setDragging(true);
            props.updateBlock({visualX: data.x, visualY: data.y});
        }}
        onStop={(_, data) => {
            props.setDragging(false);
            props.updateBlock({visualX: data.x, visualY: data.y});
        }}
        nodeRef={nodeRef}
        // TODO bounds!
    >
        <div ref={nodeRef} style={style}><BlockComponent {...props}/></div>
    </Draggable>;
}

