import {app, BrowserWindow} from "electron";
import * as path from "path";
import {init} from "./init";

export let mainWindow: BrowserWindow;

function createWindow() {
    init();
    // Create the browser window.
    mainWindow = new BrowserWindow({
        webPreferences: {
            // TODO the goal is for both of these to be removed at some point
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, "../../index_electron.html"));

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    mainWindow.setMenuBarVisibility(false);

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On OS X it"s common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});
