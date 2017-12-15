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
        const json_buf = decode(sink, pkt.body_buffer());
        const msg = unpackBodyBuf(json_buf, sink);
        return sink.recvMsg(msg, pkt.info);
      } },

    multipart: {
      t_recv(pkt, sink) {
        const state = stateFor(pkt, sink, createMultipart);
        const body_buf = state.feed(pkt);
        if (undefined !== body_buf) {
          const json_buf = decode(sink, body_buf);
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
    return chan(pkt);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5tanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvc2hhcmVkL2ZyYW1pbmcuanN5IiwiLi4vY29kZS9zaGFyZWQvbXVsdGlwYXJ0LmpzeSIsIi4uL2NvZGUvc2hhcmVkL3N0cmVhbWluZy5qc3kiLCIuLi9jb2RlL3NoYXJlZC90cmFuc3BvcnQuanN5IiwiLi4vY29kZS9zaGFyZWQvaW5kZXguanN5IiwiLi4vY29kZS9wcm90b2NvbHMvanNvbi5qc3kiLCIuLi9jb2RlL3Byb3RvY29scy9iaW5hcnkuanN5IiwiLi4vY29kZS9wcm90b2NvbHMvY29udHJvbC5qc3kiLCIuLi9jb2RlL3BsdWdpbi5qc3kiLCIuLi9jb2RlL2luZGV4LmJyb3dzZXIuanN5Il0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGxpdHRsZV9lbmRpYW4gPSB0cnVlXG5jb25zdCBjX3NpbmdsZSA9ICdzaW5nbGUnXG5jb25zdCBjX2RhdGFncmFtID0gJ2RhdGFncmFtJ1xuY29uc3QgY19kaXJlY3QgPSAnZGlyZWN0J1xuY29uc3QgY19tdWx0aXBhcnQgPSAnbXVsdGlwYXJ0J1xuY29uc3QgY19zdHJlYW1pbmcgPSAnc3RyZWFtaW5nJ1xuXG5jb25zdCBfZXJyX21zZ2lkX3JlcXVpcmVkID0gYFJlc3BvbnNlIHJlcWlyZXMgJ21zZ2lkJ2BcbmNvbnN0IF9lcnJfdG9rZW5fcmVxdWlyZWQgPSBgVHJhbnNwb3J0IHJlcWlyZXMgJ3Rva2VuJ2BcblxuXG5mdW5jdGlvbiBmcm1fcm91dGluZygpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHgxLCBtYXNrID0gMHgxXG4gIHJldHVybiBAe31cbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gbnVsbCAhPSBvYmouZnJvbV9pZCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGNvbnN0IHtmcm9tX2lkfSA9IG9ialxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgMHxmcm9tX2lkLmlkX3JvdXRlciwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MzIgQCA0K29mZnNldCwgMHxmcm9tX2lkLmlkX3RhcmdldCwgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgY29uc3QgZnJvbV9pZCA9IHVuZGVmaW5lZCA9PT0gb2JqLmZyb21faWRcbiAgICAgICAgPyBvYmouZnJvbV9pZCA9IHt9IDogb2JqLmZyb21faWRcbiAgICAgIGZyb21faWQuaWRfcm91dGVyID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgZnJvbV9pZC5pZF90YXJnZXQgPSBkdi5nZXRJbnQzMiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG5cbmZ1bmN0aW9uIGZybV9yZXNwb25zZSgpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHgyLCBtYXNrID0gMHgyXG4gIHJldHVybiBAe31cbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gbnVsbCAhPSBvYmoubXNnaWQgPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai5tc2dpZCA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX21zZ2lkX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoubXNnaWQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDB8b2JqLnNlcV9hY2ssIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNitvZmZzZXQsIDB8b2JqLmFja19mbGFncywgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLnRva2VuID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcV9hY2sgPSBkdi5nZXRJbnQxNiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouYWNrX2ZsYWdzID0gZHYuZ2V0SW50MTYgQCA2K29mZnNldCwgbGl0dGxlX2VuZGlhblxuXG5cblxuZnVuY3Rpb24gZnJtX2RhdGFncmFtKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDAsIGJpdHMgPSAweDAsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfZGF0YWdyYW1cbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OlxuICAgICAgaWYgY19kYXRhZ3JhbSA9PT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gYml0c1xuICAgICAgaWYgb2JqLnRyYW5zcG9ydCAmJiBjX3NpbmdsZSAhPT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gZmFsc2VcbiAgICAgIHJldHVybiAhIG9iai50b2tlbiA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX2RhdGFncmFtXG5cbmZ1bmN0aW9uIGZybV9kaXJlY3QoKSA6OlxuICBjb25zdCBzaXplID0gNCwgYml0cyA9IDB4NCwgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19kaXJlY3RcbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OlxuICAgICAgaWYgY19kaXJlY3QgPT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGJpdHNcbiAgICAgIGlmIG9iai50cmFuc3BvcnQgJiYgY19zaW5nbGUgIT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGZhbHNlXG4gICAgICByZXR1cm4gISEgb2JqLnRva2VuID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoudG9rZW4gOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl90b2tlbl9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLnRva2VuLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoubXNnaWQgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19kaXJlY3RcblxuZnVuY3Rpb24gZnJtX211bHRpcGFydCgpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHg4LCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX211bHRpcGFydFxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6IHJldHVybiBjX211bHRpcGFydCA9PT0gb2JqLnRyYW5zcG9ydCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgYmluZF9zZXFfbmV4dCwgc2VxX3BvczogNFxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai50b2tlbiA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX3Rva2VuX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoudG9rZW4sIGxpdHRsZV9lbmRpYW5cbiAgICAgIGlmIHRydWUgPT0gb2JqLnNlcSA6OiAvLyB1c2Ugc2VxX25leHRcbiAgICAgICAgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMCwgbGl0dGxlX2VuZGlhblxuICAgICAgZWxzZSBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwfG9iai5zZXEsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNitvZmZzZXQsIDB8b2JqLnNlcV9mbGFncywgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLm1zZ2lkICAgICA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXEgICAgICAgPSBkdi5nZXRJbnQxNiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxX2ZsYWdzID0gZHYuZ2V0SW50MTYgQCA2K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfbXVsdGlwYXJ0XG5cbmZ1bmN0aW9uIGZybV9zdHJlYW1pbmcoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4YywgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19zdHJlYW1pbmdcbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gY19zdHJlYW1pbmcgPT09IG9iai50cmFuc3BvcnQgPyBiaXRzIDogZmFsc2VcblxuICAgIGJpbmRfc2VxX25leHQsIHNlcV9wb3M6IDRcbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoudG9rZW4gOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl90b2tlbl9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLnRva2VuLCBsaXR0bGVfZW5kaWFuXG4gICAgICBpZiB0cnVlID09IG9iai5zZXEgOjpcbiAgICAgICAgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMCwgbGl0dGxlX2VuZGlhbiAvLyB1c2Ugc2VxX25leHRcbiAgICAgIGVsc2UgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMHxvYmouc2VxLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDYrb2Zmc2V0LCAwfG9iai5zZXFfZmxhZ3MsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai5tc2dpZCAgICAgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxICAgICAgID0gZHYuZ2V0SW50MTYgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcV9mbGFncyA9IGR2LmdldEludDE2IEAgNitvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX3N0cmVhbWluZ1xuXG5cbmZ1bmN0aW9uIGJpbmRfc2VxX25leHQob2Zmc2V0KSA6OlxuICBjb25zdCBzZXFfb2Zmc2V0ID0gdGhpcy5zZXFfcG9zICsgb2Zmc2V0XG4gIGxldCBzZXEgPSAxXG4gIHJldHVybiBmdW5jdGlvbiBzZXFfbmV4dCh7ZmxhZ3MsIGZpbn0sIGR2KSA6OlxuICAgIGlmICEgZmluIDo6XG4gICAgICBkdi5zZXRJbnQxNiBAIHNlcV9vZmZzZXQsIHNlcSsrLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDIrc2VxX29mZnNldCwgMHxmbGFncywgbGl0dGxlX2VuZGlhblxuICAgIGVsc2UgOjpcbiAgICAgIGR2LnNldEludDE2IEAgc2VxX29mZnNldCwgLXNlcSwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCAyK3NlcV9vZmZzZXQsIDB8ZmxhZ3MsIGxpdHRsZV9lbmRpYW5cbiAgICAgIHNlcSA9IE5hTlxuXG5cblxuZXhwb3J0IGRlZmF1bHQgY29tcG9zZUZyYW1pbmdzKClcbmZ1bmN0aW9uIGNvbXBvc2VGcmFtaW5ncygpIDo6XG4gIGNvbnN0IGZybV9mcm9tID0gZnJtX3JvdXRpbmcoKSwgZnJtX3Jlc3AgPSBmcm1fcmVzcG9uc2UoKVxuICBjb25zdCBmcm1fdHJhbnNwb3J0cyA9IEBbXSBmcm1fZGF0YWdyYW0oKSwgZnJtX2RpcmVjdCgpLCBmcm1fbXVsdGlwYXJ0KCksIGZybV9zdHJlYW1pbmcoKVxuXG4gIGlmIDggIT09IGZybV9mcm9tLnNpemUgfHwgOCAhPT0gZnJtX3Jlc3Auc2l6ZSB8fCA0ICE9IGZybV90cmFuc3BvcnRzLmxlbmd0aCA6OlxuICAgIHRocm93IG5ldyBFcnJvciBAIGBGcmFtaW5nIFNpemUgY2hhbmdlYFxuXG4gIGNvbnN0IGJ5Qml0cyA9IFtdLCBtYXNrPTB4ZlxuXG4gIDo6XG4gICAgY29uc3QgdF9mcm9tID0gZnJtX2Zyb20uZl90ZXN0LCB0X3Jlc3AgPSBmcm1fcmVzcC5mX3Rlc3RcbiAgICBjb25zdCBbdDAsdDEsdDIsdDNdID0gZnJtX3RyYW5zcG9ydHMubWFwIEAgZj0+Zi5mX3Rlc3RcblxuICAgIGNvbnN0IHRlc3RCaXRzID0gYnlCaXRzLnRlc3RCaXRzID0gb2JqID0+XG4gICAgICAwIHwgdF9mcm9tKG9iaikgfCB0X3Jlc3Aob2JqKSB8IHQwKG9iaikgfCB0MShvYmopIHwgdDIob2JqKSB8IHQzKG9iailcblxuICAgIGJ5Qml0cy5jaG9vc2UgPSBmdW5jdGlvbiAob2JqLCBsc3QpIDo6XG4gICAgICBpZiBudWxsID09IGxzdCA6OiBsc3QgPSB0aGlzIHx8IGJ5Qml0c1xuICAgICAgcmV0dXJuIGxzdFt0ZXN0Qml0cyhvYmopXVxuXG5cbiAgZm9yIGNvbnN0IFQgb2YgZnJtX3RyYW5zcG9ydHMgOjpcbiAgICBjb25zdCB7Yml0czpiLCBzaXplLCB0cmFuc3BvcnR9ID0gVFxuXG4gICAgYnlCaXRzW2J8MF0gPSBAe30gVCwgdHJhbnNwb3J0LCBiaXRzOiBifDAsIG1hc2ssIHNpemU6IHNpemUsIG9wOiAnJ1xuICAgIGJ5Qml0c1tifDFdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwxLCBtYXNrLCBzaXplOiA4ICsgc2l6ZSwgb3A6ICdmJ1xuICAgIGJ5Qml0c1tifDJdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwyLCBtYXNrLCBzaXplOiA4ICsgc2l6ZSwgb3A6ICdyJ1xuICAgIGJ5Qml0c1tifDNdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwzLCBtYXNrLCBzaXplOiAxNiArIHNpemUsIG9wOiAnZnInXG5cbiAgICBmb3IgY29uc3QgZm5fa2V5IG9mIFsnZl9wYWNrJywgJ2ZfdW5wYWNrJ10gOjpcbiAgICAgIGNvbnN0IGZuX3RyYW4gPSBUW2ZuX2tleV0sIGZuX2Zyb20gPSBmcm1fZnJvbVtmbl9rZXldLCBmbl9yZXNwID0gZnJtX3Jlc3BbZm5fa2V5XVxuXG4gICAgICBieUJpdHNbYnwwXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fdHJhbihvYmosIGR2LCAwKVxuICAgICAgYnlCaXRzW2J8MV1bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX2Zyb20ob2JqLCBkdiwgMCk7IGZuX3RyYW4ob2JqLCBkdiwgOClcbiAgICAgIGJ5Qml0c1tifDJdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl9yZXNwKG9iaiwgZHYsIDApOyBmbl90cmFuKG9iaiwgZHYsIDgpXG4gICAgICBieUJpdHNbYnwzXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fZnJvbShvYmosIGR2LCAwKTsgZm5fcmVzcChvYmosIGR2LCA4KTsgZm5fdHJhbihvYmosIGR2LCAxNilcblxuICBmb3IgY29uc3QgZnJtIG9mIGJ5Qml0cyA6OlxuICAgIGJpbmRBc3NlbWJsZWQgQCBmcm1cblxuICByZXR1cm4gYnlCaXRzXG5cblxuZnVuY3Rpb24gYmluZEFzc2VtYmxlZChmcm0pIDo6XG4gIGNvbnN0IHtULCBzaXplLCBmX3BhY2ssIGZfdW5wYWNrfSA9IGZybVxuICBpZiBULmJpbmRfc2VxX25leHQgOjpcbiAgICBmcm0uc2VxX25leHQgPSBULmJpbmRfc2VxX25leHQgQCBmcm0uc2l6ZSAtIFQuc2l6ZVxuXG4gIGRlbGV0ZSBmcm0uVFxuICBmcm0ucGFjayA9IHBhY2sgOyBmcm0udW5wYWNrID0gdW5wYWNrXG4gIGNvbnN0IHNlcV9uZXh0ID0gZnJtLnNlcV9uZXh0XG5cbiAgZnVuY3Rpb24gcGFjayhwa3RfdHlwZSwgcGt0X29iaikgOjpcbiAgICBpZiAhIEAgMCA8PSBwa3RfdHlwZSAmJiBwa3RfdHlwZSA8PSAyNTUgOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgRXhwZWN0ZWQgcGt0X3R5cGUgdG8gYmUgWzAuLjI1NV1gXG5cbiAgICBwa3Rfb2JqLnR5cGUgPSBwa3RfdHlwZVxuICAgIGlmIHNlcV9uZXh0ICYmIG51bGwgPT0gcGt0X29iai5zZXEgOjpcbiAgICAgIHBrdF9vYmouc2VxID0gdHJ1ZVxuXG4gICAgY29uc3QgZHYgPSBuZXcgRGF0YVZpZXcgQCBuZXcgQXJyYXlCdWZmZXIoc2l6ZSlcbiAgICBmX3BhY2socGt0X29iaiwgZHYsIDApXG4gICAgcGt0X29iai5oZWFkZXIgPSBkdi5idWZmZXJcblxuICAgIGlmIHRydWUgPT09IHBrdF9vYmouc2VxIDo6XG4gICAgICBfYmluZF9pdGVyYWJsZSBAIHBrdF9vYmosIGR2LmJ1ZmZlci5zbGljZSgwLHNpemUpXG5cbiAgZnVuY3Rpb24gdW5wYWNrKHBrdCkgOjpcbiAgICBjb25zdCBidWYgPSBwa3QuaGVhZGVyX2J1ZmZlcigpXG4gICAgY29uc3QgZHYgPSBuZXcgRGF0YVZpZXcgQCBuZXcgVWludDhBcnJheShidWYpLmJ1ZmZlclxuXG4gICAgY29uc3QgaW5mbyA9IHt9XG4gICAgZl91bnBhY2soaW5mbywgZHYsIDApXG4gICAgcmV0dXJuIHBrdC5pbmZvID0gaW5mb1xuXG4gIGZ1bmN0aW9uIF9iaW5kX2l0ZXJhYmxlKHBrdF9vYmosIGJ1Zl9jbG9uZSkgOjpcbiAgICBjb25zdCB7dHlwZX0gPSBwa3Rfb2JqXG4gICAgY29uc3Qge2lkX3JvdXRlciwgaWRfdGFyZ2V0LCB0dGwsIHRva2VufSA9IHBrdF9vYmpcbiAgICBwa3Rfb2JqLm5leHQgPSBuZXh0XG5cbiAgICBmdW5jdGlvbiBuZXh0KG9wdGlvbnMpIDo6XG4gICAgICBpZiBudWxsID09IG9wdGlvbnMgOjogb3B0aW9ucyA9IHt9XG4gICAgICBjb25zdCBoZWFkZXIgPSBidWZfY2xvbmUuc2xpY2UoKVxuICAgICAgc2VxX25leHQgQCBvcHRpb25zLCBuZXcgRGF0YVZpZXcgQCBoZWFkZXJcbiAgICAgIHJldHVybiBAe30gZG9uZTogISEgb3B0aW9ucy5maW4sIHZhbHVlOiBAe30gLy8gcGt0X29ialxuICAgICAgICBpZF9yb3V0ZXIsIGlkX3RhcmdldCwgdHlwZSwgdHRsLCB0b2tlbiwgaGVhZGVyXG5cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBhY2tldFBhcnNlciwgc2hhcmVkKSA6OlxuICBjb25zdCB7Y29uY2F0QnVmZmVyc30gPSBwYWNrZXRQYXJzZXJcbiAgcmV0dXJuIEB7fSBjcmVhdGVNdWx0aXBhcnRcblxuXG4gIGZ1bmN0aW9uIGNyZWF0ZU11bHRpcGFydChwa3QsIHNpbmssIGRlbGV0ZVN0YXRlKSA6OlxuICAgIGxldCBwYXJ0cyA9IFtdLCBmaW4gPSBmYWxzZVxuICAgIHJldHVybiBAe30gZmVlZCwgaW5mbzogcGt0LmluZm9cblxuICAgIGZ1bmN0aW9uIGZlZWQocGt0KSA6OlxuICAgICAgbGV0IHNlcSA9IHBrdC5pbmZvLnNlcVxuICAgICAgaWYgc2VxIDwgMCA6OiBmaW4gPSB0cnVlOyBzZXEgPSAtc2VxXG4gICAgICBwYXJ0c1tzZXEtMV0gPSBwa3QuYm9keV9idWZmZXIoKVxuXG4gICAgICBpZiAhIGZpbiA6OiByZXR1cm5cbiAgICAgIGlmIHBhcnRzLmluY2x1ZGVzIEAgdW5kZWZpbmVkIDo6IHJldHVyblxuXG4gICAgICBkZWxldGVTdGF0ZSgpXG5cbiAgICAgIGNvbnN0IHJlcyA9IGNvbmNhdEJ1ZmZlcnMocGFydHMpXG4gICAgICBwYXJ0cyA9IG51bGxcbiAgICAgIHJldHVybiByZXNcblxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIHJldHVybiBAe30gY3JlYXRlU3RyZWFtXG5cblxuICBmdW5jdGlvbiBjcmVhdGVTdHJlYW0ocGt0LCBzaW5rLCBkZWxldGVTdGF0ZSkgOjpcbiAgICBsZXQgbmV4dD0wLCBmaW4gPSBmYWxzZSwgcmVjdkRhdGEsIHJzdHJlYW1cbiAgICBjb25zdCBzdGF0ZSA9IEB7fSBmZWVkOiBmZWVkX2luaXQsIGluZm86IHBrdC5pbmZvXG4gICAgcmV0dXJuIHN0YXRlXG5cbiAgICBmdW5jdGlvbiBmZWVkX2luaXQocGt0LCBhc19jb250ZW50KSA6OlxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfaWdub3JlXG5cbiAgICAgIGNvbnN0IGluZm8gPSBwa3QuaW5mb1xuICAgICAgY29uc3QgbXNnID0gc2luay5qc29uX3VucGFjayBAIHBrdC5ib2R5X3V0ZjgoKVxuICAgICAgcnN0cmVhbSA9IHNpbmsucmVjdlN0cmVhbShtc2csIGluZm8pXG4gICAgICBpZiBudWxsID09IHJzdHJlYW0gOjogcmV0dXJuXG4gICAgICBjaGVja19mbnMgQCByc3RyZWFtLCAnb25fZXJyb3InLCAnb25fZGF0YScsICdvbl9lbmQnIFxuICAgICAgcmVjdkRhdGEgPSBzaW5rLnJlY3ZTdHJlYW1EYXRhLmJpbmQoc2luaywgcnN0cmVhbSwgaW5mbylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGZlZWRfc2VxKHBrdClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9lcnJvciBAIGVyciwgcGt0XG5cbiAgICAgIHN0YXRlLmZlZWQgPSBmZWVkX2JvZHlcbiAgICAgIGlmIHJzdHJlYW0ub25faW5pdCA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9pbml0KG1zZywgcGt0KVxuXG4gICAgZnVuY3Rpb24gZmVlZF9ib2R5KHBrdCwgYXNfY29udGVudCkgOjpcbiAgICAgIHJlY3ZEYXRhKClcbiAgICAgIGxldCBkYXRhXG4gICAgICB0cnkgOjpcbiAgICAgICAgZmVlZF9zZXEocGt0KVxuICAgICAgICBkYXRhID0gYXNfY29udGVudChwa3QsIHNpbmspXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZXJyb3IgQCBlcnIsIHBrdFxuXG4gICAgICBpZiBmaW4gOjpcbiAgICAgICAgY29uc3QgcmVzID0gcnN0cmVhbS5vbl9kYXRhIEAgZGF0YSwgcGt0XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2VuZCBAIHJlcywgcGt0XG4gICAgICBlbHNlIDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2RhdGEgQCBkYXRhLCBwa3RcblxuICAgIGZ1bmN0aW9uIGZlZWRfaWdub3JlKHBrdCkgOjpcbiAgICAgIHRyeSA6OiBmZWVkX3NlcShwa3QpXG4gICAgICBjYXRjaCBlcnIgOjpcblxuICAgIGZ1bmN0aW9uIGZlZWRfc2VxKHBrdCkgOjpcbiAgICAgIGxldCBzZXEgPSBwa3QuaW5mby5zZXFcbiAgICAgIGlmIHNlcSA+PSAwIDo6XG4gICAgICAgIGlmIG5leHQrKyA9PT0gc2VxIDo6XG4gICAgICAgICAgcmV0dXJuIC8vIGluIG9yZGVyXG4gICAgICBlbHNlIDo6XG4gICAgICAgIGZpbiA9IHRydWVcbiAgICAgICAgZGVsZXRlU3RhdGUoKVxuICAgICAgICBpZiBuZXh0ID09PSAtc2VxIDo6XG4gICAgICAgICAgbmV4dCA9ICdkb25lJ1xuICAgICAgICAgIHJldHVybiAvLyBpbi1vcmRlciwgbGFzdCBwYWNrZXRcblxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfaWdub3JlXG4gICAgICBuZXh0ID0gJ2ludmFsaWQnXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgUGFja2V0IG91dCBvZiBzZXF1ZW5jZWBcblxuXG5mdW5jdGlvbiBjaGVja19mbnMob2JqLCAuLi5rZXlzKSA6OlxuICBmb3IgY29uc3Qga2V5IG9mIGtleXMgOjpcbiAgICBpZiAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygb2JqW2tleV0gOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgRXhwZWN0ZWQgXCIke2tleX1cIiB0byBiZSBhIGZ1bmN0aW9uYFxuXG4iLCJpbXBvcnQgZnJhbWluZ3MgZnJvbSAnLi9mcmFtaW5nLmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtwYWNrUGFja2V0T2JqfSA9IHBhY2tldFBhcnNlclxuICBjb25zdCB7cmFuZG9tX2lkLCBqc29uX3BhY2t9ID0gc2hhcmVkXG4gIGNvbnN0IHtjaG9vc2U6IGNob29zZUZyYW1pbmd9ID0gZnJhbWluZ3NcblxuICBjb25zdCBmcmFnbWVudF9zaXplID0gTnVtYmVyIEAgc2hhcmVkLmZyYWdtZW50X3NpemUgfHwgODAwMFxuICBpZiAxMDI0ID4gZnJhZ21lbnRfc2l6ZSB8fCA2NTAwMCA8IGZyYWdtZW50X3NpemUgOjpcbiAgICB0aHJvdyBuZXcgRXJyb3IgQCBgSW52YWxpZCBmcmFnbWVudCBzaXplOiAke2ZyYWdtZW50X3NpemV9YFxuXG4gIHJldHVybiBAe30gYmluZFRyYW5zcG9ydHMsIHBhY2tldEZyYWdtZW50cywgY2hvb3NlRnJhbWluZ1xuXG5cbiAgZnVuY3Rpb24gYmluZFRyYW5zcG9ydHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpIDo6XG4gICAgY29uc3QgcGFja0JvZHkgPSB0cmFuc3BvcnRzLnBhY2tCb2R5XG4gICAgY29uc3Qgb3V0Ym91bmQgPSBiaW5kVHJhbnNwb3J0SW1wbHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpXG5cbiAgICBpZiB0cmFuc3BvcnRzLnN0cmVhbWluZyA6OlxuICAgICAgcmV0dXJuIEB7fSBzZW5kLCBzdHJlYW06IGJpbmRTdHJlYW0oKVxuXG4gICAgcmV0dXJuIEB7fSBzZW5kXG5cblxuXG4gICAgZnVuY3Rpb24gc2VuZChjaGFuLCBvYmosIGJvZHkpIDo6XG4gICAgICBib2R5ID0gcGFja0JvZHkoYm9keSwgb2JqLCBjaGFuKVxuICAgICAgaWYgZnJhZ21lbnRfc2l6ZSA8IGJvZHkuYnl0ZUxlbmd0aCA6OlxuICAgICAgICBpZiAhIG9iai50b2tlbiA6OiBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgICAgICBvYmoudHJhbnNwb3J0ID0gJ211bHRpcGFydCdcbiAgICAgICAgY29uc3QgbXNlbmQgPSBtc2VuZF9ieXRlcyhjaGFuLCBvYmopXG4gICAgICAgIHJldHVybiBtc2VuZCBAIHRydWUsIGJvZHlcblxuICAgICAgb2JqLnRyYW5zcG9ydCA9ICdzaW5nbGUnXG4gICAgICBvYmouYm9keSA9IGJvZHlcbiAgICAgIGNvbnN0IHBhY2tfaGRyID0gb3V0Ym91bmQuY2hvb3NlKG9iailcbiAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBwYWNrX2hkcihvYmopXG4gICAgICByZXR1cm4gY2hhbi5zZW5kIEAgcGt0XG5cblxuICAgIGZ1bmN0aW9uIG1zZW5kX2J5dGVzKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgY29uc3QgcGFja19oZHIgPSBvdXRib3VuZC5jaG9vc2Uob2JqKVxuICAgICAgbGV0IHtuZXh0fSA9IHBhY2tfaGRyKG9iailcbiAgICAgIGlmIG51bGwgIT09IG1zZyA6OlxuICAgICAgICBvYmouYm9keSA9IG1zZ1xuICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgIGNoYW4uc2VuZCBAIHBrdFxuXG4gICAgICByZXR1cm4gYXN5bmMgZnVuY3Rpb24gKGZpbiwgYm9keSkgOjpcbiAgICAgICAgaWYgbnVsbCA9PT0gbmV4dCA6OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBAICdXcml0ZSBhZnRlciBlbmQnXG4gICAgICAgIGxldCByZXNcbiAgICAgICAgZm9yIGNvbnN0IG9iaiBvZiBwYWNrZXRGcmFnbWVudHMgQCBib2R5LCBuZXh0LCBmaW4gOjpcbiAgICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgICAgcmVzID0gYXdhaXQgY2hhbi5zZW5kIEAgcGt0XG4gICAgICAgIGlmIGZpbiA6OiBuZXh0ID0gbnVsbFxuICAgICAgICByZXR1cm4gcmVzXG5cblxuICAgIGZ1bmN0aW9uIG1zZW5kX29iamVjdHMoY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICBjb25zdCBwYWNrX2hkciA9IG91dGJvdW5kLmNob29zZShvYmopXG4gICAgICBsZXQge25leHR9ID0gcGFja19oZHIob2JqKVxuICAgICAgaWYgbnVsbCAhPT0gbXNnIDo6XG4gICAgICAgIG9iai5ib2R5ID0gbXNnXG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgY2hhbi5zZW5kIEAgcGt0XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbiAoZmluLCBib2R5KSA6OlxuICAgICAgICBpZiBudWxsID09PSBuZXh0IDo6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgJ1dyaXRlIGFmdGVyIGVuZCdcbiAgICAgICAgY29uc3Qgb2JqID0gbmV4dCh7ZmlufSlcbiAgICAgICAgb2JqLmJvZHkgPSBib2R5XG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgaWYgZmluIDo6IG5leHQgPSBudWxsXG4gICAgICAgIHJldHVybiBjaGFuLnNlbmQgQCBwa3RcblxuXG4gICAgZnVuY3Rpb24gYmluZFN0cmVhbSgpIDo6XG4gICAgICBjb25zdCB7bW9kZX0gPSB0cmFuc3BvcnRzLnN0cmVhbWluZ1xuICAgICAgY29uc3QgbXNlbmRfaW1wbCA9IHtvYmplY3Q6IG1zZW5kX29iamVjdHMsIGJ5dGVzOiBtc2VuZF9ieXRlc31bbW9kZV1cbiAgICAgIGlmIG1zZW5kX2ltcGwgOjogcmV0dXJuIHN0cmVhbVxuXG4gICAgICBmdW5jdGlvbiBzdHJlYW0oY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICAgIGlmICEgb2JqLnRva2VuIDo6IG9iai50b2tlbiA9IHJhbmRvbV9pZCgpXG4gICAgICAgIG9iai50cmFuc3BvcnQgPSAnc3RyZWFtaW5nJ1xuICAgICAgICBjb25zdCBtc2VuZCA9IG1zZW5kX2ltcGwgQCBjaGFuLCBvYmosIGpzb25fcGFjayhtc2cpXG4gICAgICAgIHdyaXRlLndyaXRlID0gd3JpdGU7IHdyaXRlLmVuZCA9IHdyaXRlLmJpbmQodHJ1ZSlcbiAgICAgICAgcmV0dXJuIHdyaXRlXG5cbiAgICAgICAgZnVuY3Rpb24gd3JpdGUoY2h1bmspIDo6XG4gICAgICAgICAgLy8gbXNlbmQgQCBmaW4sIGJvZHlcbiAgICAgICAgICByZXR1cm4gY2h1bmsgIT0gbnVsbFxuICAgICAgICAgICAgPyBtc2VuZCBAIHRydWU9PT10aGlzLCBwYWNrQm9keShjaHVuaywgb2JqLCBjaGFuKVxuICAgICAgICAgICAgOiBtc2VuZCBAIHRydWVcblxuXG4gIGZ1bmN0aW9uICogcGFja2V0RnJhZ21lbnRzKGJ1ZiwgbmV4dF9oZHIsIGZpbikgOjpcbiAgICBpZiBudWxsID09IGJ1ZiA6OlxuICAgICAgY29uc3Qgb2JqID0gbmV4dF9oZHIoe2Zpbn0pXG4gICAgICB5aWVsZCBvYmpcbiAgICAgIHJldHVyblxuXG4gICAgbGV0IGkgPSAwLCBsYXN0SW5uZXIgPSBidWYuYnl0ZUxlbmd0aCAtIGZyYWdtZW50X3NpemU7XG4gICAgd2hpbGUgaSA8IGxhc3RJbm5lciA6OlxuICAgICAgY29uc3QgaTAgPSBpXG4gICAgICBpICs9IGZyYWdtZW50X3NpemVcblxuICAgICAgY29uc3Qgb2JqID0gbmV4dF9oZHIoKVxuICAgICAgb2JqLmJvZHkgPSBidWYuc2xpY2UoaTAsIGkpXG4gICAgICB5aWVsZCBvYmpcblxuICAgIDo6XG4gICAgICBjb25zdCBvYmogPSBuZXh0X2hkcih7ZmlufSlcbiAgICAgIG9iai5ib2R5ID0gYnVmLnNsaWNlKGkpXG4gICAgICB5aWVsZCBvYmpcblxuXG5cblxuLy8gbW9kdWxlLWxldmVsIGhlbHBlciBmdW5jdGlvbnNcblxuZnVuY3Rpb24gYmluZFRyYW5zcG9ydEltcGxzKGluYm91bmQsIGhpZ2hiaXRzLCB0cmFuc3BvcnRzKSA6OlxuICBjb25zdCBvdXRib3VuZCA9IFtdXG4gIG91dGJvdW5kLmNob29zZSA9IGZyYW1pbmdzLmNob29zZVxuXG4gIGZvciBjb25zdCBmcmFtZSBvZiBmcmFtaW5ncyA6OlxuICAgIGNvbnN0IGltcGwgPSBmcmFtZSA/IHRyYW5zcG9ydHNbZnJhbWUudHJhbnNwb3J0XSA6IG51bGxcbiAgICBpZiAhIGltcGwgOjogY29udGludWVcblxuICAgIGNvbnN0IHtiaXRzLCBwYWNrLCB1bnBhY2t9ID0gZnJhbWVcbiAgICBjb25zdCBwa3RfdHlwZSA9IGhpZ2hiaXRzIHwgYml0c1xuICAgIGNvbnN0IHt0X3JlY3Z9ID0gaW1wbFxuXG4gICAgZnVuY3Rpb24gcGFja19oZHIob2JqKSA6OlxuICAgICAgcGFjayhwa3RfdHlwZSwgb2JqKVxuICAgICAgcmV0dXJuIG9ialxuXG4gICAgZnVuY3Rpb24gcmVjdl9tc2cocGt0LCBzaW5rKSA6OlxuICAgICAgdW5wYWNrKHBrdClcbiAgICAgIHJldHVybiB0X3JlY3YocGt0LCBzaW5rKVxuXG4gICAgcGFja19oZHIucGt0X3R5cGUgPSByZWN2X21zZy5wa3RfdHlwZSA9IHBrdF90eXBlXG4gICAgb3V0Ym91bmRbYml0c10gPSBwYWNrX2hkclxuICAgIGluYm91bmRbcGt0X3R5cGVdID0gcmVjdl9tc2dcblxuICAgIGlmICdwcm9kdWN0aW9uJyAhPT0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgOjpcbiAgICAgIGNvbnN0IG9wID0gcGFja19oZHIub3AgPSByZWN2X21zZy5vcCA9IGZyYW1lLm9wXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgQCBwYWNrX2hkciwgJ25hbWUnLCBAe30gdmFsdWU6IGBwYWNrX2hkciDCqyR7b3B9wrtgXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgQCByZWN2X21zZywgJ25hbWUnLCBAe30gdmFsdWU6IGByZWN2X21zZyDCqyR7b3B9wrtgXG5cbiAgcmV0dXJuIG91dGJvdW5kXG5cbiIsImV4cG9ydCAqIGZyb20gJy4vZnJhbWluZy5qc3knXG5leHBvcnQgKiBmcm9tICcuL211bHRpcGFydC5qc3knXG5leHBvcnQgKiBmcm9tICcuL3N0cmVhbWluZy5qc3knXG5leHBvcnQgKiBmcm9tICcuL3RyYW5zcG9ydC5qc3knXG5cbmltcG9ydCBtdWx0aXBhcnQgZnJvbSAnLi9tdWx0aXBhcnQuanN5J1xuaW1wb3J0IHN0cmVhbWluZyBmcm9tICcuL3N0cmVhbWluZy5qc3knXG5pbXBvcnQgdHJhbnNwb3J0IGZyb20gJy4vdHJhbnNwb3J0LmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaW5pdF9zaGFyZWQocGFja2V0UGFyc2VyLCBvcHRpb25zKSA6OlxuICBjb25zdCBzaGFyZWQgPSBPYmplY3QuYXNzaWduIEAge3BhY2tldFBhcnNlciwgc3RhdGVGb3J9LCBvcHRpb25zXG5cbiAgT2JqZWN0LmFzc2lnbiBAIHNoYXJlZCxcbiAgICBtdWx0aXBhcnQgQCBwYWNrZXRQYXJzZXIsIHNoYXJlZFxuICAgIHN0cmVhbWluZyBAIHBhY2tldFBhcnNlciwgc2hhcmVkXG4gICAgdHJhbnNwb3J0IEAgcGFja2V0UGFyc2VyLCBzaGFyZWRcblxuICByZXR1cm4gc2hhcmVkXG5cbmZ1bmN0aW9uIHN0YXRlRm9yKHBrdCwgc2luaywgY3JlYXRlU3RhdGUpIDo6XG4gIGNvbnN0IHtieV9tc2dpZH0gPSBzaW5rLCB7bXNnaWR9ID0gcGt0LmluZm9cbiAgbGV0IHN0YXRlID0gYnlfbXNnaWQuZ2V0KG1zZ2lkKVxuICBpZiB1bmRlZmluZWQgPT09IHN0YXRlIDo6XG4gICAgaWYgISBtc2dpZCA6OiB0aHJvdyBuZXcgRXJyb3IgQCBgSW52YWxpZCBtc2dpZDogJHttc2dpZH1gXG5cbiAgICBzdGF0ZSA9IGNyZWF0ZVN0YXRlIEAgcGt0LCBzaW5rLCAoKSA9PiBieV9tc2dpZC5kZWxldGUobXNnaWQpXG4gICAgYnlfbXNnaWQuc2V0IEAgbXNnaWQsIHN0YXRlXG4gIHJldHVybiBzdGF0ZVxuXG4iLCJjb25zdCBub29wX2VuY29kaW5ncyA9IEB7fVxuICBlbmNvZGUoYnVmLCBvYmosIGNoYW4pIDo6IHJldHVybiBidWZcbiAgZGVjb2RlKGJ1Ziwgc2luaykgOjogcmV0dXJuIGJ1ZlxuXG5leHBvcnQgZGVmYXVsdCBqc29uX3Byb3RvY29sXG5leHBvcnQgZnVuY3Rpb24ganNvbl9wcm90b2NvbChzaGFyZWQsIHtlbmNvZGUsIGRlY29kZX09bm9vcF9lbmNvZGluZ3MpIDo6XG4gIGNvbnN0IHtzdGF0ZUZvciwgY3JlYXRlTXVsdGlwYXJ0LCBjcmVhdGVTdHJlYW0sIGpzb25fcGFja30gPSBzaGFyZWRcbiAgY29uc3Qge3BhY2tfdXRmOCwgdW5wYWNrX3V0Zjh9ID0gc2hhcmVkLnBhY2tldFBhcnNlclxuXG4gIHJldHVybiBAe31cbiAgICBwYWNrQm9keVxuXG4gICAgZ2V0IGRhdGFncmFtKCkgOjogcmV0dXJuIHRoaXMuZGlyZWN0XG4gICAgZGlyZWN0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IGpzb25fYnVmID0gZGVjb2RlIEAgc2luaywgcGt0LmJvZHlfYnVmZmVyKClcbiAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGpzb25fYnVmLCBzaW5rXG4gICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIHBrdC5pbmZvXG5cbiAgICBtdWx0aXBhcnQ6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlTXVsdGlwYXJ0XG4gICAgICAgIGNvbnN0IGJvZHlfYnVmID0gc3RhdGUuZmVlZChwa3QpXG4gICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gYm9keV9idWYgOjpcbiAgICAgICAgICBjb25zdCBqc29uX2J1ZiA9IGRlY29kZSBAIHNpbmssIGJvZHlfYnVmXG4gICAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGpzb25fYnVmLCBzaW5rXG4gICAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgc3RhdGUuaW5mb1xuXG4gICAgc3RyZWFtaW5nOiBAe31cbiAgICAgIG1vZGU6ICdvYmplY3QnXG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0YXRlRm9yIEAgcGt0LCBzaW5rLCBjcmVhdGVTdHJlYW1cbiAgICAgICAgcmV0dXJuIHN0YXRlLmZlZWQocGt0LCBhc19qc29uX2NvbnRlbnQpXG5cbiAgZnVuY3Rpb24gcGFja0JvZHkoYm9keSwgb2JqLCBjaGFuKSA6OlxuICAgIGNvbnN0IGJvZHlfYnVmID0gcGFja191dGY4IEAganNvbl9wYWNrIEAgYm9keVxuICAgIHJldHVybiBlbmNvZGUoYm9keV9idWYsIG9iaiwgY2hhbilcblxuICBmdW5jdGlvbiBhc19qc29uX2NvbnRlbnQocGt0LCBzaW5rKSA6OlxuICAgIHJldHVybiB1bnBhY2tCb2R5QnVmIEAgcGt0LmJvZHlfYnVmZmVyKCksIHNpbmssIG51bGxcblxuICBmdW5jdGlvbiB1bnBhY2tCb2R5QnVmKGJvZHlfYnVmLCBzaW5rLCBpZkFic2VudCkgOjpcbiAgICBjb25zdCBqc29uX2J1ZiA9IGRlY29kZShib2R5X2J1Ziwgc2luaylcbiAgICByZXR1cm4gc2luay5qc29uX3VucGFjayBAIGpzb25fYnVmID8gdW5wYWNrX3V0ZjgoanNvbl9idWYpIDogaWZBYnNlbnRcblxuIiwiY29uc3Qgbm9vcF9lbmNvZGluZ3MgPSBAe31cbiAgZW5jb2RlKGJ1Ziwgb2JqLCBjaGFuKSA6OiByZXR1cm4gYnVmXG4gIGRlY29kZShidWYsIHNpbmspIDo6IHJldHVybiBidWZcblxuZXhwb3J0IGRlZmF1bHQgYmluYXJ5X3Byb3RvY29sXG5leHBvcnQgZnVuY3Rpb24gYmluYXJ5X3Byb3RvY29sKHNoYXJlZCwge2VuY29kZSwgZGVjb2RlfT1ub29wX2VuY29kaW5ncykgOjpcbiAgY29uc3Qge3N0YXRlRm9yLCBjcmVhdGVNdWx0aXBhcnQsIGNyZWF0ZVN0cmVhbX0gPSBzaGFyZWRcbiAgY29uc3Qge2FzQnVmZmVyfSA9IHNoYXJlZC5wYWNrZXRQYXJzZXJcblxuICByZXR1cm4gQHt9XG4gICAgcGFja0JvZHlcblxuICAgIGdldCBkYXRhZ3JhbSgpIDo6IHJldHVybiB0aGlzLmRpcmVjdFxuICAgIGRpcmVjdDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHBrdC5ib2R5X2J1ZmZlcigpXG4gICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1Ziwgc2lua1xuICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBwa3QuaW5mb1xuXG4gICAgbXVsdGlwYXJ0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RhdGVGb3IgQCBwa3QsIHNpbmssIGNyZWF0ZU11bHRpcGFydFxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHN0YXRlLmZlZWQocGt0KVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IGJvZHlfYnVmIDo6XG4gICAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGJvZHlfYnVmLCBzaW5rXG4gICAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgc3RhdGUuaW5mb1xuXG4gICAgc3RyZWFtaW5nOiBAe31cbiAgICAgIG1vZGU6ICdieXRlcydcbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RhdGVGb3IgQCBwa3QsIHNpbmssIGNyZWF0ZVN0cmVhbVxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHN0YXRlLmZlZWQocGt0LCBwa3RfYnVmZmVyKVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IGJvZHlfYnVmIDo6XG4gICAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGJvZHlfYnVmLCBzaW5rXG4gICAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgc3RhdGUuaW5mb1xuXG4gIGZ1bmN0aW9uIHBhY2tCb2R5KGJvZHksIG9iaiwgY2hhbikgOjpcbiAgICBjb25zdCBib2R5X2J1ZiA9IGFzQnVmZmVyIEAgYm9keVxuICAgIHJldHVybiBlbmNvZGUoYm9keV9idWYsIG9iaiwgY2hhbilcbiAgZnVuY3Rpb24gdW5wYWNrQm9keUJ1Zihib2R5X2J1Ziwgc2luaykgOjpcbiAgICByZXR1cm4gZGVjb2RlKGJvZHlfYnVmLCBzaW5rKVxuXG5mdW5jdGlvbiBwa3RfYnVmZmVyKHBrdCkgOjogcmV0dXJuIHBrdC5ib2R5X2J1ZmZlcigpXG5cbiIsImV4cG9ydCBkZWZhdWx0IGNvbnRyb2xfcHJvdG9jb2xcbmV4cG9ydCBmdW5jdGlvbiBjb250cm9sX3Byb3RvY29sKGluYm91bmQsIGhpZ2gsIHNoYXJlZCkgOjpcbiAgY29uc3Qge2Nob29zZUZyYW1pbmcsIHJhbmRvbV9pZH0gPSBzaGFyZWRcbiAgY29uc3Qge3BhY2tQYWNrZXRPYmp9ID0gc2hhcmVkLnBhY2tldFBhcnNlclxuXG4gIGNvbnN0IHBpbmdfZnJhbWUgPSBjaG9vc2VGcmFtaW5nIEA6IGZyb21faWQ6IHRydWUsIHRva2VuOiB0cnVlLCB0cmFuc3BvcnQ6ICdkaXJlY3QnXG4gIGNvbnN0IHBvbmdfZnJhbWUgPSBjaG9vc2VGcmFtaW5nIEA6IGZyb21faWQ6IHRydWUsIG1zZ2lkOiB0cnVlLCB0cmFuc3BvcnQ6ICdkYXRhZ3JhbSdcblxuICBjb25zdCBwb25nX3R5cGUgPSBoaWdofDB4ZVxuICBpbmJvdW5kW3BvbmdfdHlwZV0gPSByZWN2X3BvbmdcbiAgY29uc3QgcGluZ190eXBlID0gaGlnaHwweGZcbiAgaW5ib3VuZFtoaWdofDB4Zl0gPSByZWN2X3BpbmdcblxuICByZXR1cm4gQHt9IHNlbmQ6cGluZywgcGluZ1xuXG4gIGZ1bmN0aW9uIHBpbmcoY2hhbiwgb2JqKSA6OlxuICAgIGlmICEgb2JqLnRva2VuIDo6XG4gICAgICBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgIG9iai5ib2R5ID0gSlNPTi5zdHJpbmdpZnkgQDpcbiAgICAgIG9wOiAncGluZycsIHRzMDogbmV3IERhdGUoKVxuICAgIHBpbmdfZnJhbWUucGFjayhwaW5nX3R5cGUsIG9iailcbiAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgcmV0dXJuIGNoYW4gQCBwa3RcblxuICBmdW5jdGlvbiByZWN2X3BpbmcocGt0LCBzaW5rLCByb3V0ZXIpIDo6XG4gICAgcGluZ19mcmFtZS51bnBhY2socGt0KVxuICAgIHBrdC5ib2R5ID0gcGt0LmJvZHlfanNvbigpXG4gICAgX3NlbmRfcG9uZyBAIHBrdC5ib2R5LCBwa3QsIHJvdXRlclxuICAgIHJldHVybiBzaW5rLnJlY3ZDdHJsKHBrdC5ib2R5LCBwa3QuaW5mbylcblxuICBmdW5jdGlvbiBfc2VuZF9wb25nKHt0czB9LCBwa3RfcGluZywgcm91dGVyKSA6OlxuICAgIGNvbnN0IHttc2dpZCwgaWRfdGFyZ2V0LCBpZF9yb3V0ZXIsIGZyb21faWQ6cl9pZH0gPSBwa3RfcGluZy5pbmZvXG4gICAgY29uc3Qgb2JqID0gQHt9IG1zZ2lkXG4gICAgICBmcm9tX2lkOiBAe30gaWRfdGFyZ2V0LCBpZF9yb3V0ZXJcbiAgICAgIGlkX3JvdXRlcjogcl9pZC5pZF9yb3V0ZXIsIGlkX3RhcmdldDogcl9pZC5pZF90YXJnZXRcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5IEA6XG4gICAgICAgIG9wOiAncG9uZycsIHRzMCwgdHMxOiBuZXcgRGF0ZSgpXG5cbiAgICBwb25nX2ZyYW1lLnBhY2socG9uZ190eXBlLCBvYmopXG4gICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgIHJldHVybiByb3V0ZXIuZGlzcGF0Y2ggQCBbcGt0XVxuXG4gIGZ1bmN0aW9uIHJlY3ZfcG9uZyhwa3QsIHNpbmspIDo6XG4gICAgcG9uZ19mcmFtZS51bnBhY2socGt0KVxuICAgIHBrdC5ib2R5ID0gcGt0LmJvZHlfanNvbigpXG4gICAgcmV0dXJuIHNpbmsucmVjdkN0cmwocGt0LmJvZHksIHBrdC5pbmZvKVxuXG4iLCJpbXBvcnQgaW5pdF9zaGFyZWQgZnJvbSAnLi9zaGFyZWQvaW5kZXguanN5J1xuaW1wb3J0IGpzb25fcHJvdG9jb2wgZnJvbSAnLi9wcm90b2NvbHMvanNvbi5qc3knXG5pbXBvcnQgYmluYXJ5X3Byb3RvY29sIGZyb20gJy4vcHJvdG9jb2xzL2JpbmFyeS5qc3knXG5pbXBvcnQgY29udHJvbF9wcm90b2NvbCBmcm9tICcuL3Byb3RvY29scy9jb250cm9sLmpzeSdcblxuXG5jb25zdCBkZWZhdWx0X3BsdWdpbl9vcHRpb25zID0gQDpcbiAganNvbl9wYWNrOiBKU09OLnN0cmluZ2lmeVxuICBjdXN0b20ocHJvdG9jb2xzKSA6OiByZXR1cm4gcHJvdG9jb2xzXG5cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGx1Z2luX29wdGlvbnMpIDo6XG4gIHBsdWdpbl9vcHRpb25zID0gT2JqZWN0LmFzc2lnbiBAIHt9LCBkZWZhdWx0X3BsdWdpbl9vcHRpb25zLCBwbHVnaW5fb3B0aW9uc1xuICBjb25zdCB7IHBsdWdpbl9uYW1lLCByYW5kb21faWQsIGpzb25fcGFjayB9ID0gcGx1Z2luX29wdGlvbnNcblxuICByZXR1cm4gQDogc3ViY2xhc3MsIG9yZGVyOiAtMSAvLyBkZXBlbmRlbnQgb24gcm91dGVyIHBsdWdpbidzICgtMikgcHJvdmlkaW5nIHBhY2tldFBhcnNlclxuICBcbiAgZnVuY3Rpb24gc3ViY2xhc3MoRmFicmljSHViX1BJLCBiYXNlcykgOjpcbiAgICBjb25zdCB7cGFja2V0UGFyc2VyfSA9IEZhYnJpY0h1Yl9QSS5wcm90b3R5cGVcbiAgICBpZiBudWxsPT1wYWNrZXRQYXJzZXIgfHwgISBwYWNrZXRQYXJzZXIuaXNQYWNrZXRQYXJzZXIoKSA6OlxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvciBAIGBJbnZhbGlkIHBhY2tldFBhcnNlciBmb3IgcGx1Z2luYFxuICAgIFxuICAgIGNvbnN0IHByb3RvY29scyA9IHBsdWdpbl9vcHRpb25zLmN1c3RvbSBAXG4gICAgICBpbml0X3Byb3RvY29scyBAIHBhY2tldFBhcnNlciwgQHt9IHJhbmRvbV9pZCwganNvbl9wYWNrXG5cbiAgICBGYWJyaWNIdWJfUEkucHJvdG90eXBlLnByb3RvY29scyA9IHByb3RvY29sc1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0X3Byb3RvY29scyhwYWNrZXRQYXJzZXIsIG9wdGlvbnMpIDo6XG4gIGNvbnN0IHNoYXJlZCA9IGluaXRfc2hhcmVkIEAgcGFja2V0UGFyc2VyLCBvcHRpb25zXG5cbiAgY29uc3QgaW5ib3VuZCA9IFtdXG4gIGNvbnN0IGpzb24gPSBzaGFyZWQuYmluZFRyYW5zcG9ydHMgQCBpbmJvdW5kXG4gICAgMHgwMCAvLyAweDAqIOKAlCBKU09OIGJvZHlcbiAgICBqc29uX3Byb3RvY29sKHNoYXJlZClcblxuICBjb25zdCBiaW5hcnkgPSBzaGFyZWQuYmluZFRyYW5zcG9ydHMgQCBpbmJvdW5kXG4gICAgMHgxMCAvLyAweDEqIOKAlCBiaW5hcnkgYm9keVxuICAgIGJpbmFyeV9wcm90b2NvbChzaGFyZWQpXG5cbiAgY29uc3QgY29udHJvbCA9IGNvbnRyb2xfcHJvdG9jb2wgQCBpbmJvdW5kLFxuICAgIDB4ZjAgLy8gMHhmKiDigJQgY29udHJvbFxuICAgIHNoYXJlZFxuXG4gIGNvbnN0IGNvZGVjcyA9IEA6IGpzb24sIGJpbmFyeSwgY29udHJvbCwgZGVmYXVsdDoganNvblxuXG4gIHJldHVybiBAe30gaW5ib3VuZCwgY29kZWNzLCBzaGFyZWQsIHJhbmRvbV9pZDogc2hhcmVkLnJhbmRvbV9pZFxuXG4iLCJpbXBvcnQgcGx1Z2luIGZyb20gJy4vcGx1Z2luLmpzeSdcblxuY29uc3QgZ2V0UmFuZG9tVmFsdWVzID0gJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiB3aW5kb3dcbiAgPyB3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyA6IG51bGxcblxucHJvdG9jb2xzX2Jyb3dzZXIucmFuZG9tX2lkID0gcmFuZG9tX2lkXG5mdW5jdGlvbiByYW5kb21faWQoKSA6OlxuICBjb25zdCBhcnIgPSBuZXcgSW50MzJBcnJheSgxKVxuICBnZXRSYW5kb21WYWx1ZXMoYXJyKVxuICByZXR1cm4gYXJyWzBdXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHByb3RvY29sc19icm93c2VyKHBsdWdpbl9vcHRpb25zPXt9KSA6OlxuICBpZiBudWxsID09IHBsdWdpbl9vcHRpb25zLnJhbmRvbV9pZCA6OlxuICAgIHBsdWdpbl9vcHRpb25zLnJhbmRvbV9pZCA9IHJhbmRvbV9pZFxuXG4gIHJldHVybiBwbHVnaW4ocGx1Z2luX29wdGlvbnMpXG5cbiJdLCJuYW1lcyI6WyJsaXR0bGVfZW5kaWFuIiwiY19zaW5nbGUiLCJjX2RhdGFncmFtIiwiY19kaXJlY3QiLCJjX211bHRpcGFydCIsImNfc3RyZWFtaW5nIiwiX2Vycl9tc2dpZF9yZXF1aXJlZCIsIl9lcnJfdG9rZW5fcmVxdWlyZWQiLCJmcm1fcm91dGluZyIsInNpemUiLCJiaXRzIiwibWFzayIsIm9iaiIsImZyb21faWQiLCJkdiIsIm9mZnNldCIsInNldEludDMyIiwiaWRfcm91dGVyIiwiaWRfdGFyZ2V0IiwidW5kZWZpbmVkIiwiZ2V0SW50MzIiLCJmcm1fcmVzcG9uc2UiLCJtc2dpZCIsIkVycm9yIiwic2V0SW50MTYiLCJzZXFfYWNrIiwiYWNrX2ZsYWdzIiwidG9rZW4iLCJnZXRJbnQxNiIsImZybV9kYXRhZ3JhbSIsInRyYW5zcG9ydCIsImZybV9kaXJlY3QiLCJmcm1fbXVsdGlwYXJ0Iiwic2VxX3BvcyIsInNlcSIsInNlcV9mbGFncyIsImZybV9zdHJlYW1pbmciLCJiaW5kX3NlcV9uZXh0Iiwic2VxX29mZnNldCIsInNlcV9uZXh0IiwiZmxhZ3MiLCJmaW4iLCJOYU4iLCJjb21wb3NlRnJhbWluZ3MiLCJmcm1fZnJvbSIsImZybV9yZXNwIiwiZnJtX3RyYW5zcG9ydHMiLCJsZW5ndGgiLCJieUJpdHMiLCJ0X2Zyb20iLCJmX3Rlc3QiLCJ0X3Jlc3AiLCJ0MCIsInQxIiwidDIiLCJ0MyIsIm1hcCIsImYiLCJ0ZXN0Qml0cyIsImNob29zZSIsImxzdCIsIlQiLCJiIiwib3AiLCJmbl9rZXkiLCJmbl90cmFuIiwiZm5fZnJvbSIsImZuX3Jlc3AiLCJmcm0iLCJiaW5kQXNzZW1ibGVkIiwiZl9wYWNrIiwiZl91bnBhY2siLCJwYWNrIiwidW5wYWNrIiwicGt0X3R5cGUiLCJwa3Rfb2JqIiwiVHlwZUVycm9yIiwidHlwZSIsIkRhdGFWaWV3IiwiQXJyYXlCdWZmZXIiLCJoZWFkZXIiLCJidWZmZXIiLCJzbGljZSIsInBrdCIsImJ1ZiIsImhlYWRlcl9idWZmZXIiLCJVaW50OEFycmF5IiwiaW5mbyIsIl9iaW5kX2l0ZXJhYmxlIiwiYnVmX2Nsb25lIiwidHRsIiwibmV4dCIsIm9wdGlvbnMiLCJkb25lIiwidmFsdWUiLCJwYWNrZXRQYXJzZXIiLCJzaGFyZWQiLCJjb25jYXRCdWZmZXJzIiwiY3JlYXRlTXVsdGlwYXJ0Iiwic2luayIsImRlbGV0ZVN0YXRlIiwicGFydHMiLCJmZWVkIiwiYm9keV9idWZmZXIiLCJpbmNsdWRlcyIsInJlcyIsImNyZWF0ZVN0cmVhbSIsInJlY3ZEYXRhIiwicnN0cmVhbSIsInN0YXRlIiwiZmVlZF9pbml0IiwiYXNfY29udGVudCIsImZlZWRfaWdub3JlIiwibXNnIiwianNvbl91bnBhY2siLCJib2R5X3V0ZjgiLCJyZWN2U3RyZWFtIiwicmVjdlN0cmVhbURhdGEiLCJiaW5kIiwiZXJyIiwib25fZXJyb3IiLCJmZWVkX2JvZHkiLCJvbl9pbml0IiwiZGF0YSIsIm9uX2RhdGEiLCJvbl9lbmQiLCJmZWVkX3NlcSIsImNoZWNrX2ZucyIsImtleXMiLCJrZXkiLCJwYWNrUGFja2V0T2JqIiwicmFuZG9tX2lkIiwianNvbl9wYWNrIiwiY2hvb3NlRnJhbWluZyIsImZyYW1pbmdzIiwiZnJhZ21lbnRfc2l6ZSIsIk51bWJlciIsImJpbmRUcmFuc3BvcnRzIiwicGFja2V0RnJhZ21lbnRzIiwiaW5ib3VuZCIsImhpZ2hiaXRzIiwidHJhbnNwb3J0cyIsInBhY2tCb2R5Iiwib3V0Ym91bmQiLCJiaW5kVHJhbnNwb3J0SW1wbHMiLCJzdHJlYW1pbmciLCJzZW5kIiwic3RyZWFtIiwiYmluZFN0cmVhbSIsImNoYW4iLCJib2R5IiwiYnl0ZUxlbmd0aCIsIm1zZW5kIiwibXNlbmRfYnl0ZXMiLCJwYWNrX2hkciIsIm1zZW5kX29iamVjdHMiLCJtb2RlIiwibXNlbmRfaW1wbCIsIm9iamVjdCIsImJ5dGVzIiwid3JpdGUiLCJlbmQiLCJjaHVuayIsIm5leHRfaGRyIiwiaSIsImxhc3RJbm5lciIsImkwIiwiZnJhbWUiLCJpbXBsIiwidF9yZWN2IiwicmVjdl9tc2ciLCJpbml0X3NoYXJlZCIsIk9iamVjdCIsImFzc2lnbiIsInN0YXRlRm9yIiwibXVsdGlwYXJ0IiwiY3JlYXRlU3RhdGUiLCJieV9tc2dpZCIsImdldCIsImRlbGV0ZSIsInNldCIsIm5vb3BfZW5jb2RpbmdzIiwianNvbl9wcm90b2NvbCIsImVuY29kZSIsImRlY29kZSIsInBhY2tfdXRmOCIsInVucGFja191dGY4IiwiZGF0YWdyYW0iLCJkaXJlY3QiLCJqc29uX2J1ZiIsInVucGFja0JvZHlCdWYiLCJyZWN2TXNnIiwiYm9keV9idWYiLCJhc19qc29uX2NvbnRlbnQiLCJpZkFic2VudCIsImJpbmFyeV9wcm90b2NvbCIsImFzQnVmZmVyIiwicGt0X2J1ZmZlciIsImNvbnRyb2xfcHJvdG9jb2wiLCJoaWdoIiwicGluZ19mcmFtZSIsInBvbmdfZnJhbWUiLCJwb25nX3R5cGUiLCJyZWN2X3BvbmciLCJwaW5nX3R5cGUiLCJyZWN2X3BpbmciLCJwaW5nIiwiSlNPTiIsInN0cmluZ2lmeSIsInRzMCIsIkRhdGUiLCJyb3V0ZXIiLCJib2R5X2pzb24iLCJyZWN2Q3RybCIsIl9zZW5kX3BvbmciLCJwa3RfcGluZyIsInJfaWQiLCJ0czEiLCJkaXNwYXRjaCIsImRlZmF1bHRfcGx1Z2luX29wdGlvbnMiLCJwcm90b2NvbHMiLCJwbHVnaW5fb3B0aW9ucyIsInBsdWdpbl9uYW1lIiwic3ViY2xhc3MiLCJvcmRlciIsIkZhYnJpY0h1Yl9QSSIsImJhc2VzIiwicHJvdG90eXBlIiwiaXNQYWNrZXRQYXJzZXIiLCJjdXN0b20iLCJpbml0X3Byb3RvY29scyIsImpzb24iLCJiaW5hcnkiLCJjb250cm9sIiwiY29kZWNzIiwiZGVmYXVsdCIsImdldFJhbmRvbVZhbHVlcyIsIndpbmRvdyIsImNyeXB0byIsInByb3RvY29sc19icm93c2VyIiwiYXJy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
