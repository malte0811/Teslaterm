module.exports = class minprot {
	constructor(get_ack_payload) {
		this.get_ack_payload = get_ack_payload;
		this.rx = [];
		this.rx.states = {
			SOF: 'sof',
			ID_CONTROL: 'id_control',
			SEQ_3: 'seq_3',
			SEQ_2: 'seq_2',
			SEQ_1: 'seq_1',
			SEQ_0: 'seq_0',
			LENGTH: 'length',
			PAYLOAD: 'payload',
			CRC_3: 'crc_3',
			CRC_2: 'crc_2',
			CRC_1: 'crc_1',
			CRC_0: 'crc_0',
			EOF: 'eof'
		};

		this.rx.magic = {
			HEADER_BYTE: 0xaa,
			STUFF_BYTE: 0x55,
			EOF_BYTE: 0x55,
			ACK: 0xff,
			RESET: 0xfe
		};
		this.rx.frame = [];
		this.rx.frame.payload_bytes = 0;      // Length of payload received so far
		this.rx.frame.id_control = 0;         // ID and control bit of frame being received
		this.rx.frame.seq = 0;				// Sequence number of frame being received
		this.rx.frame.length = 0;			// Length of frame
		this.rx.frame.payload = [];

		this.tx = [];
		this.tx.header_byte_countdown = 0;

		this.rx_space = 512;
		this.crc = 0;

		this.rx.header_bytes_seen = 0;
		this.rx.frame_state = this.rx.states.SOF;
		this.remote_rx_space = 512;

		// Counters for diagnosis purposes
		this.transport_fifo = [];
		this.transport_fifo.spurious_acks = 0;
		this.transport_fifo.sequence_mismatch_drop = 0;
		this.transport_fifo.dropped_frames = 0;
		this.transport_fifo.resets_received = 0;
		this.transport_fifo.sn_min = 0;
		this.transport_fifo.sn_max = 0;
		this.transport_fifo.rn = 0;
		this.transport_fifo.last_sent_ack_time_ms = 0;
		this.transport_fifo.last_sent_seq = -1;
		this.transport_fifo.last_sent_seq_cnt = 0;
		this.transport_fifo.last_received_anything_ms = Date.now();
		this.transport_fifo.last_received_frame_ms = 0;
		this.transport_fifo.frames = [];
		this.TRANSPORT_IDLE_TIMEOUT_MS = 1000;
		this.TRANSPORT_MAX_WINDOW_SIZE = 16;
		this.TRANSPORT_ACK_RETRANSMIT_TIMEOUT_MS = 25;
		this.TRANSPORT_FRAME_RETRANSMIT_TIMEOUT_MS = 50;

		this.sendByte = 0;
		this.handler = 0;

		this.conf = [];
		this.conf.max_payload = 255;
		this.serial_buffer = [];

		this.now = Date.now();
		this.debug = false;
	}

	crc32_init_context() {
		this.crc = 0xFFFFFFFF;
	}

	crc32_step(byte) {
		this.crc ^= byte;
		for (let j = 0; j < 8; j++) {
			let mask = -(this.crc & 1);
			this.crc = (this.crc >>> 1) ^ (0xedb88320 & mask);
		}
	}

	crc32_finalize() {
		return ~this.crc;
	}

	rx_byte(byte) {
		// Regardless of state, three header bytes means "start of frame" and
		// should reset the frame buffer and be ready to receive frame data
		//
		// Two in a row in over the frame means to expect a stuff byte.
		let crc;
		if (this.rx.header_bytes_seen == 2) {
			this.rx.header_bytes_seen = 0;
			if (byte == this.rx.magic.HEADER_BYTE) {
				this.rx.frame_state = this.rx.states.ID_CONTROL;
				return;
			}
			if (byte == this.rx.magic.STUFF_BYTE) {
				/* Discard this byte; carry on receiving on the next character */
				return;
			} else {
				/* Something has gone wrong, give up on this frame and look for header again */
				this.rx.frame_state = this.rx.states.SOF;
				return;
			}
		}

		if (byte == this.rx.magic.HEADER_BYTE) {
			this.rx.header_bytes_seen++;

		} else {
			this.rx.header_bytes_seen = 0;
		}

		switch (this.rx.frame_state) {
			case this.rx.states.SOF:
				break;
			case this.rx.states.ID_CONTROL:
				this.rx.frame.id_control = byte;
				this.rx.frame.payload_bytes = 0;
				this.crc32_init_context();
				this.crc32_step(byte);
				if (byte & 0x80) {
					this.rx.frame_state = this.rx.states.SEQ_3;
				} else {
					this.rx.frame.seq = 0;
					this.rx.frame_state = this.rx.states.LENGTH;
				}
				break;
			case this.rx.states.SEQ_3:
				this.rx.frame.seq = byte << 24;
				this.crc32_step(byte);
				this.rx.frame_state = this.rx.states.SEQ_2;
				break;
			case this.rx.states.SEQ_2:
				this.rx.frame.seq |= byte << 16;
				this.crc32_step(byte);
				this.rx.frame_state = this.rx.states.SEQ_1;
				break;
			case this.rx.states.SEQ_1:
				this.rx.frame.seq |= byte << 8;
				this.crc32_step(byte);
				this.rx.frame_state = this.rx.states.SEQ_0;
				break;
			case this.rx.states.SEQ_0:
				this.rx.frame.seq |= byte;
				this.crc32_step(byte);
				this.rx.frame_state = this.rx.states.LENGTH;
				break;
			case this.rx.states.LENGTH:
				this.rx.frame.payload = [];
				this.rx.frame.length = byte;
				this.crc32_step(byte);
				if (this.rx.frame.length > 0) {
					if (this.rx.frame.length <= this.conf.max_payload) {
						this.rx.frame_state = this.rx.states.PAYLOAD;
					} else {
						// Frame dropped because it's longer than any frame we can buffer
						this.rx.frame_state = this.rx.states.SOF;
					}
				} else {
					this.rx.frame_state = this.rx.states.CRC_3;
				}
				break;
			case this.rx.states.PAYLOAD:
				this.rx.frame.payload[this.rx.frame.payload_bytes++] = byte;
				this.crc32_step(byte);
				if (--this.rx.frame.length == 0) {
					this.rx.frame_state = this.rx.states.CRC_3;
				}
				break;
			case this.rx.states.CRC_3:
				this.rx.frame.checksum = byte << 24;
				this.rx.frame_state = this.rx.states.CRC_2;
				break;
			case this.rx.states.CRC_2:
				this.rx.frame.checksum |= byte << 16;
				this.rx.frame_state = this.rx.states.CRC_1;
				break;
			case this.rx.states.CRC_1:
				this.rx.frame.checksum |= byte << 8;
				this.rx.frame_state = this.rx.states.CRC_0;
				break;
			case this.rx.states.CRC_0:
				this.rx.frame.checksum |= byte;
				crc = this.crc32_finalize();
				if (crc != this.rx.frame.checksum) {
					// Frame fails the checksum and so is dropped
					this.rx.frame_state = this.rx.states.SOF;
				} else {
					// Checksum passes, go on to check for the end-of-frame marker
					this.rx.frame_state = this.rx.states.EOF;
				}
				break;
			case this.rx.states.EOF:
				if (byte == 0x55) {
					// Frame received OK, pass up data to handler
					//console.log(this.rx.frame);
					this.valid_frame_received(this.rx.frame);
					this.rx.frame.payload = [];
				}
				// else discard
				// Look for next frame */
				this.rx.frame_state = this.rx.states.SOF;
				break;
			default:
				// Should never get here but in case we do then reset to a safe state
				this.rx.frame_state = this.rx.states.SOF;
				break;
		}
	}

	valid_frame_received(frame) {

		let seq = frame.seq;
		let num_acked;
		let num_nacked;
		let num_in_window;

		// When we receive anything we know the other end is still active and won't shut down
		this.transport_fifo.last_received_anything_ms = this.now;

		switch (frame.id_control) {
			case this.rx.magic.ACK:
				// If we get an ACK then we remove all the acknowledged frames with seq < rn
				// The payload byte specifies the number of NACKed frames: how many we want retransmitted because
				// they have gone missing.
				// But we need to make sure we don't accidentally ACK too many because of a stale ACK from an old session
				num_acked = seq - this.transport_fifo.sn_min;
				num_nacked = (frame.payload[0] << 24);
				num_nacked |= (frame.payload[1] << 16);
				num_nacked |= (frame.payload[2] << 8);
				num_nacked |= (frame.payload[3]);
				num_nacked -= seq;
				num_in_window = this.transport_fifo.sn_max - this.transport_fifo.sn_min;

				this.remote_rx_space = (frame.payload[4] << 24);
				this.remote_rx_space |= (frame.payload[5] << 16);
				this.remote_rx_space |= (frame.payload[6] << 8);
				this.remote_rx_space |= (frame.payload[7]);

				if (num_acked <= num_in_window) {
					this.transport_fifo.sn_min = seq;

					// Now pop off all the frames up to (but not including) rn
					// The ACK contains Rn; all frames before Rn are ACKed and can be removed from the window
					if (this.debug) console.log("Received ACK seq=" + seq + ", num_acked=" + num_acked + ", num_nacked=" + num_nacked);
					for (let i = 0; i < num_acked; i++) {
						//transport_fifo_pop(self);
						let last_pop = this.transport_fifo.frames.shift();
						if (last_pop) last_pop.resolve();
						if (this.debug) console.log("Popping frame id=" + last_pop.min_id + " seq=" + last_pop.seq);
					}
					// Now retransmit the number of frames that were requested
					for (let i = 0; i < num_nacked; i++) {
						let wire_size = this.on_wire_size(this.transport_fifo.frames[i].length);
						if (wire_size >= this.remote_rx_space) {
							break;
						}
						this.transport_fifo.frames[i].last_send = this.now;
						this.on_wire_bytes(this.transport_fifo.frames[i].min_id | 0x80, this.transport_fifo.frames[i].seq, this.transport_fifo.frames[i].payload);
						this.transport_fifo.sn_max++;
					}
				} else {
					if (this.debug) console.log("Received spurious ACK seq=" + seq);
					this.transport_fifo.spurious_acks++;
				}
				break;
			case this.rx.magic.RESET:
				// If we get a RESET demand then we reset the transport protocol (empty the FIFO, reset the
				// sequence numbers, etc.)
				// We don't send anything, we just do it. The other end can send frames to see if this end is
				// alive (pings, etc.) or just wait to get application frames.
				this.transport_fifo.resets_received++;
				this.transport_fifo_reset();
				break;
			default:
				if (frame.id_control & 0x80) {
					// Incoming application frames

					// Reset the activity time (an idle connection will be stalled)
					this.transport_fifo.last_received_frame_ms = this.now;

					if (seq == this.transport_fifo.rn) {
						// Accept this frame as matching the sequence number we were looking for

						// Now looking for the next one in the sequence
						this.transport_fifo.rn++;

						// Always send an ACK back for the frame we received
						// ACKs are short (should be about 9 microseconds to send on the wire) and
						// this will cut the latency down.
						// We also periodically send an ACK in case the ACK was lost, and in any case
						// frames are re-sent.
						this.send_ack();

						// Now ready to pass this up to the application handlers
						this.handler(frame.id_control & 0x3f, frame.payload);
						// Pass frame up to application handler to deal with
						if (this.debug) console.log("Incoming app frame seq=" + frame.seq + ", id=" + (frame.id_control & 0x3f) + ", payload len=" + frame.payload.length);
						//min_application_handler(id_control & (uint8_t)0x3fU, payload, payload_len, self->port);
					} else {
						// Discard this frame because we aren't looking for it: it's either a dupe because it was
						// retransmitted when our ACK didn't get through in time, or else it's further on in the
						// sequence and others got dropped.
						this.transport_fifo.sequence_mismatch_drop++;
						if (this.debug) console.log('Mismatch seq=' + seq + 'rn=' + this.transport_fifo.rn);
					}
				} else {
					// Not a transport frame
					this.handler(frame.id_control & 0x3f, frame.payload);
				}
				break;
		}

	}

	send_reset() {
		if (this.debug) console.log("send RESET");
		//if(ON_WIRE_SIZE(0) <= min_tx_space(self->port)) {
		let pay = [];
		//pay[0] = '0';
		this.on_wire_bytes(this.rx.magic.RESET, 0, pay);
		//}
	}

	send_ack() {
		// In the embedded end we don't reassemble out-of-order frames and so never ask for retransmits. Payload is
		// always the same as the sequence number.
		if (this.debug) console.log("send ACK: seq=" + this.transport_fifo.rn);
		//if(ON_WIRE_SIZE(8) <= min_tx_space(self->port)) {
		//on_wire_bytes(self, ACK, self->transport_fifo.rn, &self->transport_fifo.rn, 0, 0xffU, 1U);
		let sq = [];
		//self->rx_space=min_rx_space(self->port);
		sq[0] = (this.transport_fifo.rn >>> 24) & 0xff;
		sq[1] = (this.transport_fifo.rn >>> 16) & 0xff;
		sq[2] = (this.transport_fifo.rn >>> 8) & 0xff;
		sq[3] = this.transport_fifo.rn & 0xff;
		sq[4] = (this.rx_space >>> 24) & 0xff;
		sq[5] = (this.rx_space >>> 16) & 0xff;
		sq[6] = (this.rx_space >>> 8) & 0xff;
		sq[7] = this.rx_space & 0xff;
		sq = sq.concat(this.get_ack_payload());
		this.on_wire_bytes(this.rx.magic.ACK, this.transport_fifo.rn, sq);
		this.transport_fifo.last_sent_ack_time_ms = Date.now();
		//}
	}

	on_wire_bytes(id_control, seq, payload) {
		let checksum;
		this.serial_buffer = [];
		this.tx.header_byte_countdown = 2;
		this.crc32_init_context();
		// Header is 3 bytes; because unstuffed will reset receiver immediately
		this.serial_buffer.push(this.rx.magic.HEADER_BYTE);
		this.serial_buffer.push(this.rx.magic.HEADER_BYTE);
		this.serial_buffer.push(this.rx.magic.HEADER_BYTE);

		this.stuffed_tx_byte(id_control);
		if (id_control & 0x80) {
			// Send the sequence number if it is a transport frame
			this.stuffed_tx_byte((seq >>> 24) & 0xff);
			this.stuffed_tx_byte((seq >>> 16) & 0xff);
			this.stuffed_tx_byte((seq >>> 8) & 0xff);
			this.stuffed_tx_byte((seq >>> 0) & 0xff);

		}

		this.stuffed_tx_byte(payload.length);

		for (let i = 0; i < payload.length; i++) {
			this.stuffed_tx_byte(payload[i]);
		}

		checksum = this.crc32_finalize();
		// Network order is big-endian. A decent C compiler will spot that this
		// is extracting bytes and will use efficient instructions.
		this.stuffed_tx_byte((checksum >>> 24) & 0xff);
		this.stuffed_tx_byte((checksum >>> 16) & 0xff);
		this.stuffed_tx_byte((checksum >>> 8) & 0xff);
		this.stuffed_tx_byte(checksum & 0xff);

		// Ensure end-of-frame doesn't contain 0xaa and confuse search for start-of-frame
		this.serial_buffer.push(this.rx.magic.EOF_BYTE);
		this.sendByte(this.serial_buffer);

		//min_tx_finished(self->port);
	}

	stuffed_tx_byte(byte) {
		// Transmit the byte
		//this.sendByte(String.fromCharCode(byte));
		if (typeof byte == "string") {
			byte = byte.charCodeAt(0);
		}
		this.serial_buffer.push(byte);
		this.crc32_step(byte);

		// See if an additional stuff byte is needed
		if (byte == this.rx.magic.HEADER_BYTE) {
			if (--this.tx.header_byte_countdown == 0) {
				this.serial_buffer.push(this.rx.magic.STUFF_BYTE);        // Stuff byte
				this.tx.header_byte_countdown = 2;
			}
		} else {
			this.tx.header_byte_countdown = 2;
		}
	}

	on_wire_size(p) {
		return p + 14;
	}

	min_poll(buf) {
		if (typeof buf != 'undefined') {
			for (let i = 0; i < buf.length; i++) {
				this.rx_byte(buf[i], this.get_ack_payload());
			}
		}

		if (this.rx.frame_state == this.rx.states.SOF) {
			this.now = Date.now();

			let remote_connected = (this.now - this.transport_fifo.last_received_anything_ms < this.TRANSPORT_IDLE_TIMEOUT_MS);
			let remote_active = (this.now - this.transport_fifo.last_received_frame_ms < this.TRANSPORT_IDLE_TIMEOUT_MS);

			if (!remote_connected) this.min_transport_reset(true);

			// This sends one new frame or resends one old frame

			let window_size = this.transport_fifo.sn_max - this.transport_fifo.sn_min; // Window size
			if ((window_size < this.TRANSPORT_MAX_WINDOW_SIZE) && (this.transport_fifo.frames.length > window_size)) {
				if (this.transport_fifo.frames.length) {
					let wire_size = this.on_wire_size(this.transport_fifo.frames[window_size].length);
					if (wire_size < this.remote_rx_space) {
						this.transport_fifo.frames[window_size].seq = this.transport_fifo.sn_max;
						this.transport_fifo.last_sent_seq = this.transport_fifo.sn_max;
						this.transport_fifo.frames[window_size].last_send = this.now;
						if (this.debug) console.log("SEQA=" + this.transport_fifo.frames[window_size].seq);
						this.on_wire_bytes(this.transport_fifo.frames[window_size].min_id | 0x80, this.transport_fifo.frames[window_size].seq, this.transport_fifo.frames[window_size].payload);
						this.transport_fifo.sn_max++;
					}
				}
				// There are new frames we can send; but don't even bother if there's no buffer space for them

			} else {
				// Sender cannot send new frames so resend old ones (if there's anyone there)
				if ((window_size > 0) && remote_connected) {
					// There are unacknowledged frames. Can re-send an old frame. Pick the least recently sent one.

					let oldest = Number.POSITIVE_INFINITY;
					let resend_frame_num = -1;
					for (let i = 0; i < this.transport_fifo.frames.length; i++) {
						if (this.transport_fifo.frames[i].last_send < oldest) {
							resend_frame_num = i;
							oldest = this.transport_fifo.frames[i].last_send;
						}
					}
               		if (resend_frame_num > -1 && (this.now - this.transport_fifo.frames[resend_frame_num].last_send) >= this.TRANSPORT_FRAME_RETRANSMIT_TIMEOUT_MS) {
						let wire_size = this.on_wire_size(this.transport_fifo.frames[resend_frame_num].length);
						if (wire_size < this.remote_rx_space) {
							if (this.debug) console.log("SEQB=" + this.transport_fifo.frames[resend_frame_num].seq);
							if (this.transport_fifo.frames[resend_frame_num].seq == this.transport_fifo.last_sent_seq) {
								this.transport_fifo.last_sent_seq_cnt++;
							} else {
								this.transport_fifo.last_sent_seq_cnt = 0;
							}
							this.transport_fifo.last_sent_seq = this.transport_fifo.frames[resend_frame_num].seq;
							if (this.transport_fifo.last_sent_seq_cnt > 10) {
								this.min_transport_reset(true);
								this.transport_fifo.last_sent_seq_cnt = 0;
							} else {
								this.on_wire_bytes(this.transport_fifo.frames[resend_frame_num].min_id | 0x80, this.transport_fifo.frames[resend_frame_num].seq, this.transport_fifo.frames[resend_frame_num].payload);
                                this.transport_fifo.frames[resend_frame_num].last_send = this.now;
							}
						}
					}

				}


				// Periodically transmit the ACK with the rn value, unless the line has gone idle
				if (this.now - this.transport_fifo.last_sent_ack_time_ms > this.TRANSPORT_ACK_RETRANSMIT_TIMEOUT_MS) {
					if (remote_active) {
						this.send_ack();
					}
				}
			}
		}
	}

	min_transport_reset(inform_other_side) {
		if (inform_other_side) {
			// Tell the other end we have gone away
			this.send_reset();
		}

		// Throw our frames away
		this.transport_fifo_reset();
	}

	transport_fifo_reset() {
		// Clear down the transmission FIFO queue
		this.transport_fifo.sn_max = 0;
		this.transport_fifo.sn_min = 0;
		this.transport_fifo.rn = 0;

		// Reset the timers
		this.transport_fifo.last_received_anything_ms = this.now;
		this.transport_fifo.last_sent_ack_time_ms = this.now;
		this.transport_fifo.last_received_frame_ms = 0;

		console.log("Resetting min FIFO")
		for (let frame of this.transport_fifo.frames) {
			frame.reject("Resetting min FIFO");
		}
		this.transport_fifo.frames = [];
		this.transport_fifo.last_sent_seq = -1;
		this.transport_fifo.last_sent_seq_cnt = 0;
	}

	min_queue_frame(min_id, payload) {
		return new Promise((res, rej) => {
			// We are just queueing here: the poll() function puts the frame into the window and on to the wire
			if (this.transport_fifo.frames.length < this.TRANSPORT_MAX_WINDOW_SIZE) {
				// Copy frame details into frame slot, copy payload into ring buffer
				//console.log(payload.length);
				let frame = [];
				frame.min_id = min_id & 0x3f;
				frame.last_send = Date.now();
				frame.payload = [];
				for (let i = 0; i < payload.length; i++) {
					frame.payload.push(payload[i]);
				}
				frame.resolve = res;
				frame.reject = rej;
				this.transport_fifo.frames.push(frame);
				if (this.debug) console.log("Queued ID=" + min_id + " len=" + payload.length);
			} else {
				this.transport_fifo.dropped_frames++;
				rej("Max fifo size exceeded");
			}
		});
	}

	get_relative_fifo_size() {
		return this.transport_fifo.frames.length / this.TRANSPORT_MAX_WINDOW_SIZE;
	}
};
