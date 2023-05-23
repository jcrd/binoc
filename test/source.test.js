import assert from "assert"

import { Source } from "../src/source.js"

describe("Source", () => {
  const source = new Source()

  describe("klines", () => {
    it("should generate 1m klines with sequential timestamps", async () => {
      let last = 0
      let count = 0
      for await (const kline of source.klines({
        symbol: "BNBUSD",
        interval: "1m",
        limit: 1001,
      })) {
        const now = kline.timestamp
        if (last > 0) {
          assert.equal(now, last + 60 * 1000)
        }
        last = now
        count++
      }
      assert.equal(last, await source.getRecentTimestamp("BNBUSD", "1m"))
      assert.equal(count, 1001)
    })

    it("should generate 1s klines ending at the specified time", async () => {
      let last = 0
      let count = 0
      const endTime =
        (await source.getRecentTimestamp("BNBUSD", "1s")) - 30 * 60 * 1000
      for await (const kline of source.klines({
        symbol: "BNBUSD",
        interval: "1s",
        limit: 1001,
        endTime,
      })) {
        const now = kline.timestamp
        if (last > 0) {
          assert.equal(now, last + 1 * 1000)
        }
        last = now
        count++
      }
      assert.equal(last, endTime)
      assert.equal(count, 1001)
    })
  })

  describe("subscribe", () => {
    it("should get klines from websocket streams", async () => {
      const now = await source.getRecentTimestamp("BNBUSD", "1s")
      await new Promise((resolve) => {
        source.subscribe("BNBUSD", "1s", (k) => {
          assert(k.timestamp > now)
          resolve()
        })
      })
      source.disconnect()
    })
  })
})
