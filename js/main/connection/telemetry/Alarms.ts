import {CoilID, UD3AlarmLevel} from '../../../common/constants';
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from '../../../common/IPCConstantsToMain';
import {IPC_CONSTANTS_TO_RENDERER, ToastSeverity, UD3Alarm} from '../../../common/IPCConstantsToRenderer';
import {ipcs, processIPC} from '../../ipc/IPCProvider';

// TODO make coil-dependent
const allAlarms: UD3Alarm[] = [];

export function resetAlarms() {
    allAlarms.length = 0;
}

export function initAlarms(coil: CoilID) {
    processIPC.on(
        getToMainIPCPerCoil(coil).menu.requestAlarmList,
        (source) => processIPC.sendToWindow(IPC_CONSTANTS_TO_RENDERER.alarmList, source, allAlarms),
    );
}

export function addAlarm(coil: CoilID, alarm: UD3Alarm, skipToast: boolean) {
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
        ipcs.coilMisc(coil).openToast('UD3 alarm', toastMessage, severity, alarm.message);
    }
}
