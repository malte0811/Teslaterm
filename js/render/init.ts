import {maxBPS, maxBurstOfftime, maxBurstOntime, maxOntime} from "../common/commands";
import {terminal} from './gui/constants';
import * as constants from './gui/constants';
import {NUM_GAUGES} from "./gui/gauges";
import * as gauges from "./gui/gauges";
import * as gui from './gui/gui';
import * as menu from './gui/menu';
import * as midi_ui from "./gui/midi_ui";
import * as scope from './gui/oscilloscope/oscilloscope';
import * as sliders from './gui/sliders';
import {MenuIPC} from "./ipc/Menu";
import {MetersIPC} from "./ipc/meters";
import {MiscIPC} from "./ipc/Misc";
import {ScopeIPC} from "./ipc/scope";
import {ScriptingIPC} from "./ipc/Scripting";
import {SlidersIPC} from "./ipc/sliders";


export function init() {
    document.addEventListener('DOMContentLoaded', () => {
        $(() => {
            let html_gauges = '';
            for (let i = 0; i < NUM_GAUGES; i++) {
                html_gauges += '<div id="gauge' + i + '" style= "width: 100px; height: 100px"></div>';
            }

            const pstyle = 'background-color: #F5F6F7;  padding: 5px;';
            $('#layout').w2layout({
                name: 'layout',
                panels: [
                    {
                        content:
                            '<div id="toolbar" style="padding: 4px; border: 1px solid #dfdfdf; border-radius: 3px"></div>',
                        overflow: "hidden", resizable: false, size: 50, style: pstyle, type: 'top',
                    },
                    {
                        content:
                            '<div class="scopeview">' +
                            '<article>' +
                            '<canvas id="backCanvas" style= "position: absolute; left: 0; top: 0; width: 75%; background: black; z-index: 0;"></canvas>' +
                            '<canvas id="waveCanvas" style= "position: absolute; left: 0; top: 0;width: 75%; z-index: 1;"></canvas>' +
                            '</article>' +
                            '<aside>' +
                            '<div id="ontime">Ontime<br><br>' +
                            '<input type="range" id="slider" min="0" max="' + maxOntime + '" value="0" class="slider-gray" data-show-value="true">' +
                            '<span id="total">0</span> µs (<span id="relative">100</span>% of <span id="absolute"><b>0</b></span> µs)' +
                            '<br><input type="checkbox" id="relativeSelect"><label for="relativeSelect">Relative</label></div>' +
                            '<br><br>Offtime<br><br>' +
                            '<input type="range" id="slider1" min="20" max="' + maxBPS + '" value="1" class="slider-gray" data-show-value="true"><label id="slider1_disp">20 Hz</label>' +
                            '<br><br>Burst On<br><br>' +
                            '<input type="range" id="slider2" min="0" max="' + maxBurstOntime + '" value="0" class="slider-gray" data-show-value="true"><label id="slider2_disp">0 ms</label>' +
                            '<br><br>Burst Off<br><br>' +
                            '<input type="range" id="slider3" min="0" max="' + maxBurstOfftime + '" value="500" class="slider-gray" data-show-value="true"><label id="slider3_disp">500 ms</label>' +
                            '<br><br>MIDI Input: <select id="midiIn"></select>' +
                            '</aside>' +
                            '</div>',
                        style: pstyle, type: 'main',
                    },
                    {
                        content: html_gauges, resizable: false, size: 120, style: pstyle, type: 'right',
                    },

                    {
                        content:
                            '<div id="terminal" style="position:relative; width:100%; height:100%"></div>',
                        resizable: true, size: '50%', style: pstyle, type: 'preview',
                    },

                ],
            });

            constants.init();
            terminal.decorate(document.querySelector('#terminal'));
            terminal.installKeyboard();

            gui.init();
            sliders.init();
            scope.init();

            $('#toolbar').w2toolbar({
                items: [
                    {
                        icon: 'fa fa-table', id: 'mnu_command', items: [
                            {text: 'TR Start', icon: 'fa fa-bolt', id: 'transient'},
                            {text: 'Save EEPROM-Config', icon: 'fa fa-microchip'},
                            {text: 'Load EEPROM-Config', icon: 'fa fa-microchip'},
                            {text: 'Settings', id: 'settings', icon: 'fa fa-table'},
                        ], text: 'Commands', type: 'menu',
                    },
                    {
                        icon: 'fa fa-table', id: 'mnu_midi', items: [
                            {text: 'Play', icon: 'fa fa-bolt'},
                            {text: 'Stop', icon: 'fa fa-bolt'},
                        ],
                        text: 'MIDI-File: none', type: 'menu',
                    },

                    {
                        icon: 'fa fa-table', id: 'mnu_script', items: [
                            {text: 'Start', icon: 'fa fa-bolt'},
                            {text: 'Stop', icon: 'fa fa-bolt'},
                        ], text: 'Script: none', type: 'menu',
                    },
                    {type: 'spacer'},
                    {type: 'button', id: 'connect', text: 'Connect', icon: 'fa fa-plug'},
                    {type: 'button', id: 'kill_set', text: 'KILL SET', icon: 'fa fa-power-off'},
                    {type: 'html', id: 'kill_status', html: menu.KILL_STATUS_OK},
                    {type: 'button', id: 'kill_reset', text: 'KILL RESET', icon: 'fa fa-power-off'},
                    {type: 'button', id: 'cls', text: 'Clear Term', icon: 'fa fa-terminal'},
                ],
                name: 'toolbar',
                onClick: menu.onCtrlMenuClick,
            });

            midi_ui.init();
            MenuIPC.init();
            MetersIPC.init();
            MiscIPC.init();
            ScopeIPC.init();
            SlidersIPC.init();
            ScriptingIPC.init();

            w2ui.layout.on({type: 'resize', execute: 'after'}, () => {
                scope.onResize();
            });
            setInterval(update, 20);
        });
    });
}

// Called every 20 ms
function update() {
    gauges.refresh_all();
}
