import React from "react";
import {Button} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {IPCToMainKey} from "../../../common/IPCConstantsToMain";
import {IPCToRendererKey} from "../../../common/IPCConstantsToRenderer";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {TTDropdown} from "../../TTDropdown";

export interface StartStopProps {
    dataKey: IPCToRendererKey<string>;
    startKey: IPCToMainKey<undefined>;
    stopKey: IPCToMainKey<undefined>;
    disabled: boolean;
    darkMode: boolean;
}

export interface StartStopState {
    current: string;
}

export class StartStopMenuItem extends TTComponent<StartStopProps, StartStopState> {
    constructor(props) {
        super(props);
        this.state = {current: ''};
    }

    public componentDidMount() {
        this.addIPCListener(this.props.dataKey, (s: string) => this.setState({current: s}));
    }

    public render(): React.ReactNode {
        return <TTDropdown title={this.state.current} darkMode={this.props.darkMode}>
            <Dropdown.Item
                as={Button}
                onClick={() => processIPC.send(this.props.startKey, undefined)}
                disabled={this.props.disabled}
            >Start</Dropdown.Item>
            <Dropdown.Item
                as={Button}
                onClick={() => processIPC.send(this.props.stopKey, undefined)}
                disabled={this.props.disabled}
            >Stop</Dropdown.Item>
        </TTDropdown>;
    }
}
