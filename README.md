# binoc

> See the future in the past 🔮

binoc is a JavaScript library for technical analysis on the [Binance][binance] exchange.

## Features

- Flexible strategy definition
- Bring-your-own indicators
- Backtesting using [historical candlestick data][rest]
- Realtime signalling using [candlestick data streams][ws]

[binance]: https://www.binance.us/
[rest]: https://docs.binance.us/#get-candlestick-data
[ws]: https://docs.binance.us/#candlestick-data-stream

## Installation

```sh
npm install binoc
```

## Usage

```js
import Strategy from "binoc"
import { SMA, WMA } from "@debut/indicators"

// Define a strategy.
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

// Backtest a strategy given a timestamp and expected signal.
const [result, state] = await strategy.backtest(1683685980000, false)

// Run a strategy for realtime signalling.
await strategy.run(([signal, state]) => {
    console.log(signal, state)
})
strategy.stop()
```

## License

This project is licensed under the MIT License (see [LICENSE](LICENSE)).
