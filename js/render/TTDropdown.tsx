import React, {CSSProperties, useState} from "react";
import {Button} from "react-bootstrap";
import DropdownMenu from "react-bootstrap/DropdownMenu";

export interface DropdownProps {
    children: React.JSX.Element[];
    title: string;
    style?: CSSProperties;
}

export function TTDropdown(props: DropdownProps) {
    const [shown, setShown] = useState(false);
    return <div className={'dropdown' + (shown ? ' show' : '')}>
        <Button
            onClick={() => setShown(!shown)}
            className={'dropdown-toggle'}
            aria-expanded={shown}
            style={props.style}
        >
            {props.title}
        </Button>
        <DropdownMenu
            show={shown}
            onClick={() => setShown(false)}
        >
            {props.children}
        </DropdownMenu>
    </div>;
}
