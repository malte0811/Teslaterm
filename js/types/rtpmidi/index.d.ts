declare module 'rtpmidi' {
    const manager: Manager;

    export interface Session {
        on(event: "message", callback: (delta: number, message: number[]) => void);

        end(): void;
    }

    export interface Manager {
        createSession(config: {
            localName: string,
            bonjourName: string,
            port: number,
        }): Session;
    }
}
