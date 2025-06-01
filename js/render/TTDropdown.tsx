import React from "react";
import {Button} from "react-bootstrap";
import DropdownMenu from "react-bootstrap/DropdownMenu";
import {TTComponent} from "./TTComponent";

export interface DropdownProps {
    children: React.JSX.Element[];
    title: string;
}

interface DropdownState {
    shown: boolean;
}

export class TTDropdown extends TTComponent<DropdownProps, DropdownState> {
    constructor(props) {
        super(props);
        this.state = {shown: false};
    }

    render() {
        return <div className={'dropdown' + (this.state.shown ? ' show' : '')}>
            <Button
                onClick={() => this.setState(oldState => ({shown: !oldState.shown}))}
                className={'dropdown-toggle'}
                aria-expanded={this.state.shown}
            >
                {this.props.title}
            </Button>
            <DropdownMenu
                show={this.state.shown}
                onClick={() => this.setState({shown: false})}
            >
                {this.props.children}
            </DropdownMenu>
        </div>;
    }
}
