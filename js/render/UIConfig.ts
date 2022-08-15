const DARK_MODE_KEY = 'darkMode';

export interface UIConfig {
    readonly darkMode: boolean;
}

export function loadUIConfig(): UIConfig {
    return {
        darkMode: (localStorage.getItem(DARK_MODE_KEY) || 'false') == 'true'
    };
}

export function storeUIConfig(cfg: UIConfig) {
    // TODO How do I properly toString a boolean?
    localStorage.setItem(DARK_MODE_KEY, ''+cfg.darkMode);
}
