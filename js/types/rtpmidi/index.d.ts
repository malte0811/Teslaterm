declare module 'rtpmidi' {
    const manager: Manager;

    export interface ConnectionTarget {
        address: string;
        port: number;
    }

    export interface Stream {
    }

    export interface Session {
        on(event: 'message', callback: (delta: number, message: number[]) => void): void;

        on(event: 'controlMessage', callback: (message: object) => void): void;

        on(event: 'streamAdded', callback: () => void): void;

        sendMessage(delta: number, data: number[]): void;

        end(): void;

        connect(target: ConnectionTarget): void;

        getStreams(): Stream[];

        removeStream(stream: Stream): void;
    }

    export interface Manager {
        createSession(config: {
            localName: string,
            bonjourName: string,
            port: number,
        }): Session;
    }
}
