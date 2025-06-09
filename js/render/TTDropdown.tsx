import React, {CSSProperties, useState} from "react";
import {Button} from "react-bootstrap";
import DropdownMenu from "react-bootstrap/DropdownMenu";

export interface DropdownProps {
    children: React.JSX.Element[];
    title: string;
    style?: CSSProperties;
}

interface DropdownState {
    shown: boolean;
}

export function TTDropdown(props: DropdownProps) {
    const [state, setState] = useState<DropdownState>({shown: false});
    return <div className={'dropdown' + (state.shown ? ' show' : '')}>
        <Button
            onClick={() => setState(oldState => ({shown: !oldState.shown}))}
            className={'dropdown-toggle'}
            aria-expanded={state.shown}
            style={props.style}
        >
            {props.title}
        </Button>
        <DropdownMenu
            show={state.shown}
            onClick={() => setState({shown: false})}
        >
            {props.children}
        </DropdownMenu>
    </div>;
}
