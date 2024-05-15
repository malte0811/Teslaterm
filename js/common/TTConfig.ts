export interface TTConfig {
    readonly udConfigPages: Map<string, number>;
    readonly defaultUDFeatures: Map<string, string>;
    // TODO move to UI config. This is just to have something running at the ES.
    readonly mainMediaPath: string;
}

