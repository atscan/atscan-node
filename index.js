import {
  connect,
  JSONCodec,
  StringCodec,
} from "https://deno.land/x/nats/src/mod.ts";
import "https://deno.land/std@0.192.0/dotenv/load.ts";
import * as async from "npm:async";

const sc = StringCodec();
const jc = JSONCodec();
const TIMEOUT = 2500;

const httpRequestQueue = async.queue(async (task, callback) => {
  const { opts, m } = task;
  const req = await httpRequest(opts);
  m.respond(jc.encode(req));
}, 15);

export function timeout(ms, promise) {
  return new Promise(function (resolve, reject) {
    const start = performance.now();
    setTimeout(function () {
      reject(new Error("timeout"));
    }, ms);
    promise.then((v) => {
      const end = performance.now();
      return resolve([v, end - start]);
    }, reject);
  });
}

async function httpRequest({ url }) {
  if (!url) {
    return;
  }
  console.log(`[http] Getting request: ${url}`);
  try {
    const [, ms] = await timeout(
      2000,
      fetch(url, {
        method: "OPTIONS",
        headers: {
          "User-Agent": "ATScan Crawler",
          "connection": "keep-alive",
          keepalive: "timeout=5, max=1000",
        },
      }),
    );
  } catch (e) {
    return { err: "timeout" };
  }

  let res, data, ms, err;
  try {
    [res, ms] = await timeout(
      TIMEOUT,
      fetch(url, {
        headers: {
          "User-Agent": "ATScan Crawler",
        },
        keepalive: "timeout=5, max=1000",
      }),
    );
    if (res) {
      data = await res.json();
    }
  } catch (e) {
    err = e.message;
  }

  return {
    err,
    data,
    ms,
    time: new Date(),
  };
}

async function handleRequest(nc, sub, m) {
  const chunks = m.subject.split(".");
  console.info(`[admin] #${sub.getProcessed()} handling ${chunks[2]}`);
  switch (chunks[2]) {
    case "uptime":
      // send the number of millis since up
      m.respond(sc.encode(`${Date.now() - started}`));
      break;
    case "http": {
      const opts = jc.decode(m.data);
      httpRequestQueue.push({ opts, m });
      //const req = await httpRequest(opts)
      //m.respond(jc.encode(req))
      break;
    }
    default:
      console.log(
        `[admin] #${sub.getProcessed()} ignoring request for ${m.subject}`,
      );
  }
}

async function daemon() {
  const nc = await connect({
    servers: Deno.env.get("NATS_SERVERS"),
  });
  console.log(`connected to ${nc.getServer()}`);
  const started = Date.now();

  const sub = nc.subscribe(`ats-nodes.${Deno.env.get("NODE_NAME")}.*`);
  (async (sub) => {
    console.log(`listening for ${sub.getSubject()} requests...`);
    for await (const m of sub) {
      handleRequest(nc, sub, m);
    }
    console.log(`subscription ${sub.getSubject()} drained.`);
  })(sub);
}

daemon();
