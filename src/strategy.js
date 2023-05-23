import { Source } from "./source.js"

export class Strategy {
  constructor(args) {
    const { symbol, indicators, reducer, sourceArgs } = {
      reducer: (states) =>
        states.map((s) => s.signal).reduce((p, v) => (v === p ? p : null)),
      sourceArgs: {},
      ...args,
    }
    this.symbol = symbol
    this.indicators = indicators
    this.signalReducer = reducer
    this.source = new Source(sourceArgs)
    this.intervals = [...new Set(this.indicators.map((i) => i.interval))]
    this.minimumValues = {}
    this.state = {}

    this.indicators.forEach((i) => {
      const v = this.minimumValues[i.interval]
      if (v === undefined || i.minimumValues > v) {
        this.minimumValues[i.interval] = i.minimumValues
      }
    })
  }

  nextValue(interval, kline) {
    const state = {}

    for (const i of this.indicators.filter((i) => i.interval === interval)) {
      const select = i.select || (({ close }) => [close])
      const value = i.indicator.nextValue(...select(kline))

      if (value === undefined) {
        state[i.name] = { interval, signal: null, context: {} }
        continue
      }

      const [signal, context] = i.signal(value, kline.close)
      state[i.name] = { interval, signal, context }
    }

    this.state = { ...this.state, ...state }

    if (Object.values(this.state).filter((v) => v.signal === null).length > 0) {
      return undefined
    }

    return this.state
  }

  nextSignal(...args) {
    const state = this.nextValue(...args)
    if (state === undefined) {
      return [undefined, undefined]
    }
    return [
      this.signalReducer(
        Object.entries(state).map(([name, v]) => ({ name, ...v }))
      ),
      state,
    ]
  }

  async getSignal(timestamp = undefined) {
    let signal
    for (const interval of this.intervals) {
      for await (const k of this.source.klines({
        symbol: this.symbol,
        limit: this.minimumValues[interval],
        endTime: timestamp,
        interval,
      })) {
        signal = this.nextSignal(interval, k)
      }
    }
    return signal
  }

  async backtest(timestamp, expected) {
    const [signal, state] = await this.getSignal(timestamp)
    if (signal === undefined) {
      throw new Error("Signal is undefined")
    }
    return [signal === expected, state]
  }

  async run(callback) {
    const signal = await this.getSignal()
    if (signal !== undefined) {
      callback(signal)
    }
    this.intervals.forEach((i) =>
      this.source.subscribe(this.symbol, i, (k) => {
        const signal = this.nextSignal(i, k)
        if (signal !== undefined) {
          callback(signal)
        }
      })
    )
  }

  stop() {
    this.source.disconnect()
  }
}
