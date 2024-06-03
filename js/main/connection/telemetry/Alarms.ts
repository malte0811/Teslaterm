import {CoilID, UD3AlarmLevel} from '../../../common/constants';
import {getToMainIPCPerCoil} from '../../../common/IPCConstantsToMain';
import {
    getToRenderIPCPerCoil,
    IPC_CONSTANTS_TO_RENDERER,
    ToastSeverity,
    UD3Alarm
} from '../../../common/IPCConstantsToRenderer';
import {ipcs, processIPC} from '../../ipc/IPCProvider';

const allAlarms = new Map<CoilID, UD3Alarm[]>();

export function resetAlarms(coil: CoilID) {
    allAlarms.delete(coil);
}

export function resetAllAlarms() {
    allAlarms.clear();
}

export function initAlarms(coil: CoilID) {
    processIPC.on(
        getToMainIPCPerCoil(coil).menu.requestAlarmList,
        () => processIPC.send(getToRenderIPCPerCoil(coil).alarmList, allAlarms.get(coil) || []),
    );
}

export function addAlarm(coil: CoilID, alarm: UD3Alarm, skipToast: boolean) {
    if (!allAlarms.has(coil)) {
        allAlarms.set(coil, []);
    }
    allAlarms.get(coil).push(alarm);
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
        const toastMessage = alarm.message + (alarm.value !== undefined ? ' | Value: ' + alarm.value : '');
        ipcs.coilMisc(coil).openToast('UD3 alarm', toastMessage, severity, alarm.message);
    }
}
