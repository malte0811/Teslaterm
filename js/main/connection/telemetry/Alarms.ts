import {UD3AlarmLevel} from '../../../common/constants';
import {IPC_CONSTANTS_TO_MAIN} from '../../../common/IPCConstantsToMain';
import {IPC_CONSTANTS_TO_RENDERER, ToastSeverity, UD3Alarm} from '../../../common/IPCConstantsToRenderer';
import {ipcs, processIPC} from '../../ipc/IPCProvider';

const allAlarms: UD3Alarm[] = [];

export function resetAlarms() {
    allAlarms.length = 0;
}

export function initAlarms() {
    processIPC.on(
        IPC_CONSTANTS_TO_MAIN.menu.requestAlarmList,
        (source) => processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.alarmList, source, allAlarms),
    );
}

export function addAlarm(alarm: UD3Alarm, skipToast: boolean) {
    allAlarms.push(alarm);
    if (!skipToast) {
        const severity = (() => {
            switch (alarm.level) {
                case UD3AlarmLevel.info:
                    return ToastSeverity.info;
                case UD3AlarmLevel.warn:
                    return ToastSeverity.warning;
                case UD3AlarmLevel.alarm:
                case UD3AlarmLevel.critical:
                    return ToastSeverity.error;
            }
        })();
        const toastMessage = alarm.message + (alarm.value !== undefined ? ' | Value: ' + alarm.value : '')
        ipcs.misc.openToast('UD3 alarm', toastMessage, severity, alarm.message);
    }
}
