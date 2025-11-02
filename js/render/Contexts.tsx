import React from "react";
import {SyncedUIConfig} from "../common/UIConfig";

export const DarkModeContext = React.createContext(false);
// TODO decide whether this is a good idea, and consistently switch to one type of passing
export const UIConfigContext = React.createContext<SyncedUIConfig>(undefined);
