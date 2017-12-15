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

module.exports = protocols_browser;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZXMiOlsiLi4vY29kZS9zaGFyZWQvZnJhbWluZy5qc3kiLCIuLi9jb2RlL3NoYXJlZC9tdWx0aXBhcnQuanN5IiwiLi4vY29kZS9zaGFyZWQvc3RyZWFtaW5nLmpzeSIsIi4uL2NvZGUvc2hhcmVkL3RyYW5zcG9ydC5qc3kiLCIuLi9jb2RlL3NoYXJlZC9pbmRleC5qc3kiLCIuLi9jb2RlL3Byb3RvY29scy9qc29uLmpzeSIsIi4uL2NvZGUvcHJvdG9jb2xzL2JpbmFyeS5qc3kiLCIuLi9jb2RlL3Byb3RvY29scy9jb250cm9sLmpzeSIsIi4uL2NvZGUvcGx1Z2luLmpzeSIsIi4uL2NvZGUvaW5kZXguYnJvd3Nlci5qc3kiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgbGl0dGxlX2VuZGlhbiA9IHRydWVcbmNvbnN0IGNfc2luZ2xlID0gJ3NpbmdsZSdcbmNvbnN0IGNfZGF0YWdyYW0gPSAnZGF0YWdyYW0nXG5jb25zdCBjX2RpcmVjdCA9ICdkaXJlY3QnXG5jb25zdCBjX211bHRpcGFydCA9ICdtdWx0aXBhcnQnXG5jb25zdCBjX3N0cmVhbWluZyA9ICdzdHJlYW1pbmcnXG5cbmNvbnN0IF9lcnJfbXNnaWRfcmVxdWlyZWQgPSBgUmVzcG9uc2UgcmVxaXJlcyAnbXNnaWQnYFxuY29uc3QgX2Vycl90b2tlbl9yZXF1aXJlZCA9IGBUcmFuc3BvcnQgcmVxaXJlcyAndG9rZW4nYFxuXG5cbmZ1bmN0aW9uIGZybV9yb3V0aW5nKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDgsIGJpdHMgPSAweDEsIG1hc2sgPSAweDFcbiAgcmV0dXJuIEB7fVxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6IHJldHVybiBudWxsICE9IG9iai5mcm9tX2lkID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgY29uc3Qge2Zyb21faWR9ID0gb2JqXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCAwfGZyb21faWQuaWRfcm91dGVyLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQzMiBAIDQrb2Zmc2V0LCAwfGZyb21faWQuaWRfdGFyZ2V0LCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBjb25zdCBmcm9tX2lkID0gdW5kZWZpbmVkID09PSBvYmouZnJvbV9pZFxuICAgICAgICA/IG9iai5mcm9tX2lkID0ge30gOiBvYmouZnJvbV9pZFxuICAgICAgZnJvbV9pZC5pZF9yb3V0ZXIgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBmcm9tX2lkLmlkX3RhcmdldCA9IGR2LmdldEludDMyIEAgNCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cblxuZnVuY3Rpb24gZnJtX3Jlc3BvbnNlKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDgsIGJpdHMgPSAweDIsIG1hc2sgPSAweDJcbiAgcmV0dXJuIEB7fVxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6IHJldHVybiBudWxsICE9IG9iai5tc2dpZCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLm1zZ2lkIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfbXNnaWRfcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai5tc2dpZCwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMHxvYmouc2VxX2FjaywgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCA2K29mZnNldCwgMHxvYmouYWNrX2ZsYWdzLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoudG9rZW4gPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxX2FjayA9IGR2LmdldEludDE2IEAgNCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5hY2tfZmxhZ3MgPSBkdi5nZXRJbnQxNiBAIDYrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG5cblxuXG5mdW5jdGlvbiBmcm1fZGF0YWdyYW0oKSA6OlxuICBjb25zdCBzaXplID0gMCwgYml0cyA9IDB4MCwgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19kYXRhZ3JhbVxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6XG4gICAgICBpZiBjX2RhdGFncmFtID09PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBiaXRzXG4gICAgICBpZiBvYmoudHJhbnNwb3J0ICYmIGNfc2luZ2xlICE9PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBmYWxzZVxuICAgICAgcmV0dXJuICEgb2JqLnRva2VuID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfZGF0YWdyYW1cblxuZnVuY3Rpb24gZnJtX2RpcmVjdCgpIDo6XG4gIGNvbnN0IHNpemUgPSA0LCBiaXRzID0gMHg0LCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX2RpcmVjdFxuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6XG4gICAgICBpZiBjX2RpcmVjdCA9PT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gYml0c1xuICAgICAgaWYgb2JqLnRyYW5zcG9ydCAmJiBjX3NpbmdsZSAhPT0gb2JqLnRyYW5zcG9ydCA6OiByZXR1cm4gZmFsc2VcbiAgICAgIHJldHVybiAhISBvYmoudG9rZW4gPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai50b2tlbiA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX3Rva2VuX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoudG9rZW4sIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai5tc2dpZCA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX2RpcmVjdFxuXG5mdW5jdGlvbiBmcm1fbXVsdGlwYXJ0KCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDgsIGJpdHMgPSAweDgsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfbXVsdGlwYXJ0XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIGNfbXVsdGlwYXJ0ID09PSBvYmoudHJhbnNwb3J0ID8gYml0cyA6IGZhbHNlXG5cbiAgICBiaW5kX3NlcV9uZXh0LCBzZXFfcG9zOiA0XG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLnRva2VuIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfdG9rZW5fcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai50b2tlbiwgbGl0dGxlX2VuZGlhblxuICAgICAgaWYgdHJ1ZSA9PSBvYmouc2VxIDo6IC8vIHVzZSBzZXFfbmV4dFxuICAgICAgICBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwLCBsaXR0bGVfZW5kaWFuXG4gICAgICBlbHNlIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDB8b2JqLnNlcSwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCA2K29mZnNldCwgMHxvYmouc2VxX2ZsYWdzLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoubXNnaWQgICAgID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcSAgICAgICA9IGR2LmdldEludDE2IEAgNCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXFfZmxhZ3MgPSBkdi5nZXRJbnQxNiBAIDYrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19tdWx0aXBhcnRcblxuZnVuY3Rpb24gZnJtX3N0cmVhbWluZygpIDo6XG4gIGNvbnN0IHNpemUgPSA4LCBiaXRzID0gMHhjLCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX3N0cmVhbWluZ1xuICAgIHNpemUsIGJpdHMsIG1hc2tcblxuICAgIGZfdGVzdChvYmopIDo6IHJldHVybiBjX3N0cmVhbWluZyA9PT0gb2JqLnRyYW5zcG9ydCA/IGJpdHMgOiBmYWxzZVxuXG4gICAgYmluZF9zZXFfbmV4dCwgc2VxX3BvczogNFxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBpZiAhIG9iai50b2tlbiA6OiB0aHJvdyBuZXcgRXJyb3IgQCBfZXJyX3Rva2VuX3JlcXVpcmVkXG4gICAgICBkdi5zZXRJbnQzMiBAIDArb2Zmc2V0LCBvYmoudG9rZW4sIGxpdHRsZV9lbmRpYW5cbiAgICAgIGlmIHRydWUgPT0gb2JqLnNlcSA6OlxuICAgICAgICBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwLCBsaXR0bGVfZW5kaWFuIC8vIHVzZSBzZXFfbmV4dFxuICAgICAgZWxzZSBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwfG9iai5zZXEsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgNitvZmZzZXQsIDB8b2JqLnNlcV9mbGFncywgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLm1zZ2lkICAgICA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXEgICAgICAgPSBkdi5nZXRJbnQxNiBAIDQrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxX2ZsYWdzID0gZHYuZ2V0SW50MTYgQCA2K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfc3RyZWFtaW5nXG5cblxuZnVuY3Rpb24gYmluZF9zZXFfbmV4dChvZmZzZXQpIDo6XG4gIGNvbnN0IHNlcV9vZmZzZXQgPSB0aGlzLnNlcV9wb3MgKyBvZmZzZXRcbiAgbGV0IHNlcSA9IDFcbiAgcmV0dXJuIGZ1bmN0aW9uIHNlcV9uZXh0KHtmbGFncywgZmlufSwgZHYpIDo6XG4gICAgaWYgISBmaW4gOjpcbiAgICAgIGR2LnNldEludDE2IEAgc2VxX29mZnNldCwgc2VxKyssIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgMitzZXFfb2Zmc2V0LCAwfGZsYWdzLCBsaXR0bGVfZW5kaWFuXG4gICAgZWxzZSA6OlxuICAgICAgZHYuc2V0SW50MTYgQCBzZXFfb2Zmc2V0LCAtc2VxLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDIrc2VxX29mZnNldCwgMHxmbGFncywgbGl0dGxlX2VuZGlhblxuICAgICAgc2VxID0gTmFOXG5cblxuXG5leHBvcnQgZGVmYXVsdCBjb21wb3NlRnJhbWluZ3MoKVxuZnVuY3Rpb24gY29tcG9zZUZyYW1pbmdzKCkgOjpcbiAgY29uc3QgZnJtX2Zyb20gPSBmcm1fcm91dGluZygpLCBmcm1fcmVzcCA9IGZybV9yZXNwb25zZSgpXG4gIGNvbnN0IGZybV90cmFuc3BvcnRzID0gQFtdIGZybV9kYXRhZ3JhbSgpLCBmcm1fZGlyZWN0KCksIGZybV9tdWx0aXBhcnQoKSwgZnJtX3N0cmVhbWluZygpXG5cbiAgaWYgOCAhPT0gZnJtX2Zyb20uc2l6ZSB8fCA4ICE9PSBmcm1fcmVzcC5zaXplIHx8IDQgIT0gZnJtX3RyYW5zcG9ydHMubGVuZ3RoIDo6XG4gICAgdGhyb3cgbmV3IEVycm9yIEAgYEZyYW1pbmcgU2l6ZSBjaGFuZ2VgXG5cbiAgY29uc3QgYnlCaXRzID0gW10sIG1hc2s9MHhmXG5cbiAgOjpcbiAgICBjb25zdCB0X2Zyb20gPSBmcm1fZnJvbS5mX3Rlc3QsIHRfcmVzcCA9IGZybV9yZXNwLmZfdGVzdFxuICAgIGNvbnN0IFt0MCx0MSx0Mix0M10gPSBmcm1fdHJhbnNwb3J0cy5tYXAgQCBmPT5mLmZfdGVzdFxuXG4gICAgY29uc3QgdGVzdEJpdHMgPSBieUJpdHMudGVzdEJpdHMgPSBvYmogPT5cbiAgICAgIDAgfCB0X2Zyb20ob2JqKSB8IHRfcmVzcChvYmopIHwgdDAob2JqKSB8IHQxKG9iaikgfCB0MihvYmopIHwgdDMob2JqKVxuXG4gICAgYnlCaXRzLmNob29zZSA9IGZ1bmN0aW9uIChvYmosIGxzdCkgOjpcbiAgICAgIGlmIG51bGwgPT0gbHN0IDo6IGxzdCA9IHRoaXMgfHwgYnlCaXRzXG4gICAgICByZXR1cm4gbHN0W3Rlc3RCaXRzKG9iaildXG5cblxuICBmb3IgY29uc3QgVCBvZiBmcm1fdHJhbnNwb3J0cyA6OlxuICAgIGNvbnN0IHtiaXRzOmIsIHNpemUsIHRyYW5zcG9ydH0gPSBUXG5cbiAgICBieUJpdHNbYnwwXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MCwgbWFzaywgc2l6ZTogc2l6ZSwgb3A6ICcnXG4gICAgYnlCaXRzW2J8MV0gPSBAe30gVCwgdHJhbnNwb3J0LCBiaXRzOiBifDEsIG1hc2ssIHNpemU6IDggKyBzaXplLCBvcDogJ2YnXG4gICAgYnlCaXRzW2J8Ml0gPSBAe30gVCwgdHJhbnNwb3J0LCBiaXRzOiBifDIsIG1hc2ssIHNpemU6IDggKyBzaXplLCBvcDogJ3InXG4gICAgYnlCaXRzW2J8M10gPSBAe30gVCwgdHJhbnNwb3J0LCBiaXRzOiBifDMsIG1hc2ssIHNpemU6IDE2ICsgc2l6ZSwgb3A6ICdmcidcblxuICAgIGZvciBjb25zdCBmbl9rZXkgb2YgWydmX3BhY2snLCAnZl91bnBhY2snXSA6OlxuICAgICAgY29uc3QgZm5fdHJhbiA9IFRbZm5fa2V5XSwgZm5fZnJvbSA9IGZybV9mcm9tW2ZuX2tleV0sIGZuX3Jlc3AgPSBmcm1fcmVzcFtmbl9rZXldXG5cbiAgICAgIGJ5Qml0c1tifDBdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl90cmFuKG9iaiwgZHYsIDApXG4gICAgICBieUJpdHNbYnwxXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fZnJvbShvYmosIGR2LCAwKTsgZm5fdHJhbihvYmosIGR2LCA4KVxuICAgICAgYnlCaXRzW2J8Ml1bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX3Jlc3Aob2JqLCBkdiwgMCk7IGZuX3RyYW4ob2JqLCBkdiwgOClcbiAgICAgIGJ5Qml0c1tifDNdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl9mcm9tKG9iaiwgZHYsIDApOyBmbl9yZXNwKG9iaiwgZHYsIDgpOyBmbl90cmFuKG9iaiwgZHYsIDE2KVxuXG4gIGZvciBjb25zdCBmcm0gb2YgYnlCaXRzIDo6XG4gICAgYmluZEFzc2VtYmxlZCBAIGZybVxuXG4gIHJldHVybiBieUJpdHNcblxuXG5mdW5jdGlvbiBiaW5kQXNzZW1ibGVkKGZybSkgOjpcbiAgY29uc3Qge1QsIHNpemUsIGZfcGFjaywgZl91bnBhY2t9ID0gZnJtXG4gIGlmIFQuYmluZF9zZXFfbmV4dCA6OlxuICAgIGZybS5zZXFfbmV4dCA9IFQuYmluZF9zZXFfbmV4dCBAIGZybS5zaXplIC0gVC5zaXplXG5cbiAgZGVsZXRlIGZybS5UXG4gIGZybS5wYWNrID0gcGFjayA7IGZybS51bnBhY2sgPSB1bnBhY2tcbiAgY29uc3Qgc2VxX25leHQgPSBmcm0uc2VxX25leHRcblxuICBmdW5jdGlvbiBwYWNrKHBrdF90eXBlLCBwa3Rfb2JqKSA6OlxuICAgIGlmICEgQCAwIDw9IHBrdF90eXBlICYmIHBrdF90eXBlIDw9IDI1NSA6OlxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvciBAIGBFeHBlY3RlZCBwa3RfdHlwZSB0byBiZSBbMC4uMjU1XWBcblxuICAgIHBrdF9vYmoudHlwZSA9IHBrdF90eXBlXG4gICAgaWYgc2VxX25leHQgJiYgbnVsbCA9PSBwa3Rfb2JqLnNlcSA6OlxuICAgICAgcGt0X29iai5zZXEgPSB0cnVlXG5cbiAgICBjb25zdCBkdiA9IG5ldyBEYXRhVmlldyBAIG5ldyBBcnJheUJ1ZmZlcihzaXplKVxuICAgIGZfcGFjayhwa3Rfb2JqLCBkdiwgMClcbiAgICBwa3Rfb2JqLmhlYWRlciA9IGR2LmJ1ZmZlclxuXG4gICAgaWYgdHJ1ZSA9PT0gcGt0X29iai5zZXEgOjpcbiAgICAgIF9iaW5kX2l0ZXJhYmxlIEAgcGt0X29iaiwgZHYuYnVmZmVyLnNsaWNlKDAsc2l6ZSlcblxuICBmdW5jdGlvbiB1bnBhY2socGt0KSA6OlxuICAgIGNvbnN0IGJ1ZiA9IHBrdC5oZWFkZXJfYnVmZmVyKClcbiAgICBjb25zdCBkdiA9IG5ldyBEYXRhVmlldyBAIG5ldyBVaW50OEFycmF5KGJ1ZikuYnVmZmVyXG5cbiAgICBjb25zdCBpbmZvID0ge31cbiAgICBmX3VucGFjayhpbmZvLCBkdiwgMClcbiAgICByZXR1cm4gcGt0LmluZm8gPSBpbmZvXG5cbiAgZnVuY3Rpb24gX2JpbmRfaXRlcmFibGUocGt0X29iaiwgYnVmX2Nsb25lKSA6OlxuICAgIGNvbnN0IHt0eXBlfSA9IHBrdF9vYmpcbiAgICBjb25zdCB7aWRfcm91dGVyLCBpZF90YXJnZXQsIHR0bCwgdG9rZW59ID0gcGt0X29ialxuICAgIHBrdF9vYmoubmV4dCA9IG5leHRcblxuICAgIGZ1bmN0aW9uIG5leHQob3B0aW9ucykgOjpcbiAgICAgIGlmIG51bGwgPT0gb3B0aW9ucyA6OiBvcHRpb25zID0ge31cbiAgICAgIGNvbnN0IGhlYWRlciA9IGJ1Zl9jbG9uZS5zbGljZSgpXG4gICAgICBzZXFfbmV4dCBAIG9wdGlvbnMsIG5ldyBEYXRhVmlldyBAIGhlYWRlclxuICAgICAgcmV0dXJuIEB7fSBkb25lOiAhISBvcHRpb25zLmZpbiwgdmFsdWU6IEB7fSAvLyBwa3Rfb2JqXG4gICAgICAgIGlkX3JvdXRlciwgaWRfdGFyZ2V0LCB0eXBlLCB0dGwsIHRva2VuLCBoZWFkZXJcblxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtjb25jYXRCdWZmZXJzfSA9IHBhY2tldFBhcnNlclxuICByZXR1cm4gQHt9IGNyZWF0ZU11bHRpcGFydFxuXG5cbiAgZnVuY3Rpb24gY3JlYXRlTXVsdGlwYXJ0KHBrdCwgc2luaywgZGVsZXRlU3RhdGUpIDo6XG4gICAgbGV0IHBhcnRzID0gW10sIGZpbiA9IGZhbHNlXG4gICAgcmV0dXJuIEB7fSBmZWVkLCBpbmZvOiBwa3QuaW5mb1xuXG4gICAgZnVuY3Rpb24gZmVlZChwa3QpIDo6XG4gICAgICBsZXQgc2VxID0gcGt0LmluZm8uc2VxXG4gICAgICBpZiBzZXEgPCAwIDo6IGZpbiA9IHRydWU7IHNlcSA9IC1zZXFcbiAgICAgIHBhcnRzW3NlcS0xXSA9IHBrdC5ib2R5X2J1ZmZlcigpXG5cbiAgICAgIGlmICEgZmluIDo6IHJldHVyblxuICAgICAgaWYgcGFydHMuaW5jbHVkZXMgQCB1bmRlZmluZWQgOjogcmV0dXJuXG5cbiAgICAgIGRlbGV0ZVN0YXRlKClcblxuICAgICAgY29uc3QgcmVzID0gY29uY2F0QnVmZmVycyhwYXJ0cylcbiAgICAgIHBhcnRzID0gbnVsbFxuICAgICAgcmV0dXJuIHJlc1xuXG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwYWNrZXRQYXJzZXIsIHNoYXJlZCkgOjpcbiAgcmV0dXJuIEB7fSBjcmVhdGVTdHJlYW1cblxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVN0cmVhbShwa3QsIHNpbmssIGRlbGV0ZVN0YXRlKSA6OlxuICAgIGxldCBuZXh0PTAsIGZpbiA9IGZhbHNlLCByZWN2RGF0YSwgcnN0cmVhbVxuICAgIGNvbnN0IHN0YXRlID0gQHt9IGZlZWQ6IGZlZWRfaW5pdCwgaW5mbzogcGt0LmluZm9cbiAgICByZXR1cm4gc3RhdGVcblxuICAgIGZ1bmN0aW9uIGZlZWRfaW5pdChwa3QsIGFzX2NvbnRlbnQsIG1zZ191bnBhY2spIDo6XG4gICAgICBzdGF0ZS5mZWVkID0gZmVlZF9pZ25vcmVcblxuICAgICAgY29uc3QgaW5mbyA9IHBrdC5pbmZvXG4gICAgICBjb25zdCBtc2cgPSBtc2dfdW5wYWNrXG4gICAgICAgID8gbXNnX3VucGFjayhwa3QsIHNpbmspXG4gICAgICAgIDogc2luay5qc29uX3VucGFjayBAIHBrdC5ib2R5X3V0ZjgoKVxuICAgICAgcnN0cmVhbSA9IHNpbmsucmVjdlN0cmVhbShtc2csIGluZm8pXG4gICAgICBpZiBudWxsID09IHJzdHJlYW0gOjogcmV0dXJuXG4gICAgICBjaGVja19mbnMgQCByc3RyZWFtLCAnb25fZXJyb3InLCAnb25fZGF0YScsICdvbl9lbmQnIFxuICAgICAgcmVjdkRhdGEgPSBzaW5rLnJlY3ZTdHJlYW1EYXRhLmJpbmQoc2luaywgcnN0cmVhbSwgaW5mbylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGZlZWRfc2VxKHBrdClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9lcnJvciBAIGVyciwgcGt0XG5cbiAgICAgIHN0YXRlLmZlZWQgPSBmZWVkX2JvZHlcbiAgICAgIGlmIHJzdHJlYW0ub25faW5pdCA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9pbml0KG1zZywgcGt0KVxuXG4gICAgZnVuY3Rpb24gZmVlZF9ib2R5KHBrdCwgYXNfY29udGVudCkgOjpcbiAgICAgIHJlY3ZEYXRhKClcbiAgICAgIGxldCBkYXRhXG4gICAgICB0cnkgOjpcbiAgICAgICAgZmVlZF9zZXEocGt0KVxuICAgICAgICBkYXRhID0gYXNfY29udGVudChwa3QsIHNpbmspXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZXJyb3IgQCBlcnIsIHBrdFxuXG4gICAgICBpZiBmaW4gOjpcbiAgICAgICAgY29uc3QgcmVzID0gcnN0cmVhbS5vbl9kYXRhIEAgZGF0YSwgcGt0XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2VuZCBAIHJlcywgcGt0XG4gICAgICBlbHNlIDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2RhdGEgQCBkYXRhLCBwa3RcblxuICAgIGZ1bmN0aW9uIGZlZWRfaWdub3JlKHBrdCkgOjpcbiAgICAgIHRyeSA6OiBmZWVkX3NlcShwa3QpXG4gICAgICBjYXRjaCBlcnIgOjpcblxuICAgIGZ1bmN0aW9uIGZlZWRfc2VxKHBrdCkgOjpcbiAgICAgIGxldCBzZXEgPSBwa3QuaW5mby5zZXFcbiAgICAgIGlmIHNlcSA+PSAwIDo6XG4gICAgICAgIGlmIG5leHQrKyA9PT0gc2VxIDo6XG4gICAgICAgICAgcmV0dXJuIC8vIGluIG9yZGVyXG4gICAgICBlbHNlIDo6XG4gICAgICAgIGZpbiA9IHRydWVcbiAgICAgICAgZGVsZXRlU3RhdGUoKVxuICAgICAgICBpZiBuZXh0ID09PSAtc2VxIDo6XG4gICAgICAgICAgbmV4dCA9ICdkb25lJ1xuICAgICAgICAgIHJldHVybiAvLyBpbi1vcmRlciwgbGFzdCBwYWNrZXRcblxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfaWdub3JlXG4gICAgICBuZXh0ID0gJ2ludmFsaWQnXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgUGFja2V0IG91dCBvZiBzZXF1ZW5jZWBcblxuXG5mdW5jdGlvbiBjaGVja19mbnMob2JqLCAuLi5rZXlzKSA6OlxuICBmb3IgY29uc3Qga2V5IG9mIGtleXMgOjpcbiAgICBpZiAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygb2JqW2tleV0gOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgRXhwZWN0ZWQgXCIke2tleX1cIiB0byBiZSBhIGZ1bmN0aW9uYFxuXG4iLCJpbXBvcnQgZnJhbWluZ3MgZnJvbSAnLi9mcmFtaW5nLmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtwYWNrUGFja2V0T2JqfSA9IHBhY2tldFBhcnNlclxuICBjb25zdCB7cmFuZG9tX2lkLCBqc29uX3BhY2t9ID0gc2hhcmVkXG4gIGNvbnN0IHtjaG9vc2U6IGNob29zZUZyYW1pbmd9ID0gZnJhbWluZ3NcblxuICBjb25zdCBmcmFnbWVudF9zaXplID0gTnVtYmVyIEAgc2hhcmVkLmZyYWdtZW50X3NpemUgfHwgODAwMFxuICBpZiAxMDI0ID4gZnJhZ21lbnRfc2l6ZSB8fCA2NTAwMCA8IGZyYWdtZW50X3NpemUgOjpcbiAgICB0aHJvdyBuZXcgRXJyb3IgQCBgSW52YWxpZCBmcmFnbWVudCBzaXplOiAke2ZyYWdtZW50X3NpemV9YFxuXG4gIHJldHVybiBAe30gYmluZFRyYW5zcG9ydHMsIHBhY2tldEZyYWdtZW50cywgY2hvb3NlRnJhbWluZ1xuXG5cbiAgZnVuY3Rpb24gYmluZFRyYW5zcG9ydHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpIDo6XG4gICAgY29uc3QgcGFja0JvZHkgPSB0cmFuc3BvcnRzLnBhY2tCb2R5XG4gICAgY29uc3Qgb3V0Ym91bmQgPSBiaW5kVHJhbnNwb3J0SW1wbHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpXG5cbiAgICBpZiB0cmFuc3BvcnRzLnN0cmVhbWluZyA6OlxuICAgICAgcmV0dXJuIEB7fSBzZW5kLCBzdHJlYW06IGJpbmRTdHJlYW0oKVxuXG4gICAgcmV0dXJuIEB7fSBzZW5kXG5cblxuXG4gICAgZnVuY3Rpb24gc2VuZChjaGFuLCBvYmosIGJvZHkpIDo6XG4gICAgICBib2R5ID0gcGFja0JvZHkoYm9keSwgb2JqLCBjaGFuKVxuICAgICAgaWYgZnJhZ21lbnRfc2l6ZSA8IGJvZHkuYnl0ZUxlbmd0aCA6OlxuICAgICAgICBpZiAhIG9iai50b2tlbiA6OiBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgICAgICBvYmoudHJhbnNwb3J0ID0gJ211bHRpcGFydCdcbiAgICAgICAgY29uc3QgbXNlbmQgPSBtc2VuZF9ieXRlcyhjaGFuLCBvYmopXG4gICAgICAgIHJldHVybiBtc2VuZCBAIHRydWUsIGJvZHlcblxuICAgICAgb2JqLnRyYW5zcG9ydCA9ICdzaW5nbGUnXG4gICAgICBvYmouYm9keSA9IGJvZHlcbiAgICAgIGNvbnN0IHBhY2tfaGRyID0gb3V0Ym91bmQuY2hvb3NlKG9iailcbiAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBwYWNrX2hkcihvYmopXG4gICAgICByZXR1cm4gY2hhbi5zZW5kIEAgcGt0XG5cblxuICAgIGZ1bmN0aW9uIG1zZW5kX2J5dGVzKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgY29uc3QgcGFja19oZHIgPSBvdXRib3VuZC5jaG9vc2Uob2JqKVxuICAgICAgbGV0IHtuZXh0fSA9IHBhY2tfaGRyKG9iailcbiAgICAgIGlmIG51bGwgIT09IG1zZyA6OlxuICAgICAgICBvYmouYm9keSA9IG1zZ1xuICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgIGNoYW4uc2VuZCBAIHBrdFxuXG4gICAgICByZXR1cm4gYXN5bmMgZnVuY3Rpb24gKGZpbiwgYm9keSkgOjpcbiAgICAgICAgaWYgbnVsbCA9PT0gbmV4dCA6OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBAICdXcml0ZSBhZnRlciBlbmQnXG4gICAgICAgIGxldCByZXNcbiAgICAgICAgZm9yIGNvbnN0IG9iaiBvZiBwYWNrZXRGcmFnbWVudHMgQCBib2R5LCBuZXh0LCBmaW4gOjpcbiAgICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgICAgcmVzID0gYXdhaXQgY2hhbi5zZW5kIEAgcGt0XG4gICAgICAgIGlmIGZpbiA6OiBuZXh0ID0gbnVsbFxuICAgICAgICByZXR1cm4gcmVzXG5cblxuICAgIGZ1bmN0aW9uIG1zZW5kX29iamVjdHMoY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICBjb25zdCBwYWNrX2hkciA9IG91dGJvdW5kLmNob29zZShvYmopXG4gICAgICBsZXQge25leHR9ID0gcGFja19oZHIob2JqKVxuICAgICAgaWYgbnVsbCAhPT0gbXNnIDo6XG4gICAgICAgIG9iai5ib2R5ID0gbXNnXG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgY2hhbi5zZW5kIEAgcGt0XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbiAoZmluLCBib2R5KSA6OlxuICAgICAgICBpZiBudWxsID09PSBuZXh0IDo6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgJ1dyaXRlIGFmdGVyIGVuZCdcbiAgICAgICAgY29uc3Qgb2JqID0gbmV4dCh7ZmlufSlcbiAgICAgICAgb2JqLmJvZHkgPSBib2R5XG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgaWYgZmluIDo6IG5leHQgPSBudWxsXG4gICAgICAgIHJldHVybiBjaGFuLnNlbmQgQCBwa3RcblxuXG4gICAgZnVuY3Rpb24gYmluZFN0cmVhbSgpIDo6XG4gICAgICBjb25zdCB7bW9kZSwgbXNnX3BhY2t9ID0gdHJhbnNwb3J0cy5zdHJlYW1pbmdcbiAgICAgIGNvbnN0IG1zZW5kX2ltcGwgPSB7b2JqZWN0OiBtc2VuZF9vYmplY3RzLCBieXRlczogbXNlbmRfYnl0ZXN9W21vZGVdXG4gICAgICBpZiBtc2VuZF9pbXBsIDo6IHJldHVybiBzdHJlYW1cblxuICAgICAgZnVuY3Rpb24gc3RyZWFtKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgICBpZiAhIG9iai50b2tlbiA6OiBvYmoudG9rZW4gPSByYW5kb21faWQoKVxuICAgICAgICBvYmoudHJhbnNwb3J0ID0gJ3N0cmVhbWluZydcbiAgICAgICAgbXNnID0gbXNnX3BhY2tcbiAgICAgICAgICA/IG1zZ19wYWNrKG1zZywgb2JqLCBjaGFuKVxuICAgICAgICAgIDoganNvbl9wYWNrKG1zZylcbiAgICAgICAgY29uc3QgbXNlbmQgPSBtc2VuZF9pbXBsIEAgY2hhbiwgb2JqLCBtc2dcbiAgICAgICAgd3JpdGUud3JpdGUgPSB3cml0ZTsgd3JpdGUuZW5kID0gd3JpdGUuYmluZCh0cnVlKVxuICAgICAgICByZXR1cm4gd3JpdGVcblxuICAgICAgICBmdW5jdGlvbiB3cml0ZShjaHVuaykgOjpcbiAgICAgICAgICAvLyBtc2VuZCBAIGZpbiwgYm9keVxuICAgICAgICAgIHJldHVybiBjaHVuayAhPSBudWxsXG4gICAgICAgICAgICA/IG1zZW5kIEAgdHJ1ZT09PXRoaXMsIHBhY2tCb2R5KGNodW5rLCBvYmosIGNoYW4pXG4gICAgICAgICAgICA6IG1zZW5kIEAgdHJ1ZVxuXG5cbiAgZnVuY3Rpb24gKiBwYWNrZXRGcmFnbWVudHMoYnVmLCBuZXh0X2hkciwgZmluKSA6OlxuICAgIGlmIG51bGwgPT0gYnVmIDo6XG4gICAgICBjb25zdCBvYmogPSBuZXh0X2hkcih7ZmlufSlcbiAgICAgIHlpZWxkIG9ialxuICAgICAgcmV0dXJuXG5cbiAgICBsZXQgaSA9IDAsIGxhc3RJbm5lciA9IGJ1Zi5ieXRlTGVuZ3RoIC0gZnJhZ21lbnRfc2l6ZTtcbiAgICB3aGlsZSBpIDwgbGFzdElubmVyIDo6XG4gICAgICBjb25zdCBpMCA9IGlcbiAgICAgIGkgKz0gZnJhZ21lbnRfc2l6ZVxuXG4gICAgICBjb25zdCBvYmogPSBuZXh0X2hkcigpXG4gICAgICBvYmouYm9keSA9IGJ1Zi5zbGljZShpMCwgaSlcbiAgICAgIHlpZWxkIG9ialxuXG4gICAgOjpcbiAgICAgIGNvbnN0IG9iaiA9IG5leHRfaGRyKHtmaW59KVxuICAgICAgb2JqLmJvZHkgPSBidWYuc2xpY2UoaSlcbiAgICAgIHlpZWxkIG9ialxuXG5cblxuXG4vLyBtb2R1bGUtbGV2ZWwgaGVscGVyIGZ1bmN0aW9uc1xuXG5mdW5jdGlvbiBiaW5kVHJhbnNwb3J0SW1wbHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpIDo6XG4gIGNvbnN0IG91dGJvdW5kID0gW11cbiAgb3V0Ym91bmQuY2hvb3NlID0gZnJhbWluZ3MuY2hvb3NlXG5cbiAgZm9yIGNvbnN0IGZyYW1lIG9mIGZyYW1pbmdzIDo6XG4gICAgY29uc3QgaW1wbCA9IGZyYW1lID8gdHJhbnNwb3J0c1tmcmFtZS50cmFuc3BvcnRdIDogbnVsbFxuICAgIGlmICEgaW1wbCA6OiBjb250aW51ZVxuXG4gICAgY29uc3Qge2JpdHMsIHBhY2ssIHVucGFja30gPSBmcmFtZVxuICAgIGNvbnN0IHBrdF90eXBlID0gaGlnaGJpdHMgfCBiaXRzXG4gICAgY29uc3Qge3RfcmVjdn0gPSBpbXBsXG5cbiAgICBmdW5jdGlvbiBwYWNrX2hkcihvYmopIDo6XG4gICAgICBwYWNrKHBrdF90eXBlLCBvYmopXG4gICAgICByZXR1cm4gb2JqXG5cbiAgICBmdW5jdGlvbiByZWN2X21zZyhwa3QsIHNpbmspIDo6XG4gICAgICB1bnBhY2socGt0KVxuICAgICAgcmV0dXJuIHRfcmVjdihwa3QsIHNpbmspXG5cbiAgICBwYWNrX2hkci5wa3RfdHlwZSA9IHJlY3ZfbXNnLnBrdF90eXBlID0gcGt0X3R5cGVcbiAgICBvdXRib3VuZFtiaXRzXSA9IHBhY2tfaGRyXG4gICAgaW5ib3VuZFtwa3RfdHlwZV0gPSByZWN2X21zZ1xuXG4gICAgaWYgJ3Byb2R1Y3Rpb24nICE9PSBwcm9jZXNzLmVudi5OT0RFX0VOViA6OlxuICAgICAgY29uc3Qgb3AgPSBwYWNrX2hkci5vcCA9IHJlY3ZfbXNnLm9wID0gZnJhbWUub3BcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBAIHBhY2tfaGRyLCAnbmFtZScsIEB7fSB2YWx1ZTogYHBhY2tfaGRyIMKrJHtvcH3Cu2BcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBAIHJlY3ZfbXNnLCAnbmFtZScsIEB7fSB2YWx1ZTogYHJlY3ZfbXNnIMKrJHtvcH3Cu2BcblxuICByZXR1cm4gb3V0Ym91bmRcblxuIiwiZXhwb3J0ICogZnJvbSAnLi9mcmFtaW5nLmpzeSdcbmV4cG9ydCAqIGZyb20gJy4vbXVsdGlwYXJ0LmpzeSdcbmV4cG9ydCAqIGZyb20gJy4vc3RyZWFtaW5nLmpzeSdcbmV4cG9ydCAqIGZyb20gJy4vdHJhbnNwb3J0LmpzeSdcblxuaW1wb3J0IG11bHRpcGFydCBmcm9tICcuL211bHRpcGFydC5qc3knXG5pbXBvcnQgc3RyZWFtaW5nIGZyb20gJy4vc3RyZWFtaW5nLmpzeSdcbmltcG9ydCB0cmFuc3BvcnQgZnJvbSAnLi90cmFuc3BvcnQuanN5J1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpbml0X3NoYXJlZChwYWNrZXRQYXJzZXIsIG9wdGlvbnMpIDo6XG4gIGNvbnN0IHNoYXJlZCA9IE9iamVjdC5hc3NpZ24gQCB7cGFja2V0UGFyc2VyLCBzdGF0ZUZvcn0sIG9wdGlvbnNcblxuICBPYmplY3QuYXNzaWduIEAgc2hhcmVkLFxuICAgIG11bHRpcGFydCBAIHBhY2tldFBhcnNlciwgc2hhcmVkXG4gICAgc3RyZWFtaW5nIEAgcGFja2V0UGFyc2VyLCBzaGFyZWRcbiAgICB0cmFuc3BvcnQgQCBwYWNrZXRQYXJzZXIsIHNoYXJlZFxuXG4gIHJldHVybiBzaGFyZWRcblxuZnVuY3Rpb24gc3RhdGVGb3IocGt0LCBzaW5rLCBjcmVhdGVTdGF0ZSkgOjpcbiAgY29uc3Qge2J5X21zZ2lkfSA9IHNpbmssIHttc2dpZH0gPSBwa3QuaW5mb1xuICBsZXQgc3RhdGUgPSBieV9tc2dpZC5nZXQobXNnaWQpXG4gIGlmIHVuZGVmaW5lZCA9PT0gc3RhdGUgOjpcbiAgICBpZiAhIG1zZ2lkIDo6IHRocm93IG5ldyBFcnJvciBAIGBJbnZhbGlkIG1zZ2lkOiAke21zZ2lkfWBcblxuICAgIHN0YXRlID0gY3JlYXRlU3RhdGUgQCBwa3QsIHNpbmssICgpID0+IGJ5X21zZ2lkLmRlbGV0ZShtc2dpZClcbiAgICBieV9tc2dpZC5zZXQgQCBtc2dpZCwgc3RhdGVcbiAgcmV0dXJuIHN0YXRlXG5cbiIsImNvbnN0IG5vb3BfZW5jb2RpbmdzID0gQHt9XG4gIGVuY29kZShidWYsIG9iaiwgY2hhbikgOjogcmV0dXJuIGJ1ZlxuICBkZWNvZGUoYnVmLCBpbmZvLCBzaW5rKSA6OiByZXR1cm4gYnVmXG5cbmV4cG9ydCBkZWZhdWx0IGpzb25fcHJvdG9jb2xcbmV4cG9ydCBmdW5jdGlvbiBqc29uX3Byb3RvY29sKHNoYXJlZCwge2VuY29kZSwgZGVjb2RlfT1ub29wX2VuY29kaW5ncykgOjpcbiAgY29uc3Qge3N0YXRlRm9yLCBjcmVhdGVNdWx0aXBhcnQsIGNyZWF0ZVN0cmVhbSwganNvbl9wYWNrfSA9IHNoYXJlZFxuICBjb25zdCB7cGFja191dGY4LCB1bnBhY2tfdXRmOH0gPSBzaGFyZWQucGFja2V0UGFyc2VyXG4gIGNvbnN0IHN0cmVhbV9tc2dfdW5wYWNrID0gYXNfanNvbl9jb250ZW50XG5cbiAgcmV0dXJuIEB7fVxuICAgIHBhY2tCb2R5XG5cbiAgICBnZXQgZGF0YWdyYW0oKSA6OiByZXR1cm4gdGhpcy5kaXJlY3RcbiAgICBkaXJlY3Q6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3QgaW5mbyA9IHBrdC5pbmZvXG4gICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBwa3QuYm9keV9idWZmZXIoKSwgaW5mbywgc2lua1xuICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBpbmZvXG5cbiAgICBtdWx0aXBhcnQ6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlTXVsdGlwYXJ0XG4gICAgICAgIGNvbnN0IGJvZHlfYnVmID0gc3RhdGUuZmVlZChwa3QpXG4gICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gYm9keV9idWYgOjpcbiAgICAgICAgICBjb25zdCBpbmZvID0gc3RhdGUuaW5mb1xuICAgICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1ZiwgaW5mbywgc2lua1xuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIGluZm9cblxuICAgIHN0cmVhbWluZzogQHt9XG4gICAgICBtb2RlOiAnb2JqZWN0J1xuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlU3RyZWFtXG4gICAgICAgIHJldHVybiBzdGF0ZS5mZWVkKHBrdCwgYXNfanNvbl9jb250ZW50LCBzdHJlYW1fbXNnX3VucGFjaylcblxuICAgICAgbXNnX3BhY2sobXNnLCBvYmosIGNoYW4pIDo6XG4gICAgICAgIGNvbnN0IG1zZ19idWYgPSBwYWNrX3V0ZjggQCBqc29uX3BhY2sgQCBtc2dcbiAgICAgICAgcmV0dXJuIGVuY29kZShtc2dfYnVmLCBvYmosIGNoYW4pXG5cblxuICBmdW5jdGlvbiBwYWNrQm9keShib2R5LCBvYmosIGNoYW4pIDo6XG4gICAgY29uc3QgYm9keV9idWYgPSBwYWNrX3V0ZjggQCBqc29uX3BhY2sgQCBib2R5XG4gICAgcmV0dXJuIGVuY29kZShib2R5X2J1Ziwgb2JqLCBjaGFuKVxuXG4gIGZ1bmN0aW9uIGFzX2pzb25fY29udGVudChwa3QsIHNpbmspIDo6XG4gICAgY29uc3QganNvbl9idWYgPSBkZWNvZGUocGt0LmJvZHlfYnVmZmVyKCksIHBrdC5pbmZvLCBzaW5rKVxuICAgIHJldHVybiBzaW5rLmpzb25fdW5wYWNrIEAgdW5wYWNrX3V0ZjggQCBqc29uX2J1ZlxuXG4gIGZ1bmN0aW9uIHVucGFja0JvZHlCdWYoYm9keV9idWYsIGluZm8sIHNpbmspIDo6XG4gICAgY29uc3QganNvbl9idWYgPSBkZWNvZGUoYm9keV9idWYsIGluZm8sIHNpbmspXG4gICAgcmV0dXJuIHNpbmsuanNvbl91bnBhY2sgQCBqc29uX2J1ZiA/IHVucGFja191dGY4KGpzb25fYnVmKSA6IHVuZGVmaW5lZFxuXG4iLCJjb25zdCBub29wX2VuY29kaW5ncyA9IEB7fVxuICBlbmNvZGUoYnVmLCBvYmosIGNoYW4pIDo6IHJldHVybiBidWZcbiAgZGVjb2RlKGJ1ZiwgaW5mbywgc2luaykgOjogcmV0dXJuIGJ1ZlxuXG5leHBvcnQgZGVmYXVsdCBiaW5hcnlfcHJvdG9jb2xcbmV4cG9ydCBmdW5jdGlvbiBiaW5hcnlfcHJvdG9jb2woc2hhcmVkLCB7ZW5jb2RlLCBkZWNvZGV9PW5vb3BfZW5jb2RpbmdzKSA6OlxuICBjb25zdCB7c3RhdGVGb3IsIGNyZWF0ZU11bHRpcGFydCwgY3JlYXRlU3RyZWFtfSA9IHNoYXJlZFxuICBjb25zdCB7YXNCdWZmZXJ9ID0gc2hhcmVkLnBhY2tldFBhcnNlclxuXG4gIHJldHVybiBAe31cbiAgICBwYWNrQm9keVxuXG4gICAgZ2V0IGRhdGFncmFtKCkgOjogcmV0dXJuIHRoaXMuZGlyZWN0XG4gICAgZGlyZWN0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IGluZm8gPSBwa3QuaW5mb1xuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHBrdC5ib2R5X2J1ZmZlcigpXG4gICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1ZiwgaW5mbywgc2lua1xuICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBpbmZvXG5cbiAgICBtdWx0aXBhcnQ6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZUZvciBAIHBrdCwgc2luaywgY3JlYXRlTXVsdGlwYXJ0XG4gICAgICAgIGNvbnN0IGJvZHlfYnVmID0gc3RhdGUuZmVlZChwa3QpXG4gICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gYm9keV9idWYgOjpcbiAgICAgICAgICBjb25zdCBpbmZvID0gc3RhdGUuaW5mb1xuICAgICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1ZiwgaW5mbywgc2lua1xuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIGluZm9cblxuICAgIHN0cmVhbWluZzogQHt9XG4gICAgICBtb2RlOiAnYnl0ZXMnXG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0YXRlRm9yIEAgcGt0LCBzaW5rLCBjcmVhdGVTdHJlYW1cbiAgICAgICAgY29uc3QgYm9keV9idWYgPSBzdGF0ZS5mZWVkKHBrdCwgcGt0X2J1ZmZlciwgc3RyZWFtX21zZ191bnBhY2spXG4gICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gYm9keV9idWYgOjpcbiAgICAgICAgICBjb25zdCBpbmZvID0gc3RhdGUuaW5mb1xuICAgICAgICAgIGNvbnN0IG1zZyA9IHVucGFja0JvZHlCdWYgQCBib2R5X2J1ZiwgaW5mbywgc2lua1xuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIGluZm9cblxuICAgICAgbXNnX3BhY2sobXNnLCBvYmosIGNoYW4pIDo6XG4gICAgICAgIGNvbnN0IG1zZ19idWYgPSBwYWNrX3V0ZjggQCBqc29uX3BhY2sgQCBtc2dcbiAgICAgICAgcmV0dXJuIGVuY29kZShtc2dfYnVmLCBvYmosIGNoYW4pXG5cblxuICBmdW5jdGlvbiBzdHJlYW1fbXNnX3VucGFjayhwa3QsIHNpbmspIDo6XG4gICAgY29uc3QganNvbl9idWYgPSBkZWNvZGUocGt0LmJvZHlfYnVmZmVyKCksIHBrdC5pbmZvLCBzaW5rKVxuICAgIHJldHVybiBzaW5rLmpzb25fdW5wYWNrIEAgdW5wYWNrX3V0ZjgoanNvbl9idWYpXG5cbiAgZnVuY3Rpb24gcGFja0JvZHkoYm9keSwgb2JqLCBjaGFuKSA6OlxuICAgIGNvbnN0IGJvZHlfYnVmID0gYXNCdWZmZXIgQCBib2R5XG4gICAgcmV0dXJuIGVuY29kZShib2R5X2J1Ziwgb2JqLCBjaGFuKVxuICBmdW5jdGlvbiB1bnBhY2tCb2R5QnVmKGJvZHlfYnVmLCBpbmZvLCBzaW5rKSA6OlxuICAgIHJldHVybiBkZWNvZGUoYm9keV9idWYsIGluZm8sIHNpbmspXG5cbmZ1bmN0aW9uIHBrdF9idWZmZXIocGt0KSA6OiByZXR1cm4gcGt0LmJvZHlfYnVmZmVyKClcblxuIiwiZXhwb3J0IGRlZmF1bHQgY29udHJvbF9wcm90b2NvbFxuZXhwb3J0IGZ1bmN0aW9uIGNvbnRyb2xfcHJvdG9jb2woaW5ib3VuZCwgaGlnaCwgc2hhcmVkKSA6OlxuICBjb25zdCB7Y2hvb3NlRnJhbWluZywgcmFuZG9tX2lkfSA9IHNoYXJlZFxuICBjb25zdCB7cGFja1BhY2tldE9ian0gPSBzaGFyZWQucGFja2V0UGFyc2VyXG5cbiAgY29uc3QgcGluZ19mcmFtZSA9IGNob29zZUZyYW1pbmcgQDogZnJvbV9pZDogdHJ1ZSwgdG9rZW46IHRydWUsIHRyYW5zcG9ydDogJ2RpcmVjdCdcbiAgY29uc3QgcG9uZ19mcmFtZSA9IGNob29zZUZyYW1pbmcgQDogZnJvbV9pZDogdHJ1ZSwgbXNnaWQ6IHRydWUsIHRyYW5zcG9ydDogJ2RhdGFncmFtJ1xuXG4gIGNvbnN0IHBvbmdfdHlwZSA9IGhpZ2h8MHhlXG4gIGluYm91bmRbcG9uZ190eXBlXSA9IHJlY3ZfcG9uZ1xuICBjb25zdCBwaW5nX3R5cGUgPSBoaWdofDB4ZlxuICBpbmJvdW5kW2hpZ2h8MHhmXSA9IHJlY3ZfcGluZ1xuXG4gIHJldHVybiBAe30gc2VuZDpwaW5nLCBwaW5nXG5cbiAgZnVuY3Rpb24gcGluZyhjaGFuLCBvYmopIDo6XG4gICAgaWYgISBvYmoudG9rZW4gOjpcbiAgICAgIG9iai50b2tlbiA9IHJhbmRvbV9pZCgpXG4gICAgb2JqLmJvZHkgPSBKU09OLnN0cmluZ2lmeSBAOlxuICAgICAgb3A6ICdwaW5nJywgdHMwOiBuZXcgRGF0ZSgpXG4gICAgcGluZ19mcmFtZS5wYWNrKHBpbmdfdHlwZSwgb2JqKVxuICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICByZXR1cm4gY2hhbi5zZW5kIEAgcGt0XG5cbiAgZnVuY3Rpb24gcmVjdl9waW5nKHBrdCwgc2luaywgcm91dGVyKSA6OlxuICAgIHBpbmdfZnJhbWUudW5wYWNrKHBrdClcbiAgICBwa3QuYm9keSA9IHBrdC5ib2R5X2pzb24oKVxuICAgIF9zZW5kX3BvbmcgQCBwa3QuYm9keSwgcGt0LCByb3V0ZXJcbiAgICByZXR1cm4gc2luay5yZWN2Q3RybChwa3QuYm9keSwgcGt0LmluZm8pXG5cbiAgZnVuY3Rpb24gX3NlbmRfcG9uZyh7dHMwfSwgcGt0X3BpbmcsIHJvdXRlcikgOjpcbiAgICBjb25zdCB7bXNnaWQsIGlkX3RhcmdldCwgaWRfcm91dGVyLCBmcm9tX2lkOnJfaWR9ID0gcGt0X3BpbmcuaW5mb1xuICAgIGNvbnN0IG9iaiA9IEB7fSBtc2dpZFxuICAgICAgZnJvbV9pZDogQHt9IGlkX3RhcmdldCwgaWRfcm91dGVyXG4gICAgICBpZF9yb3V0ZXI6IHJfaWQuaWRfcm91dGVyLCBpZF90YXJnZXQ6IHJfaWQuaWRfdGFyZ2V0XG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSBAOlxuICAgICAgICBvcDogJ3BvbmcnLCB0czAsIHRzMTogbmV3IERhdGUoKVxuXG4gICAgcG9uZ19mcmFtZS5wYWNrKHBvbmdfdHlwZSwgb2JqKVxuICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICByZXR1cm4gcm91dGVyLmRpc3BhdGNoIEAgW3BrdF1cblxuICBmdW5jdGlvbiByZWN2X3BvbmcocGt0LCBzaW5rKSA6OlxuICAgIHBvbmdfZnJhbWUudW5wYWNrKHBrdClcbiAgICBwa3QuYm9keSA9IHBrdC5ib2R5X2pzb24oKVxuICAgIHJldHVybiBzaW5rLnJlY3ZDdHJsKHBrdC5ib2R5LCBwa3QuaW5mbylcblxuIiwiaW1wb3J0IGluaXRfc2hhcmVkIGZyb20gJy4vc2hhcmVkL2luZGV4LmpzeSdcbmltcG9ydCBqc29uX3Byb3RvY29sIGZyb20gJy4vcHJvdG9jb2xzL2pzb24uanN5J1xuaW1wb3J0IGJpbmFyeV9wcm90b2NvbCBmcm9tICcuL3Byb3RvY29scy9iaW5hcnkuanN5J1xuaW1wb3J0IGNvbnRyb2xfcHJvdG9jb2wgZnJvbSAnLi9wcm90b2NvbHMvY29udHJvbC5qc3knXG5cblxuY29uc3QgZGVmYXVsdF9wbHVnaW5fb3B0aW9ucyA9IEA6XG4gIHVzZVN0YW5kYXJkOiB0cnVlXG4gIGpzb25fcGFjazogSlNPTi5zdHJpbmdpZnlcbiAgY3VzdG9tKHByb3RvY29scykgOjogcmV0dXJuIHByb3RvY29sc1xuXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBsdWdpbl9vcHRpb25zKSA6OlxuICBwbHVnaW5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24gQCB7fSwgZGVmYXVsdF9wbHVnaW5fb3B0aW9ucywgcGx1Z2luX29wdGlvbnNcbiAgY29uc3QgeyBwbHVnaW5fbmFtZSwgcmFuZG9tX2lkLCBqc29uX3BhY2sgfSA9IHBsdWdpbl9vcHRpb25zXG5cbiAgcmV0dXJuIEA6IHN1YmNsYXNzLCBvcmRlcjogLTEgLy8gZGVwZW5kZW50IG9uIHJvdXRlciBwbHVnaW4ncyAoLTIpIHByb3ZpZGluZyBwYWNrZXRQYXJzZXJcbiAgXG4gIGZ1bmN0aW9uIHN1YmNsYXNzKEZhYnJpY0h1Yl9QSSwgYmFzZXMpIDo6XG4gICAgY29uc3Qge3BhY2tldFBhcnNlcn0gPSBGYWJyaWNIdWJfUEkucHJvdG90eXBlXG4gICAgaWYgbnVsbD09cGFja2V0UGFyc2VyIHx8ICEgcGFja2V0UGFyc2VyLmlzUGFja2V0UGFyc2VyKCkgOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgSW52YWxpZCBwYWNrZXRQYXJzZXIgZm9yIHBsdWdpbmBcbiAgICBcblxuICAgIGNvbnN0IHNoYXJlZCA9IGluaXRfc2hhcmVkIEAgcGFja2V0UGFyc2VyLCBAe30gcmFuZG9tX2lkLCBqc29uX3BhY2tcbiAgICBsZXQgcHJvdG9jb2xzID0gQHt9IHNoYXJlZCwgcmFuZG9tX2lkLCBpbmJvdW5kOiBbXSwgY29kZWNzOiBPYmplY3QuY3JlYXRlKG51bGwpLCBcblxuICAgIGlmIHBsdWdpbl9vcHRpb25zLnVzZVN0YW5kYXJkIDo6XG4gICAgICBwcm90b2NvbHMgPSBpbml0X3Byb3RvY29scyBAIHByb3RvY29sc1xuXG4gICAgcHJvdG9jb2xzID0gcGx1Z2luX29wdGlvbnMuY3VzdG9tIEAgcHJvdG9jb2xzXG4gICAgRmFicmljSHViX1BJLnByb3RvdHlwZS5wcm90b2NvbHMgPSBwcm90b2NvbHNcblxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdF9wcm90b2NvbHMocHJvdG9jb2xzKSA6OlxuICBjb25zdCB7aW5ib3VuZCwgY29kZWNzLCBzaGFyZWR9ID0gcHJvdG9jb2xzXG5cbiAgY29kZWNzLmRlZmF1bHQgPSBjb2RlY3MuanNvbiA9IEBcbiAgICBzaGFyZWQuYmluZFRyYW5zcG9ydHMgQCAvLyAweDAqIOKAlCBKU09OIGJvZHlcbiAgICAgIGluYm91bmQsIDB4MDAsIGpzb25fcHJvdG9jb2woc2hhcmVkKVxuXG4gIGNvZGVjcy5iaW5hcnkgPSBAXG4gICAgc2hhcmVkLmJpbmRUcmFuc3BvcnRzIEAgLy8gMHgxKiDigJQgYmluYXJ5IGJvZHlcbiAgICAgIGluYm91bmQsIDB4MTAsIGJpbmFyeV9wcm90b2NvbChzaGFyZWQpXG5cbiAgY29kZWNzLmNvbnRyb2wgPSBAIC8vIDB4Ziog4oCUIGNvbnRyb2xcbiAgICBjb250cm9sX3Byb3RvY29sIEAgaW5ib3VuZCwgMHhmMCwgc2hhcmVkXG5cbiAgcmV0dXJuIHByb3RvY29sc1xuXG4iLCJpbXBvcnQgcGx1Z2luIGZyb20gJy4vcGx1Z2luLmpzeSdcblxuY29uc3QgZ2V0UmFuZG9tVmFsdWVzID0gJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiB3aW5kb3dcbiAgPyB3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyA6IG51bGxcblxucHJvdG9jb2xzX2Jyb3dzZXIucmFuZG9tX2lkID0gcmFuZG9tX2lkXG5mdW5jdGlvbiByYW5kb21faWQoKSA6OlxuICBjb25zdCBhcnIgPSBuZXcgSW50MzJBcnJheSgxKVxuICBnZXRSYW5kb21WYWx1ZXMoYXJyKVxuICByZXR1cm4gYXJyWzBdXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHByb3RvY29sc19icm93c2VyKHBsdWdpbl9vcHRpb25zPXt9KSA6OlxuICBpZiBudWxsID09IHBsdWdpbl9vcHRpb25zLnJhbmRvbV9pZCA6OlxuICAgIHBsdWdpbl9vcHRpb25zLnJhbmRvbV9pZCA9IHJhbmRvbV9pZFxuXG4gIHJldHVybiBwbHVnaW4ocGx1Z2luX29wdGlvbnMpXG5cbiJdLCJuYW1lcyI6WyJsaXR0bGVfZW5kaWFuIiwiY19zaW5nbGUiLCJjX2RhdGFncmFtIiwiY19kaXJlY3QiLCJjX211bHRpcGFydCIsImNfc3RyZWFtaW5nIiwiX2Vycl9tc2dpZF9yZXF1aXJlZCIsIl9lcnJfdG9rZW5fcmVxdWlyZWQiLCJmcm1fcm91dGluZyIsInNpemUiLCJiaXRzIiwibWFzayIsIm9iaiIsImZyb21faWQiLCJkdiIsIm9mZnNldCIsInNldEludDMyIiwiaWRfcm91dGVyIiwiaWRfdGFyZ2V0IiwidW5kZWZpbmVkIiwiZ2V0SW50MzIiLCJmcm1fcmVzcG9uc2UiLCJtc2dpZCIsIkVycm9yIiwic2V0SW50MTYiLCJzZXFfYWNrIiwiYWNrX2ZsYWdzIiwidG9rZW4iLCJnZXRJbnQxNiIsImZybV9kYXRhZ3JhbSIsInRyYW5zcG9ydCIsImZybV9kaXJlY3QiLCJmcm1fbXVsdGlwYXJ0Iiwic2VxX3BvcyIsInNlcSIsInNlcV9mbGFncyIsImZybV9zdHJlYW1pbmciLCJiaW5kX3NlcV9uZXh0Iiwic2VxX29mZnNldCIsInNlcV9uZXh0IiwiZmxhZ3MiLCJmaW4iLCJOYU4iLCJjb21wb3NlRnJhbWluZ3MiLCJmcm1fZnJvbSIsImZybV9yZXNwIiwiZnJtX3RyYW5zcG9ydHMiLCJsZW5ndGgiLCJieUJpdHMiLCJ0X2Zyb20iLCJmX3Rlc3QiLCJ0X3Jlc3AiLCJ0MCIsInQxIiwidDIiLCJ0MyIsIm1hcCIsImYiLCJ0ZXN0Qml0cyIsImNob29zZSIsImxzdCIsIlQiLCJiIiwib3AiLCJmbl9rZXkiLCJmbl90cmFuIiwiZm5fZnJvbSIsImZuX3Jlc3AiLCJmcm0iLCJiaW5kQXNzZW1ibGVkIiwiZl9wYWNrIiwiZl91bnBhY2siLCJwYWNrIiwidW5wYWNrIiwicGt0X3R5cGUiLCJwa3Rfb2JqIiwiVHlwZUVycm9yIiwidHlwZSIsIkRhdGFWaWV3IiwiQXJyYXlCdWZmZXIiLCJoZWFkZXIiLCJidWZmZXIiLCJzbGljZSIsInBrdCIsImJ1ZiIsImhlYWRlcl9idWZmZXIiLCJVaW50OEFycmF5IiwiaW5mbyIsIl9iaW5kX2l0ZXJhYmxlIiwiYnVmX2Nsb25lIiwidHRsIiwibmV4dCIsIm9wdGlvbnMiLCJkb25lIiwidmFsdWUiLCJwYWNrZXRQYXJzZXIiLCJzaGFyZWQiLCJjb25jYXRCdWZmZXJzIiwiY3JlYXRlTXVsdGlwYXJ0Iiwic2luayIsImRlbGV0ZVN0YXRlIiwicGFydHMiLCJmZWVkIiwiYm9keV9idWZmZXIiLCJpbmNsdWRlcyIsInJlcyIsImNyZWF0ZVN0cmVhbSIsInJlY3ZEYXRhIiwicnN0cmVhbSIsInN0YXRlIiwiZmVlZF9pbml0IiwiYXNfY29udGVudCIsIm1zZ191bnBhY2siLCJmZWVkX2lnbm9yZSIsIm1zZyIsImpzb25fdW5wYWNrIiwiYm9keV91dGY4IiwicmVjdlN0cmVhbSIsInJlY3ZTdHJlYW1EYXRhIiwiYmluZCIsImVyciIsIm9uX2Vycm9yIiwiZmVlZF9ib2R5Iiwib25faW5pdCIsImRhdGEiLCJvbl9kYXRhIiwib25fZW5kIiwiZmVlZF9zZXEiLCJjaGVja19mbnMiLCJrZXlzIiwia2V5IiwicGFja1BhY2tldE9iaiIsInJhbmRvbV9pZCIsImpzb25fcGFjayIsImNob29zZUZyYW1pbmciLCJmcmFtaW5ncyIsImZyYWdtZW50X3NpemUiLCJOdW1iZXIiLCJiaW5kVHJhbnNwb3J0cyIsInBhY2tldEZyYWdtZW50cyIsImluYm91bmQiLCJoaWdoYml0cyIsInRyYW5zcG9ydHMiLCJwYWNrQm9keSIsIm91dGJvdW5kIiwiYmluZFRyYW5zcG9ydEltcGxzIiwic3RyZWFtaW5nIiwic2VuZCIsInN0cmVhbSIsImJpbmRTdHJlYW0iLCJjaGFuIiwiYm9keSIsImJ5dGVMZW5ndGgiLCJtc2VuZCIsIm1zZW5kX2J5dGVzIiwicGFja19oZHIiLCJtc2VuZF9vYmplY3RzIiwibW9kZSIsIm1zZ19wYWNrIiwibXNlbmRfaW1wbCIsIm9iamVjdCIsImJ5dGVzIiwid3JpdGUiLCJlbmQiLCJjaHVuayIsIm5leHRfaGRyIiwiaSIsImxhc3RJbm5lciIsImkwIiwiZnJhbWUiLCJpbXBsIiwidF9yZWN2IiwicmVjdl9tc2ciLCJpbml0X3NoYXJlZCIsIk9iamVjdCIsImFzc2lnbiIsInN0YXRlRm9yIiwibXVsdGlwYXJ0IiwiY3JlYXRlU3RhdGUiLCJieV9tc2dpZCIsImdldCIsImRlbGV0ZSIsInNldCIsIm5vb3BfZW5jb2RpbmdzIiwianNvbl9wcm90b2NvbCIsImVuY29kZSIsImRlY29kZSIsInBhY2tfdXRmOCIsInVucGFja191dGY4Iiwic3RyZWFtX21zZ191bnBhY2siLCJhc19qc29uX2NvbnRlbnQiLCJkYXRhZ3JhbSIsImRpcmVjdCIsInVucGFja0JvZHlCdWYiLCJyZWN2TXNnIiwiYm9keV9idWYiLCJtc2dfYnVmIiwianNvbl9idWYiLCJiaW5hcnlfcHJvdG9jb2wiLCJhc0J1ZmZlciIsInBrdF9idWZmZXIiLCJjb250cm9sX3Byb3RvY29sIiwiaGlnaCIsInBpbmdfZnJhbWUiLCJwb25nX2ZyYW1lIiwicG9uZ190eXBlIiwicmVjdl9wb25nIiwicGluZ190eXBlIiwicmVjdl9waW5nIiwicGluZyIsIkpTT04iLCJzdHJpbmdpZnkiLCJ0czAiLCJEYXRlIiwicm91dGVyIiwiYm9keV9qc29uIiwicmVjdkN0cmwiLCJfc2VuZF9wb25nIiwicGt0X3BpbmciLCJyX2lkIiwidHMxIiwiZGlzcGF0Y2giLCJkZWZhdWx0X3BsdWdpbl9vcHRpb25zIiwicHJvdG9jb2xzIiwicGx1Z2luX29wdGlvbnMiLCJwbHVnaW5fbmFtZSIsInN1YmNsYXNzIiwib3JkZXIiLCJGYWJyaWNIdWJfUEkiLCJiYXNlcyIsInByb3RvdHlwZSIsImlzUGFja2V0UGFyc2VyIiwiY29kZWNzIiwiY3JlYXRlIiwidXNlU3RhbmRhcmQiLCJpbml0X3Byb3RvY29scyIsImN1c3RvbSIsImRlZmF1bHQiLCJqc29uIiwiYmluYXJ5IiwiY29udHJvbCIsImdldFJhbmRvbVZhbHVlcyIsIndpbmRvdyIsImNyeXB0byIsInByb3RvY29sc19icm93c2VyIiwiYXJyIiwiSW50MzJBcnJheSIsInBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxNQUFNQSxnQkFBZ0IsSUFBdEI7QUFDQSxNQUFNQyxXQUFXLFFBQWpCO0FBQ0EsTUFBTUMsYUFBYSxVQUFuQjtBQUNBLE1BQU1DLFdBQVcsUUFBakI7QUFDQSxNQUFNQyxjQUFjLFdBQXBCO0FBQ0EsTUFBTUMsY0FBYyxXQUFwQjs7QUFFQSxNQUFNQyxzQkFBdUIsMEJBQTdCO0FBQ0EsTUFBTUMsc0JBQXVCLDJCQUE3Qjs7QUFHQSxTQUFTQyxXQUFULEdBQXVCO1FBQ2ZDLE9BQU8sQ0FBYjtRQUFnQkMsT0FBTyxHQUF2QjtRQUE0QkMsT0FBTyxHQUFuQztTQUNPO1FBQUEsRUFDQ0QsSUFERCxFQUNPQyxJQURQOztXQUdFQyxHQUFQLEVBQVk7YUFBVSxRQUFRQSxJQUFJQyxPQUFaLEdBQXNCSCxJQUF0QixHQUE2QixLQUFwQztLQUhWOztXQUtFRSxHQUFQLEVBQVlFLEVBQVosRUFBZ0JDLE1BQWhCLEVBQXdCO1lBQ2hCLEVBQUNGLE9BQUQsS0FBWUQsR0FBbEI7U0FDR0ksUUFBSCxDQUFjLElBQUVELE1BQWhCLEVBQXdCLElBQUVGLFFBQVFJLFNBQWxDLEVBQTZDakIsYUFBN0M7U0FDR2dCLFFBQUgsQ0FBYyxJQUFFRCxNQUFoQixFQUF3QixJQUFFRixRQUFRSyxTQUFsQyxFQUE2Q2xCLGFBQTdDO0tBUkc7O2FBVUlZLEdBQVQsRUFBY0UsRUFBZCxFQUFrQkMsTUFBbEIsRUFBMEI7WUFDbEJGLFVBQVVNLGNBQWNQLElBQUlDLE9BQWxCLEdBQ1pELElBQUlDLE9BQUosR0FBYyxFQURGLEdBQ09ELElBQUlDLE9BRDNCO2NBRVFJLFNBQVIsR0FBb0JILEdBQUdNLFFBQUgsQ0FBYyxJQUFFTCxNQUFoQixFQUF3QmYsYUFBeEIsQ0FBcEI7Y0FDUWtCLFNBQVIsR0FBb0JK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
