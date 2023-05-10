import assert from "assert"

import { SMA, WMA } from "@debut/indicators"

import Strategy from "../src/strategy.js"

describe("Strategy", () => {
  describe("backtest", () => {
    const strategy = new Strategy({
      symbol: "BNBUSD",
      indicators: [
        {
          name: "SMA20_1m",
          interval: "1m",
          indicator: new SMA(20),
          signal: (v, close) => [close > v, { v, close }],
          minimumValues: 20,
        },
        {
          name: "WMA20_1m",
          interval: "1m",
          indicator: new WMA(20),
          signal: (v, close) => [close > v, { v, close }],
          minimumValues: 20,
        },
      ],
    })

    it("should produce an expected signal given a timestamp", async () => {
      const [result] = await strategy.backtest(1683685980000, false)
      assert(result)
    })
  })

  describe("run", function () {
    this.timeout(4000)

    const strategy = new Strategy({
      symbol: "BNBUSD",
      indicators: [
        {
          name: "WMA20_1s",
          interval: "1s",
          indicator: new WMA(20),
          signal: (v, close) => [close > v, { v, close }],
          minimumValues: 20,
        },
      ],
    })

    it("should produce signals given realtime klines", async () => {
      let count = 0
      await new Promise(async (resolve) => {
        await strategy.run(([signal]) => {
          assert(signal !== undefined)
          if (++count > 1) {
            resolve()
          }
        })
      })
      strategy.stop()
    })
  })
})
