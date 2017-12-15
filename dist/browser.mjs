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

    function feed_init(pkt, as_content) {
      state.feed = feed_ignore;

      const info = pkt.info;
      const msg = sink.json_unpack(pkt.body_utf8());
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
      const { mode } = transports.streaming;
      const msend_impl = { object: msend_objects, bytes: msend_bytes }[mode];
      if (msend_impl) {
        return stream;
      }

      function stream(chan, obj, msg) {
        if (!obj.token) {
          obj.token = random_id();
        }
        obj.transport = 'streaming';
        const msend = msend_impl(chan, obj, json_pack(msg));
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
  decode(buf, sink) {
    return buf;
  } };

function json_protocol$1(shared, { encode, decode } = noop_encodings) {
  const { stateFor, createMultipart, createStream, json_pack } = shared;
  const { pack_utf8, unpack_utf8 } = shared.packetParser;

  return {
    packBody,

    get datagram() {
      return this.direct;
    },
    direct: {
      t_recv(pkt, sink) {
        const json_buf = decode(pkt.body_buffer(), sink);
        const msg = unpackBodyBuf(json_buf, sink);
        return sink.recvMsg(msg, pkt.info);
      } },

    multipart: {
      t_recv(pkt, sink) {
        const state = stateFor(pkt, sink, createMultipart);
        const body_buf = state.feed(pkt);
        if (undefined !== body_buf) {
          const json_buf = decode(body_buf, sink);
          const msg = unpackBodyBuf(json_buf, sink);
          return sink.recvMsg(msg, state.info);
        }
      } },

    streaming: {
      mode: 'object',
      t_recv(pkt, sink) {
        const state = stateFor(pkt, sink, createStream);
        return state.feed(pkt, as_json_content);
      } } };

  function packBody(body, obj, chan) {
    const body_buf = pack_utf8(json_pack(body));
    return encode(body_buf, obj, chan);
  }

  function as_json_content(pkt, sink) {
    return unpackBodyBuf(pkt.body_buffer(), sink, null);
  }

  function unpackBodyBuf(body_buf, sink, ifAbsent) {
    const json_buf = decode(body_buf, sink);
    return sink.json_unpack(json_buf ? unpack_utf8(json_buf) : ifAbsent);
  }
}

const noop_encodings$1 = {
  encode(buf, obj, chan) {
    return buf;
  },
  decode(buf, sink) {
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
        const body_buf = pkt.body_buffer();
        const msg = unpackBodyBuf(body_buf, sink);
        return sink.recvMsg(msg, pkt.info);
      } },

    multipart: {
      t_recv(pkt, sink) {
        const state = stateFor(pkt, sink, createMultipart);
        const body_buf = state.feed(pkt);
        if (undefined !== body_buf) {
          const msg = unpackBodyBuf(body_buf, sink);
          return sink.recvMsg(msg, state.info);
        }
      } },

    streaming: {
      mode: 'bytes',
      t_recv(pkt, sink) {
        const state = stateFor(pkt, sink, createStream);
        const body_buf = state.feed(pkt, pkt_buffer);
        if (undefined !== body_buf) {
          const msg = unpackBodyBuf(body_buf, sink);
          return sink.recvMsg(msg, state.info);
        }
      } } };

  function packBody(body, obj, chan) {
    const body_buf = asBuffer(body);
    return encode(body_buf, obj, chan);
  }
  function unpackBodyBuf(body_buf, sink) {
    return decode(body_buf, sink);
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

    const protocols = plugin_options.custom(init_protocols(packetParser, { random_id, json_pack }));

    FabricHub_PI.prototype.protocols = protocols;
  }
};

function init_protocols(packetParser, options) {
  const shared = init_shared(packetParser, options);

  const inbound = [];
  const json = shared.bindTransports(inbound, 0x00 // 0x0* — JSON body
  , json_protocol$1(shared));

  const binary = shared.bindTransports(inbound, 0x10 // 0x1* — binary body
  , binary_protocol$1(shared));

  const control = control_protocol$1(inbound, 0xf0 // 0xf* — control
  , shared);

  const codecs = { json, binary, control, default: json };

  return { inbound, codecs, shared, random_id: shared.random_id };
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5tanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvc2hhcmVkL2ZyYW1pbmcuanN5IiwiLi4vY29kZS9zaGFyZWQvbXVsdGlwYXJ0LmpzeSIsIi4uL2NvZGUvc2hhcmVkL3N0cmVhbWluZy5qc3kiLCIuLi9jb2RlL3NoYXJlZC90cmFuc3BvcnQuanN5IiwiLi4vY29kZS9zaGFyZWQvaW5kZXguanN5IiwiLi4vY29kZS9wcm90b2NvbHMvanNvbi5qc3kiLCIuLi9jb2RlL3Byb3RvY29scy9iaW5hcnkuanN5IiwiLi4vY29kZS9wcm90b2NvbHMvY29udHJvbC5qc3kiLCIuLi9jb2RlL3BsdWdpbi5qc3kiLCIuLi9jb2RlL2luZGV4LmJyb3dzZXIuanN5Il0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGxpdHRsZV9lbmRpYW4gPSB0cnVlXG5jb25zdCBjX3NpbmdsZSA9ICdzaW5nbGUnXG5jb25zdCBjX2RhdGFncmFtID0gJ2RhdGFncmFtJ1xuY29uc3QgY19kaXJlY3QgPSAnZGlyZWN0J1xuY29uc3QgY19tdWx0aXBhcnQgPSAnbXVsdGlwYXJ0J1xuY29uc3QgY19zdHJlYW1pbmcgPSAnc3RyZWFtaW5nJ1xuXG5jb25zdCBfZXJyX21zZ2lkX3JlcXVpcmVkID0gYFJlc3BvbnNlIHJlcWlyZXMgJ21zZ2lkJ2BcbmNvbnN0IF9lcnJfdG9rZW5fcmVxdWlyZWQgPSBgVHJhbnNwb3J0IHJlcWlyZXMgJ3Rva2VuJ2BcblxuXG5mdW5jdGlvbiBmcm1fcm91dGluZygpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHgxLCBtYXNrID0gMHgxXG4gIHJldHVybiBAe31cbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gbnVsbCAhPSBvYmouZnJvbV9pZCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGNvbnN0IHtmcm9tX2lkfSA9IG9ialxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgMHxmcm9tX2lkLmlkX3JvdXRlciwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MzIgQCA0K29mZnNldCwgMHxmcm9tX2lkLmlkX3RhcmdldCwgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgY29uc3QgZnJvbV9pZCA9IHVuZGVmaW5lZCA9PT0gb2JqLmZyb21faWRcbiAgICAgICAgPyBvYmouZnJvbV9pZCA9IHt9IDogb2JqLmZyb21faWRcbiAgICAgIGZyb21faWQuaWRfcm91dGVyID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgZnJvbV9pZC5pZF90YXJnZXQgPSBkdi5nZXRJbnQzMiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG5cbmZ1bmN0aW9uIGZybV9yZXNwb25zZSgpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHgyLCBtYXNrID0gMHgyXG4gIHJldHVybiBAe31cbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gbnVsbCAhPSBvYmoubXNnaWQgPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai5tc2dpZCA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX21zZ2lkX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoubXNnaWQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDB8b2JqLnNlcV9hY2ssIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNitvZmZzZXQsIDB8b2JqLmFja19mbGFncywgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLnRva2VuID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcV9hY2sgPSBkdi5nZXRJbnQxNiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouYWNrX2ZsYWdzID0gZHYuZ2V0SW50MTYgQCA2K29mZnNldCwgbGl0dGxlX2VuZGlhblxuXG5cblxuZnVuY3Rpb24gZnJtX2RhdGFncmFtKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDAsIGJpdHMgPSAweDAsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfZGF0YWdyYW1cbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OlxuICAgICAgaWYgY19kYXRhZ3JhbSA9PT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gYml0c1xuICAgICAgaWYgb2JqLnRyYW5zcG9ydCAmJiBjX3NpbmdsZSAhPT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gZmFsc2VcbiAgICAgIHJldHVybiAhIG9iai50b2tlbiA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX2RhdGFncmFtXG5cbmZ1bmN0aW9uIGZybV9kaXJlY3QoKSA6OlxuICBjb25zdCBzaXplID0gNCwgYml0cyA9IDB4NCwgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19kaXJlY3RcbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OlxuICAgICAgaWYgY19kaXJlY3QgPT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGJpdHNcbiAgICAgIGlmIG9iai50cmFuc3BvcnQgJiYgY19zaW5nbGUgIT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGZhbHNlXG4gICAgICByZXR1cm4gISEgb2JqLnRva2VuID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoudG9rZW4gOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl90b2tlbl9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLnRva2VuLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoubXNnaWQgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19kaXJlY3RcblxuZnVuY3Rpb24gZnJtX211bHRpcGFydCgpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHg4LCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX211bHRpcGFydFxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6IHJldHVybiBjX211bHRpcGFydCA9PT0gb2JqLnRyYW5zcG9ydCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgYmluZF9zZXFfbmV4dCwgc2VxX3BvczogNFxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai50b2tlbiA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX3Rva2VuX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoudG9rZW4sIGxpdHRsZV9lbmRpYW5cbiAgICAgIGlmIHRydWUgPT0gb2JqLnNlcSA6OiAvLyB1c2Ugc2VxX25leHRcbiAgICAgICAgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMCwgbGl0dGxlX2VuZGlhblxuICAgICAgZWxzZSBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwfG9iai5zZXEsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNitvZmZzZXQsIDB8b2JqLnNlcV9mbGFncywgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLm1zZ2lkICAgICA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXEgICAgICAgPSBkdi5nZXRJbnQxNiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxX2ZsYWdzID0gZHYuZ2V0SW50MTYgQCA2K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfbXVsdGlwYXJ0XG5cbmZ1bmN0aW9uIGZybV9zdHJlYW1pbmcoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4YywgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19zdHJlYW1pbmdcbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gY19zdHJlYW1pbmcgPT09IG9iai50cmFuc3BvcnQgPyBiaXRzIDogZmFsc2VcblxuICAgIGJpbmRfc2VxX25leHQsIHNlcV9wb3M6IDRcbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoudG9rZW4gOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl90b2tlbl9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLnRva2VuLCBsaXR0bGVfZW5kaWFuXG4gICAgICBpZiB0cnVlID09IG9iai5zZXEgOjpcbiAgICAgICAgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMCwgbGl0dGxlX2VuZGlhbiAvLyB1c2Ugc2VxX25leHRcbiAgICAgIGVsc2UgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMHxvYmouc2VxLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDYrb2Zmc2V0LCAwfG9iai5zZXFfZmxhZ3MsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai5tc2dpZCAgICAgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxICAgICAgID0gZHYuZ2V0SW50MTYgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcV9mbGFncyA9IGR2LmdldEludDE2IEAgNitvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX3N0cmVhbWluZ1xuXG5cbmZ1bmN0aW9uIGJpbmRfc2VxX25leHQob2Zmc2V0KSA6OlxuICBjb25zdCBzZXFfb2Zmc2V0ID0gdGhpcy5zZXFfcG9zICsgb2Zmc2V0XG4gIGxldCBzZXEgPSAxXG4gIHJldHVybiBmdW5jdGlvbiBzZXFfbmV4dCh7ZmxhZ3MsIGZpbn0sIGR2KSA6OlxuICAgIGlmICEgZmluIDo6XG4gICAgICBkdi5zZXRJbnQxNiBAIHNlcV9vZmZzZXQsIHNlcSsrLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDIrc2VxX29mZnNldCwgMHxmbGFncywgbGl0dGxlX2VuZGlhblxuICAgIGVsc2UgOjpcbiAgICAgIGR2LnNldEludDE2IEAgc2VxX29mZnNldCwgLXNlcSwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCAyK3NlcV9vZmZzZXQsIDB8ZmxhZ3MsIGxpdHRsZV9lbmRpYW5cbiAgICAgIHNlcSA9IE5hTlxuXG5cblxuZXhwb3J0IGRlZmF1bHQgY29tcG9zZUZyYW1pbmdzKClcbmZ1bmN0aW9uIGNvbXBvc2VGcmFtaW5ncygpIDo6XG4gIGNvbnN0IGZybV9mcm9tID0gZnJtX3JvdXRpbmcoKSwgZnJtX3Jlc3AgPSBmcm1fcmVzcG9uc2UoKVxuICBjb25zdCBmcm1fdHJhbnNwb3J0cyA9IEBbXSBmcm1fZGF0YWdyYW0oKSwgZnJtX2RpcmVjdCgpLCBmcm1fbXVsdGlwYXJ0KCksIGZybV9zdHJlYW1pbmcoKVxuXG4gIGlmIDggIT09IGZybV9mcm9tLnNpemUgfHwgOCAhPT0gZnJtX3Jlc3Auc2l6ZSB8fCA0ICE9IGZybV90cmFuc3BvcnRzLmxlbmd0aCA6OlxuICAgIHRocm93IG5ldyBFcnJvciBAIGBGcmFtaW5nIFNpemUgY2hhbmdlYFxuXG4gIGNvbnN0IGJ5Qml0cyA9IFtdLCBtYXNrPTB4ZlxuXG4gIDo6XG4gICAgY29uc3QgdF9mcm9tID0gZnJtX2Zyb20uZl90ZXN0LCB0X3Jlc3AgPSBmcm1fcmVzcC5mX3Rlc3RcbiAgICBjb25zdCBbdDAsdDEsdDIsdDNdID0gZnJtX3RyYW5zcG9ydHMubWFwIEAgZj0+Zi5mX3Rlc3RcblxuICAgIGNvbnN0IHRlc3RCaXRzID0gYnlCaXRzLnRlc3RCaXRzID0gb2JqID0+XG4gICAgICAwIHwgdF9mcm9tKG9iaikgfCB0X3Jlc3Aob2JqKSB8IHQwKG9iaikgfCB0MShvYmopIHwgdDIob2JqKSB8IHQzKG9iailcblxuICAgIGJ5Qml0cy5jaG9vc2UgPSBmdW5jdGlvbiAob2JqLCBsc3QpIDo6XG4gICAgICBpZiBudWxsID09IGxzdCA6OiBsc3QgPSB0aGlzIHx8IGJ5Qml0c1xuICAgICAgcmV0dXJuIGxzdFt0ZXN0Qml0cyhvYmopXVxuXG5cbiAgZm9yIGNvbnN0IFQgb2YgZnJtX3RyYW5zcG9ydHMgOjpcbiAgICBjb25zdCB7Yml0czpiLCBzaXplLCB0cmFuc3BvcnR9ID0gVFxuXG4gICAgYnlCaXRzW2J8MF0gPSBAe30gVCwgdHJhbnNwb3J0LCBiaXRzOiBifDAsIG1hc2ssIHNpemU6IHNpemUsIG9wOiAnJ1xuICAgIGJ5Qml0c1tifDFdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwxLCBtYXNrLCBzaXplOiA4ICsgc2l6ZSwgb3A6ICdmJ1xuICAgIGJ5Qml0c1tifDJdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwyLCBtYXNrLCBzaXplOiA4ICsgc2l6ZSwgb3A6ICdyJ1xuICAgIGJ5Qml0c1tifDNdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwzLCBtYXNrLCBzaXplOiAxNiArIHNpemUsIG9wOiAnZnInXG5cbiAgICBmb3IgY29uc3QgZm5fa2V5IG9mIFsnZl9wYWNrJywgJ2ZfdW5wYWNrJ10gOjpcbiAgICAgIGNvbnN0IGZuX3RyYW4gPSBUW2ZuX2tleV0sIGZuX2Zyb20gPSBmcm1fZnJvbVtmbl9rZXldLCBmbl9yZXNwID0gZnJtX3Jlc3BbZm5fa2V5XVxuXG4gICAgICBieUJpdHNbYnwwXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fdHJhbihvYmosIGR2LCAwKVxuICAgICAgYnlCaXRzW2J8MV1bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX2Zyb20ob2JqLCBkdiwgMCk7IGZuX3RyYW4ob2JqLCBkdiwgOClcbiAgICAgIGJ5Qml0c1tifDJdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl9yZXNwKG9iaiwgZHYsIDApOyBmbl90cmFuKG9iaiwgZHYsIDgpXG4gICAgICBieUJpdHNbYnwzXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fZnJvbShvYmosIGR2LCAwKTsgZm5fcmVzcChvYmosIGR2LCA4KTsgZm5fdHJhbihvYmosIGR2LCAxNilcblxuICBmb3IgY29uc3QgZnJtIG9mIGJ5Qml0cyA6OlxuICAgIGJpbmRBc3NlbWJsZWQgQCBmcm1cblxuICByZXR1cm4gYnlCaXRzXG5cblxuZnVuY3Rpb24gYmluZEFzc2VtYmxlZChmcm0pIDo6XG4gIGNvbnN0IHtULCBzaXplLCBmX3BhY2ssIGZfdW5wYWNrfSA9IGZybVxuICBpZiBULmJpbmRfc2VxX25leHQgOjpcbiAgICBmcm0uc2VxX25leHQgPSBULmJpbmRfc2VxX25leHQgQCBmcm0uc2l6ZSAtIFQuc2l6ZVxuXG4gIGRlbGV0ZSBmcm0uVFxuICBmcm0ucGFjayA9IHBhY2sgOyBmcm0udW5wYWNrID0gdW5wYWNrXG4gIGNvbnN0IHNlcV9uZXh0ID0gZnJtLnNlcV9uZXh0XG5cbiAgZnVuY3Rpb24gcGFjayhwa3RfdHlwZSwgcGt0X29iaikgOjpcbiAgICBpZiAhIEAgMCA8PSBwa3RfdHlwZSAmJiBwa3RfdHlwZSA8PSAyNTUgOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgRXhwZWN0ZWQgcGt0X3R5cGUgdG8gYmUgWzAuLjI1NV1gXG5cbiAgICBwa3Rfb2JqLnR5cGUgPSBwa3RfdHlwZVxuICAgIGlmIHNlcV9uZXh0ICYmIG51bGwgPT0gcGt0X29iai5zZXEgOjpcbiAgICAgIHBrdF9vYmouc2VxID0gdHJ1ZVxuXG4gICAgY29uc3QgZHYgPSBuZXcgRGF0YVZpZXcgQCBuZXcgQXJyYXlCdWZmZXIoc2l6ZSlcbiAgICBmX3BhY2socGt0X29iaiwgZHYsIDApXG4gICAgcGt0X29iai5oZWFkZXIgPSBkdi5idWZmZXJcblxuICAgIGlmIHRydWUgPT09IHBrdF9vYmouc2VxIDo6XG4gICAgICBfYmluZF9pdGVyYWJsZSBAIHBrdF9vYmosIGR2LmJ1ZmZlci5zbGljZSgwLHNpemUpXG5cbiAgZnVuY3Rpb24gdW5wYWNrKHBrdCkgOjpcbiAgICBjb25zdCBidWYgPSBwa3QuaGVhZGVyX2J1ZmZlcigpXG4gICAgY29uc3QgZHYgPSBuZXcgRGF0YVZpZXcgQCBuZXcgVWludDhBcnJheShidWYpLmJ1ZmZlclxuXG4gICAgY29uc3QgaW5mbyA9IHt9XG4gICAgZl91bnBhY2soaW5mbywgZHYsIDApXG4gICAgcmV0dXJuIHBrdC5pbmZvID0gaW5mb1xuXG4gIGZ1bmN0aW9uIF9iaW5kX2l0ZXJhYmxlKHBrdF9vYmosIGJ1Zl9jbG9uZSkgOjpcbiAgICBjb25zdCB7dHlwZX0gPSBwa3Rfb2JqXG4gICAgY29uc3Qge2lkX3JvdXRlciwgaWRfdGFyZ2V0LCB0dGwsIHRva2VufSA9IHBrdF9vYmpcbiAgICBwa3Rfb2JqLm5leHQgPSBuZXh0XG5cbiAgICBmdW5jdGlvbiBuZXh0KG9wdGlvbnMpIDo6XG4gICAgICBpZiBudWxsID09IG9wdGlvbnMgOjogb3B0aW9ucyA9IHt9XG4gICAgICBjb25zdCBoZWFkZXIgPSBidWZfY2xvbmUuc2xpY2UoKVxuICAgICAgc2VxX25leHQgQCBvcHRpb25zLCBuZXcgRGF0YVZpZXcgQCBoZWFkZXJcbiAgICAgIHJldHVybiBAe30gZG9uZTogISEgb3B0aW9ucy5maW4sIHZhbHVlOiBAe30gLy8gcGt0X29ialxuICAgICAgICBpZF9yb3V0ZXIsIGlkX3RhcmdldCwgdHlwZSwgdHRsLCB0b2tlbiwgaGVhZGVyXG5cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBhY2tldFBhcnNlciwgc2hhcmVkKSA6OlxuICBjb25zdCB7Y29uY2F0QnVmZmVyc30gPSBwYWNrZXRQYXJzZXJcbiAgcmV0dXJuIEB7fSBjcmVhdGVNdWx0aXBhcnRcblxuXG4gIGZ1bmN0aW9uIGNyZWF0ZU11bHRpcGFydChwa3QsIHNpbmssIGRlbGV0ZVN0YXRlKSA6OlxuICAgIGxldCBwYXJ0cyA9IFtdLCBmaW4gPSBmYWxzZVxuICAgIHJldHVybiBAe30gZmVlZCwgaW5mbzogcGt0LmluZm9cblxuICAgIGZ1bmN0aW9uIGZlZWQocGt0KSA6OlxuICAgICAgbGV0IHNlcSA9IHBrdC5pbmZvLnNlcVxuICAgICAgaWYgc2VxIDwgMCA6OiBmaW4gPSB0cnVlOyBzZXEgPSAtc2VxXG4gICAgICBwYXJ0c1tzZXEtMV0gPSBwa3QuYm9keV9idWZmZXIoKVxuXG4gICAgICBpZiAhIGZpbiA6OiByZXR1cm5cbiAgICAgIGlmIHBhcnRzLmluY2x1ZGVzIEAgdW5kZWZpbmVkIDo6IHJldHVyblxuXG4gICAgICBkZWxldGVTdGF0ZSgpXG5cbiAgICAgIGNvbnN0IHJlcyA9IGNvbmNhdEJ1ZmZlcnMocGFydHMpXG4gICAgICBwYXJ0cyA9IG51bGxcbiAgICAgIHJldHVybiByZXNcblxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIHJldHVybiBAe30gY3JlYXRlU3RyZWFtXG5cblxuICBmdW5jdGlvbiBjcmVhdGVTdHJlYW0ocGt0LCBzaW5rLCBkZWxldGVTdGF0ZSkgOjpcbiAgICBsZXQgbmV4dD0wLCBmaW4gPSBmYWxzZSwgcmVjdkRhdGEsIHJzdHJlYW1cbiAgICBjb25zdCBzdGF0ZSA9IEB7fSBmZWVkOiBmZWVkX2luaXQsIGluZm86IHBrdC5pbmZvXG4gICAgcmV0dXJuIHN0YXRlXG5cbiAgICBmdW5jdGlvbiBmZWVkX2luaXQocGt0LCBhc19jb250ZW50KSA6OlxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfaWdub3JlXG5cbiAgICAgIGNvbnN0IGluZm8gPSBwa3QuaW5mb1xuICAgICAgY29uc3QgbXNnID0gc2luay5qc29uX3VucGFjayBAIHBrdC5ib2R5X3V0ZjgoKVxuICAgICAgcnN0cmVhbSA9IHNpbmsucmVjdlN0cmVhbShtc2csIGluZm8pXG4gICAgICBpZiBudWxsID09IHJzdHJlYW0gOjogcmV0dXJuXG4gICAgICBjaGVja19mbnMgQCByc3RyZWFtLCAnb25fZXJyb3InLCAnb25fZGF0YScsICdvbl9lbmQnIFxuICAgICAgcmVjdkRhdGEgPSBzaW5rLnJlY3ZTdHJlYW1EYXRhLmJpbmQoc2luaywgcnN0cmVhbSwgaW5mbylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGZlZWRfc2VxKHBrdClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9lcnJvciBAIGVyciwgcGt0XG5cbiAgICAgIHN0YXRlLmZlZWQgPSBmZWVkX2JvZHlcbiAgICAgIGlmIHJzdHJlYW0ub25faW5pdCA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9pbml0KG1zZywgcGt0KVxuXG4gICAgZnVuY3Rpb24gZmVlZF9ib2R5KHBrdCwgYXNfY29udGVudCkgOjpcbiAgICAgIHJlY3ZEYXRhKClcbiAgICAgIGxldCBkYXRhXG4gICAgICB0cnkgOjpcbiAgICAgICAgZmVlZF9zZXEocGt0KVxuICAgICAgICBkYXRhID0gYXNfY29udGVudChwa3QsIHNpbmspXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZXJyb3IgQCBlcnIsIHBrdFxuXG4gICAgICBpZiBmaW4gOjpcbiAgICAgICAgY29uc3QgcmVzID0gcnN0cmVhbS5vbl9kYXRhIEAgZGF0YSwgcGt0XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2VuZCBAIHJlcywgcGt0XG4gICAgICBlbHNlIDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2RhdGEgQCBkYXRhLCBwa3RcblxuICAgIGZ1bmN0aW9uIGZlZWRfaWdub3JlKHBrdCkgOjpcbiAgICAgIHRyeSA6OiBmZWVkX3NlcShwa3QpXG4gICAgICBjYXRjaCBlcnIgOjpcblxuICAgIGZ1bmN0aW9uIGZlZWRfc2VxKHBrdCkgOjpcbiAgICAgIGxldCBzZXEgPSBwa3QuaW5mby5zZXFcbiAgICAgIGlmIHNlcSA+PSAwIDo6XG4gICAgICAgIGlmIG5leHQrKyA9PT0gc2VxIDo6XG4gICAgICAgICAgcmV0dXJuIC8vIGluIG9yZGVyXG4gICAgICBlbHNlIDo6XG4gICAgICAgIGZpbiA9IHRydWVcbiAgICAgICAgZGVsZXRlU3RhdGUoKVxuICAgICAgICBpZiBuZXh0ID09PSAtc2VxIDo6XG4gICAgICAgICAgbmV4dCA9ICdkb25lJ1xuICAgICAgICAgIHJldHVybiAvLyBpbi1vcmRlciwgbGFzdCBwYWNrZXRcblxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfaWdub3JlXG4gICAgICBuZXh0ID0gJ2ludmFsaWQnXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgUGFja2V0IG91dCBvZiBzZXF1ZW5jZWBcblxuXG5mdW5jdGlvbiBjaGVja19mbnMob2JqLCAuLi5rZXlzKSA6OlxuICBmb3IgY29uc3Qga2V5IG9mIGtleXMgOjpcbiAgICBpZiAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygb2JqW2tleV0gOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgRXhwZWN0ZWQgXCIke2tleX1cIiB0byBiZSBhIGZ1bmN0aW9uYFxuXG4iLCJpbXBvcnQgZnJhbWluZ3MgZnJvbSAnLi9mcmFtaW5nLmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtwYWNrUGFja2V0T2JqfSA9IHBhY2tldFBhcnNlclxuICBjb25zdCB7cmFuZG9tX2lkLCBqc29uX3BhY2t9ID0gc2hhcmVkXG4gIGNvbnN0IHtjaG9vc2U6IGNob29zZUZyYW1pbmd9ID0gZnJhbWluZ3NcblxuICBjb25zdCBmcmFnbWVudF9zaXplID0gTnVtYmVyIEAgc2hhcmVkLmZyYWdtZW50X3NpemUgfHwgODAwMFxuICBpZiAxMDI0ID4gZnJhZ21lbnRfc2l6ZSB8fCA2NTAwMCA8IGZyYWdtZW50X3NpemUgOjpcbiAgICB0aHJvdyBuZXcgRXJyb3IgQCBgSW52YWxpZCBmcmFnbWVudCBzaXplOiAke2ZyYWdtZW50X3NpemV9YFxuXG4gIHJldHVybiBAe30gYmluZFRyYW5zcG9ydHMsIHBhY2tldEZyYWdtZW50cywgY2hvb3NlRnJhbWluZ1xuXG5cbiAgZnVuY3Rpb24gYmluZFRyYW5zcG9ydHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpIDo6XG4gICAgY29uc3QgcGFja0JvZHkgPSB0cmFuc3BvcnRzLnBhY2tCb2R5XG4gICAgY29uc3Qgb3V0Ym91bmQgPSBiaW5kVHJhbnNwb3J0SW1wbHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpXG5cbiAgICBpZiB0cmFuc3BvcnRzLnN0cmVhbWluZyA6OlxuICAgICAgcmV0dXJuIEB7fSBzZW5kLCBzdHJlYW06IGJpbmRTdHJlYW0oKVxuXG4gICAgcmV0dXJuIEB7fSBzZW5kXG5cblxuXG4gICAgZnVuY3Rpb24gc2VuZChjaGFuLCBvYmosIGJvZHkpIDo6XG4gICAgICBib2R5ID0gcGFja0JvZHkoYm9keSwgb2JqLCBjaGFuKVxuICAgICAgaWYgZnJhZ21lbnRfc2l6ZSA8IGJvZHkuYnl0ZUxlbmd0aCA6OlxuICAgICAgICBpZiAhIG9iai50b2tlbiA6OiBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgICAgICBvYmoudHJhbnNwb3J0ID0gJ211bHRpcGFydCdcbiAgICAgICAgY29uc3QgbXNlbmQgPSBtc2VuZF9ieXRlcyhjaGFuLCBvYmopXG4gICAgICAgIHJldHVybiBtc2VuZCBAIHRydWUsIGJvZHlcblxuICAgICAgb2JqLnRyYW5zcG9ydCA9ICdzaW5nbGUnXG4gICAgICBvYmouYm9keSA9IGJvZHlcbiAgICAgIGNvbnN0IHBhY2tfaGRyID0gb3V0Ym91bmQuY2hvb3NlKG9iailcbiAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBwYWNrX2hkcihvYmopXG4gICAgICByZXR1cm4gY2hhbi5zZW5kIEAgcGt0XG5cblxuICAgIGZ1bmN0aW9uIG1zZW5kX2J5dGVzKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgY29uc3QgcGFja19oZHIgPSBvdXRib3VuZC5jaG9vc2Uob2JqKVxuICAgICAgbGV0IHtuZXh0fSA9IHBhY2tfaGRyKG9iailcbiAgICAgIGlmIG51bGwgIT09IG1zZyA6OlxuICAgICAgICBvYmouYm9keSA9IG1zZ1xuICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgIGNoYW4uc2VuZCBAIHBrdFxuXG4gICAgICByZXR1cm4gYXN5bmMgZnVuY3Rpb24gKGZpbiwgYm9keSkgOjpcbiAgICAgICAgaWYgbnVsbCA9PT0gbmV4dCA6OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBAICdXcml0ZSBhZnRlciBlbmQnXG4gICAgICAgIGxldCByZXNcbiAgICAgICAgZm9yIGNvbnN0IG9iaiBvZiBwYWNrZXRGcmFnbWVudHMgQCBib2R5LCBuZXh0LCBmaW4gOjpcbiAgICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgICAgcmVzID0gYXdhaXQgY2hhbi5zZW5kIEAgcGt0XG4gICAgICAgIGlmIGZpbiA6OiBuZXh0ID0gbnVsbFxuICAgICAgICByZXR1cm4gcmVzXG5cblxuICAgIGZ1bmN0aW9uIG1zZW5kX29iamVjdHMoY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICBjb25zdCBwYWNrX2hkciA9IG91dGJvdW5kLmNob29zZShvYmopXG4gICAgICBsZXQge25leHR9ID0gcGFja19oZHIob2JqKVxuICAgICAgaWYgbnVsbCAhPT0gbXNnIDo6XG4gICAgICAgIG9iai5ib2R5ID0gbXNnXG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgY2hhbi5zZW5kIEAgcGt0XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbiAoZmluLCBib2R5KSA6OlxuICAgICAgICBpZiBudWxsID09PSBuZXh0IDo6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgJ1dyaXRlIGFmdGVyIGVuZCdcbiAgICAgICAgY29uc3Qgb2JqID0gbmV4dCh7ZmlufSlcbiAgICAgICAgb2JqLmJvZHkgPSBib2R5XG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgaWYgZmluIDo6IG5leHQgPSBudWxsXG4gICAgICAgIHJldHVybiBjaGFuLnNlbmQgQCBwa3RcblxuXG4gICAgZnVuY3Rpb24gYmluZFN0cmVhbSgpIDo6XG4gICAgICBjb25zdCB7bW9kZX0gPSB0cmFuc3BvcnRzLnN0cmVhbWluZ1xuICAgICAgY29uc3QgbXNlbmRfaW1wbCA9IHtvYmplY3Q6IG1zZW5kX29iamVjdHMsIGJ5dGVzOiBtc2VuZF9ieXRlc31bbW9kZV1cbiAgICAgIGlmIG1zZW5kX2ltcGwgOjogcmV0dXJuIHN0cmVhbVxuXG4gICAgICBmdW5jdGlvbiBzdHJlYW0oY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICAgIGlmICEgb2JqLnRva2VuIDo6IG9iai50b2tlbiA9IHJhbmRvbV9pZCgpXG4gICAgICAgIG9iai50cmFuc3BvcnQgPSAnc3RyZWFtaW5nJ1xuICAgICAgICBjb25zdCBtc2VuZCA9IG1zZW5kX2ltcGwgQCBjaGFuLCBvYmosIGpzb25fcGFjayhtc2cpXG4gICAgICAgIHdyaXRlLndyaXRlID0gd3JpdGU7IHdyaXRlLmVuZCA9IHdyaXRlLmJpbmQodHJ1ZSlcbiAgICAgICAgcmV0dXJuIHdyaXRlXG5cbiAgICAgICAgZnVuY3Rpb24gd3JpdGUoY2h1bmspIDo6XG4gICAgICAgICAgLy8gbXNlbmQgQCBmaW4sIGJvZHlcbiAgICAgICAgICByZXR1cm4gY2h1bmsgIT0gbnVsbFxuICAgICAgICAgICAgPyBtc2VuZCBAIHRydWU9PT10aGlzLCBwYWNrQm9keShjaHVuaywgb2JqLCBjaGFuKVxuICAgICAgICAgICAgOiBtc2VuZCBAIHRydWVcblxuXG4gIGZ1bmN0aW9uICogcGFja2V0RnJhZ21lbnRzKGJ1ZiwgbmV4dF9oZHIsIGZpbikgOjpcbiAgICBpZiBudWxsID09IGJ1ZiA6OlxuICAgICAgY29uc3Qgb2JqID0gbmV4dF9oZHIoe2Zpbn0pXG4gICAgICB5aWVsZCBvYmpcbiAgICAgIHJldHVyblxuXG4gICAgbGV0IGkgPSAwLCBsYXN0SW5uZXIgPSBidWYuYnl0ZUxlbmd0aCAtIGZyYWdtZW50X3NpemU7XG4gICAgd2hpbGUgaSA8IGxhc3RJbm5lciA6OlxuICAgICAgY29uc3QgaTAgPSBpXG4gICAgICBpICs9IGZyYWdtZW50X3NpemVcblxuICAgICAgY29uc3Qgb2JqID0gbmV4dF9oZHIoKVxuICAgICAgb2JqLmJvZHkgPSBidWYuc2xpY2UoaTAsIGkpXG4gICAgICB5aWVsZCBvYmpcblxuICAgIDo6XG4gICAgICBjb25zdCBvYmogPSBuZXh0X2hkcih7ZmlufSlcbiAgICAgIG9iai5ib2R5ID0gYnVmLnNsaWNlKGkpXG4gICAgICB5aWVsZCBvYmpcblxuXG5cblxuLy8gbW9kdWxlLWxldmVsIGhlbHBlciBmdW5jdGlvbnNcblxuZnVuY3Rpb24gYmluZFRyYW5zcG9ydEltcGxzKGluYm91bmQsIGhpZ2hiaXRzLCB0cmFuc3BvcnRzKSA6OlxuICBjb25zdCBvdXRib3VuZCA9IFtdXG4gIG91dGJvdW5kLmNob29zZSA9IGZyYW1pbmdzLmNob29zZVxuXG4gIGZvciBjb25zdCBmcmFtZSBvZiBmcmFtaW5ncyA6OlxuICAgIGNvbnN0IGltcGwgPSBmcmFtZSA/IHRyYW5zcG9ydHNbZnJhbWUudHJhbnNwb3J0XSA6IG51bGxcbiAgICBpZiAhIGltcGwgOjogY29udGludWVcblxuICAgIGNvbnN0IHtiaXRzLCBwYWNrLCB1bnBhY2t9ID0gZnJhbWVcbiAgICBjb25zdCBwa3RfdHlwZSA9IGhpZ2hiaXRzIHwgYml0c1xuICAgIGNvbnN0IHt0X3JlY3Z9ID0gaW1wbFxuXG4gICAgZnVuY3Rpb24gcGFja19oZHIob2JqKSA6OlxuICAgICAgcGFjayhwa3RfdHlwZSwgb2JqKVxuICAgICAgcmV0dXJuIG9ialxuXG4gICAgZnVuY3Rpb24gcmVjdl9tc2cocGt0LCBzaW5rKSA6OlxuICAgICAgdW5wYWNrKHBrdClcbiAgICAgIHJldHVybiB0X3JlY3YocGt0LCBzaW5rKVxuXG4gICAgcGFja19oZHIucGt0X3R5cGUgPSByZWN2X21zZy5wa3RfdHlwZSA9IHBrdF90eXBlXG4gICAgb3V0Ym91bmRbYml0c10gPSBwYWNrX2hkclxuICAgIGluYm91bmRbcGt0X3R5cGVdID0gcmVjdl9tc2dcblxuICAgIGlmICdwcm9kdWN0aW9uJyAhPT0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgOjpcbiAgICAgIGNvbnN0IG9wID0gcGFja19oZHIub3AgPSByZWN2X21zZy5vcCA9IGZyYW1lLm9wXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgQCBwYWNrX2hkciwgJ25hbWUnLCBAe30gdmFsdWU6IGBwYWNrX2hkciDCqyR7b3B9wrtgXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgQCByZWN2X21zZywgJ25hbWUnLCBAe30gdmFsdWU6IGByZWN2X21zZyDCqyR7b3B9wrtgXG5cbiAgcmV0dXJuIG91dGJvdW5kXG5cbiIsImV4cG9ydCAqIGZyb20gJy4vZnJhbWluZy5qc3knXG5leHBvcnQgKiBmcm9tICcuL211bHRpcGFydC5qc3knXG5leHBvcnQgKiBmcm9tICcuL3N0cmVhbWluZy5qc3knXG5leHBvcnQgKiBmcm9tICcuL3RyYW5zcG9ydC5qc3knXG5cbmltcG9ydCBtdWx0aXBhcnQgZnJvbSAnLi9tdWx0aXBhcnQuanN5J1xuaW1wb3J0IHN0cmVhbWluZyBmcm9tICcuL3N0cmVhbWluZy5qc3knXG5pbXBvcnQgdHJhbnNwb3J0IGZyb20gJy4vdHJhbnNwb3J0LmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaW5pdF9zaGFyZWQocGFja2V0UGFyc2VyLCBvcHRpb25zKSA6OlxuICBjb25zdCBzaGFyZWQgPSBPYmplY3QuYXNzaWduIEAge3BhY2tldFBhcnNlciwgc3RhdGVGb3J9LCBvcHRpb25zXG5cbiAgT2JqZWN0LmFzc2lnbiBAIHNoYXJlZCxcbiAgICBtdWx0aXBhcnQgQCBwYWNrZXRQYXJzZXIsIHNoYXJlZFxuICAgIHN0cmVhbWluZyBAIHBhY2tldFBhcnNlciwgc2hhcmVkXG4gICAgdHJhbnNwb3J0IEAgcGFja2V0UGFyc2VyLCBzaGFyZWRcblxuICByZXR1cm4gc2hhcmVkXG5cbmZ1bmN0aW9uIHN0YXRlRm9yKHBrdCwgc2luaywgY3JlYXRlU3RhdGUpIDo6XG4gIGNvbnN0IHtieV9tc2dpZH0gPSBzaW5rLCB7bXNnaWR9ID0gcGt0LmluZm9cbiAgbGV0IHN0YXRlID0gYnlfbXNnaWQuZ2V0KG1zZ2lkKVxuICBpZiB1bmRlZmluZWQgPT09IHN0YXRlIDo6XG4gICAgaWYgISBtc2dpZCA6OiB0aHJvdyBuZXcgRXJyb3IgQCBgSW52YWxpZCBtc2dpZDogJHttc2dpZH1gXG5cbiAgICBzdGF0ZSA9IGNyZWF0ZVN0YXRlIEAgcGt0LCBzaW5rLCAoKSA9PiBieV9tc2dpZC5kZWxldGUobXNnaWQpXG4gICAgYnlfbXNnaWQuc2V0IEAgbXNnaWQsIHN0YXRlXG4gIHJldHVybiBzdGF0ZVxuXG4iLCJjb25zdCBub29wX2VuY29kaW5ncyA9IEB7fVxuICBlbmNvZGUoYnVmLCBvYmosIGNoYW4pIDo6IHJldHVybiBidWZcbiAgZGVjb2RlKGJ1Ziwgc2luaykgOjogcmV0dXJuIGJ1ZlxuXG5leHBvcnQgZGVmYXVsdCBqc29uX3Byb3RvY29sXG5leHBvcnQgZnVuY3Rpb24ganNvbl9wcm90b2NvbChzaGFyZWQsIHtlbmNvZGUsIGRlY29kZX09bm9vcF9lbmNvZGluZ3MpIDo6XG4gIGNvbnN0IHtzdGF0ZUZvciwgY3JlYXRlTXVsdGlwYXJ0LCBjcmVhdGVTdHJlYW0sIGpzb25fcGFja30gPSBzaGFyZWRcbiAgY29uc3Qge3BhY2tfdXRmOCwgdW5wYWNrX3V0Zjh9ID0gc2hhcmVkLnBhY2tldFBhcnNlclxuXG4gIHJldHVybiBAe31cbiAgICBwYWNrQm9keVxuXG4gICAgZ2V0IGRhdGFncmFtKCkgOjogcmV0dXJuIHRoaXMuZGlyZWN0XG4gICAgZGlyZWN0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IGpzb25fYnVmID0gZGVjb2RlIEAgcGt0LmJvZHlfYnVmZmVyKCksIHNpbmtcbiAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGpzb25fYnVmLCBzaW5rXG4gICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIHBrdC5pbmZvXG5cbiAgICBtdWx0aXBhcnQ6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlTXVsdGlwYXJ0XG4gICAgICAgIGNvbnN0IGJvZHlfYnVmID0gc3RhdGUuZmVlZChwa3QpXG4gICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gYm9keV9idWYgOjpcbiAgICAgICAgICBjb25zdCBqc29uX2J1ZiA9IGRlY29kZSBAIGJvZHlfYnVmLCBzaW5rXG4gICAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGpzb25fYnVmLCBzaW5rXG4gICAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgc3RhdGUuaW5mb1xuXG4gICAgc3RyZWFtaW5nOiBAe31cbiAgICAgIG1vZGU6ICdvYmplY3QnXG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0YXRlRm9yIEAgcGt0LCBzaW5rLCBjcmVhdGVTdHJlYW1cbiAgICAgICAgcmV0dXJuIHN0YXRlLmZlZWQocGt0LCBhc19qc29uX2NvbnRlbnQpXG5cbiAgZnVuY3Rpb24gcGFja0JvZHkoYm9keSwgb2JqLCBjaGFuKSA6OlxuICAgIGNvbnN0IGJvZHlfYnVmID0gcGFja191dGY4IEAganNvbl9wYWNrIEAgYm9keVxuICAgIHJldHVybiBlbmNvZGUoYm9keV9idWYsIG9iaiwgY2hhbilcblxuICBmdW5jdGlvbiBhc19qc29uX2NvbnRlbnQocGt0LCBzaW5rKSA6OlxuICAgIHJldHVybiB1bnBhY2tCb2R5QnVmIEAgcGt0LmJvZHlfYnVmZmVyKCksIHNpbmssIG51bGxcblxuICBmdW5jdGlvbiB1bnBhY2tCb2R5QnVmKGJvZHlfYnVmLCBzaW5rLCBpZkFic2VudCkgOjpcbiAgICBjb25zdCBqc29uX2J1ZiA9IGRlY29kZShib2R5X2J1Ziwgc2luaylcbiAgICByZXR1cm4gc2luay5qc29uX3VucGFjayBAIGpzb25fYnVmID8gdW5wYWNrX3V0ZjgoanNvbl9idWYpIDogaWZBYnNlbnRcblxuIiwiY29uc3Qgbm9vcF9lbmNvZGluZ3MgPSBAe31cbiAgZW5jb2RlKGJ1Ziwgb2JqLCBjaGFuKSA6OiByZXR1cm4gYnVmXG4gIGRlY29kZShidWYsIHNpbmspIDo6IHJldHVybiBidWZcblxuZXhwb3J0IGRlZmF1bHQgYmluYXJ5X3Byb3RvY29sXG5leHBvcnQgZnVuY3Rpb24gYmluYXJ5X3Byb3RvY29sKHNoYXJlZCwge2VuY29kZSwgZGVjb2RlfT1ub29wX2VuY29kaW5ncykgOjpcbiAgY29uc3Qge3N0YXRlRm9yLCBjcmVhdGVNdWx0aXBhcnQsIGNyZWF0ZVN0cmVhbX0gPSBzaGFyZWRcbiAgY29uc3Qge2FzQnVmZmVyfSA9IHNoYXJlZC5wYWNrZXRQYXJzZXJcblxuICByZXR1cm4gQHt9XG4gICAgcGFja0JvZHlcblxuICAgIGdldCBkYXRhZ3JhbSgpIDo6IHJldHVybiB0aGlzLmRpcmVjdFxuICAgIGRpcmVjdDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHBrdC5ib2R5X2J1ZmZlcigpXG4gICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1Ziwgc2lua1xuICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBwa3QuaW5mb1xuXG4gICAgbXVsdGlwYXJ0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RhdGVGb3IgQCBwa3QsIHNpbmssIGNyZWF0ZU11bHRpcGFydFxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHN0YXRlLmZlZWQocGt0KVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IGJvZHlfYnVmIDo6XG4gICAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGJvZHlfYnVmLCBzaW5rXG4gICAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgc3RhdGUuaW5mb1xuXG4gICAgc3RyZWFtaW5nOiBAe31cbiAgICAgIG1vZGU6ICdieXRlcydcbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RhdGVGb3IgQCBwa3QsIHNpbmssIGNyZWF0ZVN0cmVhbVxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHN0YXRlLmZlZWQocGt0LCBwa3RfYnVmZmVyKVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IGJvZHlfYnVmIDo6XG4gICAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGJvZHlfYnVmLCBzaW5rXG4gICAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgc3RhdGUuaW5mb1xuXG4gIGZ1bmN0aW9uIHBhY2tCb2R5KGJvZHksIG9iaiwgY2hhbikgOjpcbiAgICBjb25zdCBib2R5X2J1ZiA9IGFzQnVmZmVyIEAgYm9keVxuICAgIHJldHVybiBlbmNvZGUoYm9keV9idWYsIG9iaiwgY2hhbilcbiAgZnVuY3Rpb24gdW5wYWNrQm9keUJ1Zihib2R5X2J1Ziwgc2luaykgOjpcbiAgICByZXR1cm4gZGVjb2RlKGJvZHlfYnVmLCBzaW5rKVxuXG5mdW5jdGlvbiBwa3RfYnVmZmVyKHBrdCkgOjogcmV0dXJuIHBrdC5ib2R5X2J1ZmZlcigpXG5cbiIsImV4cG9ydCBkZWZhdWx0IGNvbnRyb2xfcHJvdG9jb2xcbmV4cG9ydCBmdW5jdGlvbiBjb250cm9sX3Byb3RvY29sKGluYm91bmQsIGhpZ2gsIHNoYXJlZCkgOjpcbiAgY29uc3Qge2Nob29zZUZyYW1pbmcsIHJhbmRvbV9pZH0gPSBzaGFyZWRcbiAgY29uc3Qge3BhY2tQYWNrZXRPYmp9ID0gc2hhcmVkLnBhY2tldFBhcnNlclxuXG4gIGNvbnN0IHBpbmdfZnJhbWUgPSBjaG9vc2VGcmFtaW5nIEA6IGZyb21faWQ6IHRydWUsIHRva2VuOiB0cnVlLCB0cmFuc3BvcnQ6ICdkaXJlY3QnXG4gIGNvbnN0IHBvbmdfZnJhbWUgPSBjaG9vc2VGcmFtaW5nIEA6IGZyb21faWQ6IHRydWUsIG1zZ2lkOiB0cnVlLCB0cmFuc3BvcnQ6ICdkYXRhZ3JhbSdcblxuICBjb25zdCBwb25nX3R5cGUgPSBoaWdofDB4ZVxuICBpbmJvdW5kW3BvbmdfdHlwZV0gPSByZWN2X3BvbmdcbiAgY29uc3QgcGluZ190eXBlID0gaGlnaHwweGZcbiAgaW5ib3VuZFtoaWdofDB4Zl0gPSByZWN2X3BpbmdcblxuICByZXR1cm4gQHt9IHNlbmQ6cGluZywgcGluZ1xuXG4gIGZ1bmN0aW9uIHBpbmcoY2hhbiwgb2JqKSA6OlxuICAgIGlmICEgb2JqLnRva2VuIDo6XG4gICAgICBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgIG9iai5ib2R5ID0gSlNPTi5zdHJpbmdpZnkgQDpcbiAgICAgIG9wOiAncGluZycsIHRzMDogbmV3IERhdGUoKVxuICAgIHBpbmdfZnJhbWUucGFjayhwaW5nX3R5cGUsIG9iailcbiAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgcmV0dXJuIGNoYW4uc2VuZCBAIHBrdFxuXG4gIGZ1bmN0aW9uIHJlY3ZfcGluZyhwa3QsIHNpbmssIHJvdXRlcikgOjpcbiAgICBwaW5nX2ZyYW1lLnVucGFjayhwa3QpXG4gICAgcGt0LmJvZHkgPSBwa3QuYm9keV9qc29uKClcbiAgICBfc2VuZF9wb25nIEAgcGt0LmJvZHksIHBrdCwgcm91dGVyXG4gICAgcmV0dXJuIHNpbmsucmVjdkN0cmwocGt0LmJvZHksIHBrdC5pbmZvKVxuXG4gIGZ1bmN0aW9uIF9zZW5kX3Bvbmcoe3RzMH0sIHBrdF9waW5nLCByb3V0ZXIpIDo6XG4gICAgY29uc3Qge21zZ2lkLCBpZF90YXJnZXQsIGlkX3JvdXRlciwgZnJvbV9pZDpyX2lkfSA9IHBrdF9waW5nLmluZm9cbiAgICBjb25zdCBvYmogPSBAe30gbXNnaWRcbiAgICAgIGZyb21faWQ6IEB7fSBpZF90YXJnZXQsIGlkX3JvdXRlclxuICAgICAgaWRfcm91dGVyOiByX2lkLmlkX3JvdXRlciwgaWRfdGFyZ2V0OiByX2lkLmlkX3RhcmdldFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkgQDpcbiAgICAgICAgb3A6ICdwb25nJywgdHMwLCB0czE6IG5ldyBEYXRlKClcblxuICAgIHBvbmdfZnJhbWUucGFjayhwb25nX3R5cGUsIG9iailcbiAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgcmV0dXJuIHJvdXRlci5kaXNwYXRjaCBAIFtwa3RdXG5cbiAgZnVuY3Rpb24gcmVjdl9wb25nKHBrdCwgc2luaykgOjpcbiAgICBwb25nX2ZyYW1lLnVucGFjayhwa3QpXG4gICAgcGt0LmJvZHkgPSBwa3QuYm9keV9qc29uKClcbiAgICByZXR1cm4gc2luay5yZWN2Q3RybChwa3QuYm9keSwgcGt0LmluZm8pXG5cbiIsImltcG9ydCBpbml0X3NoYXJlZCBmcm9tICcuL3NoYXJlZC9pbmRleC5qc3knXG5pbXBvcnQganNvbl9wcm90b2NvbCBmcm9tICcuL3Byb3RvY29scy9qc29uLmpzeSdcbmltcG9ydCBiaW5hcnlfcHJvdG9jb2wgZnJvbSAnLi9wcm90b2NvbHMvYmluYXJ5LmpzeSdcbmltcG9ydCBjb250cm9sX3Byb3RvY29sIGZyb20gJy4vcHJvdG9jb2xzL2NvbnRyb2wuanN5J1xuXG5cbmNvbnN0IGRlZmF1bHRfcGx1Z2luX29wdGlvbnMgPSBAOlxuICBqc29uX3BhY2s6IEpTT04uc3RyaW5naWZ5XG4gIGN1c3RvbShwcm90b2NvbHMpIDo6IHJldHVybiBwcm90b2NvbHNcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwbHVnaW5fb3B0aW9ucykgOjpcbiAgcGx1Z2luX29wdGlvbnMgPSBPYmplY3QuYXNzaWduIEAge30sIGRlZmF1bHRfcGx1Z2luX29wdGlvbnMsIHBsdWdpbl9vcHRpb25zXG4gIGNvbnN0IHsgcGx1Z2luX25hbWUsIHJhbmRvbV9pZCwganNvbl9wYWNrIH0gPSBwbHVnaW5fb3B0aW9uc1xuXG4gIHJldHVybiBAOiBzdWJjbGFzcywgb3JkZXI6IC0xIC8vIGRlcGVuZGVudCBvbiByb3V0ZXIgcGx1Z2luJ3MgKC0yKSBwcm92aWRpbmcgcGFja2V0UGFyc2VyXG4gIFxuICBmdW5jdGlvbiBzdWJjbGFzcyhGYWJyaWNIdWJfUEksIGJhc2VzKSA6OlxuICAgIGNvbnN0IHtwYWNrZXRQYXJzZXJ9ID0gRmFicmljSHViX1BJLnByb3RvdHlwZVxuICAgIGlmIG51bGw9PXBhY2tldFBhcnNlciB8fCAhIHBhY2tldFBhcnNlci5pc1BhY2tldFBhcnNlcigpIDo6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYEludmFsaWQgcGFja2V0UGFyc2VyIGZvciBwbHVnaW5gXG4gICAgXG4gICAgY29uc3QgcHJvdG9jb2xzID0gcGx1Z2luX29wdGlvbnMuY3VzdG9tIEBcbiAgICAgIGluaXRfcHJvdG9jb2xzIEAgcGFja2V0UGFyc2VyLCBAe30gcmFuZG9tX2lkLCBqc29uX3BhY2tcblxuICAgIEZhYnJpY0h1Yl9QSS5wcm90b3R5cGUucHJvdG9jb2xzID0gcHJvdG9jb2xzXG5cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRfcHJvdG9jb2xzKHBhY2tldFBhcnNlciwgb3B0aW9ucykgOjpcbiAgY29uc3Qgc2hhcmVkID0gaW5pdF9zaGFyZWQgQCBwYWNrZXRQYXJzZXIsIG9wdGlvbnNcblxuICBjb25zdCBpbmJvdW5kID0gW11cbiAgY29uc3QganNvbiA9IHNoYXJlZC5iaW5kVHJhbnNwb3J0cyBAIGluYm91bmRcbiAgICAweDAwIC8vIDB4MCog4oCUIEpTT04gYm9keVxuICAgIGpzb25fcHJvdG9jb2woc2hhcmVkKVxuXG4gIGNvbnN0IGJpbmFyeSA9IHNoYXJlZC5iaW5kVHJhbnNwb3J0cyBAIGluYm91bmRcbiAgICAweDEwIC8vIDB4MSog4oCUIGJpbmFyeSBib2R5XG4gICAgYmluYXJ5X3Byb3RvY29sKHNoYXJlZClcblxuICBjb25zdCBjb250cm9sID0gY29udHJvbF9wcm90b2NvbCBAIGluYm91bmQsXG4gICAgMHhmMCAvLyAweGYqIOKAlCBjb250cm9sXG4gICAgc2hhcmVkXG5cbiAgY29uc3QgY29kZWNzID0gQDoganNvbiwgYmluYXJ5LCBjb250cm9sLCBkZWZhdWx0OiBqc29uXG5cbiAgcmV0dXJuIEB7fSBpbmJvdW5kLCBjb2RlY3MsIHNoYXJlZCwgcmFuZG9tX2lkOiBzaGFyZWQucmFuZG9tX2lkXG5cbiIsImltcG9ydCBwbHVnaW4gZnJvbSAnLi9wbHVnaW4uanN5J1xuXG5jb25zdCBnZXRSYW5kb21WYWx1ZXMgPSAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHdpbmRvd1xuICA/IHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzIDogbnVsbFxuXG5wcm90b2NvbHNfYnJvd3Nlci5yYW5kb21faWQgPSByYW5kb21faWRcbmZ1bmN0aW9uIHJhbmRvbV9pZCgpIDo6XG4gIGNvbnN0IGFyciA9IG5ldyBJbnQzMkFycmF5KDEpXG4gIGdldFJhbmRvbVZhbHVlcyhhcnIpXG4gIHJldHVybiBhcnJbMF1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcHJvdG9jb2xzX2Jyb3dzZXIocGx1Z2luX29wdGlvbnM9e30pIDo6XG4gIGlmIG51bGwgPT0gcGx1Z2luX29wdGlvbnMucmFuZG9tX2lkIDo6XG4gICAgcGx1Z2luX29wdGlvbnMucmFuZG9tX2lkID0gcmFuZG9tX2lkXG5cbiAgcmV0dXJuIHBsdWdpbihwbHVnaW5fb3B0aW9ucylcblxuIl0sIm5hbWVzIjpbImxpdHRsZV9lbmRpYW4iLCJjX3NpbmdsZSIsImNfZGF0YWdyYW0iLCJjX2RpcmVjdCIsImNfbXVsdGlwYXJ0IiwiY19zdHJlYW1pbmciLCJfZXJyX21zZ2lkX3JlcXVpcmVkIiwiX2Vycl90b2tlbl9yZXF1aXJlZCIsImZybV9yb3V0aW5nIiwic2l6ZSIsImJpdHMiLCJtYXNrIiwib2JqIiwiZnJvbV9pZCIsImR2Iiwib2Zmc2V0Iiwic2V0SW50MzIiLCJpZF9yb3V0ZXIiLCJpZF90YXJnZXQiLCJ1bmRlZmluZWQiLCJnZXRJbnQzMiIsImZybV9yZXNwb25zZSIsIm1zZ2lkIiwiRXJyb3IiLCJzZXRJbnQxNiIsInNlcV9hY2siLCJhY2tfZmxhZ3MiLCJ0b2tlbiIsImdldEludDE2IiwiZnJtX2RhdGFncmFtIiwidHJhbnNwb3J0IiwiZnJtX2RpcmVjdCIsImZybV9tdWx0aXBhcnQiLCJzZXFfcG9zIiwic2VxIiwic2VxX2ZsYWdzIiwiZnJtX3N0cmVhbWluZyIsImJpbmRfc2VxX25leHQiLCJzZXFfb2Zmc2V0Iiwic2VxX25leHQiLCJmbGFncyIsImZpbiIsIk5hTiIsImNvbXBvc2VGcmFtaW5ncyIsImZybV9mcm9tIiwiZnJtX3Jlc3AiLCJmcm1fdHJhbnNwb3J0cyIsImxlbmd0aCIsImJ5Qml0cyIsInRfZnJvbSIsImZfdGVzdCIsInRfcmVzcCIsInQwIiwidDEiLCJ0MiIsInQzIiwibWFwIiwiZiIsInRlc3RCaXRzIiwiY2hvb3NlIiwibHN0IiwiVCIsImIiLCJvcCIsImZuX2tleSIsImZuX3RyYW4iLCJmbl9mcm9tIiwiZm5fcmVzcCIsImZybSIsImJpbmRBc3NlbWJsZWQiLCJmX3BhY2siLCJmX3VucGFjayIsInBhY2siLCJ1bnBhY2siLCJwa3RfdHlwZSIsInBrdF9vYmoiLCJUeXBlRXJyb3IiLCJ0eXBlIiwiRGF0YVZpZXciLCJBcnJheUJ1ZmZlciIsImhlYWRlciIsImJ1ZmZlciIsInNsaWNlIiwicGt0IiwiYnVmIiwiaGVhZGVyX2J1ZmZlciIsIlVpbnQ4QXJyYXkiLCJpbmZvIiwiX2JpbmRfaXRlcmFibGUiLCJidWZfY2xvbmUiLCJ0dGwiLCJuZXh0Iiwib3B0aW9ucyIsImRvbmUiLCJ2YWx1ZSIsInBhY2tldFBhcnNlciIsInNoYXJlZCIsImNvbmNhdEJ1ZmZlcnMiLCJjcmVhdGVNdWx0aXBhcnQiLCJzaW5rIiwiZGVsZXRlU3RhdGUiLCJwYXJ0cyIsImZlZWQiLCJib2R5X2J1ZmZlciIsImluY2x1ZGVzIiwicmVzIiwiY3JlYXRlU3RyZWFtIiwicmVjdkRhdGEiLCJyc3RyZWFtIiwic3RhdGUiLCJmZWVkX2luaXQiLCJhc19jb250ZW50IiwiZmVlZF9pZ25vcmUiLCJtc2ciLCJqc29uX3VucGFjayIsImJvZHlfdXRmOCIsInJlY3ZTdHJlYW0iLCJyZWN2U3RyZWFtRGF0YSIsImJpbmQiLCJlcnIiLCJvbl9lcnJvciIsImZlZWRfYm9keSIsIm9uX2luaXQiLCJkYXRhIiwib25fZGF0YSIsIm9uX2VuZCIsImZlZWRfc2VxIiwiY2hlY2tfZm5zIiwia2V5cyIsImtleSIsInBhY2tQYWNrZXRPYmoiLCJyYW5kb21faWQiLCJqc29uX3BhY2siLCJjaG9vc2VGcmFtaW5nIiwiZnJhbWluZ3MiLCJmcmFnbWVudF9zaXplIiwiTnVtYmVyIiwiYmluZFRyYW5zcG9ydHMiLCJwYWNrZXRGcmFnbWVudHMiLCJpbmJvdW5kIiwiaGlnaGJpdHMiLCJ0cmFuc3BvcnRzIiwicGFja0JvZHkiLCJvdXRib3VuZCIsImJpbmRUcmFuc3BvcnRJbXBscyIsInN0cmVhbWluZyIsInNlbmQiLCJzdHJlYW0iLCJiaW5kU3RyZWFtIiwiY2hhbiIsImJvZHkiLCJieXRlTGVuZ3RoIiwibXNlbmQiLCJtc2VuZF9ieXRlcyIsInBhY2tfaGRyIiwibXNlbmRfb2JqZWN0cyIsIm1vZGUiLCJtc2VuZF9pbXBsIiwib2JqZWN0IiwiYnl0ZXMiLCJ3cml0ZSIsImVuZCIsImNodW5rIiwibmV4dF9oZHIiLCJpIiwibGFzdElubmVyIiwiaTAiLCJmcmFtZSIsImltcGwiLCJ0X3JlY3YiLCJyZWN2X21zZyIsImluaXRfc2hhcmVkIiwiT2JqZWN0IiwiYXNzaWduIiwic3RhdGVGb3IiLCJtdWx0aXBhcnQiLCJjcmVhdGVTdGF0ZSIsImJ5X21zZ2lkIiwiZ2V0IiwiZGVsZXRlIiwic2V0Iiwibm9vcF9lbmNvZGluZ3MiLCJqc29uX3Byb3RvY29sIiwiZW5jb2RlIiwiZGVjb2RlIiwicGFja191dGY4IiwidW5wYWNrX3V0ZjgiLCJkYXRhZ3JhbSIsImRpcmVjdCIsImpzb25fYnVmIiwidW5wYWNrQm9keUJ1ZiIsInJlY3ZNc2ciLCJib2R5X2J1ZiIsImFzX2pzb25fY29udGVudCIsImlmQWJzZW50IiwiYmluYXJ5X3Byb3RvY29sIiwiYXNCdWZmZXIiLCJwa3RfYnVmZmVyIiwiY29udHJvbF9wcm90b2NvbCIsImhpZ2giLCJwaW5nX2ZyYW1lIiwicG9uZ19mcmFtZSIsInBvbmdfdHlwZSIsInJlY3ZfcG9uZyIsInBpbmdfdHlwZSIsInJlY3ZfcGluZyIsInBpbmciLCJKU09OIiwic3RyaW5naWZ5IiwidHMwIiwiRGF0ZSIsInJvdXRlciIsImJvZHlfanNvbiIsInJlY3ZDdHJsIiwiX3NlbmRfcG9uZyIsInBrdF9waW5nIiwicl9pZCIsInRzMSIsImRpc3BhdGNoIiwiZGVmYXVsdF9wbHVnaW5fb3B0aW9ucyIsInByb3RvY29scyIsInBsdWdpbl9vcHRpb25zIiwicGx1Z2luX25hbWUiLCJzdWJjbGFzcyIsIm9yZGVyIiwiRmFicmljSHViX1BJIiwiYmFzZXMiLCJwcm90b3R5cGUiLCJpc1BhY2tldFBhcnNlciIsImN1c3RvbSIsImluaXRfcHJvdG9jb2xzIiwianNvbiIsImJpbmFyeSIsImNvbnRyb2wiLCJjb2RlY3MiLCJkZWZhdWx0IiwiZ2V0UmFuZG9tVmFsdWVzIiwid2luZG93IiwiY3J5cHRvIiwicHJvdG9jb2xzX2Jyb3dzZXIi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
