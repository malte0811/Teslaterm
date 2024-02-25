import os from "os";

export function getDefaultSerialPortForConfig() {
    if (os.platform() === "win32") {
        return "COM1";
    } else {
        return "/dev/ttyACM0";
    }
}

export const DEFAULT_SERIAL_VENDOR = "1a86";
export const DEFAULT_SERIAL_PRODUCT = "7523";
