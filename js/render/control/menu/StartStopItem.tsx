import React, {CSSProperties, useState} from "react";
import {Button} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {IPCToMainKey} from "../../../common/IPCConstantsToMain";
import {IPCToRendererKey} from "../../../common/IPCConstantsToRenderer";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent, useIPCListener} from "../../TTComponent";
import {TTDropdown} from "../../TTDropdown";

export interface StartStopProps {
    dataKey: IPCToRendererKey<string>;
    startKey: IPCToMainKey<undefined>;
    stopKey: IPCToMainKey<undefined>;
    style?: CSSProperties;
    disabled: boolean;
}

export function StartStopMenuItem(props: StartStopProps) {
    const [current, setCurrent] = useState('');
    useIPCListener(props.dataKey, setCurrent);
    return <TTDropdown title={current} style={props.style}>
        <Dropdown.Item
            as={Button}
            onClick={() => processIPC.send(props.startKey, undefined)}
            disabled={props.disabled}
        >Start</Dropdown.Item>
        <Dropdown.Item
            as={Button}
            onClick={() => processIPC.send(props.stopKey, undefined)}
            disabled={props.disabled}
        >Stop</Dropdown.Item>
    </TTDropdown>;
}
