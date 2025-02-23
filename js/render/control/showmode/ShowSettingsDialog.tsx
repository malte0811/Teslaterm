import {Button, Form, FormCheck, Modal, OverlayTrigger, Tooltip} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {PrecountSettings, ShowModeOptions} from "../../../common/UIConfig";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {SimpleSlider} from "../sliders/SimpleSlider";

export interface ShowSettingsProps {
    visible: boolean;
    close: () => any;
    darkMode: boolean;
    globalShowSettings: ShowModeOptions;
}

interface ShowSettingsState {
    currentSettings?: ShowModeOptions;
}

export class ShowSettingsDialog extends TTComponent<ShowSettingsProps, ShowSettingsState> {
    constructor(props: ShowSettingsProps) {
        super(props);
        this.state = {currentSettings: undefined};
    }

    public render() {
        return <Modal
            show={this.props.visible}
            className={this.props.darkMode && 'tt-dark-modal-root'}
            onHide={() => this.close()}
        >
            <Modal.Title>Show-Mode options</Modal.Title>
            <Modal.Body>{this.buildForm()}</Modal.Body>
            <Modal.Footer>
                <Button variant={'primary'} onClick={() => this.saveAndClose()}>Save</Button>
                <Button variant={'secondary'} onClick={() => this.close()}>Cancel</Button>
            </Modal.Footer>
        </Modal>;
    }

    private saveAndClose() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.setUIConfig, {showmodeOptions: this.getSettings()});
        this.close();
    }

    private close() {
        this.setState({currentSettings: undefined});
        this.props.close();
    }

    private buildForm() {
        const settings = this.getSettings();
        const precountTooltip = (<Tooltip>
            Before starting a song, fire a few individual pulses to synchronize with e.g. a performer in a Faraday suit.
        </Tooltip>);
        const startSilenceTooltip = (<Tooltip>
            Some MIDI files start with a few seconds of silence. This can be skipped to improve synchronization.
        </Tooltip>);
        // TODO tooltip for MIDI mixer save
        return <>
            <OverlayTrigger overlay={startSilenceTooltip} placement={'bottom'}>
                <Form.Check
                    checked={settings.skipInitialSilence}
                    onChange={(ev) => this.setSettings({skipInitialSilence: ev.target.checked})}
                    label={'Skip initial silence in MIDI'}
                />
            </OverlayTrigger>
            <Form.Check
                checked={settings.saveMixerToMIDI}
                onChange={(ev) => this.setSettings({saveMixerToMIDI: ev.target.checked})}
                label={'Save Mixer data to MIDI files'}
            />
            <OverlayTrigger overlay={precountTooltip} placement={'bottom'}>
                <Form.Check
                    checked={settings.precount.enabled}
                    onChange={(ev) => this.setSettings({
                        precount: {...settings.precount, enabled: ev.target.checked},
                    })}
                    label={'Enable precount'}
                />
            </OverlayTrigger>
            {settings.precount.enabled && this.buildPrecountForm()}
        </>;
    }

    private buildPrecountForm() {
        return <>
            {this.makePrecountSlider('Ontime', '%', 1, 100, 'ontimePercent')}
            {this.makePrecountSlider('Volume', '%', 1, 100, 'volumePercent')}
            {this.makePrecountSlider('Period', 'ms', 100, 1000, 'delayMs')}
            {this.makePrecountSlider('Count', '', 1, 10, 'numBeats')}
        </>;
    }

    private makePrecountSlider(title: string, unit: string, min: number, max: number, key: keyof PrecountSettings) {
        return <SimpleSlider
            title={title}
            unit={unit}
            min={min}
            max={max}
            value={this.getSettings().precount[key] as number}
            setValue={(value) => {
                const precount = {...this.getSettings().precount};
                (precount as any)[key] = value;
                this.setSettings({precount});
            }}
            visuallyEnabled={true}
            disabled={false}
        />;
    }

    private getSettings(): ShowModeOptions {
        return this.state.currentSettings || this.props.globalShowSettings;
    }

    private setSettings(update: Partial<ShowModeOptions>) {
        this.setState({currentSettings: {...this.getSettings(), ...update}});
    }
}
