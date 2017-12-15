import { randomBytes } from 'crypto';

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

    if ('production' !== process.env.NODE_ENV) {
      const op = pack_hdr.op = recv_msg.op = frame.op;
      Object.defineProperty(pack_hdr, 'name', { value: `pack_hdr «${op}»` });
      Object.defineProperty(recv_msg, 'name', { value: `recv_msg «${op}»` });
    }
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

protocols_nodejs.random_id = random_id;
function random_id() {
  return randomBytes(4).readInt32LE();
}

function protocols_nodejs(plugin_options = {}) {
  if (null == plugin_options.random_id) {
    plugin_options.random_id = random_id;
  }

  return plugin(plugin_options);
}

const getRandomValues = 'undefined' !== typeof window ? window.crypto.getRandomValues : null;

protocols_browser.random_id = random_id$1;
function random_id$1() {
  const arr = new Int32Array(1);
  getRandomValues(arr);
  return arr[0];
}

function protocols_browser(plugin_options = {}) {
  if (null == plugin_options.random_id) {
    plugin_options.random_id = random_id$1;
  }

  return plugin(plugin_options);
}

export { protocols_nodejs, protocols_browser, plugin as protocols, json_protocol$1 as json_protocol, binary_protocol$1 as binary_protocol, control_protocol$1 as control_protocol, init_protocols };
export default plugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgubWpzIiwic291cmNlcyI6WyIuLi9jb2RlL3NoYXJlZC9mcmFtaW5nLmpzeSIsIi4uL2NvZGUvc2hhcmVkL211bHRpcGFydC5qc3kiLCIuLi9jb2RlL3NoYXJlZC9zdHJlYW1pbmcuanN5IiwiLi4vY29kZS9zaGFyZWQvdHJhbnNwb3J0LmpzeSIsIi4uL2NvZGUvc2hhcmVkL2luZGV4LmpzeSIsIi4uL2NvZGUvcHJvdG9jb2xzL2pzb24uanN5IiwiLi4vY29kZS9wcm90b2NvbHMvYmluYXJ5LmpzeSIsIi4uL2NvZGUvcHJvdG9jb2xzL2NvbnRyb2wuanN5IiwiLi4vY29kZS9wbHVnaW4uanN5IiwiLi4vY29kZS9pbmRleC5ub2RlanMuanN5IiwiLi4vY29kZS9pbmRleC5icm93c2VyLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBsaXR0bGVfZW5kaWFuID0gdHJ1ZVxuY29uc3QgY19zaW5nbGUgPSAnc2luZ2xlJ1xuY29uc3QgY19kYXRhZ3JhbSA9ICdkYXRhZ3JhbSdcbmNvbnN0IGNfZGlyZWN0ID0gJ2RpcmVjdCdcbmNvbnN0IGNfbXVsdGlwYXJ0ID0gJ211bHRpcGFydCdcbmNvbnN0IGNfc3RyZWFtaW5nID0gJ3N0cmVhbWluZydcblxuY29uc3QgX2Vycl9tc2dpZF9yZXF1aXJlZCA9IGBSZXNwb25zZSByZXFpcmVzICdtc2dpZCdgXG5jb25zdCBfZXJyX3Rva2VuX3JlcXVpcmVkID0gYFRyYW5zcG9ydCByZXFpcmVzICd0b2tlbidgXG5cblxuZnVuY3Rpb24gZnJtX3JvdXRpbmcoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4MSwgbWFzayA9IDB4MVxuICByZXR1cm4gQHt9XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIG51bGwgIT0gb2JqLmZyb21faWQgPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBjb25zdCB7ZnJvbV9pZH0gPSBvYmpcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIDB8ZnJvbV9pZC5pZF9yb3V0ZXIsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDMyIEAgNCtvZmZzZXQsIDB8ZnJvbV9pZC5pZF90YXJnZXQsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGNvbnN0IGZyb21faWQgPSB1bmRlZmluZWQgPT09IG9iai5mcm9tX2lkXG4gICAgICAgID8gb2JqLmZyb21faWQgPSB7fSA6IG9iai5mcm9tX2lkXG4gICAgICBmcm9tX2lkLmlkX3JvdXRlciA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGZyb21faWQuaWRfdGFyZ2V0ID0gZHYuZ2V0SW50MzIgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuXG5mdW5jdGlvbiBmcm1fcmVzcG9uc2UoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4MiwgbWFzayA9IDB4MlxuICByZXR1cm4gQHt9XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIG51bGwgIT0gb2JqLm1zZ2lkID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoubXNnaWQgOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl9tc2dpZF9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLm1zZ2lkLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwfG9iai5zZXFfYWNrLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDYrb2Zmc2V0LCAwfG9iai5hY2tfZmxhZ3MsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai50b2tlbiA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXFfYWNrID0gZHYuZ2V0SW50MTYgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLmFja19mbGFncyA9IGR2LmdldEludDE2IEAgNitvZmZzZXQsIGxpdHRsZV9lbmRpYW5cblxuXG5cbmZ1bmN0aW9uIGZybV9kYXRhZ3JhbSgpIDo6XG4gIGNvbnN0IHNpemUgPSAwLCBiaXRzID0gMHgwLCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX2RhdGFncmFtXG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjpcbiAgICAgIGlmIGNfZGF0YWdyYW0gPT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGJpdHNcbiAgICAgIGlmIG9iai50cmFuc3BvcnQgJiYgY19zaW5nbGUgIT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGZhbHNlXG4gICAgICByZXR1cm4gISBvYmoudG9rZW4gPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19kYXRhZ3JhbVxuXG5mdW5jdGlvbiBmcm1fZGlyZWN0KCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDQsIGJpdHMgPSAweDQsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfZGlyZWN0XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjpcbiAgICAgIGlmIGNfZGlyZWN0ID09PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBiaXRzXG4gICAgICBpZiBvYmoudHJhbnNwb3J0ICYmIGNfc2luZ2xlICE9PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBmYWxzZVxuICAgICAgcmV0dXJuICEhIG9iai50b2tlbiA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLnRva2VuIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfdG9rZW5fcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai50b2tlbiwgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLm1zZ2lkID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfZGlyZWN0XG5cbmZ1bmN0aW9uIGZybV9tdWx0aXBhcnQoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4OCwgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19tdWx0aXBhcnRcbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gY19tdWx0aXBhcnQgPT09IG9iai50cmFuc3BvcnQgPyBiaXRzIDogZmFsc2VcblxuICAgIGJpbmRfc2VxX25leHQsIHNlcV9wb3M6IDRcbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoudG9rZW4gOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl90b2tlbl9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLnRva2VuLCBsaXR0bGVfZW5kaWFuXG4gICAgICBpZiB0cnVlID09IG9iai5zZXEgOjogLy8gdXNlIHNlcV9uZXh0XG4gICAgICAgIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDAsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGVsc2UgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMHxvYmouc2VxLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDYrb2Zmc2V0LCAwfG9iai5zZXFfZmxhZ3MsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai5tc2dpZCAgICAgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxICAgICAgID0gZHYuZ2V0SW50MTYgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcV9mbGFncyA9IGR2LmdldEludDE2IEAgNitvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX211bHRpcGFydFxuXG5mdW5jdGlvbiBmcm1fc3RyZWFtaW5nKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDgsIGJpdHMgPSAweGMsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfc3RyZWFtaW5nXG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIGNfc3RyZWFtaW5nID09PSBvYmoudHJhbnNwb3J0ID8gYml0cyA6IGZhbHNlXG5cbiAgICBiaW5kX3NlcV9uZXh0LCBzZXFfcG9zOiA0XG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLnRva2VuIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfdG9rZW5fcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai50b2tlbiwgbGl0dGxlX2VuZGlhblxuICAgICAgaWYgdHJ1ZSA9PSBvYmouc2VxIDo6XG4gICAgICAgIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDAsIGxpdHRsZV9lbmRpYW4gLy8gdXNlIHNlcV9uZXh0XG4gICAgICBlbHNlIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDB8b2JqLnNlcSwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCA2K29mZnNldCwgMHxvYmouc2VxX2ZsYWdzLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoubXNnaWQgICAgID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcSAgICAgICA9IGR2LmdldEludDE2IEAgNCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXFfZmxhZ3MgPSBkdi5nZXRJbnQxNiBAIDYrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19zdHJlYW1pbmdcblxuXG5mdW5jdGlvbiBiaW5kX3NlcV9uZXh0KG9mZnNldCkgOjpcbiAgY29uc3Qgc2VxX29mZnNldCA9IHRoaXMuc2VxX3BvcyArIG9mZnNldFxuICBsZXQgc2VxID0gMVxuICByZXR1cm4gZnVuY3Rpb24gc2VxX25leHQoe2ZsYWdzLCBmaW59LCBkdikgOjpcbiAgICBpZiAhIGZpbiA6OlxuICAgICAgZHYuc2V0SW50MTYgQCBzZXFfb2Zmc2V0LCBzZXErKywgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCAyK3NlcV9vZmZzZXQsIDB8ZmxhZ3MsIGxpdHRsZV9lbmRpYW5cbiAgICBlbHNlIDo6XG4gICAgICBkdi5zZXRJbnQxNiBAIHNlcV9vZmZzZXQsIC1zZXEsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgMitzZXFfb2Zmc2V0LCAwfGZsYWdzLCBsaXR0bGVfZW5kaWFuXG4gICAgICBzZXEgPSBOYU5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IGNvbXBvc2VGcmFtaW5ncygpXG5mdW5jdGlvbiBjb21wb3NlRnJhbWluZ3MoKSA6OlxuICBjb25zdCBmcm1fZnJvbSA9IGZybV9yb3V0aW5nKCksIGZybV9yZXNwID0gZnJtX3Jlc3BvbnNlKClcbiAgY29uc3QgZnJtX3RyYW5zcG9ydHMgPSBAW10gZnJtX2RhdGFncmFtKCksIGZybV9kaXJlY3QoKSwgZnJtX211bHRpcGFydCgpLCBmcm1fc3RyZWFtaW5nKClcblxuICBpZiA4ICE9PSBmcm1fZnJvbS5zaXplIHx8IDggIT09IGZybV9yZXNwLnNpemUgfHwgNCAhPSBmcm1fdHJhbnNwb3J0cy5sZW5ndGggOjpcbiAgICB0aHJvdyBuZXcgRXJyb3IgQCBgRnJhbWluZyBTaXplIGNoYW5nZWBcblxuICBjb25zdCBieUJpdHMgPSBbXSwgbWFzaz0weGZcblxuICA6OlxuICAgIGNvbnN0IHRfZnJvbSA9IGZybV9mcm9tLmZfdGVzdCwgdF9yZXNwID0gZnJtX3Jlc3AuZl90ZXN0XG4gICAgY29uc3QgW3QwLHQxLHQyLHQzXSA9IGZybV90cmFuc3BvcnRzLm1hcCBAIGY9PmYuZl90ZXN0XG5cbiAgICBjb25zdCB0ZXN0Qml0cyA9IGJ5Qml0cy50ZXN0Qml0cyA9IG9iaiA9PlxuICAgICAgMCB8IHRfZnJvbShvYmopIHwgdF9yZXNwKG9iaikgfCB0MChvYmopIHwgdDEob2JqKSB8IHQyKG9iaikgfCB0MyhvYmopXG5cbiAgICBieUJpdHMuY2hvb3NlID0gZnVuY3Rpb24gKG9iaiwgbHN0KSA6OlxuICAgICAgaWYgbnVsbCA9PSBsc3QgOjogbHN0ID0gdGhpcyB8fCBieUJpdHNcbiAgICAgIHJldHVybiBsc3RbdGVzdEJpdHMob2JqKV1cblxuXG4gIGZvciBjb25zdCBUIG9mIGZybV90cmFuc3BvcnRzIDo6XG4gICAgY29uc3Qge2JpdHM6Yiwgc2l6ZSwgdHJhbnNwb3J0fSA9IFRcblxuICAgIGJ5Qml0c1tifDBdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwwLCBtYXNrLCBzaXplOiBzaXplLCBvcDogJydcbiAgICBieUJpdHNbYnwxXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MSwgbWFzaywgc2l6ZTogOCArIHNpemUsIG9wOiAnZidcbiAgICBieUJpdHNbYnwyXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MiwgbWFzaywgc2l6ZTogOCArIHNpemUsIG9wOiAncidcbiAgICBieUJpdHNbYnwzXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MywgbWFzaywgc2l6ZTogMTYgKyBzaXplLCBvcDogJ2ZyJ1xuXG4gICAgZm9yIGNvbnN0IGZuX2tleSBvZiBbJ2ZfcGFjaycsICdmX3VucGFjayddIDo6XG4gICAgICBjb25zdCBmbl90cmFuID0gVFtmbl9rZXldLCBmbl9mcm9tID0gZnJtX2Zyb21bZm5fa2V5XSwgZm5fcmVzcCA9IGZybV9yZXNwW2ZuX2tleV1cblxuICAgICAgYnlCaXRzW2J8MF1bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX3RyYW4ob2JqLCBkdiwgMClcbiAgICAgIGJ5Qml0c1tifDFdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl9mcm9tKG9iaiwgZHYsIDApOyBmbl90cmFuKG9iaiwgZHYsIDgpXG4gICAgICBieUJpdHNbYnwyXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fcmVzcChvYmosIGR2LCAwKTsgZm5fdHJhbihvYmosIGR2LCA4KVxuICAgICAgYnlCaXRzW2J8M11bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX2Zyb20ob2JqLCBkdiwgMCk7IGZuX3Jlc3Aob2JqLCBkdiwgOCk7IGZuX3RyYW4ob2JqLCBkdiwgMTYpXG5cbiAgZm9yIGNvbnN0IGZybSBvZiBieUJpdHMgOjpcbiAgICBiaW5kQXNzZW1ibGVkIEAgZnJtXG5cbiAgcmV0dXJuIGJ5Qml0c1xuXG5cbmZ1bmN0aW9uIGJpbmRBc3NlbWJsZWQoZnJtKSA6OlxuICBjb25zdCB7VCwgc2l6ZSwgZl9wYWNrLCBmX3VucGFja30gPSBmcm1cbiAgaWYgVC5iaW5kX3NlcV9uZXh0IDo6XG4gICAgZnJtLnNlcV9uZXh0ID0gVC5iaW5kX3NlcV9uZXh0IEAgZnJtLnNpemUgLSBULnNpemVcblxuICBkZWxldGUgZnJtLlRcbiAgZnJtLnBhY2sgPSBwYWNrIDsgZnJtLnVucGFjayA9IHVucGFja1xuICBjb25zdCBzZXFfbmV4dCA9IGZybS5zZXFfbmV4dFxuXG4gIGZ1bmN0aW9uIHBhY2socGt0X3R5cGUsIHBrdF9vYmopIDo6XG4gICAgaWYgISBAIDAgPD0gcGt0X3R5cGUgJiYgcGt0X3R5cGUgPD0gMjU1IDo6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYEV4cGVjdGVkIHBrdF90eXBlIHRvIGJlIFswLi4yNTVdYFxuXG4gICAgcGt0X29iai50eXBlID0gcGt0X3R5cGVcbiAgICBpZiBzZXFfbmV4dCAmJiBudWxsID09IHBrdF9vYmouc2VxIDo6XG4gICAgICBwa3Rfb2JqLnNlcSA9IHRydWVcblxuICAgIGNvbnN0IGR2ID0gbmV3IERhdGFWaWV3IEAgbmV3IEFycmF5QnVmZmVyKHNpemUpXG4gICAgZl9wYWNrKHBrdF9vYmosIGR2LCAwKVxuICAgIHBrdF9vYmouaGVhZGVyID0gZHYuYnVmZmVyXG5cbiAgICBpZiB0cnVlID09PSBwa3Rfb2JqLnNlcSA6OlxuICAgICAgX2JpbmRfaXRlcmFibGUgQCBwa3Rfb2JqLCBkdi5idWZmZXIuc2xpY2UoMCxzaXplKVxuXG4gIGZ1bmN0aW9uIHVucGFjayhwa3QpIDo6XG4gICAgY29uc3QgYnVmID0gcGt0LmhlYWRlcl9idWZmZXIoKVxuICAgIGNvbnN0IGR2ID0gbmV3IERhdGFWaWV3IEAgbmV3IFVpbnQ4QXJyYXkoYnVmKS5idWZmZXJcblxuICAgIGNvbnN0IGluZm8gPSB7fVxuICAgIGZfdW5wYWNrKGluZm8sIGR2LCAwKVxuICAgIHJldHVybiBwa3QuaW5mbyA9IGluZm9cblxuICBmdW5jdGlvbiBfYmluZF9pdGVyYWJsZShwa3Rfb2JqLCBidWZfY2xvbmUpIDo6XG4gICAgY29uc3Qge3R5cGV9ID0gcGt0X29ialxuICAgIGNvbnN0IHtpZF9yb3V0ZXIsIGlkX3RhcmdldCwgdHRsLCB0b2tlbn0gPSBwa3Rfb2JqXG4gICAgcGt0X29iai5uZXh0ID0gbmV4dFxuXG4gICAgZnVuY3Rpb24gbmV4dChvcHRpb25zKSA6OlxuICAgICAgaWYgbnVsbCA9PSBvcHRpb25zIDo6IG9wdGlvbnMgPSB7fVxuICAgICAgY29uc3QgaGVhZGVyID0gYnVmX2Nsb25lLnNsaWNlKClcbiAgICAgIHNlcV9uZXh0IEAgb3B0aW9ucywgbmV3IERhdGFWaWV3IEAgaGVhZGVyXG4gICAgICByZXR1cm4gQHt9IGRvbmU6ICEhIG9wdGlvbnMuZmluLCB2YWx1ZTogQHt9IC8vIHBrdF9vYmpcbiAgICAgICAgaWRfcm91dGVyLCBpZF90YXJnZXQsIHR5cGUsIHR0bCwgdG9rZW4sIGhlYWRlclxuXG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwYWNrZXRQYXJzZXIsIHNoYXJlZCkgOjpcbiAgY29uc3Qge2NvbmNhdEJ1ZmZlcnN9ID0gcGFja2V0UGFyc2VyXG4gIHJldHVybiBAe30gY3JlYXRlTXVsdGlwYXJ0XG5cblxuICBmdW5jdGlvbiBjcmVhdGVNdWx0aXBhcnQocGt0LCBzaW5rLCBkZWxldGVTdGF0ZSkgOjpcbiAgICBsZXQgcGFydHMgPSBbXSwgZmluID0gZmFsc2VcbiAgICByZXR1cm4gQHt9IGZlZWQsIGluZm86IHBrdC5pbmZvXG5cbiAgICBmdW5jdGlvbiBmZWVkKHBrdCkgOjpcbiAgICAgIGxldCBzZXEgPSBwa3QuaW5mby5zZXFcbiAgICAgIGlmIHNlcSA8IDAgOjogZmluID0gdHJ1ZTsgc2VxID0gLXNlcVxuICAgICAgcGFydHNbc2VxLTFdID0gcGt0LmJvZHlfYnVmZmVyKClcblxuICAgICAgaWYgISBmaW4gOjogcmV0dXJuXG4gICAgICBpZiBwYXJ0cy5pbmNsdWRlcyBAIHVuZGVmaW5lZCA6OiByZXR1cm5cblxuICAgICAgZGVsZXRlU3RhdGUoKVxuXG4gICAgICBjb25zdCByZXMgPSBjb25jYXRCdWZmZXJzKHBhcnRzKVxuICAgICAgcGFydHMgPSBudWxsXG4gICAgICByZXR1cm4gcmVzXG5cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBhY2tldFBhcnNlciwgc2hhcmVkKSA6OlxuICByZXR1cm4gQHt9IGNyZWF0ZVN0cmVhbVxuXG5cbiAgZnVuY3Rpb24gY3JlYXRlU3RyZWFtKHBrdCwgc2luaywgZGVsZXRlU3RhdGUpIDo6XG4gICAgbGV0IG5leHQ9MCwgZmluID0gZmFsc2UsIHJlY3ZEYXRhLCByc3RyZWFtXG4gICAgY29uc3Qgc3RhdGUgPSBAe30gZmVlZDogZmVlZF9pbml0LCBpbmZvOiBwa3QuaW5mb1xuICAgIHJldHVybiBzdGF0ZVxuXG4gICAgZnVuY3Rpb24gZmVlZF9pbml0KHBrdCwgYXNfY29udGVudCkgOjpcbiAgICAgIHN0YXRlLmZlZWQgPSBmZWVkX2lnbm9yZVxuXG4gICAgICBjb25zdCBpbmZvID0gcGt0LmluZm9cbiAgICAgIGNvbnN0IG1zZyA9IHNpbmsuanNvbl91bnBhY2sgQCBwa3QuYm9keV91dGY4KClcbiAgICAgIHJzdHJlYW0gPSBzaW5rLnJlY3ZTdHJlYW0obXNnLCBpbmZvKVxuICAgICAgaWYgbnVsbCA9PSByc3RyZWFtIDo6IHJldHVyblxuICAgICAgY2hlY2tfZm5zIEAgcnN0cmVhbSwgJ29uX2Vycm9yJywgJ29uX2RhdGEnLCAnb25fZW5kJyBcbiAgICAgIHJlY3ZEYXRhID0gc2luay5yZWN2U3RyZWFtRGF0YS5iaW5kKHNpbmssIHJzdHJlYW0sIGluZm8pXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBmZWVkX3NlcShwa3QpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZXJyb3IgQCBlcnIsIHBrdFxuXG4gICAgICBzdGF0ZS5mZWVkID0gZmVlZF9ib2R5XG4gICAgICBpZiByc3RyZWFtLm9uX2luaXQgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25faW5pdChtc2csIHBrdClcblxuICAgIGZ1bmN0aW9uIGZlZWRfYm9keShwa3QsIGFzX2NvbnRlbnQpIDo6XG4gICAgICByZWN2RGF0YSgpXG4gICAgICBsZXQgZGF0YVxuICAgICAgdHJ5IDo6XG4gICAgICAgIGZlZWRfc2VxKHBrdClcbiAgICAgICAgZGF0YSA9IGFzX2NvbnRlbnQocGt0LCBzaW5rKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2Vycm9yIEAgZXJyLCBwa3RcblxuICAgICAgaWYgZmluIDo6XG4gICAgICAgIGNvbnN0IHJlcyA9IHJzdHJlYW0ub25fZGF0YSBAIGRhdGEsIHBrdFxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9lbmQgQCByZXMsIHBrdFxuICAgICAgZWxzZSA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9kYXRhIEAgZGF0YSwgcGt0XG5cbiAgICBmdW5jdGlvbiBmZWVkX2lnbm9yZShwa3QpIDo6XG4gICAgICB0cnkgOjogZmVlZF9zZXEocGt0KVxuICAgICAgY2F0Y2ggZXJyIDo6XG5cbiAgICBmdW5jdGlvbiBmZWVkX3NlcShwa3QpIDo6XG4gICAgICBsZXQgc2VxID0gcGt0LmluZm8uc2VxXG4gICAgICBpZiBzZXEgPj0gMCA6OlxuICAgICAgICBpZiBuZXh0KysgPT09IHNlcSA6OlxuICAgICAgICAgIHJldHVybiAvLyBpbiBvcmRlclxuICAgICAgZWxzZSA6OlxuICAgICAgICBmaW4gPSB0cnVlXG4gICAgICAgIGRlbGV0ZVN0YXRlKClcbiAgICAgICAgaWYgbmV4dCA9PT0gLXNlcSA6OlxuICAgICAgICAgIG5leHQgPSAnZG9uZSdcbiAgICAgICAgICByZXR1cm4gLy8gaW4tb3JkZXIsIGxhc3QgcGFja2V0XG5cbiAgICAgIHN0YXRlLmZlZWQgPSBmZWVkX2lnbm9yZVxuICAgICAgbmV4dCA9ICdpbnZhbGlkJ1xuICAgICAgdGhyb3cgbmV3IEVycm9yIEAgYFBhY2tldCBvdXQgb2Ygc2VxdWVuY2VgXG5cblxuZnVuY3Rpb24gY2hlY2tfZm5zKG9iaiwgLi4ua2V5cykgOjpcbiAgZm9yIGNvbnN0IGtleSBvZiBrZXlzIDo6XG4gICAgaWYgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG9ialtrZXldIDo6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYEV4cGVjdGVkIFwiJHtrZXl9XCIgdG8gYmUgYSBmdW5jdGlvbmBcblxuIiwiaW1wb3J0IGZyYW1pbmdzIGZyb20gJy4vZnJhbWluZy5qc3knXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBhY2tldFBhcnNlciwgc2hhcmVkKSA6OlxuICBjb25zdCB7cGFja1BhY2tldE9ian0gPSBwYWNrZXRQYXJzZXJcbiAgY29uc3Qge3JhbmRvbV9pZCwganNvbl9wYWNrfSA9IHNoYXJlZFxuICBjb25zdCB7Y2hvb3NlOiBjaG9vc2VGcmFtaW5nfSA9IGZyYW1pbmdzXG5cbiAgY29uc3QgZnJhZ21lbnRfc2l6ZSA9IE51bWJlciBAIHNoYXJlZC5mcmFnbWVudF9zaXplIHx8IDgwMDBcbiAgaWYgMTAyNCA+IGZyYWdtZW50X3NpemUgfHwgNjUwMDAgPCBmcmFnbWVudF9zaXplIDo6XG4gICAgdGhyb3cgbmV3IEVycm9yIEAgYEludmFsaWQgZnJhZ21lbnQgc2l6ZTogJHtmcmFnbWVudF9zaXplfWBcblxuICByZXR1cm4gQHt9IGJpbmRUcmFuc3BvcnRzLCBwYWNrZXRGcmFnbWVudHMsIGNob29zZUZyYW1pbmdcblxuXG4gIGZ1bmN0aW9uIGJpbmRUcmFuc3BvcnRzKGluYm91bmQsIGhpZ2hiaXRzLCB0cmFuc3BvcnRzKSA6OlxuICAgIGNvbnN0IHBhY2tCb2R5ID0gdHJhbnNwb3J0cy5wYWNrQm9keVxuICAgIGNvbnN0IG91dGJvdW5kID0gYmluZFRyYW5zcG9ydEltcGxzKGluYm91bmQsIGhpZ2hiaXRzLCB0cmFuc3BvcnRzKVxuXG4gICAgaWYgdHJhbnNwb3J0cy5zdHJlYW1pbmcgOjpcbiAgICAgIHJldHVybiBAe30gc2VuZCwgc3RyZWFtOiBiaW5kU3RyZWFtKClcblxuICAgIHJldHVybiBAe30gc2VuZFxuXG5cblxuICAgIGZ1bmN0aW9uIHNlbmQoY2hhbiwgb2JqLCBib2R5KSA6OlxuICAgICAgYm9keSA9IHBhY2tCb2R5KGJvZHksIG9iaiwgY2hhbilcbiAgICAgIGlmIGZyYWdtZW50X3NpemUgPCBib2R5LmJ5dGVMZW5ndGggOjpcbiAgICAgICAgaWYgISBvYmoudG9rZW4gOjogb2JqLnRva2VuID0gcmFuZG9tX2lkKClcbiAgICAgICAgb2JqLnRyYW5zcG9ydCA9ICdtdWx0aXBhcnQnXG4gICAgICAgIGNvbnN0IG1zZW5kID0gbXNlbmRfYnl0ZXMoY2hhbiwgb2JqKVxuICAgICAgICByZXR1cm4gbXNlbmQgQCB0cnVlLCBib2R5XG5cbiAgICAgIG9iai50cmFuc3BvcnQgPSAnc2luZ2xlJ1xuICAgICAgb2JqLmJvZHkgPSBib2R5XG4gICAgICBjb25zdCBwYWNrX2hkciA9IG91dGJvdW5kLmNob29zZShvYmopXG4gICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgcGFja19oZHIob2JqKVxuICAgICAgcmV0dXJuIGNoYW4uc2VuZCBAIHBrdFxuXG5cbiAgICBmdW5jdGlvbiBtc2VuZF9ieXRlcyhjaGFuLCBvYmosIG1zZykgOjpcbiAgICAgIGNvbnN0IHBhY2tfaGRyID0gb3V0Ym91bmQuY2hvb3NlKG9iailcbiAgICAgIGxldCB7bmV4dH0gPSBwYWNrX2hkcihvYmopXG4gICAgICBpZiBudWxsICE9PSBtc2cgOjpcbiAgICAgICAgb2JqLmJvZHkgPSBtc2dcbiAgICAgICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgICAgICBjaGFuLnNlbmQgQCBwa3RcblxuICAgICAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uIChmaW4sIGJvZHkpIDo6XG4gICAgICAgIGlmIG51bGwgPT09IG5leHQgOjpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgQCAnV3JpdGUgYWZ0ZXIgZW5kJ1xuICAgICAgICBsZXQgcmVzXG4gICAgICAgIGZvciBjb25zdCBvYmogb2YgcGFja2V0RnJhZ21lbnRzIEAgYm9keSwgbmV4dCwgZmluIDo6XG4gICAgICAgICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgICAgICAgIHJlcyA9IGF3YWl0IGNoYW4uc2VuZCBAIHBrdFxuICAgICAgICBpZiBmaW4gOjogbmV4dCA9IG51bGxcbiAgICAgICAgcmV0dXJuIHJlc1xuXG5cbiAgICBmdW5jdGlvbiBtc2VuZF9vYmplY3RzKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgY29uc3QgcGFja19oZHIgPSBvdXRib3VuZC5jaG9vc2Uob2JqKVxuICAgICAgbGV0IHtuZXh0fSA9IHBhY2tfaGRyKG9iailcbiAgICAgIGlmIG51bGwgIT09IG1zZyA6OlxuICAgICAgICBvYmouYm9keSA9IG1zZ1xuICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgIGNoYW4uc2VuZCBAIHBrdFxuXG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGZpbiwgYm9keSkgOjpcbiAgICAgICAgaWYgbnVsbCA9PT0gbmV4dCA6OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBAICdXcml0ZSBhZnRlciBlbmQnXG4gICAgICAgIGNvbnN0IG9iaiA9IG5leHQoe2Zpbn0pXG4gICAgICAgIG9iai5ib2R5ID0gYm9keVxuICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgIGlmIGZpbiA6OiBuZXh0ID0gbnVsbFxuICAgICAgICByZXR1cm4gY2hhbi5zZW5kIEAgcGt0XG5cblxuICAgIGZ1bmN0aW9uIGJpbmRTdHJlYW0oKSA6OlxuICAgICAgY29uc3Qge21vZGV9ID0gdHJhbnNwb3J0cy5zdHJlYW1pbmdcbiAgICAgIGNvbnN0IG1zZW5kX2ltcGwgPSB7b2JqZWN0OiBtc2VuZF9vYmplY3RzLCBieXRlczogbXNlbmRfYnl0ZXN9W21vZGVdXG4gICAgICBpZiBtc2VuZF9pbXBsIDo6IHJldHVybiBzdHJlYW1cblxuICAgICAgZnVuY3Rpb24gc3RyZWFtKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgICBpZiAhIG9iai50b2tlbiA6OiBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgICAgICBvYmoudHJhbnNwb3J0ID0gJ3N0cmVhbWluZydcbiAgICAgICAgY29uc3QgbXNlbmQgPSBtc2VuZF9pbXBsIEAgY2hhbiwgb2JqLCBqc29uX3BhY2sobXNnKVxuICAgICAgICB3cml0ZS53cml0ZSA9IHdyaXRlOyB3cml0ZS5lbmQgPSB3cml0ZS5iaW5kKHRydWUpXG4gICAgICAgIHJldHVybiB3cml0ZVxuXG4gICAgICAgIGZ1bmN0aW9uIHdyaXRlKGNodW5rKSA6OlxuICAgICAgICAgIC8vIG1zZW5kIEAgZmluLCBib2R5XG4gICAgICAgICAgcmV0dXJuIGNodW5rICE9IG51bGxcbiAgICAgICAgICAgID8gbXNlbmQgQCB0cnVlPT09dGhpcywgcGFja0JvZHkoY2h1bmssIG9iaiwgY2hhbilcbiAgICAgICAgICAgIDogbXNlbmQgQCB0cnVlXG5cblxuICBmdW5jdGlvbiAqIHBhY2tldEZyYWdtZW50cyhidWYsIG5leHRfaGRyLCBmaW4pIDo6XG4gICAgaWYgbnVsbCA9PSBidWYgOjpcbiAgICAgIGNvbnN0IG9iaiA9IG5leHRfaGRyKHtmaW59KVxuICAgICAgeWllbGQgb2JqXG4gICAgICByZXR1cm5cblxuICAgIGxldCBpID0gMCwgbGFzdElubmVyID0gYnVmLmJ5dGVMZW5ndGggLSBmcmFnbWVudF9zaXplO1xuICAgIHdoaWxlIGkgPCBsYXN0SW5uZXIgOjpcbiAgICAgIGNvbnN0IGkwID0gaVxuICAgICAgaSArPSBmcmFnbWVudF9zaXplXG5cbiAgICAgIGNvbnN0IG9iaiA9IG5leHRfaGRyKClcbiAgICAgIG9iai5ib2R5ID0gYnVmLnNsaWNlKGkwLCBpKVxuICAgICAgeWllbGQgb2JqXG5cbiAgICA6OlxuICAgICAgY29uc3Qgb2JqID0gbmV4dF9oZHIoe2Zpbn0pXG4gICAgICBvYmouYm9keSA9IGJ1Zi5zbGljZShpKVxuICAgICAgeWllbGQgb2JqXG5cblxuXG5cbi8vIG1vZHVsZS1sZXZlbCBoZWxwZXIgZnVuY3Rpb25zXG5cbmZ1bmN0aW9uIGJpbmRUcmFuc3BvcnRJbXBscyhpbmJvdW5kLCBoaWdoYml0cywgdHJhbnNwb3J0cykgOjpcbiAgY29uc3Qgb3V0Ym91bmQgPSBbXVxuICBvdXRib3VuZC5jaG9vc2UgPSBmcmFtaW5ncy5jaG9vc2VcblxuICBmb3IgY29uc3QgZnJhbWUgb2YgZnJhbWluZ3MgOjpcbiAgICBjb25zdCBpbXBsID0gZnJhbWUgPyB0cmFuc3BvcnRzW2ZyYW1lLnRyYW5zcG9ydF0gOiBudWxsXG4gICAgaWYgISBpbXBsIDo6IGNvbnRpbnVlXG5cbiAgICBjb25zdCB7Yml0cywgcGFjaywgdW5wYWNrfSA9IGZyYW1lXG4gICAgY29uc3QgcGt0X3R5cGUgPSBoaWdoYml0cyB8IGJpdHNcbiAgICBjb25zdCB7dF9yZWN2fSA9IGltcGxcblxuICAgIGZ1bmN0aW9uIHBhY2tfaGRyKG9iaikgOjpcbiAgICAgIHBhY2socGt0X3R5cGUsIG9iailcbiAgICAgIHJldHVybiBvYmpcblxuICAgIGZ1bmN0aW9uIHJlY3ZfbXNnKHBrdCwgc2luaykgOjpcbiAgICAgIHVucGFjayhwa3QpXG4gICAgICByZXR1cm4gdF9yZWN2KHBrdCwgc2luaylcblxuICAgIHBhY2tfaGRyLnBrdF90eXBlID0gcmVjdl9tc2cucGt0X3R5cGUgPSBwa3RfdHlwZVxuICAgIG91dGJvdW5kW2JpdHNdID0gcGFja19oZHJcbiAgICBpbmJvdW5kW3BrdF90eXBlXSA9IHJlY3ZfbXNnXG5cbiAgICBpZiAncHJvZHVjdGlvbicgIT09IHByb2Nlc3MuZW52Lk5PREVfRU5WIDo6XG4gICAgICBjb25zdCBvcCA9IHBhY2tfaGRyLm9wID0gcmVjdl9tc2cub3AgPSBmcmFtZS5vcFxuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEAgcGFja19oZHIsICduYW1lJywgQHt9IHZhbHVlOiBgcGFja19oZHIgwqske29wfcK7YFxuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEAgcmVjdl9tc2csICduYW1lJywgQHt9IHZhbHVlOiBgcmVjdl9tc2cgwqske29wfcK7YFxuXG4gIHJldHVybiBvdXRib3VuZFxuXG4iLCJleHBvcnQgKiBmcm9tICcuL2ZyYW1pbmcuanN5J1xuZXhwb3J0ICogZnJvbSAnLi9tdWx0aXBhcnQuanN5J1xuZXhwb3J0ICogZnJvbSAnLi9zdHJlYW1pbmcuanN5J1xuZXhwb3J0ICogZnJvbSAnLi90cmFuc3BvcnQuanN5J1xuXG5pbXBvcnQgbXVsdGlwYXJ0IGZyb20gJy4vbXVsdGlwYXJ0LmpzeSdcbmltcG9ydCBzdHJlYW1pbmcgZnJvbSAnLi9zdHJlYW1pbmcuanN5J1xuaW1wb3J0IHRyYW5zcG9ydCBmcm9tICcuL3RyYW5zcG9ydC5qc3knXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGluaXRfc2hhcmVkKHBhY2tldFBhcnNlciwgb3B0aW9ucykgOjpcbiAgY29uc3Qgc2hhcmVkID0gT2JqZWN0LmFzc2lnbiBAIHtwYWNrZXRQYXJzZXIsIHN0YXRlRm9yfSwgb3B0aW9uc1xuXG4gIE9iamVjdC5hc3NpZ24gQCBzaGFyZWQsXG4gICAgbXVsdGlwYXJ0IEAgcGFja2V0UGFyc2VyLCBzaGFyZWRcbiAgICBzdHJlYW1pbmcgQCBwYWNrZXRQYXJzZXIsIHNoYXJlZFxuICAgIHRyYW5zcG9ydCBAIHBhY2tldFBhcnNlciwgc2hhcmVkXG5cbiAgcmV0dXJuIHNoYXJlZFxuXG5mdW5jdGlvbiBzdGF0ZUZvcihwa3QsIHNpbmssIGNyZWF0ZVN0YXRlKSA6OlxuICBjb25zdCB7YnlfbXNnaWR9ID0gc2luaywge21zZ2lkfSA9IHBrdC5pbmZvXG4gIGxldCBzdGF0ZSA9IGJ5X21zZ2lkLmdldChtc2dpZClcbiAgaWYgdW5kZWZpbmVkID09PSBzdGF0ZSA6OlxuICAgIGlmICEgbXNnaWQgOjogdGhyb3cgbmV3IEVycm9yIEAgYEludmFsaWQgbXNnaWQ6ICR7bXNnaWR9YFxuXG4gICAgc3RhdGUgPSBjcmVhdGVTdGF0ZSBAIHBrdCwgc2luaywgKCkgPT4gYnlfbXNnaWQuZGVsZXRlKG1zZ2lkKVxuICAgIGJ5X21zZ2lkLnNldCBAIG1zZ2lkLCBzdGF0ZVxuICByZXR1cm4gc3RhdGVcblxuIiwiY29uc3Qgbm9vcF9lbmNvZGluZ3MgPSBAe31cbiAgZW5jb2RlKGJ1Ziwgb2JqLCBjaGFuKSA6OiByZXR1cm4gYnVmXG4gIGRlY29kZShidWYsIHNpbmspIDo6IHJldHVybiBidWZcblxuZXhwb3J0IGRlZmF1bHQganNvbl9wcm90b2NvbFxuZXhwb3J0IGZ1bmN0aW9uIGpzb25fcHJvdG9jb2woc2hhcmVkLCB7ZW5jb2RlLCBkZWNvZGV9PW5vb3BfZW5jb2RpbmdzKSA6OlxuICBjb25zdCB7c3RhdGVGb3IsIGNyZWF0ZU11bHRpcGFydCwgY3JlYXRlU3RyZWFtLCBqc29uX3BhY2t9ID0gc2hhcmVkXG4gIGNvbnN0IHtwYWNrX3V0ZjgsIHVucGFja191dGY4fSA9IHNoYXJlZC5wYWNrZXRQYXJzZXJcblxuICByZXR1cm4gQHt9XG4gICAgcGFja0JvZHlcblxuICAgIGdldCBkYXRhZ3JhbSgpIDo6IHJldHVybiB0aGlzLmRpcmVjdFxuICAgIGRpcmVjdDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBqc29uX2J1ZiA9IGRlY29kZSBAIHNpbmssIHBrdC5ib2R5X2J1ZmZlcigpXG4gICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBqc29uX2J1Ziwgc2lua1xuICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBwa3QuaW5mb1xuXG4gICAgbXVsdGlwYXJ0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RhdGVGb3IgQCBwa3QsIHNpbmssIGNyZWF0ZU11bHRpcGFydFxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHN0YXRlLmZlZWQocGt0KVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IGJvZHlfYnVmIDo6XG4gICAgICAgICAgY29uc3QganNvbl9idWYgPSBkZWNvZGUgQCBzaW5rLCBib2R5X2J1ZlxuICAgICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBqc29uX2J1Ziwgc2lua1xuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIHN0YXRlLmluZm9cblxuICAgIHN0cmVhbWluZzogQHt9XG4gICAgICBtb2RlOiAnb2JqZWN0J1xuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlU3RyZWFtXG4gICAgICAgIHJldHVybiBzdGF0ZS5mZWVkKHBrdCwgYXNfanNvbl9jb250ZW50KVxuXG4gIGZ1bmN0aW9uIHBhY2tCb2R5KGJvZHksIG9iaiwgY2hhbikgOjpcbiAgICBjb25zdCBib2R5X2J1ZiA9IHBhY2tfdXRmOCBAIGpzb25fcGFjayBAIGJvZHlcbiAgICByZXR1cm4gZW5jb2RlKGJvZHlfYnVmLCBvYmosIGNoYW4pXG5cbiAgZnVuY3Rpb24gYXNfanNvbl9jb250ZW50KHBrdCwgc2luaykgOjpcbiAgICByZXR1cm4gdW5wYWNrQm9keUJ1ZiBAIHBrdC5ib2R5X2J1ZmZlcigpLCBzaW5rLCBudWxsXG5cbiAgZnVuY3Rpb24gdW5wYWNrQm9keUJ1Zihib2R5X2J1Ziwgc2luaywgaWZBYnNlbnQpIDo6XG4gICAgY29uc3QganNvbl9idWYgPSBkZWNvZGUoYm9keV9idWYsIHNpbmspXG4gICAgcmV0dXJuIHNpbmsuanNvbl91bnBhY2sgQCBqc29uX2J1ZiA/IHVucGFja191dGY4KGpzb25fYnVmKSA6IGlmQWJzZW50XG5cbiIsImNvbnN0IG5vb3BfZW5jb2RpbmdzID0gQHt9XG4gIGVuY29kZShidWYsIG9iaiwgY2hhbikgOjogcmV0dXJuIGJ1ZlxuICBkZWNvZGUoYnVmLCBzaW5rKSA6OiByZXR1cm4gYnVmXG5cbmV4cG9ydCBkZWZhdWx0IGJpbmFyeV9wcm90b2NvbFxuZXhwb3J0IGZ1bmN0aW9uIGJpbmFyeV9wcm90b2NvbChzaGFyZWQsIHtlbmNvZGUsIGRlY29kZX09bm9vcF9lbmNvZGluZ3MpIDo6XG4gIGNvbnN0IHtzdGF0ZUZvciwgY3JlYXRlTXVsdGlwYXJ0LCBjcmVhdGVTdHJlYW19ID0gc2hhcmVkXG4gIGNvbnN0IHthc0J1ZmZlcn0gPSBzaGFyZWQucGFja2V0UGFyc2VyXG5cbiAgcmV0dXJuIEB7fVxuICAgIHBhY2tCb2R5XG5cbiAgICBnZXQgZGF0YWdyYW0oKSA6OiByZXR1cm4gdGhpcy5kaXJlY3RcbiAgICBkaXJlY3Q6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3QgYm9keV9idWYgPSBwa3QuYm9keV9idWZmZXIoKVxuICAgICAgICBjb25zdCBtc2cgPSB1bnBhY2tCb2R5QnVmIEAgYm9keV9idWYsIHNpbmtcbiAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgcGt0LmluZm9cblxuICAgIG11bHRpcGFydDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0YXRlRm9yIEAgcGt0LCBzaW5rLCBjcmVhdGVNdWx0aXBhcnRcbiAgICAgICAgY29uc3QgYm9keV9idWYgPSBzdGF0ZS5mZWVkKHBrdClcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBib2R5X2J1ZiA6OlxuICAgICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1Ziwgc2lua1xuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIHN0YXRlLmluZm9cblxuICAgIHN0cmVhbWluZzogQHt9XG4gICAgICBtb2RlOiAnYnl0ZXMnXG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0YXRlRm9yIEAgcGt0LCBzaW5rLCBjcmVhdGVTdHJlYW1cbiAgICAgICAgY29uc3QgYm9keV9idWYgPSBzdGF0ZS5mZWVkKHBrdCwgcGt0X2J1ZmZlcilcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBib2R5X2J1ZiA6OlxuICAgICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1Ziwgc2lua1xuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIHN0YXRlLmluZm9cblxuICBmdW5jdGlvbiBwYWNrQm9keShib2R5LCBvYmosIGNoYW4pIDo6XG4gICAgY29uc3QgYm9keV9idWYgPSBhc0J1ZmZlciBAIGJvZHlcbiAgICByZXR1cm4gZW5jb2RlKGJvZHlfYnVmLCBvYmosIGNoYW4pXG4gIGZ1bmN0aW9uIHVucGFja0JvZHlCdWYoYm9keV9idWYsIHNpbmspIDo6XG4gICAgcmV0dXJuIGRlY29kZShib2R5X2J1Ziwgc2luaylcblxuZnVuY3Rpb24gcGt0X2J1ZmZlcihwa3QpIDo6IHJldHVybiBwa3QuYm9keV9idWZmZXIoKVxuXG4iLCJleHBvcnQgZGVmYXVsdCBjb250cm9sX3Byb3RvY29sXG5leHBvcnQgZnVuY3Rpb24gY29udHJvbF9wcm90b2NvbChpbmJvdW5kLCBoaWdoLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtjaG9vc2VGcmFtaW5nLCByYW5kb21faWR9ID0gc2hhcmVkXG4gIGNvbnN0IHtwYWNrUGFja2V0T2JqfSA9IHNoYXJlZC5wYWNrZXRQYXJzZXJcblxuICBjb25zdCBwaW5nX2ZyYW1lID0gY2hvb3NlRnJhbWluZyBAOiBmcm9tX2lkOiB0cnVlLCB0b2tlbjogdHJ1ZSwgdHJhbnNwb3J0OiAnZGlyZWN0J1xuICBjb25zdCBwb25nX2ZyYW1lID0gY2hvb3NlRnJhbWluZyBAOiBmcm9tX2lkOiB0cnVlLCBtc2dpZDogdHJ1ZSwgdHJhbnNwb3J0OiAnZGF0YWdyYW0nXG5cbiAgY29uc3QgcG9uZ190eXBlID0gaGlnaHwweGVcbiAgaW5ib3VuZFtwb25nX3R5cGVdID0gcmVjdl9wb25nXG4gIGNvbnN0IHBpbmdfdHlwZSA9IGhpZ2h8MHhmXG4gIGluYm91bmRbaGlnaHwweGZdID0gcmVjdl9waW5nXG5cbiAgcmV0dXJuIEB7fSBzZW5kOnBpbmcsIHBpbmdcblxuICBmdW5jdGlvbiBwaW5nKGNoYW4sIG9iaikgOjpcbiAgICBpZiAhIG9iai50b2tlbiA6OlxuICAgICAgb2JqLnRva2VuID0gcmFuZG9tX2lkKClcbiAgICBvYmouYm9keSA9IEpTT04uc3RyaW5naWZ5IEA6XG4gICAgICBvcDogJ3BpbmcnLCB0czA6IG5ldyBEYXRlKClcbiAgICBwaW5nX2ZyYW1lLnBhY2socGluZ190eXBlLCBvYmopXG4gICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgIHJldHVybiBjaGFuIEAgcGt0XG5cbiAgZnVuY3Rpb24gcmVjdl9waW5nKHBrdCwgc2luaywgcm91dGVyKSA6OlxuICAgIHBpbmdfZnJhbWUudW5wYWNrKHBrdClcbiAgICBwa3QuYm9keSA9IHBrdC5ib2R5X2pzb24oKVxuICAgIF9zZW5kX3BvbmcgQCBwa3QuYm9keSwgcGt0LCByb3V0ZXJcbiAgICByZXR1cm4gc2luay5yZWN2Q3RybChwa3QuYm9keSwgcGt0LmluZm8pXG5cbiAgZnVuY3Rpb24gX3NlbmRfcG9uZyh7dHMwfSwgcGt0X3BpbmcsIHJvdXRlcikgOjpcbiAgICBjb25zdCB7bXNnaWQsIGlkX3RhcmdldCwgaWRfcm91dGVyLCBmcm9tX2lkOnJfaWR9ID0gcGt0X3BpbmcuaW5mb1xuICAgIGNvbnN0IG9iaiA9IEB7fSBtc2dpZFxuICAgICAgZnJvbV9pZDogQHt9IGlkX3RhcmdldCwgaWRfcm91dGVyXG4gICAgICBpZF9yb3V0ZXI6IHJfaWQuaWRfcm91dGVyLCBpZF90YXJnZXQ6IHJfaWQuaWRfdGFyZ2V0XG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSBAOlxuICAgICAgICBvcDogJ3BvbmcnLCB0czAsIHRzMTogbmV3IERhdGUoKVxuXG4gICAgcG9uZ19mcmFtZS5wYWNrKHBvbmdfdHlwZSwgb2JqKVxuICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICByZXR1cm4gcm91dGVyLmRpc3BhdGNoIEAgW3BrdF1cblxuICBmdW5jdGlvbiByZWN2X3BvbmcocGt0LCBzaW5rKSA6OlxuICAgIHBvbmdfZnJhbWUudW5wYWNrKHBrdClcbiAgICBwa3QuYm9keSA9IHBrdC5ib2R5X2pzb24oKVxuICAgIHJldHVybiBzaW5rLnJlY3ZDdHJsKHBrdC5ib2R5LCBwa3QuaW5mbylcblxuIiwiaW1wb3J0IGluaXRfc2hhcmVkIGZyb20gJy4vc2hhcmVkL2luZGV4LmpzeSdcbmltcG9ydCBqc29uX3Byb3RvY29sIGZyb20gJy4vcHJvdG9jb2xzL2pzb24uanN5J1xuaW1wb3J0IGJpbmFyeV9wcm90b2NvbCBmcm9tICcuL3Byb3RvY29scy9iaW5hcnkuanN5J1xuaW1wb3J0IGNvbnRyb2xfcHJvdG9jb2wgZnJvbSAnLi9wcm90b2NvbHMvY29udHJvbC5qc3knXG5cblxuY29uc3QgZGVmYXVsdF9wbHVnaW5fb3B0aW9ucyA9IEA6XG4gIGpzb25fcGFjazogSlNPTi5zdHJpbmdpZnlcbiAgY3VzdG9tKHByb3RvY29scykgOjogcmV0dXJuIHByb3RvY29sc1xuXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBsdWdpbl9vcHRpb25zKSA6OlxuICBwbHVnaW5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24gQCB7fSwgZGVmYXVsdF9wbHVnaW5fb3B0aW9ucywgcGx1Z2luX29wdGlvbnNcbiAgY29uc3QgeyBwbHVnaW5fbmFtZSwgcmFuZG9tX2lkLCBqc29uX3BhY2sgfSA9IHBsdWdpbl9vcHRpb25zXG5cbiAgcmV0dXJuIEA6IHN1YmNsYXNzLCBvcmRlcjogLTEgLy8gZGVwZW5kZW50IG9uIHJvdXRlciBwbHVnaW4ncyAoLTIpIHByb3ZpZGluZyBwYWNrZXRQYXJzZXJcbiAgXG4gIGZ1bmN0aW9uIHN1YmNsYXNzKEZhYnJpY0h1Yl9QSSwgYmFzZXMpIDo6XG4gICAgY29uc3Qge3BhY2tldFBhcnNlcn0gPSBGYWJyaWNIdWJfUEkucHJvdG90eXBlXG4gICAgaWYgbnVsbD09cGFja2V0UGFyc2VyIHx8ICEgcGFja2V0UGFyc2VyLmlzUGFja2V0UGFyc2VyKCkgOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgSW52YWxpZCBwYWNrZXRQYXJzZXIgZm9yIHBsdWdpbmBcbiAgICBcbiAgICBjb25zdCBwcm90b2NvbHMgPSBwbHVnaW5fb3B0aW9ucy5jdXN0b20gQFxuICAgICAgaW5pdF9wcm90b2NvbHMgQCBwYWNrZXRQYXJzZXIsIEB7fSByYW5kb21faWQsIGpzb25fcGFja1xuXG4gICAgRmFicmljSHViX1BJLnByb3RvdHlwZS5wcm90b2NvbHMgPSBwcm90b2NvbHNcblxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdF9wcm90b2NvbHMocGFja2V0UGFyc2VyLCBvcHRpb25zKSA6OlxuICBjb25zdCBzaGFyZWQgPSBpbml0X3NoYXJlZCBAIHBhY2tldFBhcnNlciwgb3B0aW9uc1xuXG4gIGNvbnN0IGluYm91bmQgPSBbXVxuICBjb25zdCBqc29uID0gc2hhcmVkLmJpbmRUcmFuc3BvcnRzIEAgaW5ib3VuZFxuICAgIDB4MDAgLy8gMHgwKiDigJQgSlNPTiBib2R5XG4gICAganNvbl9wcm90b2NvbChzaGFyZWQpXG5cbiAgY29uc3QgYmluYXJ5ID0gc2hhcmVkLmJpbmRUcmFuc3BvcnRzIEAgaW5ib3VuZFxuICAgIDB4MTAgLy8gMHgxKiDigJQgYmluYXJ5IGJvZHlcbiAgICBiaW5hcnlfcHJvdG9jb2woc2hhcmVkKVxuXG4gIGNvbnN0IGNvbnRyb2wgPSBjb250cm9sX3Byb3RvY29sIEAgaW5ib3VuZCxcbiAgICAweGYwIC8vIDB4Ziog4oCUIGNvbnRyb2xcbiAgICBzaGFyZWRcblxuICBjb25zdCBjb2RlY3MgPSBAOiBqc29uLCBiaW5hcnksIGNvbnRyb2wsIGRlZmF1bHQ6IGpzb25cblxuICByZXR1cm4gQHt9IGluYm91bmQsIGNvZGVjcywgc2hhcmVkLCByYW5kb21faWQ6IHNoYXJlZC5yYW5kb21faWRcblxuIiwiaW1wb3J0IHtyYW5kb21CeXRlc30gZnJvbSAnY3J5cHRvJ1xuaW1wb3J0IHBsdWdpbiBmcm9tICcuL3BsdWdpbi5qc3knXG5cbnByb3RvY29sc19ub2RlanMucmFuZG9tX2lkID0gcmFuZG9tX2lkXG5mdW5jdGlvbiByYW5kb21faWQoKSA6OlxuICByZXR1cm4gcmFuZG9tQnl0ZXMoNCkucmVhZEludDMyTEUoKVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcm90b2NvbHNfbm9kZWpzKHBsdWdpbl9vcHRpb25zPXt9KSA6OlxuICBpZiBudWxsID09IHBsdWdpbl9vcHRpb25zLnJhbmRvbV9pZCA6OlxuICAgIHBsdWdpbl9vcHRpb25zLnJhbmRvbV9pZCA9IHJhbmRvbV9pZFxuXG4gIHJldHVybiBwbHVnaW4ocGx1Z2luX29wdGlvbnMpXG5cbiIsImltcG9ydCBwbHVnaW4gZnJvbSAnLi9wbHVnaW4uanN5J1xuXG5jb25zdCBnZXRSYW5kb21WYWx1ZXMgPSAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHdpbmRvd1xuICA/IHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzIDogbnVsbFxuXG5wcm90b2NvbHNfYnJvd3Nlci5yYW5kb21faWQgPSByYW5kb21faWRcbmZ1bmN0aW9uIHJhbmRvbV9pZCgpIDo6XG4gIGNvbnN0IGFyciA9IG5ldyBJbnQzMkFycmF5KDEpXG4gIGdldFJhbmRvbVZhbHVlcyhhcnIpXG4gIHJldHVybiBhcnJbMF1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcHJvdG9jb2xzX2Jyb3dzZXIocGx1Z2luX29wdGlvbnM9e30pIDo6XG4gIGlmIG51bGwgPT0gcGx1Z2luX29wdGlvbnMucmFuZG9tX2lkIDo6XG4gICAgcGx1Z2luX29wdGlvbnMucmFuZG9tX2lkID0gcmFuZG9tX2lkXG5cbiAgcmV0dXJuIHBsdWdpbihwbHVnaW5fb3B0aW9ucylcblxuIl0sIm5hbWVzIjpbImxpdHRsZV9lbmRpYW4iLCJjX3NpbmdsZSIsImNfZGF0YWdyYW0iLCJjX2RpcmVjdCIsImNfbXVsdGlwYXJ0IiwiY19zdHJlYW1pbmciLCJfZXJyX21zZ2lkX3JlcXVpcmVkIiwiX2Vycl90b2tlbl9yZXF1aXJlZCIsImZybV9yb3V0aW5nIiwic2l6ZSIsImJpdHMiLCJtYXNrIiwib2JqIiwiZnJvbV9pZCIsImR2Iiwib2Zmc2V0Iiwic2V0SW50MzIiLCJpZF9yb3V0ZXIiLCJpZF90YXJnZXQiLCJ1bmRlZmluZWQiLCJnZXRJbnQzMiIsImZybV9yZXNwb25zZSIsIm1zZ2lkIiwiRXJyb3IiLCJzZXRJbnQxNiIsInNlcV9hY2siLCJhY2tfZmxhZ3MiLCJ0b2tlbiIsImdldEludDE2IiwiZnJtX2RhdGFncmFtIiwidHJhbnNwb3J0IiwiZnJtX2RpcmVjdCIsImZybV9tdWx0aXBhcnQiLCJzZXFfcG9zIiwic2VxIiwic2VxX2ZsYWdzIiwiZnJtX3N0cmVhbWluZyIsImJpbmRfc2VxX25leHQiLCJzZXFfb2Zmc2V0Iiwic2VxX25leHQiLCJmbGFncyIsImZpbiIsIk5hTiIsImNvbXBvc2VGcmFtaW5ncyIsImZybV9mcm9tIiwiZnJtX3Jlc3AiLCJmcm1fdHJhbnNwb3J0cyIsImxlbmd0aCIsImJ5Qml0cyIsInRfZnJvbSIsImZfdGVzdCIsInRfcmVzcCIsInQwIiwidDEiLCJ0MiIsInQzIiwibWFwIiwiZiIsInRlc3RCaXRzIiwiY2hvb3NlIiwibHN0IiwiVCIsImIiLCJvcCIsImZuX2tleSIsImZuX3RyYW4iLCJmbl9mcm9tIiwiZm5fcmVzcCIsImZybSIsImJpbmRBc3NlbWJsZWQiLCJmX3BhY2siLCJmX3VucGFjayIsInBhY2siLCJ1bnBhY2siLCJwa3RfdHlwZSIsInBrdF9vYmoiLCJUeXBlRXJyb3IiLCJ0eXBlIiwiRGF0YVZpZXciLCJBcnJheUJ1ZmZlciIsImhlYWRlciIsImJ1ZmZlciIsInNsaWNlIiwicGt0IiwiYnVmIiwiaGVhZGVyX2J1ZmZlciIsIlVpbnQ4QXJyYXkiLCJpbmZvIiwiX2JpbmRfaXRlcmFibGUiLCJidWZfY2xvbmUiLCJ0dGwiLCJuZXh0Iiwib3B0aW9ucyIsImRvbmUiLCJ2YWx1ZSIsInBhY2tldFBhcnNlciIsInNoYXJlZCIsImNvbmNhdEJ1ZmZlcnMiLCJjcmVhdGVNdWx0aXBhcnQiLCJzaW5rIiwiZGVsZXRlU3RhdGUiLCJwYXJ0cyIsImZlZWQiLCJib2R5X2J1ZmZlciIsImluY2x1ZGVzIiwicmVzIiwiY3JlYXRlU3RyZWFtIiwicmVjdkRhdGEiLCJyc3RyZWFtIiwic3RhdGUiLCJmZWVkX2luaXQiLCJhc19jb250ZW50IiwiZmVlZF9pZ25vcmUiLCJtc2ciLCJqc29uX3VucGFjayIsImJvZHlfdXRmOCIsInJlY3ZTdHJlYW0iLCJyZWN2U3RyZWFtRGF0YSIsImJpbmQiLCJlcnIiLCJvbl9lcnJvciIsImZlZWRfYm9keSIsIm9uX2luaXQiLCJkYXRhIiwib25fZGF0YSIsIm9uX2VuZCIsImZlZWRfc2VxIiwiY2hlY2tfZm5zIiwia2V5cyIsImtleSIsInBhY2tQYWNrZXRPYmoiLCJyYW5kb21faWQiLCJqc29uX3BhY2siLCJjaG9vc2VGcmFtaW5nIiwiZnJhbWluZ3MiLCJmcmFnbWVudF9zaXplIiwiTnVtYmVyIiwiYmluZFRyYW5zcG9ydHMiLCJwYWNrZXRGcmFnbWVudHMiLCJpbmJvdW5kIiwiaGlnaGJpdHMiLCJ0cmFuc3BvcnRzIiwicGFja0JvZHkiLCJvdXRib3VuZCIsImJpbmRUcmFuc3BvcnRJbXBscyIsInN0cmVhbWluZyIsInNlbmQiLCJzdHJlYW0iLCJiaW5kU3RyZWFtIiwiY2hhbiIsImJvZHkiLCJieXRlTGVuZ3RoIiwibXNlbmQiLCJtc2VuZF9ieXRlcyIsInBhY2tfaGRyIiwibXNlbmRfb2JqZWN0cyIsIm1vZGUiLCJtc2VuZF9pbXBsIiwib2JqZWN0IiwiYnl0ZXMiLCJ3cml0ZSIsImVuZCIsImNodW5rIiwibmV4dF9oZHIiLCJpIiwibGFzdElubmVyIiwiaTAiLCJmcmFtZSIsImltcGwiLCJ0X3JlY3YiLCJyZWN2X21zZyIsInByb2Nlc3MiLCJlbnYiLCJOT0RFX0VOViIsImRlZmluZVByb3BlcnR5IiwiaW5pdF9zaGFyZWQiLCJPYmplY3QiLCJhc3NpZ24iLCJzdGF0ZUZvciIsIm11bHRpcGFydCIsImNyZWF0ZVN0YXRlIiwiYnlfbXNnaWQiLCJnZXQiLCJkZWxldGUiLCJzZXQiLCJub29wX2VuY29kaW5ncyIsImpzb25fcHJvdG9jb2wiLCJlbmNvZGUiLCJkZWNvZGUiLCJwYWNrX3V0ZjgiLCJ1bnBhY2tfdXRmOCIsImRhdGFncmFtIiwiZGlyZWN0IiwianNvbl9idWYiLCJ1bnBhY2tCb2R5QnVmIiwicmVjdk1zZyIsImJvZHlfYnVmIiwiYXNfanNvbl9jb250ZW50IiwiaWZBYnNlbnQiLCJiaW5hcnlfcHJvdG9jb2wiLCJhc0J1ZmZlciIsInBrdF9idWZmZXIiLCJjb250cm9sX3Byb3RvY29sIiwiaGlnaCIsInBpbmdfZnJhbWUiLCJwb25nX2ZyYW1lIiwicG9uZ190eXBlIiwicmVjdl9wb25nIiwicGluZ190eXBlIiwicmVjdl9waW5nIiwicGluZyIsIkpTT04iLCJzdHJpbmdpZnkiLCJ0czAiLCJEYXRlIiwicm91dGVyIiwiYm9keV9qc29uIiwicmVjdkN0cmwiLCJfc2VuZF9wb25nIiwicGt0X3BpbmciLCJyX2lkIiwidHMxIiwiZGlzcGF0Y2giLCJkZWZhdWx0X3BsdWdpbl9vcHRpb25zIiwicHJvdG9jb2xzIiwicGx1Z2luX29wdGlvbnMiLCJwbHVnaW5fbmFtZSIsInN1YmNsYXNzIiwib3JkZXIiLCJGYWJyaWNIdWJfUEkiLCJiYXNlcyIsInByb3RvdHlwZSIsImlzUGFja2V0UGFyc2VyIiwiY3VzdG9tIiwiaW5pdF9wcm90b2NvbHMiLCJqc29uIiwiYmluYXJ5IiwiY29udHJvbCIsImNvZGVjcyIsImRlZmF1bHQiLCJwcm90b2NvbHNfbm9kZWpzIiwicmFuZG9tQnl0ZXMiLCJyZWFkSW50MzJMRSIsInBsdWdpbiIsImdldFJhbmRvbVZhbHVlcyIsIndpbmRvdyIsImNyeXB0byIsInByb3RvY29sc19icm93c2VyIiwiYXJyIiwiSW50MzJBcnJheSJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxNQUFNQSxnQkFBZ0IsSUFBdEI7QUFDQSxNQUFNQyxXQUFXLFFBQWpCO0FBQ0EsTUFBTUMsYUFBYSxVQUFuQjtBQUNBLE1BQU1DLFdBQVcsUUFBakI7QUFDQSxNQUFNQyxjQUFjLFdBQXBCO0FBQ0EsTUFBTUMsY0FBYyxXQUFwQjs7QUFFQSxNQUFNQyxzQkFBdUIsMEJBQTdCO0FBQ0EsTUFBTUMsc0JBQXVCLDJCQUE3Qjs7QUFHQSxTQUFTQyxXQUFULEdBQXVCO1FBQ2ZDLE9BQU8sQ0FBYjtRQUFnQkMsT0FBTyxHQUF2QjtRQUE0QkMsT0FBTyxHQUFuQztTQUNPO1FBQUEsRUFDQ0QsSUFERCxFQUNPQyxJQURQOztXQUdFQyxHQUFQLEVBQVk7YUFBVSxRQUFRQSxJQUFJQyxPQUFaLEdBQXNCSCxJQUF0QixHQUE2QixLQUFwQztLQUhWOztXQUtFRSxHQUFQLEVBQVlF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
