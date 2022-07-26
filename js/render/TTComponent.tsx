import React from "react";
import {IPCListenerRef, processIPC} from "./ipc/IPCProvider";

export class TTComponent<Props, State> extends React.Component<Props, State> {
    private readonly listeners: IPCListenerRef[] = [];

    public componentWillUnmount() {
        this.listeners.forEach((l) => processIPC.removeListener(l));
    }

    protected addIPCListener(channel: string, listener: (...args: any[]) => any) {
        this.listeners.push(processIPC.on(channel, listener));
    }
}
