const little_endian = true;
const c_single = 'single';
const c_datagram = 'datagram';
const c_direct = 'direct';
const c_multipart = 'multipart';
const c_streaming = 'streaming';

const _err_msgid_required = `Response reqires 'msgid'`;
const _err_token_required = `Transport reqires 'token'`;

function frm_routing() {
  const size = 8,
        bits = 0x1,
        mask = 0x1;
  return {
    size, bits, mask,

    f_test(obj) {
      return null != obj.from_id ? bits : false;
    },

    f_pack(obj, dv, offset) {
      const { from_id } = obj;
      dv.setInt32(0 + offset, 0 | from_id.id_router, little_endian);
      dv.setInt32(4 + offset, 0 | from_id.id_target, little_endian);
    },

    f_unpack(obj, dv, offset) {
      const from_id = undefined === obj.from_id ? obj.from_id = {} : obj.from_id;
      from_id.id_router = dv.getInt32(0 + offset, little_endian);
      from_id.id_target = dv.getInt32(4 + offset, little_endian);
    } };
}

function frm_response() {
  const size = 8,
        bits = 0x2,
        mask = 0x2;
  return {
    size, bits, mask,

    f_test(obj) {
      return null != obj.msgid ? bits : false;
    },

    f_pack(obj, dv, offset) {
      if (!obj.msgid) {
        throw new Error(_err_msgid_required);
      }
      dv.setInt32(0 + offset, obj.msgid, little_endian);
      dv.setInt16(4 + offset, 0 | obj.seq_ack, little_endian);
      dv.setInt16(6 + offset, 0 | obj.ack_flags, little_endian);
    },

    f_unpack(obj, dv, offset) {
      obj.token = dv.getInt32(0 + offset, little_endian);
      obj.seq_ack = dv.getInt16(4 + offset, little_endian);
      obj.ack_flags = dv.getInt16(6 + offset, little_endian);
    } };
}

function frm_datagram() {
  const size = 0,
        bits = 0x0,
        mask = 0xc;
  return { transport: c_datagram,
    size, bits, mask,

    f_test(obj) {
      if (c_datagram === obj.transport) {
        return bits;
      }
      if (obj.transport && c_single !== obj.transport) {
        return false;
      }
      return !obj.token ? bits : false;
    },

    f_pack(obj, dv, offset) {},

    f_unpack(obj, dv, offset) {
      obj.transport = c_datagram;
    } };
}

function frm_direct() {
  const size = 4,
        bits = 0x4,
        mask = 0xc;
  return { transport: c_direct,
    size, bits, mask,

    f_test(obj) {
      if (c_direct === obj.transport) {
        return bits;
      }
      if (obj.transport && c_single !== obj.transport) {
        return false;
      }
      return !!obj.token ? bits : false;
    },

    f_pack(obj, dv, offset) {
      if (!obj.token) {
        throw new Error(_err_token_required);
      }
      dv.setInt32(0 + offset, obj.token, little_endian);
    },

    f_unpack(obj, dv, offset) {
      obj.msgid = dv.getInt32(0 + offset, little_endian);
      obj.transport = c_direct;
    } };
}

function frm_multipart() {
  const size = 8,
        bits = 0x8,
        mask = 0xc;
  return { transport: c_multipart,
    size, bits, mask,

    f_test(obj) {
      return c_multipart === obj.transport ? bits : false;
    },

    bind_seq_next, seq_pos: 4,
    f_pack(obj, dv, offset) {
      if (!obj.token) {
        throw new Error(_err_token_required);
      }
      dv.setInt32(0 + offset, obj.token, little_endian);
      if (true == obj.seq) {
        // use seq_next
        dv.setInt16(4 + offset, 0, little_endian);
      } else dv.setInt16(4 + offset, 0 | obj.seq, little_endian);
      dv.setInt16(6 + offset, 0 | obj.seq_flags, little_endian);
    },

    f_unpack(obj, dv, offset) {
      obj.msgid = dv.getInt32(0 + offset, little_endian);
      obj.seq = dv.getInt16(4 + offset, little_endian);
      obj.seq_flags = dv.getInt16(6 + offset, little_endian);
      obj.transport = c_multipart;
    } };
}

function frm_streaming() {
  const size = 8,
        bits = 0xc,
        mask = 0xc;
  return { transport: c_streaming,
    size, bits, mask,

    f_test(obj) {
      return c_streaming === obj.transport ? bits : false;
    },

    bind_seq_next, seq_pos: 4,
    f_pack(obj, dv, offset) {
      if (!obj.token) {
        throw new Error(_err_token_required);
      }
      dv.setInt32(0 + offset, obj.token, little_endian);
      if (true == obj.seq) {
        dv.setInt16(4 + offset, 0, little_endian // use seq_next
        );
      } else dv.setInt16(4 + offset, 0 | obj.seq, little_endian);
      dv.setInt16(6 + offset, 0 | obj.seq_flags, little_endian);
    },

    f_unpack(obj, dv, offset) {
      obj.msgid = dv.getInt32(0 + offset, little_endian);
      obj.seq = dv.getInt16(4 + offset, little_endian);
      obj.seq_flags = dv.getInt16(6 + offset, little_endian);
      obj.transport = c_streaming;
    } };
}

function bind_seq_next(offset) {
  const seq_offset = this.seq_pos + offset;
  let seq = 1;
  return function seq_next({ flags, fin }, dv) {
    if (!fin) {
      dv.setInt16(seq_offset, seq++, little_endian);
      dv.setInt16(2 + seq_offset, 0 | flags, little_endian);
    } else {
      dv.setInt16(seq_offset, -seq, little_endian);
      dv.setInt16(2 + seq_offset, 0 | flags, little_endian);
      seq = NaN;
    }
  };
}

var framings = composeFramings();
function composeFramings() {
  const frm_from = frm_routing(),
        frm_resp = frm_response();
  const frm_transports = [frm_datagram(), frm_direct(), frm_multipart(), frm_streaming()];

  if (8 !== frm_from.size || 8 !== frm_resp.size || 4 != frm_transports.length) {
    throw new Error(`Framing Size change`);
  }

  const byBits = [],
        mask = 0xf;

  {
    const t_from = frm_from.f_test,
          t_resp = frm_resp.f_test;
    const [t0, t1, t2, t3] = frm_transports.map(f => f.f_test);

    const testBits = byBits.testBits = obj => 0 | t_from(obj) | t_resp(obj) | t0(obj) | t1(obj) | t2(obj) | t3(obj);

    byBits.choose = function (obj, lst) {
      if (null == lst) {
        lst = this || byBits;
      }
      return lst[testBits(obj)];
    };
  }

  for (const T of frm_transports) {
    const { bits: b, size, transport } = T;

    byBits[b | 0] = { T, transport, bits: b | 0, mask, size: size, op: '' };
    byBits[b | 1] = { T, transport, bits: b | 1, mask, size: 8 + size, op: 'f' };
    byBits[b | 2] = { T, transport, bits: b | 2, mask, size: 8 + size, op: 'r' };
    byBits[b | 3] = { T, transport, bits: b | 3, mask, size: 16 + size, op: 'fr' };

    for (const fn_key of ['f_pack', 'f_unpack']) {
      const fn_tran = T[fn_key],
            fn_from = frm_from[fn_key],
            fn_resp = frm_resp[fn_key];

      byBits[b | 0][fn_key] = function (obj, dv) {
        fn_tran(obj, dv, 0);
      };
      byBits[b | 1][fn_key] = function (obj, dv) {
        fn_from(obj, dv, 0);fn_tran(obj, dv, 8);
      };
      byBits[b | 2][fn_key] = function (obj, dv) {
        fn_resp(obj, dv, 0);fn_tran(obj, dv, 8);
      };
      byBits[b | 3][fn_key] = function (obj, dv) {
        fn_from(obj, dv, 0);fn_resp(obj, dv, 8);fn_tran(obj, dv, 16);
      };
    }
  }

  for (const frm of byBits) {
    bindAssembled(frm);
  }

  return byBits;
}

function bindAssembled(frm) {
  const { T, size, f_pack, f_unpack } = frm;
  if (T.bind_seq_next) {
    frm.seq_next = T.bind_seq_next(frm.size - T.size);
  }

  delete frm.T;
  frm.pack = pack;frm.unpack = unpack;
  const seq_next = frm.seq_next;

  function pack(pkt_type, pkt_obj) {
    if (!(0 <= pkt_type && pkt_type <= 255)) {
      throw new TypeError(`Expected pkt_type to be [0..255]`);
    }

    pkt_obj.type = pkt_type;
    if (seq_next && null == pkt_obj.seq) {
      pkt_obj.seq = true;
    }

    const dv = new DataView(new ArrayBuffer(size));
    f_pack(pkt_obj, dv, 0);
    pkt_obj.header = dv.buffer;

    if (true === pkt_obj.seq) {
      _bind_iterable(pkt_obj, dv.buffer.slice(0, size));
    }
  }

  function unpack(pkt) {
    const buf = pkt.header_buffer();
    const dv = new DataView(new Uint8Array(buf).buffer);

    const info = {};
    f_unpack(info, dv, 0);
    return pkt.info = info;
  }

  function _bind_iterable(pkt_obj, buf_clone) {
    const { type } = pkt_obj;
    const { id_router, id_target, ttl, token } = pkt_obj;
    pkt_obj.next = next;

    function next(options) {
      if (null == options) {
        options = {};
      }
      const header = buf_clone.slice();
      seq_next(options, new DataView(header));
      return { done: !!options.fin, value: {// pkt_obj
        }, id_router, id_target, type, ttl, token, header };
    }
  }
}

var multipart = function (packetParser, shared) {
  const { concatBuffers } = packetParser;
  return { createMultipart };

  function createMultipart(pkt, sink, deleteState) {
    let parts = [],
        fin = false;
    return { feed, info: pkt.info };

    function feed(pkt) {
      let seq = pkt.info.seq;
      if (seq < 0) {
        fin = true;seq = -seq;
      }
      parts[seq - 1] = pkt.body_buffer();

      if (!fin) {
        return;
      }
      if (parts.includes(undefined)) {
        return;
      }

      deleteState();

      const res = concatBuffers(parts);
      parts = null;
      return res;
    }
  }
};

var streaming = function (packetParser, shared) {
  return { createStream };

  function createStream(pkt, sink, deleteState) {
    let next = 0,
        fin = false,
        recvData,
        rstream;
    const state = { feed: feed_init, info: pkt.info };
    return state;

    function feed_init(pkt, as_content, msg_unpack) {
      state.feed = feed_ignore;

      const info = pkt.info;
      const msg = msg_unpack ? msg_unpack(pkt, sink) : sink.json_unpack(pkt.body_utf8());
      rstream = sink.recvStream(msg, info);
      if (null == rstream) {
        return;
      }
      check_fns(rstream, 'on_error', 'on_data', 'on_end');
      recvData = sink.recvStreamData.bind(sink, rstream, info);

      try {
        feed_seq(pkt);
      } catch (err) {
        return rstream.on_error(err, pkt);
      }

      state.feed = feed_body;
      if (rstream.on_init) {
        return rstream.on_init(msg, pkt);
      }
    }

    function feed_body(pkt, as_content) {
      recvData();
      let data;
      try {
        feed_seq(pkt);
        data = as_content(pkt, sink);
      } catch (err) {
        return rstream.on_error(err, pkt);
      }

      if (fin) {
        const res = rstream.on_data(data, pkt);
        return rstream.on_end(res, pkt);
      } else {
        return rstream.on_data(data, pkt);
      }
    }

    function feed_ignore(pkt) {
      try {
        feed_seq(pkt);
      } catch (err) {}
    }

    function feed_seq(pkt) {
      let seq = pkt.info.seq;
      if (seq >= 0) {
        if (next++ === seq) {
          return; // in order
        }
      } else {
          fin = true;
          deleteState();
          if (next === -seq) {
            next = 'done';
            return; // in-order, last packet
          }
        }state.feed = feed_ignore;
      next = 'invalid';
      throw new Error(`Packet out of sequence`);
    }
  }
};

function check_fns(obj, ...keys) {
  for (const key of keys) {
    if ('function' !== typeof obj[key]) {
      throw new TypeError(`Expected "${key}" to be a function`);
    }
  }
}

var transport = function (packetParser, shared) {
  const { packPacketObj } = packetParser;
  const { random_id, json_pack } = shared;
  const { choose: chooseFraming } = framings;

  const fragment_size = Number(shared.fragment_size || 8000);
  if (1024 > fragment_size || 65000 < fragment_size) {
    throw new Error(`Invalid fragment size: ${fragment_size}`);
  }

  return { bindTransports, packetFragments, chooseFraming };

  function bindTransports(inbound, highbits, transports) {
    const packBody = transports.packBody;
    const outbound = bindTransportImpls(inbound, highbits, transports);

    if (transports.streaming) {
      return { send, stream: bindStream() };
    }

    return { send };

    function send(chan, obj, body) {
      body = packBody(body, obj, chan);
      if (fragment_size < body.byteLength) {
        if (!obj.token) {
          obj.token = random_id();
        }
        obj.transport = 'multipart';
        const msend = msend_bytes(chan, obj);
        return msend(true, body);
      }

      obj.transport = 'single';
      obj.body = body;
      const pack_hdr = outbound.choose(obj);
      const pkt = packPacketObj(pack_hdr(obj));
      return chan.send(pkt);
    }

    function msend_bytes(chan, obj, msg) {
      const pack_hdr = outbound.choose(obj);
      let { next } = pack_hdr(obj);
      if (null !== msg) {
        obj.body = msg;
        const pkt = packPacketObj(obj);
        chan.send(pkt);
      }

      return async function (fin, body) {
        if (null === next) {
          throw new Error('Write after end');
        }
        let res;
        for (const obj of packetFragments(body, next, fin)) {
          const pkt = packPacketObj(obj);
          res = await chan.send(pkt);
        }
        if (fin) {
          next = null;
        }
        return res;
      };
    }

    function msend_objects(chan, obj, msg) {
      const pack_hdr = outbound.choose(obj);
      let { next } = pack_hdr(obj);
      if (null !== msg) {
        obj.body = msg;
        const pkt = packPacketObj(obj);
        chan.send(pkt);
      }

      return function (fin, body) {
        if (null === next) {
          throw new Error('Write after end');
        }
        const obj = next({ fin });
        obj.body = body;
        const pkt = packPacketObj(obj);
        if (fin) {
          next = null;
        }
        return chan.send(pkt);
      };
    }

    function bindStream() {
      const { mode, msg_pack } = transports.streaming;
      const msend_impl = { object: msend_objects, bytes: msend_bytes }[mode];
      if (msend_impl) {
        return stream;
      }

      function stream(chan, obj, msg) {
        if (!obj.token) {
          obj.token = random_id();
        }
        obj.transport = 'streaming';
        msg = msg_pack ? msg_pack(msg, obj, chan) : json_pack(msg);
        const msend = msend_impl(chan, obj, msg);
        write.write = write;write.end = write.bind(true);
        return write;

        function write(chunk) {
          // msend @ fin, body
          return chunk != null ? msend(true === this, packBody(chunk, obj, chan)) : msend(true);
        }
      }
    }
  }

  function* packetFragments(buf, next_hdr, fin) {
    if (null == buf) {
      const obj = next_hdr({ fin });
      yield obj;
      return;
    }

    let i = 0,
        lastInner = buf.byteLength - fragment_size;
    while (i < lastInner) {
      const i0 = i;
      i += fragment_size;

      const obj = next_hdr();
      obj.body = buf.slice(i0, i);
      yield obj;
    }

    {
      const obj = next_hdr({ fin });
      obj.body = buf.slice(i);
      yield obj;
    }
  }
};

// module-level helper functions

function bindTransportImpls(inbound, highbits, transports) {
  const outbound = [];
  outbound.choose = framings.choose;

  for (const frame of framings) {
    const impl = frame ? transports[frame.transport] : null;
    if (!impl) {
      continue;
    }

    const { bits, pack, unpack } = frame;
    const pkt_type = highbits | bits;
    const { t_recv } = impl;

    function pack_hdr(obj) {
      pack(pkt_type, obj);
      return obj;
    }

    function recv_msg(pkt, sink) {
      unpack(pkt);
      return t_recv(pkt, sink);
    }

    pack_hdr.pkt_type = recv_msg.pkt_type = pkt_type;
    outbound[bits] = pack_hdr;
    inbound[pkt_type] = recv_msg;

    
  }

  return outbound;
}

function init_shared(packetParser, options) {
  const shared = Object.assign({ packetParser, stateFor }, options);

  Object.assign(shared, multipart(packetParser, shared), streaming(packetParser, shared), transport(packetParser, shared));

  return shared;
}

function stateFor(pkt, sink, createState) {
  const { by_msgid } = sink,
        { msgid } = pkt.info;
  let state = by_msgid.get(msgid);
  if (undefined === state) {
    if (!msgid) {
      throw new Error(`Invalid msgid: ${msgid}`);
    }

    state = createState(pkt, sink, () => by_msgid.delete(msgid));
    by_msgid.set(msgid, state);
  }
  return state;
}

const noop_encodings = {
  encode(buf, obj, chan) {
    return buf;
  },
  decode(buf, info, sink) {
    return buf;
  } };

function json_protocol$1(shared, { encode, decode } = noop_encodings) {
  const { stateFor, createMultipart, createStream, json_pack } = shared;
  const { pack_utf8, unpack_utf8 } = shared.packetParser;
  const stream_msg_unpack = as_json_content;

  return {
    packBody,

    get datagram() {
      return this.direct;
    },
    direct: {
      t_recv(pkt, sink) {
        const info = pkt.info;
        const msg = unpackBodyBuf(pkt.body_buffer(), info, sink);
        return sink.recvMsg(msg, info);
      } },

    multipart: {
      t_recv(pkt, sink) {
        const state = stateFor(pkt, sink, createMultipart);
        const body_buf = state.feed(pkt);
        if (undefined !== body_buf) {
          const info = state.info;
          const msg = unpackBodyBuf(body_buf, info, sink);
          return sink.recvMsg(msg, info);
        }
      } },

    streaming: {
      mode: 'object',
      t_recv(pkt, sink) {
        const state = stateFor(pkt, sink, createStream);
        return state.feed(pkt, as_json_content, stream_msg_unpack);
      },

      msg_pack(msg, obj, chan) {
        const msg_buf = pack_utf8(json_pack(msg));
        return encode(msg_buf, obj, chan);
      } } };

  function packBody(body, obj, chan) {
    const body_buf = pack_utf8(json_pack(body));
    return encode(body_buf, obj, chan);
  }

  function as_json_content(pkt, sink) {
    const json_buf = decode(pkt.body_buffer(), pkt.info, sink);
    return sink.json_unpack(unpack_utf8(json_buf));
  }

  function unpackBodyBuf(body_buf, info, sink) {
    const json_buf = decode(body_buf, info, sink);
    return sink.json_unpack(json_buf ? unpack_utf8(json_buf) : undefined);
  }
}

const noop_encodings$1 = {
  encode(buf, obj, chan) {
    return buf;
  },
  decode(buf, info, sink) {
    return buf;
  } };

function binary_protocol$1(shared, { encode, decode } = noop_encodings$1) {
  const { stateFor, createMultipart, createStream } = shared;
  const { asBuffer } = shared.packetParser;

  return {
    packBody,

    get datagram() {
      return this.direct;
    },
    direct: {
      t_recv(pkt, sink) {
        const info = pkt.info;
        const body_buf = pkt.body_buffer();
        const msg = unpackBodyBuf(body_buf, info, sink);
        return sink.recvMsg(msg, info);
      } },

    multipart: {
      t_recv(pkt, sink) {
        const state = stateFor(pkt, sink, createMultipart);
        const body_buf = state.feed(pkt);
        if (undefined !== body_buf) {
          const info = state.info;
          const msg = unpackBodyBuf(body_buf, info, sink);
          return sink.recvMsg(msg, info);
        }
      } },

    streaming: {
      mode: 'bytes',
      t_recv(pkt, sink) {
        const state = stateFor(pkt, sink, createStream);
        const body_buf = state.feed(pkt, pkt_buffer, stream_msg_unpack);
        if (undefined !== body_buf) {
          const info = state.info;
          const msg = unpackBodyBuf(body_buf, info, sink);
          return sink.recvMsg(msg, info);
        }
      },

      msg_pack(msg, obj, chan) {
        const msg_buf = pack_utf8(json_pack(msg));
        return encode(msg_buf, obj, chan);
      } } };

  function stream_msg_unpack(pkt, sink) {
    const json_buf = decode(pkt.body_buffer(), pkt.info, sink);
    return sink.json_unpack(unpack_utf8(json_buf));
  }

  function packBody(body, obj, chan) {
    const body_buf = asBuffer(body);
    return encode(body_buf, obj, chan);
  }
  function unpackBodyBuf(body_buf, info, sink) {
    return decode(body_buf, info, sink);
  }
}

function pkt_buffer(pkt) {
  return pkt.body_buffer();
}

function control_protocol$1(inbound, high, shared) {
  const { chooseFraming, random_id } = shared;
  const { packPacketObj } = shared.packetParser;

  const ping_frame = chooseFraming({ from_id: true, token: true, transport: 'direct' });
  const pong_frame = chooseFraming({ from_id: true, msgid: true, transport: 'datagram' });

  const pong_type = high | 0xe;
  inbound[pong_type] = recv_pong;
  const ping_type = high | 0xf;
  inbound[high | 0xf] = recv_ping;

  return { send: ping, ping };

  function ping(chan, obj) {
    if (!obj.token) {
      obj.token = random_id();
    }
    obj.body = JSON.stringify({
      op: 'ping', ts0: new Date() });
    ping_frame.pack(ping_type, obj);
    const pkt = packPacketObj(obj);
    return chan.send(pkt);
  }

  function recv_ping(pkt, sink, router) {
    ping_frame.unpack(pkt);
    pkt.body = pkt.body_json();
    _send_pong(pkt.body, pkt, router);
    return sink.recvCtrl(pkt.body, pkt.info);
  }

  function _send_pong({ ts0 }, pkt_ping, router) {
    const { msgid, id_target, id_router, from_id: r_id } = pkt_ping.info;
    const obj = { msgid,
      from_id: { id_target, id_router },
      id_router: r_id.id_router, id_target: r_id.id_target,
      body: JSON.stringify({
        op: 'pong', ts0, ts1: new Date() }) };

    pong_frame.pack(pong_type, obj);
    const pkt = packPacketObj(obj);
    return router.dispatch([pkt]);
  }

  function recv_pong(pkt, sink) {
    pong_frame.unpack(pkt);
    pkt.body = pkt.body_json();
    return sink.recvCtrl(pkt.body, pkt.info);
  }
}

const default_plugin_options = {
  useStandard: true,
  json_pack: JSON.stringify,
  custom(protocols) {
    return protocols;
  } };

var plugin = function (plugin_options) {
  plugin_options = Object.assign({}, default_plugin_options, plugin_options);
  const { plugin_name, random_id, json_pack } = plugin_options;

  return { subclass, order: -1 // dependent on router plugin's (-2) providing packetParser
  };

  function subclass(FabricHub_PI, bases) {
    const { packetParser } = FabricHub_PI.prototype;
    if (null == packetParser || !packetParser.isPacketParser()) {
      throw new TypeError(`Invalid packetParser for plugin`);
    }

    const shared = init_shared(packetParser, { random_id, json_pack });
    let protocols = { shared, random_id, inbound: [], codecs: Object.create(null) };

    if (plugin_options.useStandard) {
      protocols = init_protocols(protocols);
    }

    protocols = plugin_options.custom(protocols);
    FabricHub_PI.prototype.protocols = protocols;
  }
};

function init_protocols(protocols) {
  const { inbound, codecs, shared } = protocols;

  codecs.default = codecs.json = shared.bindTransports( // 0x0* — JSON body
  inbound, 0x00, json_protocol$1(shared));

  codecs.binary = shared.bindTransports( // 0x1* — binary body
  inbound, 0x10, binary_protocol$1(shared));

  codecs.control = // 0xf* — control
  control_protocol$1(inbound, 0xf0, shared);

  return protocols;
}

const getRandomValues = 'undefined' !== typeof window ? window.crypto.getRandomValues : null;

protocols_browser.random_id = random_id;
function random_id() {
  const arr = new Int32Array(1);
  getRandomValues(arr);
  return arr[0];
}

function protocols_browser(plugin_options = {}) {
  if (null == plugin_options.random_id) {
    plugin_options.random_id = random_id;
  }

  return plugin(plugin_options);
}

export default protocols_browser;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5tanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvc2hhcmVkL2ZyYW1pbmcuanN5IiwiLi4vY29kZS9zaGFyZWQvbXVsdGlwYXJ0LmpzeSIsIi4uL2NvZGUvc2hhcmVkL3N0cmVhbWluZy5qc3kiLCIuLi9jb2RlL3NoYXJlZC90cmFuc3BvcnQuanN5IiwiLi4vY29kZS9zaGFyZWQvaW5kZXguanN5IiwiLi4vY29kZS9wcm90b2NvbHMvanNvbi5qc3kiLCIuLi9jb2RlL3Byb3RvY29scy9iaW5hcnkuanN5IiwiLi4vY29kZS9wcm90b2NvbHMvY29udHJvbC5qc3kiLCIuLi9jb2RlL3BsdWdpbi5qc3kiLCIuLi9jb2RlL2luZGV4LmJyb3dzZXIuanN5Il0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGxpdHRsZV9lbmRpYW4gPSB0cnVlXG5jb25zdCBjX3NpbmdsZSA9ICdzaW5nbGUnXG5jb25zdCBjX2RhdGFncmFtID0gJ2RhdGFncmFtJ1xuY29uc3QgY19kaXJlY3QgPSAnZGlyZWN0J1xuY29uc3QgY19tdWx0aXBhcnQgPSAnbXVsdGlwYXJ0J1xuY29uc3QgY19zdHJlYW1pbmcgPSAnc3RyZWFtaW5nJ1xuXG5jb25zdCBfZXJyX21zZ2lkX3JlcXVpcmVkID0gYFJlc3BvbnNlIHJlcWlyZXMgJ21zZ2lkJ2BcbmNvbnN0IF9lcnJfdG9rZW5fcmVxdWlyZWQgPSBgVHJhbnNwb3J0IHJlcWlyZXMgJ3Rva2VuJ2BcblxuXG5mdW5jdGlvbiBmcm1fcm91dGluZygpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHgxLCBtYXNrID0gMHgxXG4gIHJldHVybiBAe31cbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gbnVsbCAhPSBvYmouZnJvbV9pZCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGNvbnN0IHtmcm9tX2lkfSA9IG9ialxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgMHxmcm9tX2lkLmlkX3JvdXRlciwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MzIgQCA0K29mZnNldCwgMHxmcm9tX2lkLmlkX3RhcmdldCwgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgY29uc3QgZnJvbV9pZCA9IHVuZGVmaW5lZCA9PT0gb2JqLmZyb21faWRcbiAgICAgICAgPyBvYmouZnJvbV9pZCA9IHt9IDogb2JqLmZyb21faWRcbiAgICAgIGZyb21faWQuaWRfcm91dGVyID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgZnJvbV9pZC5pZF90YXJnZXQgPSBkdi5nZXRJbnQzMiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG5cbmZ1bmN0aW9uIGZybV9yZXNwb25zZSgpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHgyLCBtYXNrID0gMHgyXG4gIHJldHVybiBAe31cbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gbnVsbCAhPSBvYmoubXNnaWQgPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai5tc2dpZCA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX21zZ2lkX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoubXNnaWQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDB8b2JqLnNlcV9hY2ssIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNitvZmZzZXQsIDB8b2JqLmFja19mbGFncywgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLnRva2VuID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcV9hY2sgPSBkdi5nZXRJbnQxNiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouYWNrX2ZsYWdzID0gZHYuZ2V0SW50MTYgQCA2K29mZnNldCwgbGl0dGxlX2VuZGlhblxuXG5cblxuZnVuY3Rpb24gZnJtX2RhdGFncmFtKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDAsIGJpdHMgPSAweDAsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfZGF0YWdyYW1cbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OlxuICAgICAgaWYgY19kYXRhZ3JhbSA9PT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gYml0c1xuICAgICAgaWYgb2JqLnRyYW5zcG9ydCAmJiBjX3NpbmdsZSAhPT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gZmFsc2VcbiAgICAgIHJldHVybiAhIG9iai50b2tlbiA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX2RhdGFncmFtXG5cbmZ1bmN0aW9uIGZybV9kaXJlY3QoKSA6OlxuICBjb25zdCBzaXplID0gNCwgYml0cyA9IDB4NCwgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19kaXJlY3RcbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OlxuICAgICAgaWYgY19kaXJlY3QgPT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGJpdHNcbiAgICAgIGlmIG9iai50cmFuc3BvcnQgJiYgY19zaW5nbGUgIT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGZhbHNlXG4gICAgICByZXR1cm4gISEgb2JqLnRva2VuID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoudG9rZW4gOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl90b2tlbl9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLnRva2VuLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoubXNnaWQgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19kaXJlY3RcblxuZnVuY3Rpb24gZnJtX211bHRpcGFydCgpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHg4LCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX211bHRpcGFydFxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6IHJldHVybiBjX211bHRpcGFydCA9PT0gb2JqLnRyYW5zcG9ydCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgYmluZF9zZXFfbmV4dCwgc2VxX3BvczogNFxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai50b2tlbiA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX3Rva2VuX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoudG9rZW4sIGxpdHRsZV9lbmRpYW5cbiAgICAgIGlmIHRydWUgPT0gb2JqLnNlcSA6OiAvLyB1c2Ugc2VxX25leHRcbiAgICAgICAgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMCwgbGl0dGxlX2VuZGlhblxuICAgICAgZWxzZSBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwfG9iai5zZXEsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNitvZmZzZXQsIDB8b2JqLnNlcV9mbGFncywgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLm1zZ2lkICAgICA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXEgICAgICAgPSBkdi5nZXRJbnQxNiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxX2ZsYWdzID0gZHYuZ2V0SW50MTYgQCA2K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfbXVsdGlwYXJ0XG5cbmZ1bmN0aW9uIGZybV9zdHJlYW1pbmcoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4YywgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19zdHJlYW1pbmdcbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gY19zdHJlYW1pbmcgPT09IG9iai50cmFuc3BvcnQgPyBiaXRzIDogZmFsc2VcblxuICAgIGJpbmRfc2VxX25leHQsIHNlcV9wb3M6IDRcbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoudG9rZW4gOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl90b2tlbl9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLnRva2VuLCBsaXR0bGVfZW5kaWFuXG4gICAgICBpZiB0cnVlID09IG9iai5zZXEgOjpcbiAgICAgICAgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMCwgbGl0dGxlX2VuZGlhbiAvLyB1c2Ugc2VxX25leHRcbiAgICAgIGVsc2UgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMHxvYmouc2VxLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDYrb2Zmc2V0LCAwfG9iai5zZXFfZmxhZ3MsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai5tc2dpZCAgICAgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxICAgICAgID0gZHYuZ2V0SW50MTYgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcV9mbGFncyA9IGR2LmdldEludDE2IEAgNitvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX3N0cmVhbWluZ1xuXG5cbmZ1bmN0aW9uIGJpbmRfc2VxX25leHQob2Zmc2V0KSA6OlxuICBjb25zdCBzZXFfb2Zmc2V0ID0gdGhpcy5zZXFfcG9zICsgb2Zmc2V0XG4gIGxldCBzZXEgPSAxXG4gIHJldHVybiBmdW5jdGlvbiBzZXFfbmV4dCh7ZmxhZ3MsIGZpbn0sIGR2KSA6OlxuICAgIGlmICEgZmluIDo6XG4gICAgICBkdi5zZXRJbnQxNiBAIHNlcV9vZmZzZXQsIHNlcSsrLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDIrc2VxX29mZnNldCwgMHxmbGFncywgbGl0dGxlX2VuZGlhblxuICAgIGVsc2UgOjpcbiAgICAgIGR2LnNldEludDE2IEAgc2VxX29mZnNldCwgLXNlcSwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCAyK3NlcV9vZmZzZXQsIDB8ZmxhZ3MsIGxpdHRsZV9lbmRpYW5cbiAgICAgIHNlcSA9IE5hTlxuXG5cblxuZXhwb3J0IGRlZmF1bHQgY29tcG9zZUZyYW1pbmdzKClcbmZ1bmN0aW9uIGNvbXBvc2VGcmFtaW5ncygpIDo6XG4gIGNvbnN0IGZybV9mcm9tID0gZnJtX3JvdXRpbmcoKSwgZnJtX3Jlc3AgPSBmcm1fcmVzcG9uc2UoKVxuICBjb25zdCBmcm1fdHJhbnNwb3J0cyA9IEBbXSBmcm1fZGF0YWdyYW0oKSwgZnJtX2RpcmVjdCgpLCBmcm1fbXVsdGlwYXJ0KCksIGZybV9zdHJlYW1pbmcoKVxuXG4gIGlmIDggIT09IGZybV9mcm9tLnNpemUgfHwgOCAhPT0gZnJtX3Jlc3Auc2l6ZSB8fCA0ICE9IGZybV90cmFuc3BvcnRzLmxlbmd0aCA6OlxuICAgIHRocm93IG5ldyBFcnJvciBAIGBGcmFtaW5nIFNpemUgY2hhbmdlYFxuXG4gIGNvbnN0IGJ5Qml0cyA9IFtdLCBtYXNrPTB4ZlxuXG4gIDo6XG4gICAgY29uc3QgdF9mcm9tID0gZnJtX2Zyb20uZl90ZXN0LCB0X3Jlc3AgPSBmcm1fcmVzcC5mX3Rlc3RcbiAgICBjb25zdCBbdDAsdDEsdDIsdDNdID0gZnJtX3RyYW5zcG9ydHMubWFwIEAgZj0+Zi5mX3Rlc3RcblxuICAgIGNvbnN0IHRlc3RCaXRzID0gYnlCaXRzLnRlc3RCaXRzID0gb2JqID0+XG4gICAgICAwIHwgdF9mcm9tKG9iaikgfCB0X3Jlc3Aob2JqKSB8IHQwKG9iaikgfCB0MShvYmopIHwgdDIob2JqKSB8IHQzKG9iailcblxuICAgIGJ5Qml0cy5jaG9vc2UgPSBmdW5jdGlvbiAob2JqLCBsc3QpIDo6XG4gICAgICBpZiBudWxsID09IGxzdCA6OiBsc3QgPSB0aGlzIHx8IGJ5Qml0c1xuICAgICAgcmV0dXJuIGxzdFt0ZXN0Qml0cyhvYmopXVxuXG5cbiAgZm9yIGNvbnN0IFQgb2YgZnJtX3RyYW5zcG9ydHMgOjpcbiAgICBjb25zdCB7Yml0czpiLCBzaXplLCB0cmFuc3BvcnR9ID0gVFxuXG4gICAgYnlCaXRzW2J8MF0gPSBAe30gVCwgdHJhbnNwb3J0LCBiaXRzOiBifDAsIG1hc2ssIHNpemU6IHNpemUsIG9wOiAnJ1xuICAgIGJ5Qml0c1tifDFdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwxLCBtYXNrLCBzaXplOiA4ICsgc2l6ZSwgb3A6ICdmJ1xuICAgIGJ5Qml0c1tifDJdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwyLCBtYXNrLCBzaXplOiA4ICsgc2l6ZSwgb3A6ICdyJ1xuICAgIGJ5Qml0c1tifDNdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwzLCBtYXNrLCBzaXplOiAxNiArIHNpemUsIG9wOiAnZnInXG5cbiAgICBmb3IgY29uc3QgZm5fa2V5IG9mIFsnZl9wYWNrJywgJ2ZfdW5wYWNrJ10gOjpcbiAgICAgIGNvbnN0IGZuX3RyYW4gPSBUW2ZuX2tleV0sIGZuX2Zyb20gPSBmcm1fZnJvbVtmbl9rZXldLCBmbl9yZXNwID0gZnJtX3Jlc3BbZm5fa2V5XVxuXG4gICAgICBieUJpdHNbYnwwXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fdHJhbihvYmosIGR2LCAwKVxuICAgICAgYnlCaXRzW2J8MV1bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX2Zyb20ob2JqLCBkdiwgMCk7IGZuX3RyYW4ob2JqLCBkdiwgOClcbiAgICAgIGJ5Qml0c1tifDJdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl9yZXNwKG9iaiwgZHYsIDApOyBmbl90cmFuKG9iaiwgZHYsIDgpXG4gICAgICBieUJpdHNbYnwzXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fZnJvbShvYmosIGR2LCAwKTsgZm5fcmVzcChvYmosIGR2LCA4KTsgZm5fdHJhbihvYmosIGR2LCAxNilcblxuICBmb3IgY29uc3QgZnJtIG9mIGJ5Qml0cyA6OlxuICAgIGJpbmRBc3NlbWJsZWQgQCBmcm1cblxuICByZXR1cm4gYnlCaXRzXG5cblxuZnVuY3Rpb24gYmluZEFzc2VtYmxlZChmcm0pIDo6XG4gIGNvbnN0IHtULCBzaXplLCBmX3BhY2ssIGZfdW5wYWNrfSA9IGZybVxuICBpZiBULmJpbmRfc2VxX25leHQgOjpcbiAgICBmcm0uc2VxX25leHQgPSBULmJpbmRfc2VxX25leHQgQCBmcm0uc2l6ZSAtIFQuc2l6ZVxuXG4gIGRlbGV0ZSBmcm0uVFxuICBmcm0ucGFjayA9IHBhY2sgOyBmcm0udW5wYWNrID0gdW5wYWNrXG4gIGNvbnN0IHNlcV9uZXh0ID0gZnJtLnNlcV9uZXh0XG5cbiAgZnVuY3Rpb24gcGFjayhwa3RfdHlwZSwgcGt0X29iaikgOjpcbiAgICBpZiAhIEAgMCA8PSBwa3RfdHlwZSAmJiBwa3RfdHlwZSA8PSAyNTUgOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgRXhwZWN0ZWQgcGt0X3R5cGUgdG8gYmUgWzAuLjI1NV1gXG5cbiAgICBwa3Rfb2JqLnR5cGUgPSBwa3RfdHlwZVxuICAgIGlmIHNlcV9uZXh0ICYmIG51bGwgPT0gcGt0X29iai5zZXEgOjpcbiAgICAgIHBrdF9vYmouc2VxID0gdHJ1ZVxuXG4gICAgY29uc3QgZHYgPSBuZXcgRGF0YVZpZXcgQCBuZXcgQXJyYXlCdWZmZXIoc2l6ZSlcbiAgICBmX3BhY2socGt0X29iaiwgZHYsIDApXG4gICAgcGt0X29iai5oZWFkZXIgPSBkdi5idWZmZXJcblxuICAgIGlmIHRydWUgPT09IHBrdF9vYmouc2VxIDo6XG4gICAgICBfYmluZF9pdGVyYWJsZSBAIHBrdF9vYmosIGR2LmJ1ZmZlci5zbGljZSgwLHNpemUpXG5cbiAgZnVuY3Rpb24gdW5wYWNrKHBrdCkgOjpcbiAgICBjb25zdCBidWYgPSBwa3QuaGVhZGVyX2J1ZmZlcigpXG4gICAgY29uc3QgZHYgPSBuZXcgRGF0YVZpZXcgQCBuZXcgVWludDhBcnJheShidWYpLmJ1ZmZlclxuXG4gICAgY29uc3QgaW5mbyA9IHt9XG4gICAgZl91bnBhY2soaW5mbywgZHYsIDApXG4gICAgcmV0dXJuIHBrdC5pbmZvID0gaW5mb1xuXG4gIGZ1bmN0aW9uIF9iaW5kX2l0ZXJhYmxlKHBrdF9vYmosIGJ1Zl9jbG9uZSkgOjpcbiAgICBjb25zdCB7dHlwZX0gPSBwa3Rfb2JqXG4gICAgY29uc3Qge2lkX3JvdXRlciwgaWRfdGFyZ2V0LCB0dGwsIHRva2VufSA9IHBrdF9vYmpcbiAgICBwa3Rfb2JqLm5leHQgPSBuZXh0XG5cbiAgICBmdW5jdGlvbiBuZXh0KG9wdGlvbnMpIDo6XG4gICAgICBpZiBudWxsID09IG9wdGlvbnMgOjogb3B0aW9ucyA9IHt9XG4gICAgICBjb25zdCBoZWFkZXIgPSBidWZfY2xvbmUuc2xpY2UoKVxuICAgICAgc2VxX25leHQgQCBvcHRpb25zLCBuZXcgRGF0YVZpZXcgQCBoZWFkZXJcbiAgICAgIHJldHVybiBAe30gZG9uZTogISEgb3B0aW9ucy5maW4sIHZhbHVlOiBAe30gLy8gcGt0X29ialxuICAgICAgICBpZF9yb3V0ZXIsIGlkX3RhcmdldCwgdHlwZSwgdHRsLCB0b2tlbiwgaGVhZGVyXG5cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBhY2tldFBhcnNlciwgc2hhcmVkKSA6OlxuICBjb25zdCB7Y29uY2F0QnVmZmVyc30gPSBwYWNrZXRQYXJzZXJcbiAgcmV0dXJuIEB7fSBjcmVhdGVNdWx0aXBhcnRcblxuXG4gIGZ1bmN0aW9uIGNyZWF0ZU11bHRpcGFydChwa3QsIHNpbmssIGRlbGV0ZVN0YXRlKSA6OlxuICAgIGxldCBwYXJ0cyA9IFtdLCBmaW4gPSBmYWxzZVxuICAgIHJldHVybiBAe30gZmVlZCwgaW5mbzogcGt0LmluZm9cblxuICAgIGZ1bmN0aW9uIGZlZWQocGt0KSA6OlxuICAgICAgbGV0IHNlcSA9IHBrdC5pbmZvLnNlcVxuICAgICAgaWYgc2VxIDwgMCA6OiBmaW4gPSB0cnVlOyBzZXEgPSAtc2VxXG4gICAgICBwYXJ0c1tzZXEtMV0gPSBwa3QuYm9keV9idWZmZXIoKVxuXG4gICAgICBpZiAhIGZpbiA6OiByZXR1cm5cbiAgICAgIGlmIHBhcnRzLmluY2x1ZGVzIEAgdW5kZWZpbmVkIDo6IHJldHVyblxuXG4gICAgICBkZWxldGVTdGF0ZSgpXG5cbiAgICAgIGNvbnN0IHJlcyA9IGNvbmNhdEJ1ZmZlcnMocGFydHMpXG4gICAgICBwYXJ0cyA9IG51bGxcbiAgICAgIHJldHVybiByZXNcblxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIHJldHVybiBAe30gY3JlYXRlU3RyZWFtXG5cblxuICBmdW5jdGlvbiBjcmVhdGVTdHJlYW0ocGt0LCBzaW5rLCBkZWxldGVTdGF0ZSkgOjpcbiAgICBsZXQgbmV4dD0wLCBmaW4gPSBmYWxzZSwgcmVjdkRhdGEsIHJzdHJlYW1cbiAgICBjb25zdCBzdGF0ZSA9IEB7fSBmZWVkOiBmZWVkX2luaXQsIGluZm86IHBrdC5pbmZvXG4gICAgcmV0dXJuIHN0YXRlXG5cbiAgICBmdW5jdGlvbiBmZWVkX2luaXQocGt0LCBhc19jb250ZW50LCBtc2dfdW5wYWNrKSA6OlxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfaWdub3JlXG5cbiAgICAgIGNvbnN0IGluZm8gPSBwa3QuaW5mb1xuICAgICAgY29uc3QgbXNnID0gbXNnX3VucGFja1xuICAgICAgICA/IG1zZ191bnBhY2socGt0LCBzaW5rKVxuICAgICAgICA6IHNpbmsuanNvbl91bnBhY2sgQCBwa3QuYm9keV91dGY4KClcbiAgICAgIHJzdHJlYW0gPSBzaW5rLnJlY3ZTdHJlYW0obXNnLCBpbmZvKVxuICAgICAgaWYgbnVsbCA9PSByc3RyZWFtIDo6IHJldHVyblxuICAgICAgY2hlY2tfZm5zIEAgcnN0cmVhbSwgJ29uX2Vycm9yJywgJ29uX2RhdGEnLCAnb25fZW5kJyBcbiAgICAgIHJlY3ZEYXRhID0gc2luay5yZWN2U3RyZWFtRGF0YS5iaW5kKHNpbmssIHJzdHJlYW0sIGluZm8pXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBmZWVkX3NlcShwa3QpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZXJyb3IgQCBlcnIsIHBrdFxuXG4gICAgICBzdGF0ZS5mZWVkID0gZmVlZF9ib2R5XG4gICAgICBpZiByc3RyZWFtLm9uX2luaXQgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25faW5pdChtc2csIHBrdClcblxuICAgIGZ1bmN0aW9uIGZlZWRfYm9keShwa3QsIGFzX2NvbnRlbnQpIDo6XG4gICAgICByZWN2RGF0YSgpXG4gICAgICBsZXQgZGF0YVxuICAgICAgdHJ5IDo6XG4gICAgICAgIGZlZWRfc2VxKHBrdClcbiAgICAgICAgZGF0YSA9IGFzX2NvbnRlbnQocGt0LCBzaW5rKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2Vycm9yIEAgZXJyLCBwa3RcblxuICAgICAgaWYgZmluIDo6XG4gICAgICAgIGNvbnN0IHJlcyA9IHJzdHJlYW0ub25fZGF0YSBAIGRhdGEsIHBrdFxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9lbmQgQCByZXMsIHBrdFxuICAgICAgZWxzZSA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9kYXRhIEAgZGF0YSwgcGt0XG5cbiAgICBmdW5jdGlvbiBmZWVkX2lnbm9yZShwa3QpIDo6XG4gICAgICB0cnkgOjogZmVlZF9zZXEocGt0KVxuICAgICAgY2F0Y2ggZXJyIDo6XG5cbiAgICBmdW5jdGlvbiBmZWVkX3NlcShwa3QpIDo6XG4gICAgICBsZXQgc2VxID0gcGt0LmluZm8uc2VxXG4gICAgICBpZiBzZXEgPj0gMCA6OlxuICAgICAgICBpZiBuZXh0KysgPT09IHNlcSA6OlxuICAgICAgICAgIHJldHVybiAvLyBpbiBvcmRlclxuICAgICAgZWxzZSA6OlxuICAgICAgICBmaW4gPSB0cnVlXG4gICAgICAgIGRlbGV0ZVN0YXRlKClcbiAgICAgICAgaWYgbmV4dCA9PT0gLXNlcSA6OlxuICAgICAgICAgIG5leHQgPSAnZG9uZSdcbiAgICAgICAgICByZXR1cm4gLy8gaW4tb3JkZXIsIGxhc3QgcGFja2V0XG5cbiAgICAgIHN0YXRlLmZlZWQgPSBmZWVkX2lnbm9yZVxuICAgICAgbmV4dCA9ICdpbnZhbGlkJ1xuICAgICAgdGhyb3cgbmV3IEVycm9yIEAgYFBhY2tldCBvdXQgb2Ygc2VxdWVuY2VgXG5cblxuZnVuY3Rpb24gY2hlY2tfZm5zKG9iaiwgLi4ua2V5cykgOjpcbiAgZm9yIGNvbnN0IGtleSBvZiBrZXlzIDo6XG4gICAgaWYgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG9ialtrZXldIDo6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYEV4cGVjdGVkIFwiJHtrZXl9XCIgdG8gYmUgYSBmdW5jdGlvbmBcblxuIiwiaW1wb3J0IGZyYW1pbmdzIGZyb20gJy4vZnJhbWluZy5qc3knXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBhY2tldFBhcnNlciwgc2hhcmVkKSA6OlxuICBjb25zdCB7cGFja1BhY2tldE9ian0gPSBwYWNrZXRQYXJzZXJcbiAgY29uc3Qge3JhbmRvbV9pZCwganNvbl9wYWNrfSA9IHNoYXJlZFxuICBjb25zdCB7Y2hvb3NlOiBjaG9vc2VGcmFtaW5nfSA9IGZyYW1pbmdzXG5cbiAgY29uc3QgZnJhZ21lbnRfc2l6ZSA9IE51bWJlciBAIHNoYXJlZC5mcmFnbWVudF9zaXplIHx8IDgwMDBcbiAgaWYgMTAyNCA+IGZyYWdtZW50X3NpemUgfHwgNjUwMDAgPCBmcmFnbWVudF9zaXplIDo6XG4gICAgdGhyb3cgbmV3IEVycm9yIEAgYEludmFsaWQgZnJhZ21lbnQgc2l6ZTogJHtmcmFnbWVudF9zaXplfWBcblxuICByZXR1cm4gQHt9IGJpbmRUcmFuc3BvcnRzLCBwYWNrZXRGcmFnbWVudHMsIGNob29zZUZyYW1pbmdcblxuXG4gIGZ1bmN0aW9uIGJpbmRUcmFuc3BvcnRzKGluYm91bmQsIGhpZ2hiaXRzLCB0cmFuc3BvcnRzKSA6OlxuICAgIGNvbnN0IHBhY2tCb2R5ID0gdHJhbnNwb3J0cy5wYWNrQm9keVxuICAgIGNvbnN0IG91dGJvdW5kID0gYmluZFRyYW5zcG9ydEltcGxzKGluYm91bmQsIGhpZ2hiaXRzLCB0cmFuc3BvcnRzKVxuXG4gICAgaWYgdHJhbnNwb3J0cy5zdHJlYW1pbmcgOjpcbiAgICAgIHJldHVybiBAe30gc2VuZCwgc3RyZWFtOiBiaW5kU3RyZWFtKClcblxuICAgIHJldHVybiBAe30gc2VuZFxuXG5cblxuICAgIGZ1bmN0aW9uIHNlbmQoY2hhbiwgb2JqLCBib2R5KSA6OlxuICAgICAgYm9keSA9IHBhY2tCb2R5KGJvZHksIG9iaiwgY2hhbilcbiAgICAgIGlmIGZyYWdtZW50X3NpemUgPCBib2R5LmJ5dGVMZW5ndGggOjpcbiAgICAgICAgaWYgISBvYmoudG9rZW4gOjogb2JqLnRva2VuID0gcmFuZG9tX2lkKClcbiAgICAgICAgb2JqLnRyYW5zcG9ydCA9ICdtdWx0aXBhcnQnXG4gICAgICAgIGNvbnN0IG1zZW5kID0gbXNlbmRfYnl0ZXMoY2hhbiwgb2JqKVxuICAgICAgICByZXR1cm4gbXNlbmQgQCB0cnVlLCBib2R5XG5cbiAgICAgIG9iai50cmFuc3BvcnQgPSAnc2luZ2xlJ1xuICAgICAgb2JqLmJvZHkgPSBib2R5XG4gICAgICBjb25zdCBwYWNrX2hkciA9IG91dGJvdW5kLmNob29zZShvYmopXG4gICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgcGFja19oZHIob2JqKVxuICAgICAgcmV0dXJuIGNoYW4uc2VuZCBAIHBrdFxuXG5cbiAgICBmdW5jdGlvbiBtc2VuZF9ieXRlcyhjaGFuLCBvYmosIG1zZykgOjpcbiAgICAgIGNvbnN0IHBhY2tfaGRyID0gb3V0Ym91bmQuY2hvb3NlKG9iailcbiAgICAgIGxldCB7bmV4dH0gPSBwYWNrX2hkcihvYmopXG4gICAgICBpZiBudWxsICE9PSBtc2cgOjpcbiAgICAgICAgb2JqLmJvZHkgPSBtc2dcbiAgICAgICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgICAgICBjaGFuLnNlbmQgQCBwa3RcblxuICAgICAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uIChmaW4sIGJvZHkpIDo6XG4gICAgICAgIGlmIG51bGwgPT09IG5leHQgOjpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgQCAnV3JpdGUgYWZ0ZXIgZW5kJ1xuICAgICAgICBsZXQgcmVzXG4gICAgICAgIGZvciBjb25zdCBvYmogb2YgcGFja2V0RnJhZ21lbnRzIEAgYm9keSwgbmV4dCwgZmluIDo6XG4gICAgICAgICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgICAgICAgIHJlcyA9IGF3YWl0IGNoYW4uc2VuZCBAIHBrdFxuICAgICAgICBpZiBmaW4gOjogbmV4dCA9IG51bGxcbiAgICAgICAgcmV0dXJuIHJlc1xuXG5cbiAgICBmdW5jdGlvbiBtc2VuZF9vYmplY3RzKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgY29uc3QgcGFja19oZHIgPSBvdXRib3VuZC5jaG9vc2Uob2JqKVxuICAgICAgbGV0IHtuZXh0fSA9IHBhY2tfaGRyKG9iailcbiAgICAgIGlmIG51bGwgIT09IG1zZyA6OlxuICAgICAgICBvYmouYm9keSA9IG1zZ1xuICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgIGNoYW4uc2VuZCBAIHBrdFxuXG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGZpbiwgYm9keSkgOjpcbiAgICAgICAgaWYgbnVsbCA9PT0gbmV4dCA6OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBAICdXcml0ZSBhZnRlciBlbmQnXG4gICAgICAgIGNvbnN0IG9iaiA9IG5leHQoe2Zpbn0pXG4gICAgICAgIG9iai5ib2R5ID0gYm9keVxuICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgIGlmIGZpbiA6OiBuZXh0ID0gbnVsbFxuICAgICAgICByZXR1cm4gY2hhbi5zZW5kIEAgcGt0XG5cblxuICAgIGZ1bmN0aW9uIGJpbmRTdHJlYW0oKSA6OlxuICAgICAgY29uc3Qge21vZGUsIG1zZ19wYWNrfSA9IHRyYW5zcG9ydHMuc3RyZWFtaW5nXG4gICAgICBjb25zdCBtc2VuZF9pbXBsID0ge29iamVjdDogbXNlbmRfb2JqZWN0cywgYnl0ZXM6IG1zZW5kX2J5dGVzfVttb2RlXVxuICAgICAgaWYgbXNlbmRfaW1wbCA6OiByZXR1cm4gc3RyZWFtXG5cbiAgICAgIGZ1bmN0aW9uIHN0cmVhbShjaGFuLCBvYmosIG1zZykgOjpcbiAgICAgICAgaWYgISBvYmoudG9rZW4gOjogb2JqLnRva2VuID0gcmFuZG9tX2lkKClcbiAgICAgICAgb2JqLnRyYW5zcG9ydCA9ICdzdHJlYW1pbmcnXG4gICAgICAgIG1zZyA9IG1zZ19wYWNrXG4gICAgICAgICAgPyBtc2dfcGFjayhtc2csIG9iaiwgY2hhbilcbiAgICAgICAgICA6IGpzb25fcGFjayhtc2cpXG4gICAgICAgIGNvbnN0IG1zZW5kID0gbXNlbmRfaW1wbCBAIGNoYW4sIG9iaiwgbXNnXG4gICAgICAgIHdyaXRlLndyaXRlID0gd3JpdGU7IHdyaXRlLmVuZCA9IHdyaXRlLmJpbmQodHJ1ZSlcbiAgICAgICAgcmV0dXJuIHdyaXRlXG5cbiAgICAgICAgZnVuY3Rpb24gd3JpdGUoY2h1bmspIDo6XG4gICAgICAgICAgLy8gbXNlbmQgQCBmaW4sIGJvZHlcbiAgICAgICAgICByZXR1cm4gY2h1bmsgIT0gbnVsbFxuICAgICAgICAgICAgPyBtc2VuZCBAIHRydWU9PT10aGlzLCBwYWNrQm9keShjaHVuaywgb2JqLCBjaGFuKVxuICAgICAgICAgICAgOiBtc2VuZCBAIHRydWVcblxuXG4gIGZ1bmN0aW9uICogcGFja2V0RnJhZ21lbnRzKGJ1ZiwgbmV4dF9oZHIsIGZpbikgOjpcbiAgICBpZiBudWxsID09IGJ1ZiA6OlxuICAgICAgY29uc3Qgb2JqID0gbmV4dF9oZHIoe2Zpbn0pXG4gICAgICB5aWVsZCBvYmpcbiAgICAgIHJldHVyblxuXG4gICAgbGV0IGkgPSAwLCBsYXN0SW5uZXIgPSBidWYuYnl0ZUxlbmd0aCAtIGZyYWdtZW50X3NpemU7XG4gICAgd2hpbGUgaSA8IGxhc3RJbm5lciA6OlxuICAgICAgY29uc3QgaTAgPSBpXG4gICAgICBpICs9IGZyYWdtZW50X3NpemVcblxuICAgICAgY29uc3Qgb2JqID0gbmV4dF9oZHIoKVxuICAgICAgb2JqLmJvZHkgPSBidWYuc2xpY2UoaTAsIGkpXG4gICAgICB5aWVsZCBvYmpcblxuICAgIDo6XG4gICAgICBjb25zdCBvYmogPSBuZXh0X2hkcih7ZmlufSlcbiAgICAgIG9iai5ib2R5ID0gYnVmLnNsaWNlKGkpXG4gICAgICB5aWVsZCBvYmpcblxuXG5cblxuLy8gbW9kdWxlLWxldmVsIGhlbHBlciBmdW5jdGlvbnNcblxuZnVuY3Rpb24gYmluZFRyYW5zcG9ydEltcGxzKGluYm91bmQsIGhpZ2hiaXRzLCB0cmFuc3BvcnRzKSA6OlxuICBjb25zdCBvdXRib3VuZCA9IFtdXG4gIG91dGJvdW5kLmNob29zZSA9IGZyYW1pbmdzLmNob29zZVxuXG4gIGZvciBjb25zdCBmcmFtZSBvZiBmcmFtaW5ncyA6OlxuICAgIGNvbnN0IGltcGwgPSBmcmFtZSA/IHRyYW5zcG9ydHNbZnJhbWUudHJhbnNwb3J0XSA6IG51bGxcbiAgICBpZiAhIGltcGwgOjogY29udGludWVcblxuICAgIGNvbnN0IHtiaXRzLCBwYWNrLCB1bnBhY2t9ID0gZnJhbWVcbiAgICBjb25zdCBwa3RfdHlwZSA9IGhpZ2hiaXRzIHwgYml0c1xuICAgIGNvbnN0IHt0X3JlY3Z9ID0gaW1wbFxuXG4gICAgZnVuY3Rpb24gcGFja19oZHIob2JqKSA6OlxuICAgICAgcGFjayhwa3RfdHlwZSwgb2JqKVxuICAgICAgcmV0dXJuIG9ialxuXG4gICAgZnVuY3Rpb24gcmVjdl9tc2cocGt0LCBzaW5rKSA6OlxuICAgICAgdW5wYWNrKHBrdClcbiAgICAgIHJldHVybiB0X3JlY3YocGt0LCBzaW5rKVxuXG4gICAgcGFja19oZHIucGt0X3R5cGUgPSByZWN2X21zZy5wa3RfdHlwZSA9IHBrdF90eXBlXG4gICAgb3V0Ym91bmRbYml0c10gPSBwYWNrX2hkclxuICAgIGluYm91bmRbcGt0X3R5cGVdID0gcmVjdl9tc2dcblxuICAgIGlmICdwcm9kdWN0aW9uJyAhPT0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgOjpcbiAgICAgIGNvbnN0IG9wID0gcGFja19oZHIub3AgPSByZWN2X21zZy5vcCA9IGZyYW1lLm9wXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgQCBwYWNrX2hkciwgJ25hbWUnLCBAe30gdmFsdWU6IGBwYWNrX2hkciDCqyR7b3B9wrtgXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgQCByZWN2X21zZywgJ25hbWUnLCBAe30gdmFsdWU6IGByZWN2X21zZyDCqyR7b3B9wrtgXG5cbiAgcmV0dXJuIG91dGJvdW5kXG5cbiIsImV4cG9ydCAqIGZyb20gJy4vZnJhbWluZy5qc3knXG5leHBvcnQgKiBmcm9tICcuL211bHRpcGFydC5qc3knXG5leHBvcnQgKiBmcm9tICcuL3N0cmVhbWluZy5qc3knXG5leHBvcnQgKiBmcm9tICcuL3RyYW5zcG9ydC5qc3knXG5cbmltcG9ydCBtdWx0aXBhcnQgZnJvbSAnLi9tdWx0aXBhcnQuanN5J1xuaW1wb3J0IHN0cmVhbWluZyBmcm9tICcuL3N0cmVhbWluZy5qc3knXG5pbXBvcnQgdHJhbnNwb3J0IGZyb20gJy4vdHJhbnNwb3J0LmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaW5pdF9zaGFyZWQocGFja2V0UGFyc2VyLCBvcHRpb25zKSA6OlxuICBjb25zdCBzaGFyZWQgPSBPYmplY3QuYXNzaWduIEAge3BhY2tldFBhcnNlciwgc3RhdGVGb3J9LCBvcHRpb25zXG5cbiAgT2JqZWN0LmFzc2lnbiBAIHNoYXJlZCxcbiAgICBtdWx0aXBhcnQgQCBwYWNrZXRQYXJzZXIsIHNoYXJlZFxuICAgIHN0cmVhbWluZyBAIHBhY2tldFBhcnNlciwgc2hhcmVkXG4gICAgdHJhbnNwb3J0IEAgcGFja2V0UGFyc2VyLCBzaGFyZWRcblxuICByZXR1cm4gc2hhcmVkXG5cbmZ1bmN0aW9uIHN0YXRlRm9yKHBrdCwgc2luaywgY3JlYXRlU3RhdGUpIDo6XG4gIGNvbnN0IHtieV9tc2dpZH0gPSBzaW5rLCB7bXNnaWR9ID0gcGt0LmluZm9cbiAgbGV0IHN0YXRlID0gYnlfbXNnaWQuZ2V0KG1zZ2lkKVxuICBpZiB1bmRlZmluZWQgPT09IHN0YXRlIDo6XG4gICAgaWYgISBtc2dpZCA6OiB0aHJvdyBuZXcgRXJyb3IgQCBgSW52YWxpZCBtc2dpZDogJHttc2dpZH1gXG5cbiAgICBzdGF0ZSA9IGNyZWF0ZVN0YXRlIEAgcGt0LCBzaW5rLCAoKSA9PiBieV9tc2dpZC5kZWxldGUobXNnaWQpXG4gICAgYnlfbXNnaWQuc2V0IEAgbXNnaWQsIHN0YXRlXG4gIHJldHVybiBzdGF0ZVxuXG4iLCJjb25zdCBub29wX2VuY29kaW5ncyA9IEB7fVxuICBlbmNvZGUoYnVmLCBvYmosIGNoYW4pIDo6IHJldHVybiBidWZcbiAgZGVjb2RlKGJ1ZiwgaW5mbywgc2luaykgOjogcmV0dXJuIGJ1ZlxuXG5leHBvcnQgZGVmYXVsdCBqc29uX3Byb3RvY29sXG5leHBvcnQgZnVuY3Rpb24ganNvbl9wcm90b2NvbChzaGFyZWQsIHtlbmNvZGUsIGRlY29kZX09bm9vcF9lbmNvZGluZ3MpIDo6XG4gIGNvbnN0IHtzdGF0ZUZvciwgY3JlYXRlTXVsdGlwYXJ0LCBjcmVhdGVTdHJlYW0sIGpzb25fcGFja30gPSBzaGFyZWRcbiAgY29uc3Qge3BhY2tfdXRmOCwgdW5wYWNrX3V0Zjh9ID0gc2hhcmVkLnBhY2tldFBhcnNlclxuICBjb25zdCBzdHJlYW1fbXNnX3VucGFjayA9IGFzX2pzb25fY29udGVudFxuXG4gIHJldHVybiBAe31cbiAgICBwYWNrQm9keVxuXG4gICAgZ2V0IGRhdGFncmFtKCkgOjogcmV0dXJuIHRoaXMuZGlyZWN0XG4gICAgZGlyZWN0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IGluZm8gPSBwa3QuaW5mb1xuICAgICAgICBjb25zdCBtc2cgPSB1bnBhY2tCb2R5QnVmIEAgcGt0LmJvZHlfYnVmZmVyKCksIGluZm8sIHNpbmtcbiAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgaW5mb1xuXG4gICAgbXVsdGlwYXJ0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RhdGVGb3IgQCBwa3QsIHNpbmssIGNyZWF0ZU11bHRpcGFydFxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHN0YXRlLmZlZWQocGt0KVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IGJvZHlfYnVmIDo6XG4gICAgICAgICAgY29uc3QgaW5mbyA9IHN0YXRlLmluZm9cbiAgICAgICAgICBjb25zdCBtc2cgPSB1bnBhY2tCb2R5QnVmIEAgYm9keV9idWYsIGluZm8sIHNpbmtcbiAgICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBpbmZvXG5cbiAgICBzdHJlYW1pbmc6IEB7fVxuICAgICAgbW9kZTogJ29iamVjdCdcbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RhdGVGb3IgQCBwa3QsIHNpbmssIGNyZWF0ZVN0cmVhbVxuICAgICAgICByZXR1cm4gc3RhdGUuZmVlZChwa3QsIGFzX2pzb25fY29udGVudCwgc3RyZWFtX21zZ191bnBhY2spXG5cbiAgICAgIG1zZ19wYWNrKG1zZywgb2JqLCBjaGFuKSA6OlxuICAgICAgICBjb25zdCBtc2dfYnVmID0gcGFja191dGY4IEAganNvbl9wYWNrIEAgbXNnXG4gICAgICAgIHJldHVybiBlbmNvZGUobXNnX2J1Ziwgb2JqLCBjaGFuKVxuXG5cbiAgZnVuY3Rpb24gcGFja0JvZHkoYm9keSwgb2JqLCBjaGFuKSA6OlxuICAgIGNvbnN0IGJvZHlfYnVmID0gcGFja191dGY4IEAganNvbl9wYWNrIEAgYm9keVxuICAgIHJldHVybiBlbmNvZGUoYm9keV9idWYsIG9iaiwgY2hhbilcblxuICBmdW5jdGlvbiBhc19qc29uX2NvbnRlbnQocGt0LCBzaW5rKSA6OlxuICAgIGNvbnN0IGpzb25fYnVmID0gZGVjb2RlKHBrdC5ib2R5X2J1ZmZlcigpLCBwa3QuaW5mbywgc2luaylcbiAgICByZXR1cm4gc2luay5qc29uX3VucGFjayBAIHVucGFja191dGY4IEAganNvbl9idWZcblxuICBmdW5jdGlvbiB1bnBhY2tCb2R5QnVmKGJvZHlfYnVmLCBpbmZvLCBzaW5rKSA6OlxuICAgIGNvbnN0IGpzb25fYnVmID0gZGVjb2RlKGJvZHlfYnVmLCBpbmZvLCBzaW5rKVxuICAgIHJldHVybiBzaW5rLmpzb25fdW5wYWNrIEAganNvbl9idWYgPyB1bnBhY2tfdXRmOChqc29uX2J1ZikgOiB1bmRlZmluZWRcblxuIiwiY29uc3Qgbm9vcF9lbmNvZGluZ3MgPSBAe31cbiAgZW5jb2RlKGJ1Ziwgb2JqLCBjaGFuKSA6OiByZXR1cm4gYnVmXG4gIGRlY29kZShidWYsIGluZm8sIHNpbmspIDo6IHJldHVybiBidWZcblxuZXhwb3J0IGRlZmF1bHQgYmluYXJ5X3Byb3RvY29sXG5leHBvcnQgZnVuY3Rpb24gYmluYXJ5X3Byb3RvY29sKHNoYXJlZCwge2VuY29kZSwgZGVjb2RlfT1ub29wX2VuY29kaW5ncykgOjpcbiAgY29uc3Qge3N0YXRlRm9yLCBjcmVhdGVNdWx0aXBhcnQsIGNyZWF0ZVN0cmVhbX0gPSBzaGFyZWRcbiAgY29uc3Qge2FzQnVmZmVyfSA9IHNoYXJlZC5wYWNrZXRQYXJzZXJcblxuICByZXR1cm4gQHt9XG4gICAgcGFja0JvZHlcblxuICAgIGdldCBkYXRhZ3JhbSgpIDo6IHJldHVybiB0aGlzLmRpcmVjdFxuICAgIGRpcmVjdDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBpbmZvID0gcGt0LmluZm9cbiAgICAgICAgY29uc3QgYm9keV9idWYgPSBwa3QuYm9keV9idWZmZXIoKVxuICAgICAgICBjb25zdCBtc2cgPSB1bnBhY2tCb2R5QnVmIEAgYm9keV9idWYsIGluZm8sIHNpbmtcbiAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgaW5mb1xuXG4gICAgbXVsdGlwYXJ0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RhdGVGb3IgQCBwa3QsIHNpbmssIGNyZWF0ZU11bHRpcGFydFxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHN0YXRlLmZlZWQocGt0KVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IGJvZHlfYnVmIDo6XG4gICAgICAgICAgY29uc3QgaW5mbyA9IHN0YXRlLmluZm9cbiAgICAgICAgICBjb25zdCBtc2cgPSB1bnBhY2tCb2R5QnVmIEAgYm9keV9idWYsIGluZm8sIHNpbmtcbiAgICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBpbmZvXG5cbiAgICBzdHJlYW1pbmc6IEB7fVxuICAgICAgbW9kZTogJ2J5dGVzJ1xuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlU3RyZWFtXG4gICAgICAgIGNvbnN0IGJvZHlfYnVmID0gc3RhdGUuZmVlZChwa3QsIHBrdF9idWZmZXIsIHN0cmVhbV9tc2dfdW5wYWNrKVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IGJvZHlfYnVmIDo6XG4gICAgICAgICAgY29uc3QgaW5mbyA9IHN0YXRlLmluZm9cbiAgICAgICAgICBjb25zdCBtc2cgPSB1bnBhY2tCb2R5QnVmIEAgYm9keV9idWYsIGluZm8sIHNpbmtcbiAgICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBpbmZvXG5cbiAgICAgIG1zZ19wYWNrKG1zZywgb2JqLCBjaGFuKSA6OlxuICAgICAgICBjb25zdCBtc2dfYnVmID0gcGFja191dGY4IEAganNvbl9wYWNrIEAgbXNnXG4gICAgICAgIHJldHVybiBlbmNvZGUobXNnX2J1Ziwgb2JqLCBjaGFuKVxuXG5cbiAgZnVuY3Rpb24gc3RyZWFtX21zZ191bnBhY2socGt0LCBzaW5rKSA6OlxuICAgIGNvbnN0IGpzb25fYnVmID0gZGVjb2RlKHBrdC5ib2R5X2J1ZmZlcigpLCBwa3QuaW5mbywgc2luaylcbiAgICByZXR1cm4gc2luay5qc29uX3VucGFjayBAIHVucGFja191dGY4KGpzb25fYnVmKVxuXG4gIGZ1bmN0aW9uIHBhY2tCb2R5KGJvZHksIG9iaiwgY2hhbikgOjpcbiAgICBjb25zdCBib2R5X2J1ZiA9IGFzQnVmZmVyIEAgYm9keVxuICAgIHJldHVybiBlbmNvZGUoYm9keV9idWYsIG9iaiwgY2hhbilcbiAgZnVuY3Rpb24gdW5wYWNrQm9keUJ1Zihib2R5X2J1ZiwgaW5mbywgc2luaykgOjpcbiAgICByZXR1cm4gZGVjb2RlKGJvZHlfYnVmLCBpbmZvLCBzaW5rKVxuXG5mdW5jdGlvbiBwa3RfYnVmZmVyKHBrdCkgOjogcmV0dXJuIHBrdC5ib2R5X2J1ZmZlcigpXG5cbiIsImV4cG9ydCBkZWZhdWx0IGNvbnRyb2xfcHJvdG9jb2xcbmV4cG9ydCBmdW5jdGlvbiBjb250cm9sX3Byb3RvY29sKGluYm91bmQsIGhpZ2gsIHNoYXJlZCkgOjpcbiAgY29uc3Qge2Nob29zZUZyYW1pbmcsIHJhbmRvbV9pZH0gPSBzaGFyZWRcbiAgY29uc3Qge3BhY2tQYWNrZXRPYmp9ID0gc2hhcmVkLnBhY2tldFBhcnNlclxuXG4gIGNvbnN0IHBpbmdfZnJhbWUgPSBjaG9vc2VGcmFtaW5nIEA6IGZyb21faWQ6IHRydWUsIHRva2VuOiB0cnVlLCB0cmFuc3BvcnQ6ICdkaXJlY3QnXG4gIGNvbnN0IHBvbmdfZnJhbWUgPSBjaG9vc2VGcmFtaW5nIEA6IGZyb21faWQ6IHRydWUsIG1zZ2lkOiB0cnVlLCB0cmFuc3BvcnQ6ICdkYXRhZ3JhbSdcblxuICBjb25zdCBwb25nX3R5cGUgPSBoaWdofDB4ZVxuICBpbmJvdW5kW3BvbmdfdHlwZV0gPSByZWN2X3BvbmdcbiAgY29uc3QgcGluZ190eXBlID0gaGlnaHwweGZcbiAgaW5ib3VuZFtoaWdofDB4Zl0gPSByZWN2X3BpbmdcblxuICByZXR1cm4gQHt9IHNlbmQ6cGluZywgcGluZ1xuXG4gIGZ1bmN0aW9uIHBpbmcoY2hhbiwgb2JqKSA6OlxuICAgIGlmICEgb2JqLnRva2VuIDo6XG4gICAgICBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgIG9iai5ib2R5ID0gSlNPTi5zdHJpbmdpZnkgQDpcbiAgICAgIG9wOiAncGluZycsIHRzMDogbmV3IERhdGUoKVxuICAgIHBpbmdfZnJhbWUucGFjayhwaW5nX3R5cGUsIG9iailcbiAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgcmV0dXJuIGNoYW4uc2VuZCBAIHBrdFxuXG4gIGZ1bmN0aW9uIHJlY3ZfcGluZyhwa3QsIHNpbmssIHJvdXRlcikgOjpcbiAgICBwaW5nX2ZyYW1lLnVucGFjayhwa3QpXG4gICAgcGt0LmJvZHkgPSBwa3QuYm9keV9qc29uKClcbiAgICBfc2VuZF9wb25nIEAgcGt0LmJvZHksIHBrdCwgcm91dGVyXG4gICAgcmV0dXJuIHNpbmsucmVjdkN0cmwocGt0LmJvZHksIHBrdC5pbmZvKVxuXG4gIGZ1bmN0aW9uIF9zZW5kX3Bvbmcoe3RzMH0sIHBrdF9waW5nLCByb3V0ZXIpIDo6XG4gICAgY29uc3Qge21zZ2lkLCBpZF90YXJnZXQsIGlkX3JvdXRlciwgZnJvbV9pZDpyX2lkfSA9IHBrdF9waW5nLmluZm9cbiAgICBjb25zdCBvYmogPSBAe30gbXNnaWRcbiAgICAgIGZyb21faWQ6IEB7fSBpZF90YXJnZXQsIGlkX3JvdXRlclxuICAgICAgaWRfcm91dGVyOiByX2lkLmlkX3JvdXRlciwgaWRfdGFyZ2V0OiByX2lkLmlkX3RhcmdldFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkgQDpcbiAgICAgICAgb3A6ICdwb25nJywgdHMwLCB0czE6IG5ldyBEYXRlKClcblxuICAgIHBvbmdfZnJhbWUucGFjayhwb25nX3R5cGUsIG9iailcbiAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgcmV0dXJuIHJvdXRlci5kaXNwYXRjaCBAIFtwa3RdXG5cbiAgZnVuY3Rpb24gcmVjdl9wb25nKHBrdCwgc2luaykgOjpcbiAgICBwb25nX2ZyYW1lLnVucGFjayhwa3QpXG4gICAgcGt0LmJvZHkgPSBwa3QuYm9keV9qc29uKClcbiAgICByZXR1cm4gc2luay5yZWN2Q3RybChwa3QuYm9keSwgcGt0LmluZm8pXG5cbiIsImltcG9ydCBpbml0X3NoYXJlZCBmcm9tICcuL3NoYXJlZC9pbmRleC5qc3knXG5pbXBvcnQganNvbl9wcm90b2NvbCBmcm9tICcuL3Byb3RvY29scy9qc29uLmpzeSdcbmltcG9ydCBiaW5hcnlfcHJvdG9jb2wgZnJvbSAnLi9wcm90b2NvbHMvYmluYXJ5LmpzeSdcbmltcG9ydCBjb250cm9sX3Byb3RvY29sIGZyb20gJy4vcHJvdG9jb2xzL2NvbnRyb2wuanN5J1xuXG5cbmNvbnN0IGRlZmF1bHRfcGx1Z2luX29wdGlvbnMgPSBAOlxuICB1c2VTdGFuZGFyZDogdHJ1ZVxuICBqc29uX3BhY2s6IEpTT04uc3RyaW5naWZ5XG4gIGN1c3RvbShwcm90b2NvbHMpIDo6IHJldHVybiBwcm90b2NvbHNcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwbHVnaW5fb3B0aW9ucykgOjpcbiAgcGx1Z2luX29wdGlvbnMgPSBPYmplY3QuYXNzaWduIEAge30sIGRlZmF1bHRfcGx1Z2luX29wdGlvbnMsIHBsdWdpbl9vcHRpb25zXG4gIGNvbnN0IHsgcGx1Z2luX25hbWUsIHJhbmRvbV9pZCwganNvbl9wYWNrIH0gPSBwbHVnaW5fb3B0aW9uc1xuXG4gIHJldHVybiBAOiBzdWJjbGFzcywgb3JkZXI6IC0xIC8vIGRlcGVuZGVudCBvbiByb3V0ZXIgcGx1Z2luJ3MgKC0yKSBwcm92aWRpbmcgcGFja2V0UGFyc2VyXG4gIFxuICBmdW5jdGlvbiBzdWJjbGFzcyhGYWJyaWNIdWJfUEksIGJhc2VzKSA6OlxuICAgIGNvbnN0IHtwYWNrZXRQYXJzZXJ9ID0gRmFicmljSHViX1BJLnByb3RvdHlwZVxuICAgIGlmIG51bGw9PXBhY2tldFBhcnNlciB8fCAhIHBhY2tldFBhcnNlci5pc1BhY2tldFBhcnNlcigpIDo6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYEludmFsaWQgcGFja2V0UGFyc2VyIGZvciBwbHVnaW5gXG4gICAgXG5cbiAgICBjb25zdCBzaGFyZWQgPSBpbml0X3NoYXJlZCBAIHBhY2tldFBhcnNlciwgQHt9IHJhbmRvbV9pZCwganNvbl9wYWNrXG4gICAgbGV0IHByb3RvY29scyA9IEB7fSBzaGFyZWQsIHJhbmRvbV9pZCwgaW5ib3VuZDogW10sIGNvZGVjczogT2JqZWN0LmNyZWF0ZShudWxsKSwgXG5cbiAgICBpZiBwbHVnaW5fb3B0aW9ucy51c2VTdGFuZGFyZCA6OlxuICAgICAgcHJvdG9jb2xzID0gaW5pdF9wcm90b2NvbHMgQCBwcm90b2NvbHNcblxuICAgIHByb3RvY29scyA9IHBsdWdpbl9vcHRpb25zLmN1c3RvbSBAIHByb3RvY29sc1xuICAgIEZhYnJpY0h1Yl9QSS5wcm90b3R5cGUucHJvdG9jb2xzID0gcHJvdG9jb2xzXG5cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRfcHJvdG9jb2xzKHByb3RvY29scykgOjpcbiAgY29uc3Qge2luYm91bmQsIGNvZGVjcywgc2hhcmVkfSA9IHByb3RvY29sc1xuXG4gIGNvZGVjcy5kZWZhdWx0ID0gY29kZWNzLmpzb24gPSBAXG4gICAgc2hhcmVkLmJpbmRUcmFuc3BvcnRzIEAgLy8gMHgwKiDigJQgSlNPTiBib2R5XG4gICAgICBpbmJvdW5kLCAweDAwLCBqc29uX3Byb3RvY29sKHNoYXJlZClcblxuICBjb2RlY3MuYmluYXJ5ID0gQFxuICAgIHNoYXJlZC5iaW5kVHJhbnNwb3J0cyBAIC8vIDB4MSog4oCUIGJpbmFyeSBib2R5XG4gICAgICBpbmJvdW5kLCAweDEwLCBiaW5hcnlfcHJvdG9jb2woc2hhcmVkKVxuXG4gIGNvZGVjcy5jb250cm9sID0gQCAvLyAweGYqIOKAlCBjb250cm9sXG4gICAgY29udHJvbF9wcm90b2NvbCBAIGluYm91bmQsIDB4ZjAsIHNoYXJlZFxuXG4gIHJldHVybiBwcm90b2NvbHNcblxuIiwiaW1wb3J0IHBsdWdpbiBmcm9tICcuL3BsdWdpbi5qc3knXG5cbmNvbnN0IGdldFJhbmRvbVZhbHVlcyA9ICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd2luZG93XG4gID8gd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXMgOiBudWxsXG5cbnByb3RvY29sc19icm93c2VyLnJhbmRvbV9pZCA9IHJhbmRvbV9pZFxuZnVuY3Rpb24gcmFuZG9tX2lkKCkgOjpcbiAgY29uc3QgYXJyID0gbmV3IEludDMyQXJyYXkoMSlcbiAgZ2V0UmFuZG9tVmFsdWVzKGFycilcbiAgcmV0dXJuIGFyclswXVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcm90b2NvbHNfYnJvd3NlcihwbHVnaW5fb3B0aW9ucz17fSkgOjpcbiAgaWYgbnVsbCA9PSBwbHVnaW5fb3B0aW9ucy5yYW5kb21faWQgOjpcbiAgICBwbHVnaW5fb3B0aW9ucy5yYW5kb21faWQgPSByYW5kb21faWRcblxuICByZXR1cm4gcGx1Z2luKHBsdWdpbl9vcHRpb25zKVxuXG4iXSwibmFtZXMiOlsibGl0dGxlX2VuZGlhbiIsImNfc2luZ2xlIiwiY19kYXRhZ3JhbSIsImNfZGlyZWN0IiwiY19tdWx0aXBhcnQiLCJjX3N0cmVhbWluZyIsIl9lcnJfbXNnaWRfcmVxdWlyZWQiLCJfZXJyX3Rva2VuX3JlcXVpcmVkIiwiZnJtX3JvdXRpbmciLCJzaXplIiwiYml0cyIsIm1hc2siLCJvYmoiLCJmcm9tX2lkIiwiZHYiLCJvZmZzZXQiLCJzZXRJbnQzMiIsImlkX3JvdXRlciIsImlkX3RhcmdldCIsInVuZGVmaW5lZCIsImdldEludDMyIiwiZnJtX3Jlc3BvbnNlIiwibXNnaWQiLCJFcnJvciIsInNldEludDE2Iiwic2VxX2FjayIsImFja19mbGFncyIsInRva2VuIiwiZ2V0SW50MTYiLCJmcm1fZGF0YWdyYW0iLCJ0cmFuc3BvcnQiLCJmcm1fZGlyZWN0IiwiZnJtX211bHRpcGFydCIsInNlcV9wb3MiLCJzZXEiLCJzZXFfZmxhZ3MiLCJmcm1fc3RyZWFtaW5nIiwiYmluZF9zZXFfbmV4dCIsInNlcV9vZmZzZXQiLCJzZXFfbmV4dCIsImZsYWdzIiwiZmluIiwiTmFOIiwiY29tcG9zZUZyYW1pbmdzIiwiZnJtX2Zyb20iLCJmcm1fcmVzcCIsImZybV90cmFuc3BvcnRzIiwibGVuZ3RoIiwiYnlCaXRzIiwidF9mcm9tIiwiZl90ZXN0IiwidF9yZXNwIiwidDAiLCJ0MSIsInQyIiwidDMiLCJtYXAiLCJmIiwidGVzdEJpdHMiLCJjaG9vc2UiLCJsc3QiLCJUIiwiYiIsIm9wIiwiZm5fa2V5IiwiZm5fdHJhbiIsImZuX2Zyb20iLCJmbl9yZXNwIiwiZnJtIiwiYmluZEFzc2VtYmxlZCIsImZfcGFjayIsImZfdW5wYWNrIiwicGFjayIsInVucGFjayIsInBrdF90eXBlIiwicGt0X29iaiIsIlR5cGVFcnJvciIsInR5cGUiLCJEYXRhVmlldyIsIkFycmF5QnVmZmVyIiwiaGVhZGVyIiwiYnVmZmVyIiwic2xpY2UiLCJwa3QiLCJidWYiLCJoZWFkZXJfYnVmZmVyIiwiVWludDhBcnJheSIsImluZm8iLCJfYmluZF9pdGVyYWJsZSIsImJ1Zl9jbG9uZSIsInR0bCIsIm5leHQiLCJvcHRpb25zIiwiZG9uZSIsInZhbHVlIiwicGFja2V0UGFyc2VyIiwic2hhcmVkIiwiY29uY2F0QnVmZmVycyIsImNyZWF0ZU11bHRpcGFydCIsInNpbmsiLCJkZWxldGVTdGF0ZSIsInBhcnRzIiwiZmVlZCIsImJvZHlfYnVmZmVyIiwiaW5jbHVkZXMiLCJyZXMiLCJjcmVhdGVTdHJlYW0iLCJyZWN2RGF0YSIsInJzdHJlYW0iLCJzdGF0ZSIsImZlZWRfaW5pdCIsImFzX2NvbnRlbnQiLCJtc2dfdW5wYWNrIiwiZmVlZF9pZ25vcmUiLCJtc2ciLCJqc29uX3VucGFjayIsImJvZHlfdXRmOCIsInJlY3ZTdHJlYW0iLCJyZWN2U3RyZWFtRGF0YSIsImJpbmQiLCJlcnIiLCJvbl9lcnJvciIsImZlZWRfYm9keSIsIm9uX2luaXQiLCJkYXRhIiwib25fZGF0YSIsIm9uX2VuZCIsImZlZWRfc2VxIiwiY2hlY2tfZm5zIiwia2V5cyIsImtleSIsInBhY2tQYWNrZXRPYmoiLCJyYW5kb21faWQiLCJqc29uX3BhY2siLCJjaG9vc2VGcmFtaW5nIiwiZnJhbWluZ3MiLCJmcmFnbWVudF9zaXplIiwiTnVtYmVyIiwiYmluZFRyYW5zcG9ydHMiLCJwYWNrZXRGcmFnbWVudHMiLCJpbmJvdW5kIiwiaGlnaGJpdHMiLCJ0cmFuc3BvcnRzIiwicGFja0JvZHkiLCJvdXRib3VuZCIsImJpbmRUcmFuc3BvcnRJbXBscyIsInN0cmVhbWluZyIsInNlbmQiLCJzdHJlYW0iLCJiaW5kU3RyZWFtIiwiY2hhbiIsImJvZHkiLCJieXRlTGVuZ3RoIiwibXNlbmQiLCJtc2VuZF9ieXRlcyIsInBhY2tfaGRyIiwibXNlbmRfb2JqZWN0cyIsIm1vZGUiLCJtc2dfcGFjayIsIm1zZW5kX2ltcGwiLCJvYmplY3QiLCJieXRlcyIsIndyaXRlIiwiZW5kIiwiY2h1bmsiLCJuZXh0X2hkciIsImkiLCJsYXN0SW5uZXIiLCJpMCIsImZyYW1lIiwiaW1wbCIsInRfcmVjdiIsInJlY3ZfbXNnIiwiaW5pdF9zaGFyZWQiLCJPYmplY3QiLCJhc3NpZ24iLCJzdGF0ZUZvciIsIm11bHRpcGFydCIsImNyZWF0ZVN0YXRlIiwiYnlfbXNnaWQiLCJnZXQiLCJkZWxldGUiLCJzZXQiLCJub29wX2VuY29kaW5ncyIsImpzb25fcHJvdG9jb2wiLCJlbmNvZGUiLCJkZWNvZGUiLCJwYWNrX3V0ZjgiLCJ1bnBhY2tfdXRmOCIsInN0cmVhbV9tc2dfdW5wYWNrIiwiYXNfanNvbl9jb250ZW50IiwiZGF0YWdyYW0iLCJkaXJlY3QiLCJ1bnBhY2tCb2R5QnVmIiwicmVjdk1zZyIsImJvZHlfYnVmIiwibXNnX2J1ZiIsImpzb25fYnVmIiwiYmluYXJ5X3Byb3RvY29sIiwiYXNCdWZmZXIiLCJwa3RfYnVmZmVyIiwiY29udHJvbF9wcm90b2NvbCIsImhpZ2giLCJwaW5nX2ZyYW1lIiwicG9uZ19mcmFtZSIsInBvbmdfdHlwZSIsInJlY3ZfcG9uZyIsInBpbmdfdHlwZSIsInJlY3ZfcGluZyIsInBpbmciLCJKU09OIiwic3RyaW5naWZ5IiwidHMwIiwiRGF0ZSIsInJvdXRlciIsImJvZHlfanNvbiIsInJlY3ZDdHJsIiwiX3NlbmRfcG9uZyIsInBrdF9waW5nIiwicl9pZCIsInRzMSIsImRpc3BhdGNoIiwiZGVmYXVsdF9wbHVnaW5fb3B0aW9ucyIsInByb3RvY29scyIsInBsdWdpbl9vcHRpb25zIiwicGx1Z2luX25hbWUiLCJzdWJjbGFzcyIsIm9yZGVyIiwiRmFicmljSHViX1BJIiwiYmFzZXMiLCJwcm90b3R5cGUiLCJpc1BhY2tldFBhcnNlciIsImNvZGVjcyIsImNyZWF0ZSIsInVzZVN0YW5kYXJkIiwiaW5pdF9wcm90b2NvbHMiLCJjdXN0b20iLCJkZWZhdWx0IiwianNvbiIsImJpbmFyeSIsImNvbnRyb2wiLCJnZXRSYW5kb21WYWx1ZXMiLCJ3aW5kb3ciLCJjcnlwdG8iLCJwcm90b2NvbHNfYnJvd3NlciIsImFyciIsIkludDMyQXJyYXkiLCJwbHVnaW4iXSwibWFwcGluZ3MiOiJBQUFBLE1BQU1BLGdCQUFnQixJQUF0QjtBQUNBLE1BQU1DLFdBQVcsUUFBakI7QUFDQSxNQUFNQyxhQUFhLFVBQW5CO0FBQ0EsTUFBTUMsV0FBVyxRQUFqQjtBQUNBLE1BQU1DLGNBQWMsV0FBcEI7QUFDQSxNQUFNQyxjQUFjLFdBQXBCOztBQUVBLE1BQU1DLHNCQUF1QiwwQkFBN0I7QUFDQSxNQUFNQyxzQkFBdUIsMkJBQTdCOztBQUdBLFNBQVNDLFdBQVQsR0FBdUI7UUFDZkMsT0FBTyxDQUFiO1FBQWdCQyxPQUFPLEdBQXZCO1FBQTRCQyxPQUFPLEdBQW5DO1NBQ087UUFBQSxFQUNDRCxJQURELEVBQ09DLElBRFA7O1dBR0VDLEdBQVAsRUFBWTthQUFVLFFBQVFBLElBQUlDLE9BQVosR0FBc0JILElBQXRCLEdBQTZCLEtBQXBDO0tBSFY7O1dBS0VFLEdBQVAsRUFBWUUsRUFBWixFQUFnQkMsTUFBaEIsRUFBd0I7WUFDaEIsRUFBQ0YsT0FBRCxLQUFZRCxHQUFsQjtTQUNHSSxRQUFILENBQWMsSUFBRUQsTUFBaEIsRUFBd0IsSUFBRUYsUUFBUUksU0FBbEMsRUFBNkNqQixhQUE3QztTQUNHZ0IsUUFBSCxDQUFjLElBQUVELE1BQWhCLEVBQXdCLElBQUVGLFFBQVFLLFNBQWxDLEVBQTZDbEIsYUFBN0M7S0FSRzs7YUFVSVksR0FBVCxFQUFjRSxFQUFkLEVBQWtCQyxNQUFsQixFQUEwQjtZQUNsQkYsVUFBVU0sY0FBY1AsSUFBSUMsT0FBbEIsR0FDWkQsSUFBSUMsT0FBSixHQUFjLEVBREYsR0FDT0QsSUFBSUMsT0FEM0I7Y0FFUUksU0FBUixHQUFvQkgsR0FBR00sUUFBSCxDQUFjLElBQUVMLE1BQWhCLEVBQXdCZixhQUF4QixDQUFwQjtjQUNRa0IsU0FBUixHQUFvQkosR0FBR00sUUFBSCxDQUFjLElBQUVMLE1BQWhCLEVBQXdCZixhQUF4QixDQUFwQjtLQWRHLEVBQVA7OztBQWdCRixTQUFTcUIsWUFBVCxHQUF3QjtRQUNoQlosT0FBTyxDQUFiO1FBQWdCQyxPQUFPLEdBQXZCO1FBQTRCQyxPQUFPLEdBQW5DO1NBQ087UUFBQSxFQUNDRCxJQURELEVBQ09DLElBRFA7O1dBR0VDLEdBQVAsRUFBWTthQUFVLFFBQVFBLElBQUlVLEtBQVosR0FBb0JaLElBQXBCLEdBQTJCLEtBQWxDO0tBSFY7O1dBS0VFLEdBQVAsRUFBWUUsRUFBWixFQUFnQkMsTUFBaEIsRUFBd0I7VUFDbkIsQ0FBRUgsSUFBSVUsS0FBVCxFQUFpQjtjQUFPLElBQUlDLEtBQUosQ0FBWWpCLG1CQUFaLENBQU47O1NBQ2ZVLFFBQUgsQ0FBYyxJQUFFRCxNQUFoQixFQUF3QkgsSUFBSVUsS0FBNUIsRUFBbUN0QixhQUFuQztTQUNHd0IsUUFBSCxDQUFjLElBQUVULE1BQWhCLEVBQXdCLElBQUVILElBQUlhLE9BQTlCLEVBQXVDekIsYUFBdkM7U0FDR3dCLFFBQUgsQ0FBYyxJQUFFVCxNQUFoQixFQUF3QixJQUFFSCxJQUFJYyxTQUE5QixFQUF5QzFCLGFBQXpDO0tBVEc7O2FBV0lZLEdBQVQsRUFBY0UsRUFBZCxFQUFrQkMsTUFBbEIsRUFBMEI7VUFDcEJZLEtBQUosR0FBWWIsR0FBR00sUUFBSCxDQUFjLElBQUVMLE1BQWhCLEVBQXdCZixhQUF4QixDQUFaO1VBQ0l5QixPQUFKLEdBQWNYLEdBQUdjLFFBQUgsQ0FBYyxJQUFFYixNQUFoQixFQUF3QmYsYUFBeEIsQ0FBZDtVQUNJMEIsU0FBSixHQUFnQlosR0FBR2MsUUFBSCxDQUFjLElBQUViLE1BQWhCLEVBQXdCZixhQUF4QixDQUFoQjtLQWRHLEVBQVA7OztBQWtCRixTQUFTNkIsWUFBVCxHQUF3QjtRQUNoQnBCLE9BQU8sQ0FBYjtRQUFnQkMsT0FBTyxHQUF2QjtRQUE0QkMsT0FBTyxHQUFuQztTQUNPLEVBQUltQixXQUFXNUIsVUFBZjtRQUFBLEVBQ0NRLElBREQsRUFDT0MsSUFEUDs7V0FHRUMsR0FBUCxFQUFZO1VBQ1BWLGVBQWVVLElBQUlrQixTQUF0QixFQUFrQztlQUFRcEIsSUFBUDs7VUFDaENFLElBQUlrQixTQUFKLElBQWlCN0IsYUFBYVcsSUFBSWtCLFNBQXJDLEVBQWlEO2VBQVEsS0FBUDs7YUFDM0MsQ0FBRWxCLElBQUllLEtBQU4sR0FBY2pCLElBQWQsR0FBcUIsS0FBNUI7S0FORzs7V0FRRUUsR0FBUCxFQUFZRSxFQUFaLEVBQWdCQyxNQUFoQixFQUF3QixFQVJuQjs7YUFVSUgsR0FBVCxFQUFjRSxFQUFkLEVBQWtCQyxNQUFsQixFQUEwQjtVQUNwQmUsU0FBSixHQUFnQjVCLFVBQWhCO0tBWEcsRUFBUDs7O0FBYUYsU0FBUzZCLFVBQVQsR0FBc0I7UUFDZHRCLE9BQU8sQ0FBYjtRQUFnQkMsT0FBTyxHQUF2QjtRQUE0QkMsT0FBTyxHQUFuQztTQUNPLEVBQUltQixXQUFXM0IsUUFBZjtRQUFBLEVBQ0NPLElBREQsRUFDT0MsSUFEUDs7V0FHRUMsR0FBUCxFQUFZO1VBQ1BULGFBQWFTLElBQUlrQixTQUFwQixFQUFnQztlQUFRcEIsSUFBUDs7VUFDOUJFLElBQUlrQixTQUFKLElBQWlCN0IsYUFBYVcsSUFBSWtCLFNBQXJDLEVBQWlEO2VBQVEsS0FBUDs7YUFDM0MsQ0FBQyxDQUFFbEIsSUFBSWUsS0FBUCxHQUFlakIsSUFBZixHQUFzQixLQUE3QjtLQU5HOztXQVFFRSxHQUFQLEVBQVlFLEVBQVosRUFBZ0JDLE1BQWhCLEVBQXdCO1VBQ25CLENBQUVILElBQUllLEtBQVQsRUFBaUI7Y0FBTyxJQUFJSixLQUFKLENBQVloQixtQkFBWixDQUFOOztTQUNmUyxRQUFILENBQWMsSUFBRUQsTUFBaEIsRUFBd0JILElBQUllLEtBQTVCLEVBQW1DM0IsYUFBbkM7S0FWRzs7YUFZSVksR0FBVCxFQUFjRSxFQUFkLEVBQWtCQyxNQUFsQixFQUEwQjtVQUNwQk8sS0FBSixHQUFZUixHQUFHTSxRQUFILENBQWMsSUFBRUwsTUFBaEIsRUFBd0JmLGFBQXhCLENBQVo7VUFDSThCLFNBQUosR0FBZ0IzQixRQUFoQjtLQWRHLEVBQVA7OztBQWdCRixTQUFTNkIsYUFBVCxHQUF5QjtRQUNqQnZCLE9BQU8sQ0FBYjtRQUFnQkMsT0FBTyxHQUF2QjtRQUE0QkMsT0FBTyxHQUFuQztTQUNPLEVBQUltQixXQUFXMUIsV0FBZjtRQUFBLEVBQ0NNLElBREQsRUFDT0MsSUFEUDs7V0FHRUMsR0FBUCxFQUFZO2FBQVVSLGdCQUFnQlEsSUFBSWtCLFNBQXBCLEdBQWdDcEIsSUFBaEMsR0FBdUMsS0FBOUM7S0FIVjs7aUJBQUEsRUFLVXVCLFNBQVMsQ0FMbkI7V0FNRXJCLEdBQVAsRUFBWUUsRUFBWixFQUFnQkMsTUFBaEIsRUFBd0I7VUFDbkIsQ0FBRUgsSUFBSWUsS0FBVCxFQUFpQjtjQUFPLElBQUlKLEtBQUosQ0FBWWhCLG1CQUFaLENBQU47O1NBQ2ZTLFFBQUgsQ0FBYyxJQUFFRCxNQUFoQixFQUF3QkgsSUFBSWUsS0FBNUIsRUFBbUMzQixhQUFuQztVQUNHLFFBQVFZLElBQUlzQixHQUFmLEVBQXFCOztXQUNoQlYsUUFBSCxDQUFjLElBQUVULE1BQWhCLEVBQXdCLENBQXhCLEVBQTJCZixhQUEzQjtPQURGLE1BRUtjLEdBQUdVLFFBQUgsQ0FBYyxJQUFFVCxNQUFoQixFQUF3QixJQUFFSCxJQUFJc0IsR0FBOUIsRUFBbUNsQyxhQUFuQztTQUNGd0IsUUFBSCxDQUFjLElBQUVULE1BQWhCLEVBQXdCLElBQUVILElBQUl1QixTQUE5QixFQUF5Q25DLGFBQXpDO0tBWkc7O2FBY0lZLEdBQVQsRUFBY0UsRUFBZCxFQUFrQkMsTUFBbEIsRUFBMEI7VUFDcEJPLEtBQUosR0FBZ0JSLEdBQUdNLFFBQUgsQ0FBYyxJQUFFTCxNQUFoQixFQUF3QmYsYUFBeEIsQ0FBaEI7VUFDSWtDLEdBQUosR0FBZ0JwQixHQUFHYyxRQUFILENBQWMsSUFBRWIsTUFBaEIsRUFBd0JmLGFBQXhCLENBQWhCO1VBQ0ltQyxTQUFKLEdBQWdCckIsR0FBR2MsUUFBSCxDQUFjLElBQUViLE1BQWhCLEVBQXdCZixhQUF4QixDQUFoQjtVQUNJOEIsU0FBSixHQUFnQjFCLFdBQWhCO0tBbEJHLEVBQVA7OztBQW9CRixTQUFTZ0MsYUFBVCxHQUF5QjtRQUNqQjNCLE9BQU8sQ0FBYjtRQUFnQkMsT0FBTyxHQUF2QjtRQUE0QkMsT0FBTyxHQUFuQztTQUNPLEVBQUltQixXQUFXekIsV0FBZjtRQUFBLEVBQ0NLLElBREQsRUFDT0MsSUFEUDs7V0FHRUMsR0FBUCxFQUFZO2FBQVVQLGdCQUFnQk8sSUFBSWtCLFNBQXBCLEdBQWdDcEIsSUFBaEMsR0FBdUMsS0FBOUM7S0FIVjs7aUJBQUEsRUFLVXVCLFNBQVMsQ0FMbkI7V0FNRXJCLEdBQVAsRUFBWUUsRUFBWixFQUFnQkMsTUFBaEIsRUFBd0I7VUFDbkIsQ0FBRUgsSUFBSWUsS0FBVCxFQUFpQjtjQUFPLElBQUlKLEtBQUosQ0FBWWhCLG1CQUFaLENBQU47O1NBQ2ZTLFFBQUgsQ0FBYyxJQUFFRCxNQUFoQixFQUF3QkgsSUFBSWUsS0FBNUIsRUFBbUMzQixhQUFuQztVQUNHLFFBQVFZLElBQUlzQixHQUFmLEVBQXFCO1dBQ2hCVixRQUFILENBQWMsSUFBRVQsTUFBaEIsRUFBd0IsQ0FBeEIsRUFBMkJmLGFBQTNCOztPQURGLE1BRUtjLEdBQUdVLFFBQUgsQ0FBYyxJQUFFVCxNQUFoQixFQUF3QixJQUFFSCxJQUFJc0IsR0FBOUIsRUFBbUNsQyxhQUFuQztTQUNGd0IsUUFBSCxDQUFjLElBQUVULE1BQWhCLEVBQXdCLElBQUVILElBQUl1QixTQUE5QixFQUF5Q25DLGFBQXpDO0tBWkc7O2FBY0lZLEdBQVQsRUFBY0UsRUFBZCxFQUFrQkMsTUFBbEIsRUFBMEI7VUFDcEJPLEtBQUosR0FBZ0JSLEdBQUdNLFFBQUgsQ0FBYyxJQUFFTCxNQUFoQixFQUF3QmYsYUFBeEIsQ0FBaEI7VUFDSWtDLEdBQUosR0FBZ0JwQixHQUFHYyxRQUFILENBQWMsSUFBRWIsTUFBaEIsRUFBd0JmLGFBQXhCLENBQWhCO1VBQ0ltQyxTQUFKLEdBQWdCckIsR0FBR2MsUUFBSCxDQUFjLElBQUViLE1BQWhCLEVBQXdCZixhQUF4QixDQUFoQjtVQUNJOEIsU0FBSixHQUFnQnpCLFdBQWhCO0tBbEJHLEVBQVA7OztBQXFCRixTQUFTZ0MsYUFBVCxDQUF1QnRCLE1BQXZCLEVBQStCO1FBQ3ZCdUIsYUFBYSxLQUFLTCxPQUFMLEdBQWVsQixNQUFsQztNQUNJbUIsTUFBTSxDQUFWO1NBQ08sU0FBU0ssUUFBVCxDQUFrQixFQUFDQyxLQUFELEVBQVFDLEdBQVIsRUFBbEIsRUFBZ0MzQixFQUFoQyxFQUFvQztRQUN0QyxDQUFFMkIsR0FBTCxFQUFXO1NBQ05qQixRQUFILENBQWNjLFVBQWQsRUFBMEJKLEtBQTFCLEVBQWlDbEMsYUFBakM7U0FDR3dCLFFBQUgsQ0FBYyxJQUFFYyxVQUFoQixFQUE0QixJQUFFRSxLQUE5QixFQUFxQ3hDLGFBQXJDO0tBRkYsTUFHSztTQUNBd0IsUUFBSCxDQUFjYyxVQUFkLEVBQTBCLENBQUNKLEdBQTNCLEVBQWdDbEMsYUFBaEM7U0FDR3dCLFFBQUgsQ0FBYyxJQUFFYyxVQUFoQixFQUE0QixJQUFFRSxLQUE5QixFQUFxQ3hDLGFBQXJDO1lBQ00wQyxHQUFOOztHQVBKOzs7QUFXRixlQUFlQyxpQkFBZjtBQUNBLFNBQVNBLGVBQVQsR0FBMkI7UUFDbkJDLFdBQVdwQyxhQUFqQjtRQUFnQ3FDLFdBQVd4QixjQUEzQztRQUNNeUIsaUJBQWlCLENBQUlqQixjQUFKLEVBQW9CRSxZQUFwQixFQUFrQ0MsZUFBbEMsRUFBbURJLGVBQW5ELENBQXZCOztNQUVHLE1BQU1RLFNBQVNuQyxJQUFmLElBQXVCLE1BQU1vQyxTQUFTcEMsSUFBdEMsSUFBOEMsS0FBS3FDLGVBQWVDLE1BQXJFLEVBQThFO1VBQ3RFLElBQUl4QixLQUFKLENBQWEscUJBQWIsQ0FBTjs7O1FBRUl5QixTQUFTLEVBQWY7UUFBbUJyQyxPQUFLLEdBQXhCOzs7VUFHUXNDLFNBQVNMLFNBQVNNLE1BQXhCO1VBQWdDQyxTQUFTTixTQUFTSyxNQUFsRDtVQUNNLENBQUNFLEVBQUQsRUFBSUMsRUFBSixFQUFPQyxFQUFQLEVBQVVDLEVBQVYsSUFBZ0JULGVBQWVVLEdBQWYsQ0FBcUJDLEtBQUdBLEVBQUVQLE1BQTFCLENBQXRCOztVQUVNUSxXQUFXVixPQUFPVSxRQUFQLEdBQWtCOUMsT0FDakMsSUFBSXFDLE9BQU9yQyxHQUFQLENBQUosR0FBa0J1QyxPQUFPdkMsR0FBUCxDQUFsQixHQUFnQ3dDLEdBQUd4QyxHQUFILENBQWhDLEdBQTBDeUMsR0FBR3pDLEdBQUgsQ0FBMUMsR0FBb0QwQyxHQUFHMUMsR0FBSCxDQUFwRCxHQUE4RDJDLEdBQUczQyxHQUFILENBRGhFOztXQUdPK0MsTUFBUCxHQUFnQixVQUFVL0MsR0FBVixFQUFlZ0QsR0FBZixFQUFvQjtVQUMvQixRQUFRQSxHQUFYLEVBQWlCO2NBQU8sUUFBUVosTUFBZDs7YUFDWFksSUFBSUYsU0FBUzlDLEdBQVQsQ0FBSixDQUFQO0tBRkY7OztPQUtFLE1BQU1pRCxDQUFWLElBQWVmLGNBQWYsRUFBZ0M7VUFDeEIsRUFBQ3BDLE1BQUtvRCxDQUFOLEVBQVNyRCxJQUFULEVBQWVxQixTQUFmLEtBQTRCK0IsQ0FBbEM7O1dBRU9DLElBQUUsQ0FBVCxJQUFjLEVBQUlELENBQUosRUFBTy9CLFNBQVAsRUFBa0JwQixNQUFNb0QsSUFBRSxDQUExQixFQUE2Qm5ELElBQTdCLEVBQW1DRixNQUFNQSxJQUF6QyxFQUErQ3NELElBQUksRUFBbkQsRUFBZDtXQUNPRCxJQUFFLENBQVQsSUFBYyxFQUFJRCxDQUFKLEVBQU8vQixTQUFQLEVBQWtCcEIsTUFBTW9ELElBQUUsQ0FBMUIsRUFBNkJuRCxJQUE3QixFQUFtQ0YsTUFBTSxJQUFJQSxJQUE3QyxFQUFtRHNELElBQUksR0FBdkQsRUFBZDtXQUNPRCxJQUFFLENBQVQsSUFBYyxFQUFJRCxDQUFKLEVBQU8vQixTQUFQLEVBQWtCcEIsTUFBTW9ELElBQUUsQ0FBMUIsRUFBNkJuRCxJQUE3QixFQUFtQ0YsTUFBTSxJQUFJQSxJQUE3QyxFQUFtRHNELElBQUksR0FBdkQsRUFBZDtXQUNPRCxJQUFFLENBQVQsSUFBYyxFQUFJRCxDQUFKLEVBQU8vQixTQUFQLEVBQWtCcEIsTUFBTW9ELElBQUUsQ0FBMUIsRUFBNkJuRCxJQUE3QixFQUFtQ0YsTUFBTSxLQUFLQSxJQUE5QyxFQUFvRHNELElBQUksSUFBeEQsRUFBZDs7U0FFSSxNQUFNQyxNQUFWLElBQW9CLENBQUMsUUFBRCxFQUFXLFVBQVgsQ0FBcEIsRUFBNkM7WUFDckNDLFVBQVVKLEVBQUVHLE1BQUYsQ0FBaEI7WUFBMkJFLFVBQVV0QixTQUFTb0IsTUFBVCxDQUFyQztZQUF1REcsVUFBVXRCLFNBQVNtQixNQUFULENBQWpFOzthQUVPRixJQUFFLENBQVQsRUFBWUUsTUFBWixJQUFzQixVQUFTcEQsR0FBVCxFQUFjRSxFQUFkLEVBQWtCO2dCQUFXRixHQUFSLEVBQWFFLEVBQWIsRUFBaUIsQ0FBakI7T0FBM0M7YUFDT2dELElBQUUsQ0FBVCxFQUFZRSxNQUFaLElBQXNCLFVBQVNwRCxHQUFULEVBQWNFLEVBQWQsRUFBa0I7Z0JBQVdGLEdBQVIsRUFBYUUsRUFBYixFQUFpQixDQUFqQixFQUFxQm1ELFFBQVFyRCxHQUFSLEVBQWFFLEVBQWIsRUFBaUIsQ0FBakI7T0FBaEU7YUFDT2dELElBQUUsQ0FBVCxFQUFZRSxNQUFaLElBQXNCLFVBQVNwRCxHQUFULEVBQWNFLEVBQWQsRUFBa0I7Z0JBQVdGLEdBQVIsRUFBYUUsRUFBYixFQUFpQixDQUFqQixFQUFxQm1ELFFBQVFyRCxHQUFSLEVBQWFFLEVBQWIsRUFBaUIsQ0FBakI7T0FBaEU7YUFDT2dELElBQUUsQ0FBVCxFQUFZRSxNQUFaLElBQXNCLFVBQVNwRCxHQUFULEVBQWNFLEVBQWQsRUFBa0I7Z0JBQVdGLEdBQVIsRUFBYUUsRUFBYixFQUFpQixDQUFqQixFQUFxQnFELFFBQVF2RCxHQUFSLEVBQWFFLEVBQWIsRUFBaUIsQ0FBakIsRUFBcUJtRCxRQUFRckQsR0FBUixFQUFhRSxFQUFiLEVBQWlCLEVBQWpCO09BQXJGOzs7O09BRUEsTUFBTXNELEdBQVYsSUFBaUJwQixNQUFqQixFQUEwQjtrQkFDUm9CLEdBQWhCOzs7U0FFS3BCLE1BQVA7OztBQUdGLFNBQVNxQixhQUFULENBQXVCRCxHQUF2QixFQUE0QjtRQUNwQixFQUFDUCxDQUFELEVBQUlwRCxJQUFKLEVBQVU2RCxNQUFWLEVBQWtCQyxRQUFsQixLQUE4QkgsR0FBcEM7TUFDR1AsRUFBRXhCLGFBQUwsRUFBcUI7UUFDZkUsUUFBSixHQUFlc0IsRUFBRXhCLGFBQUYsQ0FBa0IrQixJQUFJM0QsSUFBSixHQUFXb0QsRUFBRXBELElBQS9CLENBQWY7OztTQUVLMkQsSUFBSVAsQ0FBWDtNQUNJVyxJQUFKLEdBQVdBLElBQVgsQ0FBa0JKLElBQUlLLE1BQUosR0FBYUEsTUFBYjtRQUNabEMsV0FBVzZCLElBQUk3QixRQUFyQjs7V0FFU2lDLElBQVQsQ0FBY0UsUUFBZCxFQUF3QkMsT0FBeEIsRUFBaUM7UUFDNUIsRUFBSSxLQUFLRCxRQUFMLElBQWlCQSxZQUFZLEdBQWpDLENBQUgsRUFBMEM7WUFDbEMsSUFBSUUsU0FBSixDQUFpQixrQ0FBakIsQ0FBTjs7O1lBRU1DLElBQVIsR0FBZUgsUUFBZjtRQUNHbkMsWUFBWSxRQUFRb0MsUUFBUXpDLEdBQS9CLEVBQXFDO2NBQzNCQSxHQUFSLEdBQWMsSUFBZDs7O1VBRUlwQixLQUFLLElBQUlnRSxRQUFKLENBQWUsSUFBSUMsV0FBSixDQUFnQnRFLElBQWhCLENBQWYsQ0FBWDtXQUNPa0UsT0FBUCxFQUFnQjdELEVBQWhCLEVBQW9CLENBQXBCO1lBQ1FrRSxNQUFSLEdBQWlCbEUsR0FBR21FLE1BQXBCOztRQUVHLFNBQVNOLFFBQVF6QyxHQUFwQixFQUEwQjtxQkFDUHlDLE9BQWpCLEVBQTBCN0QsR0FBR21FLE1BQUgsQ0FBVUMsS0FBVixDQUFnQixDQUFoQixFQUFrQnpFLElBQWxCLENBQTFCOzs7O1dBRUtnRSxNQUFULENBQWdCVSxHQUFoQixFQUFxQjtVQUNiQyxNQUFNRCxJQUFJRSxhQUFKLEVBQVo7VUFDTXZFLEtBQUssSUFBSWdFLFFBQUosQ0FBZSxJQUFJUSxVQUFKLENBQWVGLEdBQWYsRUFBb0JILE1BQW5DLENBQVg7O1VBRU1NLE9BQU8sRUFBYjthQUNTQSxJQUFULEVBQWV6RSxFQUFmLEVBQW1CLENBQW5CO1dBQ09xRSxJQUFJSSxJQUFKLEdBQVdBLElBQWxCOzs7V0FFT0MsY0FBVCxDQUF3QmIsT0FBeEIsRUFBaUNjLFNBQWpDLEVBQTRDO1VBQ3BDLEVBQUNaLElBQUQsS0FBU0YsT0FBZjtVQUNNLEVBQUMxRCxTQUFELEVBQVlDLFNBQVosRUFBdUJ3RSxHQUF2QixFQUE0Qi9ELEtBQTVCLEtBQXFDZ0QsT0FBM0M7WUFDUWdCLElBQVIsR0FBZUEsSUFBZjs7YUFFU0EsSUFBVCxDQUFjQyxPQUFkLEVBQXVCO1VBQ2xCLFFBQVFBLE9BQVgsRUFBcUI7a0JBQVcsRUFBVjs7WUFDaEJaLFNBQVNTLFVBQVVQLEtBQVYsRUFBZjtlQUNXVSxPQUFYLEVBQW9CLElBQUlkLFFBQUosQ0FBZUUsTUFBZixDQUFwQjthQUNPLEVBQUlhLE1BQU0sQ0FBQyxDQUFFRCxRQUFRbkQsR0FBckIsRUFBMEJxRCxPQUFPO1NBQWpDLEVBQ0w3RSxTQURLLEVBQ01DLFNBRE4sRUFDaUIyRCxJQURqQixFQUN1QmEsR0FEdkIsRUFDNEIvRCxLQUQ1QixFQUNtQ3FELE1BRG5DLEVBQVA7Ozs7O0FDbE9OLGdCQUFlLFVBQVNlLFlBQVQsRUFBdUJDLE1BQXZCLEVBQStCO1FBQ3RDLEVBQUNDLGFBQUQsS0FBa0JGLFlBQXhCO1NBQ08sRUFBSUcsZUFBSixFQUFQOztXQUdTQSxlQUFULENBQXlCZixHQUF6QixFQUE4QmdCLElBQTlCLEVBQW9DQyxXQUFwQyxFQUFpRDtRQUMzQ0MsUUFBUSxFQUFaO1FBQWdCNUQsTUFBTSxLQUF0QjtXQUNPLEVBQUk2RCxJQUFKLEVBQVVmLE1BQU1KLElBQUlJLElBQXBCLEVBQVA7O2FBRVNlLElBQVQsQ0FBY25CLEdBQWQsRUFBbUI7VUFDYmpELE1BQU1pRCxJQUFJSSxJQUFKLENBQVNyRCxHQUFuQjtVQUNHQSxNQUFNLENBQVQsRUFBYTtjQUFPLElBQU4sQ0FBWUEsTUFBTSxDQUFDQSxHQUFQOztZQUNwQkEsTUFBSSxDQUFWLElBQWVpRCxJQUFJb0IsV0FBSixFQUFmOztVQUVHLENBQUU5RCxHQUFMLEVBQVc7OztVQUNSNEQsTUFBTUcsUUFBTixDQUFpQnJGLFNBQWpCLENBQUgsRUFBZ0M7Ozs7OztZQUkxQnNGLE1BQU1SLGNBQWNJLEtBQWQsQ0FBWjtjQUNRLElBQVI7YUFDT0ksR0FBUDs7Ozs7QUNyQk4sZ0JBQWUsVUFBU1YsWUFBVCxFQUF1QkMsTUFBdkIsRUFBK0I7U0FDckMsRUFBSVUsWUFBSixFQUFQOztXQUdTQSxZQUFULENBQXNCdkIsR0FBdEIsRUFBMkJnQixJQUEzQixFQUFpQ0MsV0FBakMsRUFBOEM7UUFDeENULE9BQUssQ0FBVDtRQUFZbEQsTUFBTSxLQUFsQjtRQUF5QmtFLFFBQXpCO1FBQW1DQyxPQUFuQztVQUNNQyxRQUFRLEVBQUlQLE1BQU1RLFNBQVYsRUFBcUJ2QixNQUFNSixJQUFJSSxJQUEvQixFQUFkO1dBQ09zQixLQUFQOzthQUVTQyxTQUFULENBQW1CM0IsR0FBbkIsRUFBd0I0QixVQUF4QixFQUFvQ0MsVUFBcEMsRUFBZ0Q7WUFDeENWLElBQU4sR0FBYVcsV0FBYjs7WUFFTTFCLE9BQU9KLElBQUlJLElBQWpCO1lBQ00yQixNQUFNRixhQUNSQSxXQUFXN0IsR0FBWCxFQUFnQmdCLElBQWhCLENBRFEsR0FFUkEsS0FBS2dCLFdBQUwsQ0FBbUJoQyxJQUFJaUMsU0FBSixFQUFuQixDQUZKO2dCQUdVakIsS0FBS2tCLFVBQUwsQ0FBZ0JILEdBQWhCLEVBQXFCM0IsSUFBckIsQ0FBVjtVQUNHLFFBQVFxQixPQUFYLEVBQXFCOzs7Z0JBQ1RBLE9BQVosRUFBcUIsVUFBckIsRUFBaUMsU0FBakMsRUFBNEMsUUFBNUM7aUJBQ1dULEtBQUttQixjQUFMLENBQW9CQyxJQUFwQixDQUF5QnBCLElBQXpCLEVBQStCUyxPQUEvQixFQUF3Q3JCLElBQXhDLENBQVg7O1VBRUk7aUJBQ09KLEdBQVQ7T0FERixDQUVBLE9BQU1xQyxHQUFOLEVBQVk7ZUFDSFosUUFBUWEsUUFBUixDQUFtQkQsR0FBbkIsRUFBd0JyQyxHQUF4QixDQUFQOzs7WUFFSW1CLElBQU4sR0FBYW9CLFNBQWI7VUFDR2QsUUFBUWUsT0FBWCxFQUFxQjtlQUNaZixRQUFRZSxPQUFSLENBQWdCVCxHQUFoQixFQUFxQi9CLEdBQXJCLENBQVA7Ozs7YUFFS3VDLFNBQVQsQ0FBbUJ2QyxHQUFuQixFQUF3QjRCLFVBQXhCLEVBQW9DOztVQUU5QmEsSUFBSjtVQUNJO2lCQUNPekMsR0FBVDtlQUNPNEIsV0FBVzVCLEdBQVgsRUFBZ0JnQixJQUFoQixDQUFQO09BRkYsQ0FHQSxPQUFNcUIsR0FBTixFQUFZO2VBQ0haLFFBQVFhLFFBQVIsQ0FBbUJELEdBQW5CLEVBQXdCckMsR0FBeEIsQ0FBUDs7O1VBRUMxQyxHQUFILEVBQVM7Y0FDRGdFLE1BQU1HLFFBQVFpQixPQUFSLENBQWtCRCxJQUFsQixFQUF3QnpDLEdBQXhCLENBQVo7ZUFDT3lCLFFBQVFrQixNQUFSLENBQWlCckIsR0FBakIsRUFBc0J0QixHQUF0QixDQUFQO09BRkYsTUFHSztlQUNJeUIsUUFBUWlCLE9BQVIsQ0FBa0JELElBQWxCLEVBQXdCekMsR0FBeEIsQ0FBUDs7OzthQUVLOEIsV0FBVCxDQUFxQjlCLEdBQXJCLEVBQTBCO1VBQ3BCO2lCQUFZQSxHQUFUO09BQVAsQ0FDQSxPQUFNcUMsR0FBTixFQUFZOzs7YUFFTE8sUUFBVCxDQUFrQjVDLEdBQWxCLEVBQXVCO1VBQ2pCakQsTUFBTWlELElBQUlJLElBQUosQ0FBU3JELEdBQW5CO1VBQ0dBLE9BQU8sQ0FBVixFQUFjO1lBQ1R5RCxXQUFXekQsR0FBZCxFQUFvQjtpQkFBQTs7T0FEdEIsTUFHSztnQkFDRyxJQUFOOztjQUVHeUQsU0FBUyxDQUFDekQsR0FBYixFQUFtQjttQkFDVixNQUFQO21CQURpQjs7U0FJckIyRSxNQUFNUCxJQUFOLEdBQWFXLFdBQWI7YUFDTyxTQUFQO1lBQ00sSUFBSTFGLEtBQUosQ0FBYSx3QkFBYixDQUFOOzs7OztBQUdOLFNBQVN5RyxTQUFULENBQW1CcEgsR0FBbkIsRUFBd0IsR0FBR3FILElBQTNCLEVBQWlDO09BQzNCLE1BQU1DLEdBQVYsSUFBaUJELElBQWpCLEVBQXdCO1FBQ25CLGVBQWUsT0FBT3JILElBQUlzSCxHQUFKLENBQXpCLEVBQW9DO1lBQzVCLElBQUl0RCxTQUFKLENBQWlCLGFBQVlzRCxHQUFJLG9CQUFqQyxDQUFOOzs7OztBQ25FTixnQkFBZSxVQUFTbkMsWUFBVCxFQUF1QkMsTUFBdkIsRUFBK0I7UUFDdEMsRUFBQ21DLGFBQUQsS0FBa0JwQyxZQUF4QjtRQUNNLEVBQUNxQyxTQUFELEVBQVlDLFNBQVosS0FBeUJyQyxNQUEvQjtRQUNNLEVBQUNyQyxRQUFRMkUsYUFBVCxLQUEwQkMsUUFBaEM7O1FBRU1DLGdCQUFnQkMsT0FBU3pDLE9BQU93QyxhQUFQLElBQXdCLElBQWpDLENBQXRCO01BQ0csT0FBT0EsYUFBUCxJQUF3QixRQUFRQSxhQUFuQyxFQUFtRDtVQUMzQyxJQUFJakgsS0FBSixDQUFhLDBCQUF5QmlILGFBQWMsRUFBcEQsQ0FBTjs7O1NBRUssRUFBSUUsY0FBSixFQUFvQkMsZUFBcEIsRUFBcUNMLGFBQXJDLEVBQVA7O1dBR1NJLGNBQVQsQ0FBd0JFLE9BQXhCLEVBQWlDQyxRQUFqQyxFQUEyQ0MsVUFBM0MsRUFBdUQ7VUFDL0NDLFdBQVdELFdBQVdDLFFBQTVCO1VBQ01DLFdBQVdDLG1CQUFtQkwsT0FBbkIsRUFBNEJDLFFBQTVCLEVBQXNDQyxVQUF0QyxDQUFqQjs7UUFFR0EsV0FBV0ksU0FBZCxFQUEwQjthQUNqQixFQUFJQyxJQUFKLEVBQVVDLFFBQVFDLFlBQWxCLEVBQVA7OztXQUVLLEVBQUlGLElBQUosRUFBUDs7YUFJU0EsSUFBVCxDQUFjRyxJQUFkLEVBQW9CMUksR0FBcEIsRUFBeUIySSxJQUF6QixFQUErQjthQUN0QlIsU0FBU1EsSUFBVCxFQUFlM0ksR0FBZixFQUFvQjBJLElBQXBCLENBQVA7VUFDR2QsZ0JBQWdCZSxLQUFLQyxVQUF4QixFQUFxQztZQUNoQyxDQUFFNUksSUFBSWUsS0FBVCxFQUFpQjtjQUFLQSxLQUFKLEdBQVl5RyxXQUFaOztZQUNkdEcsU0FBSixHQUFnQixXQUFoQjtjQUNNMkgsUUFBUUMsWUFBWUosSUFBWixFQUFrQjFJLEdBQWxCLENBQWQ7ZUFDTzZJLE1BQVEsSUFBUixFQUFjRixJQUFkLENBQVA7OztVQUVFekgsU0FBSixHQUFnQixRQUFoQjtVQUNJeUgsSUFBSixHQUFXQSxJQUFYO1lBQ01JLFdBQVdYLFNBQVNyRixNQUFULENBQWdCL0MsR0FBaEIsQ0FBakI7WUFDTXVFLE1BQU1nRCxjQUFnQndCLFNBQVMvSSxHQUFULENBQWhCLENBQVo7YUFDTzBJLEtBQUtILElBQUwsQ0FBWWhFLEdBQVosQ0FBUDs7O2FBR091RSxXQUFULENBQXFCSixJQUFyQixFQUEyQjFJLEdBQTNCLEVBQWdDc0csR0FBaEMsRUFBcUM7WUFDN0J5QyxXQUFXWCxTQUFTckYsTUFBVCxDQUFnQi9DLEdBQWhCLENBQWpCO1VBQ0ksRUFBQytFLElBQUQsS0FBU2dFLFNBQVMvSSxHQUFULENBQWI7VUFDRyxTQUFTc0csR0FBWixFQUFrQjtZQUNacUMsSUFBSixHQUFXckMsR0FBWDtjQUNNL0IsTUFBTWdELGNBQWdCdkgsR0FBaEIsQ0FBWjthQUNLdUksSUFBTCxDQUFZaEUsR0FBWjs7O2FBRUssZ0JBQWdCMUMsR0FBaEIsRUFBcUI4RyxJQUFyQixFQUEyQjtZQUM3QixTQUFTNUQsSUFBWixFQUFtQjtnQkFDWCxJQUFJcEUsS0FBSixDQUFZLGlCQUFaLENBQU47O1lBQ0VrRixHQUFKO2FBQ0ksTUFBTTdGLEdBQVYsSUFBaUIrSCxnQkFBa0JZLElBQWxCLEVBQXdCNUQsSUFBeEIsRUFBOEJsRCxHQUE5QixDQUFqQixFQUFxRDtnQkFDN0MwQyxNQUFNZ0QsY0FBZ0J2SCxHQUFoQixDQUFaO2dCQUNNLE1BQU0wSSxLQUFLSCxJQUFMLENBQVloRSxHQUFaLENBQVo7O1lBQ0MxQyxHQUFILEVBQVM7aUJBQVEsSUFBUDs7ZUFDSGdFLEdBQVA7T0FSRjs7O2FBV09tRCxhQUFULENBQXVCTixJQUF2QixFQUE2QjFJLEdBQTdCLEVBQWtDc0csR0FBbEMsRUFBdUM7WUFDL0J5QyxXQUFXWCxTQUFTckYsTUFBVCxDQUFnQi9DLEdBQWhCLENBQWpCO1VBQ0ksRUFBQytFLElBQUQsS0FBU2dFLFNBQVMvSSxHQUFULENBQWI7VUFDRyxTQUFTc0csR0FBWixFQUFrQjtZQUNacUMsSUFBSixHQUFXckMsR0FBWDtjQUNNL0IsTUFBTWdELGNBQWdCdkgsR0FBaEIsQ0FBWjthQUNLdUksSUFBTCxDQUFZaEUsR0FBWjs7O2FBRUssVUFBVTFDLEdBQVYsRUFBZThHLElBQWYsRUFBcUI7WUFDdkIsU0FBUzVELElBQVosRUFBbUI7Z0JBQ1gsSUFBSXBFLEtBQUosQ0FBWSxpQkFBWixDQUFOOztjQUNJWCxNQUFNK0UsS0FBSyxFQUFDbEQsR0FBRCxFQUFMLENBQVo7WUFDSThHLElBQUosR0FBV0EsSUFBWDtjQUNNcEUsTUFBTWdELGNBQWdCdkgsR0FBaEIsQ0FBWjtZQUNHNkIsR0FBSCxFQUFTO2lCQUFRLElBQVA7O2VBQ0g2RyxLQUFLSCxJQUFMLENBQVloRSxHQUFaLENBQVA7T0FQRjs7O2FBVU9rRSxVQUFULEdBQXNCO1lBQ2QsRUFBQ1EsSUFBRCxFQUFPQyxRQUFQLEtBQW1CaEIsV0FBV0ksU0FBcEM7WUFDTWEsYUFBYSxFQUFDQyxRQUFRSixhQUFULEVBQXdCSyxPQUFPUCxXQUEvQixHQUE0Q0csSUFBNUMsQ0FBbkI7VUFDR0UsVUFBSCxFQUFnQjtlQUFRWCxNQUFQOzs7ZUFFUkEsTUFBVCxDQUFnQkUsSUFBaEIsRUFBc0IxSSxHQUF0QixFQUEyQnNHLEdBQTNCLEVBQWdDO1lBQzNCLENBQUV0RyxJQUFJZSxLQUFULEVBQWlCO2NBQUtBLEtBQUosR0FBWXlHLFdBQVo7O1lBQ2R0RyxTQUFKLEdBQWdCLFdBQWhCO2NBQ01nSSxXQUNGQSxTQUFTNUMsR0FBVCxFQUFjdEcsR0FBZCxFQUFtQjBJLElBQW5CLENBREUsR0FFRmpCLFVBQVVuQixHQUFWLENBRko7Y0FHTXVDLFFBQVFNLFdBQWFULElBQWIsRUFBbUIxSSxHQUFuQixFQUF3QnNHLEdBQXhCLENBQWQ7Y0FDTWdELEtBQU4sR0FBY0EsS0FBZCxDQUFxQkEsTUFBTUMsR0FBTixHQUFZRCxNQUFNM0MsSUFBTixDQUFXLElBQVgsQ0FBWjtlQUNkMkMsS0FBUDs7aUJBRVNBLEtBQVQsQ0FBZUUsS0FBZixFQUFzQjs7aUJBRWJBLFNBQVMsSUFBVCxHQUNIWCxNQUFRLFNBQU8sSUFBZixFQUFxQlYsU0FBU3FCLEtBQVQsRUFBZ0J4SixHQUFoQixFQUFxQjBJLElBQXJCLENBQXJCLENBREcsR0FFSEcsTUFBUSxJQUFSLENBRko7Ozs7OztZQUtHZCxlQUFYLENBQTJCdkQsR0FBM0IsRUFBZ0NpRixRQUFoQyxFQUEwQzVILEdBQTFDLEVBQStDO1FBQzFDLFFBQVEyQyxHQUFYLEVBQWlCO1lBQ1R4RSxNQUFNeUosU0FBUyxFQUFDNUgsR0FBRCxFQUFULENBQVo7WUFDTTdCLEdBQU47Ozs7UUFHRTBKLElBQUksQ0FBUjtRQUFXQyxZQUFZbkYsSUFBSW9FLFVBQUosR0FBaUJoQixhQUF4QztXQUNNOEIsSUFBSUMsU0FBVixFQUFzQjtZQUNkQyxLQUFLRixDQUFYO1dBQ0s5QixhQUFMOztZQUVNNUgsTUFBTXlKLFVBQVo7VUFDSWQsSUFBSixHQUFXbkUsSUFBSUYsS0FBSixDQUFVc0YsRUFBVixFQUFjRixDQUFkLENBQVg7WUFDTTFKLEdBQU47Ozs7WUFHTUEsTUFBTXlKLFNBQVMsRUFBQzVILEdBQUQsRUFBVCxDQUFaO1VBQ0k4RyxJQUFKLEdBQVduRSxJQUFJRixLQUFKLENBQVVvRixDQUFWLENBQVg7WUFDTTFKLEdBQU47Ozs7Ozs7QUFPTixTQUFTcUksa0JBQVQsQ0FBNEJMLE9BQTVCLEVBQXFDQyxRQUFyQyxFQUErQ0MsVUFBL0MsRUFBMkQ7UUFDbkRFLFdBQVcsRUFBakI7V0FDU3JGLE1BQVQsR0FBa0I0RSxTQUFTNUUsTUFBM0I7O09BRUksTUFBTThHLEtBQVYsSUFBbUJsQyxRQUFuQixFQUE4QjtVQUN0Qm1DLE9BQU9ELFFBQVEzQixXQUFXMkIsTUFBTTNJLFNBQWpCLENBQVIsR0FBc0MsSUFBbkQ7UUFDRyxDQUFFNEksSUFBTCxFQUFZOzs7O1VBRU4sRUFBQ2hLLElBQUQsRUFBTzhELElBQVAsRUFBYUMsTUFBYixLQUF1QmdHLEtBQTdCO1VBQ00vRixXQUFXbUUsV0FBV25JLElBQTVCO1VBQ00sRUFBQ2lLLE1BQUQsS0FBV0QsSUFBakI7O2FBRVNmLFFBQVQsQ0FBa0IvSSxHQUFsQixFQUF1QjtXQUNoQjhELFFBQUwsRUFBZTlELEdBQWY7YUFDT0EsR0FBUDs7O2FBRU9nSyxRQUFULENBQWtCekYsR0FBbEIsRUFBdUJnQixJQUF2QixFQUE2QjthQUNwQmhCLEdBQVA7YUFDT3dGLE9BQU94RixHQUFQLEVBQVlnQixJQUFaLENBQVA7OzthQUVPekIsUUFBVCxHQUFvQmtHLFNBQVNsRyxRQUFULEdBQW9CQSxRQUF4QzthQUNTaEUsSUFBVCxJQUFpQmlKLFFBQWpCO1lBQ1FqRixRQUFSLElBQW9Ca0csUUFBcEI7Ozs7O1NBT0s1QixRQUFQOzs7QUNoSmEsU0FBUzZCLFdBQVQsQ0FBcUI5RSxZQUFyQixFQUFtQ0gsT0FBbkMsRUFBNEM7UUFDbkRJLFNBQVM4RSxPQUFPQyxNQUFQLENBQWdCLEVBQUNoRixZQUFELEVBQWVpRixRQUFmLEVBQWhCLEVBQTBDcEYsT0FBMUMsQ0FBZjs7U0FFT21GLE1BQVAsQ0FBZ0IvRSxNQUFoQixFQUNFaUYsVUFBWWxGLFlBQVosRUFBMEJDLE1BQTFCLENBREYsRUFFRWtELFVBQVluRCxZQUFaLEVBQTBCQyxNQUExQixDQUZGLEVBR0VsRSxVQUFZaUUsWUFBWixFQUEwQkMsTUFBMUIsQ0FIRjs7U0FLT0EsTUFBUDs7O0FBRUYsU0FBU2dGLFFBQVQsQ0FBa0I3RixHQUFsQixFQUF1QmdCLElBQXZCLEVBQTZCK0UsV0FBN0IsRUFBMEM7UUFDbEMsRUFBQ0MsUUFBRCxLQUFhaEYsSUFBbkI7UUFBeUIsRUFBQzdFLEtBQUQsS0FBVTZELElBQUlJLElBQXZDO01BQ0lzQixRQUFRc0UsU0FBU0MsR0FBVCxDQUFhOUosS0FBYixDQUFaO01BQ0dILGNBQWMwRixLQUFqQixFQUF5QjtRQUNwQixDQUFFdkYsS0FBTCxFQUFhO1lBQU8sSUFBSUMsS0FBSixDQUFhLGtCQUFpQkQsS0FBTSxFQUFwQyxDQUFOOzs7WUFFTjRKLFlBQWMvRixHQUFkLEVBQW1CZ0IsSUFBbkIsRUFBeUIsTUFBTWdGLFNBQVNFLE1BQVQsQ0FBZ0IvSixLQUFoQixDQUEvQixDQUFSO2FBQ1NnSyxHQUFULENBQWVoSyxLQUFmLEVBQXNCdUYsS0FBdEI7O1NBQ0tBLEtBQVA7OztBQzNCRixNQUFNMEUsaUJBQWlCO1NBQ2RuRyxHQUFQLEVBQVl4RSxHQUFaLEVBQWlCMEksSUFBakIsRUFBdUI7V0FBVWxFLEdBQVA7R0FETDtTQUVkQSxHQUFQLEVBQVlHLElBQVosRUFBa0JZLElBQWxCLEVBQXdCO1dBQVVmLEdBQVA7R0FGTixFQUF2Qjs7QUFJQSxBQUNPLFNBQVNvRyxlQUFULENBQXVCeEYsTUFBdkIsRUFBK0IsRUFBQ3lGLE1BQUQsRUFBU0MsTUFBVCxLQUFpQkgsY0FBaEQsRUFBZ0U7UUFDL0QsRUFBQ1AsUUFBRCxFQUFXOUUsZUFBWCxFQUE0QlEsWUFBNUIsRUFBMEMyQixTQUExQyxLQUF1RHJDLE1BQTdEO1FBQ00sRUFBQzJGLFNBQUQsRUFBWUMsV0FBWixLQUEyQjVGLE9BQU9ELFlBQXhDO1FBQ004RixvQkFBb0JDLGVBQTFCOztTQUVPO1lBQUE7O1FBR0RDLFFBQUosR0FBZTthQUFVLEtBQUtDLE1BQVo7S0FIYjtZQUlHO2FBQ0M3RyxHQUFQLEVBQVlnQixJQUFaLEVBQWtCO2NBQ1ZaLE9BQU9KLElBQUlJLElBQWpCO2NBQ00yQixNQUFNK0UsY0FBZ0I5RyxJQUFJb0IsV0FBSixFQUFoQixFQUFtQ2hCLElBQW5DLEVBQXlDWSxJQUF6QyxDQUFaO2VBQ09BLEtBQUsrRixPQUFMLENBQWVoRixHQUFmLEVBQW9CM0IsSUFBcEIsQ0FBUDtPQUpJLEVBSkg7O2VBVU07YUFDRkosR0FBUCxFQUFZZ0IsSUFBWixFQUFrQjtjQUNWVSxRQUFRbUUsU0FBVzdGLEdBQVgsRUFBZ0JnQixJQUFoQixFQUFzQkQsZUFBdEIsQ0FBZDtjQUNNaUcsV0FBV3RGLE1BQU1QLElBQU4sQ0FBV25CLEdBQVgsQ0FBakI7WUFDR2hFLGNBQWNnTCxRQUFqQixFQUE0QjtnQkFDcEI1RyxPQUFPc0IsTUFBTXRCLElBQW5CO2dCQUNNMkIsTUFBTStFLGNBQWdCRSxRQUFoQixFQUEwQjVHLElBQTFCLEVBQWdDWSxJQUFoQyxDQUFaO2lCQUNPQSxLQUFLK0YsT0FBTCxDQUFlaEYsR0FBZixFQUFvQjNCLElBQXBCLENBQVA7O09BUEssRUFWTjs7ZUFtQk07WUFDSCxRQURHO2FBRUZKLEdBQVAsRUFBWWdCLElBQVosRUFBa0I7Y0FDVlUsUUFBUW1FLFNBQVc3RixHQUFYLEVBQWdCZ0IsSUFBaEIsRUFBc0JPLFlBQXRCLENBQWQ7ZUFDT0csTUFBTVAsSUFBTixDQUFXbkIsR0FBWCxFQUFnQjJHLGVBQWhCLEVBQWlDRCxpQkFBakMsQ0FBUDtPQUpPOztlQU1BM0UsR0FBVCxFQUFjdEcsR0FBZCxFQUFtQjBJLElBQW5CLEVBQXlCO2NBQ2pCOEMsVUFBVVQsVUFBWXRELFVBQVluQixHQUFaLENBQVosQ0FBaEI7ZUFDT3VFLE9BQU9XLE9BQVAsRUFBZ0J4TCxHQUFoQixFQUFxQjBJLElBQXJCLENBQVA7T0FSTyxFQW5CTixFQUFQOztXQThCU1AsUUFBVCxDQUFrQlEsSUFBbEIsRUFBd0IzSSxHQUF4QixFQUE2QjBJLElBQTdCLEVBQW1DO1VBQzNCNkMsV0FBV1IsVUFBWXRELFVBQVlrQixJQUFaLENBQVosQ0FBakI7V0FDT2tDLE9BQU9VLFFBQVAsRUFBaUJ2TCxHQUFqQixFQUFzQjBJLElBQXRCLENBQVA7OztXQUVPd0MsZUFBVCxDQUF5QjNHLEdBQXpCLEVBQThCZ0IsSUFBOUIsRUFBb0M7VUFDNUJrRyxXQUFXWCxPQUFPdkcsSUFBSW9CLFdBQUosRUFBUCxFQUEwQnBCLElBQUlJLElBQTlCLEVBQW9DWSxJQUFwQyxDQUFqQjtXQUNPQSxLQUFLZ0IsV0FBTCxDQUFtQnlFLFlBQWNTLFFBQWQsQ0FBbkIsQ0FBUDs7O1dBRU9KLGFBQVQsQ0FBdUJFLFFBQXZCLEVBQWlDNUcsSUFBakMsRUFBdUNZLElBQXZDLEVBQTZDO1VBQ3JDa0csV0FBV1gsT0FBT1MsUUFBUCxFQUFpQjVHLElBQWpCLEVBQXVCWSxJQUF2QixDQUFqQjtXQUNPQSxLQUFLZ0IsV0FBTCxDQUFtQmtGLFdBQVdULFlBQVlTLFFBQVosQ0FBWCxHQUFtQ2xMLFNBQXRELENBQVA7Ozs7QUNsREosTUFBTW9LLG1CQUFpQjtTQUNkbkcsR0FBUCxFQUFZeEUsR0FBWixFQUFpQjBJLElBQWpCLEVBQXVCO1dBQVVsRSxHQUFQO0dBREw7U0FFZEEsR0FBUCxFQUFZRyxJQUFaLEVBQWtCWSxJQUFsQixFQUF3QjtXQUFVZixHQUFQO0dBRk4sRUFBdkI7O0FBSUEsQUFDTyxTQUFTa0gsaUJBQVQsQ0FBeUJ0RyxNQUF6QixFQUFpQyxFQUFDeUYsTUFBRCxFQUFTQyxNQUFULEtBQWlCSCxnQkFBbEQsRUFBa0U7UUFDakUsRUFBQ1AsUUFBRCxFQUFXOUUsZUFBWCxFQUE0QlEsWUFBNUIsS0FBNENWLE1BQWxEO1FBQ00sRUFBQ3VHLFFBQUQsS0FBYXZHLE9BQU9ELFlBQTFCOztTQUVPO1lBQUE7O1FBR0RnRyxRQUFKLEdBQWU7YUFBVSxLQUFLQyxNQUFaO0tBSGI7WUFJRzthQUNDN0csR0FBUCxFQUFZZ0IsSUFBWixFQUFrQjtjQUNWWixPQUFPSixJQUFJSSxJQUFqQjtjQUNNNEcsV0FBV2hILElBQUlvQixXQUFKLEVBQWpCO2NBQ01XLE1BQU0rRSxjQUFnQkUsUUFBaEIsRUFBMEI1RyxJQUExQixFQUFnQ1ksSUFBaEMsQ0FBWjtlQUNPQSxLQUFLK0YsT0FBTCxDQUFlaEYsR0FBZixFQUFvQjNCLElBQXBCLENBQVA7T0FMSSxFQUpIOztlQVdNO2FBQ0ZKLEdBQVAsRUFBWWdCLElBQVosRUFBa0I7Y0FDVlUsUUFBUW1FLFNBQVc3RixHQUFYLEVBQWdCZ0IsSUFBaEIsRUFBc0JELGVBQXRCLENBQWQ7Y0FDTWlHLFdBQVd0RixNQUFNUCxJQUFOLENBQVduQixHQUFYLENBQWpCO1lBQ0doRSxjQUFjZ0wsUUFBakIsRUFBNEI7Z0JBQ3BCNUcsT0FBT3NCLE1BQU10QixJQUFuQjtnQkFDTTJCLE1BQU0rRSxjQUFnQkUsUUFBaEIsRUFBMEI1RyxJQUExQixFQUFnQ1ksSUFBaEMsQ0FBWjtpQkFDT0EsS0FBSytGLE9BQUwsQ0FBZWhGLEdBQWYsRUFBb0IzQixJQUFwQixDQUFQOztPQVBLLEVBWE47O2VBb0JNO1lBQ0gsT0FERzthQUVGSixHQUFQLEVBQVlnQixJQUFaLEVBQWtCO2NBQ1ZVLFFBQVFtRSxTQUFXN0YsR0FBWCxFQUFnQmdCLElBQWhCLEVBQXNCTyxZQUF0QixDQUFkO2NBQ015RixXQUFXdEYsTUFBTVAsSUFBTixDQUFXbkIsR0FBWCxFQUFnQnFILFVBQWhCLEVBQTRCWCxpQkFBNUIsQ0FBakI7WUFDRzFLLGNBQWNnTCxRQUFqQixFQUE0QjtnQkFDcEI1RyxPQUFPc0IsTUFBTXRCLElBQW5CO2dCQUNNMkIsTUFBTStFLGNBQWdCRSxRQUFoQixFQUEwQjVHLElBQTFCLEVBQWdDWSxJQUFoQyxDQUFaO2lCQUNPQSxLQUFLK0YsT0FBTCxDQUFlaEYsR0FBZixFQUFvQjNCLElBQXBCLENBQVA7O09BUks7O2VBVUEyQixHQUFULEVBQWN0RyxHQUFkLEVBQW1CMEksSUFBbkIsRUFBeUI7Y0FDakI4QyxVQUFVVCxVQUFZdEQsVUFBWW5CLEdBQVosQ0FBWixDQUFoQjtlQUNPdUUsT0FBT1csT0FBUCxFQUFnQnhMLEdBQWhCLEVBQXFCMEksSUFBckIsQ0FBUDtPQVpPLEVBcEJOLEVBQVA7O1dBbUNTdUMsaUJBQVQsQ0FBMkIxRyxHQUEzQixFQUFnQ2dCLElBQWhDLEVBQXNDO1VBQzlCa0csV0FBV1gsT0FBT3ZHLElBQUlvQixXQUFKLEVBQVAsRUFBMEJwQixJQUFJSSxJQUE5QixFQUFvQ1ksSUFBcEMsQ0FBakI7V0FDT0EsS0FBS2dCLFdBQUwsQ0FBbUJ5RSxZQUFZUyxRQUFaLENBQW5CLENBQVA7OztXQUVPdEQsUUFBVCxDQUFrQlEsSUFBbEIsRUFBd0IzSSxHQUF4QixFQUE2QjBJLElBQTdCLEVBQW1DO1VBQzNCNkMsV0FBV0ksU0FBV2hELElBQVgsQ0FBakI7V0FDT2tDLE9BQU9VLFFBQVAsRUFBaUJ2TCxHQUFqQixFQUFzQjBJLElBQXRCLENBQVA7O1dBQ08yQyxhQUFULENBQXVCRSxRQUF2QixFQUFpQzVHLElBQWpDLEVBQXVDWSxJQUF2QyxFQUE2QztXQUNwQ3VGLE9BQU9TLFFBQVAsRUFBaUI1RyxJQUFqQixFQUF1QlksSUFBdkIsQ0FBUDs7OztBQUVKLFNBQVNxRyxVQUFULENBQW9CckgsR0FBcEIsRUFBeUI7U0FBVUEsSUFBSW9CLFdBQUosRUFBUDs7O0FDckRyQixTQUFTa0csa0JBQVQsQ0FBMEI3RCxPQUExQixFQUFtQzhELElBQW5DLEVBQXlDMUcsTUFBekMsRUFBaUQ7UUFDaEQsRUFBQ3NDLGFBQUQsRUFBZ0JGLFNBQWhCLEtBQTZCcEMsTUFBbkM7UUFDTSxFQUFDbUMsYUFBRCxLQUFrQm5DLE9BQU9ELFlBQS9COztRQUVNNEcsYUFBYXJFLGNBQWdCLEVBQUN6SCxTQUFTLElBQVYsRUFBZ0JjLE9BQU8sSUFBdkIsRUFBNkJHLFdBQVcsUUFBeEMsRUFBaEIsQ0FBbkI7UUFDTThLLGFBQWF0RSxjQUFnQixFQUFDekgsU0FBUyxJQUFWLEVBQWdCUyxPQUFPLElBQXZCLEVBQTZCUSxXQUFXLFVBQXhDLEVBQWhCLENBQW5COztRQUVNK0ssWUFBWUgsT0FBSyxHQUF2QjtVQUNRRyxTQUFSLElBQXFCQyxTQUFyQjtRQUNNQyxZQUFZTCxPQUFLLEdBQXZCO1VBQ1FBLE9BQUssR0FBYixJQUFvQk0sU0FBcEI7O1NBRU8sRUFBSTdELE1BQUs4RCxJQUFULEVBQWVBLElBQWYsRUFBUDs7V0FFU0EsSUFBVCxDQUFjM0QsSUFBZCxFQUFvQjFJLEdBQXBCLEVBQXlCO1FBQ3BCLENBQUVBLElBQUllLEtBQVQsRUFBaUI7VUFDWEEsS0FBSixHQUFZeUcsV0FBWjs7UUFDRW1CLElBQUosR0FBVzJELEtBQUtDLFNBQUwsQ0FBaUI7VUFDdEIsTUFEc0IsRUFDZEMsS0FBSyxJQUFJQyxJQUFKLEVBRFMsRUFBakIsQ0FBWDtlQUVXN0ksSUFBWCxDQUFnQnVJLFNBQWhCLEVBQTJCbk0sR0FBM0I7VUFDTXVFLE1BQU1nRCxjQUFnQnZILEdBQWhCLENBQVo7V0FDTzBJLEtBQUtILElBQUwsQ0FBWWhFLEdBQVosQ0FBUDs7O1dBRU82SCxTQUFULENBQW1CN0gsR0FBbkIsRUFBd0JnQixJQUF4QixFQUE4Qm1ILE1BQTlCLEVBQXNDO2VBQ3pCN0ksTUFBWCxDQUFrQlUsR0FBbEI7UUFDSW9FLElBQUosR0FBV3BFLElBQUlvSSxTQUFKLEVBQVg7ZUFDYXBJLElBQUlvRSxJQUFqQixFQUF1QnBFLEdBQXZCLEVBQTRCbUksTUFBNUI7V0FDT25ILEtBQUtxSCxRQUFMLENBQWNySSxJQUFJb0UsSUFBbEIsRUFBd0JwRSxJQUFJSSxJQUE1QixDQUFQOzs7V0FFT2tJLFVBQVQsQ0FBb0IsRUFBQ0wsR0FBRCxFQUFwQixFQUEyQk0sUUFBM0IsRUFBcUNKLE1BQXJDLEVBQTZDO1VBQ3JDLEVBQUNoTSxLQUFELEVBQVFKLFNBQVIsRUFBbUJELFNBQW5CLEVBQThCSixTQUFROE0sSUFBdEMsS0FBOENELFNBQVNuSSxJQUE3RDtVQUNNM0UsTUFBTSxFQUFJVSxLQUFKO2VBQ0QsRUFBSUosU0FBSixFQUFlRCxTQUFmLEVBREM7aUJBRUMwTSxLQUFLMU0sU0FGTixFQUVpQkMsV0FBV3lNLEtBQUt6TSxTQUZqQztZQUdKZ00sS0FBS0MsU0FBTCxDQUFpQjtZQUNqQixNQURpQixFQUNUQyxHQURTLEVBQ0pRLEtBQUssSUFBSVAsSUFBSixFQURELEVBQWpCLENBSEksRUFBWjs7ZUFNVzdJLElBQVgsQ0FBZ0JxSSxTQUFoQixFQUEyQmpNLEdBQTNCO1VBQ011RSxNQUFNZ0QsY0FBZ0J2SCxHQUFoQixDQUFaO1dBQ08wTSxPQUFPTyxRQUFQLENBQWtCLENBQUMxSSxHQUFELENBQWxCLENBQVA7OztXQUVPMkgsU0FBVCxDQUFtQjNILEdBQW5CLEVBQXdCZ0IsSUFBeEIsRUFBOEI7ZUFDakIxQixNQUFYLENBQWtCVSxHQUFsQjtRQUNJb0UsSUFBSixHQUFXcEUsSUFBSW9JLFNBQUosRUFBWDtXQUNPcEgsS0FBS3FILFFBQUwsQ0FBY3JJLElBQUlvRSxJQUFsQixFQUF3QnBFLElBQUlJLElBQTVCLENBQVA7Ozs7QUN2Q0osTUFBTXVJLHlCQUEyQjtlQUNsQixJQURrQjthQUVwQlosS0FBS0MsU0FGZTtTQUd4QlksU0FBUCxFQUFrQjtXQUFVQSxTQUFQO0dBSFUsRUFBakM7O0FBTUEsYUFBZSxVQUFTQyxjQUFULEVBQXlCO21CQUNyQmxELE9BQU9DLE1BQVAsQ0FBZ0IsRUFBaEIsRUFBb0IrQyxzQkFBcEIsRUFBNENFLGNBQTVDLENBQWpCO1FBQ00sRUFBRUMsV0FBRixFQUFlN0YsU0FBZixFQUEwQkMsU0FBMUIsS0FBd0MyRixjQUE5Qzs7U0FFUyxFQUFDRSxRQUFELEVBQVdDLE9BQU8sQ0FBQyxDQUFuQjtHQUFUOztXQUVTRCxRQUFULENBQWtCRSxZQUFsQixFQUFnQ0MsS0FBaEMsRUFBdUM7VUFDL0IsRUFBQ3RJLFlBQUQsS0FBaUJxSSxhQUFhRSxTQUFwQztRQUNHLFFBQU12SSxZQUFOLElBQXNCLENBQUVBLGFBQWF3SSxjQUFiLEVBQTNCLEVBQTJEO1lBQ25ELElBQUkzSixTQUFKLENBQWlCLGlDQUFqQixDQUFOOzs7VUFHSW9CLFNBQVM2RSxZQUFjOUUsWUFBZCxFQUE0QixFQUFJcUMsU0FBSixFQUFlQyxTQUFmLEVBQTVCLENBQWY7UUFDSTBGLFlBQVksRUFBSS9ILE1BQUosRUFBWW9DLFNBQVosRUFBdUJRLFNBQVMsRUFBaEMsRUFBb0M0RixRQUFRMUQsT0FBTzJELE1BQVAsQ0FBYyxJQUFkLENBQTVDLEVBQWhCOztRQUVHVCxlQUFlVSxXQUFsQixFQUFnQztrQkFDbEJDLGVBQWlCWixTQUFqQixDQUFaOzs7Z0JBRVVDLGVBQWVZLE1BQWYsQ0FBd0JiLFNBQXhCLENBQVo7aUJBQ2FPLFNBQWIsQ0FBdUJQLFNBQXZCLEdBQW1DQSxTQUFuQzs7OztBQUdKLEFBQU8sU0FBU1ksY0FBVCxDQUF3QlosU0FBeEIsRUFBbUM7UUFDbEMsRUFBQ25GLE9BQUQsRUFBVTRGLE1BQVYsRUFBa0J4SSxNQUFsQixLQUE0QitILFNBQWxDOztTQUVPYyxPQUFQLEdBQWlCTCxPQUFPTSxJQUFQLEdBQ2Y5SSxPQUFPMEMsY0FBUDtTQUFBLEVBQ1csSUFEWCxFQUNpQjhDLGdCQUFjeEYsTUFBZCxDQURqQixDQURGOztTQUlPK0ksTUFBUCxHQUNFL0ksT0FBTzBDLGNBQVA7U0FBQSxFQUNXLElBRFgsRUFDaUI0RCxrQkFBZ0J0RyxNQUFoQixDQURqQixDQURGOztTQUlPZ0osT0FBUDtxQkFDcUJwRyxPQUFuQixFQUE0QixJQUE1QixFQUFrQzVDLE1BQWxDLENBREY7O1NBR08rSCxTQUFQOzs7QUM5Q0YsTUFBTWtCLGtCQUFrQixnQkFBZ0IsT0FBT0MsTUFBdkIsR0FDcEJBLE9BQU9DLE1BQVAsQ0FBY0YsZUFETSxHQUNZLElBRHBDOztBQUdBRyxrQkFBa0JoSCxTQUFsQixHQUE4QkEsU0FBOUI7QUFDQSxTQUFTQSxTQUFULEdBQXFCO1FBQ2JpSCxNQUFNLElBQUlDLFVBQUosQ0FBZSxDQUFmLENBQVo7a0JBQ2dCRCxHQUFoQjtTQUNPQSxJQUFJLENBQUosQ0FBUDs7O0FBRUYsQUFBZSxTQUFTRCxpQkFBVCxDQUEyQnBCLGlCQUFlLEVBQTFDLEVBQThDO01BQ3hELFFBQVFBLGVBQWU1RixTQUExQixFQUFzQzttQkFDckJBLFNBQWYsR0FBMkJBLFNBQTNCOzs7U0FFS21ILE9BQU92QixjQUFQLENBQVA7Ozs7OyJ9
