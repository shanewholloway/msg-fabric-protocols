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

  function createMultipart(pkt, sink, msgid) {
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

      sink.deleteStateFor(msgid);

      const res = concatBuffers(parts);
      parts = null;
      return res;
    }
  }
};

var streaming = function (packetParser, shared) {
  return { createStream };

  function createStream(pkt, sink, msgid) {
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
          sink.deleteStateFor(msgid);
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
      body = packBody(body);
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
      return chan(pkt);
    }

    function msend_bytes(chan, obj, msg) {
      const pack_hdr = outbound.choose(obj);
      let { next } = pack_hdr(obj);
      if (null !== msg) {
        obj.body = msg;
        const pkt = packPacketObj(obj);
        chan(pkt);
      }

      return async function (fin, body) {
        if (null === next) {
          throw new Error('Write after end');
        }
        let res;
        for (const obj of packetFragments(body, next, fin)) {
          const pkt = packPacketObj(obj);
          res = await chan(pkt);
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
        chan(pkt);
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
        return chan(pkt);
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
          return chunk != null ? msend(true === this, packBody(chunk)) : msend(true);
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
  const shared = Object.assign({ packetParser }, options);

  Object.assign(shared, multipart(packetParser, shared), streaming(packetParser, shared), transport(packetParser, shared));

  return shared;
}

function json_protocol(shared) {
  const { createMultipart, createStream, json_pack } = shared;
  const { pack_utf8, unpack_utf8 } = shared.packetParser;

  return {
    packBody,

    get datagram() {
      return this.direct;
    },
    direct: {
      t_recv(pkt, sink) {
        const msg = sink.json_unpack(pkt.body_utf8() || undefined);
        return sink.recvMsg(msg, pkt.info);
      } },

    multipart: {
      t_recv(pkt, sink) {
        const state = sink.stateFor(pkt, createMultipart);
        const body_buf = state.feed(pkt);
        if (undefined !== body_buf) {
          const msg = sink.json_unpack(unpack_utf8(body_buf) || undefined);
          return sink.recvMsg(msg, state.info);
        }
      } },

    streaming: {
      mode: 'object',
      t_recv(pkt, sink) {
        const state = sink.stateFor(pkt, createStream);
        return state.feed(pkt, unpackBody);
      } } };

  function packBody(body) {
    return pack_utf8(json_pack(body));
  }

  function unpackBody(pkt, sink) {
    return sink.json_unpack(pkt.body_utf8());
  }
}

function binary_protocol(shared) {
  const { createMultipart, createStream } = shared;
  const { pack_utf8, unpack_utf8 } = shared.packetParser;
  const { asBuffer } = shared.packetParser;
  return {
    packBody: asBuffer,

    get datagram() {
      return this.direct;
    },
    direct: {
      t_recv(pkt, sink) {
        const msg = pkt.body_buffer();
        return sink.recvMsg(msg, pkt.info);
      } },

    multipart: {
      t_recv(pkt, sink) {
        const state = sink.stateFor(pkt, createMultipart);
        const msg = state.feed(pkt);
        if (undefined !== msg) {
          return sink.recvMsg(msg, state.info);
        }
      } },

    streaming: {
      mode: 'bytes',
      t_recv(pkt, sink) {
        const state = sink.stateFor(pkt, createStream);
        const msg = state.feed(pkt, pkt_buffer);
        if (undefined !== msg) {
          return sink.recvMsg(msg, state.info);
        }
      } } };
}

function pkt_buffer(pkt) {
  return pkt.body_buffer();
}

function control_protocol(inbound, high, shared) {
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
  , json_protocol(shared));

  const binary = shared.bindTransports(inbound, 0x10 // 0x1* — binary body
  , binary_protocol(shared));

  const control = control_protocol(inbound, 0xf0 // 0xf* — control
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

export default protocols_nodejs;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZWpzLm1qcyIsInNvdXJjZXMiOlsiLi4vY29kZS9zaGFyZWQvZnJhbWluZy5qc3kiLCIuLi9jb2RlL3NoYXJlZC9tdWx0aXBhcnQuanN5IiwiLi4vY29kZS9zaGFyZWQvc3RyZWFtaW5nLmpzeSIsIi4uL2NvZGUvc2hhcmVkL3RyYW5zcG9ydC5qc3kiLCIuLi9jb2RlL3NoYXJlZC9pbmRleC5qc3kiLCIuLi9jb2RlL3Byb3RvY29scy9qc29uLmpzeSIsIi4uL2NvZGUvcHJvdG9jb2xzL2JpbmFyeS5qc3kiLCIuLi9jb2RlL3Byb3RvY29scy9jb250cm9sLmpzeSIsIi4uL2NvZGUvcGx1Z2luLmpzeSIsIi4uL2NvZGUvaW5kZXgubm9kZWpzLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBsaXR0bGVfZW5kaWFuID0gdHJ1ZVxuY29uc3QgY19zaW5nbGUgPSAnc2luZ2xlJ1xuY29uc3QgY19kYXRhZ3JhbSA9ICdkYXRhZ3JhbSdcbmNvbnN0IGNfZGlyZWN0ID0gJ2RpcmVjdCdcbmNvbnN0IGNfbXVsdGlwYXJ0ID0gJ211bHRpcGFydCdcbmNvbnN0IGNfc3RyZWFtaW5nID0gJ3N0cmVhbWluZydcblxuY29uc3QgX2Vycl9tc2dpZF9yZXF1aXJlZCA9IGBSZXNwb25zZSByZXFpcmVzICdtc2dpZCdgXG5jb25zdCBfZXJyX3Rva2VuX3JlcXVpcmVkID0gYFRyYW5zcG9ydCByZXFpcmVzICd0b2tlbidgXG5cblxuZnVuY3Rpb24gZnJtX3JvdXRpbmcoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4MSwgbWFzayA9IDB4MVxuICByZXR1cm4gQHt9XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIG51bGwgIT0gb2JqLmZyb21faWQgPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBjb25zdCB7ZnJvbV9pZH0gPSBvYmpcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIDB8ZnJvbV9pZC5pZF9yb3V0ZXIsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDMyIEAgNCtvZmZzZXQsIDB8ZnJvbV9pZC5pZF90YXJnZXQsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGNvbnN0IGZyb21faWQgPSB1bmRlZmluZWQgPT09IG9iai5mcm9tX2lkXG4gICAgICAgID8gb2JqLmZyb21faWQgPSB7fSA6IG9iai5mcm9tX2lkXG4gICAgICBmcm9tX2lkLmlkX3JvdXRlciA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGZyb21faWQuaWRfdGFyZ2V0ID0gZHYuZ2V0SW50MzIgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuXG5mdW5jdGlvbiBmcm1fcmVzcG9uc2UoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4MiwgbWFzayA9IDB4MlxuICByZXR1cm4gQHt9XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIG51bGwgIT0gb2JqLm1zZ2lkID8gYml0cyA6IGZhbHNlXG5cbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoubXNnaWQgOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl9tc2dpZF9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLm1zZ2lkLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDQrb2Zmc2V0LCAwfG9iai5zZXFfYWNrLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDYrb2Zmc2V0LCAwfG9iai5hY2tfZmxhZ3MsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai50b2tlbiA9IGR2LmdldEludDMyIEAgMCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXFfYWNrID0gZHYuZ2V0SW50MTYgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLmFja19mbGFncyA9IGR2LmdldEludDE2IEAgNitvZmZzZXQsIGxpdHRsZV9lbmRpYW5cblxuXG5cbmZ1bmN0aW9uIGZybV9kYXRhZ3JhbSgpIDo6XG4gIGNvbnN0IHNpemUgPSAwLCBiaXRzID0gMHgwLCBtYXNrID0gMHhjXG4gIHJldHVybiBAe30gdHJhbnNwb3J0OiBjX2RhdGFncmFtXG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjpcbiAgICAgIGlmIGNfZGF0YWdyYW0gPT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGJpdHNcbiAgICAgIGlmIG9iai50cmFuc3BvcnQgJiYgY19zaW5nbGUgIT09IG9iai50cmFuc3BvcnQgOjogcmV0dXJuIGZhbHNlXG4gICAgICByZXR1cm4gISBvYmoudG9rZW4gPyBiaXRzIDogZmFsc2VcblxuICAgIGZfcGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19kYXRhZ3JhbVxuXG5mdW5jdGlvbiBmcm1fZGlyZWN0KCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDQsIGJpdHMgPSAweDQsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfZGlyZWN0XG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjpcbiAgICAgIGlmIGNfZGlyZWN0ID09PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBiaXRzXG4gICAgICBpZiBvYmoudHJhbnNwb3J0ICYmIGNfc2luZ2xlICE9PSBvYmoudHJhbnNwb3J0IDo6IHJldHVybiBmYWxzZVxuICAgICAgcmV0dXJuICEhIG9iai50b2tlbiA/IGJpdHMgOiBmYWxzZVxuXG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLnRva2VuIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfdG9rZW5fcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai50b2tlbiwgbGl0dGxlX2VuZGlhblxuXG4gICAgZl91bnBhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgb2JqLm1zZ2lkID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnRyYW5zcG9ydCA9IGNfZGlyZWN0XG5cbmZ1bmN0aW9uIGZybV9tdWx0aXBhcnQoKSA6OlxuICBjb25zdCBzaXplID0gOCwgYml0cyA9IDB4OCwgbWFzayA9IDB4Y1xuICByZXR1cm4gQHt9IHRyYW5zcG9ydDogY19tdWx0aXBhcnRcbiAgICBzaXplLCBiaXRzLCBtYXNrXG5cbiAgICBmX3Rlc3Qob2JqKSA6OiByZXR1cm4gY19tdWx0aXBhcnQgPT09IG9iai50cmFuc3BvcnQgPyBiaXRzIDogZmFsc2VcblxuICAgIGJpbmRfc2VxX25leHQsIHNlcV9wb3M6IDRcbiAgICBmX3BhY2sob2JqLCBkdiwgb2Zmc2V0KSA6OlxuICAgICAgaWYgISBvYmoudG9rZW4gOjogdGhyb3cgbmV3IEVycm9yIEAgX2Vycl90b2tlbl9yZXF1aXJlZFxuICAgICAgZHYuc2V0SW50MzIgQCAwK29mZnNldCwgb2JqLnRva2VuLCBsaXR0bGVfZW5kaWFuXG4gICAgICBpZiB0cnVlID09IG9iai5zZXEgOjogLy8gdXNlIHNlcV9uZXh0XG4gICAgICAgIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDAsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGVsc2UgZHYuc2V0SW50MTYgQCA0K29mZnNldCwgMHxvYmouc2VxLCBsaXR0bGVfZW5kaWFuXG4gICAgICBkdi5zZXRJbnQxNiBAIDYrb2Zmc2V0LCAwfG9iai5zZXFfZmxhZ3MsIGxpdHRsZV9lbmRpYW5cblxuICAgIGZfdW5wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIG9iai5tc2dpZCAgICAgPSBkdi5nZXRJbnQzMiBAIDArb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmouc2VxICAgICAgID0gZHYuZ2V0SW50MTYgQCA0K29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcV9mbGFncyA9IGR2LmdldEludDE2IEAgNitvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai50cmFuc3BvcnQgPSBjX211bHRpcGFydFxuXG5mdW5jdGlvbiBmcm1fc3RyZWFtaW5nKCkgOjpcbiAgY29uc3Qgc2l6ZSA9IDgsIGJpdHMgPSAweGMsIG1hc2sgPSAweGNcbiAgcmV0dXJuIEB7fSB0cmFuc3BvcnQ6IGNfc3RyZWFtaW5nXG4gICAgc2l6ZSwgYml0cywgbWFza1xuXG4gICAgZl90ZXN0KG9iaikgOjogcmV0dXJuIGNfc3RyZWFtaW5nID09PSBvYmoudHJhbnNwb3J0ID8gYml0cyA6IGZhbHNlXG5cbiAgICBiaW5kX3NlcV9uZXh0LCBzZXFfcG9zOiA0XG4gICAgZl9wYWNrKG9iaiwgZHYsIG9mZnNldCkgOjpcbiAgICAgIGlmICEgb2JqLnRva2VuIDo6IHRocm93IG5ldyBFcnJvciBAIF9lcnJfdG9rZW5fcmVxdWlyZWRcbiAgICAgIGR2LnNldEludDMyIEAgMCtvZmZzZXQsIG9iai50b2tlbiwgbGl0dGxlX2VuZGlhblxuICAgICAgaWYgdHJ1ZSA9PSBvYmouc2VxIDo6XG4gICAgICAgIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDAsIGxpdHRsZV9lbmRpYW4gLy8gdXNlIHNlcV9uZXh0XG4gICAgICBlbHNlIGR2LnNldEludDE2IEAgNCtvZmZzZXQsIDB8b2JqLnNlcSwgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCA2K29mZnNldCwgMHxvYmouc2VxX2ZsYWdzLCBsaXR0bGVfZW5kaWFuXG5cbiAgICBmX3VucGFjayhvYmosIGR2LCBvZmZzZXQpIDo6XG4gICAgICBvYmoubXNnaWQgICAgID0gZHYuZ2V0SW50MzIgQCAwK29mZnNldCwgbGl0dGxlX2VuZGlhblxuICAgICAgb2JqLnNlcSAgICAgICA9IGR2LmdldEludDE2IEAgNCtvZmZzZXQsIGxpdHRsZV9lbmRpYW5cbiAgICAgIG9iai5zZXFfZmxhZ3MgPSBkdi5nZXRJbnQxNiBAIDYrb2Zmc2V0LCBsaXR0bGVfZW5kaWFuXG4gICAgICBvYmoudHJhbnNwb3J0ID0gY19zdHJlYW1pbmdcblxuXG5mdW5jdGlvbiBiaW5kX3NlcV9uZXh0KG9mZnNldCkgOjpcbiAgY29uc3Qgc2VxX29mZnNldCA9IHRoaXMuc2VxX3BvcyArIG9mZnNldFxuICBsZXQgc2VxID0gMVxuICByZXR1cm4gZnVuY3Rpb24gc2VxX25leHQoe2ZsYWdzLCBmaW59LCBkdikgOjpcbiAgICBpZiAhIGZpbiA6OlxuICAgICAgZHYuc2V0SW50MTYgQCBzZXFfb2Zmc2V0LCBzZXErKywgbGl0dGxlX2VuZGlhblxuICAgICAgZHYuc2V0SW50MTYgQCAyK3NlcV9vZmZzZXQsIDB8ZmxhZ3MsIGxpdHRsZV9lbmRpYW5cbiAgICBlbHNlIDo6XG4gICAgICBkdi5zZXRJbnQxNiBAIHNlcV9vZmZzZXQsIC1zZXEsIGxpdHRsZV9lbmRpYW5cbiAgICAgIGR2LnNldEludDE2IEAgMitzZXFfb2Zmc2V0LCAwfGZsYWdzLCBsaXR0bGVfZW5kaWFuXG4gICAgICBzZXEgPSBOYU5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IGNvbXBvc2VGcmFtaW5ncygpXG5mdW5jdGlvbiBjb21wb3NlRnJhbWluZ3MoKSA6OlxuICBjb25zdCBmcm1fZnJvbSA9IGZybV9yb3V0aW5nKCksIGZybV9yZXNwID0gZnJtX3Jlc3BvbnNlKClcbiAgY29uc3QgZnJtX3RyYW5zcG9ydHMgPSBAW10gZnJtX2RhdGFncmFtKCksIGZybV9kaXJlY3QoKSwgZnJtX211bHRpcGFydCgpLCBmcm1fc3RyZWFtaW5nKClcblxuICBpZiA4ICE9PSBmcm1fZnJvbS5zaXplIHx8IDggIT09IGZybV9yZXNwLnNpemUgfHwgNCAhPSBmcm1fdHJhbnNwb3J0cy5sZW5ndGggOjpcbiAgICB0aHJvdyBuZXcgRXJyb3IgQCBgRnJhbWluZyBTaXplIGNoYW5nZWBcblxuICBjb25zdCBieUJpdHMgPSBbXSwgbWFzaz0weGZcblxuICA6OlxuICAgIGNvbnN0IHRfZnJvbSA9IGZybV9mcm9tLmZfdGVzdCwgdF9yZXNwID0gZnJtX3Jlc3AuZl90ZXN0XG4gICAgY29uc3QgW3QwLHQxLHQyLHQzXSA9IGZybV90cmFuc3BvcnRzLm1hcCBAIGY9PmYuZl90ZXN0XG5cbiAgICBjb25zdCB0ZXN0Qml0cyA9IGJ5Qml0cy50ZXN0Qml0cyA9IG9iaiA9PlxuICAgICAgMCB8IHRfZnJvbShvYmopIHwgdF9yZXNwKG9iaikgfCB0MChvYmopIHwgdDEob2JqKSB8IHQyKG9iaikgfCB0MyhvYmopXG5cbiAgICBieUJpdHMuY2hvb3NlID0gZnVuY3Rpb24gKG9iaiwgbHN0KSA6OlxuICAgICAgaWYgbnVsbCA9PSBsc3QgOjogbHN0ID0gdGhpcyB8fCBieUJpdHNcbiAgICAgIHJldHVybiBsc3RbdGVzdEJpdHMob2JqKV1cblxuXG4gIGZvciBjb25zdCBUIG9mIGZybV90cmFuc3BvcnRzIDo6XG4gICAgY29uc3Qge2JpdHM6Yiwgc2l6ZSwgdHJhbnNwb3J0fSA9IFRcblxuICAgIGJ5Qml0c1tifDBdID0gQHt9IFQsIHRyYW5zcG9ydCwgYml0czogYnwwLCBtYXNrLCBzaXplOiBzaXplLCBvcDogJydcbiAgICBieUJpdHNbYnwxXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MSwgbWFzaywgc2l6ZTogOCArIHNpemUsIG9wOiAnZidcbiAgICBieUJpdHNbYnwyXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MiwgbWFzaywgc2l6ZTogOCArIHNpemUsIG9wOiAncidcbiAgICBieUJpdHNbYnwzXSA9IEB7fSBULCB0cmFuc3BvcnQsIGJpdHM6IGJ8MywgbWFzaywgc2l6ZTogMTYgKyBzaXplLCBvcDogJ2ZyJ1xuXG4gICAgZm9yIGNvbnN0IGZuX2tleSBvZiBbJ2ZfcGFjaycsICdmX3VucGFjayddIDo6XG4gICAgICBjb25zdCBmbl90cmFuID0gVFtmbl9rZXldLCBmbl9mcm9tID0gZnJtX2Zyb21bZm5fa2V5XSwgZm5fcmVzcCA9IGZybV9yZXNwW2ZuX2tleV1cblxuICAgICAgYnlCaXRzW2J8MF1bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX3RyYW4ob2JqLCBkdiwgMClcbiAgICAgIGJ5Qml0c1tifDFdW2ZuX2tleV0gPSBmdW5jdGlvbihvYmosIGR2KSA6OiBmbl9mcm9tKG9iaiwgZHYsIDApOyBmbl90cmFuKG9iaiwgZHYsIDgpXG4gICAgICBieUJpdHNbYnwyXVtmbl9rZXldID0gZnVuY3Rpb24ob2JqLCBkdikgOjogZm5fcmVzcChvYmosIGR2LCAwKTsgZm5fdHJhbihvYmosIGR2LCA4KVxuICAgICAgYnlCaXRzW2J8M11bZm5fa2V5XSA9IGZ1bmN0aW9uKG9iaiwgZHYpIDo6IGZuX2Zyb20ob2JqLCBkdiwgMCk7IGZuX3Jlc3Aob2JqLCBkdiwgOCk7IGZuX3RyYW4ob2JqLCBkdiwgMTYpXG5cbiAgZm9yIGNvbnN0IGZybSBvZiBieUJpdHMgOjpcbiAgICBiaW5kQXNzZW1ibGVkIEAgZnJtXG5cbiAgcmV0dXJuIGJ5Qml0c1xuXG5cbmZ1bmN0aW9uIGJpbmRBc3NlbWJsZWQoZnJtKSA6OlxuICBjb25zdCB7VCwgc2l6ZSwgZl9wYWNrLCBmX3VucGFja30gPSBmcm1cbiAgaWYgVC5iaW5kX3NlcV9uZXh0IDo6XG4gICAgZnJtLnNlcV9uZXh0ID0gVC5iaW5kX3NlcV9uZXh0IEAgZnJtLnNpemUgLSBULnNpemVcblxuICBkZWxldGUgZnJtLlRcbiAgZnJtLnBhY2sgPSBwYWNrIDsgZnJtLnVucGFjayA9IHVucGFja1xuICBjb25zdCBzZXFfbmV4dCA9IGZybS5zZXFfbmV4dFxuXG4gIGZ1bmN0aW9uIHBhY2socGt0X3R5cGUsIHBrdF9vYmopIDo6XG4gICAgaWYgISBAIDAgPD0gcGt0X3R5cGUgJiYgcGt0X3R5cGUgPD0gMjU1IDo6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYEV4cGVjdGVkIHBrdF90eXBlIHRvIGJlIFswLi4yNTVdYFxuXG4gICAgcGt0X29iai50eXBlID0gcGt0X3R5cGVcbiAgICBpZiBzZXFfbmV4dCAmJiBudWxsID09IHBrdF9vYmouc2VxIDo6XG4gICAgICBwa3Rfb2JqLnNlcSA9IHRydWVcblxuICAgIGNvbnN0IGR2ID0gbmV3IERhdGFWaWV3IEAgbmV3IEFycmF5QnVmZmVyKHNpemUpXG4gICAgZl9wYWNrKHBrdF9vYmosIGR2LCAwKVxuICAgIHBrdF9vYmouaGVhZGVyID0gZHYuYnVmZmVyXG5cbiAgICBpZiB0cnVlID09PSBwa3Rfb2JqLnNlcSA6OlxuICAgICAgX2JpbmRfaXRlcmFibGUgQCBwa3Rfb2JqLCBkdi5idWZmZXIuc2xpY2UoMCxzaXplKVxuXG4gIGZ1bmN0aW9uIHVucGFjayhwa3QpIDo6XG4gICAgY29uc3QgYnVmID0gcGt0LmhlYWRlcl9idWZmZXIoKVxuICAgIGNvbnN0IGR2ID0gbmV3IERhdGFWaWV3IEAgbmV3IFVpbnQ4QXJyYXkoYnVmKS5idWZmZXJcblxuICAgIGNvbnN0IGluZm8gPSB7fVxuICAgIGZfdW5wYWNrKGluZm8sIGR2LCAwKVxuICAgIHJldHVybiBwa3QuaW5mbyA9IGluZm9cblxuICBmdW5jdGlvbiBfYmluZF9pdGVyYWJsZShwa3Rfb2JqLCBidWZfY2xvbmUpIDo6XG4gICAgY29uc3Qge3R5cGV9ID0gcGt0X29ialxuICAgIGNvbnN0IHtpZF9yb3V0ZXIsIGlkX3RhcmdldCwgdHRsLCB0b2tlbn0gPSBwa3Rfb2JqXG4gICAgcGt0X29iai5uZXh0ID0gbmV4dFxuXG4gICAgZnVuY3Rpb24gbmV4dChvcHRpb25zKSA6OlxuICAgICAgaWYgbnVsbCA9PSBvcHRpb25zIDo6IG9wdGlvbnMgPSB7fVxuICAgICAgY29uc3QgaGVhZGVyID0gYnVmX2Nsb25lLnNsaWNlKClcbiAgICAgIHNlcV9uZXh0IEAgb3B0aW9ucywgbmV3IERhdGFWaWV3IEAgaGVhZGVyXG4gICAgICByZXR1cm4gQHt9IGRvbmU6ICEhIG9wdGlvbnMuZmluLCB2YWx1ZTogQHt9IC8vIHBrdF9vYmpcbiAgICAgICAgaWRfcm91dGVyLCBpZF90YXJnZXQsIHR5cGUsIHR0bCwgdG9rZW4sIGhlYWRlclxuXG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwYWNrZXRQYXJzZXIsIHNoYXJlZCkgOjpcbiAgY29uc3Qge2NvbmNhdEJ1ZmZlcnN9ID0gcGFja2V0UGFyc2VyXG4gIHJldHVybiBAe30gY3JlYXRlTXVsdGlwYXJ0XG5cblxuICBmdW5jdGlvbiBjcmVhdGVNdWx0aXBhcnQocGt0LCBzaW5rLCBtc2dpZCkgOjpcbiAgICBsZXQgcGFydHMgPSBbXSwgZmluID0gZmFsc2VcbiAgICByZXR1cm4gQHt9IGZlZWQsIGluZm86IHBrdC5pbmZvXG5cbiAgICBmdW5jdGlvbiBmZWVkKHBrdCkgOjpcbiAgICAgIGxldCBzZXEgPSBwa3QuaW5mby5zZXFcbiAgICAgIGlmIHNlcSA8IDAgOjogZmluID0gdHJ1ZTsgc2VxID0gLXNlcVxuICAgICAgcGFydHNbc2VxLTFdID0gcGt0LmJvZHlfYnVmZmVyKClcblxuICAgICAgaWYgISBmaW4gOjogcmV0dXJuXG4gICAgICBpZiBwYXJ0cy5pbmNsdWRlcyBAIHVuZGVmaW5lZCA6OiByZXR1cm5cblxuICAgICAgc2luay5kZWxldGVTdGF0ZUZvcihtc2dpZClcblxuICAgICAgY29uc3QgcmVzID0gY29uY2F0QnVmZmVycyhwYXJ0cylcbiAgICAgIHBhcnRzID0gbnVsbFxuICAgICAgcmV0dXJuIHJlc1xuXG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbihwYWNrZXRQYXJzZXIsIHNoYXJlZCkgOjpcbiAgcmV0dXJuIEB7fSBjcmVhdGVTdHJlYW1cblxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVN0cmVhbShwa3QsIHNpbmssIG1zZ2lkKSA6OlxuICAgIGxldCBuZXh0PTAsIGZpbiA9IGZhbHNlLCByZWN2RGF0YSwgcnN0cmVhbVxuICAgIGNvbnN0IHN0YXRlID0gQHt9IGZlZWQ6IGZlZWRfaW5pdCwgaW5mbzogcGt0LmluZm9cbiAgICByZXR1cm4gc3RhdGVcblxuICAgIGZ1bmN0aW9uIGZlZWRfaW5pdChwa3QsIGFzX2NvbnRlbnQpIDo6XG4gICAgICBzdGF0ZS5mZWVkID0gZmVlZF9pZ25vcmVcblxuICAgICAgY29uc3QgaW5mbyA9IHBrdC5pbmZvXG4gICAgICBjb25zdCBtc2cgPSBzaW5rLmpzb25fdW5wYWNrIEAgcGt0LmJvZHlfdXRmOCgpXG4gICAgICByc3RyZWFtID0gc2luay5yZWN2U3RyZWFtKG1zZywgaW5mbylcbiAgICAgIGlmIG51bGwgPT0gcnN0cmVhbSA6OiByZXR1cm5cbiAgICAgIGNoZWNrX2ZucyBAIHJzdHJlYW0sICdvbl9lcnJvcicsICdvbl9kYXRhJywgJ29uX2VuZCcgXG4gICAgICByZWN2RGF0YSA9IHNpbmsucmVjdlN0cmVhbURhdGEuYmluZChzaW5rLCByc3RyZWFtLCBpbmZvKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgZmVlZF9zZXEocGt0KVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2Vycm9yIEAgZXJyLCBwa3RcblxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfYm9keVxuICAgICAgaWYgcnN0cmVhbS5vbl9pbml0IDo6XG4gICAgICAgIHJldHVybiByc3RyZWFtLm9uX2luaXQobXNnLCBwa3QpXG5cbiAgICBmdW5jdGlvbiBmZWVkX2JvZHkocGt0LCBhc19jb250ZW50KSA6OlxuICAgICAgcmVjdkRhdGEoKVxuICAgICAgbGV0IGRhdGFcbiAgICAgIHRyeSA6OlxuICAgICAgICBmZWVkX3NlcShwa3QpXG4gICAgICAgIGRhdGEgPSBhc19jb250ZW50KHBrdCwgc2luaylcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICByZXR1cm4gcnN0cmVhbS5vbl9lcnJvciBAIGVyciwgcGt0XG5cbiAgICAgIGlmIGZpbiA6OlxuICAgICAgICBjb25zdCByZXMgPSByc3RyZWFtLm9uX2RhdGEgQCBkYXRhLCBwa3RcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZW5kIEAgcmVzLCBwa3RcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgcmV0dXJuIHJzdHJlYW0ub25fZGF0YSBAIGRhdGEsIHBrdFxuXG4gICAgZnVuY3Rpb24gZmVlZF9pZ25vcmUocGt0KSA6OlxuICAgICAgdHJ5IDo6IGZlZWRfc2VxKHBrdClcbiAgICAgIGNhdGNoIGVyciA6OlxuXG4gICAgZnVuY3Rpb24gZmVlZF9zZXEocGt0KSA6OlxuICAgICAgbGV0IHNlcSA9IHBrdC5pbmZvLnNlcVxuICAgICAgaWYgc2VxID49IDAgOjpcbiAgICAgICAgaWYgbmV4dCsrID09PSBzZXEgOjpcbiAgICAgICAgICByZXR1cm4gLy8gaW4gb3JkZXJcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgZmluID0gdHJ1ZVxuICAgICAgICBzaW5rLmRlbGV0ZVN0YXRlRm9yKG1zZ2lkKVxuICAgICAgICBpZiBuZXh0ID09PSAtc2VxIDo6XG4gICAgICAgICAgbmV4dCA9ICdkb25lJ1xuICAgICAgICAgIHJldHVybiAvLyBpbi1vcmRlciwgbGFzdCBwYWNrZXRcblxuICAgICAgc3RhdGUuZmVlZCA9IGZlZWRfaWdub3JlXG4gICAgICBuZXh0ID0gJ2ludmFsaWQnXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgUGFja2V0IG91dCBvZiBzZXF1ZW5jZWBcblxuXG5mdW5jdGlvbiBjaGVja19mbnMob2JqLCAuLi5rZXlzKSA6OlxuICBmb3IgY29uc3Qga2V5IG9mIGtleXMgOjpcbiAgICBpZiAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygb2JqW2tleV0gOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgRXhwZWN0ZWQgXCIke2tleX1cIiB0byBiZSBhIGZ1bmN0aW9uYFxuXG4iLCJpbXBvcnQgZnJhbWluZ3MgZnJvbSAnLi9mcmFtaW5nLmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ocGFja2V0UGFyc2VyLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtwYWNrUGFja2V0T2JqfSA9IHBhY2tldFBhcnNlclxuICBjb25zdCB7cmFuZG9tX2lkLCBqc29uX3BhY2t9ID0gc2hhcmVkXG4gIGNvbnN0IHtjaG9vc2U6IGNob29zZUZyYW1pbmd9ID0gZnJhbWluZ3NcblxuICBjb25zdCBmcmFnbWVudF9zaXplID0gTnVtYmVyIEAgc2hhcmVkLmZyYWdtZW50X3NpemUgfHwgODAwMFxuICBpZiAxMDI0ID4gZnJhZ21lbnRfc2l6ZSB8fCA2NTAwMCA8IGZyYWdtZW50X3NpemUgOjpcbiAgICB0aHJvdyBuZXcgRXJyb3IgQCBgSW52YWxpZCBmcmFnbWVudCBzaXplOiAke2ZyYWdtZW50X3NpemV9YFxuXG4gIHJldHVybiBAe30gYmluZFRyYW5zcG9ydHMsIHBhY2tldEZyYWdtZW50cywgY2hvb3NlRnJhbWluZ1xuXG5cbiAgZnVuY3Rpb24gYmluZFRyYW5zcG9ydHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpIDo6XG4gICAgY29uc3QgcGFja0JvZHkgPSB0cmFuc3BvcnRzLnBhY2tCb2R5XG4gICAgY29uc3Qgb3V0Ym91bmQgPSBiaW5kVHJhbnNwb3J0SW1wbHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpXG5cbiAgICBpZiB0cmFuc3BvcnRzLnN0cmVhbWluZyA6OlxuICAgICAgcmV0dXJuIEB7fSBzZW5kLCBzdHJlYW06IGJpbmRTdHJlYW0oKVxuXG4gICAgcmV0dXJuIEB7fSBzZW5kXG5cblxuXG4gICAgZnVuY3Rpb24gc2VuZChjaGFuLCBvYmosIGJvZHkpIDo6XG4gICAgICBib2R5ID0gcGFja0JvZHkoYm9keSlcbiAgICAgIGlmIGZyYWdtZW50X3NpemUgPCBib2R5LmJ5dGVMZW5ndGggOjpcbiAgICAgICAgaWYgISBvYmoudG9rZW4gOjogb2JqLnRva2VuID0gcmFuZG9tX2lkKClcbiAgICAgICAgb2JqLnRyYW5zcG9ydCA9ICdtdWx0aXBhcnQnXG4gICAgICAgIGNvbnN0IG1zZW5kID0gbXNlbmRfYnl0ZXMoY2hhbiwgb2JqKVxuICAgICAgICByZXR1cm4gbXNlbmQgQCB0cnVlLCBib2R5XG5cbiAgICAgIG9iai50cmFuc3BvcnQgPSAnc2luZ2xlJ1xuICAgICAgb2JqLmJvZHkgPSBib2R5XG4gICAgICBjb25zdCBwYWNrX2hkciA9IG91dGJvdW5kLmNob29zZShvYmopXG4gICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgcGFja19oZHIob2JqKVxuICAgICAgcmV0dXJuIGNoYW4gQCBwa3RcblxuXG4gICAgZnVuY3Rpb24gbXNlbmRfYnl0ZXMoY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICBjb25zdCBwYWNrX2hkciA9IG91dGJvdW5kLmNob29zZShvYmopXG4gICAgICBsZXQge25leHR9ID0gcGFja19oZHIob2JqKVxuICAgICAgaWYgbnVsbCAhPT0gbXNnIDo6XG4gICAgICAgIG9iai5ib2R5ID0gbXNnXG4gICAgICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICAgICAgY2hhbiBAIHBrdFxuXG4gICAgICByZXR1cm4gYXN5bmMgZnVuY3Rpb24gKGZpbiwgYm9keSkgOjpcbiAgICAgICAgaWYgbnVsbCA9PT0gbmV4dCA6OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBAICdXcml0ZSBhZnRlciBlbmQnXG4gICAgICAgIGxldCByZXNcbiAgICAgICAgZm9yIGNvbnN0IG9iaiBvZiBwYWNrZXRGcmFnbWVudHMgQCBib2R5LCBuZXh0LCBmaW4gOjpcbiAgICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgICAgcmVzID0gYXdhaXQgY2hhbiBAIHBrdFxuICAgICAgICBpZiBmaW4gOjogbmV4dCA9IG51bGxcbiAgICAgICAgcmV0dXJuIHJlc1xuXG5cbiAgICBmdW5jdGlvbiBtc2VuZF9vYmplY3RzKGNoYW4sIG9iaiwgbXNnKSA6OlxuICAgICAgY29uc3QgcGFja19oZHIgPSBvdXRib3VuZC5jaG9vc2Uob2JqKVxuICAgICAgbGV0IHtuZXh0fSA9IHBhY2tfaGRyKG9iailcbiAgICAgIGlmIG51bGwgIT09IG1zZyA6OlxuICAgICAgICBvYmouYm9keSA9IG1zZ1xuICAgICAgICBjb25zdCBwa3QgPSBwYWNrUGFja2V0T2JqIEAgb2JqXG4gICAgICAgIGNoYW4gQCBwa3RcblxuICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmaW4sIGJvZHkpIDo6XG4gICAgICAgIGlmIG51bGwgPT09IG5leHQgOjpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgQCAnV3JpdGUgYWZ0ZXIgZW5kJ1xuICAgICAgICBjb25zdCBvYmogPSBuZXh0KHtmaW59KVxuICAgICAgICBvYmouYm9keSA9IGJvZHlcbiAgICAgICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgICAgICBpZiBmaW4gOjogbmV4dCA9IG51bGxcbiAgICAgICAgcmV0dXJuIGNoYW4gQCBwa3RcblxuXG4gICAgZnVuY3Rpb24gYmluZFN0cmVhbSgpIDo6XG4gICAgICBjb25zdCB7bW9kZX0gPSB0cmFuc3BvcnRzLnN0cmVhbWluZ1xuICAgICAgY29uc3QgbXNlbmRfaW1wbCA9IHtvYmplY3Q6IG1zZW5kX29iamVjdHMsIGJ5dGVzOiBtc2VuZF9ieXRlc31bbW9kZV1cbiAgICAgIGlmIG1zZW5kX2ltcGwgOjogcmV0dXJuIHN0cmVhbVxuXG4gICAgICBmdW5jdGlvbiBzdHJlYW0oY2hhbiwgb2JqLCBtc2cpIDo6XG4gICAgICAgIGlmICEgb2JqLnRva2VuIDo6IG9iai50b2tlbiA9IHJhbmRvbV9pZCgpXG4gICAgICAgIG9iai50cmFuc3BvcnQgPSAnc3RyZWFtaW5nJ1xuICAgICAgICBjb25zdCBtc2VuZCA9IG1zZW5kX2ltcGwgQCBjaGFuLCBvYmosIGpzb25fcGFjayhtc2cpXG4gICAgICAgIHdyaXRlLndyaXRlID0gd3JpdGU7IHdyaXRlLmVuZCA9IHdyaXRlLmJpbmQodHJ1ZSlcbiAgICAgICAgcmV0dXJuIHdyaXRlXG5cbiAgICAgICAgZnVuY3Rpb24gd3JpdGUoY2h1bmspIDo6XG4gICAgICAgICAgcmV0dXJuIGNodW5rICE9IG51bGxcbiAgICAgICAgICAgID8gbXNlbmQgQCB0cnVlPT09dGhpcywgcGFja0JvZHkoY2h1bmspXG4gICAgICAgICAgICA6IG1zZW5kIEAgdHJ1ZVxuXG5cbiAgZnVuY3Rpb24gKiBwYWNrZXRGcmFnbWVudHMoYnVmLCBuZXh0X2hkciwgZmluKSA6OlxuICAgIGlmIG51bGwgPT0gYnVmIDo6XG4gICAgICBjb25zdCBvYmogPSBuZXh0X2hkcih7ZmlufSlcbiAgICAgIHlpZWxkIG9ialxuICAgICAgcmV0dXJuXG5cbiAgICBsZXQgaSA9IDAsIGxhc3RJbm5lciA9IGJ1Zi5ieXRlTGVuZ3RoIC0gZnJhZ21lbnRfc2l6ZTtcbiAgICB3aGlsZSBpIDwgbGFzdElubmVyIDo6XG4gICAgICBjb25zdCBpMCA9IGlcbiAgICAgIGkgKz0gZnJhZ21lbnRfc2l6ZVxuXG4gICAgICBjb25zdCBvYmogPSBuZXh0X2hkcigpXG4gICAgICBvYmouYm9keSA9IGJ1Zi5zbGljZShpMCwgaSlcbiAgICAgIHlpZWxkIG9ialxuXG4gICAgOjpcbiAgICAgIGNvbnN0IG9iaiA9IG5leHRfaGRyKHtmaW59KVxuICAgICAgb2JqLmJvZHkgPSBidWYuc2xpY2UoaSlcbiAgICAgIHlpZWxkIG9ialxuXG5cblxuXG4vLyBtb2R1bGUtbGV2ZWwgaGVscGVyIGZ1bmN0aW9uc1xuXG5mdW5jdGlvbiBiaW5kVHJhbnNwb3J0SW1wbHMoaW5ib3VuZCwgaGlnaGJpdHMsIHRyYW5zcG9ydHMpIDo6XG4gIGNvbnN0IG91dGJvdW5kID0gW11cbiAgb3V0Ym91bmQuY2hvb3NlID0gZnJhbWluZ3MuY2hvb3NlXG5cbiAgZm9yIGNvbnN0IGZyYW1lIG9mIGZyYW1pbmdzIDo6XG4gICAgY29uc3QgaW1wbCA9IGZyYW1lID8gdHJhbnNwb3J0c1tmcmFtZS50cmFuc3BvcnRdIDogbnVsbFxuICAgIGlmICEgaW1wbCA6OiBjb250aW51ZVxuXG4gICAgY29uc3Qge2JpdHMsIHBhY2ssIHVucGFja30gPSBmcmFtZVxuICAgIGNvbnN0IHBrdF90eXBlID0gaGlnaGJpdHMgfCBiaXRzXG4gICAgY29uc3Qge3RfcmVjdn0gPSBpbXBsXG5cbiAgICBmdW5jdGlvbiBwYWNrX2hkcihvYmopIDo6XG4gICAgICBwYWNrKHBrdF90eXBlLCBvYmopXG4gICAgICByZXR1cm4gb2JqXG5cbiAgICBmdW5jdGlvbiByZWN2X21zZyhwa3QsIHNpbmspIDo6XG4gICAgICB1bnBhY2socGt0KVxuICAgICAgcmV0dXJuIHRfcmVjdihwa3QsIHNpbmspXG5cbiAgICBwYWNrX2hkci5wa3RfdHlwZSA9IHJlY3ZfbXNnLnBrdF90eXBlID0gcGt0X3R5cGVcbiAgICBvdXRib3VuZFtiaXRzXSA9IHBhY2tfaGRyXG4gICAgaW5ib3VuZFtwa3RfdHlwZV0gPSByZWN2X21zZ1xuXG4gICAgaWYgJ3Byb2R1Y3Rpb24nICE9PSBwcm9jZXNzLmVudi5OT0RFX0VOViA6OlxuICAgICAgY29uc3Qgb3AgPSBwYWNrX2hkci5vcCA9IHJlY3ZfbXNnLm9wID0gZnJhbWUub3BcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBAIHBhY2tfaGRyLCAnbmFtZScsIEB7fSB2YWx1ZTogYHBhY2tfaGRyIMKrJHtvcH3Cu2BcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBAIHJlY3ZfbXNnLCAnbmFtZScsIEB7fSB2YWx1ZTogYHJlY3ZfbXNnIMKrJHtvcH3Cu2BcblxuICByZXR1cm4gb3V0Ym91bmRcblxuIiwiZXhwb3J0ICogZnJvbSAnLi9mcmFtaW5nLmpzeSdcbmV4cG9ydCAqIGZyb20gJy4vbXVsdGlwYXJ0LmpzeSdcbmV4cG9ydCAqIGZyb20gJy4vc3RyZWFtaW5nLmpzeSdcbmV4cG9ydCAqIGZyb20gJy4vdHJhbnNwb3J0LmpzeSdcblxuaW1wb3J0IG11bHRpcGFydCBmcm9tICcuL211bHRpcGFydC5qc3knXG5pbXBvcnQgc3RyZWFtaW5nIGZyb20gJy4vc3RyZWFtaW5nLmpzeSdcbmltcG9ydCB0cmFuc3BvcnQgZnJvbSAnLi90cmFuc3BvcnQuanN5J1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpbml0X3NoYXJlZChwYWNrZXRQYXJzZXIsIG9wdGlvbnMpIDo6XG4gIGNvbnN0IHNoYXJlZCA9IE9iamVjdC5hc3NpZ24gQCB7cGFja2V0UGFyc2VyfSwgb3B0aW9uc1xuXG4gIE9iamVjdC5hc3NpZ24gQCBzaGFyZWQsXG4gICAgbXVsdGlwYXJ0IEAgcGFja2V0UGFyc2VyLCBzaGFyZWRcbiAgICBzdHJlYW1pbmcgQCBwYWNrZXRQYXJzZXIsIHNoYXJlZFxuICAgIHRyYW5zcG9ydCBAIHBhY2tldFBhcnNlciwgc2hhcmVkXG5cbiAgcmV0dXJuIHNoYXJlZFxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ganNvbl9wcm90b2NvbChzaGFyZWQpIDo6XG4gIGNvbnN0IHtjcmVhdGVNdWx0aXBhcnQsIGNyZWF0ZVN0cmVhbSwganNvbl9wYWNrfSA9IHNoYXJlZFxuICBjb25zdCB7cGFja191dGY4LCB1bnBhY2tfdXRmOH0gPSBzaGFyZWQucGFja2V0UGFyc2VyXG5cbiAgcmV0dXJuIEB7fVxuICAgIHBhY2tCb2R5XG5cbiAgICBnZXQgZGF0YWdyYW0oKSA6OiByZXR1cm4gdGhpcy5kaXJlY3RcbiAgICBkaXJlY3Q6IEB7fVxuICAgICAgdF9yZWN2KHBrdCwgc2luaykgOjpcbiAgICAgICAgY29uc3QgbXNnID0gc2luay5qc29uX3VucGFjayBAIHBrdC5ib2R5X3V0ZjgoKSB8fCB1bmRlZmluZWRcbiAgICAgICAgcmV0dXJuIHNpbmsucmVjdk1zZyBAIG1zZywgcGt0LmluZm9cblxuICAgIG11bHRpcGFydDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHNpbmsuc3RhdGVGb3IgQCBwa3QsIGNyZWF0ZU11bHRpcGFydFxuICAgICAgICBjb25zdCBib2R5X2J1ZiA9IHN0YXRlLmZlZWQocGt0KVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IGJvZHlfYnVmIDo6XG4gICAgICAgICAgY29uc3QgbXNnID0gc2luay5qc29uX3VucGFjayBAIHVucGFja191dGY4KGJvZHlfYnVmKSB8fCB1bmRlZmluZWRcbiAgICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBzdGF0ZS5pbmZvXG5cbiAgICBzdHJlYW1pbmc6IEB7fVxuICAgICAgbW9kZTogJ29iamVjdCdcbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc2luay5zdGF0ZUZvciBAIHBrdCwgY3JlYXRlU3RyZWFtXG4gICAgICAgIHJldHVybiBzdGF0ZS5mZWVkKHBrdCwgdW5wYWNrQm9keSlcblxuICBmdW5jdGlvbiBwYWNrQm9keShib2R5KSA6OlxuICAgIHJldHVybiBwYWNrX3V0ZjggQCBqc29uX3BhY2soYm9keSlcblxuICBmdW5jdGlvbiB1bnBhY2tCb2R5KHBrdCwgc2luaykgOjpcbiAgICByZXR1cm4gc2luay5qc29uX3VucGFjayBAIHBrdC5ib2R5X3V0ZjgoKVxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYmluYXJ5X3Byb3RvY29sKHNoYXJlZCkgOjpcbiAgY29uc3Qge2NyZWF0ZU11bHRpcGFydCwgY3JlYXRlU3RyZWFtfSA9IHNoYXJlZFxuICBjb25zdCB7cGFja191dGY4LCB1bnBhY2tfdXRmOH0gPSBzaGFyZWQucGFja2V0UGFyc2VyXG4gIGNvbnN0IHthc0J1ZmZlcn0gPSBzaGFyZWQucGFja2V0UGFyc2VyXG4gIHJldHVybiBAe31cbiAgICBwYWNrQm9keTogYXNCdWZmZXJcblxuICAgIGdldCBkYXRhZ3JhbSgpIDo6IHJldHVybiB0aGlzLmRpcmVjdFxuICAgIGRpcmVjdDogQHt9XG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBtc2cgPSBwa3QuYm9keV9idWZmZXIoKVxuICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBwa3QuaW5mb1xuXG4gICAgbXVsdGlwYXJ0OiBAe31cbiAgICAgIHRfcmVjdihwa3QsIHNpbmspIDo6XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc2luay5zdGF0ZUZvciBAIHBrdCwgY3JlYXRlTXVsdGlwYXJ0XG4gICAgICAgIGNvbnN0IG1zZyA9IHN0YXRlLmZlZWQocGt0KVxuICAgICAgICBpZiB1bmRlZmluZWQgIT09IG1zZyA6OlxuICAgICAgICAgIHJldHVybiBzaW5rLnJlY3ZNc2cgQCBtc2csIHN0YXRlLmluZm9cblxuICAgIHN0cmVhbWluZzogQHt9XG4gICAgICBtb2RlOiAnYnl0ZXMnXG4gICAgICB0X3JlY3YocGt0LCBzaW5rKSA6OlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHNpbmsuc3RhdGVGb3IgQCBwa3QsIGNyZWF0ZVN0cmVhbVxuICAgICAgICBjb25zdCBtc2cgPSBzdGF0ZS5mZWVkKHBrdCwgcGt0X2J1ZmZlcilcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBtc2cgOjpcbiAgICAgICAgICByZXR1cm4gc2luay5yZWN2TXNnIEAgbXNnLCBzdGF0ZS5pbmZvXG5cbmZ1bmN0aW9uIHBrdF9idWZmZXIocGt0KSA6OiByZXR1cm4gcGt0LmJvZHlfYnVmZmVyKClcblxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gY29udHJvbF9wcm90b2NvbChpbmJvdW5kLCBoaWdoLCBzaGFyZWQpIDo6XG4gIGNvbnN0IHtjaG9vc2VGcmFtaW5nLCByYW5kb21faWR9ID0gc2hhcmVkXG4gIGNvbnN0IHtwYWNrUGFja2V0T2JqfSA9IHNoYXJlZC5wYWNrZXRQYXJzZXJcblxuICBjb25zdCBwaW5nX2ZyYW1lID0gY2hvb3NlRnJhbWluZyBAOiBmcm9tX2lkOiB0cnVlLCB0b2tlbjogdHJ1ZSwgdHJhbnNwb3J0OiAnZGlyZWN0J1xuICBjb25zdCBwb25nX2ZyYW1lID0gY2hvb3NlRnJhbWluZyBAOiBmcm9tX2lkOiB0cnVlLCBtc2dpZDogdHJ1ZSwgdHJhbnNwb3J0OiAnZGF0YWdyYW0nXG5cbiAgY29uc3QgcG9uZ190eXBlID0gaGlnaHwweGVcbiAgaW5ib3VuZFtwb25nX3R5cGVdID0gcmVjdl9wb25nXG4gIGNvbnN0IHBpbmdfdHlwZSA9IGhpZ2h8MHhmXG4gIGluYm91bmRbaGlnaHwweGZdID0gcmVjdl9waW5nXG5cbiAgcmV0dXJuIEB7fSBzZW5kOnBpbmcsIHBpbmdcblxuICBmdW5jdGlvbiBwaW5nKGNoYW4sIG9iaikgOjpcbiAgICBpZiAhIG9iai50b2tlbiA6OlxuICAgICAgb2JqLnRva2VuID0gcmFuZG9tX2lkKClcbiAgICBvYmouYm9keSA9IEpTT04uc3RyaW5naWZ5IEA6XG4gICAgICBvcDogJ3BpbmcnLCB0czA6IG5ldyBEYXRlKClcbiAgICBwaW5nX2ZyYW1lLnBhY2socGluZ190eXBlLCBvYmopXG4gICAgY29uc3QgcGt0ID0gcGFja1BhY2tldE9iaiBAIG9ialxuICAgIHJldHVybiBjaGFuIEAgcGt0XG5cbiAgZnVuY3Rpb24gcmVjdl9waW5nKHBrdCwgc2luaywgcm91dGVyKSA6OlxuICAgIHBpbmdfZnJhbWUudW5wYWNrKHBrdClcbiAgICBwa3QuYm9keSA9IHBrdC5ib2R5X2pzb24oKVxuICAgIF9zZW5kX3BvbmcgQCBwa3QuYm9keSwgcGt0LCByb3V0ZXJcbiAgICByZXR1cm4gc2luay5yZWN2Q3RybChwa3QuYm9keSwgcGt0LmluZm8pXG5cbiAgZnVuY3Rpb24gX3NlbmRfcG9uZyh7dHMwfSwgcGt0X3BpbmcsIHJvdXRlcikgOjpcbiAgICBjb25zdCB7bXNnaWQsIGlkX3RhcmdldCwgaWRfcm91dGVyLCBmcm9tX2lkOnJfaWR9ID0gcGt0X3BpbmcuaW5mb1xuICAgIGNvbnN0IG9iaiA9IEB7fSBtc2dpZFxuICAgICAgZnJvbV9pZDogQHt9IGlkX3RhcmdldCwgaWRfcm91dGVyXG4gICAgICBpZF9yb3V0ZXI6IHJfaWQuaWRfcm91dGVyLCBpZF90YXJnZXQ6IHJfaWQuaWRfdGFyZ2V0XG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSBAOlxuICAgICAgICBvcDogJ3BvbmcnLCB0czAsIHRzMTogbmV3IERhdGUoKVxuXG4gICAgcG9uZ19mcmFtZS5wYWNrKHBvbmdfdHlwZSwgb2JqKVxuICAgIGNvbnN0IHBrdCA9IHBhY2tQYWNrZXRPYmogQCBvYmpcbiAgICByZXR1cm4gcm91dGVyLmRpc3BhdGNoIEAgW3BrdF1cblxuICBmdW5jdGlvbiByZWN2X3BvbmcocGt0LCBzaW5rKSA6OlxuICAgIHBvbmdfZnJhbWUudW5wYWNrKHBrdClcbiAgICBwa3QuYm9keSA9IHBrdC5ib2R5X2pzb24oKVxuICAgIHJldHVybiBzaW5rLnJlY3ZDdHJsKHBrdC5ib2R5LCBwa3QuaW5mbylcblxuIiwiaW1wb3J0IGluaXRfc2hhcmVkIGZyb20gJy4vc2hhcmVkL2luZGV4LmpzeSdcbmltcG9ydCBqc29uX3Byb3RvIGZyb20gJy4vcHJvdG9jb2xzL2pzb24uanN5J1xuaW1wb3J0IGJpbmFyeV9wcm90byBmcm9tICcuL3Byb3RvY29scy9iaW5hcnkuanN5J1xuaW1wb3J0IGNvbnRyb2xfcHJvdG8gZnJvbSAnLi9wcm90b2NvbHMvY29udHJvbC5qc3knXG5cblxuY29uc3QgZGVmYXVsdF9wbHVnaW5fb3B0aW9ucyA9IEA6XG4gIGpzb25fcGFjazogSlNPTi5zdHJpbmdpZnlcbiAgY3VzdG9tKHByb3RvY29scykgOjogcmV0dXJuIHByb3RvY29sc1xuXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKHBsdWdpbl9vcHRpb25zKSA6OlxuICBwbHVnaW5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24gQCB7fSwgZGVmYXVsdF9wbHVnaW5fb3B0aW9ucywgcGx1Z2luX29wdGlvbnNcbiAgY29uc3QgeyBwbHVnaW5fbmFtZSwgcmFuZG9tX2lkLCBqc29uX3BhY2sgfSA9IHBsdWdpbl9vcHRpb25zXG5cbiAgcmV0dXJuIEA6IHN1YmNsYXNzLCBvcmRlcjogLTEgLy8gZGVwZW5kZW50IG9uIHJvdXRlciBwbHVnaW4ncyAoLTIpIHByb3ZpZGluZyBwYWNrZXRQYXJzZXJcbiAgXG4gIGZ1bmN0aW9uIHN1YmNsYXNzKEZhYnJpY0h1Yl9QSSwgYmFzZXMpIDo6XG4gICAgY29uc3Qge3BhY2tldFBhcnNlcn0gPSBGYWJyaWNIdWJfUEkucHJvdG90eXBlXG4gICAgaWYgbnVsbD09cGFja2V0UGFyc2VyIHx8ICEgcGFja2V0UGFyc2VyLmlzUGFja2V0UGFyc2VyKCkgOjpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgSW52YWxpZCBwYWNrZXRQYXJzZXIgZm9yIHBsdWdpbmBcbiAgICBcbiAgICBjb25zdCBwcm90b2NvbHMgPSBwbHVnaW5fb3B0aW9ucy5jdXN0b20gQFxuICAgICAgaW5pdF9wcm90b2NvbHMgQCBwYWNrZXRQYXJzZXIsIEB7fSByYW5kb21faWQsIGpzb25fcGFja1xuXG4gICAgRmFicmljSHViX1BJLnByb3RvdHlwZS5wcm90b2NvbHMgPSBwcm90b2NvbHNcblxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdF9wcm90b2NvbHMocGFja2V0UGFyc2VyLCBvcHRpb25zKSA6OlxuICBjb25zdCBzaGFyZWQgPSBpbml0X3NoYXJlZCBAIHBhY2tldFBhcnNlciwgb3B0aW9uc1xuXG4gIGNvbnN0IGluYm91bmQgPSBbXVxuICBjb25zdCBqc29uID0gc2hhcmVkLmJpbmRUcmFuc3BvcnRzIEAgaW5ib3VuZFxuICAgIDB4MDAgLy8gMHgwKiDigJQgSlNPTiBib2R5XG4gICAganNvbl9wcm90byhzaGFyZWQpXG5cbiAgY29uc3QgYmluYXJ5ID0gc2hhcmVkLmJpbmRUcmFuc3BvcnRzIEAgaW5ib3VuZFxuICAgIDB4MTAgLy8gMHgxKiDigJQgYmluYXJ5IGJvZHlcbiAgICBiaW5hcnlfcHJvdG8oc2hhcmVkKVxuXG4gIGNvbnN0IGNvbnRyb2wgPSBjb250cm9sX3Byb3RvIEAgaW5ib3VuZCxcbiAgICAweGYwIC8vIDB4Ziog4oCUIGNvbnRyb2xcbiAgICBzaGFyZWRcblxuICBjb25zdCBjb2RlY3MgPSBAOiBqc29uLCBiaW5hcnksIGNvbnRyb2wsIGRlZmF1bHQ6IGpzb25cblxuICByZXR1cm4gQHt9IGluYm91bmQsIGNvZGVjcywgc2hhcmVkLCByYW5kb21faWQ6IHNoYXJlZC5yYW5kb21faWRcblxuIiwiaW1wb3J0IHtyYW5kb21CeXRlc30gZnJvbSAnY3J5cHRvJ1xuaW1wb3J0IHBsdWdpbiBmcm9tICcuL3BsdWdpbi5qc3knXG5cbnByb3RvY29sc19ub2RlanMucmFuZG9tX2lkID0gcmFuZG9tX2lkXG5mdW5jdGlvbiByYW5kb21faWQoKSA6OlxuICByZXR1cm4gcmFuZG9tQnl0ZXMoNCkucmVhZEludDMyTEUoKVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcm90b2NvbHNfbm9kZWpzKHBsdWdpbl9vcHRpb25zPXt9KSA6OlxuICBpZiBudWxsID09IHBsdWdpbl9vcHRpb25zLnJhbmRvbV9pZCA6OlxuICAgIHBsdWdpbl9vcHRpb25zLnJhbmRvbV9pZCA9IHJhbmRvbV9pZFxuXG4gIHJldHVybiBwbHVnaW4ocGx1Z2luX29wdGlvbnMpXG5cbiJdLCJuYW1lcyI6WyJsaXR0bGVfZW5kaWFuIiwiY19zaW5nbGUiLCJjX2RhdGFncmFtIiwiY19kaXJlY3QiLCJjX211bHRpcGFydCIsImNfc3RyZWFtaW5nIiwiX2Vycl9tc2dpZF9yZXF1aXJlZCIsIl9lcnJfdG9rZW5fcmVxdWlyZWQiLCJmcm1fcm91dGluZyIsInNpemUiLCJiaXRzIiwibWFzayIsIm9iaiIsImZyb21faWQiLCJkdiIsIm9mZnNldCIsInNldEludDMyIiwiaWRfcm91dGVyIiwiaWRfdGFyZ2V0IiwidW5kZWZpbmVkIiwiZ2V0SW50MzIiLCJmcm1fcmVzcG9uc2UiLCJtc2dpZCIsIkVycm9yIiwic2V0SW50MTYiLCJzZXFfYWNrIiwiYWNrX2ZsYWdzIiwidG9rZW4iLCJnZXRJbnQxNiIsImZybV9kYXRhZ3JhbSIsInRyYW5zcG9ydCIsImZybV9kaXJlY3QiLCJmcm1fbXVsdGlwYXJ0Iiwic2VxX3BvcyIsInNlcSIsInNlcV9mbGFncyIsImZybV9zdHJlYW1pbmciLCJiaW5kX3NlcV9uZXh0Iiwic2VxX29mZnNldCIsInNlcV9uZXh0IiwiZmxhZ3MiLCJmaW4iLCJOYU4iLCJjb21wb3NlRnJhbWluZ3MiLCJmcm1fZnJvbSIsImZybV9yZXNwIiwiZnJtX3RyYW5zcG9ydHMiLCJsZW5ndGgiLCJieUJpdHMiLCJ0X2Zyb20iLCJmX3Rlc3QiLCJ0X3Jlc3AiLCJ0MCIsInQxIiwidDIiLCJ0MyIsIm1hcCIsImYiLCJ0ZXN0Qml0cyIsImNob29zZSIsImxzdCIsIlQiLCJiIiwib3AiLCJmbl9rZXkiLCJmbl90cmFuIiwiZm5fZnJvbSIsImZuX3Jlc3AiLCJmcm0iLCJiaW5kQXNzZW1ibGVkIiwiZl9wYWNrIiwiZl91bnBhY2siLCJwYWNrIiwidW5wYWNrIiwicGt0X3R5cGUiLCJwa3Rfb2JqIiwiVHlwZUVycm9yIiwidHlwZSIsIkRhdGFWaWV3IiwiQXJyYXlCdWZmZXIiLCJoZWFkZXIiLCJidWZmZXIiLCJzbGljZSIsInBrdCIsImJ1ZiIsImhlYWRlcl9idWZmZXIiLCJVaW50OEFycmF5IiwiaW5mbyIsIl9iaW5kX2l0ZXJhYmxlIiwiYnVmX2Nsb25lIiwidHRsIiwibmV4dCIsIm9wdGlvbnMiLCJkb25lIiwidmFsdWUiLCJwYWNrZXRQYXJzZXIiLCJzaGFyZWQiLCJjb25jYXRCdWZmZXJzIiwiY3JlYXRlTXVsdGlwYXJ0Iiwic2luayIsInBhcnRzIiwiZmVlZCIsImJvZHlfYnVmZmVyIiwiaW5jbHVkZXMiLCJkZWxldGVTdGF0ZUZvciIsInJlcyIsImNyZWF0ZVN0cmVhbSIsInJlY3ZEYXRhIiwicnN0cmVhbSIsInN0YXRlIiwiZmVlZF9pbml0IiwiYXNfY29udGVudCIsImZlZWRfaWdub3JlIiwibXNnIiwianNvbl91bnBhY2siLCJib2R5X3V0ZjgiLCJyZWN2U3RyZWFtIiwicmVjdlN0cmVhbURhdGEiLCJiaW5kIiwiZXJyIiwib25fZXJyb3IiLCJmZWVkX2JvZHkiLCJvbl9pbml0IiwiZGF0YSIsIm9uX2RhdGEiLCJvbl9lbmQiLCJmZWVkX3NlcSIsImNoZWNrX2ZucyIsImtleXMiLCJrZXkiLCJwYWNrUGFja2V0T2JqIiwicmFuZG9tX2lkIiwianNvbl9wYWNrIiwiY2hvb3NlRnJhbWluZyIsImZyYW1pbmdzIiwiZnJhZ21lbnRfc2l6ZSIsIk51bWJlciIsImJpbmRUcmFuc3BvcnRzIiwicGFja2V0RnJhZ21lbnRzIiwiaW5ib3VuZCIsImhpZ2hiaXRzIiwidHJhbnNwb3J0cyIsInBhY2tCb2R5Iiwib3V0Ym91bmQiLCJiaW5kVHJhbnNwb3J0SW1wbHMiLCJzdHJlYW1pbmciLCJzZW5kIiwic3RyZWFtIiwiYmluZFN0cmVhbSIsImNoYW4iLCJib2R5IiwiYnl0ZUxlbmd0aCIsIm1zZW5kIiwibXNlbmRfYnl0ZXMiLCJwYWNrX2hkciIsIm1zZW5kX29iamVjdHMiLCJtb2RlIiwibXNlbmRfaW1wbCIsIm9iamVjdCIsImJ5dGVzIiwid3JpdGUiLCJlbmQiLCJjaHVuayIsIm5leHRfaGRyIiwiaSIsImxhc3RJbm5lciIsImkwIiwiZnJhbWUiLCJpbXBsIiwidF9yZWN2IiwicmVjdl9tc2ciLCJpbml0X3NoYXJlZCIsIk9iamVjdCIsImFzc2lnbiIsIm11bHRpcGFydCIsImpzb25fcHJvdG9jb2wiLCJwYWNrX3V0ZjgiLCJ1bnBhY2tfdXRmOCIsImRhdGFncmFtIiwiZGlyZWN0IiwicmVjdk1zZyIsInN0YXRlRm9yIiwiYm9keV9idWYiLCJ1bnBhY2tCb2R5IiwiYmluYXJ5X3Byb3RvY29sIiwiYXNCdWZmZXIiLCJwa3RfYnVmZmVyIiwiY29udHJvbF9wcm90b2NvbCIsImhpZ2giLCJwaW5nX2ZyYW1lIiwicG9uZ19mcmFtZSIsInBvbmdfdHlwZSIsInJlY3ZfcG9uZyIsInBpbmdfdHlwZSIsInJlY3ZfcGluZyIsInBpbmciLCJKU09OIiwic3RyaW5naWZ5IiwidHMwIiwiRGF0ZSIsInJvdXRlciIsImJvZHlfanNvbiIsInJlY3ZDdHJsIiwiX3NlbmRfcG9uZyIsInBrdF9waW5nIiwicl9pZCIsInRzMSIsImRpc3BhdGNoIiwiZGVmYXVsdF9wbHVnaW5fb3B0aW9ucyIsInByb3RvY29scyIsInBsdWdpbl9vcHRpb25zIiwicGx1Z2luX25hbWUiLCJzdWJjbGFzcyIsIm9yZGVyIiwiRmFicmljSHViX1BJIiwiYmFzZXMiLCJwcm90b3R5cGUiLCJpc1BhY2tldFBhcnNlciIsImN1c3RvbSIsImluaXRfcHJvdG9jb2xzIiwianNvbiIsImpzb25fcHJvdG8iLCJiaW5hcnkiLCJiaW5hcnlfcHJvdG8iLCJjb250cm9sIiwiY29udHJvbF9wcm90byIsImNvZGVjcyIsImRlZmF1bHQiLCJwcm90b2NvbHNfbm9kZWpzIiwicmFuZG9tQnl0ZXMiLCJyZWFkSW50MzJMRSIsInBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxNQUFNQSxnQkFBZ0IsSUFBdEI7QUFDQSxNQUFNQyxXQUFXLFFBQWpCO0FBQ0EsTUFBTUMsYUFBYSxVQUFuQjtBQUNBLE1BQU1DLFdBQVcsUUFBakI7QUFDQSxNQUFNQyxjQUFjLFdBQXBCO0FBQ0EsTUFBTUMsY0FBYyxXQUFwQjs7QUFFQSxNQUFNQyxzQkFBdUIsMEJBQTdCO0FBQ0EsTUFBTUMsc0JBQXVCLDJCQUE3Qjs7QUFHQSxTQUFTQyxXQUFULEdBQXVCO1FBQ2ZDLE9BQU8sQ0FBYjtRQUFnQkMsT0FBTyxHQUF2QjtRQUE0QkMsT0FBTyxHQUFuQztTQUNPO1FBQUEsRUFDQ0QsSUFERCxFQUNPQyxJQURQOztXQUdFQyxHQUFQLEVBQVk7YUFBVSxRQUFRQSxJQUFJQyxPQUFaLEdBQXNCSCxJQUF0QixHQUE2QixLQUFwQztLQUhWOztXQUtFRSxHQUFQLEVBQVlFLEVBQVosRUFBZ0JDLE1BQWhCLEVBQXdCO1lBQ2hCLEVBQUNGLE9BQUQsS0FBWUQsR0FBbEI7U0FDR0ksUUFBSCxDQUFjLElBQUVELE1BQWhCLEVBQXdCLElBQUVGLFFBQVFJLFNBQWxDLEVBQTZDakIsYUFBN0M7U0FDR2dCLFFBQUgsQ0FBYyxJQUFFRCxNQUFoQixFQUF3QixJQUFFRixRQUFRSyxTQUFsQyxFQUE2Q2xCLGFBQTdDO0tBUkc7O2FBVUlZLEdBQVQsRUFBY0UsRUFBZCxFQUFrQkMsTUFBbEIsRUFBMEI7WUFDbEJGLFVBQVVNLGNBQWNQLElBQUlDLE9BQWxCLEdBQ1pELElBQUlDLE9BQUosR0FBYyxFQURGLEdBQ09ELElBQUlDLE9BRDNCO2NBRVFJLFNBQVIsR0FBb0JILEdBQUdNLFFBQUgsQ0FBYyxJQUFFTCxN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
