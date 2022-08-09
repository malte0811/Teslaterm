import React from "react";
import {Button, DropdownButton, Modal} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {IPC_CONSTANTS_TO_MAIN, IPCToMainKey} from "../../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, IUD3State, UD3ConfigOption} from "../../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../../common/TTConfig";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {UD3Config} from "../UD3Config";

interface CommandsState {
    warningText?: string;
    onOk?: () => any;

    originalSettings?: UD3ConfigOption[];
}

export interface CommandsMenuProps {
    udState: IUD3State;
    ttConfig: TTConfig;
    disabled: boolean;
}

export class CommandsMenuItem extends TTComponent<CommandsMenuProps, CommandsState> {
    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.udConfig,
            (cfg: UD3ConfigOption[]) => this.setState({originalSettings: cfg})
        );
    }

    render(): React.ReactNode {
        const items: JSX.Element[] = [];
        if (this.props.udState.busControllable) {
            if (this.props.udState.busActive) {
                this.makeIPCItem(items, 'Bus off', IPC_CONSTANTS_TO_MAIN.commands.setBusState, false);
            } else {
                this.makeWarningItem(
                    items, 'Bus on', 'The coil will be energized', IPC_CONSTANTS_TO_MAIN.commands.setBusState, true
                );
            }
        }
        if (this.props.udState.transientActive) {
            this.makeIPCItem(items, 'TR stop', IPC_CONSTANTS_TO_MAIN.commands.setTRState, false);
        } else {
            this.makeIPCItem(items, 'TR start', IPC_CONSTANTS_TO_MAIN.commands.setTRState, true);
        }
        this.makeWarningItem(
            items,
            'Save EEPROM',
            'Are you sure to save the configuration to EEPROM?',
            IPC_CONSTANTS_TO_MAIN.commands.saveEEPROM,
            undefined
        );
        this.makeIPCItem(items, 'Settings', IPC_CONSTANTS_TO_MAIN.menu.requestUDConfig, undefined);
        return <>
            <DropdownButton id={'commands'} title={'Commands'}>{items}</DropdownButton>
            {this.makeWarningModal()}
            <Modal show={this.state.originalSettings !== undefined} size={'lg'}>
                <Modal.Body>
                    <UD3Config
                        original={this.state.originalSettings || []}
                        close={() => this.setState({originalSettings: undefined})}
                        ttConfig={this.props.ttConfig}
                    />
                </Modal.Body>
            </Modal>
        </>;
    }

    private makeWarningItem<T>(
        items: JSX.Element[], text: string, warningText: string, channel: IPCToMainKey<T>, arg: T
    ) {
        items.push(<Dropdown.Item
            as={Button}
            onClick={() => {
                this.setState({
                    warningText,
                    onOk: () => processIPC.send(channel, arg)
                });
            }}
            key={items.length}
            disabled={this.props.disabled}
        >
            {text}
        </Dropdown.Item>);
    }

    private makeIPCItem<T>(items: JSX.Element[], text: string, channel: IPCToMainKey<T>, arg: T) {
        items.push(<Dropdown.Item
            as={Button}
            onClick={() => processIPC.send(channel, arg)}
            key={items.length}
            disabled={this.props.disabled}
        >
            {text}
        </Dropdown.Item>);
    }

    private makeWarningModal() {
        const closeModal = () => this.setState({warningText: undefined, onOk: undefined});
        const confirm = () => {
            this.state.onOk();
            closeModal();
        };
        return <Modal show={this.state.warningText !== undefined}>
            <Modal.Header>
                <Modal.Title>WARNING</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {this.state.warningText}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={closeModal}>Abort</Button>
                <Button variant="primary" onClick={confirm} disabled={this.props.disabled}>Confirm</Button>
            </Modal.Footer>
        </Modal>;
    }
}
