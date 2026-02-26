> This file contains a list of known bugs in the projects and acts as a scratchpad for potential fixes.

## Known Bugs

### Multi pane setups

- [x] When multiple panes are present, the data streams seem to die, the candles are not updated anymore and at the time of the candle close, the time keeps showing 00:00 without any new candles added. Lets say we have a 2x2 layout with BTC, SOL, LINK and ETH. After some time, the data streams for SOL, LINK and ETH die. **Fixed:** Root cause was `BinanceDatafeed` using a singleton WebSocket — each new `subscribe()` killed the previous pane's connection. Refactored to use a per-subscription `Map` so each pane gets its own independent WebSocket.
