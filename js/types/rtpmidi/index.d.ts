declare module 'rtpmidi' {
    const manager: Manager;

    export interface ConnectionTarget {
        address: string;
        port: number;
    }

    export interface Session {
        on(event: "message", callback: (delta: number, message: number[]) => void): void;

        sendMessage(delta: number, data: number[]): void;

        end(): void;

        connect(target: ConnectionTarget): void;
    }

    export interface Manager {
        createSession(config: {
            localName: string,
            bonjourName: string,
            port: number,
        }): Session;
    }
}
