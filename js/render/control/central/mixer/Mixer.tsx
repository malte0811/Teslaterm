import React from "react";
import {Button} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../../common/IPCConstantsToMain";
import {FaderID, IPC_CONSTANTS_TO_RENDERER, SongListData} from "../../../../common/IPCConstantsToRenderer";
import {
    AllFaders,
    DEFAULT_MIXER_LAYER,
    DEFAULT_VOLUME,
    FaderData,
    MixerLayer,
    VolumeUpdate,
} from "../../../../common/MixerTypes";
import {TTConfig} from "../../../../common/TTConfig";
import {processIPC} from "../../../ipc/IPCProvider";
import {TTComponent} from "../../../TTComponent";
import {CoilState} from "../../MainScreen";
import {InstrumentChoice, MixerColumn, MuteState} from "./MixerColumn";
import {Playlist} from "./Playlist";

export interface MixerProps {
    darkMode: boolean;
    coils: CoilState[];
    ttConfig: TTConfig;
    availablePrograms: string[];
}

interface MixerState {
    faders: AllFaders;
    currentLayer: MixerLayer | 'songList';
    songList?: SongListData;
}

export class Mixer extends TTComponent<MixerProps, MixerState> {
    public constructor(props: MixerProps) {
        super(props);
        this.state = {
            currentLayer: DEFAULT_MIXER_LAYER,
            faders: {
                masterVolumePercent: DEFAULT_VOLUME.volumePercent,
                specificFaders: [],
            },
        };
    }

    public componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.centralTab.setMixerLayer,
            ([layer, faders]) => this.setState({currentLayer: layer, faders}),
        );
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.centralTab.setSongList, (songList) => this.setState({songList}));
    }

    public render() {
        const elements =  this.state.currentLayer === 'songList' ?
            [<Playlist {...this.state.songList}/>] :
            this.state.faders.specificFaders.map((state, i) => this.makeFader(state, i));
        return <div className={'tt-mixer'}>
            <div className={'tt-mixer-border-box'} style={{display: 'flex', flexDirection: 'row'}}>
                {...elements}
            </div>
            <div style={{flex: '1 0 auto'}}/>
            <div className={'tt-mixer-border-box'}>
                {this.makeFader({
                    key: {},
                    title: 'Master',
                    volume: {volumePercent: this.state.faders.masterVolumePercent, muted: false},
                }, -1, false)}
            </div>
            <div className={'tt-mixer-selector'}>
                {this.state.songList && this.makeLayerButton('songList', 'Song List')}
                {this.makeLayerButton('coilMaster', "By Coil")}
                {this.makeLayerButton('voiceMaster', "By Channel")}
                {...this.props.coils.map((coil) => this.makeLayerButton(coil.id, coil.name || 'Unknown'))}
            </div>
        </div>;
    }

    private setVolume(fader: FaderID, volume: VolumeUpdate) {
        if (fader >= 0) {
            this.setFaderState(fader, (oldState) => ({volume: {...oldState.volume, ...volume}}));
            processIPC.send(
                IPC_CONSTANTS_TO_MAIN.centralTab.setVolume,
                [this.state.faders.specificFaders[fader].key, volume],
            );
        } else if (volume.volumePercent !== undefined) {
            this.setState((old) => ({
                faders: {
                    masterVolumePercent: volume.volumePercent,
                    specificFaders: old.faders.specificFaders,
                },
            }));
            processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setVolume, [{}, volume]);
        }
    }

    private setFaderState(fader: FaderID, update: (old: Readonly<FaderData>) => Partial<FaderData>) {
        this.setState((oldState) => {
            const newFaders = [...oldState.faders.specificFaders];
            newFaders[fader] = {...newFaders[fader], ...update(newFaders[fader])};
            return {
                faders: {
                    masterVolumePercent: oldState.faders.masterVolumePercent,
                    specificFaders: newFaders,
                },
            };
        });
    }

    private setProgram(fader: FaderID, program: number) {
        this.setFaderState(fader, () => ({programID: program}));
        processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setMIDIProgramOverride, [fader, program]);
    }

    private makeFader(data: FaderData | undefined, id: FaderID, allowMute: boolean = true) {
        if (!data) {
            return <MixerColumn
                title={'Unavailable'}
                setValue={() => {}}
                value={0}
                mute={MuteState.audible}
                setMute={() => {}}
                disabled={true}
            />;
        }
        const programChoice: InstrumentChoice = data.programID !== undefined && {
            available: this.props.availablePrograms,
            currentChoice: data.programID,
            setValue: (val) => this.setProgram(id, val),
        };
        return <MixerColumn
            title={data.title}
            setValue={(volume) => this.setVolume(id, {volumePercent: volume})}
            value={data.volume.volumePercent}
            mute={allowMute ? (data.volume.muted ? MuteState.muted : MuteState.audible) : MuteState.unavailable}
            setMute={(state) => this.setVolume(id, {muted: state === MuteState.muted})}
            program={programChoice}
            muteSuffix={data.muteSuffix}
            disabled={false}
        />;
    }

    private makeLayerButton(layer: MixerLayer | 'songList', text: string) {
        return <Button
            onClick={() => {
                this.setState({currentLayer: layer});
                processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setMixerLayer, layer);
            }}
            style={{width: '100%'}}
            disabled={this.state.currentLayer === layer}
        >{text}</Button>;
    }
}
