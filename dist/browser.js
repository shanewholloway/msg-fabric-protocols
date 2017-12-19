'use strict';

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

module.exports = protocols_browser;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZXMiOlsiLi4vY29kZS9zaGFyZWQvZnJhbWluZy5qc3kiLCIuLi9jb2RlL3NoYXJlZC9tdWx0aXBhcnQuanN5IiwiLi4vY29kZS9zaGFyZWQvc3RyZWFtaW5nLmpzeSIsIi4uL2NvZGUvc2hhcmVkL3RyYW5zcG9ydC5qc3kiLCIuLi9jb2RlL3NoYXJlZC9pbmRleC5qc3kiLCIuLi9jb2RlL3Byb3RvY29scy9qc29uLmpzeSIsIi4uL2NvZGUvcHJvdG9jb2xzL2JpbmFyeS5qc3kiLCIuLi9jb2RlL3Byb3RvY29scy9jb250cm9sLmpzeSIsIi4uL2NvZGUvcGx1Z2luLmpzeSIsIi4uL2NvZGUvaW5kZXguYnJvd3Nlci5qc3kiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgbGl0dGxlX2VuZGlhbiA9IHRydWVcbmNvbnN0IGNfc2luZ2xlID0gJ3NpbmdsZSdcbmNvbnN0IGNfZGF0YWdyYW0gPSAnZGF0YWdyYW0nXG5jb25zdCBjX2RpcmVjdCA9ICdkaXJlY3QnXG5jb25zdCBjX211bHRpcGFydCA9ICdtdWx0aXBhcnQnXG5jb25zdCBjX3N0cmVhbWluZyA9ICdzdHJlYW1pbmcnXG5cbmNvbnN0IF9lcnJfbXNnaWRfcmVxdWlyZWQgPSBgUmVzcG9uc2UgcmVxaXJlcyAnbXNnaWQnYFxuY29uc3QgX2Vycl90b2tlbl9yZXF1aXJlZCA9IGBUcmFuc3BvcnQgcmVxaXJlcyAndG9rZW4nYFxuXG5cbmZ1bmN0aW9uIGZybV9yb3V0aW5nKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDgsIGJpdHMgPSAweDEsIG1hc2sgPSAweDFcbiAgcmV0dXJuIEB7fVxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6IHJldHVybiBudWxsICE9IG9iai5mcm9tX2lkID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgY29uc3Qge2Zyb21faWR9ID0gb2JqXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCAwfGZyb21faWQuaWRfcm91dGVyLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQzMiBAIDQrb2Zmc2V0LCAwfGZyb21faWQuaWRfdGFyZ2V0LCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBjb25zdCBmcm9tX2lkID0gdW5kZWZpbmVkID09PSBvYmouZnJvbV9pZFxuICAgICAgICA/IG9iai5mcm9tX2lkID0ge30gOiBvYmouZnJvbV9pZFxuICAgICAgZnJvbV9pZC5pZF9yb3V0ZXIgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBmcm9tX2lkLmlkX3RhcmdldCA9IGR2LmdldEludDMyIEAgNCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cblxuZnVuY3Rpb24gZnJtX3Jlc3BvbnNlKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDgsIGJpdHMgPSAweDIsIG1hc2sgPSAweDJcbiAgcmV0dXJuIEB7fVxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6IHJldHVybiBudWxsICE9IG9iai5tc2dpZCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLm1zZ2lkIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfbXNnaWRfcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai5tc2dpZCwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMHxvYmouc2VxX2FjaywgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCA2K29mZnNldCwgMHxvYmouYWNrX2ZsYWdzLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoudG9rZW4gPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxX2FjayA9IGR2LmdldEludDE2IEAgNCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5hY2tfZmxhZ3MgPSBkdi5nZXRJbnQxNiBAIDYrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG5cblxuXG5mdW5jdGlvbiBmcm1fZGF0YWdyYW0oKSA6OlxuICBjb25zdCBzaXplID0gMCwgYml0cyA9IDB4MCwgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19kYXRhZ3JhbVxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6XG4gICAgICBpZiBjX2RhdGFncmFtID09PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBiaXRzXG4gICAgICBpZiBvYmoudHJhbnNwb3J0ICYmIGNfc2luZ2xlICE9PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBmYWxzZVxuICAgICAgcmV0dXJuICEgb2JqLnRva2VuID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfZGF0YWdyYW1cblxuZnVuY3Rpb24gZnJtX2RpcmVjdCgpIDo6XG4gIGNvbnN0IHNpemUgPSA0LCBiaXRzID0gMHg0LCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX2RpcmVjdFxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6XG4gICAgICBpZiBjX2RpcmVjdCA9PT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gYml0c1xuICAgICAgaWYgb2JqLnRyYW5zcG9ydCAmJiBjX3NpbmdsZSAhPT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gZmFsc2VcbiAgICAgIHJldHVybiAhISBvYmoudG9rZW4gPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai50b2tlbiA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX3Rva2VuX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoudG9rZW4sIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai5tc2dpZCA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX2RpcmVjdFxuXG5mdW5jdGlvbiBmcm1fbXVsdGlwYXJ0KCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDgsIGJpdHMgPSAweDgsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfbXVsdGlwYXJ0XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIGNfbXVsdGlwYXJ0ID09PSBvYmoudHJhbnNwb3J0ID8gYml0cyA6IGZhbHNlXG5cbiAgICBiaW5kX3NlcV9uZXh0LCBzZXFfcG9zOiA0XG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLnRva2VuIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfdG9rZW5fcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai50b2tlbiwgbGl0dGxlX2VuZGlhblxuICAgICAgaWYgdHJ1ZSA9PSBvYmouc2VxIDo6IC8vIHVzZSBzZXFfbmV4dFxuICAgICAgICBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwLCBsaXR0bGVfZW5kaWFuXG4gICAgICBlbHNlIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDB8b2JqLnNlcSwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCA2K29mZnNldCwgMHxvYmouc2VxX2ZsYWdzLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoubXNnaWQgICAgID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcSAgICAgICA9IGR2LmdldEludDE2IEAgNCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXFfZmxhZ3MgPSBkdi5nZXRJbnQxNiBAIDYrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19tdWx0aXBhcnRcblxuZnVuY3Rpb24gZnJtX3N0cmVhbWluZygpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHhjLCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX3N0cmVhbWluZ1xuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6IHJldHVybiBjX3N0cmVhbWluZyA9PT0gb2JqLnRyYW5zcG9ydCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgYmluZF9zZXFfbmV4dCwgc2VxX3BvczogNFxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai50b2tlbiA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX3Rva2VuX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoudG9rZW4sIGxpdHRsZV9lbmRpYW5cbiAgICAgIGlmIHRydWUgPT0gb2JqLnNlcSA6OlxuICAgICAgICBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwLCBsaXR0bGVfZW5kaWFuIC8vIHVzZSBzZXFfbmV4dFxuICAgICAgZWxzZSBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwfG9iai5zZXEsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNitvZmZzZXQsIDB8b2JqLnNlcV9mbGFncywgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLm1zZ2lkICAgICA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXEgICAgICAgPSBkdi5nZXRJbnQxNiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxX2ZsYWdzID0gZHYuZ2V0SW50MTYgQCA2K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfc3RyZWFtaW5nXG5cblxuZnVuY3Rpb24gYmluZF9zZXFfbmV4dChvZmZzZXQpIDo6XG4gIGNvbnN0IHNlcV9vZmZzZXQgPSB0aGlzLnNlcV9wb3MgKyBvZmZzZXRcbiAgbGV0IHNlcSA9IDFcbiAgcmV0dXJuIGZ1bmN0aW9uIHNlcV9uZXh0KHtmbGFncywgZmlufSwgZHYpIDo6XG4gICAgaWYgISBmaW4gOjpcbiAgICAgIGR2LnNldEludDE2IEAgc2VxX29mZnNldCwgc2VxKyssIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgMitzZXFfb2Zmc2V0LCAwfGZsYWdzLCBsaXR0bGVfZW5kaWFuXG4gICAgZWxzZSA6OlxuICAgICAgZHYuc2V0SW50MTYgQCBzZXFfb2Zmc2V0LCAtc2VxLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDIrc2VxX29mZnNldCwgMHxmbGFncywgbGl0dGxlX2VuZGlhblxuICAgICAgc2VxID0gTmFOXG5cblxuXG5leHBvcnQgZGVmYXVsdCBjb21wb3NlRnJhbWluZ3MoKVxuZnVuY3Rpb24gY29tcG9zZUZyYW1pbmdzKCkgOjpcbiAgY29uc3QgZnJtX2Zyb20gPSBmcm1fcm91dGluZygpLCBmcm1fcmVzcCA9IGZybV9yZXNwb25zZSgpXG4gIGNvbnN0IGZybV90cmFuc3BvcnRzID0gQFtdIGZybV9kYXRhZ3JhbSgpLCBmcm1fZGlyZWN0KCksIGZybV9tdWx0aXBhcnQoKSwgZnJtX3N0cmVhbWluZygpXG5cbiAgaWYgOCAhPT0gZnJtX2Zyb20uc2l6ZSB8fCA4ICE9PSBmcm1fcmVzcC5zaXplIHx8IDQgIT0gZnJtX3RyYW5zcG9ydHMubGVuZ3RoIDo6XG4gICAgdGhyb3cgbmV3IEVycm9yIEAgYEZyYW1pbmcgU2l6ZSBjaGFuZ2VgXG5cbiAgY29uc3QgYnlCaXRzID0gW10sIG1hc2s9MHhmXG5cbiAgOjpcbiAgICBjb25zdCB0X2Zyb20gPSBmcm1fZnJvbS5mX3Rlc3QsIHRfcmVzcCA9IGZybV9yZXNwLmZfdGVzdFxuICAgIGNvbnN0IFt0MCx0MSx0Mix0M10gPSBmcm1fdHJhbnNwb3J0cy5tYXAgQCBmPT5mLmZfdGVzdFxuXG4gICAgY29uc3QgdGVzdEJpdHMgPSBieUJpdHMudGVzdEJpdHMgPSBvYmogPT5cbiAgICAgIDAgfCB0X2Zyb20ob2JqKSB8IHRfcmVzcChvYmopIHwgdDAob2JqKSB8IHQxKG9iaikgfCB0MihvYmopIHwgdDMob2JqKVxuXG4gICAgYnlCaXRzLmNob29zZSA9IGZ1bmN0aW9uIChvYmosIGxzdCkgOjpcbiAgICAgIGlmIG51bGwgPT0gbHN0IDo6IGxzdCA9IHRoaXMgfHwgYnlCaXRzXG4gICAgICByZXR1cm4gbHN0W3Rlc3RCaXRzKG9iaildXG5cblxuICBmb3IgY29uc3QgVCBvZiBmcm1fdHJhbnNwb3J0cyA6OlxuICAgIGNvbnN0IHtiaXRzOmIsIHNpemUsIHRyYW5zcG9ydH0gPSBUXG5cbiAgICBieUJpdHNbYnwwXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MCwgbWFzaywgc2l6ZTogc2l6ZSwgb3A6ICcnXG4gICAgYnlCaXRzW2J8MV0gPSBAe30gVCwgdHJhbnNwb3J0LCBiaXRzOiBifDEsIG1hc2ssIHNpemU6IDggKyBzaXplLCBvcDogJ2YnXG4gICAgYnlCaXRzW2J8Ml0gPSBAe30gVCwgdHJhbnNwb3J0LCBiaXRzOiBifDIsIG1hc2ssIHNpemU6IDggKyBzaXplLCBvcDogJ3InXG4gICAgYnlCaXRzW2J8M10gPSBAe30gVCwgdHJhbnNwb3J0LCBiaXRzOiBifDMsIG1hc2ssIHNpemU6IDE2ICsgc2l6ZSwgb3A6ICdmcidcblxuICAgIGZvciBjb25zdCBmbl9rZXkgb2YgWydmX3BhY2snLCAnZl91bnBhY2snXSA6OlxuICAgICAgY29uc3QgZm5fdHJhbiA9IFRbZm5fa2V5XSwgZm5fZnJvbSA9IGZybV9mcm9tW2ZuX2tleV0sIGZuX3Jlc3AgPSBmcm1fcmVzcFtmbl9rZXldXG5cbiAgICAgIGJ5Qml0c1tifDBdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl90cmFuKG9iaiwgZHYsIDApXG4gICAgICBieUJpdHNbYnwxXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fZnJvbShvYmosIGR2LCAwKTsgZm5fdHJhbihvYmosIGR2LCA4KVxuICAgICAgYnlCaXRzW2J8Ml1bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX3Jlc3Aob2JqLCBkdiwgMCk7IGZuX3RyYW4ob2JqLCBkdiwgOClcbiAgICAgIGJ5Qml0c1tifDNdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl9mcm9tKG9iaiwgZHYsIDApOyBmbl9yZXNwKG9iaiwgZHYsIDgpOyBmbl90cmFuKG9iaiwgZHYsIDE2KVxuXG4gIGZvciBjb25zdCBmcm0gb2YgYnlCaXRzIDo6XG4gICAgYmluZEFzc2VtYmxlZCBAIGZybVxuXG4gIHJldHVybiBieUJpdHNcblxuXG5mdW5jdGlvbiBiaW5kQXNzZW1ibGVkKGZybSkgOjpcbiAgY29uc3Qge1QsIHNpemUsIGZfcGFjaywgZl91bnBhY2t9ID0gZnJtXG4gIGlmIFQuYmluZF9zZXFfbmV4dCA6OlxuICAgIGZybS5zZXFfbmV4dCA9IFQuYmluZF9zZXFfbmV4dCBAIGZybS5zaXplIC0gVC5zaXplXG5cbiAgZGVsZXRlIGZybS5UXG4gIGZybS5wYWNrID0gcGFjayA7IGZybS51bnBhY2sgPSB1bnBhY2tcbiAgY29uc3Qgc2VxX25leHQgPSBmcm0uc2VxX25leHRcblxuICBmdW5jdGlvbiBwYWNrKHBrdF90eXBlLCBwa3Rfb2JqKSA6OlxuICAgIGlmICEgQCAwIDw9IHBrdF90eXBlICYmIHBrdF90eXBlIDw9IDI1NSA6OlxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvciBAIGBFeHBlY3RlZCBwa3RfdHlwZSB0byBiZSBbMC4uMjU1XWBcblxuICAgIHBrdF9vYmoudHlwZSA9IHBrdF90eXBlXG4gICAgaWYgc2VxX25leHQgJiYgbnVsbCA9PSBwa3Rfb2JqLnNlcSA6OlxuICAgICAgcGt0X29iai5zZXEgPSB0cnVlXG5cbiAgICBjb25zdCBkdiA9IG5ldyBEYXRhVmlldyBAIG5ldyBBcnJheUJ1ZmZlcihzaXplKVxuICAgIGZfcGFjayhwa3Rfb2JqLCBkdiwgMClcbiAgICBwa3Rfb2JqLmhlYWRlciA9IGR2LmJ1ZmZlclxuXG4gICAgaWYgdHJ1ZSA9PT0gcGt0X29iai5zZXEgOjpcbiAgICAgIF9iaW5kX2l0ZXJhYmxlIEAgcGt0X29iaiwgZHYuYnVmZmVyLnNsaWNlKDAsc2l6ZSlcblxuICBmdW5jdGlvbiB1bnBhY2socGt0KSA6OlxuICAgIGNvbnN0IGJ1ZiA9IHBrdC5oZWFkZXJfYnVmZmVyKClcbiAgICBjb25zdCBkdiA9IG5ldyBEYXRhVmlldyBAIG5ldyBVaW50OEFycmF5KGJ1ZikuYnVmZmVyXG5cbiAgICBjb25zdCBpbmZvID0ge31cbiAgICBmX3VucGFjayhpbmZvLCBkdiwgMClcbiAgICByZXR1cm4gcGt0LmluZm8gPSBpbmZvXG5cbiAgZnVuY3Rpb24gX2JpbmRfaXRlcmFibGUocGt0X29iaiwgYnVmX2Nsb25lKSA6OlxuICAgIGNvbnN0IHt0eXBlfSA9IHBrdF9vYmpcbiAgICBjb25zdCB7aWRfcm91dGVyLCBpZF90YXJnZXQsIHR0bCwgdG9rZW59ID0gcGt0X29ialxuICAgIHBrdF9vYmoubmV4dCA9IG5leHRcblxuICAgIGZ1bmN0aW9uIG5leHQob3B0aW9ucykgOjpcbiAgICAgIGlmIG51bGwgPT0gb3B0aW9ucyA6OiBvcHRpb25zID0ge31cbiAgICAgIGNvbnN0IGhlYWRlciA9IGJ1Zl9jbG9uZS5zbGljZSgpXG4gICAgICBzZXFfbmV4dCBAIG9wdGlvbnMsIG5ldyBEYXRhVmlldyBAIGhlYWRlclxuICAgICAgcmV0dXJuIEB7fSBkb25lOiAhISBvcHRpb25zLmZpbiwgdmFsdWU6IEB7fSAvLyBwa3Rfb2JqXG4gICAgICAgIGlkX3JvdXRlciwgaWRfdGFyZ2V0LCB0eXBlLCB0dGwsIHRva2VuLCBoZWFkZXJcblxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtjb25jYXRCdWZmZXJzfSA9IHBhY2tldFBhcnNlclxuICByZXR1cm4gQHt9IGNyZWF0ZU11bHRpcGFydFxuXG5cbiAgZnVuY3Rpb24gY3JlYXRlTXVsdGlwYXJ0KHBrdCwgc2luaywgZGVsZXRlU3RhdGUpIDo6XG4gICAgbGV0IHBhcnRzID0gW10sIGZpbiA9IGZhbHNlXG4gICAgcmV0dXJuIEB7fSBmZWVkLCBpbmZvOiBwa3QuaW5mb1xuXG4gICAgZnVuY3Rpb24gZmVlZChwa3QpIDo6XG4gICAgICBsZXQgc2VxID0gcGt0LmluZm8uc2VxXG4gICAgICBpZiBzZXEgPCAwIDo6IGZpbiA9IHRydWU7IHNlcSA9IC1zZXFcbiAgICAgIHBhcnRzW3NlcS0xXSA9IHBrdC5ib2R5X2J1ZmZlcigpXG5cbiAgICAgIGlmICEgZmluIDo6IHJldHVyblxuICAgICAgaWYgcGFydHMuaW5jbHVkZXMgQCB1bmRlZmluZWQgOjogcmV0dXJuXG5cbiAgICAgIGRlbGV0ZVN0YXRlKClcblxuICAgICAgY29uc3QgcmVzID0gY29uY2F0QnVmZmVycyhwYXJ0cylcbiAgICAgIHBhcnRzID0gbnVsbFxuICAgICAgcmV0dXJuIHJlc1xuXG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwYWNrZXRQYXJzZXIsIHNoYXJlZCkgOjpcbiAgcmV0dXJuIEB7fSBjcmVhdGVTdHJlYW1cblxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVN0cmVhbShwa3QsIHNpbmssIGRlbGV0ZVN0YXRlKSA6OlxuICAgIGxldCBuZXh0PTAsIGZpbiA9IGZhbHNlLCByZWN2RGF0YSwgcnN0cmVhbVxuICAgIGNvbnN0IHN0YXRlID0gQHt9IGZlZWQ6IGZlZWRfaW5pdCwgaW5mbzogcGt0LmluZm9cbiAgICByZXR1cm4gc3RhdGVcblxuICAgIGZ1bmN0aW9uIGZlZWRfaW5pdChwa3QsIGFzX2NvbnRlbnQsIG1zZ191bnBhY2spIDo6XG4gICAgICBzdGF0ZS5mZWVkID0gZmVlZF9pZ25vcmVcblxuICAgICAgY29uc3QgaW5mbyA9IHBrdC5pbmZvXG4gICAgICBjb25zdCBtc2cgPSBtc2dfdW5wYWNrXG4gICAgICAgID8gbXNnX3VucGFjayhwa3QsIHNpbmspXG4gICAgICAgIDogc2luay5qc29uX3VucGFjayBAIHBrdC5ib2R5X3V0ZjgoKVxuICAgICAgcnN0cmVhbSA9IHNpbmsucmVjdlN0cmVhbShtc2csIGluZm8pXG4gICAgICBpZiBudWxsID09IHJzdHJlYW0gOjogcmV0dXJuXG4gICAgICBjaGVja19mbnMgQCByc3RyZWFtLCAnb25fZXJyb3InLCAnb25fZGF0YScsICdvbl9lbmQnIFxuICAgICAgcmVjdkRhdGEgPSBzaW5rLnJlY3ZTdHJlYW1EYXRhLmJpbmQoc2luaywgcnN0cmVhbSwgaW5mbylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGZlZWRfc2VxKHBrdClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9lcnJvciBAIGVyciwgcGt0XG5cbiAgICAgIHN0YXRlLmZlZWQgPSBmZWVkX2JvZHlcbiAgICAgIGlmIHJzdHJlYW0ub25faW5pdCA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9pbml0KG1zZywgcGt0KVxuXG4gICAgZnVuY3Rpb24gZmVlZF9ib2R5KHBrdCwgYXNfY29udGVudCkgOjpcbiAgICAgIHJlY3ZEYXRhKClcbiAgICAgIGxldCBkYXRhXG4gICAgICB0cnkgOjpcbiAgICAgICAgZmVlZF9zZXEocGt0KVxuICAgICAgICBkYXRhID0gYXNfY29udGVudChwa3QsIHNpbmspXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZXJyb3IgQCBlcnIsIHBrdFxuXG4gICAgICBpZiBmaW4gOjpcbiAgICAgICAgY29uc3QgcmVzID0gcnN0cmVhbS5vbl9kYXRhIEAgZGF0YSwgcGt0XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2VuZCBAIHJlcywgcGt0XG4gICAgICBlbHNlIDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2RhdGEgQCBkYXRhLCBwa3RcblxuICAgIGZ1bmN0aW9uIGZlZWRfaWdub3JlKHBrdCkgOjpcbiAgICAgIHRyeSA6OiBmZWVkX3NlcShwa3QpXG4gICAgICBjYXRjaCBlcnIgOjpcblxuICAgIGZ1bmN0aW9uIGZlZWRfc2VxKHBrdCkgOjpcbiAgICAgIGxldCBzZXEgPSBwa3QuaW5mby5zZXFcbiAgICAgIGlmIHNlcSA+PSAwIDo6XG4gICAgICAgIGlmIG5leHQrKyA9PT0gc2VxIDo6XG4gICAgICAgICAgcmV0dXJuIC8vIGluIG9yZGVyXG4gICAgICBlbHNlIDo6XG4gICAgICAgIGZpbiA9IHRydWVcbiAgICAgICAgZGVsZXRlU3RhdGUoKVxuICAgICAgICBpZiBuZXh0ID09PSAtc2VxIDo6XG4gICAgICAgICAgbmV4dCA9ICdkb25lJ1xuICAgICAgICAgIHJldHVybiAvLyBpbi1vcmRlciwgbGFzdCBwYWNrZXRcblxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfaWdub3JlXG4gICAgICBuZXh0ID0gJ2ludmFsaWQnXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgUGFja2V0IG91dCBvZiBzZXF1ZW5jZWBcblxuXG5mdW5jdGlvbiBjaGVja19mbnMob2JqLCAuLi5rZXlzKSA6OlxuICBmb3IgY29uc3Qga2V5IG9mIGtleXMgOjpcbiAgICBpZiAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygb2JqW2tleV0gOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgRXhwZWN0ZWQgXCIke2tleX1cIiB0byBiZSBhIGZ1bmN0aW9uYFxuXG4iLCJpbXBvcnQgZnJhbWluZ3MgZnJvbSAnLi9mcmFtaW5nLmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtwYWNrUGFja2V0T2JqfSA9IHBhY2tldFBhcnNlclxuICBjb25zdCB7cmFuZG9tX2lkLCBqc29uX3BhY2t9ID0gc2hhcmVkXG4gIGNvbnN0IHtjaG9vc2U6IGNob29zZUZyYW1pbmd9ID0gZnJhbWluZ3NcblxuICBjb25zdCBmcmFnbWVudF9zaXplID0gTnVtYmVyIEAgc2hhcmVkLmZyYWdtZW50X3NpemUgfHwgODAwMFxuICBpZiAxMDI0ID4gZnJhZ21lbnRfc2l6ZSB8fCA2NTAwMCA8IGZyYWdtZW50X3NpemUgOjpcbiAgICB0aHJvdyBuZXcgRXJyb3IgQCBgSW52YWxpZCBmcmFnbWVudCBzaXplOiAke2ZyYWdtZW50X3NpemV9YFxuXG4gIHJldHVybiBAe30gYmluZFRyYW5zcG9ydHMsIHBhY2tldEZyYWdtZW50cywgY2hvb3NlRnJhbWluZ1xuXG5cbiAgZnVuY3Rpb24gYmluZFRyYW5zcG9ydHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpIDo6XG4gICAgY29uc3QgcGFja0JvZHkgPSB0cmFuc3BvcnRzLnBhY2tCb2R5XG4gICAgY29uc3Qgb3V0Ym91bmQgPSBiaW5kVHJhbnNwb3J0SW1wbHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpXG5cbiAgICBpZiB0cmFuc3BvcnRzLnN0cmVhbWluZyA6OlxuICAgICAgcmV0dXJuIEB7fSBzZW5kLCBzdHJlYW06IGJpbmRTdHJlYW0oKVxuXG4gICAgcmV0dXJuIEB7fSBzZW5kXG5cblxuXG4gICAgZnVuY3Rpb24gc2VuZChjaGFuLCBvYmosIGJvZHkpIDo6XG4gICAgICBib2R5ID0gcGFja0JvZHkoYm9keSwgb2JqLCBjaGFuKVxuICAgICAgaWYgZnJhZ21lbnRfc2l6ZSA8IGJvZHkuYnl0ZUxlbmd0aCA6OlxuICAgICAgICBpZiAhIG9iai50b2tlbiA6OiBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgICAgICBvYmoudHJhbnNwb3J0ID0gJ211bHRpcGFydCdcbiAgICAgICAgY29uc3QgbXNlbmQgPSBtc2VuZF9ieXRlcyhjaGFuLCBvYmopXG4gICAgICAgIHJldHVybiBtc2VuZCBAIHRydWUsIGJvZHlcblxuICAgICAgb2JqLnRyYW5zcG9ydCA9ICdzaW5nbGUnXG4gICAgICBvYmouYm9keSA9IGJvZHlcbiAgICAgIGNvbnN0IHBhY2tfaGRyID0gb3V0Ym91bmQuY2hvb3NlKG9iailcbiAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBwYWNrX2hkcihvYmopXG4gICAgICByZXR1cm4gY2hhbi5zZW5kIEAgcGt0XG5cblxuICAgIGZ1bmN0aW9uIG1zZW5kX2J5dGVzKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgY29uc3QgcGFja19oZHIgPSBvdXRib3VuZC5jaG9vc2Uob2JqKVxuICAgICAgbGV0IHtuZXh0fSA9IHBhY2tfaGRyKG9iailcbiAgICAgIGlmIG51bGwgIT09IG1zZyA6OlxuICAgICAgICBvYmouYm9keSA9IG1zZ1xuICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgIGNoYW4uc2VuZCBAIHBrdFxuXG4gICAgICByZXR1cm4gYXN5bmMgZnVuY3Rpb24gKGZpbiwgYm9keSkgOjpcbiAgICAgICAgaWYgbnVsbCA9PT0gbmV4dCA6OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBAICdXcml0ZSBhZnRlciBlbmQnXG4gICAgICAgIGxldCByZXNcbiAgICAgICAgZm9yIGNvbnN0IG9iaiBvZiBwYWNrZXRGcmFnbWVudHMgQCBib2R5LCBuZXh0LCBmaW4gOjpcbiAgICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgICAgcmVzID0gYXdhaXQgY2hhbi5zZW5kIEAgcGt0XG4gICAgICAgIGlmIGZpbiA6OiBuZXh0ID0gbnVsbFxuICAgICAgICByZXR1cm4gcmVzXG5cblxuICAgIGZ1bmN0aW9uIG1zZW5kX29iamVjdHMoY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICBjb25zdCBwYWNrX2hkciA9IG91dGJvdW5kLmNob29zZShvYmopXG4gICAgICBsZXQge25leHR9ID0gcGFja19oZHIob2JqKVxuICAgICAgaWYgbnVsbCAhPT0gbXNnIDo6XG4gICAgICAgIG9iai5ib2R5ID0gbXNnXG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgY2hhbi5zZW5kIEAgcGt0XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbiAoZmluLCBib2R5KSA6OlxuICAgICAgICBpZiBudWxsID09PSBuZXh0IDo6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgJ1dyaXRlIGFmdGVyIGVuZCdcbiAgICAgICAgY29uc3Qgb2JqID0gbmV4dCh7ZmlufSlcbiAgICAgICAgb2JqLmJvZHkgPSBib2R5XG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgaWYgZmluIDo6IG5leHQgPSBudWxsXG4gICAgICAgIHJldHVybiBjaGFuLnNlbmQgQCBwa3RcblxuXG4gICAgZnVuY3Rpb24gYmluZFN0cmVhbSgpIDo6XG4gICAgICBjb25zdCB7bW9kZSwgbXNnX3BhY2t9ID0gdHJhbnNwb3J0cy5zdHJlYW1pbmdcbiAgICAgIGNvbnN0IG1zZW5kX2ltcGwgPSB7b2JqZWN0OiBtc2VuZF9vYmplY3RzLCBieXRlczogbXNlbmRfYnl0ZXN9W21vZGVdXG4gICAgICBpZiBtc2VuZF9pbXBsIDo6IHJldHVybiBzdHJlYW1cblxuICAgICAgZnVuY3Rpb24gc3RyZWFtKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgICBpZiAhIG9iai50b2tlbiA6OiBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgICAgICBvYmoudHJhbnNwb3J0ID0gJ3N0cmVhbWluZydcbiAgICAgICAgbXNnID0gbXNnX3BhY2tcbiAgICAgICAgICA/IG1zZ19wYWNrKG1zZywgb2JqLCBjaGFuKVxuICAgICAgICAgIDoganNvbl9wYWNrKG1zZylcbiAgICAgICAgY29uc3QgbXNlbmQgPSBtc2VuZF9pbXBsIEAgY2hhbiwgb2JqLCBtc2dcbiAgICAgICAgd3JpdGUud3JpdGUgPSB3cml0ZTsgd3JpdGUuZW5kID0gd3JpdGUuYmluZCh0cnVlKVxuICAgICAgICByZXR1cm4gd3JpdGVcblxuICAgICAgICBmdW5jdGlvbiB3cml0ZShjaHVuaykgOjpcbiAgICAgICAgICAvLyBtc2VuZCBAIGZpbiwgYm9keVxuICAgICAgICAgIHJldHVybiBjaHVuayAhPSBudWxsXG4gICAgICAgICAgICA/IG1zZW5kIEAgdHJ1ZT09PXRoaXMsIHBhY2tCb2R5KGNodW5rLCBvYmosIGNoYW4pXG4gICAgICAgICAgICA6IG1zZW5kIEAgdHJ1ZVxuXG5cbiAgZnVuY3Rpb24gKiBwYWNrZXRGcmFnbWVudHMoYnVmLCBuZXh0X2hkciwgZmluKSA6OlxuICAgIGlmIG51bGwgPT0gYnVmIDo6XG4gICAgICBjb25zdCBvYmogPSBuZXh0X2hkcih7ZmlufSlcbiAgICAgIHlpZWxkIG9ialxuICAgICAgcmV0dXJuXG5cbiAgICBsZXQgaSA9IDAsIGxhc3RJbm5lciA9IGJ1Zi5ieXRlTGVuZ3RoIC0gZnJhZ21lbnRfc2l6ZTtcbiAgICB3aGlsZSBpIDwgbGFzdElubmVyIDo6XG4gICAgICBjb25zdCBpMCA9IGlcbiAgICAgIGkgKz0gZnJhZ21lbnRfc2l6ZVxuXG4gICAgICBjb25zdCBvYmogPSBuZXh0X2hkcigpXG4gICAgICBvYmouYm9keSA9IGJ1Zi5zbGljZShpMCwgaSlcbiAgICAgIHlpZWxkIG9ialxuXG4gICAgOjpcbiAgICAgIGNvbnN0IG9iaiA9IG5leHRfaGRyKHtmaW59KVxuICAgICAgb2JqLmJvZHkgPSBidWYuc2xpY2UoaSlcbiAgICAgIHlpZWxkIG9ialxuXG5cblxuXG4vLyBtb2R1bGUtbGV2ZWwgaGVscGVyIGZ1bmN0aW9uc1xuXG5mdW5jdGlvbiBiaW5kVHJhbnNwb3J0SW1wbHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpIDo6XG4gIGNvbnN0IG91dGJvdW5kID0gW11cbiAgb3V0Ym91bmQuY2hvb3NlID0gZnJhbWluZ3MuY2hvb3NlXG5cbiAgZm9yIGNvbnN0IGZyYW1lIG9mIGZyYW1pbmdzIDo6XG4gICAgY29uc3QgaW1wbCA9IGZyYW1lID8gdHJhbnNwb3J0c1tmcmFtZS50cmFuc3BvcnRdIDogbnVsbFxuICAgIGlmICEgaW1wbCA6OiBjb250aW51ZVxuXG4gICAgY29uc3Qge2JpdHMsIHBhY2ssIHVucGFja30gPSBmcmFtZVxuICAgIGNvbnN0IHBrdF90eXBlID0gaGlnaGJpdHMgfCBiaXRzXG4gICAgY29uc3Qge3RfcmVjdn0gPSBpbXBsXG5cbiAgICBmdW5jdGlvbiBwYWNrX2hkcihvYmopIDo6XG4gICAgICBwYWNrKHBrdF90eXBlLCBvYmopXG4gICAgICByZXR1cm4gb2JqXG5cbiAgICBmdW5jdGlvbiByZWN2X21zZyhwa3QsIHNpbmspIDo6XG4gICAgICB1bnBhY2socGt0KVxuICAgICAgcmV0dXJuIHRfcmVjdihwa3QsIHNpbmspXG5cbiAgICBwYWNrX2hkci5wa3RfdHlwZSA9IHJlY3ZfbXNnLnBrdF90eXBlID0gcGt0X3R5cGVcbiAgICBvdXRib3VuZFtiaXRzXSA9IHBhY2tfaGRyXG4gICAgaW5ib3VuZFtwa3RfdHlwZV0gPSByZWN2X21zZ1xuXG4gICAgaWYgJ3Byb2R1Y3Rpb24nICE9PSBwcm9jZXNzLmVudi5OT0RFX0VOViA6OlxuICAgICAgY29uc3Qgb3AgPSBwYWNrX2hkci5vcCA9IHJlY3ZfbXNnLm9wID0gZnJhbWUub3BcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBAIHBhY2tfaGRyLCAnbmFtZScsIEB7fSB2YWx1ZTogYHBhY2tfaGRyIMKrJHtvcH3Cu2BcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBAIHJlY3ZfbXNnLCAnbmFtZScsIEB7fSB2YWx1ZTogYHJlY3ZfbXNnIMKrJHtvcH3Cu2BcblxuICByZXR1cm4gb3V0Ym91bmRcblxuIiwiZXhwb3J0ICogZnJvbSAnLi9mcmFtaW5nLmpzeSdcbmV4cG9ydCAqIGZyb20gJy4vbXVsdGlwYXJ0LmpzeSdcbmV4cG9ydCAqIGZyb20gJy4vc3RyZWFtaW5nLmpzeSdcbmV4cG9ydCAqIGZyb20gJy4vdHJhbnNwb3J0LmpzeSdcblxuaW1wb3J0IG11bHRpcGFydCBmcm9tICcuL211bHRpcGFydC5qc3knXG5pbXBvcnQgc3RyZWFtaW5nIGZyb20gJy4vc3RyZWFtaW5nLmpzeSdcbmltcG9ydCB0cmFuc3BvcnQgZnJvbSAnLi90cmFuc3BvcnQuanN5J1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpbml0X3NoYXJlZChwYWNrZXRQYXJzZXIsIG9wdGlvbnMpIDo6XG4gIGNvbnN0IHNoYXJlZCA9IE9iamVjdC5hc3NpZ24gQCB7cGFja2V0UGFyc2VyLCBzdGF0ZUZvcn0sIG9wdGlvbnNcblxuICBPYmplY3QuYXNzaWduIEAgc2hhcmVkLFxuICAgIG11bHRpcGFydCBAIHBhY2tldFBhcnNlciwgc2hhcmVkXG4gICAgc3RyZWFtaW5nIEAgcGFja2V0UGFyc2VyLCBzaGFyZWRcbiAgICB0cmFuc3BvcnQgQCBwYWNrZXRQYXJzZXIsIHNoYXJlZFxuXG4gIHJldHVybiBzaGFyZWRcblxuZnVuY3Rpb24gc3RhdGVGb3IocGt0LCBzaW5rLCBjcmVhdGVTdGF0ZSkgOjpcbiAgY29uc3Qge2J5X21zZ2lkfSA9IHNpbmssIHttc2dpZH0gPSBwa3QuaW5mb1xuICBsZXQgc3RhdGUgPSBieV9tc2dpZC5nZXQobXNnaWQpXG4gIGlmIHVuZGVmaW5lZCA9PT0gc3RhdGUgOjpcbiAgICBpZiAhIG1zZ2lkIDo6IHRocm93IG5ldyBFcnJvciBAIGBJbnZhbGlkIG1zZ2lkOiAke21zZ2lkfWBcblxuICAgIHN0YXRlID0gY3JlYXRlU3RhdGUgQCBwa3QsIHNpbmssICgpID0+IGJ5X21zZ2lkLmRlbGV0ZShtc2dpZClcbiAgICBieV9tc2dpZC5zZXQgQCBtc2dpZCwgc3RhdGVcbiAgcmV0dXJuIHN0YXRlXG5cbiIsImNvbnN0IG5vb3BfZW5jb2RpbmdzID0gQHt9XG4gIGVuY29kZShidWYsIG9iaiwgY2hhbikgOjogcmV0dXJuIGJ1ZlxuICBkZWNvZGUoYnVmLCBpbmZvLCBzaW5rKSA6OiByZXR1cm4gYnVmXG5cbmV4cG9ydCBkZWZhdWx0IGpzb25fcHJvdG9jb2xcbmV4cG9ydCBmdW5jdGlvbiBqc29uX3Byb3RvY29sKHNoYXJlZCwge2VuY29kZSwgZGVjb2RlfT1ub29wX2VuY29kaW5ncykgOjpcbiAgY29uc3Qge3N0YXRlRm9yLCBjcmVhdGVNdWx0aXBhcnQsIGNyZWF0ZVN0cmVhbSwganNvbl9wYWNrfSA9IHNoYXJlZFxuICBjb25zdCB7cGFja191dGY4LCB1bnBhY2tfdXRmOH0gPSBzaGFyZWQucGFja2V0UGFyc2VyXG4gIGNvbnN0IHN0cmVhbV9tc2dfdW5wYWNrID0gYXNfanNvbl9jb250ZW50XG5cbiAgcmV0dXJuIEB7fVxuICAgIHBhY2tCb2R5XG5cbiAgICBnZXQgZGF0YWdyYW0oKSA6OiByZXR1cm4gdGhpcy5kaXJlY3RcbiAgICBkaXJlY3Q6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3QgaW5mbyA9IHBrdC5pbmZvXG4gICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBwa3QuYm9keV9idWZmZXIoKSwgaW5mbywgc2lua1xuICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBpbmZvXG5cbiAgICBtdWx0aXBhcnQ6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlTXVsdGlwYXJ0XG4gICAgICAgIGNvbnN0IGJvZHlfYnVmID0gc3RhdGUuZmVlZChwa3QpXG4gICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gYm9keV9idWYgOjpcbiAgICAgICAgICBjb25zdCBpbmZvID0gc3RhdGUuaW5mb1xuICAgICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1ZiwgaW5mbywgc2lua1xuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIGluZm9cblxuICAgIHN0cmVhbWluZzogQHt9XG4gICAgICBtb2RlOiAnb2JqZWN0J1xuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlU3RyZWFtXG4gICAgICAgIHJldHVybiBzdGF0ZS5mZWVkKHBrdCwgYXNfanNvbl9jb250ZW50LCBzdHJlYW1fbXNnX3VucGFjaylcblxuICAgICAgbXNnX3BhY2sobXNnLCBvYmosIGNoYW4pIDo6XG4gICAgICAgIGNvbnN0IG1zZ19idWYgPSBwYWNrX3V0ZjggQCBqc29uX3BhY2sgQCBtc2dcbiAgICAgICAgcmV0dXJuIGVuY29kZShtc2dfYnVmLCBvYmosIGNoYW4pXG5cblxuICBmdW5jdGlvbiBwYWNrQm9keShib2R5LCBvYmosIGNoYW4pIDo6XG4gICAgY29uc3QgYm9keV9idWYgPSBwYWNrX3V0ZjggQCBqc29uX3BhY2sgQCBib2R5XG4gICAgcmV0dXJuIGVuY29kZShib2R5X2J1Ziwgb2JqLCBjaGFuKVxuXG4gIGZ1bmN0aW9uIGFzX2pzb25fY29udGVudChwa3QsIHNpbmspIDo6XG4gICAgY29uc3QganNvbl9idWYgPSBkZWNvZGUocGt0LmJvZHlfYnVmZmVyKCksIHBrdC5pbmZvLCBzaW5rKVxuICAgIHJldHVybiBzaW5rLmpzb25fdW5wYWNrIEAgdW5wYWNrX3V0ZjggQCBqc29uX2J1ZlxuXG4gIGZ1bmN0aW9uIHVucGFja0JvZHlCdWYoYm9keV9idWYsIGluZm8sIHNpbmspIDo6XG4gICAgY29uc3QganNvbl9idWYgPSBkZWNvZGUoYm9keV9idWYsIGluZm8sIHNpbmspXG4gICAgcmV0dXJuIHNpbmsuanNvbl91bnBhY2sgQCBqc29uX2J1ZiA/IHVucGFja191dGY4KGpzb25fYnVmKSA6IHVuZGVmaW5lZFxuXG4iLCJjb25zdCBub29wX2VuY29kaW5ncyA9IEB7fVxuICBlbmNvZGUoYnVmLCBvYmosIGNoYW4pIDo6IHJldHVybiBidWZcbiAgZGVjb2RlKGJ1ZiwgaW5mbywgc2luaykgOjogcmV0dXJuIGJ1ZlxuXG5leHBvcnQgZGVmYXVsdCBiaW5hcnlfcHJvdG9jb2xcbmV4cG9ydCBmdW5jdGlvbiBiaW5hcnlfcHJvdG9jb2woc2hhcmVkLCB7ZW5jb2RlLCBkZWNvZGV9PW5vb3BfZW5jb2RpbmdzKSA6OlxuICBjb25zdCB7c3RhdGVGb3IsIGNyZWF0ZU11bHRpcGFydCwgY3JlYXRlU3RyZWFtfSA9IHNoYXJlZFxuICBjb25zdCB7YXNCdWZmZXJ9ID0gc2hhcmVkLnBhY2tldFBhcnNlclxuXG4gIHJldHVybiBAe31cbiAgICBwYWNrQm9keVxuXG4gICAgZ2V0IGRhdGFncmFtKCkgOjogcmV0dXJuIHRoaXMuZGlyZWN0XG4gICAgZGlyZWN0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IGluZm8gPSBwa3QuaW5mb1xuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHBrdC5ib2R5X2J1ZmZlcigpXG4gICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1ZiwgaW5mbywgc2lua1xuICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBpbmZvXG5cbiAgICBtdWx0aXBhcnQ6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlTXVsdGlwYXJ0XG4gICAgICAgIGNvbnN0IGJvZHlfYnVmID0gc3RhdGUuZmVlZChwa3QpXG4gICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gYm9keV9idWYgOjpcbiAgICAgICAgICBjb25zdCBpbmZvID0gc3RhdGUuaW5mb1xuICAgICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1ZiwgaW5mbywgc2lua1xuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIGluZm9cblxuICAgIHN0cmVhbWluZzogQHt9XG4gICAgICBtb2RlOiAnYnl0ZXMnXG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0YXRlRm9yIEAgcGt0LCBzaW5rLCBjcmVhdGVTdHJlYW1cbiAgICAgICAgY29uc3QgYm9keV9idWYgPSBzdGF0ZS5mZWVkKHBrdCwgcGt0X2J1ZmZlciwgc3RyZWFtX21zZ191bnBhY2spXG4gICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gYm9keV9idWYgOjpcbiAgICAgICAgICBjb25zdCBpbmZvID0gc3RhdGUuaW5mb1xuICAgICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1ZiwgaW5mbywgc2lua1xuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIGluZm9cblxuICAgICAgbXNnX3BhY2sobXNnLCBvYmosIGNoYW4pIDo6XG4gICAgICAgIGNvbnN0IG1zZ19idWYgPSBwYWNrX3V0ZjggQCBqc29uX3BhY2sgQCBtc2dcbiAgICAgICAgcmV0dXJuIGVuY29kZShtc2dfYnVmLCBvYmosIGNoYW4pXG5cblxuICBmdW5jdGlvbiBzdHJlYW1fbXNnX3VucGFjayhwa3QsIHNpbmspIDo6XG4gICAgY29uc3QganNvbl9idWYgPSBkZWNvZGUocGt0LmJvZHlfYnVmZmVyKCksIHBrdC5pbmZvLCBzaW5rKVxuICAgIHJldHVybiBzaW5rLmpzb25fdW5wYWNrIEAgdW5wYWNrX3V0ZjgoanNvbl9idWYpXG5cbiAgZnVuY3Rpb24gcGFja0JvZHkoYm9keSwgb2JqLCBjaGFuKSA6OlxuICAgIGNvbnN0IGJvZHlfYnVmID0gYXNCdWZmZXIgQCBib2R5XG4gICAgcmV0dXJuIGVuY29kZShib2R5X2J1Ziwgb2JqLCBjaGFuKVxuICBmdW5jdGlvbiB1bnBhY2tCb2R5QnVmKGJvZHlfYnVmLCBpbmZvLCBzaW5rKSA6OlxuICAgIHJldHVybiBkZWNvZGUoYm9keV9idWYsIGluZm8sIHNpbmspXG5cbmZ1bmN0aW9uIHBrdF9idWZmZXIocGt0KSA6OiByZXR1cm4gcGt0LmJvZHlfYnVmZmVyKClcblxuIiwiZXhwb3J0IGRlZmF1bHQgY29udHJvbF9wcm90b2NvbFxuZXhwb3J0IGZ1bmN0aW9uIGNvbnRyb2xfcHJvdG9jb2woaW5ib3VuZCwgaGlnaCwgc2hhcmVkKSA6OlxuICBjb25zdCB7Y2hvb3NlRnJhbWluZywgcmFuZG9tX2lkfSA9IHNoYXJlZFxuICBjb25zdCB7cGFja1BhY2tldE9ian0gPSBzaGFyZWQucGFja2V0UGFyc2VyXG5cbiAgY29uc3QgcGluZ19mcmFtZSA9IGNob29zZUZyYW1pbmcgQDogZnJvbV9pZDogdHJ1ZSwgdG9rZW46IHRydWUsIHRyYW5zcG9ydDogJ2RpcmVjdCdcbiAgY29uc3QgcG9uZ19mcmFtZSA9IGNob29zZUZyYW1pbmcgQDogZnJvbV9pZDogdHJ1ZSwgbXNnaWQ6IHRydWUsIHRyYW5zcG9ydDogJ2RhdGFncmFtJ1xuXG4gIGNvbnN0IHBvbmdfdHlwZSA9IGhpZ2h8MHhlXG4gIGluYm91bmRbcG9uZ190eXBlXSA9IHJlY3ZfcG9uZ1xuICBjb25zdCBwaW5nX3R5cGUgPSBoaWdofDB4ZlxuICBpbmJvdW5kW2hpZ2h8MHhmXSA9IHJlY3ZfcGluZ1xuXG4gIHJldHVybiBAe30gc2VuZDpwaW5nLCBwaW5nXG5cbiAgZnVuY3Rpb24gcGluZyhjaGFuLCBvYmopIDo6XG4gICAgaWYgISBvYmoudG9rZW4gOjpcbiAgICAgIG9iai50b2tlbiA9IHJhbmRvbV9pZCgpXG4gICAgb2JqLmJvZHkgPSBKU09OLnN0cmluZ2lmeSBAOlxuICAgICAgb3A6ICdwaW5nJywgdHMwOiBuZXcgRGF0ZSgpXG4gICAgcGluZ19mcmFtZS5wYWNrKHBpbmdfdHlwZSwgb2JqKVxuICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICByZXR1cm4gY2hhbi5zZW5kIEAgcGt0XG5cbiAgZnVuY3Rpb24gcmVjdl9waW5nKHBrdCwgc2luaywgcm91dGVyKSA6OlxuICAgIHBpbmdfZnJhbWUudW5wYWNrKHBrdClcbiAgICBwa3QuYm9keSA9IHBrdC5ib2R5X2pzb24oKVxuICAgIF9zZW5kX3BvbmcgQCBwa3QuYm9keSwgcGt0LCByb3V0ZXJcbiAgICByZXR1cm4gc2luay5yZWN2Q3RybChwa3QuYm9keSwgcGt0LmluZm8pXG5cbiAgZnVuY3Rpb24gX3NlbmRfcG9uZyh7dHMwfSwgcGt0X3BpbmcsIHJvdXRlcikgOjpcbiAgICBjb25zdCB7bXNnaWQsIGlkX3RhcmdldCwgaWRfcm91dGVyLCBmcm9tX2lkOnJfaWR9ID0gcGt0X3BpbmcuaW5mb1xuICAgIGNvbnN0IG9iaiA9IEB7fSBtc2dpZFxuICAgICAgZnJvbV9pZDogQHt9IGlkX3RhcmdldCwgaWRfcm91dGVyXG4gICAgICBpZF9yb3V0ZXI6IHJfaWQuaWRfcm91dGVyLCBpZF90YXJnZXQ6IHJfaWQuaWRfdGFyZ2V0XG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSBAOlxuICAgICAgICBvcDogJ3BvbmcnLCB0czAsIHRzMTogbmV3IERhdGUoKVxuXG4gICAgcG9uZ19mcmFtZS5wYWNrKHBvbmdfdHlwZSwgb2JqKVxuICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICByZXR1cm4gcm91dGVyLmRpc3BhdGNoIEAgW3BrdF1cblxuICBmdW5jdGlvbiByZWN2X3BvbmcocGt0LCBzaW5rKSA6OlxuICAgIHBvbmdfZnJhbWUudW5wYWNrKHBrdClcbiAgICBwa3QuYm9keSA9IHBrdC5ib2R5X2pzb24oKVxuICAgIHJldHVybiBzaW5rLnJlY3ZDdHJsKHBrdC5ib2R5LCBwa3QuaW5mbylcblxuIiwiaW1wb3J0IGluaXRfc2hhcmVkIGZyb20gJy4vc2hhcmVkL2luZGV4LmpzeSdcbmltcG9ydCBqc29uX3Byb3RvY29sIGZyb20gJy4vcHJvdG9jb2xzL2pzb24uanN5J1xuaW1wb3J0IGJpbmFyeV9wcm90b2NvbCBmcm9tICcuL3Byb3RvY29scy9iaW5hcnkuanN5J1xuaW1wb3J0IGNvbnRyb2xfcHJvdG9jb2wgZnJvbSAnLi9wcm90b2NvbHMvY29udHJvbC5qc3knXG5cblxuY29uc3QgZGVmYXVsdF9wbHVnaW5fb3B0aW9ucyA9IEA6XG4gIHBsdWdpbl9uYW1lOiAncHJvdG9jb2xzJ1xuICB1c2VTdGFuZGFyZDogdHJ1ZVxuICBqc29uX3BhY2s6IEpTT04uc3RyaW5naWZ5XG4gIGN1c3RvbShwcm90b2NvbHMpIDo6IHJldHVybiBwcm90b2NvbHNcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwbHVnaW5fb3B0aW9ucykgOjpcbiAgcGx1Z2luX29wdGlvbnMgPSBPYmplY3QuYXNzaWduIEAge30sIGRlZmF1bHRfcGx1Z2luX29wdGlvbnMsIHBsdWdpbl9vcHRpb25zXG4gIGNvbnN0IHsgcGx1Z2luX25hbWUsIHJhbmRvbV9pZCwganNvbl9wYWNrIH0gPSBwbHVnaW5fb3B0aW9uc1xuXG4gIHJldHVybiBAOiBzdWJjbGFzcywgb3JkZXI6IC0xIC8vIGRlcGVuZGVudCBvbiByb3V0ZXIgcGx1Z2luJ3MgKC0yKSBwcm92aWRpbmcgcGFja2V0UGFyc2VyXG4gIFxuICBmdW5jdGlvbiBzdWJjbGFzcyhGYWJyaWNIdWJfUEksIGJhc2VzKSA6OlxuICAgIGNvbnN0IHtwYWNrZXRQYXJzZXJ9ID0gRmFicmljSHViX1BJLnByb3RvdHlwZVxuICAgIGlmIG51bGw9PXBhY2tldFBhcnNlciB8fCAhIHBhY2tldFBhcnNlci5pc1BhY2tldFBhcnNlcigpIDo6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYEludmFsaWQgcGFja2V0UGFyc2VyIGZvciBwbHVnaW5gXG4gICAgXG5cbiAgICBjb25zdCBzaGFyZWQgPSBpbml0X3NoYXJlZCBAIHBhY2tldFBhcnNlciwgQHt9IHJhbmRvbV9pZCwganNvbl9wYWNrXG4gICAgbGV0IHByb3RvY29scyA9IEB7fSBzaGFyZWQsIHJhbmRvbV9pZCwgaW5ib3VuZDogW10sIGNvZGVjczogT2JqZWN0LmNyZWF0ZShudWxsKSwgXG5cbiAgICBpZiBwbHVnaW5fb3B0aW9ucy51c2VTdGFuZGFyZCA6OlxuICAgICAgcHJvdG9jb2xzID0gaW5pdF9wcm90b2NvbHMgQCBwcm90b2NvbHNcblxuICAgIHByb3RvY29scyA9IHBsdWdpbl9vcHRpb25zLmN1c3RvbSBAIHByb3RvY29sc1xuICAgIEZhYnJpY0h1Yl9QSS5wcm90b3R5cGVbcGx1Z2luX25hbWVdID0gcHJvdG9jb2xzXG5cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRfcHJvdG9jb2xzKHByb3RvY29scykgOjpcbiAgY29uc3Qge2luYm91bmQsIGNvZGVjcywgc2hhcmVkfSA9IHByb3RvY29sc1xuXG4gIGNvZGVjcy5kZWZhdWx0ID0gY29kZWNzLmpzb24gPSBAXG4gICAgc2hhcmVkLmJpbmRUcmFuc3BvcnRzIEAgLy8gMHgwKiDigJQgSlNPTiBib2R5XG4gICAgICBpbmJvdW5kLCAweDAwLCBqc29uX3Byb3RvY29sKHNoYXJlZClcblxuICBjb2RlY3MuYmluYXJ5ID0gQFxuICAgIHNoYXJlZC5iaW5kVHJhbnNwb3J0cyBAIC8vIDB4MSog4oCUIGJpbmFyeSBib2R5XG4gICAgICBpbmJvdW5kLCAweDEwLCBiaW5hcnlfcHJvdG9jb2woc2hhcmVkKVxuXG4gIGNvZGVjcy5jb250cm9sID0gQCAvLyAweGYqIOKAlCBjb250cm9sXG4gICAgY29udHJvbF9wcm90b2NvbCBAIGluYm91bmQsIDB4ZjAsIHNoYXJlZFxuXG4gIHJldHVybiBwcm90b2NvbHNcblxuIiwiaW1wb3J0IHBsdWdpbiBmcm9tICcuL3BsdWdpbi5qc3knXG5cbmNvbnN0IGdldFJhbmRvbVZhbHVlcyA9ICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd2luZG93XG4gID8gd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXMgOiBudWxsXG5cbnByb3RvY29sc19icm93c2VyLnJhbmRvbV9pZCA9IHJhbmRvbV9pZFxuZnVuY3Rpb24gcmFuZG9tX2lkKCkgOjpcbiAgY29uc3QgYXJyID0gbmV3IEludDMyQXJyYXkoMSlcbiAgZ2V0UmFuZG9tVmFsdWVzKGFycilcbiAgcmV0dXJuIGFyclswXVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcm90b2NvbHNfYnJvd3NlcihwbHVnaW5fb3B0aW9ucz17fSkgOjpcbiAgaWYgbnVsbCA9PSBwbHVnaW5fb3B0aW9ucy5yYW5kb21faWQgOjpcbiAgICBwbHVnaW5fb3B0aW9ucy5yYW5kb21faWQgPSByYW5kb21faWRcblxuICByZXR1cm4gcGx1Z2luKHBsdWdpbl9vcHRpb25zKVxuXG4iXSwibmFtZXMiOlsibGl0dGxlX2VuZGlhbiIsImNfc2luZ2xlIiwiY19kYXRhZ3JhbSIsImNfZGlyZWN0IiwiY19tdWx0aXBhcnQiLCJjX3N0cmVhbWluZyIsIl9lcnJfbXNnaWRfcmVxdWlyZWQiLCJfZXJyX3Rva2VuX3JlcXVpcmVkIiwiZnJtX3JvdXRpbmciLCJzaXplIiwiYml0cyIsIm1hc2siLCJvYmoiLCJmcm9tX2lkIiwiZHYiLCJvZmZzZXQiLCJzZXRJbnQzMiIsImlkX3JvdXRlciIsImlkX3RhcmdldCIsInVuZGVmaW5lZCIsImdldEludDMyIiwiZnJtX3Jlc3BvbnNlIiwibXNnaWQiLCJFcnJvciIsInNldEludDE2Iiwic2VxX2FjayIsImFja19mbGFncyIsInRva2VuIiwiZ2V0SW50MTYiLCJmcm1fZGF0YWdyYW0iLCJ0cmFuc3BvcnQiLCJmcm1fZGlyZWN0IiwiZnJtX211bHRpcGFydCIsInNlcV9wb3MiLCJzZXEiLCJzZXFfZmxhZ3MiLCJmcm1fc3RyZWFtaW5nIiwiYmluZF9zZXFfbmV4dCIsInNlcV9vZmZzZXQiLCJzZXFfbmV4dCIsImZsYWdzIiwiZmluIiwiTmFOIiwiY29tcG9zZUZyYW1pbmdzIiwiZnJtX2Zyb20iLCJmcm1fcmVzcCIsImZybV90cmFuc3BvcnRzIiwibGVuZ3RoIiwiYnlCaXRzIiwidF9mcm9tIiwiZl90ZXN0IiwidF9yZXNwIiwidDAiLCJ0MSIsInQyIiwidDMiLCJtYXAiLCJmIiwidGVzdEJpdHMiLCJjaG9vc2UiLCJsc3QiLCJUIiwiYiIsIm9wIiwiZm5fa2V5IiwiZm5fdHJhbiIsImZuX2Zyb20iLCJmbl9yZXNwIiwiZnJtIiwiYmluZEFzc2VtYmxlZCIsImZfcGFjayIsImZfdW5wYWNrIiwicGFjayIsInVucGFjayIsInBrdF90eXBlIiwicGt0X29iaiIsIlR5cGVFcnJvciIsInR5cGUiLCJEYXRhVmlldyIsIkFycmF5QnVmZmVyIiwiaGVhZGVyIiwiYnVmZmVyIiwic2xpY2UiLCJwa3QiLCJidWYiLCJoZWFkZXJfYnVmZmVyIiwiVWludDhBcnJheSIsImluZm8iLCJfYmluZF9pdGVyYWJsZSIsImJ1Zl9jbG9uZSIsInR0bCIsIm5leHQiLCJvcHRpb25zIiwiZG9uZSIsInZhbHVlIiwicGFja2V0UGFyc2VyIiwic2hhcmVkIiwiY29uY2F0QnVmZmVycyIsImNyZWF0ZU11bHRpcGFydCIsInNpbmsiLCJkZWxldGVTdGF0ZSIsInBhcnRzIiwiZmVlZCIsImJvZHlfYnVmZmVyIiwiaW5jbHVkZXMiLCJyZXMiLCJjcmVhdGVTdHJlYW0iLCJyZWN2RGF0YSIsInJzdHJlYW0iLCJzdGF0ZSIsImZlZWRfaW5pdCIsImFzX2NvbnRlbnQiLCJtc2dfdW5wYWNrIiwiZmVlZF9pZ25vcmUiLCJtc2ciLCJqc29uX3VucGFjayIsImJvZHlfdXRmOCIsInJlY3ZTdHJlYW0iLCJyZWN2U3RyZWFtRGF0YSIsImJpbmQiLCJlcnIiLCJvbl9lcnJvciIsImZlZWRfYm9keSIsIm9uX2luaXQiLCJkYXRhIiwib25fZGF0YSIsIm9uX2VuZCIsImZlZWRfc2VxIiwiY2hlY2tfZm5zIiwia2V5cyIsImtleSIsInBhY2tQYWNrZXRPYmoiLCJyYW5kb21faWQiLCJqc29uX3BhY2siLCJjaG9vc2VGcmFtaW5nIiwiZnJhbWluZ3MiLCJmcmFnbWVudF9zaXplIiwiTnVtYmVyIiwiYmluZFRyYW5zcG9ydHMiLCJwYWNrZXRGcmFnbWVudHMiLCJpbmJvdW5kIiwiaGlnaGJpdHMiLCJ0cmFuc3BvcnRzIiwicGFja0JvZHkiLCJvdXRib3VuZCIsImJpbmRUcmFuc3BvcnRJbXBscyIsInN0cmVhbWluZyIsInNlbmQiLCJzdHJlYW0iLCJiaW5kU3RyZWFtIiwiY2hhbiIsImJvZHkiLCJieXRlTGVuZ3RoIiwibXNlbmQiLCJtc2VuZF9ieXRlcyIsInBhY2tfaGRyIiwibXNlbmRfb2JqZWN0cyIsIm1vZGUiLCJtc2dfcGFjayIsIm1zZW5kX2ltcGwiLCJvYmplY3QiLCJieXRlcyIsIndyaXRlIiwiZW5kIiwiY2h1bmsiLCJuZXh0X2hkciIsImkiLCJsYXN0SW5uZXIiLCJpMCIsImZyYW1lIiwiaW1wbCIsInRfcmVjdiIsInJlY3ZfbXNnIiwiaW5pdF9zaGFyZWQiLCJPYmplY3QiLCJhc3NpZ24iLCJzdGF0ZUZvciIsIm11bHRpcGFydCIsImNyZWF0ZVN0YXRlIiwiYnlfbXNnaWQiLCJnZXQiLCJkZWxldGUiLCJzZXQiLCJub29wX2VuY29kaW5ncyIsImpzb25fcHJvdG9jb2wiLCJlbmNvZGUiLCJkZWNvZGUiLCJwYWNrX3V0ZjgiLCJ1bnBhY2tfdXRmOCIsInN0cmVhbV9tc2dfdW5wYWNrIiwiYXNfanNvbl9jb250ZW50IiwiZGF0YWdyYW0iLCJkaXJlY3QiLCJ1bnBhY2tCb2R5QnVmIiwicmVjdk1zZyIsImJvZHlfYnVmIiwibXNnX2J1ZiIsImpzb25fYnVmIiwiYmluYXJ5X3Byb3RvY29sIiwiYXNCdWZmZXIiLCJwa3RfYnVmZmVyIiwiY29udHJvbF9wcm90b2NvbCIsImhpZ2giLCJwaW5nX2ZyYW1lIiwicG9uZ19mcmFtZSIsInBvbmdfdHlwZSIsInJlY3ZfcG9uZyIsInBpbmdfdHlwZSIsInJlY3ZfcGluZyIsInBpbmciLCJKU09OIiwic3RyaW5naWZ5IiwidHMwIiwiRGF0ZSIsInJvdXRlciIsImJvZHlfanNvbiIsInJlY3ZDdHJsIiwiX3NlbmRfcG9uZyIsInBrdF9waW5nIiwicl9pZCIsInRzMSIsImRpc3BhdGNoIiwiZGVmYXVsdF9wbHVnaW5fb3B0aW9ucyIsInByb3RvY29scyIsInBsdWdpbl9vcHRpb25zIiwicGx1Z2luX25hbWUiLCJzdWJjbGFzcyIsIm9yZGVyIiwiRmFicmljSHViX1BJIiwiYmFzZXMiLCJwcm90b3R5cGUiLCJpc1BhY2tldFBhcnNlciIsImNvZGVjcyIsImNyZWF0ZSIsInVzZVN0YW5kYXJkIiwiaW5pdF9wcm90b2NvbHMiLCJjdXN0b20iLCJkZWZhdWx0IiwianNvbiIsImJpbmFyeSIsImNvbnRyb2wiLCJnZXRSYW5kb21WYWx1ZXMiLCJ3aW5kb3ciLCJjcnlwdG8iLCJwcm90b2NvbHNfYnJvd3NlciIsImFyciIsIkludDMyQXJyYXkiLCJwbHVnaW4iXSwibWFwcGluZ3MiOiI7O0FBQUEsTUFBTUEsZ0JBQWdCLElBQXRCO0FBQ0EsTUFBTUMsV0FBVyxRQUFqQjtBQUNBLE1BQU1DLGFBQWEsVUFBbkI7QUFDQSxNQUFNQyxXQUFXLFFBQWpCO0FBQ0EsTUFBTUMsY0FBYyxXQUFwQjtBQUNBLE1BQU1DLGNBQWMsV0FBcEI7O0FBRUEsTUFBTUMsc0JBQXVCLDBCQUE3QjtBQUNBLE1BQU1DLHNCQUF1QiwyQkFBN0I7O0FBR0EsU0FBU0MsV0FBVCxHQUF1QjtRQUNmQyxPQUFPLENBQWI7UUFBZ0JDLE9BQU8sR0FBdkI7UUFBNEJDLE9BQU8sR0FBbkM7U0FDTztRQUFBLEVBQ0NELElBREQsRUFDT0MsSUFEUDs7V0FHRUMsR0FBUCxFQUFZO2FBQVUsUUFBUUEsSUFBSUMsT0FBWixHQUFzQkgsSUFBdEIsR0FBNkIsS0FBcEM7S0FIVjs7V0FLRUUsR0FBUCxFQUFZRSxFQUFaLEVBQWdCQyxNQUFoQixFQUF3QjtZQUNoQixFQUFDRixPQUFELEtBQVlELEdBQWxCO1NBQ0dJLFFBQUgsQ0FBYyxJQUFFRCxNQUFoQixFQUF3QixJQUFFRixRQUFRSSxTQUFsQyxFQUE2Q2pCLGFBQTdDO1NBQ0dnQixRQUFILENBQWMsSUFBRUQsTUFBaEIsRUFBd0IsSUFBRUYsUUFBUUssU0FBbEMsRUFBNkNsQixhQUE3QztLQVJHOzthQVVJWSxHQUFULEVBQWNFLEVBQWQsRUFBa0JDLE1BQWxCLEVBQTBCO1lBQ2xCRixVQUFVTSxjQUFjUCxJQUFJQyxPQUFsQixHQUNaRCxJQUFJQyxPQUFKLEdBQWMsRUFERixHQUNPRCxJQUFJQyxPQUQzQjtjQUVRSSxTQUFSLEdBQW9CSCxHQUFHTSxRQUFILENBQWMsSUFBRUwsTUFBaEIsRUFBd0Jm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
