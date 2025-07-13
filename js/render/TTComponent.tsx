import React, {useEffect} from "react";
import {IPCToRendererKey} from "../common/IPCConstantsToRenderer";
import {IPCListenerRef, processIPC} from "./ipc/IPCProvider";

export class TTComponent<Props, State> extends React.Component<Props, State> {
    private readonly listeners: IPCListenerRef[] = [];

    public componentWillUnmount() {
        this.listeners.forEach((l) => processIPC.removeListener(l));
    }

    protected addIPCListener<T>(channel: IPCToRendererKey<T>, listener: (arg: T) => any) {
        this.listeners.push(processIPC.on(channel, listener));
    }
}

export function useIPCListener<T>(channel: IPCToRendererKey<T>, listener: (arg: T) => any) {
    useEffect(() => {
        const listenerRef = processIPC.on(channel, listener);
        return () => processIPC.removeListener(listenerRef);
    }, []);
}
