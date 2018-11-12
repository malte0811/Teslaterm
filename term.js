var connid;
var connected = 0;
var path;
const wavecolor = ["white", "red", "blue", "green", "rgb(255, 128, 0)", "rgb(128, 128, 64)", "rgb(128, 64, 128)", "rgb(64, 128, 128)", "DimGray"];
var pixel = 1;
var midi_state=[];
const simulated = false;

const kill_msg = new Uint8Array([0xB0,0x77,0x00]);

const NUM_GAUGES = 7;

var ctx;

hterm.defaultStorage = new lib.Storage.Memory();

const terminal = new hterm.Terminal();

var wavecanvas;
var backcanvas;

var TIMEOUT = 50;
var response_timeout = 50  // 50 * 20ms = 1s

const WD_TIMEOUT = 5;
var wd_reset = 5  // 5 * 20ms = 160ms
var wd_reset_msg=new Uint8Array([0xF0,0x0F,0x00]);

var socket;
var socket_midi;

var ipaddr="0.0.0.0";

var blink=0;
var coil_hot_led=0;
var cycle_led=0;

var draw_mode=0;

var midiServer;

var meters;

var uitime = setInterval(refresh_UI, 20);
const scripting = require('./term_scripting');
let currentScript = null;
var ontimeUI = {totalVal: 0, relativeVal: 100, absoluteVal: 0};

function connect_ip(){
	chrome.sockets.tcp.create({}, createInfo);
	chrome.sockets.tcp.create({}, createInfo_midi);
}

function reconnect_tel(){
	chrome.sockets.tcp.disconnect(socket,callback_dsk);	
}
function callback_dsk(info){
	chrome.sockets.tcp.close(socket, function clb(){chrome.sockets.tcp.create({}, createInfo);});

}

function reconnect_midi(){
	chrome.sockets.tcp.disconnect(socket_midi,callback_dsk_midi);	
}

function callback_dsk_midi(info){
	chrome.sockets.tcp.close(socket_midi, function clb(){chrome.sockets.tcp.create({}, createInfo_midi);});
}

function createInfo(info){
	socket = info.socketId;
	
	console.log(ipaddr);

	chrome.sockets.tcp.connect(socket,ipaddr,23, callback_sck);
	
	
}
function createInfo_midi(info){
	socket_midi = info.socketId;
	chrome.sockets.tcp.connect(socket_midi,ipaddr,123, callback_sck_midi);
	
}



function callback_sck(result){
	if(!result){
		terminal.io.println("connected");
   		connected = 1;
		w2ui['toolbar'].get('connect').text = 'Disconnect';
		w2ui['toolbar'].refresh();
		setTimeout(start_conf, 200);	
		populateMIDISelects();
	}

}

function callback_sck_midi(info){
	
}

var onReceive = function(info) {
  if (info.socketId !== socket)
    return;
  console.log(info.data);
};

function reconnect(){
	send_command('tterm start\r');
}


var check_cnt=0;
function midi_socket_ckeck(info){
	if(info.connected==false){
		reconnect_midi();
	}
}

function telnet_socket_ckeck(info){
	if(info.connected==false){
		reconnect_tel();
	}
}

function mergeTypedArraysUnsafe(a, b) {
    var c = new a.constructor(a.length + b.length);
    c.set(a);
    c.set(b, a.length);

    return c;
}

const byt = 29*2;
var sid_marker = new Uint8Array([0xFF,0xFF,0xFF,0xFF]);
var frame_cnt=byt
var frame_cnt_old=0;
var flow_ctl=1;
function refresh_UI(){
	

	if(connected){
		response_timeout--;
	
		if(response_timeout==0){
			response_timeout=TIMEOUT;
			terminal.io.println('Connection lost, reconnecting...');
	
			reconnect();
			chrome.sockets.tcp.getInfo(socket_midi, midi_socket_ckeck);
			chrome.sockets.tcp.getInfo(socket, telnet_socket_ckeck);

			
		}
		
		wd_reset--;
		if(wd_reset==0){
			wd_reset=WD_TIMEOUT;
			if(connected==2){
				chrome.serial.send(connid, wd_reset_msg, sendcb);
			}
			if(connected==1){
				if(socket_midi){
					//chrome.sockets.tcp.send(socket_midi, wd_reset_msg, sendmidi);
				}
			}
		}
		
		
	}
	
	blink++;
	if(blink>25){
		blink=0;
		if(coil_hot_led){
			cycle_led=!cycle_led;
			nano_led(simpleIni.nano.killreset,cycle_led);
		}
	}
	meters.refresh();
	
	if(sid_state==2 && flow_ctl==1){
		if(connected==1){
			if(socket_midi){
				
				chrome.sockets.tcp.send(socket_midi, sid_file_marked.slice(frame_cnt_old,frame_cnt), sendmidi);

			}
			//console.log(sid_file_marked.slice(frame_cnt_old,frame_cnt));
			frame_cnt_old=frame_cnt;
			frame_cnt+=byt;
			if(frame_cnt>sid_file_marked.byteLength){
				sid_state=0;
				frame_cnt=byt;
				frame_cnt_old=0;
				console.log("finished");
			}

		}
	}
	
}

function sendcb(info){
	//console.log(info);
   //println("send " + info.bytesSent + " bytes");
   //println("error: " + info.error);
}

function sendtel(info){
	//if(info.result<0){
	//	reconnect_tel();
	//	console.log("Telnet_Reconnect");
	//}
   //println("send " + info.bytesSent + " bytes");
   //println("error: " + info.error);
}

function sendmidi(info){

	//if(info.result<0){
	//	reconnect_midi();
	//	console.log("MIDI_Reconnect");
	//}
   //println("send " + info.bytesSent + " bytes");
   //println("error: " + info.error);
}

 
// Initialize player and register event handler
var Player = new MidiPlayer.Player(processMidiFromPlayer);


function processMidiFromPlayer(event){
	if(playMidiData(event.bytes_buf)){
		midi_state.progress=Player.getSongPercentRemaining();
		redrawTop();
	} else if(!simulated && !connected) {
		Player.stop();
		midi_state.state = 'stopped';
		scripting.onMidiStopped();
	}
}
var expectedByteCounts = {
	0x80: 3,
	0x90: 3,
	0xA0: 3,
	0xB0: 3,
	0xC0: 2,
	0xD0: 2,
	0xE0: 3
};

function playMidiData(data) {
	var firstByte = data[0];
	if ((simulated || connected) && data[0] != 0x00) {
		var expectedByteCount = expectedByteCounts[firstByte & 0xF0];
		if (expectedByteCount && expectedByteCount<data.length) {
			data = data.slice(0, expectedByteCount)
		}
		var msg=new Uint8Array(data);
		if (!midiServer.sendMidiData(msg)) {
			midiOut.send(msg);
		}
		return true;
	} else {
		return false;
	}
}

terminal.onTerminalReady = function() {
  // Create a new terminal IO object and give it the foreground.
  // (The default IO object just prints warning messages about unhandled
  // things to the the JS console.)
  const io = terminal.io.push();

  processInput = send_command;
  io.onVTKeystroke = processInput;

  io.sendString = processInput;

  io.onTerminalResize = (columns, rows) => {
    // React to size changes here.
    // Secure Shell pokes at NaCl, which eventually results in
    // some ioctls on the host.
  };

  // You can call io.push() to foreground a fresh io context, which can
  // be uses to give control of the terminal to something else.  When that
  // thing is complete, should call io.pop() to restore control to the
  // previous io object.
};

const TT_GAUGE = 1;
const TT_GAUGE_CONF = 2;
const TT_CHART = 3;
const TT_CHART_DRAW = 4;
const TT_CHART_CONF = 5;
const TT_CHART_CLEAR = 6;
const TT_CHART_LINE = 7;
const TT_CHART_TEXT = 8;
const TT_CHART_TEXT_CENTER = 9;


const TT_UNIT_NONE = 0;
const TT_UNIT_V = 1;
const TT_UNIT_A = 2;
const TT_UNIT_W = 3;
const TT_UNIT_Hz = 4;
const TT_UNIT_C = 5;


const TT_STATE_IDLE = 0;
const TT_STATE_FRAME = 1
const TT_STATE_COLLECT = 3

const TT_STATE_GAUGE = 10;

var term_state=0;

var chart_cnt = 0;
var chart_scale_cnt =1;

var tterm = [];

var meas_backbuffer = [];
var meas = [];

const DATA_TYPE = 0;
const DATA_LEN = 1;
const DATA_NUM = 2;


function compute(dat){
	
	switch(dat[DATA_TYPE]){
		case TT_GAUGE:
			meters.value(dat[DATA_NUM], helper.bytes_to_signed(dat[3],dat[4]));
		break;
		case TT_GAUGE_CONF:
			var gauge_num = dat[2].valueOf();
			var gauge_min = helper.bytes_to_signed(dat[3],dat[4]);
			var gauge_max = helper.bytes_to_signed(dat[5],dat[6]);
			dat.splice(0,7);
			var str = helper.convertArrayBufferToString(dat);
			meters.text(gauge_num, str);
			meters.range(gauge_num, gauge_min, gauge_max);
		break;
		case TT_CHART_CONF:
		
			var chart_num = dat[2].valueOf();
			tterm[chart_num].min = helper.bytes_to_signed(dat[3],dat[4]);
			tterm[chart_num].max = helper.bytes_to_signed(dat[5],dat[6]);
			if(tterm[chart_num].min<0){
				tterm[chart_num].span=((tterm[chart_num].min*-1)+tterm[chart_num].max);
			}else{
				tterm[chart_num].span=(tterm[chart_num].max-tterm[chart_num].min);
			}
			tterm[chart_num].count_div=tterm[chart_num].span/5
			tterm[chart_num].offset = helper.bytes_to_signed(dat[7],dat[8]);
			switch(dat[9]){
				case TT_UNIT_NONE:
					tterm[chart_num].unit = '';
				break;
				case TT_UNIT_V:
					tterm[chart_num].unit = 'V';
				break;
				case TT_UNIT_A:
					tterm[chart_num].unit = 'A';
				break;
				case TT_UNIT_W:
					tterm[chart_num].unit = 'W';
				break;
				case TT_UNIT_Hz:
					tterm[chart_num].unit = 'Hz';
				break;
				case TT_UNIT_C:
					tterm[chart_num].unit = '°C';
				break;
			}
			dat.splice(0,10);
			tterm[chart_num].name = helper.convertArrayBufferToString(dat);
			redrawInfo();
			redrawMeas();
			
		break;		
		case TT_CHART:
			var val=helper.bytes_to_signed(dat[3],dat[4]);
			var chart_num= dat[DATA_NUM].valueOf();
			tterm[chart_num].value_real = val;
			tterm[chart_num].value=(1/tterm[chart_num].span) *(val-tterm[chart_num].offset);
			if(tterm[chart_num].value > 1) tterm[chart_num].value = 1;
			if(tterm[chart_num].value < -1) tterm[chart_num].value = -1;
		break;
		case TT_CHART_DRAW:
			if(draw_mode==1){
				chart_cls();
				draw_grid();
				redrawTrigger();
				redrawMeas();
				
				draw_mode=0;
			}
			if(tterm.trigger==-1){
				plot();
			}else{
				var triggered = math.sgn(tterm.trigger_lvl)==math.sgn(tterm[tterm.trigger].value - tterm.trigger_lvl);
				switch(tterm.trigger_block){
					case 0:
						if(plot.xpos==11 && triggered){
							tterm.trigger_block=1;
						}
					break;
					case 1:
						if(tterm.trigger_trgt || triggered){
							tterm.trigger_trgt=1;
							plot();
						}
						if(tterm.trigger_trgt!=tterm.trigger_old) redrawMeas();
						tterm.trigger_old = tterm.trigger_trgt;
					
					break;
				}

			}
		break;
		case TT_CHART_CLEAR:
			chart_cls();
			draw_mode=1;
		break;
		case TT_CHART_LINE:
			var x1 = helper.bytes_to_signed(dat[2],dat[3]);
			var y1 = helper.bytes_to_signed(dat[4],dat[5]);
			var x2 = helper.bytes_to_signed(dat[6],dat[7]);
			var y2 = helper.bytes_to_signed(dat[8],dat[9]);
			var color = dat[10].valueOf();
			ctx.beginPath();
			ctx.lineWidth = pixel;
			ctx.strokeStyle = wavecolor[color];
			ctx.moveTo(x1,y1);
			ctx.lineTo(x2,y2);
			ctx.stroke();
		
		break;
		case TT_CHART_TEXT:
			var x = helper.bytes_to_signed(dat[2],dat[3]);
			var y = helper.bytes_to_signed(dat[4],dat[5]);
			var color = dat[6].valueOf();
			var size = dat[7].valueOf();
			if(size<6) size=6;
			dat.splice(0,8);
			var str = helper.convertArrayBufferToString(dat);
			ctx.font = size + "px Arial";
			ctx.textAlign = "left";
			ctx.fillStyle = wavecolor[color];
			ctx.fillText(str,x, y);
		break;
		case TT_CHART_TEXT_CENTER:
			var x = helper.bytes_to_signed(dat[2],dat[3]);
			var y = helper.bytes_to_signed(dat[4],dat[5]);
			var color = dat[6].valueOf();
			var size = dat[7].valueOf();
			if(size<6) size=6;
			dat.splice(0,8);
			var str = helper.convertArrayBufferToString(dat);
			ctx.font = size + "px Arial";
			ctx.textAlign = "center";
			ctx.fillStyle = wavecolor[color];
			ctx.fillText(str,x, y);
		break;
		
	}
}

function chart_cls(){
	var ctxb = waveback.getContext('2d');
	ctxb.clearRect(0, 0, waveback.width, waveback.height);
	ctx.clearRect(0, 0, waveback.width, waveback.height);
	
}


function receive(info){
	
	if(info.socketId==socket_midi){
		var buf = new Uint8Array(info.data);
		if(buf[0]==0x78){
			flow_ctl=0;
		}
		if(buf[0]==0x6f){
			flow_ctl=1;
		}
	}
	
	if (info.socketId!=socket) {
		return;
	}

	var buf = new Uint8Array(info.data);
	var txt = '';
	
	response_timeout = TIMEOUT;
	check_cnt=0;
	
	for (var i = 0; i < buf.length; i++) {
		
			
		switch(term_state){
			case TT_STATE_IDLE:
				if(buf[i]== 0xff){
					term_state = TT_STATE_FRAME;
				}else{
					var str = String.fromCharCode.apply(null, [buf[i]]);
					terminal.io.print(str);
				}
			break;
				
			case TT_STATE_FRAME:
				receive.buffer[DATA_LEN]=buf[i];
				receive.bytes_done=0;
				term_state=TT_STATE_COLLECT;
			break;
			
			case TT_STATE_COLLECT:
				
				if(receive.bytes_done==0){
					receive.buffer[0] = buf[i];
					receive.bytes_done++;
					break;
				}else{
					
					if(receive.bytes_done<receive.buffer[DATA_LEN]-1){
						receive.buffer[receive.bytes_done+1]=buf[i]
						receive.bytes_done++;
					}else{
						receive.buffer[receive.bytes_done+1]=buf[i];
						receive.bytes_done=0;
						term_state=TT_STATE_IDLE;
						compute(receive.buffer);
						receive.buffer=[];
					}
				}
				
			break;
	

		}
	}
}
receive.buffer = [];
receive.bytes_done = 0;

function connected_cb(connectionInfo){
	if(connectionInfo.connectionId){
   	terminal.io.println("connected");
   	connid = connectionInfo.connectionId;
		connected = 2;
		w2ui['toolbar'].get('connect').text = 'Disconnect';
		w2ui['toolbar'].refresh();
		start_conf();	
	}
};

function start_conf(){
	send_command('\r');
	send_command('set pw 0\r');
	send_command('set pwd 50000\r');
	send_command('kill reset\rtterm start\rcls\r');
	
}

function getdevs(devices){
   for (var i = 0; i < devices.length; i++) {
      if((devices[i].displayName && devices[i].displayName.indexOf("STMBL") > -1) || (devices[i].vendorId && devices[i].vendorId == 1204 && devices[i].productId && devices[i].productId == 62002)){
		path = devices[i].path;
        terminal.io.println("Connecting to " + devices[i].path);
        chrome.serial.connect(devices[i].path, connected_cb);
        return;
      }
      terminal.io.println(devices[i].path + ' ' + devices[i].displayName + ' ' + devices[i].vendorId + ' ' + devices[i].productId );
   }
   
   var test = w2ui['toolbar'].get('port');
   
   if(test.value){
		terminal.io.println('UD3 not found connect to: '+ test.value);
		chrome.serial.connect(test.value, connected_cb);
   }else{
	   terminal.io.println('No COM specified trying COM12');
	   chrome.serial.connect('COM12', connected_cb);
   }
   

}

function disconnected_cb(){
	terminal.io.println('\r\nDisconnected');
}

function connect(){
	var port = w2ui['toolbar'].get('port');
	if(connected){
		send_command('tterm stop\rcls\r');
		setTimeout(()=>{
			if(connected==2) chrome.serial.disconnect(connid,disconnected_cb);
			if(connected==1){
				chrome.sockets.tcp.disconnect(socket, disconnected_cb_tel);
				chrome.sockets.tcp.disconnect(socket_midi, disconnected_cb_midi);
			}
			w2ui['toolbar'].get('connect').text = 'Connect';
			w2ui['toolbar'].refresh();
			connected= 0;
		}, 200);
	}else{
		
		if(String(port.value).includes(".")){
			ipaddr=String(port.value);
			terminal.io.println("\r\nConnect: "+ ipaddr);
			connect_ip();
			
		}else{
			terminal.io.println("\r\nConnect: Serial");
			chrome.serial.getDevices(getdevs);
		}
	}
}



function disconnected_cb_tel(){
	chrome.sockets.tcp.close(socket,function clb(){});
	terminal.io.println('\r\nDisconnected');
}

function disconnected_cb_midi(){
	chrome.sockets.tcp.close(socket_midi,function clb(){});
}

function error(info){
	terminal.io.println(info.error);
	//disconnect();
}


function clear(){
	terminal.io.print('\033[2J\033[0;0H');
	send_command('cls\r');

}


const meas_space = 20;
var meas_position = 4;
const info_space = 150;
const control_space = 15;
const top_space = 20;
const TRIGGER_SPACE = 10;

function redrawInfo(){

  //var ctx = wavecanvas.getContext('2d');
  var x_res = wavecanvas.width;
  var y_res = wavecanvas.height;
  var line_height = 32;
  var trigger_symbol = "";
  ctx.clearRect(x_res - info_space, 0, x_res, y_res - meas_space);
  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  var tterm_length = tterm.length;
  for (var i = 0; i < tterm_length; i++){
    if (tterm[i].name){
      ctx.fillStyle = wavecolor[i];
      if(i == tterm.trigger){
        trigger_symbol = "->";
      }
      ctx.fillText(trigger_symbol + "w" + i + ": " + tterm[i].name,x_res - info_space + 4, line_height * (i+1));
	  ctx.fillText(tterm[i].count_div +' '+ tterm[i].unit +'/div',x_res - info_space + 4, (line_height * (i+1))+16);
      trigger_symbol = "";
    }
  }
}

function calc_meas(){
	for(var i = 0;i<meas_backbuffer.length;i++){
		meas[i].min = meas_backbuffer[i].min.toFixed(2);
		meas[i].max = meas_backbuffer[i].max.toFixed(2);
		meas[i].avg = Math.sqrt(meas_backbuffer[i].avg_sum / meas_backbuffer[i].avg_samp).toFixed(2);

	}
	
	
}



function plot(){

   var x_res = wavecanvas.width-info_space;
   var y_res = wavecanvas.height-meas_space-top_space;

	

  	ctx.clearRect(plot.xpos, top_space, pixel, y_res);

	for(var i = 0;i<tterm.length;i++){
		//Meas
		if(tterm[i].value_real < meas_backbuffer[i].min) meas_backbuffer[i].min = tterm[i].value_real;
		if(tterm[i].value_real > meas_backbuffer[i].max) meas_backbuffer[i].max = tterm[i].value_real;
		meas_backbuffer[i].avg_sum += (tterm[i].value_real*tterm[i].value_real);
		meas_backbuffer[i].avg_samp++;
		//Meas
		
		
		var ypos = (tterm[i].value*-1+1)*(y_res/2.0);
		if(plot.ypos[i] && (plot.ypos[i] != (y_res/2.0) || tterm[i].value)){
			ctx.beginPath();
			ctx.lineWidth = pixel;
			ctx.strokeStyle = wavecolor[i];
			ctx.moveTo(plot.xpos,plot.ypos[i]+top_space);
			ctx.lineTo(plot.xpos+pixel,ypos+top_space);
			ctx.stroke();
		}
		plot.ypos[i] = ypos;//save previous position
	}

	plot.xpos+=pixel;
	if(plot.xpos>=x_res){
		calc_meas();
		tterm.trigger_trgt=0;
		tterm.trigger_block=0;
		redrawMeas();
		plot.xpos = TRIGGER_SPACE+1;
		
	}
}
plot.xpos = TRIGGER_SPACE+1;
plot.ypos = [];

function redrawMeas(){

  var ctx = wavecanvas.getContext('2d');
  var x_res = wavecanvas.width;
  var y_res = wavecanvas.height;
  ctx.clearRect(TRIGGER_SPACE, y_res - meas_space, x_res - info_space, y_res);

  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = "white"
  if(tterm.trigger!=-1){
	ctx.fillText("Trg lvl: " + tterm.trigger_lvl ,TRIGGER_SPACE, y_res - meas_position);
	var state='';
	if(tterm.trigger_trgt){
		state='Trg...'
	}else{
		state='Wait...'
	}
	ctx.fillText("Trg state: " +state ,TRIGGER_SPACE+100, y_res - meas_position);
  }else{
	ctx.fillText("Trg lvl: off" ,TRIGGER_SPACE, y_res - meas_position);
  }
  var text_pos = TRIGGER_SPACE+180;
  for(i=0;i<NUM_GAUGES;i++){
	if (tterm[i].name){
		ctx.fillStyle = wavecolor[i];
		ctx.fillText("Min: " +meas[i].min ,text_pos+=60, y_res - meas_position);
		ctx.fillText("Max: " +meas[i].max ,text_pos+=60, y_res - meas_position);
		ctx.fillText("Avg: "+meas[i].avg ,text_pos+=60, y_res - meas_position);
	}
  }
  
}

function redrawTop(){
	var x_res = wavecanvas.width;
	var y_res = wavecanvas.height;
	ctx.clearRect(TRIGGER_SPACE, 0, x_res - info_space, top_space);

	ctx.font = "12px Arial";
	ctx.textAlign = "left";
	ctx.fillStyle = "white"

	ctx.fillText("MIDI-File: " + midi_state.file + ' State: ' + midi_state.state + ' ' + midi_state.progress + '% / 100%'  ,TRIGGER_SPACE, 12);
 
  
}



function draw_grid(){
	var x_res = wavecanvas.width-info_space;
	var y_res = wavecanvas.height-meas_space-top_space;

	var ctxb = waveback.getContext('2d');
	ctxb.beginPath();
	ctxb.strokeStyle= "yellow";
	ctxb.lineWidth = pixel;

	ctxb.moveTo(TRIGGER_SPACE, Math.floor(y_res/2)+top_space);
	ctxb.lineTo(x_res, Math.floor(y_res/2)+top_space);

	ctxb.stroke();

	ctxb.beginPath();
	ctxb.lineWidth = pixel;
	ctxb.strokeStyle= "yellow";
	ctxb.moveTo(TRIGGER_SPACE+1, top_space);
	ctxb.lineTo(TRIGGER_SPACE+1, y_res+top_space);
	ctxb.stroke();
	ctxb.beginPath();
	ctxb.lineWidth = pixel;
	ctxb.strokeStyle= "grey";
	for(var i = TRIGGER_SPACE+draw_grid.grid; i < x_res; i=i+draw_grid.grid){
		ctxb.moveTo(i, top_space);
		ctxb.lineTo(i, y_res+top_space);
	}

	for(i = (y_res/2)+(y_res/10); i < y_res; i=i+(y_res/10)){
		ctxb.moveTo(TRIGGER_SPACE, i+top_space);
		ctxb.lineTo(x_res, i+top_space);
		ctxb.moveTo(TRIGGER_SPACE, y_res -i+top_space);
		ctxb.lineTo(x_res, y_res -i+top_space);
	}

   ctxb.stroke();	
}
draw_grid.grid=50;




function resize(){
	
	plot.xpos = TRIGGER_SPACE+1;
	wavecanvas.style.width=(90-control_space)+'%';
	wavecanvas.style.height='100%';
	wavecanvas.width  = wavecanvas.offsetWidth;
	wavecanvas.height = wavecanvas.offsetHeight;
	waveback.style.width=(90-control_space)+'%';
	waveback.style.height='100%';
	waveback.width  = wavecanvas.offsetWidth;
	waveback.height = wavecanvas.offsetHeight;
	//HiDPI display support
	if(window.devicePixelRatio){
		pixel = window.devicePixelRatio;
		var height = wavecanvas.getAttribute('height');
		var width = wavecanvas.getAttribute('width');
		// reset the canvas width and height with window.devicePixelRatio applied
		wavecanvas.setAttribute('width', Math.round(width * window.devicePixelRatio));
		wavecanvas.setAttribute('height', Math.round( height * window.devicePixelRatio));
		waveback.setAttribute('width', Math.round(width * window.devicePixelRatio));
		waveback.setAttribute('height', Math.round( height * window.devicePixelRatio));
		// force the canvas back to the original size using css
		wavecanvas.style.width = width+"px";
		wavecanvas.style.height = height+"px";
		waveback.style.width = width+"px";
		waveback.style.height = height+"px";
	}
	if(draw_mode!=1){
		draw_grid();
		redrawTrigger();
		redrawMeas();
	}
}

function send_command(command){
	if(connected==2){

		chrome.serial.send(connid, helper.convertStringToArrayBuffer(command), sendcb);

	}
	if(connected==1){
		chrome.sockets.tcp.send(socket, helper.convertStringToArrayBuffer(command), sendtel);
	}
}

function readmidi(file){

	var fs = new FileReader();
	fs.readAsArrayBuffer(file);
	fs.onload = event_read_midi;
	
}
var simpleIni;

function readini(file){
	/*chrome.runtime.getPackageDirectoryEntry(function(root) {
	root.getFile("config.ini", {}, function(fileEntry) {
    fileEntry.file(function(file) {
      var reader = new FileReader();
      reader.onloadend = event_read_ini;
      reader.readAsText(file);
    }, errorHandler);
  }, errorHandler);
});*/


	/*
	var fs = new FileReader();
	fs.readAsArrayBuffer(file);
	fs.onload = event_read_ini;
	*/
}

function errorHandler(result){
	
}

function event_read_midi(progressEvent){

	Player.loadArrayBuffer(progressEvent.srcElement.result);

}


function event_read_ini(ev){
	var inicontent=this.result;
	simpleIni = new SimpleIni(function() { 
        return inicontent;
    });
	
	
	if(simpleIni.general.port){
		
		w2ui['toolbar'].get('port').value = simpleIni.get('general.port');
		
		w2ui['toolbar'].refresh();
   }
   if(simpleIni.general.autoconnect=="true"){
	   connect();
   }
   
}

function loadMidiFile(file) {
	w2ui['toolbar'].get('mnu_midi').text = 'MIDI-File: '+file.name;
	w2ui['toolbar'].refresh();
	midi_state.file = file.name;
	readmidi(file);
}

function loadSIDFile(file) {
	w2ui['toolbar'].get('mnu_midi').text = 'SID-File: '+file.name;
	w2ui['toolbar'].refresh();
	midi_state.file = file.name;
	readSID(file);
}

function readSID(file){
	var fs = new FileReader();
	fs.readAsArrayBuffer(file);
	fs.onload = event_read_SID;
}
var sid_file_marked;
var sid_state=0;
function event_read_SID(progressEvent){
	var cnt=0;
	var sid_file = new Uint8Array(progressEvent.srcElement.result.byteLength + ((progressEvent.srcElement.result.byteLength/25)*4));
	var source_cnt=0;
	var file = new Uint8Array(progressEvent.srcElement.result)
	sid_file[cnt++] = 0xFF;
	sid_file[cnt++] = 0xFF;
	sid_file[cnt++] = 0xFF;
	sid_file[cnt++] = 0xFF;
	
	
	while(source_cnt<file.byteLength){
		sid_file[cnt++]=file[source_cnt++];
		if(!(source_cnt%25)){
			sid_file[cnt++] = 0xFF;
			sid_file[cnt++] = 0xFF;
			sid_file[cnt++] = 0xFF;
			sid_file[cnt++] = 0xFF;
		}
	}
	sid_file_marked=sid_file;
	sid_state=1;
	
}



function startCurrentMidiFile() {
	Player.play();
	nano_led(simpleIni.nano.play,1);
	nano_led(simpleIni.nano.stop,0);
	midi_state.state = 'playing';
	redrawTop();
}

function stopMidiFile() {
	nano_led(simpleIni.nano.play,0);
	nano_led(simpleIni.nano.stop,1);
	Player.stop();
	midi_state.state = 'stopped';
	redrawTop();
	stopMidiOutput();
	scripting.onMidiStopped();
}

function ondrop(e){
   e.stopPropagation();
   e.preventDefault();
   if(e.dataTransfer.items.length == 1){//only one file
		sid_state=0;
   		const file = e.dataTransfer.files[0];
		const extension = file.name.substring(file.name.lastIndexOf(".")+1);
		if (extension==="mid"){
			loadMidiFile(file);
		} else if (extension=="js") {
			scripting.loadScript(file.path)
				.then((script)=> {
					currentScript = script;
					w2ui['toolbar'].get('mnu_script').text = 'Script: '+file.name;
					w2ui['toolbar'].refresh();
				})
				.catch((err)=>{
					terminal.io.println("Failed to load script: "+err);
					console.log(err);
				});
		}else if (extension=="dmp") {
			loadSIDFile(file);
		}
   }
}

function ondragover(e){
   e.stopPropagation();
   e.preventDefault();
   e.dataTransfer.dropEffect = 'copy';
}

function warn_energ() {
    w2confirm('WARNING!<br>The coil will be energized.')
    .no(function () { })
	.yes(function () { send_command('bus on\r'); });
}

function warn_eeprom_save() {
    w2confirm('WARNING!<br>Are you sure to save the configuration to EEPROM?')
    .no(function () { })
	.yes(function () { send_command('eeprom save\r'); });
}
function warn_eeprom_load() {
    w2confirm('WARNING!<br>Are you sure to load the configuration from EEPROM?')
    .no(function () { })
	.yes(function () { send_command('eeprom load\r'); });
}

function wave_mouse_down(e){
	var pos_y = e.y - 51;
	var y_res = wavecanvas.height-meas_space-top_space;
	if((pos_y>=top_space && pos_y<=wavecanvas.height-meas_space) && tterm.trigger!=-1){
		pos_y-=top_space;
		tterm.trigger_lvl=((2/y_res)*((y_res/2)-pos_y)).toFixed(2);
		tterm.trigger_lvl_real=tterm.trigger_lvl*tterm[tterm.trigger].span;
		console.log(tterm.trigger_lvl_real);
		redrawMeas();
		redrawTrigger();
	}
}

function nano_led(num,val){
	var uint8 = new Uint8Array(3);
	if(nano_out != null){
		if(val>0){
			uint8[0]=157;
			uint8[1]=num;
			uint8[2]=127;
			nano_out.send(uint8);
		}else{
			uint8[0]=141;
			uint8[1]=num;
			uint8[2]=0;
			nano_out.send(uint8);
		}
	}
}

function setSliderValue(name, value, slider = undefined) {
	if (!slider) {
		slider = document.getElementById(name);
	}
	if (value<slider.min||value>slider.max) {
		terminal.io.println("Tried to set slider \""+slider.id+"\" out of range (To "+value+")!");
		value = Math.min(slider.max, Math.max(slider.min, value));
	}
	slider.value = value;
}

function ontimeSliderMoved(){
	if (ontimeUI.relativeSelect.checked) {
		setRelativeOntime(parseInt(ontimeUI.slider.value));
	} else {
		setAbsoluteOntime(parseInt(ontimeUI.slider.value));
	}
}

function ontimeChanged() {
	ontimeUI.totalVal = Math.round(ontimeUI.absoluteVal*ontimeUI.relativeVal/100.);
	send_command('set pw ' + ontimeUI.totalVal + '\r');
	updateOntimeLabels();
}

function setAbsoluteOntime(time) {
	if (!ontimeUI.relativeSelect.checked) {
		setSliderValue(null, time, ontimeUI.slider);
	}
	time = Math.min(maxOntime, Math.max(0, time));
	ontimeUI.absolute.textContent = ontimeUI.absoluteVal = time;
	ontimeChanged();
}

function setRelativeOntime(percentage) {
	if (ontimeUI.relativeSelect.checked) {
		setSliderValue(null, percentage, ontimeUI.slider);
	}
	percentage = Math.min(100, Math.max(0, percentage));
	ontimeUI.relative.textContent = ontimeUI.relativeVal = percentage;
	midiServer.sendRelativeOntime(ontimeUI.relativeVal);
	ontimeChanged();
}

function updateOntimeLabels() {
	if (ontimeUI.relativeSelect.checked) {
		ontimeUI.relative.innerHTML = "<b>"+ontimeUI.relativeVal+"</b>";
		ontimeUI.absolute.innerHTML = ontimeUI.absoluteVal;
	} else {
		ontimeUI.absolute.innerHTML = "<b>"+ontimeUI.absoluteVal+"</b>";
		ontimeUI.relative.innerHTML = ontimeUI.relativeVal;
	}
	ontimeUI.total.innerHTML = ontimeUI.totalVal;
}

function onRelativeOntimeSelect() {
	if (ontimeUI.relativeSelect.checked) {
		ontimeUI.slider.max = 100;
		ontimeUI.slider.value = ontimeUI.relativeVal;
	} else {
		ontimeUI.slider.max = maxOntime;
		ontimeUI.slider.value = ontimeUI.absoluteVal;
	}
	updateOntimeLabels();
}

function slider1(){
	var slider = document.getElementById('slider1');
	var slider_disp = document.getElementById('slider1_disp');
	var pwd = Math.floor(1/slider.value*1000000);
	slider_disp.innerHTML = slider.value + ' Hz';
	send_command('set pwd ' + pwd + '\r');
}

function setBPS(bps){
	setSliderValue("slider1", bps);
	slider1();
}

function slider2(){
	var slider = document.getElementById('slider2');
	var slider_disp = document.getElementById('slider2_disp');
	slider_disp.innerHTML = slider.value + ' ms';
	send_command('set bon ' + slider.value + '\r');
}

function setBurstOntime(time){
	setSliderValue("slider2", time);
	slider2();
}

function slider3(){
	var slider = document.getElementById('slider3');
	var slider_disp = document.getElementById('slider3_disp');
	slider_disp.innerHTML = slider.value + ' ms';
	send_command('set boff ' + slider.value + '\r');
}

function setBurstOfftime(time){
	setSliderValue("slider3", time);
	slider3();
}

function redrawTrigger(){
  var ctx = wavecanvas.getContext('2d');
  var x_res = wavecanvas.width;
  var y_res = wavecanvas.height-meas_space-top_space;
  var ytrgpos = Math.floor((tterm.trigger_lvl*-1+1)*(y_res/2.0))+top_space;
  ctx.clearRect(0, 0, 10, wavecanvas.height);
	if(tterm.trigger!=-1){
		tterm.trigger_block=1;
		ctx.beginPath();
		ctx.lineWidth = pixel;
		ctx.strokeStyle = wavecolor[tterm.trigger];
		ctx.moveTo(0, ytrgpos);
		ctx.lineTo(10, ytrgpos);
		ctx.moveTo(10, ytrgpos);
		if(tterm.trigger_lvl>0){
			ctx.lineTo(5, ytrgpos-2);
		}else{
			ctx.lineTo(5, ytrgpos+2);
		}
		ctx.stroke();
		ctx.font = "12px Arial";
		ctx.textAlign = "center";
		ctx.fillStyle = wavecolor[tterm.trigger];
    if(ytrgpos < 14){
      ctx.fillText(tterm.trigger,4,ytrgpos+12);
    }else{
      ctx.fillText(tterm.trigger,4,ytrgpos-4);
    }
  }
}

var selectMidiIn = null;
var selectMidiOut = null;
var midiAccess = null;
var midiIn = {cancel: (reason)=>{}, isActive: ()=>false, source: ""};
var midiOut = {send: (data)=>{}, dest: ""};
var nano=null;
var nano_out=null;

function onSelectMidiIn(ev ) {
  const selected = selectMidiIn.selectedIndex;
  var id = selectMidiIn[selected].value;
  if (id!=midiIn.source) {
	  if (midiIn.isActive())
		midiIn.cancel(null);

	  selectMidiIn.selectedIndex = selected;
	  if (id=="<Network>") {
		midiServer.requestName()
			.then(()=>term_ui.inputIpAddress("Please enter the remote IP address", "MIDI over IP", true, true))
			.then(enterFilterForMidi)
			.catch((err)=>{
				console.log("Caught something!", err);
				setMidiInAsNone();
			});
	  } else if (id) {
		var midiSource;
		if ((typeof(midiAccess.inputs) == "function"))   //Old Skool MIDI inputs() code
		  midiSource = midiAccess.inputs()[id];
		else
		  midiSource = midiAccess.inputs.get(id);
		setMidiInToPort(midiSource);
	  } else {
		setMidiInAsNone();
	  }
  }
}

function setMidiInAsNone() {
	if (midiIn.isActive()) {
		midiIn.cancel(null);
	}
	midiIn = {
		isActive: () => false,
		cancel: (arg) => setMidiInAsNone(),
		data: null,
		source: ""
	};
	selectMidiIn.selectedIndex = 0;
	populateMIDISelects();
}

function setMidiInToPort(source) {
	source.onmidimessage = midiMessageReceived;
	var canceled = false;
	midiIn = {
		cancel: (arg) => {
			source.onmidimessage = null;
			canceled = true;
			setMidiInAsNone();
		},
		isActive: () => (!canceled && source.state != "disconnected"),
		source: source.id,
		data: null
	};
	populateMIDISelects();
}


function enterFilterForMidi(result) {
	term_ui.inputStrings("Please enter the filters", "MIDI filters", (channel, note)=>{
		const filterChannel = helper.parseFilter(channel);
		if (filterChannel==null) {
			return 0;
		}
		const filterNote = helper.parseFilter(note);
		if (filterNote==null) {
			return 1;
		}
		return -1;
	}, ["Channel", "Note"])
		.then(filter=>setMidiInToNetwork(result.ip, result.port, {channel: filter[0], note: filter[1]}));
}

function setMidiInToNetwork(ip, port, filter) {
	terminal.io.println("Connecting to MIDI server at "+ip+":"+port+"...");
	chrome.sockets.tcp.create({}, function(createInfo) {
		chrome.sockets.tcp.connect(createInfo.socketId,
			ip, port, s=>onMidiNetworkConnect(s, ip, port, createInfo.socketId, filter));
	});
}

function onMidiNetworkConnect(status, ip, port, socketId, filter) {
	var error = "Connection to MIDI server at "+ip+":"+port+" failed!";
	if (status>=0) {
		var connectListener = (info)=>{
			if (info.socketId != socketId)
				return;
			// info.data is an arrayBuffer.
			var name = helper.convertArrayBufferToString(info.data);
			chrome.sockets.tcp.onReceive.removeListener(connectListener);
			const data = name+";"+JSON.stringify(filter);
			chrome.sockets.tcp.send(socketId, helper.convertStringToArrayBuffer(data), s=>{
				if (s<0) {
					terminal.io.println(error);
					setMidiInAsNone();
				} else {
					terminal.io.println("Connected to MIDI server \""+name+"\" at "+ip+":"+port);
					var canceled = false;
					midiIn = {
						cancel: (reason) => {
							canceled = true;
							setMidiInAsNone();
							ontimeUI.setRelativeAllowed(true);
							if (reason) {
								terminal.io.println("Disconnected from MIDI server. Reason: " + reason);
							} else {
								chrome.sockets.tcp.send(socketId, helper.convertStringToArrayBuffer("C"),
									s=>chrome.sockets.tcp.close(socketId));
								terminal.io.println("Disconnected from MIDI server");
							}
						},
						isActive: () => !canceled,
						source: "<Network>",
						remote: name + " at " + ip + ":" + port,
						data: socketId
					};
					populateMIDISelects();
					ontimeUI.setRelativeAllowed(false);
				}
			});
		};
		chrome.sockets.tcp.onReceive.addListener(connectListener);
	} else {
		terminal.io.println(error);
		setMidiInAsNone();
	}
}

function onMIDIoverIP(info) {
	if (!midiIn.isActive() || info.socketId != midiIn.data)
		return;
	var data = new Uint8Array(info.data);
	let param = helper.convertArrayBufferToString(info.data).substring(1);
	switch (data[0]) {
		case 'M'.charCodeAt(0):
			playMidiData(data.slice(1, data.length));
			break;
		case 'C'.charCodeAt(0):
			midiIn.cancel(param);
			break;
		case 'L'.charCodeAt(0):
			midiServer.loopTest(param);
			break;
		case 'O'.charCodeAt(0):
			setRelativeOntime(data[1]);
			break;
	}
}

function onSelectMidiOut(ev) {
	const selected = selectMidiOut.selectedIndex;
	var id = selectMidiOut[selected].value;
	if (id!=midiOut.dest) {
		stopMidiOutput();
		if (id == "<Network>") {
			midiOut = {
				send: (data) => chrome.sockets.tcp.send(socket_midi, data, sendmidi)
			};
		} else if (id) {
			var midiSink;
			if ((typeof(midiAccess.outputs) == "function"))   //Old Skool MIDI inputs() code
				midiSink = midiAccess.outputs()[id];
			else
				midiSink = midiAccess.outputs.get(id);
			midiOut = {
				send: (data) => midiSink.send(data)
			};
		} else {
			midiOut = {
				send: (data) => {
				}
			};
		}
		midiOut.dest = id;
	}
}

function stopMidiOutput() {
	playMidiData([0xB0,0x7B,0x00]);
	console.log(midiOut);
}

function midi_start(){
	
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDIStarted, onMIDISystemError);
} else {
    alert("No MIDI support in your browser.");
}
	
}

function midiConnectionStateChange( e ) {
  console.log("connection: " + e.port.name + " " + e.port.connection + " " + e.port.state );
  populateMIDISelects();
}

function onMIDIStarted( midi ) {
  var preferredIndex = 0;

  midiAccess = midi;

  //document.getElementById("synthbox").className = "loaded";
  selectMidiIn=document.getElementById("midiIn");
  selectMidiIn.onchange = onSelectMidiIn;
  selectMidiOut=document.getElementById("midiOut");
  selectMidiOut.onchange = onSelectMidiOut;
  midi.onstatechange = midiConnectionStateChange;
  populateMIDISelects();
}

function onMIDISystemError( err ) {
  document.getElementById("synthbox").className = "error";
  console.log( "MIDI not initialized - error encountered:" + err.code );
}


function populateMIDISelects() {
	// clear the MIDI input select
	selectMidiIn.options.length = 0;

	addElementKeepingSelected("None", "", midiIn.source, selectMidiIn);
	let networkText = "Network";
	const networkId = "<Network>";
	if (midiIn.source==networkId) {
		networkText = midiIn.remote;
	}
	addElementKeepingSelected(networkText, networkId, midiIn.source, selectMidiIn);
	for (let input of midiAccess.inputs.values()) {
		var str = input.name.toString();
		var preferred = !midiIn.isActive() && ((str.indexOf("Tesla") != -1) || (str.toLowerCase().indexOf("keyboard") != -1));
		if (str.includes("nano")) {
			nano = input;
			nano.onmidimessage = midiMessageReceived;
		}
		addElementKeepingSelected(input.name, input.id, midiIn.source, selectMidiIn, preferred)
	}
	onSelectMidiIn(null);
	selectMidiOut.options.length = 0;
	addElementKeepingSelected("None", "", midiOut.dest, selectMidiOut);
	if (connected==1) {
		addElementKeepingSelected("UD3 over Ethernet", "<Network>", midiOut.dest, selectMidiOut);
	}
	for (let output of midiAccess.outputs.values()) {
		var str = output.name.toString();
		if (str.includes("nano")) {
			nano_out = output;
			nano_startup();
		} else {
			addElementKeepingSelected(str, output.id, midiOut.dest, selectMidiOut, str.indexOf("UD3")>=0);
		}
	}
	onSelectMidiOut(null);
}

function addElementKeepingSelected(name, id, oldId, selector, forceSelect = false) {
	var preferred = forceSelect || id == oldId;
	selector.appendChild(new Option(name, id, preferred, preferred));
}

function nano_startup(){
	nano_led(simpleIni.nano.killset,1);
	nano_led(simpleIni.nano.killreset,0);
	
	nano_led(simpleIni.nano.play,0);
	nano_led(simpleIni.nano.stop,1);
	
}

const maxOntime = 400;
const maxBPS = 1000;
const maxBurstOntime = 1000;
const maxBurstOfftime = 1000;

function midiMessageReceived( ev ) {
	if(!ev.currentTarget.name.includes("nano")){
		playMidiData(ev.data);
	} else {
		var cmd = ev.data[0] >> 4;
		var channel = ev.data[0] & 0xf;
		var noteNumber = ev.data[1];
		var velocity = ev.data[2];
			//console.log(ev);
		if (channel == 9)
			return

		if ( cmd==8 || ((cmd==9)&&(velocity==0)) ) { // with MIDI, note on with velocity zero is the same as note off
			// note off
			//noteOff( noteNumber );
			
		} else if (cmd == 9) {
		// note on
		//noteOn( noteNumber, velocity/127.0);


		switch(String(noteNumber)){
			case simpleIni.nano.play:
				nano_led(simpleIni.nano.play,1);
				nano_led(simpleIni.nano.stop,0);
				Player.play();
				midi_state.state = 'playing';
				redrawTop();
			break;
			case simpleIni.nano.stop:
				stopMidiFile();
			break;
			case simpleIni.nano.killset:
				coil_hot_led=0;
				nano_led(simpleIni.nano.killset,1);
				nano_led(simpleIni.nano.killreset,0);
				send_command('kill set\r');
			break;
			case simpleIni.nano.killreset:
				coil_hot_led=1;
				nano_led(simpleIni.nano.killset,0);
				nano_led(simpleIni.nano.killreset,1);
				send_command('kill reset\r');
			break;
		}
		console.log(noteNumber);
		} else if (cmd == 11) {
		//controller( noteNumber, velocity/127.0);
		switch(String(noteNumber)){
			case simpleIni.nano.slider0:
				setAbsoluteOntime(maxOntime*velocity/127.0);
			break;
			case simpleIni.nano.slider1:
				setBPS(maxBPS*velocity/127.0);
			break;
			case simpleIni.nano.slider2:
				setBurstOntime(maxBurstOntime*velocity/127.0);
			break;
			case simpleIni.nano.slider3:
				setBurstOfftime(maxBurstOfftime*velocity/127.0);
			break;
		}
		
		} else if (cmd == 14) {
		// pitch wheel
		//pitchWheel( ((velocity * 128.0 + noteNumber)-8192)/8192.0 );
		} else if ( cmd == 10 ) {  // poly aftertouch
		//polyPressure(noteNumber,velocity/127)
		} else{
			console.log( "" + ev.data[0] + " " + ev.data[1] + " " + ev.data[2])
		}
	}
}

function stopTransient() {
	send_command('tr stop\r');
}

function startTransient() {
	ontimeChanged();
	send_command('tr start\r');
}

document.addEventListener('DOMContentLoaded', function () {

	$(function () {
    $('#toolbar').w2toolbar({
        name: 'toolbar',
        items: [
		    { type: 'menu', id: 'mnu_command', text: 'Commands', icon: 'fa fa-table', items: [
                { text: 'BUS ON', icon: 'fa fa-bolt'},
				{ text: 'BUS OFF', icon: 'fa fa-bolt'},
				{ text: 'TR Start', icon: 'fa fa-bolt'},
				{ text: 'TR Stop', icon: 'fa fa-bolt'},
				{ text: 'Save EEPROM-Config', icon: 'fa fa-microchip'},
				{ text: 'Load EEPROM-Config', icon: 'fa fa-microchip'},
				{ text: 'Start MIDI server', id: 'startStopMidi', icon: 'fa fa-table'}
            ]},
			
			{ type: 'menu-radio', id: 'trigger_radio', icon: 'fa fa-star',
                text: function (item) {
                    var text = item.selected;
                    var el   = this.get('trigger_radio:' + item.selected);
					switch(item.selected){
						case 'waveoff':
							tterm.trigger=-1;
						break;
						case 'waveoid0':
							tterm.trigger=0;
						break;
						case 'waveoid1':
							tterm.trigger=1;
						break;
						case 'waveoid2':
							tterm.trigger=2;
						break;
						case 'waveoid3':
							tterm.trigger=3;
						break;
						case 'waveoid4':
							tterm.trigger=4;
						break;
						case 'waveoid5':
							tterm.trigger=5;
						break;
					}
					redrawMeas();
					redrawTrigger();
					redrawInfo();
                    return 'Trigger: ' + el.text;
                },
                selected: 'waveoff',
                items: [
					{ id: 'waveoff', text: 'Off'},
                    { id: 'waveoid0', text: 'Wave 0'},
					{ id: 'waveoid1', text: 'Wave 1'},
					{ id: 'waveoid2', text: 'Wave 2'},
					{ id: 'waveoid3', text: 'Wave 3'},
					{ id: 'waveoid4', text: 'Wave 4'},
					{ id: 'waveoid5', text: 'Wave 5'}
                ]
            },
			
			{ type: 'menu-radio', id: 'trigger_opt', icon: 'fa fa-star',
                text: function (item) {
                    var text = item.selected;
                    var el   = this.get('trigger_opt:' + item.selected);
					switch(item.selected){
						case 'trg_pos':
							tterm.trigger_opt=0;
						break;
						case 'trg_neg':
							tterm.trigger_opt=1;
						break;
					}
                    return 'Trigger: ' + el.text;
                },
				selected: 'trg_pos',
                items: [
					{ id: 'trg_pos', text: 'Positive'},
                    { id: 'trg_neg', text: 'Negative'}
                ]
            },
			
			{ type: 'menu', id: 'mnu_midi', text: 'MIDI-File: none', icon: 'fa fa-table', items: [
                { text: 'Play', icon: 'fa fa-bolt'},
				{ text: 'Stop', icon: 'fa fa-bolt'}
            ]},
			
			{ type: 'menu', id: 'mnu_script', text: 'Script: none', icon: 'fa fa-table', items: [
				{ text: 'Start', icon: 'fa fa-bolt'},
				{ text: 'Stop', icon: 'fa fa-bolt'}
            ]},
			
            { type: 'spacer' },
			{ type: 'button', id: 'kill_set', text: 'KILL SET', icon: 'fa fa-power-off' },
			{ type: 'button', id: 'kill_reset', text: 'KILL RESET', icon: 'fa fa-power-off' },
			{ type: 'html',  id: 'port',
                html: function (item) {
                    var html =
                      '<div style="padding: 3px 10px;">'+
                      ' Port:'+
                      '    <input size="20" placeholder="COM1" onchange="var el = w2ui.toolbar.set(\'port\', { value: this.value });" '+
                      '         style="padding: 3px; border-radius: 2px; border: 1px solid silver" value="'+ (item.value || '') +'"/>'+
                      '</div>';
                    return html;
                }
            },
            { type: 'button', id: 'connect', text: 'Connect', icon: 'fa fa-plug' },
			{ type: 'button', id: 'cls', text: 'Clear Term', icon: 'fa fa-terminal' }
        ],
        onClick: function (event) {
            //console.log('Target: '+ event.target, event);
			switch (event.target) {
		
                case 'connect':
                    connect();
					
                break;
				case 'cls':
                    clear();
                break;
				case 'mnu_command:BUS ON':
					warn_energ();
				break;
				case 'mnu_command:BUS OFF':
					send_command('bus off\r');
				break;
				case 'mnu_command:TR Start':
					startTransient();
				break;
				case 'mnu_command:TR Stop':
					stopTransient();
				break;
				case 'mnu_command:startStopMidi':
					if (midiServer.active) {
						midiServer.close();
					} else {
						midiServer.requestName()
							.then(() =>
								term_ui.inputIpAddress("Please enter the port for the local MIDI server", "MIDI over IP Server",
									false, true, null, midiServer.port)
							).then(port=> {
								midiServer.setPort(port);
								midiServer.start();
							});
					}
				break;
				case 'mnu_command:Load EEPROM-Config':
					warn_eeprom_load();
				break;
				case 'mnu_command:Save EEPROM-Config':
					warn_eeprom_save();
				break;
				case 'mnu_midi:Play':
					if (midi_state.file==null){
						terminal.io.println("Please select a MIDI file using drag&drop");
						break;
					}
					stopTransient();
					startCurrentMidiFile();
					if(sid_state==1){
						sid_state=2;
					}
				break;
				case 'mnu_midi:Stop':
					midiOut.send(kill_msg);
					if (midi_state.file==null || midi_state.state!='playing'){
						terminal.io.println("No MIDI file is currently playing");
						break;
					}
					stopMidiFile();
					if(sid_state==2){
						sid_state=1;
						frame_cnt=byt;
						frame_cnt_old=0;
					}
				break;
				case 'mnu_script:Start':
					if (currentScript==null) {
						terminal.io.println("Please select a script file using drag&drop first");
						break;
					}
					scripting.startScript(currentScript);
					break;
				case 'mnu_script:Stop':
					if (currentScript==null) {
						terminal.io.println("Please select a script file using drag&drop first");
						break;
					}
					if (!scripting.isRunning()) {
						terminal.io.println("The script can not be stopped since it isn't running");
						break;
					}
					scripting.cancel();
					break;
				case 'kill_set':
					send_command('kill set\r');
				break;
				case 'kill_reset':
					send_command('kill reset\r');
				break;
            }
        }
    });
});
	

	var html_gauges='';
	for(var i=0;i<NUM_GAUGES;i++){
		html_gauges+='<div id="gauge'+ i +'" style= "width: 100px; height: 100px"></div>'
	}

	
	
	var pstyle = 'background-color: #F5F6F7;  padding: 5px;';
	$('#layout').w2layout({
		name: 'layout',
		panels: [
			{ type: 'top',  size: 50, overflow: "hidden", resizable: false, style: pstyle, content:
				'<div id="toolbar" style="padding: 4px; border: 1px solid #dfdfdf; border-radius: 3px"></div>'
			},
			{ type: 'main', style: pstyle, content:
				'<div class="scopeview">'+
				'<article>'+
				'<canvas id="waveback" style= "position: absolute; left: 0; top: 0; width: 75%; background: black; z-index: 0;"></canvas>'+
				'<canvas id="wavecanvas" style= "position: absolute; left: 0; top: 0;width: 75%; z-index: 1;"></canvas>'+
				'</article>'+
				'<aside>'+
				'<div id="ontime">Ontime<br><br>'+
				'<input type="range" id="slider" min="0" max="'+maxOntime+'" value="0" class="slider" data-show-value="true">' +
				'<input type="checkbox" id="relativeSelect"><label for="relativeSelect">Relative</label>' +
				'<br><span id="total">0</span> µs (<span id="relative">100</span>% of <span id="absolute"><b>0</b></span> µs)</div>'+
				'<br><br>Offtime<br><br>'+
				'<input type="range" id="slider1" min="20" max="'+maxBPS+'" value="1" class="slider" data-show-value="true"><label id="slider1_disp">20 Hz</label>'+
				'<br><br>Burst On<br><br>'+
				'<input type="range" id="slider2" min="0" max="'+maxBurstOntime+'" value="0" class="slider" data-show-value="true"><label id="slider2_disp">0 ms</label>'+
				'<br><br>Burst Off<br><br>'+
				'<input type="range" id="slider3" min="0" max="'+maxBurstOfftime+'" value="500" class="slider" data-show-value="true"><label id="slider3_disp">500 ms</label>'+
				'<br><br>MIDI Input: <select id="midiIn"></select>'+
				'<br>MIDI Output: <select id="midiOut"></select>'+
				'</aside>'+
				'</div>'
			},
			{ type: 'right', size: 120, resizable: false, style: pstyle, content:
				(html_gauges)
			},
			
			{ type: 'preview'	, size: '50%', resizable: true, style: pstyle, content:
				'<div id="terminal" style="position:relative; width:100%; height:100%"></div>' 
			},

		]
	});


	w2ui['layout'].on({ type : 'resize', execute : 'after'}, function (target, eventData) {
		resize();
	});
	terminal.decorate(document.querySelector('#terminal'));
	terminal.installKeyboard();
	/*TODO chrome.serial.onReceive.addListener(receive);
	
	chrome.sockets.tcp.onReceive.addListener(receive);
	
	chrome.serial.onReceiveError.addListener(error);*/
	
	document.getElementById('layout').addEventListener("drop", ondrop);
	document.getElementById('layout').addEventListener("dragover", ondragover);
	ontimeUI.slider = $(".w2ui-panel-content .scopeview #ontime #slider")[0];
	ontimeUI.relativeSelect = $(".w2ui-panel-content .scopeview #ontime #relativeSelect")[0];
	ontimeUI.total = $(".w2ui-panel-content .scopeview #ontime #total")[0];
	ontimeUI.relative = $(".w2ui-panel-content .scopeview #ontime #relative")[0];
	ontimeUI.absolute = $(".w2ui-panel-content .scopeview #ontime #absolute")[0];
	ontimeUI.slider.addEventListener("input", ontimeSliderMoved);
	ontimeUI.relativeSelect.onclick = onRelativeOntimeSelect;
	ontimeUI.setRelativeAllowed = function(allow) {
		if (allow) {
			ontimeUI.relativeSelect.disabled = false;
		} else {
			ontimeUI.relativeSelect.checked = false;
			ontimeUI.relativeSelect.onclick();
			ontimeUI.relativeSelect.disabled = true;
		}
	};
	document.getElementById('slider1').addEventListener("input", slider1);
	document.getElementById('slider2').addEventListener("input", slider2);
	document.getElementById('slider3').addEventListener("input", slider3);
	
	readini("config.ini");
	
	wavecanvas = document.getElementById("wavecanvas");
	backcanvas = document.getElementById("backcanvas");
	
	wavecanvas.onmousedown = wave_mouse_down;
    ctx = wavecanvas.getContext('2d');
	
	coil_hot_led=1;

	meters = new cls_meter(NUM_GAUGES);
	
	for(var i=0;i<NUM_GAUGES;i++){
		tterm.push({min: 0, max: 1024.0, offset: 1024.0,span: 2048,unit: '', value: 0, value_real: 0, count_div:0, name: ''});
		meas_backbuffer.push({min: 0, max: 0, avg_sum: 0, avg_samp: 0});
		meas.push({min: 0, max: 0, avg: 0});
		
	}
	/*TODO midiServer = new MidiIpServer(s=>terminal.io.println(s),
		()=> {
			terminal.io.println("MIDI server at " + midiServer.port + " started!");
			helper.changeMenuEntry('mnu_command', 'startStopMidi', 'Stop MIDI server');
		},
		()=> {
			terminal.io.println("MIDI server at " + midiServer.port + " closed!");
			helper.changeMenuEntry('mnu_command', 'startStopMidi', 'Start MIDI server');
		},
		client=> {
			midiServer.sendRelativeOntime(ontimeUI.relativeVal, client);
			terminal.io.println("Client instance \"" + client.name + "\" connected");
		});
	chrome.sockets.tcp.onReceive.addListener(onMIDIoverIP);*/
	tterm.trigger=-1;
	tterm.trigger_lvl= 0;
	tterm.value_old= 0;
	tterm.trigger_lvl_real=0;
	tterm.trigger_trgt=0;
	tterm.trigger_old=0;
	tterm.trigger_block=0;
	
	
	
	midi_start();
	midi_state.progress = 0;
	scripting.init(terminal,
		Player,
		startCurrentMidiFile,
		stopMidiFile,
		helper.convertArrayBufferToString,
		setRelativeOntime,
		setBPS,
		setBurstOntime,
		setBurstOfftime,
		startTransient,
		stopTransient,
		w2confirm,
		ontimeUI.setRelativeAllowed);
});

// Allow multiple windows to be opened
/*nw.App.on('open', function(args) {
	var new_win = nw.Window.open('index.html', nw.App.manifest.window);
});
*/