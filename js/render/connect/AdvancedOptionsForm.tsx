import {Button, Col, Form, Row} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {AdvancedOptions, CommandConnectionConfig, CommandRole, MidiConfig, NetSidConfig} from "../../common/Options";
import {TTComponent} from "../TTComponent";
import {TTDropdown} from "../TTDropdown";
import {FormHelper} from "./FormHelper";

export interface AdvancedFormProps {
    currentOptions: AdvancedOptions;
    setOptions: (newOptions: Partial<AdvancedOptions>) => any;
    darkMode: boolean;
    connecting: boolean;
}

export class AdvancedOptionsForm extends TTComponent<AdvancedFormProps, {}> {
    private readonly helper: FormHelper;

    constructor(props) {
        super(props);
        this.helper = new FormHelper(this, 8);
    }

    public render() {
        return (
            <>
                <Form.Group key={'netsid'}>
                    <Form.Label key={'title'} style={({fontSize: 'large'})}>NetSID settings</Form.Label>
                    {this.buildNetSIDConfig()}
                </Form.Group>
                <Form.Group key={'rtpmidi'}>
                    <Form.Label key={'title'} style={({fontSize: 'large'})}>RTP-MIDI settings</Form.Label>
                    {this.buildRTPMIDIConfig()}
                </Form.Group>
                <Form.Group key={'command'}>
                    <Form.Label key={'title'} style={({fontSize: 'large'})}>Command server settings</Form.Label>
                    {this.buildCommandConfig()}
                </Form.Group>
            </>
        );
    }

    private buildNetSIDConfig(): JSX.Element[] {
        const current = this.props.currentOptions.netSidOptions;
        const setOption = (toSet: Partial<NetSidConfig>) => {
            this.props.setOptions({netSidOptions: {...current, ...toSet}});
        };
        const rows: JSX.Element[] = [
            this.helper.makeCheckbox("Enable NetSID", current.enabled, enabled => setOption({enabled})),
        ];
        if (current.enabled) {
            rows.push(this.helper.makeIntField('NetSID port', current.port, port => setOption({port})));
        }
        return rows;
    }

    private buildRTPMIDIConfig(): JSX.Element[] {
        const current = this.props.currentOptions.midiOptions;
        const setOption = (toSet: Partial<MidiConfig>) => {
            this.props.setOptions({midiOptions: {...current, ...toSet}});
        };
        const rows: JSX.Element[] = [this.helper.makeCheckbox(
            "Run RTP-MIDI server", current.runMidiServer, runMidiServer => setOption({runMidiServer}),
        )];
        if (current.runMidiServer) {
            rows.push(this.helper.makeIntField('RTP-MIDI port', current.port, port => setOption({port})));
            rows.push(this.helper.makeString('Local name', current.localName, localName => setOption({localName})));
            rows.push(this.helper.makeString(
                'Bonjour name', current.bonjourName, bonjourName => setOption({bonjourName}),
            ));
        }
        return rows;
    }

    private buildCommandConfig(): JSX.Element[] {
        const current = this.props.currentOptions.commandOptions;
        const setOption = (toSet: Partial<CommandConnectionConfig>) => {
            this.props.setOptions({commandOptions: {...current, ...toSet}});
        };
        const rows: JSX.Element[] = [this.makeSelect<CommandRole>(
            "Role", ['disable', 'client', 'server'], current.state, state => setOption({state}),
        )];
        if (current.state !== 'disable') {
            rows.push(this.helper.makeIntField("Command port", current.port, port => setOption({port})));
        }
        if (current.state === 'client') {
            rows.push(this.helper.makeString(
                'Remote address', current.remoteName, remoteName => setOption({remoteName}),
            ));
        }
        return rows;
    }

    private makeSelect<T extends string>(label: string, values: T[], current: T, set: (val: T) => any) {
        const options = [];
        for (const value of values) {
            options.push(<Dropdown.Item
                key={value}
                as={Button}
                onClick={() => set(value)}
                disabled={this.props.connecting}
            >
                {value}
            </Dropdown.Item>);
        }
        return (
            <Form.Group as={Row} key={label}>
                <Form.Label column>{label}</Form.Label>
                <Col sm={8}>
                    <TTDropdown
                        title={current}
                        darkMode={this.props.darkMode}
                    >
                        {options}
                    </TTDropdown>
                </Col>
            </Form.Group>
        );
    }
}
