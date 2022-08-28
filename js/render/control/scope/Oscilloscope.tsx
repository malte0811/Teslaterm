import React from "react";
import {CloseButton, Nav, Tab} from "react-bootstrap";
import {MediaFileType, PlayerActivity} from "../../../common/CommonTypes";
import {
    IPC_CONSTANTS_TO_RENDERER,
    MediaState,
    ScopeLine,
    ScopeText,
    ScopeTraceConfig,
    ScopeValues
} from "../../../common/IPCConstantsToRenderer";
import {TTComponent} from "../../TTComponent";
import {ControlledDraw, ControlledDrawProps, DrawCommand} from "./ControlledDraw";
import {MediaProgress} from "./MediaProgress";
import {ScopeSettings} from "./ScopeSettings";
import {ScopeStatistics} from "./ScopeStatistics";
import {NUM_VERTICAL_DIVS, OscilloscopeTrace, TraceConfig} from "./Trace";
import {Traces} from "./Traces";

const NUM_TRACES = 7;
export const TRACE_COLORS: string[] = [
    "white",
    "red",
    "blue",
    "green",
    "rgb(255, 128, 0)",
    "rgb(128, 128, 64)",
    "rgb(128, 64, 128)",
    "rgb(64, 128, 128)",
    "dimGray",
];

interface OscilloscopeState {
    traces: (OscilloscopeTrace | undefined)[];
    media: MediaState;
    controlledDraws: ControlledDrawProps[];
    selectedTab: number;
}

export class Oscilloscope extends TTComponent<{}, OscilloscopeState> {
    constructor(props: any) {
        super(props);
        const traces: (OscilloscopeTrace | undefined)[] = [];
        for (let i = 0; i < NUM_TRACES; ++i) {
            traces.push(undefined);
        }
        this.state = {
            traces,
            media: new MediaState(0, PlayerActivity.idle, "", MediaFileType.none),
            controlledDraws: [],
            selectedTab: 0,
        };
    }

    componentDidMount() {
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.scope.configure, (cfg: ScopeTraceConfig) => {
            this.setState((state) => Oscilloscope.configure(state.traces, cfg));
        });
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.scope.addValues, (values: ScopeValues) => {
            this.setState((state) => Oscilloscope.addScopeValues(state.traces, values));
        });
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.scope.startControlled, () => {
            this.setState((state) => {
                return {
                    controlledDraws: [...state.controlledDraws, {commandList: []}],
                    selectedTab: state.controlledDraws.length + 1,
                }
            });
        });
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.scope.drawString, (data: ScopeText) => {
            this.setState((state) => Oscilloscope.addDrawCommand(state.controlledDraws, {data, type: "text"}));
        });
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.scope.drawLine, (data: ScopeLine) => {
            this.setState((state) => Oscilloscope.addDrawCommand(state.controlledDraws, {data, type: "line"}));
        });
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.scope.redrawMedia, (data: MediaState) => {
            this.setState({media: data});
        });
    }

    render(): React.ReactNode {
        if (this.state.controlledDraws.length == 0) {
            return this.makeMainScope();
        } else {
            return (
                <Tab.Container
                    defaultActiveKey={0}
                    transition={false}
                    onSelect={(key) => this.setState({selectedTab: parseInt(key)})}
                    activeKey={this.state.selectedTab}
                >
                    <div className={'tt-tabs-full'}>
                        {this.makeTabRow()}
                        {this.makeTabContents()}
                    </div>
                </Tab.Container>
            );
        }
    }

    private makeTabContents(): JSX.Element {
        return <div className={'tt-tabs-body'}>
            <Tab.Content>
                <Tab.Pane eventKey={0} className={'tt-tabs-body-inner'} key={0}>
                    {this.state.selectedTab === 0 && this.makeMainScope()}
                </Tab.Pane>
                {Oscilloscope.numbersTo(this.state.controlledDraws.length).map((i) => this.makeControlledContent(i))}
            </Tab.Content>
        </div>;
    }

    private makeControlledContent(index: number): JSX.Element {
        const key = index + 1;
        return <Tab.Pane eventKey={key} className={'tt-tabs-body-inner'} key={key}>
            {
                key === this.state.selectedTab &&
				<div className={'tt-controlled-draw'}>
					<ControlledDraw {...this.state.controlledDraws[index]}/>
				</div>
            }
        </Tab.Pane>;
    }

    private makeTabRow(): JSX.Element {
        return <div className={'tt-tabs-top'}>
            <Nav variant="tabs">
                <Nav.Item key={0}>
                    <Nav.Link eventKey={0} href="#">
                        Telemetry
                    </Nav.Link>
                </Nav.Item>
                {Oscilloscope.numbersTo(this.state.controlledDraws.length).map((i) => this.makeControlledTab(i))}
            </Nav>
        </div>;
    }

    private makeControlledTab(index: number): JSX.Element {
        const tabKey = index + 1;
        const removeTab = (ev) => {
            ev.stopPropagation();
            this.setState((state) => {
                const newPlots = state.controlledDraws.filter((v, i) => i != index);
                const newTab = tabKey <= state.selectedTab ? state.selectedTab - 1 : state.selectedTab;
                return {controlledDraws: newPlots, selectedTab: newTab};
            });
        };
        // TODO dynamic name?
        return <Nav.Item key={tabKey}>
            <Nav.Link eventKey={tabKey} href="#">
                Tuning plot
                <CloseButton onClick={removeTab}/>
            </Nav.Link>
        </Nav.Item>;
    }

    private makeMainScope(): JSX.Element {
        const realTraces = this.state.traces.filter(t => t !== undefined);
        return <div className={'tt-scope'}>
            <MediaProgress {...this.state.media}/>
            <div className={'tt-scope-middle-row'}>
                <Traces traces={realTraces}/>
                <ScopeSettings configs={realTraces.map((t) => t.config)}/>
            </div>
            <ScopeStatistics traces={realTraces}/>
        </div>;
    }

    private static addScopeValues(oldTraces: OscilloscopeTrace[], values: ScopeValues) {
        const newTraces = [...oldTraces];
        for (const tickData of values.values) {
            for (let i = 0; i < NUM_TRACES; ++i) {
                if (newTraces[i]) {
                    if (tickData[i] !== undefined) {
                        newTraces[i] = newTraces[i].withSample(tickData[i]);
                    } else {
                        newTraces[i] = newTraces[i].duplicateLast();
                    }
                }
            }
        }
        return {traces: newTraces};
    }

    private static configure(oldTraces: OscilloscopeTrace[], cfg: ScopeTraceConfig) {
        const newTraces = [...oldTraces];
        const perDiv = (cfg.max - cfg.min) / NUM_VERTICAL_DIVS;
        newTraces[cfg.id] = new OscilloscopeTrace(
            new TraceConfig(TRACE_COLORS[cfg.id], cfg.name, cfg.unit, perDiv, cfg.offset, cfg.div)
        );
        return {traces: newTraces};
    }

    private static addDrawCommand(oldDraws: ControlledDrawProps[], newCommand: DrawCommand) {
        const newControlled = [...oldDraws];
        if (newControlled.length === 0) {
            newControlled.push({commandList: []});
        }
        const withNewCommand = [
            ...newControlled[newControlled.length - 1].commandList,
            newCommand,
        ];
        newControlled[newControlled.length - 1] = {commandList: withNewCommand};
        return {controlledDraws: newControlled};
    }

    private static numbersTo(length: number): number[] {
        return [...Array(length).keys()];
    }
}