import React from "react";
import {Button, Modal} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {IPC_CONSTANTS_TO_MAIN, IPCToMainKey} from "../../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, IUD3State, UD3Alarm, UD3ConfigOption} from "../../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../../common/TTConfig";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {TTDropdown} from "../../TTDropdown";
import {Alarms} from "../Alarms";
import {UD3Config} from "../UD3Config";

interface CommandsState {
    warningText?: string;
    onOk?: () => any;

    originalSettings?: UD3ConfigOption[];

    alarmList?: UD3Alarm[];
}

export interface CommandsMenuProps {
    udState: IUD3State;
    ttConfig: TTConfig;
    disabled: boolean;
    darkMode: boolean;
}

export class CommandsMenuItem extends TTComponent<CommandsMenuProps, CommandsState> {
    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.udConfig, cfg => this.setState({originalSettings: cfg}));
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.alarmList, alarmList => this.setState({alarmList}));
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
        this.makeIPCItem(items, 'Show alarms', IPC_CONSTANTS_TO_MAIN.menu.requestAlarmList, undefined);
        return <>
            <TTDropdown title={'Commands'} darkMode={this.props.darkMode}>{items}</TTDropdown>
            {this.makeWarningModal()}
            {this.makeConfigModal()}
            {this.makeAlarmListModal()}
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
        return <Modal
            show={this.state.warningText !== undefined}
            className={this.props.darkMode && 'tt-dark-modal-root'}
        >
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

    private makeConfigModal() {
        return <Modal
            show={this.state.originalSettings !== undefined}
            size={'lg'}
            className={this.props.darkMode && 'tt-dark-modal-root'}
        >
            <Modal.Body>
                <UD3Config
                    original={this.state.originalSettings || []}
                    close={() => this.setState({originalSettings: undefined})}
                    ttConfig={this.props.ttConfig}
                    darkMode={this.props.darkMode}
                />
            </Modal.Body>
        </Modal>;
    }

    private makeAlarmListModal() {
        const close = () => this.setState({alarmList: undefined});
        return <Modal
            show={this.state.alarmList !== undefined}
            size={'lg'}
            onBackdropClick={close}
            className={this.props.darkMode && 'tt-dark-modal-root'}
        >
            <Modal.Body>
                <Alarms alarms={this.state.alarmList || []} close={close} darkMode={this.props.darkMode}/>
            </Modal.Body>
        </Modal>;
    }
}
