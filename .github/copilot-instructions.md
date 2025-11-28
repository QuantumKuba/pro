# GitHub Copilot Instructions

## Big picture
- The npm entrypoint [src/index.ts](../src/index.ts) registers every overlay from [src/extension/index.ts](../src/extension/index.ts) and exports `KLineChartPro`, `DefaultDatafeed`, and the locale loader, so changes to exports or overlays always start there.
- `KLineChartPro` ([src/KLineChartPro.tsx](../src/KLineChartPro.tsx)) renders `ChartProComponent` with the default themes, period list, and locale; most external-facing behavior flows through that Solid root.
- `ChartProComponent` ([src/ChartProComponent.tsx](../src/ChartProComponent.tsx)) mounts the `klinecharts` widget, wires indicators, drawing bars, and modals via Solid signals/effects, and funnels user actions back through `widget?.overrideIndicator`, `widget?.setStyles`, and the custom locales.

## Development workflow
- Run `npm run build` for the combined TypeScript compile, Vite bundle, and `dts-bundle-generator` run that ship in CI and the published package.
- Documentation is served from Vitepress under `docs/` (with localized mirrors in [docs/en-US/index.md](../docs/en-US/index.md)); use `npm run docs:dev` for live previews, `npm run docs:build` for the static site, and `npm run docs:deploy` to push to GitHub Pages.
- LESS files live alongside Solid components (e.g., [src/widget/drawing-bar/index.less](../src/widget/drawing-bar/index.less)), so tweak styles with those imports and rerun the build to ensure Vite reconciles the pipeline.
- `DefaultDatafeed` ([src/DefaultDatafeed.ts](../src/DefaultDatafeed.ts)) talks to Polygon REST + WebSocket endpoints, so set `VITE_POLYGON` (see `.env`) before running the docs or any live data demo; avoid checking new secrets into git.

## Project-specific patterns
- All custom overlays live under `src/extension/*` and are collected by [src/extension/index.ts](../src/extension/index.ts) before `registerOverlay` is called, so append new overlay defs there to make them globally available.
- The widgets folder (`src/widget/*`) holds passed-in UI pieces such as the drawing bar, period bar, and modals; they reuse the primitives in [src/component/index.tsx](../src/component/index.tsx) where buttons, selects, lists, and loading indicators live.
- Drawing bar options ([src/widget/drawing-bar/icons/index.ts](../src/widget/drawing-bar/icons/index.ts)) map directly to overlay keys, so updating the icons or adding new overlays requires syncing the icon helpers, the `overlays` list in the bar, and the overlay module itself.
- `ChartProComponent` keeps localized strings in [src/i18n/zh-CN.json](../src/i18n/zh-CN.json) and [src/i18n/en-US.json](../src/i18n/en-US.json) and exposes the `load` helper from [src/i18n/index.ts](../src/i18n/index.ts) to let docs or tests add new locales before `KLineChartPro` mounts.
- Indicator, timezone, and settings modals push state back through `widget?.overrideIndicator`, `widget?.setStyles`, and `widget?.setTimezone`; follow the `createEffect`/signal patterns in [src/ChartProComponent.tsx](../src/ChartProComponent.tsx) instead of manipulating DOM nodes directly.

## Documentation pointers
- Update both [docs/index.md](../docs/index.md) and [docs/en-US/index.md](../docs/en-US/index.md) (and their child files) when editing user-facing guidance so English and Chinese builds stay aligned.
- Exported APIs and types follow from [src/index.ts](../src/index.ts), so keep the re-export list and type exports in sync with any new surface area that should appear in the distribution bundles.

Let me know if any section feels unclear or if you need more depth before I iterate again.
