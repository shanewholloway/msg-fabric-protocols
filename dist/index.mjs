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
  plugin_name: 'protocols',
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
    FabricHub_PI.prototype[plugin_name] = protocols;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgubWpzIiwic291cmNlcyI6WyIuLi9jb2RlL3NoYXJlZC9mcmFtaW5nLmpzeSIsIi4uL2NvZGUvc2hhcmVkL211bHRpcGFydC5qc3kiLCIuLi9jb2RlL3NoYXJlZC9zdHJlYW1pbmcuanN5IiwiLi4vY29kZS9zaGFyZWQvdHJhbnNwb3J0LmpzeSIsIi4uL2NvZGUvc2hhcmVkL2luZGV4LmpzeSIsIi4uL2NvZGUvcHJvdG9jb2xzL2pzb24uanN5IiwiLi4vY29kZS9wcm90b2NvbHMvYmluYXJ5LmpzeSIsIi4uL2NvZGUvcHJvdG9jb2xzL2NvbnRyb2wuanN5IiwiLi4vY29kZS9wbHVnaW4uanN5IiwiLi4vY29kZS9pbmRleC5ub2RlanMuanN5IiwiLi4vY29kZS9pbmRleC5icm93c2VyLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBsaXR0bGVfZW5kaWFuID0gdHJ1ZVxuY29uc3QgY19zaW5nbGUgPSAnc2luZ2xlJ1xuY29uc3QgY19kYXRhZ3JhbSA9ICdkYXRhZ3JhbSdcbmNvbnN0IGNfZGlyZWN0ID0gJ2RpcmVjdCdcbmNvbnN0IGNfbXVsdGlwYXJ0ID0gJ211bHRpcGFydCdcbmNvbnN0IGNfc3RyZWFtaW5nID0gJ3N0cmVhbWluZydcblxuY29uc3QgX2Vycl9tc2dpZF9yZXF1aXJlZCA9IGBSZXNwb25zZSByZXFpcmVzICdtc2dpZCdgXG5jb25zdCBfZXJyX3Rva2VuX3JlcXVpcmVkID0gYFRyYW5zcG9ydCByZXFpcmVzICd0b2tlbidgXG5cblxuZnVuY3Rpb24gZnJtX3JvdXRpbmcoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4MSwgbWFzayA9IDB4MVxuICByZXR1cm4gQHt9XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIG51bGwgIT0gb2JqLmZyb21faWQgPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBjb25zdCB7ZnJvbV9pZH0gPSBvYmpcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIDB8ZnJvbV9pZC5pZF9yb3V0ZXIsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDMyIEAgNCtvZmZzZXQsIDB8ZnJvbV9pZC5pZF90YXJnZXQsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGNvbnN0IGZyb21faWQgPSB1bmRlZmluZWQgPT09IG9iai5mcm9tX2lkXG4gICAgICAgID8gb2JqLmZyb21faWQgPSB7fSA6IG9iai5mcm9tX2lkXG4gICAgICBmcm9tX2lkLmlkX3JvdXRlciA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGZyb21faWQuaWRfdGFyZ2V0ID0gZHYuZ2V0SW50MzIgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuXG5mdW5jdGlvbiBmcm1fcmVzcG9uc2UoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4MiwgbWFzayA9IDB4MlxuICByZXR1cm4gQHt9XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIG51bGwgIT0gb2JqLm1zZ2lkID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoubXNnaWQgOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl9tc2dpZF9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLm1zZ2lkLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwfG9iai5zZXFfYWNrLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDYrb2Zmc2V0LCAwfG9iai5hY2tfZmxhZ3MsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai50b2tlbiA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXFfYWNrID0gZHYuZ2V0SW50MTYgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLmFja19mbGFncyA9IGR2LmdldEludDE2IEAgNitvZmZzZXQsIGxpdHRsZV9lbmRpYW5cblxuXG5cbmZ1bmN0aW9uIGZybV9kYXRhZ3JhbSgpIDo6XG4gIGNvbnN0IHNpemUgPSAwLCBiaXRzID0gMHgwLCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX2RhdGFncmFtXG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjpcbiAgICAgIGlmIGNfZGF0YWdyYW0gPT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGJpdHNcbiAgICAgIGlmIG9iai50cmFuc3BvcnQgJiYgY19zaW5nbGUgIT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGZhbHNlXG4gICAgICByZXR1cm4gISBvYmoudG9rZW4gPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19kYXRhZ3JhbVxuXG5mdW5jdGlvbiBmcm1fZGlyZWN0KCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDQsIGJpdHMgPSAweDQsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfZGlyZWN0XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjpcbiAgICAgIGlmIGNfZGlyZWN0ID09PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBiaXRzXG4gICAgICBpZiBvYmoudHJhbnNwb3J0ICYmIGNfc2luZ2xlICE9PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBmYWxzZVxuICAgICAgcmV0dXJuICEhIG9iai50b2tlbiA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLnRva2VuIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfdG9rZW5fcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai50b2tlbiwgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLm1zZ2lkID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfZGlyZWN0XG5cbmZ1bmN0aW9uIGZybV9tdWx0aXBhcnQoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4OCwgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19tdWx0aXBhcnRcbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gY19tdWx0aXBhcnQgPT09IG9iai50cmFuc3BvcnQgPyBiaXRzIDogZmFsc2VcblxuICAgIGJpbmRfc2VxX25leHQsIHNlcV9wb3M6IDRcbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoudG9rZW4gOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl90b2tlbl9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLnRva2VuLCBsaXR0bGVfZW5kaWFuXG4gICAgICBpZiB0cnVlID09IG9iai5zZXEgOjogLy8gdXNlIHNlcV9uZXh0XG4gICAgICAgIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDAsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGVsc2UgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMHxvYmouc2VxLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDYrb2Zmc2V0LCAwfG9iai5zZXFfZmxhZ3MsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai5tc2dpZCAgICAgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxICAgICAgID0gZHYuZ2V0SW50MTYgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcV9mbGFncyA9IGR2LmdldEludDE2IEAgNitvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX211bHRpcGFydFxuXG5mdW5jdGlvbiBmcm1fc3RyZWFtaW5nKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDgsIGJpdHMgPSAweGMsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfc3RyZWFtaW5nXG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIGNfc3RyZWFtaW5nID09PSBvYmoudHJhbnNwb3J0ID8gYml0cyA6IGZhbHNlXG5cbiAgICBiaW5kX3NlcV9uZXh0LCBzZXFfcG9zOiA0XG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLnRva2VuIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfdG9rZW5fcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai50b2tlbiwgbGl0dGxlX2VuZGlhblxuICAgICAgaWYgdHJ1ZSA9PSBvYmouc2VxIDo6XG4gICAgICAgIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDAsIGxpdHRsZV9lbmRpYW4gLy8gdXNlIHNlcV9uZXh0XG4gICAgICBlbHNlIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDB8b2JqLnNlcSwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCA2K29mZnNldCwgMHxvYmouc2VxX2ZsYWdzLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoubXNnaWQgICAgID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcSAgICAgICA9IGR2LmdldEludDE2IEAgNCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXFfZmxhZ3MgPSBkdi5nZXRJbnQxNiBAIDYrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19zdHJlYW1pbmdcblxuXG5mdW5jdGlvbiBiaW5kX3NlcV9uZXh0KG9mZnNldCkgOjpcbiAgY29uc3Qgc2VxX29mZnNldCA9IHRoaXMuc2VxX3BvcyArIG9mZnNldFxuICBsZXQgc2VxID0gMVxuICByZXR1cm4gZnVuY3Rpb24gc2VxX25leHQoe2ZsYWdzLCBmaW59LCBkdikgOjpcbiAgICBpZiAhIGZpbiA6OlxuICAgICAgZHYuc2V0SW50MTYgQCBzZXFfb2Zmc2V0LCBzZXErKywgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCAyK3NlcV9vZmZzZXQsIDB8ZmxhZ3MsIGxpdHRsZV9lbmRpYW5cbiAgICBlbHNlIDo6XG4gICAgICBkdi5zZXRJbnQxNiBAIHNlcV9vZmZzZXQsIC1zZXEsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgMitzZXFfb2Zmc2V0LCAwfGZsYWdzLCBsaXR0bGVfZW5kaWFuXG4gICAgICBzZXEgPSBOYU5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IGNvbXBvc2VGcmFtaW5ncygpXG5mdW5jdGlvbiBjb21wb3NlRnJhbWluZ3MoKSA6OlxuICBjb25zdCBmcm1fZnJvbSA9IGZybV9yb3V0aW5nKCksIGZybV9yZXNwID0gZnJtX3Jlc3BvbnNlKClcbiAgY29uc3QgZnJtX3RyYW5zcG9ydHMgPSBAW10gZnJtX2RhdGFncmFtKCksIGZybV9kaXJlY3QoKSwgZnJtX211bHRpcGFydCgpLCBmcm1fc3RyZWFtaW5nKClcblxuICBpZiA4ICE9PSBmcm1fZnJvbS5zaXplIHx8IDggIT09IGZybV9yZXNwLnNpemUgfHwgNCAhPSBmcm1fdHJhbnNwb3J0cy5sZW5ndGggOjpcbiAgICB0aHJvdyBuZXcgRXJyb3IgQCBgRnJhbWluZyBTaXplIGNoYW5nZWBcblxuICBjb25zdCBieUJpdHMgPSBbXSwgbWFzaz0weGZcblxuICA6OlxuICAgIGNvbnN0IHRfZnJvbSA9IGZybV9mcm9tLmZfdGVzdCwgdF9yZXNwID0gZnJtX3Jlc3AuZl90ZXN0XG4gICAgY29uc3QgW3QwLHQxLHQyLHQzXSA9IGZybV90cmFuc3BvcnRzLm1hcCBAIGY9PmYuZl90ZXN0XG5cbiAgICBjb25zdCB0ZXN0Qml0cyA9IGJ5Qml0cy50ZXN0Qml0cyA9IG9iaiA9PlxuICAgICAgMCB8IHRfZnJvbShvYmopIHwgdF9yZXNwKG9iaikgfCB0MChvYmopIHwgdDEob2JqKSB8IHQyKG9iaikgfCB0MyhvYmopXG5cbiAgICBieUJpdHMuY2hvb3NlID0gZnVuY3Rpb24gKG9iaiwgbHN0KSA6OlxuICAgICAgaWYgbnVsbCA9PSBsc3QgOjogbHN0ID0gdGhpcyB8fCBieUJpdHNcbiAgICAgIHJldHVybiBsc3RbdGVzdEJpdHMob2JqKV1cblxuXG4gIGZvciBjb25zdCBUIG9mIGZybV90cmFuc3BvcnRzIDo6XG4gICAgY29uc3Qge2JpdHM6Yiwgc2l6ZSwgdHJhbnNwb3J0fSA9IFRcblxuICAgIGJ5Qml0c1tifDBdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwwLCBtYXNrLCBzaXplOiBzaXplLCBvcDogJydcbiAgICBieUJpdHNbYnwxXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MSwgbWFzaywgc2l6ZTogOCArIHNpemUsIG9wOiAnZidcbiAgICBieUJpdHNbYnwyXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MiwgbWFzaywgc2l6ZTogOCArIHNpemUsIG9wOiAncidcbiAgICBieUJpdHNbYnwzXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MywgbWFzaywgc2l6ZTogMTYgKyBzaXplLCBvcDogJ2ZyJ1xuXG4gICAgZm9yIGNvbnN0IGZuX2tleSBvZiBbJ2ZfcGFjaycsICdmX3VucGFjayddIDo6XG4gICAgICBjb25zdCBmbl90cmFuID0gVFtmbl9rZXldLCBmbl9mcm9tID0gZnJtX2Zyb21bZm5fa2V5XSwgZm5fcmVzcCA9IGZybV9yZXNwW2ZuX2tleV1cblxuICAgICAgYnlCaXRzW2J8MF1bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX3RyYW4ob2JqLCBkdiwgMClcbiAgICAgIGJ5Qml0c1tifDFdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl9mcm9tKG9iaiwgZHYsIDApOyBmbl90cmFuKG9iaiwgZHYsIDgpXG4gICAgICBieUJpdHNbYnwyXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fcmVzcChvYmosIGR2LCAwKTsgZm5fdHJhbihvYmosIGR2LCA4KVxuICAgICAgYnlCaXRzW2J8M11bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX2Zyb20ob2JqLCBkdiwgMCk7IGZuX3Jlc3Aob2JqLCBkdiwgOCk7IGZuX3RyYW4ob2JqLCBkdiwgMTYpXG5cbiAgZm9yIGNvbnN0IGZybSBvZiBieUJpdHMgOjpcbiAgICBiaW5kQXNzZW1ibGVkIEAgZnJtXG5cbiAgcmV0dXJuIGJ5Qml0c1xuXG5cbmZ1bmN0aW9uIGJpbmRBc3NlbWJsZWQoZnJtKSA6OlxuICBjb25zdCB7VCwgc2l6ZSwgZl9wYWNrLCBmX3VucGFja30gPSBmcm1cbiAgaWYgVC5iaW5kX3NlcV9uZXh0IDo6XG4gICAgZnJtLnNlcV9uZXh0ID0gVC5iaW5kX3NlcV9uZXh0IEAgZnJtLnNpemUgLSBULnNpemVcblxuICBkZWxldGUgZnJtLlRcbiAgZnJtLnBhY2sgPSBwYWNrIDsgZnJtLnVucGFjayA9IHVucGFja1xuICBjb25zdCBzZXFfbmV4dCA9IGZybS5zZXFfbmV4dFxuXG4gIGZ1bmN0aW9uIHBhY2socGt0X3R5cGUsIHBrdF9vYmopIDo6XG4gICAgaWYgISBAIDAgPD0gcGt0X3R5cGUgJiYgcGt0X3R5cGUgPD0gMjU1IDo6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYEV4cGVjdGVkIHBrdF90eXBlIHRvIGJlIFswLi4yNTVdYFxuXG4gICAgcGt0X29iai50eXBlID0gcGt0X3R5cGVcbiAgICBpZiBzZXFfbmV4dCAmJiBudWxsID09IHBrdF9vYmouc2VxIDo6XG4gICAgICBwa3Rfb2JqLnNlcSA9IHRydWVcblxuICAgIGNvbnN0IGR2ID0gbmV3IERhdGFWaWV3IEAgbmV3IEFycmF5QnVmZmVyKHNpemUpXG4gICAgZl9wYWNrKHBrdF9vYmosIGR2LCAwKVxuICAgIHBrdF9vYmouaGVhZGVyID0gZHYuYnVmZmVyXG5cbiAgICBpZiB0cnVlID09PSBwa3Rfb2JqLnNlcSA6OlxuICAgICAgX2JpbmRfaXRlcmFibGUgQCBwa3Rfb2JqLCBkdi5idWZmZXIuc2xpY2UoMCxzaXplKVxuXG4gIGZ1bmN0aW9uIHVucGFjayhwa3QpIDo6XG4gICAgY29uc3QgYnVmID0gcGt0LmhlYWRlcl9idWZmZXIoKVxuICAgIGNvbnN0IGR2ID0gbmV3IERhdGFWaWV3IEAgbmV3IFVpbnQ4QXJyYXkoYnVmKS5idWZmZXJcblxuICAgIGNvbnN0IGluZm8gPSB7fVxuICAgIGZfdW5wYWNrKGluZm8sIGR2LCAwKVxuICAgIHJldHVybiBwa3QuaW5mbyA9IGluZm9cblxuICBmdW5jdGlvbiBfYmluZF9pdGVyYWJsZShwa3Rfb2JqLCBidWZfY2xvbmUpIDo6XG4gICAgY29uc3Qge3R5cGV9ID0gcGt0X29ialxuICAgIGNvbnN0IHtpZF9yb3V0ZXIsIGlkX3RhcmdldCwgdHRsLCB0b2tlbn0gPSBwa3Rfb2JqXG4gICAgcGt0X29iai5uZXh0ID0gbmV4dFxuXG4gICAgZnVuY3Rpb24gbmV4dChvcHRpb25zKSA6OlxuICAgICAgaWYgbnVsbCA9PSBvcHRpb25zIDo6IG9wdGlvbnMgPSB7fVxuICAgICAgY29uc3QgaGVhZGVyID0gYnVmX2Nsb25lLnNsaWNlKClcbiAgICAgIHNlcV9uZXh0IEAgb3B0aW9ucywgbmV3IERhdGFWaWV3IEAgaGVhZGVyXG4gICAgICByZXR1cm4gQHt9IGRvbmU6ICEhIG9wdGlvbnMuZmluLCB2YWx1ZTogQHt9IC8vIHBrdF9vYmpcbiAgICAgICAgaWRfcm91dGVyLCBpZF90YXJnZXQsIHR5cGUsIHR0bCwgdG9rZW4sIGhlYWRlclxuXG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwYWNrZXRQYXJzZXIsIHNoYXJlZCkgOjpcbiAgY29uc3Qge2NvbmNhdEJ1ZmZlcnN9ID0gcGFja2V0UGFyc2VyXG4gIHJldHVybiBAe30gY3JlYXRlTXVsdGlwYXJ0XG5cblxuICBmdW5jdGlvbiBjcmVhdGVNdWx0aXBhcnQocGt0LCBzaW5rLCBkZWxldGVTdGF0ZSkgOjpcbiAgICBsZXQgcGFydHMgPSBbXSwgZmluID0gZmFsc2VcbiAgICByZXR1cm4gQHt9IGZlZWQsIGluZm86IHBrdC5pbmZvXG5cbiAgICBmdW5jdGlvbiBmZWVkKHBrdCkgOjpcbiAgICAgIGxldCBzZXEgPSBwa3QuaW5mby5zZXFcbiAgICAgIGlmIHNlcSA8IDAgOjogZmluID0gdHJ1ZTsgc2VxID0gLXNlcVxuICAgICAgcGFydHNbc2VxLTFdID0gcGt0LmJvZHlfYnVmZmVyKClcblxuICAgICAgaWYgISBmaW4gOjogcmV0dXJuXG4gICAgICBpZiBwYXJ0cy5pbmNsdWRlcyBAIHVuZGVmaW5lZCA6OiByZXR1cm5cblxuICAgICAgZGVsZXRlU3RhdGUoKVxuXG4gICAgICBjb25zdCByZXMgPSBjb25jYXRCdWZmZXJzKHBhcnRzKVxuICAgICAgcGFydHMgPSBudWxsXG4gICAgICByZXR1cm4gcmVzXG5cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBhY2tldFBhcnNlciwgc2hhcmVkKSA6OlxuICByZXR1cm4gQHt9IGNyZWF0ZVN0cmVhbVxuXG5cbiAgZnVuY3Rpb24gY3JlYXRlU3RyZWFtKHBrdCwgc2luaywgZGVsZXRlU3RhdGUpIDo6XG4gICAgbGV0IG5leHQ9MCwgZmluID0gZmFsc2UsIHJlY3ZEYXRhLCByc3RyZWFtXG4gICAgY29uc3Qgc3RhdGUgPSBAe30gZmVlZDogZmVlZF9pbml0LCBpbmZvOiBwa3QuaW5mb1xuICAgIHJldHVybiBzdGF0ZVxuXG4gICAgZnVuY3Rpb24gZmVlZF9pbml0KHBrdCwgYXNfY29udGVudCwgbXNnX3VucGFjaykgOjpcbiAgICAgIHN0YXRlLmZlZWQgPSBmZWVkX2lnbm9yZVxuXG4gICAgICBjb25zdCBpbmZvID0gcGt0LmluZm9cbiAgICAgIGNvbnN0IG1zZyA9IG1zZ191bnBhY2tcbiAgICAgICAgPyBtc2dfdW5wYWNrKHBrdCwgc2luaylcbiAgICAgICAgOiBzaW5rLmpzb25fdW5wYWNrIEAgcGt0LmJvZHlfdXRmOCgpXG4gICAgICByc3RyZWFtID0gc2luay5yZWN2U3RyZWFtKG1zZywgaW5mbylcbiAgICAgIGlmIG51bGwgPT0gcnN0cmVhbSA6OiByZXR1cm5cbiAgICAgIGNoZWNrX2ZucyBAIHJzdHJlYW0sICdvbl9lcnJvcicsICdvbl9kYXRhJywgJ29uX2VuZCcgXG4gICAgICByZWN2RGF0YSA9IHNpbmsucmVjdlN0cmVhbURhdGEuYmluZChzaW5rLCByc3RyZWFtLCBpbmZvKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgZmVlZF9zZXEocGt0KVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2Vycm9yIEAgZXJyLCBwa3RcblxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfYm9keVxuICAgICAgaWYgcnN0cmVhbS5vbl9pbml0IDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2luaXQobXNnLCBwa3QpXG5cbiAgICBmdW5jdGlvbiBmZWVkX2JvZHkocGt0LCBhc19jb250ZW50KSA6OlxuICAgICAgcmVjdkRhdGEoKVxuICAgICAgbGV0IGRhdGFcbiAgICAgIHRyeSA6OlxuICAgICAgICBmZWVkX3NlcShwa3QpXG4gICAgICAgIGRhdGEgPSBhc19jb250ZW50KHBrdCwgc2luaylcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9lcnJvciBAIGVyciwgcGt0XG5cbiAgICAgIGlmIGZpbiA6OlxuICAgICAgICBjb25zdCByZXMgPSByc3RyZWFtLm9uX2RhdGEgQCBkYXRhLCBwa3RcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZW5kIEAgcmVzLCBwa3RcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZGF0YSBAIGRhdGEsIHBrdFxuXG4gICAgZnVuY3Rpb24gZmVlZF9pZ25vcmUocGt0KSA6OlxuICAgICAgdHJ5IDo6IGZlZWRfc2VxKHBrdClcbiAgICAgIGNhdGNoIGVyciA6OlxuXG4gICAgZnVuY3Rpb24gZmVlZF9zZXEocGt0KSA6OlxuICAgICAgbGV0IHNlcSA9IHBrdC5pbmZvLnNlcVxuICAgICAgaWYgc2VxID49IDAgOjpcbiAgICAgICAgaWYgbmV4dCsrID09PSBzZXEgOjpcbiAgICAgICAgICByZXR1cm4gLy8gaW4gb3JkZXJcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgZmluID0gdHJ1ZVxuICAgICAgICBkZWxldGVTdGF0ZSgpXG4gICAgICAgIGlmIG5leHQgPT09IC1zZXEgOjpcbiAgICAgICAgICBuZXh0ID0gJ2RvbmUnXG4gICAgICAgICAgcmV0dXJuIC8vIGluLW9yZGVyLCBsYXN0IHBhY2tldFxuXG4gICAgICBzdGF0ZS5mZWVkID0gZmVlZF9pZ25vcmVcbiAgICAgIG5leHQgPSAnaW52YWxpZCdcbiAgICAgIHRocm93IG5ldyBFcnJvciBAIGBQYWNrZXQgb3V0IG9mIHNlcXVlbmNlYFxuXG5cbmZ1bmN0aW9uIGNoZWNrX2ZucyhvYmosIC4uLmtleXMpIDo6XG4gIGZvciBjb25zdCBrZXkgb2Yga2V5cyA6OlxuICAgIGlmICdmdW5jdGlvbicgIT09IHR5cGVvZiBvYmpba2V5XSA6OlxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvciBAIGBFeHBlY3RlZCBcIiR7a2V5fVwiIHRvIGJlIGEgZnVuY3Rpb25gXG5cbiIsImltcG9ydCBmcmFtaW5ncyBmcm9tICcuL2ZyYW1pbmcuanN5J1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwYWNrZXRQYXJzZXIsIHNoYXJlZCkgOjpcbiAgY29uc3Qge3BhY2tQYWNrZXRPYmp9ID0gcGFja2V0UGFyc2VyXG4gIGNvbnN0IHtyYW5kb21faWQsIGpzb25fcGFja30gPSBzaGFyZWRcbiAgY29uc3Qge2Nob29zZTogY2hvb3NlRnJhbWluZ30gPSBmcmFtaW5nc1xuXG4gIGNvbnN0IGZyYWdtZW50X3NpemUgPSBOdW1iZXIgQCBzaGFyZWQuZnJhZ21lbnRfc2l6ZSB8fCA4MDAwXG4gIGlmIDEwMjQgPiBmcmFnbWVudF9zaXplIHx8IDY1MDAwIDwgZnJhZ21lbnRfc2l6ZSA6OlxuICAgIHRocm93IG5ldyBFcnJvciBAIGBJbnZhbGlkIGZyYWdtZW50IHNpemU6ICR7ZnJhZ21lbnRfc2l6ZX1gXG5cbiAgcmV0dXJuIEB7fSBiaW5kVHJhbnNwb3J0cywgcGFja2V0RnJhZ21lbnRzLCBjaG9vc2VGcmFtaW5nXG5cblxuICBmdW5jdGlvbiBiaW5kVHJhbnNwb3J0cyhpbmJvdW5kLCBoaWdoYml0cywgdHJhbnNwb3J0cykgOjpcbiAgICBjb25zdCBwYWNrQm9keSA9IHRyYW5zcG9ydHMucGFja0JvZHlcbiAgICBjb25zdCBvdXRib3VuZCA9IGJpbmRUcmFuc3BvcnRJbXBscyhpbmJvdW5kLCBoaWdoYml0cywgdHJhbnNwb3J0cylcblxuICAgIGlmIHRyYW5zcG9ydHMuc3RyZWFtaW5nIDo6XG4gICAgICByZXR1cm4gQHt9IHNlbmQsIHN0cmVhbTogYmluZFN0cmVhbSgpXG5cbiAgICByZXR1cm4gQHt9IHNlbmRcblxuXG5cbiAgICBmdW5jdGlvbiBzZW5kKGNoYW4sIG9iaiwgYm9keSkgOjpcbiAgICAgIGJvZHkgPSBwYWNrQm9keShib2R5LCBvYmosIGNoYW4pXG4gICAgICBpZiBmcmFnbWVudF9zaXplIDwgYm9keS5ieXRlTGVuZ3RoIDo6XG4gICAgICAgIGlmICEgb2JqLnRva2VuIDo6IG9iai50b2tlbiA9IHJhbmRvbV9pZCgpXG4gICAgICAgIG9iai50cmFuc3BvcnQgPSAnbXVsdGlwYXJ0J1xuICAgICAgICBjb25zdCBtc2VuZCA9IG1zZW5kX2J5dGVzKGNoYW4sIG9iailcbiAgICAgICAgcmV0dXJuIG1zZW5kIEAgdHJ1ZSwgYm9keVxuXG4gICAgICBvYmoudHJhbnNwb3J0ID0gJ3NpbmdsZSdcbiAgICAgIG9iai5ib2R5ID0gYm9keVxuICAgICAgY29uc3QgcGFja19oZHIgPSBvdXRib3VuZC5jaG9vc2Uob2JqKVxuICAgICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIHBhY2tfaGRyKG9iailcbiAgICAgIHJldHVybiBjaGFuLnNlbmQgQCBwa3RcblxuXG4gICAgZnVuY3Rpb24gbXNlbmRfYnl0ZXMoY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICBjb25zdCBwYWNrX2hkciA9IG91dGJvdW5kLmNob29zZShvYmopXG4gICAgICBsZXQge25leHR9ID0gcGFja19oZHIob2JqKVxuICAgICAgaWYgbnVsbCAhPT0gbXNnIDo6XG4gICAgICAgIG9iai5ib2R5ID0gbXNnXG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgY2hhbi5zZW5kIEAgcGt0XG5cbiAgICAgIHJldHVybiBhc3luYyBmdW5jdGlvbiAoZmluLCBib2R5KSA6OlxuICAgICAgICBpZiBudWxsID09PSBuZXh0IDo6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgJ1dyaXRlIGFmdGVyIGVuZCdcbiAgICAgICAgbGV0IHJlc1xuICAgICAgICBmb3IgY29uc3Qgb2JqIG9mIHBhY2tldEZyYWdtZW50cyBAIGJvZHksIG5leHQsIGZpbiA6OlxuICAgICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgICByZXMgPSBhd2FpdCBjaGFuLnNlbmQgQCBwa3RcbiAgICAgICAgaWYgZmluIDo6IG5leHQgPSBudWxsXG4gICAgICAgIHJldHVybiByZXNcblxuXG4gICAgZnVuY3Rpb24gbXNlbmRfb2JqZWN0cyhjaGFuLCBvYmosIG1zZykgOjpcbiAgICAgIGNvbnN0IHBhY2tfaGRyID0gb3V0Ym91bmQuY2hvb3NlKG9iailcbiAgICAgIGxldCB7bmV4dH0gPSBwYWNrX2hkcihvYmopXG4gICAgICBpZiBudWxsICE9PSBtc2cgOjpcbiAgICAgICAgb2JqLmJvZHkgPSBtc2dcbiAgICAgICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgICAgICBjaGFuLnNlbmQgQCBwa3RcblxuICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmaW4sIGJvZHkpIDo6XG4gICAgICAgIGlmIG51bGwgPT09IG5leHQgOjpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgQCAnV3JpdGUgYWZ0ZXIgZW5kJ1xuICAgICAgICBjb25zdCBvYmogPSBuZXh0KHtmaW59KVxuICAgICAgICBvYmouYm9keSA9IGJvZHlcbiAgICAgICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgICAgICBpZiBmaW4gOjogbmV4dCA9IG51bGxcbiAgICAgICAgcmV0dXJuIGNoYW4uc2VuZCBAIHBrdFxuXG5cbiAgICBmdW5jdGlvbiBiaW5kU3RyZWFtKCkgOjpcbiAgICAgIGNvbnN0IHttb2RlLCBtc2dfcGFja30gPSB0cmFuc3BvcnRzLnN0cmVhbWluZ1xuICAgICAgY29uc3QgbXNlbmRfaW1wbCA9IHtvYmplY3Q6IG1zZW5kX29iamVjdHMsIGJ5dGVzOiBtc2VuZF9ieXRlc31bbW9kZV1cbiAgICAgIGlmIG1zZW5kX2ltcGwgOjogcmV0dXJuIHN0cmVhbVxuXG4gICAgICBmdW5jdGlvbiBzdHJlYW0oY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICAgIGlmICEgb2JqLnRva2VuIDo6IG9iai50b2tlbiA9IHJhbmRvbV9pZCgpXG4gICAgICAgIG9iai50cmFuc3BvcnQgPSAnc3RyZWFtaW5nJ1xuICAgICAgICBtc2cgPSBtc2dfcGFja1xuICAgICAgICAgID8gbXNnX3BhY2sobXNnLCBvYmosIGNoYW4pXG4gICAgICAgICAgOiBqc29uX3BhY2sobXNnKVxuICAgICAgICBjb25zdCBtc2VuZCA9IG1zZW5kX2ltcGwgQCBjaGFuLCBvYmosIG1zZ1xuICAgICAgICB3cml0ZS53cml0ZSA9IHdyaXRlOyB3cml0ZS5lbmQgPSB3cml0ZS5iaW5kKHRydWUpXG4gICAgICAgIHJldHVybiB3cml0ZVxuXG4gICAgICAgIGZ1bmN0aW9uIHdyaXRlKGNodW5rKSA6OlxuICAgICAgICAgIC8vIG1zZW5kIEAgZmluLCBib2R5XG4gICAgICAgICAgcmV0dXJuIGNodW5rICE9IG51bGxcbiAgICAgICAgICAgID8gbXNlbmQgQCB0cnVlPT09dGhpcywgcGFja0JvZHkoY2h1bmssIG9iaiwgY2hhbilcbiAgICAgICAgICAgIDogbXNlbmQgQCB0cnVlXG5cblxuICBmdW5jdGlvbiAqIHBhY2tldEZyYWdtZW50cyhidWYsIG5leHRfaGRyLCBmaW4pIDo6XG4gICAgaWYgbnVsbCA9PSBidWYgOjpcbiAgICAgIGNvbnN0IG9iaiA9IG5leHRfaGRyKHtmaW59KVxuICAgICAgeWllbGQgb2JqXG4gICAgICByZXR1cm5cblxuICAgIGxldCBpID0gMCwgbGFzdElubmVyID0gYnVmLmJ5dGVMZW5ndGggLSBmcmFnbWVudF9zaXplO1xuICAgIHdoaWxlIGkgPCBsYXN0SW5uZXIgOjpcbiAgICAgIGNvbnN0IGkwID0gaVxuICAgICAgaSArPSBmcmFnbWVudF9zaXplXG5cbiAgICAgIGNvbnN0IG9iaiA9IG5leHRfaGRyKClcbiAgICAgIG9iai5ib2R5ID0gYnVmLnNsaWNlKGkwLCBpKVxuICAgICAgeWllbGQgb2JqXG5cbiAgICA6OlxuICAgICAgY29uc3Qgb2JqID0gbmV4dF9oZHIoe2Zpbn0pXG4gICAgICBvYmouYm9keSA9IGJ1Zi5zbGljZShpKVxuICAgICAgeWllbGQgb2JqXG5cblxuXG5cbi8vIG1vZHVsZS1sZXZlbCBoZWxwZXIgZnVuY3Rpb25zXG5cbmZ1bmN0aW9uIGJpbmRUcmFuc3BvcnRJbXBscyhpbmJvdW5kLCBoaWdoYml0cywgdHJhbnNwb3J0cykgOjpcbiAgY29uc3Qgb3V0Ym91bmQgPSBbXVxuICBvdXRib3VuZC5jaG9vc2UgPSBmcmFtaW5ncy5jaG9vc2VcblxuICBmb3IgY29uc3QgZnJhbWUgb2YgZnJhbWluZ3MgOjpcbiAgICBjb25zdCBpbXBsID0gZnJhbWUgPyB0cmFuc3BvcnRzW2ZyYW1lLnRyYW5zcG9ydF0gOiBudWxsXG4gICAgaWYgISBpbXBsIDo6IGNvbnRpbnVlXG5cbiAgICBjb25zdCB7Yml0cywgcGFjaywgdW5wYWNrfSA9IGZyYW1lXG4gICAgY29uc3QgcGt0X3R5cGUgPSBoaWdoYml0cyB8IGJpdHNcbiAgICBjb25zdCB7dF9yZWN2fSA9IGltcGxcblxuICAgIGZ1bmN0aW9uIHBhY2tfaGRyKG9iaikgOjpcbiAgICAgIHBhY2socGt0X3R5cGUsIG9iailcbiAgICAgIHJldHVybiBvYmpcblxuICAgIGZ1bmN0aW9uIHJlY3ZfbXNnKHBrdCwgc2luaykgOjpcbiAgICAgIHVucGFjayhwa3QpXG4gICAgICByZXR1cm4gdF9yZWN2KHBrdCwgc2luaylcblxuICAgIHBhY2tfaGRyLnBrdF90eXBlID0gcmVjdl9tc2cucGt0X3R5cGUgPSBwa3RfdHlwZVxuICAgIG91dGJvdW5kW2JpdHNdID0gcGFja19oZHJcbiAgICBpbmJvdW5kW3BrdF90eXBlXSA9IHJlY3ZfbXNnXG5cbiAgICBpZiAncHJvZHVjdGlvbicgIT09IHByb2Nlc3MuZW52Lk5PREVfRU5WIDo6XG4gICAgICBjb25zdCBvcCA9IHBhY2tfaGRyLm9wID0gcmVjdl9tc2cub3AgPSBmcmFtZS5vcFxuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEAgcGFja19oZHIsICduYW1lJywgQHt9IHZhbHVlOiBgcGFja19oZHIgwqske29wfcK7YFxuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEAgcmVjdl9tc2csICduYW1lJywgQHt9IHZhbHVlOiBgcmVjdl9tc2cgwqske29wfcK7YFxuXG4gIHJldHVybiBvdXRib3VuZFxuXG4iLCJleHBvcnQgKiBmcm9tICcuL2ZyYW1pbmcuanN5J1xuZXhwb3J0ICogZnJvbSAnLi9tdWx0aXBhcnQuanN5J1xuZXhwb3J0ICogZnJvbSAnLi9zdHJlYW1pbmcuanN5J1xuZXhwb3J0ICogZnJvbSAnLi90cmFuc3BvcnQuanN5J1xuXG5pbXBvcnQgbXVsdGlwYXJ0IGZyb20gJy4vbXVsdGlwYXJ0LmpzeSdcbmltcG9ydCBzdHJlYW1pbmcgZnJvbSAnLi9zdHJlYW1pbmcuanN5J1xuaW1wb3J0IHRyYW5zcG9ydCBmcm9tICcuL3RyYW5zcG9ydC5qc3knXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGluaXRfc2hhcmVkKHBhY2tldFBhcnNlciwgb3B0aW9ucykgOjpcbiAgY29uc3Qgc2hhcmVkID0gT2JqZWN0LmFzc2lnbiBAIHtwYWNrZXRQYXJzZXIsIHN0YXRlRm9yfSwgb3B0aW9uc1xuXG4gIE9iamVjdC5hc3NpZ24gQCBzaGFyZWQsXG4gICAgbXVsdGlwYXJ0IEAgcGFja2V0UGFyc2VyLCBzaGFyZWRcbiAgICBzdHJlYW1pbmcgQCBwYWNrZXRQYXJzZXIsIHNoYXJlZFxuICAgIHRyYW5zcG9ydCBAIHBhY2tldFBhcnNlciwgc2hhcmVkXG5cbiAgcmV0dXJuIHNoYXJlZFxuXG5mdW5jdGlvbiBzdGF0ZUZvcihwa3QsIHNpbmssIGNyZWF0ZVN0YXRlKSA6OlxuICBjb25zdCB7YnlfbXNnaWR9ID0gc2luaywge21zZ2lkfSA9IHBrdC5pbmZvXG4gIGxldCBzdGF0ZSA9IGJ5X21zZ2lkLmdldChtc2dpZClcbiAgaWYgdW5kZWZpbmVkID09PSBzdGF0ZSA6OlxuICAgIGlmICEgbXNnaWQgOjogdGhyb3cgbmV3IEVycm9yIEAgYEludmFsaWQgbXNnaWQ6ICR7bXNnaWR9YFxuXG4gICAgc3RhdGUgPSBjcmVhdGVTdGF0ZSBAIHBrdCwgc2luaywgKCkgPT4gYnlfbXNnaWQuZGVsZXRlKG1zZ2lkKVxuICAgIGJ5X21zZ2lkLnNldCBAIG1zZ2lkLCBzdGF0ZVxuICByZXR1cm4gc3RhdGVcblxuIiwiY29uc3Qgbm9vcF9lbmNvZGluZ3MgPSBAe31cbiAgZW5jb2RlKGJ1Ziwgb2JqLCBjaGFuKSA6OiByZXR1cm4gYnVmXG4gIGRlY29kZShidWYsIGluZm8sIHNpbmspIDo6IHJldHVybiBidWZcblxuZXhwb3J0IGRlZmF1bHQganNvbl9wcm90b2NvbFxuZXhwb3J0IGZ1bmN0aW9uIGpzb25fcHJvdG9jb2woc2hhcmVkLCB7ZW5jb2RlLCBkZWNvZGV9PW5vb3BfZW5jb2RpbmdzKSA6OlxuICBjb25zdCB7c3RhdGVGb3IsIGNyZWF0ZU11bHRpcGFydCwgY3JlYXRlU3RyZWFtLCBqc29uX3BhY2t9ID0gc2hhcmVkXG4gIGNvbnN0IHtwYWNrX3V0ZjgsIHVucGFja191dGY4fSA9IHNoYXJlZC5wYWNrZXRQYXJzZXJcbiAgY29uc3Qgc3RyZWFtX21zZ191bnBhY2sgPSBhc19qc29uX2NvbnRlbnRcblxuICByZXR1cm4gQHt9XG4gICAgcGFja0JvZHlcblxuICAgIGdldCBkYXRhZ3JhbSgpIDo6IHJldHVybiB0aGlzLmRpcmVjdFxuICAgIGRpcmVjdDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBpbmZvID0gcGt0LmluZm9cbiAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIHBrdC5ib2R5X2J1ZmZlcigpLCBpbmZvLCBzaW5rXG4gICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIGluZm9cblxuICAgIG11bHRpcGFydDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0YXRlRm9yIEAgcGt0LCBzaW5rLCBjcmVhdGVNdWx0aXBhcnRcbiAgICAgICAgY29uc3QgYm9keV9idWYgPSBzdGF0ZS5mZWVkKHBrdClcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBib2R5X2J1ZiA6OlxuICAgICAgICAgIGNvbnN0IGluZm8gPSBzdGF0ZS5pbmZvXG4gICAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGJvZHlfYnVmLCBpbmZvLCBzaW5rXG4gICAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgaW5mb1xuXG4gICAgc3RyZWFtaW5nOiBAe31cbiAgICAgIG1vZGU6ICdvYmplY3QnXG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0YXRlRm9yIEAgcGt0LCBzaW5rLCBjcmVhdGVTdHJlYW1cbiAgICAgICAgcmV0dXJuIHN0YXRlLmZlZWQocGt0LCBhc19qc29uX2NvbnRlbnQsIHN0cmVhbV9tc2dfdW5wYWNrKVxuXG4gICAgICBtc2dfcGFjayhtc2csIG9iaiwgY2hhbikgOjpcbiAgICAgICAgY29uc3QgbXNnX2J1ZiA9IHBhY2tfdXRmOCBAIGpzb25fcGFjayBAIG1zZ1xuICAgICAgICByZXR1cm4gZW5jb2RlKG1zZ19idWYsIG9iaiwgY2hhbilcblxuXG4gIGZ1bmN0aW9uIHBhY2tCb2R5KGJvZHksIG9iaiwgY2hhbikgOjpcbiAgICBjb25zdCBib2R5X2J1ZiA9IHBhY2tfdXRmOCBAIGpzb25fcGFjayBAIGJvZHlcbiAgICByZXR1cm4gZW5jb2RlKGJvZHlfYnVmLCBvYmosIGNoYW4pXG5cbiAgZnVuY3Rpb24gYXNfanNvbl9jb250ZW50KHBrdCwgc2luaykgOjpcbiAgICBjb25zdCBqc29uX2J1ZiA9IGRlY29kZShwa3QuYm9keV9idWZmZXIoKSwgcGt0LmluZm8sIHNpbmspXG4gICAgcmV0dXJuIHNpbmsuanNvbl91bnBhY2sgQCB1bnBhY2tfdXRmOCBAIGpzb25fYnVmXG5cbiAgZnVuY3Rpb24gdW5wYWNrQm9keUJ1Zihib2R5X2J1ZiwgaW5mbywgc2luaykgOjpcbiAgICBjb25zdCBqc29uX2J1ZiA9IGRlY29kZShib2R5X2J1ZiwgaW5mbywgc2luaylcbiAgICByZXR1cm4gc2luay5qc29uX3VucGFjayBAIGpzb25fYnVmID8gdW5wYWNrX3V0ZjgoanNvbl9idWYpIDogdW5kZWZpbmVkXG5cbiIsImNvbnN0IG5vb3BfZW5jb2RpbmdzID0gQHt9XG4gIGVuY29kZShidWYsIG9iaiwgY2hhbikgOjogcmV0dXJuIGJ1ZlxuICBkZWNvZGUoYnVmLCBpbmZvLCBzaW5rKSA6OiByZXR1cm4gYnVmXG5cbmV4cG9ydCBkZWZhdWx0IGJpbmFyeV9wcm90b2NvbFxuZXhwb3J0IGZ1bmN0aW9uIGJpbmFyeV9wcm90b2NvbChzaGFyZWQsIHtlbmNvZGUsIGRlY29kZX09bm9vcF9lbmNvZGluZ3MpIDo6XG4gIGNvbnN0IHtzdGF0ZUZvciwgY3JlYXRlTXVsdGlwYXJ0LCBjcmVhdGVTdHJlYW19ID0gc2hhcmVkXG4gIGNvbnN0IHthc0J1ZmZlcn0gPSBzaGFyZWQucGFja2V0UGFyc2VyXG5cbiAgcmV0dXJuIEB7fVxuICAgIHBhY2tCb2R5XG5cbiAgICBnZXQgZGF0YWdyYW0oKSA6OiByZXR1cm4gdGhpcy5kaXJlY3RcbiAgICBkaXJlY3Q6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3QgaW5mbyA9IHBrdC5pbmZvXG4gICAgICAgIGNvbnN0IGJvZHlfYnVmID0gcGt0LmJvZHlfYnVmZmVyKClcbiAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGJvZHlfYnVmLCBpbmZvLCBzaW5rXG4gICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIGluZm9cblxuICAgIG11bHRpcGFydDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0YXRlRm9yIEAgcGt0LCBzaW5rLCBjcmVhdGVNdWx0aXBhcnRcbiAgICAgICAgY29uc3QgYm9keV9idWYgPSBzdGF0ZS5mZWVkKHBrdClcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBib2R5X2J1ZiA6OlxuICAgICAgICAgIGNvbnN0IGluZm8gPSBzdGF0ZS5pbmZvXG4gICAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGJvZHlfYnVmLCBpbmZvLCBzaW5rXG4gICAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgaW5mb1xuXG4gICAgc3RyZWFtaW5nOiBAe31cbiAgICAgIG1vZGU6ICdieXRlcydcbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RhdGVGb3IgQCBwa3QsIHNpbmssIGNyZWF0ZVN0cmVhbVxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHN0YXRlLmZlZWQocGt0LCBwa3RfYnVmZmVyLCBzdHJlYW1fbXNnX3VucGFjaylcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBib2R5X2J1ZiA6OlxuICAgICAgICAgIGNvbnN0IGluZm8gPSBzdGF0ZS5pbmZvXG4gICAgICAgICAgY29uc3QgbXNnID0gdW5wYWNrQm9keUJ1ZiBAIGJvZHlfYnVmLCBpbmZvLCBzaW5rXG4gICAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgaW5mb1xuXG4gICAgICBtc2dfcGFjayhtc2csIG9iaiwgY2hhbikgOjpcbiAgICAgICAgY29uc3QgbXNnX2J1ZiA9IHBhY2tfdXRmOCBAIGpzb25fcGFjayBAIG1zZ1xuICAgICAgICByZXR1cm4gZW5jb2RlKG1zZ19idWYsIG9iaiwgY2hhbilcblxuXG4gIGZ1bmN0aW9uIHN0cmVhbV9tc2dfdW5wYWNrKHBrdCwgc2luaykgOjpcbiAgICBjb25zdCBqc29uX2J1ZiA9IGRlY29kZShwa3QuYm9keV9idWZmZXIoKSwgcGt0LmluZm8sIHNpbmspXG4gICAgcmV0dXJuIHNpbmsuanNvbl91bnBhY2sgQCB1bnBhY2tfdXRmOChqc29uX2J1ZilcblxuICBmdW5jdGlvbiBwYWNrQm9keShib2R5LCBvYmosIGNoYW4pIDo6XG4gICAgY29uc3QgYm9keV9idWYgPSBhc0J1ZmZlciBAIGJvZHlcbiAgICByZXR1cm4gZW5jb2RlKGJvZHlfYnVmLCBvYmosIGNoYW4pXG4gIGZ1bmN0aW9uIHVucGFja0JvZHlCdWYoYm9keV9idWYsIGluZm8sIHNpbmspIDo6XG4gICAgcmV0dXJuIGRlY29kZShib2R5X2J1ZiwgaW5mbywgc2luaylcblxuZnVuY3Rpb24gcGt0X2J1ZmZlcihwa3QpIDo6IHJldHVybiBwa3QuYm9keV9idWZmZXIoKVxuXG4iLCJleHBvcnQgZGVmYXVsdCBjb250cm9sX3Byb3RvY29sXG5leHBvcnQgZnVuY3Rpb24gY29udHJvbF9wcm90b2NvbChpbmJvdW5kLCBoaWdoLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtjaG9vc2VGcmFtaW5nLCByYW5kb21faWR9ID0gc2hhcmVkXG4gIGNvbnN0IHtwYWNrUGFja2V0T2JqfSA9IHNoYXJlZC5wYWNrZXRQYXJzZXJcblxuICBjb25zdCBwaW5nX2ZyYW1lID0gY2hvb3NlRnJhbWluZyBAOiBmcm9tX2lkOiB0cnVlLCB0b2tlbjogdHJ1ZSwgdHJhbnNwb3J0OiAnZGlyZWN0J1xuICBjb25zdCBwb25nX2ZyYW1lID0gY2hvb3NlRnJhbWluZyBAOiBmcm9tX2lkOiB0cnVlLCBtc2dpZDogdHJ1ZSwgdHJhbnNwb3J0OiAnZGF0YWdyYW0nXG5cbiAgY29uc3QgcG9uZ190eXBlID0gaGlnaHwweGVcbiAgaW5ib3VuZFtwb25nX3R5cGVdID0gcmVjdl9wb25nXG4gIGNvbnN0IHBpbmdfdHlwZSA9IGhpZ2h8MHhmXG4gIGluYm91bmRbaGlnaHwweGZdID0gcmVjdl9waW5nXG5cbiAgcmV0dXJuIEB7fSBzZW5kOnBpbmcsIHBpbmdcblxuICBmdW5jdGlvbiBwaW5nKGNoYW4sIG9iaikgOjpcbiAgICBpZiAhIG9iai50b2tlbiA6OlxuICAgICAgb2JqLnRva2VuID0gcmFuZG9tX2lkKClcbiAgICBvYmouYm9keSA9IEpTT04uc3RyaW5naWZ5IEA6XG4gICAgICBvcDogJ3BpbmcnLCB0czA6IG5ldyBEYXRlKClcbiAgICBwaW5nX2ZyYW1lLnBhY2socGluZ190eXBlLCBvYmopXG4gICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgIHJldHVybiBjaGFuLnNlbmQgQCBwa3RcblxuICBmdW5jdGlvbiByZWN2X3BpbmcocGt0LCBzaW5rLCByb3V0ZXIpIDo6XG4gICAgcGluZ19mcmFtZS51bnBhY2socGt0KVxuICAgIHBrdC5ib2R5ID0gcGt0LmJvZHlfanNvbigpXG4gICAgX3NlbmRfcG9uZyBAIHBrdC5ib2R5LCBwa3QsIHJvdXRlclxuICAgIHJldHVybiBzaW5rLnJlY3ZDdHJsKHBrdC5ib2R5LCBwa3QuaW5mbylcblxuICBmdW5jdGlvbiBfc2VuZF9wb25nKHt0czB9LCBwa3RfcGluZywgcm91dGVyKSA6OlxuICAgIGNvbnN0IHttc2dpZCwgaWRfdGFyZ2V0LCBpZF9yb3V0ZXIsIGZyb21faWQ6cl9pZH0gPSBwa3RfcGluZy5pbmZvXG4gICAgY29uc3Qgb2JqID0gQHt9IG1zZ2lkXG4gICAgICBmcm9tX2lkOiBAe30gaWRfdGFyZ2V0LCBpZF9yb3V0ZXJcbiAgICAgIGlkX3JvdXRlcjogcl9pZC5pZF9yb3V0ZXIsIGlkX3RhcmdldDogcl9pZC5pZF90YXJnZXRcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5IEA6XG4gICAgICAgIG9wOiAncG9uZycsIHRzMCwgdHMxOiBuZXcgRGF0ZSgpXG5cbiAgICBwb25nX2ZyYW1lLnBhY2socG9uZ190eXBlLCBvYmopXG4gICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgIHJldHVybiByb3V0ZXIuZGlzcGF0Y2ggQCBbcGt0XVxuXG4gIGZ1bmN0aW9uIHJlY3ZfcG9uZyhwa3QsIHNpbmspIDo6XG4gICAgcG9uZ19mcmFtZS51bnBhY2socGt0KVxuICAgIHBrdC5ib2R5ID0gcGt0LmJvZHlfanNvbigpXG4gICAgcmV0dXJuIHNpbmsucmVjdkN0cmwocGt0LmJvZHksIHBrdC5pbmZvKVxuXG4iLCJpbXBvcnQgaW5pdF9zaGFyZWQgZnJvbSAnLi9zaGFyZWQvaW5kZXguanN5J1xuaW1wb3J0IGpzb25fcHJvdG9jb2wgZnJvbSAnLi9wcm90b2NvbHMvanNvbi5qc3knXG5pbXBvcnQgYmluYXJ5X3Byb3RvY29sIGZyb20gJy4vcHJvdG9jb2xzL2JpbmFyeS5qc3knXG5pbXBvcnQgY29udHJvbF9wcm90b2NvbCBmcm9tICcuL3Byb3RvY29scy9jb250cm9sLmpzeSdcblxuXG5jb25zdCBkZWZhdWx0X3BsdWdpbl9vcHRpb25zID0gQDpcbiAgcGx1Z2luX25hbWU6ICdwcm90b2NvbHMnXG4gIHVzZVN0YW5kYXJkOiB0cnVlXG4gIGpzb25fcGFjazogSlNPTi5zdHJpbmdpZnlcbiAgY3VzdG9tKHByb3RvY29scykgOjogcmV0dXJuIHByb3RvY29sc1xuXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBsdWdpbl9vcHRpb25zKSA6OlxuICBwbHVnaW5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24gQCB7fSwgZGVmYXVsdF9wbHVnaW5fb3B0aW9ucywgcGx1Z2luX29wdGlvbnNcbiAgY29uc3QgeyBwbHVnaW5fbmFtZSwgcmFuZG9tX2lkLCBqc29uX3BhY2sgfSA9IHBsdWdpbl9vcHRpb25zXG5cbiAgcmV0dXJuIEA6IHN1YmNsYXNzLCBvcmRlcjogLTEgLy8gZGVwZW5kZW50IG9uIHJvdXRlciBwbHVnaW4ncyAoLTIpIHByb3ZpZGluZyBwYWNrZXRQYXJzZXJcbiAgXG4gIGZ1bmN0aW9uIHN1YmNsYXNzKEZhYnJpY0h1Yl9QSSwgYmFzZXMpIDo6XG4gICAgY29uc3Qge3BhY2tldFBhcnNlcn0gPSBGYWJyaWNIdWJfUEkucHJvdG90eXBlXG4gICAgaWYgbnVsbD09cGFja2V0UGFyc2VyIHx8ICEgcGFja2V0UGFyc2VyLmlzUGFja2V0UGFyc2VyKCkgOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgSW52YWxpZCBwYWNrZXRQYXJzZXIgZm9yIHBsdWdpbmBcbiAgICBcblxuICAgIGNvbnN0IHNoYXJlZCA9IGluaXRfc2hhcmVkIEAgcGFja2V0UGFyc2VyLCBAe30gcmFuZG9tX2lkLCBqc29uX3BhY2tcbiAgICBsZXQgcHJvdG9jb2xzID0gQHt9IHNoYXJlZCwgcmFuZG9tX2lkLCBpbmJvdW5kOiBbXSwgY29kZWNzOiBPYmplY3QuY3JlYXRlKG51bGwpLCBcblxuICAgIGlmIHBsdWdpbl9vcHRpb25zLnVzZVN0YW5kYXJkIDo6XG4gICAgICBwcm90b2NvbHMgPSBpbml0X3Byb3RvY29scyBAIHByb3RvY29sc1xuXG4gICAgcHJvdG9jb2xzID0gcGx1Z2luX29wdGlvbnMuY3VzdG9tIEAgcHJvdG9jb2xzXG4gICAgRmFicmljSHViX1BJLnByb3RvdHlwZVtwbHVnaW5fbmFtZV0gPSBwcm90b2NvbHNcblxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdF9wcm90b2NvbHMocHJvdG9jb2xzKSA6OlxuICBjb25zdCB7aW5ib3VuZCwgY29kZWNzLCBzaGFyZWR9ID0gcHJvdG9jb2xzXG5cbiAgY29kZWNzLmRlZmF1bHQgPSBjb2RlY3MuanNvbiA9IEBcbiAgICBzaGFyZWQuYmluZFRyYW5zcG9ydHMgQCAvLyAweDAqIOKAlCBKU09OIGJvZHlcbiAgICAgIGluYm91bmQsIDB4MDAsIGpzb25fcHJvdG9jb2woc2hhcmVkKVxuXG4gIGNvZGVjcy5iaW5hcnkgPSBAXG4gICAgc2hhcmVkLmJpbmRUcmFuc3BvcnRzIEAgLy8gMHgxKiDigJQgYmluYXJ5IGJvZHlcbiAgICAgIGluYm91bmQsIDB4MTAsIGJpbmFyeV9wcm90b2NvbChzaGFyZWQpXG5cbiAgY29kZWNzLmNvbnRyb2wgPSBAIC8vIDB4Ziog4oCUIGNvbnRyb2xcbiAgICBjb250cm9sX3Byb3RvY29sIEAgaW5ib3VuZCwgMHhmMCwgc2hhcmVkXG5cbiAgcmV0dXJuIHByb3RvY29sc1xuXG4iLCJpbXBvcnQge3JhbmRvbUJ5dGVzfSBmcm9tICdjcnlwdG8nXG5pbXBvcnQgcGx1Z2luIGZyb20gJy4vcGx1Z2luLmpzeSdcblxucHJvdG9jb2xzX25vZGVqcy5yYW5kb21faWQgPSByYW5kb21faWRcbmZ1bmN0aW9uIHJhbmRvbV9pZCgpIDo6XG4gIHJldHVybiByYW5kb21CeXRlcyg0KS5yZWFkSW50MzJMRSgpXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHByb3RvY29sc19ub2RlanMocGx1Z2luX29wdGlvbnM9e30pIDo6XG4gIGlmIG51bGwgPT0gcGx1Z2luX29wdGlvbnMucmFuZG9tX2lkIDo6XG4gICAgcGx1Z2luX29wdGlvbnMucmFuZG9tX2lkID0gcmFuZG9tX2lkXG5cbiAgcmV0dXJuIHBsdWdpbihwbHVnaW5fb3B0aW9ucylcblxuIiwiaW1wb3J0IHBsdWdpbiBmcm9tICcuL3BsdWdpbi5qc3knXG5cbmNvbnN0IGdldFJhbmRvbVZhbHVlcyA9ICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd2luZG93XG4gID8gd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXMgOiBudWxsXG5cbnByb3RvY29sc19icm93c2VyLnJhbmRvbV9pZCA9IHJhbmRvbV9pZFxuZnVuY3Rpb24gcmFuZG9tX2lkKCkgOjpcbiAgY29uc3QgYXJyID0gbmV3IEludDMyQXJyYXkoMSlcbiAgZ2V0UmFuZG9tVmFsdWVzKGFycilcbiAgcmV0dXJuIGFyclswXVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcm90b2NvbHNfYnJvd3NlcihwbHVnaW5fb3B0aW9ucz17fSkgOjpcbiAgaWYgbnVsbCA9PSBwbHVnaW5fb3B0aW9ucy5yYW5kb21faWQgOjpcbiAgICBwbHVnaW5fb3B0aW9ucy5yYW5kb21faWQgPSByYW5kb21faWRcblxuICByZXR1cm4gcGx1Z2luKHBsdWdpbl9vcHRpb25zKVxuXG4iXSwibmFtZXMiOlsibGl0dGxlX2VuZGlhbiIsImNfc2luZ2xlIiwiY19kYXRhZ3JhbSIsImNfZGlyZWN0IiwiY19tdWx0aXBhcnQiLCJjX3N0cmVhbWluZyIsIl9lcnJfbXNnaWRfcmVxdWlyZWQiLCJfZXJyX3Rva2VuX3JlcXVpcmVkIiwiZnJtX3JvdXRpbmciLCJzaXplIiwiYml0cyIsIm1hc2siLCJvYmoiLCJmcm9tX2lkIiwiZHYiLCJvZmZzZXQiLCJzZXRJbnQzMiIsImlkX3JvdXRlciIsImlkX3RhcmdldCIsInVuZGVmaW5lZCIsImdldEludDMyIiwiZnJtX3Jlc3BvbnNlIiwibXNnaWQiLCJFcnJvciIsInNldEludDE2Iiwic2VxX2FjayIsImFja19mbGFncyIsInRva2VuIiwiZ2V0SW50MTYiLCJmcm1fZGF0YWdyYW0iLCJ0cmFuc3BvcnQiLCJmcm1fZGlyZWN0IiwiZnJtX211bHRpcGFydCIsInNlcV9wb3MiLCJzZXEiLCJzZXFfZmxhZ3MiLCJmcm1fc3RyZWFtaW5nIiwiYmluZF9zZXFfbmV4dCIsInNlcV9vZmZzZXQiLCJzZXFfbmV4dCIsImZsYWdzIiwiZmluIiwiTmFOIiwiY29tcG9zZUZyYW1pbmdzIiwiZnJtX2Zyb20iLCJmcm1fcmVzcCIsImZybV90cmFuc3BvcnRzIiwibGVuZ3RoIiwiYnlCaXRzIiwidF9mcm9tIiwiZl90ZXN0IiwidF9yZXNwIiwidDAiLCJ0MSIsInQyIiwidDMiLCJtYXAiLCJmIiwidGVzdEJpdHMiLCJjaG9vc2UiLCJsc3QiLCJUIiwiYiIsIm9wIiwiZm5fa2V5IiwiZm5fdHJhbiIsImZuX2Zyb20iLCJmbl9yZXNwIiwiZnJtIiwiYmluZEFzc2VtYmxlZCIsImZfcGFjayIsImZfdW5wYWNrIiwicGFjayIsInVucGFjayIsInBrdF90eXBlIiwicGt0X29iaiIsIlR5cGVFcnJvciIsInR5cGUiLCJEYXRhVmlldyIsIkFycmF5QnVmZmVyIiwiaGVhZGVyIiwiYnVmZmVyIiwic2xpY2UiLCJwa3QiLCJidWYiLCJoZWFkZXJfYnVmZmVyIiwiVWludDhBcnJheSIsImluZm8iLCJfYmluZF9pdGVyYWJsZSIsImJ1Zl9jbG9uZSIsInR0bCIsIm5leHQiLCJvcHRpb25zIiwiZG9uZSIsInZhbHVlIiwicGFja2V0UGFyc2VyIiwic2hhcmVkIiwiY29uY2F0QnVmZmVycyIsImNyZWF0ZU11bHRpcGFydCIsInNpbmsiLCJkZWxldGVTdGF0ZSIsInBhcnRzIiwiZmVlZCIsImJvZHlfYnVmZmVyIiwiaW5jbHVkZXMiLCJyZXMiLCJjcmVhdGVTdHJlYW0iLCJyZWN2RGF0YSIsInJzdHJlYW0iLCJzdGF0ZSIsImZlZWRfaW5pdCIsImFzX2NvbnRlbnQiLCJtc2dfdW5wYWNrIiwiZmVlZF9pZ25vcmUiLCJtc2ciLCJqc29uX3VucGFjayIsImJvZHlfdXRmOCIsInJlY3ZTdHJlYW0iLCJyZWN2U3RyZWFtRGF0YSIsImJpbmQiLCJlcnIiLCJvbl9lcnJvciIsImZlZWRfYm9keSIsIm9uX2luaXQiLCJkYXRhIiwib25fZGF0YSIsIm9uX2VuZCIsImZlZWRfc2VxIiwiY2hlY2tfZm5zIiwia2V5cyIsImtleSIsInBhY2tQYWNrZXRPYmoiLCJyYW5kb21faWQiLCJqc29uX3BhY2siLCJjaG9vc2VGcmFtaW5nIiwiZnJhbWluZ3MiLCJmcmFnbWVudF9zaXplIiwiTnVtYmVyIiwiYmluZFRyYW5zcG9ydHMiLCJwYWNrZXRGcmFnbWVudHMiLCJpbmJvdW5kIiwiaGlnaGJpdHMiLCJ0cmFuc3BvcnRzIiwicGFja0JvZHkiLCJvdXRib3VuZCIsImJpbmRUcmFuc3BvcnRJbXBscyIsInN0cmVhbWluZyIsInNlbmQiLCJzdHJlYW0iLCJiaW5kU3RyZWFtIiwiY2hhbiIsImJvZHkiLCJieXRlTGVuZ3RoIiwibXNlbmQiLCJtc2VuZF9ieXRlcyIsInBhY2tfaGRyIiwibXNlbmRfb2JqZWN0cyIsIm1vZGUiLCJtc2dfcGFjayIsIm1zZW5kX2ltcGwiLCJvYmplY3QiLCJieXRlcyIsIndyaXRlIiwiZW5kIiwiY2h1bmsiLCJuZXh0X2hkciIsImkiLCJsYXN0SW5uZXIiLCJpMCIsImZyYW1lIiwiaW1wbCIsInRfcmVjdiIsInJlY3ZfbXNnIiwicHJvY2VzcyIsImVudiIsIk5PREVfRU5WIiwiZGVmaW5lUHJvcGVydHkiLCJpbml0X3NoYXJlZCIsIk9iamVjdCIsImFzc2lnbiIsInN0YXRlRm9yIiwibXVsdGlwYXJ0IiwiY3JlYXRlU3RhdGUiLCJieV9tc2dpZCIsImdldCIsImRlbGV0ZSIsInNldCIsIm5vb3BfZW5jb2RpbmdzIiwianNvbl9wcm90b2NvbCIsImVuY29kZSIsImRlY29kZSIsInBhY2tfdXRmOCIsInVucGFja191dGY4Iiwic3RyZWFtX21zZ191bnBhY2siLCJhc19qc29uX2NvbnRlbnQiLCJkYXRhZ3JhbSIsImRpcmVjdCIsInVucGFja0JvZHlCdWYiLCJyZWN2TXNnIiwiYm9keV9idWYiLCJtc2dfYnVmIiwianNvbl9idWYiLCJiaW5hcnlfcHJvdG9jb2wiLCJhc0J1ZmZlciIsInBrdF9idWZmZXIiLCJjb250cm9sX3Byb3RvY29sIiwiaGlnaCIsInBpbmdfZnJhbWUiLCJwb25nX2ZyYW1lIiwicG9uZ190eXBlIiwicmVjdl9wb25nIiwicGluZ190eXBlIiwicmVjdl9waW5nIiwicGluZyIsIkpTT04iLCJzdHJpbmdpZnkiLCJ0czAiLCJEYXRlIiwicm91dGVyIiwiYm9keV9qc29uIiwicmVjdkN0cmwiLCJfc2VuZF9wb25nIiwicGt0X3BpbmciLCJyX2lkIiwidHMxIiwiZGlzcGF0Y2giLCJkZWZhdWx0X3BsdWdpbl9vcHRpb25zIiwicHJvdG9jb2xzIiwicGx1Z2luX29wdGlvbnMiLCJwbHVnaW5fbmFtZSIsInN1YmNsYXNzIiwib3JkZXIiLCJGYWJyaWNIdWJfUEkiLCJiYXNlcyIsInByb3RvdHlwZSIsImlzUGFja2V0UGFyc2VyIiwiY29kZWNzIiwiY3JlYXRlIiwidXNlU3RhbmRhcmQiLCJpbml0X3Byb3RvY29scyIsImN1c3RvbSIsImRlZmF1bHQiLCJqc29uIiwiYmluYXJ5IiwiY29udHJvbCIsInByb3RvY29sc19ub2RlanMiLCJyYW5kb21CeXRlcyIsInJlYWRJbnQzMkxFIiwicGx1Z2luIiwiZ2V0UmFuZG9tVmFsdWVzIiwid2luZG93IiwiY3J5cHRvIiwicHJvdG9jb2xzX2Jyb3dzZXIiLCJhcnIiLCJJbnQzMkFycmF5Il0sIm1hcHBpbmdzIjoiOztBQUFBLE1BQU1BLGdCQUFnQixJQUF0QjtBQUNBLE1BQU1DLFdBQVcsUUFBakI7QUFDQSxNQUFNQyxhQUFhLFVBQW5CO0FBQ0EsTUFBTUMsV0FBVyxRQUFqQjtBQUNBLE1BQU1DLGNBQWMsV0FBcEI7QUFDQSxNQUFNQyxjQUFjLFdBQXBCOztBQUVBLE1BQU1DLHNCQUF1QiwwQkFBN0I7QUFDQSxNQUFNQyxzQkFBdUIsMkJBQTdCOztBQUdBLFNBQVNDLFdBQVQsR0FBdUI7UUFDZkMsT0FBTyxDQUFiO1FBQWdCQyxPQUFPLEdBQXZCO1FBQTRCQyxPQUFPLEdB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
