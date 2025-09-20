import React, {useState} from "react";
import {CloseButton, Nav, Tab} from "react-bootstrap";
import {CoilID} from "../../../common/constants";
import {
    getToRenderIPCPerCoil,
    IPC_CONSTANTS_TO_RENDERER,
    MediaState,
    ScopeLine,
    ScopeText,
    ScopeTraceConfig,
    ScopeValues,
} from "../../../common/IPCConstantsToRenderer";
import {MediaFileType, PlayerActivity} from "../../../common/MediaTypes";
import {useIPCListener} from "../../TTComponent";
import {ControlledDraw, ControlledDrawProps, DrawCommand} from "./ControlledDraw";
import {MediaProgress} from "./MediaProgress";
import {QCWRamp} from "./QCWRamp";
import {ScopeSettings} from "./ScopeSettings";
import {ScopeStatistics} from "./ScopeStatistics";
import {OscilloscopeTrace, TraceConfig} from "./Trace";
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

export interface OscilloscopeProps {
    coil: CoilID;
}

function useTraces(coil: CoilID): [Array<OscilloscopeTrace | undefined>, () => void] {
    const [traces, setTraces] = useState<Array<OscilloscopeTrace | undefined>>(() => {
        return new Array(NUM_TRACES).fill(undefined);
    });
    const channels = getToRenderIPCPerCoil(coil);
    useIPCListener(channels.scope.configure, (cfg: ScopeTraceConfig) => setTraces((oldTraces) => {
        const newTraces = [...oldTraces];
        const oldTrace = newTraces[cfg.id];
        const newTraceCfg = new TraceConfig(cfg);
        newTraces[cfg.id] = oldTrace ? oldTrace.withCfg(newTraceCfg) : new OscilloscopeTrace(newTraceCfg);
        return newTraces;
    }));
    useIPCListener(channels.scope.addValues, (values: ScopeValues) => setTraces((oldTraces) => {
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
        return newTraces;
    }));
    const clearStats = () => setTraces(traces.map((t) => t && t.withClearedStats()));
    return [traces, clearStats];
}

function useControlledDraw(
    coil: CoilID, setTab: (newTab: number) => void,
): [ControlledDrawProps[], (toDelete: number) => void] {
    const [controlledDraws, setControlledDraws] = useState<ControlledDrawProps[]>([]);
    const channels = getToRenderIPCPerCoil(coil);
    useIPCListener(channels.scope.startControlled, (title) => {
        setTab(-1);
        setControlledDraws((old) => [...old, {commandList: [], title}]);
    });
    const addDrawCommand = (newCommand: DrawCommand) => setControlledDraws((oldDraws) => {
        const newControlled = [...oldDraws];
        const oldProps = newControlled[newControlled.length - 1];
        const withNewCommand = [...oldProps.commandList, newCommand];
        newControlled[newControlled.length - 1] = {commandList: withNewCommand, title: oldProps.title};
        return newControlled;
    });
    useIPCListener(channels.scope.drawString, (data: ScopeText) => addDrawCommand({data, type: "text"}));
    useIPCListener(channels.scope.drawLine, (data: ScopeLine) => addDrawCommand({data, type: "line"}));
    const deleteIndex = (toDelete: number) => {
        setControlledDraws(controlledDraws.filter((_, i) => toDelete !== i));
    };
    return [controlledDraws, deleteIndex];
}

interface TitledTab {
    content: React.ReactNode;
    title: string;
    closeTab?: () => void;
}

function TabContentWrapper(props: {content: TitledTab[]}) {
    return <div className={'tt-tabs-body'}>
        <Tab.Content>
            {props.content.map((child, i) => <Tab.Pane eventKey={i} className={'tt-tabs-body-inner'} key={i}>
                {child.content}
            </Tab.Pane>)}
        </Tab.Content>
    </div>;
}

function TabHeaderWrapper(props: {content: TitledTab[]}) {
    return <div className={'tt-tabs-top'}>
        <Nav variant="tabs">{props.content.map((tab, i) => <Nav.Item key={i}>
            <Nav.Link eventKey={i} href="#">
                {tab.title}
                {tab.closeTab && <CloseButton onClick={(ev) => {
                    ev.stopPropagation();
                    tab.closeTab();
                }}/>}
            </Nav.Link>
        </Nav.Item>)}</Nav>
    </div>;
}

function TabWrapper(props: {tabs: TitledTab[], currentTab: number, setTab: (t: number) => void}) {
    if (props.tabs.length === 1) {
        return props.tabs[0].content;
    }
    return <Tab.Container
        defaultActiveKey={0}
        transition={false}
        onSelect={(key) => props.setTab(parseInt(key, 10))}
        activeKey={props.currentTab}
    >
        <div className={'tt-tabs-full'}>
            <TabHeaderWrapper content={props.tabs}/>
            <TabContentWrapper content={props.tabs}/>
        </div>
    </Tab.Container>;
}

function MainOscilloscope(props: {traces: OscilloscopeTrace[], media: MediaState, clearStats: () => void}) {
    const realTraces = props.traces.filter(t => t !== undefined);
    return <div className={'tt-scope'}>
        <MediaProgress {...props.media}/>
        <div className={'tt-scope-middle-row'}>
            <Traces traces={realTraces}/>
            <ScopeSettings configs={realTraces.map((t) => t.config)}/>
        </div>
        <ScopeStatistics traces={realTraces} clearStats={props.clearStats}/>
    </div>;
}

export function Oscilloscope(props: OscilloscopeProps) {
    const [traces, clearStats] = useTraces(props.coil);
    const [currentTabWrapping, setCurrentTab] = useState(0);
    const [mediaState, setMediaState] = useState<MediaState>(
        {progressPercent: 0, state: PlayerActivity.idle, title: "", type: MediaFileType.none},
    );
    useIPCListener(IPC_CONSTANTS_TO_RENDERER.redrawMedia, setMediaState);
    const tabContents: TitledTab[] = [{
        content: <MainOscilloscope traces={traces} media={mediaState} clearStats={clearStats}/>,
        title: "Telemetry",
    }];
    // TODO only if QCW!
    const fakeQCWData: number[] = new Array(200).fill(0);
    for (let i = 0; i < 110; ++i) {
        fakeQCWData[i] = 2 * i;
    }
    tabContents.push({content: <QCWRamp points={fakeQCWData}/>, title: 'QCW ramp'});
    const fixedTabs = tabContents.length;
    const [controlledDraws, deleteDraw] = useControlledDraw(props.coil, setCurrentTab);
    controlledDraws.forEach((draw, i) => tabContents.push({
        closeTab: () => closeTab(i + fixedTabs),
        content: <div className={'tt-controlled-draw'}><ControlledDraw {...draw}/></div>,
        title: draw.title,
    }));
    const currentTab = (currentTabWrapping + tabContents.length) % tabContents.length;
    const closeTab = (toClose: number) => {
        deleteDraw(toClose - fixedTabs);
        setCurrentTab(toClose < currentTab ? currentTab - 1 : currentTab);
    };
    return <TabWrapper tabs={tabContents} currentTab={currentTab} setTab={setCurrentTab}/>;
}
