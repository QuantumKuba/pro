> This file contains a list of known bugs in the projects and acts as a scratchpad for potential fixes.

## Known Bugs

### Multi pane setups

- [x] When multiple panes are present, the data streams seem to die, the candles are not updated anymore and at the time of the candle close, the time keeps showing 00:00 without any new candles added. Lets say we have a 2x2 layout with BTC, SOL, LINK and ETH. After some time, the data streams for SOL, LINK and ETH die. **Fixed:** Root cause was `BinanceDatafeed` using a singleton WebSocket — each new `subscribe()` killed the previous pane's connection. Refactored to use a per-subscription `Map` so each pane gets its own independent WebSocket.

### UI

- [x] The colors of the layout selection menu are not matching the color theme and are hardly visible. This is because they render as dark colors on a dark theme. **Fixed:** Map the `--klinecharts-pro-*` CSS variables in `dashboard.less` to `.chart-view__nav` mapping Apple-themed dark variables to the tool overlay.
- [x] The Layout selection button does not reflect the currently selected layout. It does not update correctly. Only after going to the dashboard and back to the chart, it updates. **Fixed:** Refactored `PresetIcon` inside `LayoutSelector.tsx` to render using an inline reactive function `(() => { switch (props.presetId) { ... } })()` instead of statically to maintain reactivity to the `presetId` prop.

## TODO

### Features

#### UI

- [ ] Make the timeframe selection menu, including the indicator, Timezone, Setting, Replay, and Screenshot buttons responsive. We should collapse them into something like a burger menu, get rid of the text and leave icons only or use any other appropriate approach that you as a senior developer and UI/UX designer deems best.
