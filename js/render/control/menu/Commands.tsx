import React from "react";
import {Button, Modal} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN, IPCToMainKey} from "../../../common/IPCConstantsToMain";
import {
    getToRenderIPCPerCoil,
    IUD3State,
    UD3Alarm,
    UD3ConfigOption,
} from "../../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../../common/TTConfig";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {TTDropdown} from "../../TTDropdown";
import {Alarms} from "../Alarms";
import {TabControlLevel} from "../SingleCoilTab";
import {UD3Config} from "../UD3Config";

interface CommandsState {
    warningText?: string;
    onOk?: () => any;

    originalSettings?: UD3ConfigOption[];

    alarmList?: UD3Alarm[];
}

export interface CommandsMenuProps {
    level: TabControlLevel;
    udState?: IUD3State;
    ttConfig: TTConfig;
    disabled: boolean;
    darkMode: boolean;
}

export class CommandsMenuItem extends TTComponent<CommandsMenuProps, CommandsState> {
    constructor(props: CommandsMenuProps) {
        super(props);
        this.state = {};
    }

    public componentDidMount() {
        if (this.props.level.level !== 'central-control') {
            const channels = getToRenderIPCPerCoil(this.props.level.coil);
            this.addIPCListener(channels.udConfig, cfg => this.setState({originalSettings: cfg}));
            this.addIPCListener(channels.alarmList, alarmList => this.setState({alarmList}));
        }
    }

    public render(): React.ReactNode {
        const items: React.JSX.Element[] = [];
        const coilIPC = this.props.level.level !== 'central-control' ?
            getToMainIPCPerCoil(this.props.level.coil) :
            undefined;
        const combined = coilIPC ? coilIPC : IPC_CONSTANTS_TO_MAIN;
        if (!this.props.udState || this.props.udState.busControllable) {
            if (!this.props.udState || this.props.udState.busActive) {
                this.makeIPCItem(items, 'Bus off', combined.commands.setBusState, false);
            }
            if (!this.props.udState || !this.props.udState.busActive) {
                this.makeWarningItem(
                    items, 'Bus on', 'The coil will be energized', combined.commands.setBusState, true,
                );
            }
        }
        if (!this.props.udState || this.props.udState.transientActive) {
            this.makeIPCItem(items, 'TR stop', combined.commands.setTRState, false);
        }
        if (!this.props.udState || !this.props.udState.transientActive) {
            this.makeIPCItem(items, 'TR start', combined.commands.setTRState, true);
        }
        if (this.props.level.level !== 'central-control') {
            this.makeWarningItem(
                items,
                'Save EEPROM',
                'Are you sure to save the configuration to EEPROM?',
                coilIPC.commands.saveEEPROM,
                undefined,
            );
            this.makeIPCItem(items, 'Settings', coilIPC.menu.requestUDConfig, undefined);
            this.makeIPCItem(items, 'Show alarms', coilIPC.menu.requestAlarmList, undefined, true);
            this.makeIPCItem(
                items,
                'Export Flight Recording',
                coilIPC.dumpFlightRecorder,
                this.props.level.coil,
                true,
            );
        }
        return <>
            <TTDropdown title={'Commands'} darkMode={this.props.darkMode}>{items}</TTDropdown>
            {this.makeWarningModal()}
            {this.makeConfigModal()}
            {this.makeAlarmListModal()}
        </>;
    }

    private makeWarningItem<T>(
        items: JSX.Element[], text: string, warningText: string, channel: IPCToMainKey<T>, arg: T,
    ) {
        items.push(<Dropdown.Item
            as={Button}
            onClick={() => {
                this.setState({
                    onOk: () => processIPC.send(channel, arg),
                    warningText,
                });
            }}
            key={items.length}
            disabled={this.props.disabled}
        >
            {text}
        </Dropdown.Item>);
    }

    private makeIPCItem<T>(
        items: React.JSX.Element[], text: string, channel: IPCToMainKey<T>, arg: T, alwaysEnable: boolean = false,
    ) {
        items.push(<Dropdown.Item
            as={Button}
            onClick={() => processIPC.send(channel, arg)}
            key={items.length}
            disabled={this.props.disabled && !alwaysEnable}
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
            onHide={closeModal}
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
        if (this.props.level.level === 'central-control') {
            return <></>;
        }
        const closeModal = () => this.setState({originalSettings: undefined});
        return <Modal
            show={this.state.originalSettings !== undefined}
            size={'lg'}
            className={this.props.darkMode && 'tt-dark-modal-root'}
            onHide={closeModal}
        >
            <Modal.Body>
                <UD3Config
                    original={this.state.originalSettings || []}
                    close={closeModal}
                    ttConfig={this.props.ttConfig}
                    darkMode={this.props.darkMode}
                    coil={this.props.level.coil}
                />
            </Modal.Body>
        </Modal>;
    }

    private makeAlarmListModal() {
        const close = () => this.setState({alarmList: undefined});
        return <Modal
            show={this.state.alarmList !== undefined}
            size={'lg'}
            onHide={close}
            className={this.props.darkMode && 'tt-dark-modal-root'}
        >
            <Modal.Body>
                <Alarms alarms={this.state.alarmList || []} close={close} darkMode={this.props.darkMode}/>
            </Modal.Body>
        </Modal>;
    }
}
