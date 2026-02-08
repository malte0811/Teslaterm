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
    useIPCListeners([0], () => ({channel, listener}));
}

export function useIPCListeners<K, T>(
    keys: K[],
    getListener: (key: K) => {channel: IPCToRendererKey<T>, listener: (arg: T) => any},
) {
    useEffect(() => {
        const listenerRefs: IPCListenerRef[] = [];
        for (const key of keys) {
            const listener = getListener(key);
            listenerRefs.push(processIPC.on(listener.channel, listener.listener));
        }
        return () => {
            for (const listener of listenerRefs) {
                processIPC.removeListener(listener);
            }
        };
    }, [keys]);
}
