import { Spot, WebsocketStream } from "@binance/connector"

const API = {
  spot: "https://api.binance.us",
  ws: "wss://stream.binance.us:9443",
}

const maxKlineLimit = 1000

const intervalRe = /(\d.?)([smhdwM])/
const intervalSeconds = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
  w: 60 * 60 * 24 * 7,
  M: 60 * 60 * 24 * 30,
}

function parseInterval(interval) {
  const m = intervalRe.exec(interval)
  if (m === null) {
    return undefined
  }
  const [, i, s] = m
  return Number(i) * intervalSeconds[s]
}

function parseRestKline(k) {
  return {
    timestamp: Number(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
  }
}

function parseWsKline(k) {
  return {
    timestamp: k.t,
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
  }
}

export class Source {
  constructor(args = {}) {
    const { apiKey, apiSecret, spotURL, wsURL } = args
    this.spot = new Spot(apiKey || "", apiSecret || "", {
      baseURL: spotURL || API.spot,
    })
    this.wsURL = wsURL || API.ws
    this.websockets = {}
  }

  subscribe(symbol, interval, callback) {
    const name = symbol + interval
    if (name in this.websockets) {
      this.websockets[name].callbacks.push(callback)
      return
    }
    let momentValue

    const ws = new WebsocketStream({
      wsURL: this.wsURL,
      callbacks: {
        message: (data) => {
          data = JSON.parse(data)
          if (!data.k.x) {
            momentValue = parseWsKline(data.k)
            return
          }
          this.websockets[name].callbacks.forEach((cb) =>
            cb(parseWsKline(data.k))
          )
        },
      },
    })

    this.websockets[name] = { websocket: ws, callbacks: [callback] }
    ws.kline(symbol, interval)

    return () => momentValue
  }

  unsubscribe(symbol, interval, callback) {
    const name = symbol + interval
    const ws = this.websockets[name]
    if (name in this.websockets) {
      ws.callbacks = ws.callbacks.filter((cb) => cb !== callback)
      if (ws.callbacks.length === 0) {
        ws.websocket.disconnect()
        delete this.websocket[name]
      }
    }
  }

  async getKlines(symbol, interval, args = {}) {
    args = {
      limit: 1,
      ...args,
    }
    const data = (await this.spot.klines(symbol, interval, args)).data
    if (args.limit === 1) {
      return parseRestKline(data[0])
    }
    return data.map((d) => parseRestKline(d))
  }

  async getRecentTimestamp(symbol, interval) {
    return (await this.getKlines(symbol, interval)).timestamp
  }

  async *klines({ symbol, interval, limit, endTime }) {
    endTime = endTime || (await this.getRecentTimestamp(symbol, interval))

    const seconds = parseInterval(interval)
    const iters = Math.ceil(limit / maxKlineLimit)
    let lastEndTime = 0

    for (let i = 0; i < iters; i++) {
      let lines
      if (i == 0) {
        lines = (
          await this.spot.klines(symbol, interval, {
            startTime: endTime - seconds * (limit - 1) * 1000,
            endTime: endTime,
            limit: maxKlineLimit,
          })
        ).data
      } else {
        lines = (
          await this.spot.klines(symbol, interval, {
            startTime: lastEndTime + 1,
            endTime: endTime,
            limit,
          })
        ).data
      }

      limit -= maxKlineLimit

      if (lines.length === 0) {
        continue
      }

      lastEndTime = lines[lines.length - 1][0]

      for (const k of lines) {
        yield parseRestKline(k)
      }
    }
  }

  disconnect() {
    for (const name in this.websockets) {
      this.websockets[name].websocket.disconnect()
    }
    this.websockets = {}
  }
}
