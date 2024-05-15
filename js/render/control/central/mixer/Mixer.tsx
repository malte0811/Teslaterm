import React from "react";
import {Button} from "react-bootstrap";
import {CoilID} from "../../../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../../../common/IPCConstantsToMain";
import {ChannelID, IPC_CONSTANTS_TO_RENDERER} from "../../../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../../../common/TTConfig";
import {DEFAULT_MIXER_LAYER, MixerLayer, VolumeKey, VolumeMap, VolumeUpdate} from "../../../../common/VolumeMap";
import {processIPC} from "../../../ipc/IPCProvider";
import {TTComponent} from "../../../TTComponent";
import {CoilState} from "../../MainScreen";
import {InstrumentChoice, MixerColumn, MuteState} from "./MixerColumn";

export interface MixerProps {
    darkMode: boolean;
    coils: CoilState[];
    ttConfig: TTConfig;
}

interface MixerState {
    volumes: VolumeMap;
    voiceProgram: Map<ChannelID, number>;
    channelNames: Map<ChannelID, string>;
    currentLayer: MixerLayer;
    channels: ChannelID[];
    availablePrograms: string[];
}

export class Mixer extends TTComponent<MixerProps, MixerState> {
    public constructor(props: MixerProps) {
        super(props);
        this.state = {
            availablePrograms: [],
            channelNames: new Map<ChannelID, string>(),
            channels: [],
            currentLayer: DEFAULT_MIXER_LAYER,
            voiceProgram: new Map<CoilID, number>(),
            volumes: new VolumeMap(),
        };
    }

    public componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setMediaChannels,
            (voices) => this.setState({channels: voices}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setAvailableMIDIPrograms,
            (availablePrograms) => this.setState({availablePrograms}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIProgramsByChannel,
            (voiceProgram) => this.setState({voiceProgram}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setMIDIChannelNames, (names) => this.setState({channelNames: names}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setMixerLayer, (layer) => this.setState({currentLayer: layer}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setVolume,
            ([key, volume]) => this.setState((oldState) => ({volumes: oldState.volumes.with(key, volume)})),
        );
    }

    public render() {
        let sliders: React.JSX.Element[];
        const layer = this.state.currentLayer;
        if (layer === 'coilMaster') {
            sliders = this.props.coils.map(
                state => this.makeMixer({coil: state.id}, state.name || 'Unknown'),
            );
        } else if (layer === 'voiceMaster') {
            sliders = this.makeChannelSliders(undefined);
        } else {
            sliders = this.makeChannelSliders(layer);
        }
        return <div className={'tt-mixer'}>
            <div className={'tt-mixer-border-box'}>
                {...sliders}
            </div>
            <div style={{flex: '1 0 auto'}}/>
            <div className={'tt-mixer-border-box'}>
                <MixerColumn
                    title={'Master'}
                    setValue={(val) => this.setVolume({}, {volumePercent: val})}
                    value={this.state.volumes.getIndividualVolume({})}
                    mute={MuteState.unavailable}
                    setMute={() => {}}
                />
            </div>
            <div className={'tt-mixer-selector'}>
                {this.makeLayerButton('coilMaster', "By Coil")}
                {this.makeLayerButton('voiceMaster', "By Channel")}
                {...this.props.coils.map((coil) => this.makeLayerButton(coil.id, coil.name || 'Unknown'))}
                {this.makeMediaCycleButtons()}
            </div>
        </div>;
    }

    private setVolume(key: VolumeKey, volume: VolumeUpdate) {
        this.setState((oldState) => ({volumes: oldState.volumes.with(key, volume)}));
        processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setVolume, [key, volume]);
    }

    private setProgram(voice: ChannelID, program: number) {
        this.setState((oldState) => {
            const newPrograms = new Map<ChannelID, number>(oldState.voiceProgram);
            newPrograms.set(voice, program);
            return {voiceProgram: newPrograms};
        });
        processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride, [voice, program]);
    }

    private makeChannelSliders(coil?: CoilID) {
        return this.state.channels.map((i) => {
            const program: InstrumentChoice = {
                available: this.state.availablePrograms,
                currentChoice: this.state.voiceProgram.get(i) || 0,
                setValue: (val) => this.setProgram(i, val),
            };
            return this.makeMixer({channel: i, coil}, this.state.channelNames.get(i) || `Channel ${i}`, program);
        });
    }

    private makeMixer(key: VolumeKey, title: string, program?: InstrumentChoice) {
        const state = this.state.volumes.getVolumeSetting(key);
        return <MixerColumn
            title={title}
            setValue={(volume) => this.setVolume(key, {volumePercent: volume})}
            value={state.volumePercent}
            mute={state.muted ? MuteState.muted : MuteState.audible}
            setMute={(state) => this.setVolume(key, {muted: state === MuteState.muted})}
            program={program}
        />;
    }

    private makeLayerButton(layer: MixerLayer, text: string) {
        return <Button
            onClick={() => {
                this.setState({currentLayer: layer});
                processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setMixerLayer, layer);
            }}
            style={{width: '100%'}}
            disabled={this.state.currentLayer === layer}
        >{text}</Button>;
    }

    private makeMediaCycleButtons() {
        if (this.props.ttConfig.mainMediaPath !== '') {
            return <>
                <Button onClick={() => processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.switchMediaFile, {next: true})}>
                    Next
                </Button>
                <Button
                    onClick={() => processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.switchMediaFile, {next: false})}>
                    Prev
                </Button>
            </>;
        } else {
            return <></>;
        }
    }
}
