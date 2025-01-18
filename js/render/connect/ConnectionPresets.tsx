import {Button, ButtonGroup, Form} from "react-bootstrap";
import {CONNECTION_TYPE_DESCS, UD3ConnectionType} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ConnectionPreset} from "../../common/IPCConstantsToRenderer";
import {AdvancedOptions} from "../../common/Options";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {areOptionsValid, MergedConnectionOptions, toSingleOptions} from "./ConnectScreen";
import {MulticonnectPopup} from "./MulticonnectPopup";

export interface PresetsProps {
    mainOptions: MergedConnectionOptions;
    setMainOptions: (opts: Partial<MergedConnectionOptions>) => any;
    mainAdvanced: AdvancedOptions;
    setMainAdvanced: (opts: Partial<AdvancedOptions>) => any;
    connecting: boolean;
    presets: ConnectionPreset[];
}

interface PresetsState {
    newEntryName: string;
    inMulticonnect: boolean;
}

export class ConnectionPresets extends TTComponent<PresetsProps, PresetsState> {
    public static makeTooltip(preset: ConnectionPreset) {
        let description = `Type: ${CONNECTION_TYPE_DESCS.get(preset.options.connectionType)}`;
        switch (preset.options.connectionType) {
            case UD3ConnectionType.serial_min:
            case UD3ConnectionType.serial_plain:
                if (preset.options.options.serialPort) {
                    description += `\nPort: ${preset.options.options.serialPort}`;
                } else {
                    description += `\nVendor ID: ${preset.options.options.autoVendorID}`;
                    description += `\nProduct ID: ${preset.options.options.autoProductID}`;
                }
                description += `\nBaudrate: ${preset.options.options.baudrate}`;
                break;
            case UD3ConnectionType.udp_min:
                description += `\nRemote IP: ${preset.options.options.remoteIP}`;
                description += `\nRemote port: ${preset.options.options.udpMinPort}`;
                break;
        }
        return description;
    }

    constructor(props: PresetsProps) {
        super(props);
        this.state = {
            inMulticonnect: false,
            newEntryName: '',
        };
    }

    public render() {
        const presetList = this.props.presets.length > 0 && (
            <div className={'tt-preset-list'}>
                {this.props.presets.map((preset) => this.makePresetEntry(preset))}
            </div>
        );
        return (
            <div className={'tt-connect-presets'}>
                {this.makeNewEntryField()}
                {presetList}
                <Button
                    onClick={() => this.setState({inMulticonnect: true})}
                    disabled={this.props.presets.length === 0}
                >"Show" mode (Multiconnect)</Button>
                <MulticonnectPopup
                    presets={this.props.presets}
                    visible={this.state.inMulticonnect}
                    close={() => this.setState({inMulticonnect: false})}
                    advanced={this.props.mainAdvanced}
                    setAdvanced={this.props.setMainAdvanced}
                />
            </div>
        );
    }

    private makePresetEntry(preset: ConnectionPreset) {
        const load = () => {
            this.props.setMainOptions({
                currentType: preset.options.connectionType,
                ...preset.options.options,
            });
            this.props.setMainAdvanced(preset.options.advanced);
        };
        const connect = () => {
            load();
            processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.connect, preset.options);
        };
        const deletePreset = () => {
            const newPresets = this.props.presets.filter((cp) => cp !== preset);
            processIPC.send(IPC_CONSTANTS_TO_MAIN.setUIConfig, {connectionPresets: newPresets});
        };
        return <div
            className={'tt-side-aligned tt-connect-preset'}
            title={ConnectionPresets.makeTooltip(preset)}
            key={preset.name}
        >
            <span className={'tt-align-left'}>{preset.name}</span>
            <ButtonGroup>
                <Button disabled={this.props.connecting} onClick={load}>Load</Button>
                <Button disabled={this.props.connecting} onClick={connect}>Connect</Button>
                <Button disabled={this.props.connecting} onClick={deletePreset} variant={'danger'}>Delete</Button>
            </ButtonGroup>
        </div>;
    }

    private makeNewEntryField() {
        const realName = this.state.newEntryName.trim();
        const canAdd = realName.length > 0 &&
            this.props.presets.filter(preset => preset.name === realName).length === 0 &&
            areOptionsValid(this.props.mainOptions);
        return <Form className={'tt-side-aligned'} onSubmit={e => e.preventDefault()}>
            <Form.Control
                style={({width: '50%'})}
                value={this.state.newEntryName}
                disabled={this.props.connecting}
                onChange={(s) => this.setState({newEntryName: s.target.value})}
                className={'tt-align-left'}
            />
            <Button
                disabled={this.props.connecting || !canAdd}
                onClick={() => this.addNewPreset()}
                type={'submit'}
            >Add preset</Button>
        </Form>;
    }

    private addNewPreset() {
        const newPreset: ConnectionPreset = {
            name: this.state.newEntryName.trim(),
            options: {
                ...toSingleOptions(this.props.mainOptions),
                advanced: this.props.mainAdvanced,
            },
        };
        processIPC.send(IPC_CONSTANTS_TO_MAIN.setUIConfig, {connectionPresets: [...this.props.presets, newPreset]});
        this.setState({newEntryName: ''});
    }
}
