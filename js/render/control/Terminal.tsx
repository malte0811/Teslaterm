import React, {CSSProperties} from "react";
import {IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {commands} from "../ipc/commands";
import {TTComponent} from "../TTComponent";
import {TerminalRef} from "./MainScreen";
import * as xterm from "xterm";

export interface TerminalProps {
    terminal: TerminalRef;
    disabled: boolean;
}

export class Terminal extends TTComponent<TerminalProps, {}> {
    private readonly terminalDivRef: React.RefObject<HTMLDivElement>;
    private readonly resizeHandler: () => any;

    constructor(props: any) {
        super(props);
        this.terminalDivRef = React.createRef();
        this.resizeHandler = () => {
            if (this.props.terminal.terminal) {
                this.props.terminal.fitter.fit();
            }
        };
    }

    public componentDidMount() {
        if (this.terminalDivRef.current && !this.props.terminal.terminal) {
            this.props.terminal.terminal = new xterm.Terminal();
            const terminal = new xterm.Terminal();
            terminal.loadAddon(this.props.terminal.fitter);
            terminal.onKey((ev) => {
                if (!this.props.disabled) {
                    commands.sendManualCommand(ev.key);
                }
            });
            terminal.open(this.terminalDivRef.current);
            this.props.terminal.terminal = terminal;
            this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.terminal, s => this.onDataFromMain(s));
            this.props.terminal.fitter.fit();
            commands.sendManualCommand('\rcls\r');
        }
        window.addEventListener('resize', this.resizeHandler);
    }

    public componentWillUnmount() {
        super.componentWillUnmount();
        if (this.props.terminal.terminal) {
            this.props.terminal.terminal.dispose();
            this.props.terminal.terminal = undefined;
        }
        window.removeEventListener('resize', this.resizeHandler);
    }

    public render(): React.ReactNode {
        return <div ref={this.terminalDivRef} className={'tt-terminal'}/>;
    }

    private onDataFromMain(s: string) {
        if (this.props.terminal.terminal) {
            this.props.terminal.terminal.write(s);
        }
    }
}
