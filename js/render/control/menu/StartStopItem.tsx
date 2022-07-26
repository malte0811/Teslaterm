import React from "react";
import {Button, DropdownButton} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";

export interface StartStopProps {
    dataKey: string;
    startKey: string;
    stopKey: string;
    disabled: boolean;
}

export interface StartStopState {
    current: string;
}

export class StartStopMenuItem extends TTComponent<StartStopProps, StartStopState> {
    constructor(props) {
        super(props);
        this.state = {current: ''};
    }

    componentDidMount() {
        this.addIPCListener(this.props.dataKey, (s: string) => this.setState({current: s}));
    }

    render(): React.ReactNode {
        return <DropdownButton id={'commands'} title={this.state.current}>
            <Dropdown.Item
                as={Button}
                onClick={() => processIPC.send(this.props.startKey)}
                disabled={this.props.disabled}
            >Start</Dropdown.Item>
            <Dropdown.Item
                as={Button}
                onClick={() => processIPC.send(this.props.stopKey)}
                disabled={this.props.disabled}
            >Stop</Dropdown.Item>
        </DropdownButton>;
    }
}
