import React, {CSSProperties} from "react";
import {Button, Col, Form, Row, Tab, Tabs} from "react-bootstrap";
import {CoilID} from "../../common/constants";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {UD3ConfigOption, UD3ConfigType} from '../../common/IPCConstantsToRenderer';
import {TTConfig} from "../../common/TTConfig";
import {commands} from "../ipc/commands";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";

export interface UD3ConfigProps {
    original: UD3ConfigOption[];
    close: () => any;
    ttConfig: TTConfig;
    darkMode: boolean;
    coil: CoilID;
}

interface UD3ConfigState {
    current: UD3ConfigOption[];
}

interface IndexedOption {
    option: UD3ConfigOption;
    index: number;
}

const TAB_NAMES = [
    'General', 'Timing', 'Feedback', 'IP', 'Serial', 'Current', 'NTC', 'Synthesizer',
];

export class UD3Config extends TTComponent<UD3ConfigProps, UD3ConfigState> {
    constructor(props) {
        super(props);
        this.state = {current: this.props.original};
    }

    render() {
        return (
            <div>
                {this.makeTabs()}
                <div>
                    <Button onClick={() => this.sendAndClose()}>Send to UD3</Button>
                    <Button onClick={() => {
                        this.sendAndClose();
                        commands(this.props.coil).saveEEPROM();
                    }}>Send & save to EEPROM</Button>
                    <Button onClick={this.props.close}>Discard</Button>
                </div>
                <div>
                    <Button onClick={() => this.saveJSON()}>Save as JSON</Button>
                    <Button onClick={() => this.loadJSON()}>Load from JSON</Button>
                </div>
            </div>
        );
    }

    private makeTabs(): JSX.Element {
        const optionsByTab: IndexedOption[][] = [];
        this.state.current.map((opt, index) => {
            const tab = this.props.ttConfig.udConfigPages.get(opt.name) || 0;
            if (!optionsByTab[tab]) {
                optionsByTab[tab] = [];
            }
            optionsByTab[tab].push({index, option: opt});
        });
        return (
            <Tabs defaultActiveKey={0}>
                {optionsByTab.map((opts, i) => this.makeOptionsTab(i, opts))}
            </Tabs>
        );
    }

    private makeOptionsTab(tabIndex: number, options: IndexedOption[]): JSX.Element {
        const title = TAB_NAMES[tabIndex] || 'Unknown';
        return (
            <Tab title={title} key={tabIndex} eventKey={tabIndex} tabClassName={this.props.darkMode && 'tt-dark-tabs'}>
                <Form className={'tt-modal-scrollable'}>
                    {options.map((o) => this.makeOption(o))}
                </Form>
            </Tab>
        );
    }

    private makeOption(option: IndexedOption): JSX.Element {
        return (
            <Form.Group as={Row} key={option.index}>
                <Form.Label column={'sm'}>{option.option.name}</Form.Label>
                <Col>
                    <Form.Control
                        type={UD3Config.getTypeFor(option.option.type)}
                        onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
                            const newValues = [...this.state.current];
                            newValues[option.index] = {...newValues[option.index]};
                            newValues[option.index].current = ev.target.value;
                            this.setState({current: newValues});
                        }}
                        value={option.option.current}
                        className={this.props.darkMode ? 'tt-dark-form-input' : 'tt-light-form-input'}
                    />
                    {option.option.type !== UD3ConfigType.TYPE_STRING && this.makeMinMaxDesc(option.option)}<br/>
                    <Form.Text
                        className={this.getMutedClass()}
                    >{option.option.help}</Form.Text>
                </Col>
            </Form.Group>
        );
    }

    private static getTypeFor(type: UD3ConfigType): string {
        // TODO improve input validation
        switch (type) {
            case UD3ConfigType.TYPE_UNSIGNED:
            case UD3ConfigType.TYPE_SIGNED:
            case UD3ConfigType.TYPE_FLOAT:
                return 'number';
            case UD3ConfigType.TYPE_STRING:
                return 'text';
        }
    }

    private makeMinMaxDesc(option: UD3ConfigOption) {
        return <Form.Text className={this.getMutedClass()}>
            Min: {option.min} Max: {option.max}
        </Form.Text>;
    }

    private sendAndClose() {
        const changed = this.state.current.filter(
            (val, i) => val.current !== this.props.original[i].current
        );
        const changeMap = new Map<string, string>();
        for (const option of changed) {
            changeMap.set(option.name, option.current);
        }
        processIPC.send(getToMainIPCPerCoil(this.props.coil).commands.setParms, changeMap);
        this.props.close();
    }

    private getMutedClass() {
        return this.props.darkMode ? 'tt-dark-text-muted' : 'text-muted';
    }

    private saveJSON() {
        const saveJSON = {};
        for (const option of this.state.current) {
            saveJSON[option.name] = option.current;
        }
        const dummyElement = document.createElement('a');
        document.body.appendChild(dummyElement);
        dummyElement.download = 'ud3-config.json';
        dummyElement.href = "data:application/json," + encodeURIComponent(JSON.stringify(saveJSON, null, 4));
        dummyElement.click();
        document.body.removeChild(dummyElement);
    }

    private loadJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = () => {
            const reader = new FileReader();
            reader.readAsText(input.files[0]);
            reader.onload = readerEvent => {
                const content = readerEvent.target.result as string;
                try {
                    const jsonData = JSON.parse(content);
                    const newOptions = [...this.state.current];
                    for (let i = 0; i < newOptions.length; ++i) {
                        const newValue = jsonData[newOptions[i].name];
                        if (newValue !== undefined) {
                            newOptions[i] = {...newOptions[i], current: newValue};
                        }
                    }
                    this.setState({current: newOptions});
                } catch (e) {
                    console.log("Failed to load data: ", e);
                }
                document.removeChild(input);
            };
        };
        input.click();
    }
}
