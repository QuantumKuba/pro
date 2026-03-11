import { Component, createSignal, Show } from 'solid-js'
import { KLineData } from 'klinecharts'

import { Modal, Input } from '../../component'
import { SymbolInfo, Period } from '../../types'
import i18n from '../../i18n'

export interface CustomDataModalProps {
  locale: string
  onClose: () => void
  onLoad: (symbol: SymbolInfo, candles: KLineData[], basePeriod: Period) => void
  onStartStream: (symbol: SymbolInfo, basePeriod: Period, wsUrl?: string) => void
}

/**
 * Parse OHLCV data from JSON text.
 * Accepts:
 *   - Array of { timestamp, open, high, low, close, volume }
 *   - Array of [timestamp, open, high, low, close, volume]
 */
function parseOHLCV(text: string): KLineData[] {
  const raw = JSON.parse(text)
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Expected a non-empty JSON array')
  }

  const first = raw[0]

  // Array-of-arrays format: [timestamp, o, h, l, c, v]
  if (Array.isArray(first)) {
    return raw.map((row: number[]) => ({
      timestamp: row[0],
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5] ?? 0
    }))
  }

  // Array-of-objects format
  if (typeof first === 'object' && first !== null) {
    return raw.map((item: any) => ({
      timestamp: item.timestamp ?? item.time ?? item.t ?? 0,
      open: item.open ?? item.o ?? 0,
      high: item.high ?? item.h ?? 0,
      low: item.low ?? item.l ?? 0,
      close: item.close ?? item.c ?? 0,
      volume: item.volume ?? item.vol ?? item.v ?? 0
    }))
  }

  throw new Error('Unrecognized data format')
}

/**
 * Parse CSV text into KLineData[].
 */
function parseCSV(text: string): KLineData[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row')
  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const tsIdx = header.findIndex(h =>
    ['timestamp', 'time', 'date', 't', 'open time', 'open_time', 'opentime', 'datetime', 'date_time'].includes(h) ||
    (h.includes('time') || h.includes('date'))
  )
  const oIdx = header.findIndex(h => ['open', 'o'].includes(h))
  const hIdx = header.findIndex(h => ['high', 'h'].includes(h))
  const lIdx = header.findIndex(h => ['low', 'l'].includes(h))
  const cIdx = header.findIndex(h => ['close', 'c'].includes(h))
  const vIdx = header.findIndex(h => ['volume', 'vol', 'v'].includes(h))
  if (oIdx === -1 || hIdx === -1 || lIdx === -1 || cIdx === -1) {
    throw new Error('CSV must have open, high, low, close columns')
  }
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = line.split(',').map(c => c.trim())
    let ts = 0
    if (tsIdx !== -1) {
      const raw = cols[tsIdx]
      ts = Number(raw)
      if (isNaN(ts)) ts = new Date(raw).getTime()
      if (ts > 0 && ts < 4_102_444_800) ts = ts * 1000
    }
    return {
      timestamp: ts,
      open: parseFloat(cols[oIdx]),
      high: parseFloat(cols[hIdx]),
      low: parseFloat(cols[lIdx]),
      close: parseFloat(cols[cIdx]),
      volume: vIdx !== -1 ? parseFloat(cols[vIdx]) || 0 : 0
    }
  })
}

/** Available base timeframe options for the dropdown */
const TIMEFRAME_OPTIONS: { label: string; period: Period }[] = [
  { label: '1s',  period: { span: 1,  type: 'second', text: '1s'  } },
  { label: '1m',  period: { span: 1,  type: 'minute', text: '1m'  } },
  { label: '3m',  period: { span: 3,  type: 'minute', text: '3m'  } },
  { label: '5m',  period: { span: 5,  type: 'minute', text: '5m'  } },
  { label: '15m', period: { span: 15, type: 'minute', text: '15m' } },
  { label: '30m', period: { span: 30, type: 'minute', text: '30m' } },
  { label: '1H',  period: { span: 1,  type: 'hour',   text: '1H'  } },
  { label: '2H',  period: { span: 2,  type: 'hour',   text: '2H'  } },
  { label: '4H',  period: { span: 4,  type: 'hour',   text: '4H'  } },
  { label: '6H',  period: { span: 6,  type: 'hour',   text: '6H'  } },
  { label: '12H', period: { span: 12, type: 'hour',   text: '12H' } },
  { label: '1D',  period: { span: 1,  type: 'day',    text: '1D'  } },
  { label: '1W',  period: { span: 1,  type: 'week',   text: '1W'  } },
  { label: '1M',  period: { span: 1,  type: 'month',  text: '1M'  } },
]

const CustomDataModal: Component<CustomDataModalProps> = props => {
  const [ticker, setTicker] = createSignal('CUSTOM')
  const [symbolName, setSymbolName] = createSignal('')
  const [fileData, setFileData] = createSignal<KLineData[] | null>(null)
  const [pasteData, setPasteData] = createSignal('')
  const [error, setError] = createSignal('')
  const [fileName, setFileName] = createSignal('')
  const [mode, setMode] = createSignal<'file' | 'api'>('file')
  const [wsUrl, setWsUrl] = createSignal('')
  const [baseTimeframeIdx, setBaseTimeframeIdx] = createSignal(1) // default: 1m

  let fileInput: HTMLInputElement | undefined

  const selectedBasePeriod = () => TIMEFRAME_OPTIONS[baseTimeframeIdx()].period

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setFileName(file.name)
    setError('')

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv'
        const candles = isCSV ? parseCSV(text) : parseOHLCV(text)
        if (candles.length === 0) {
          setError('No valid candle data found')
          return
        }
        setFileData(candles)
        setError('')
      } catch (err: any) {
        setError(err.message || 'Failed to parse file')
        setFileData(null)
      }
    }
    reader.readAsText(file)
  }

  const handleLoad = () => {
    setError('')
    let candles = fileData()

    // If no file, try parsing the pasted text
    if (!candles) {
      const text = pasteData().trim()
      if (!text) {
        setError(i18n('custom_data_no_data', props.locale))
        return
      }
      try {
        // Detect CSV vs JSON
        if (text.startsWith('[') || text.startsWith('{')) {
          candles = parseOHLCV(text)
        } else {
          candles = parseCSV(text)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to parse data')
        return
      }
    }

    if (!candles || candles.length === 0) {
      setError(i18n('custom_data_no_data', props.locale))
      return
    }

    const symbol: SymbolInfo = {
      ticker: ticker() || 'CUSTOM',
      name: symbolName() || ticker() || 'Custom Data',
      shortName: ticker() || 'CUSTOM',
      exchange: 'Custom',
      market: 'custom',
      pricePrecision: 2,
      volumePrecision: 0
    }

    props.onLoad(symbol, candles, selectedBasePeriod())
  }

  const handleStartStream = () => {
    const symbol: SymbolInfo = {
      ticker: ticker() || 'CUSTOM',
      name: symbolName() || ticker() || 'Custom Stream',
      shortName: ticker() || 'CUSTOM',
      exchange: 'Custom',
      market: 'custom',
      pricePrecision: 2,
      volumePrecision: 0
    }
    props.onStartStream(symbol, selectedBasePeriod(), wsUrl() || undefined)
  }

  return (
    <Modal
      title={i18n('custom_data', props.locale)}
      width={560}
      buttons={[
        {
          type: 'confirm',
          children: mode() === 'file'
            ? i18n('custom_data_load', props.locale)
            : i18n('custom_data_start_stream', props.locale),
          onClick: mode() === 'file' ? handleLoad : handleStartStream
        }
      ]}
      onClose={props.onClose}>
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', gap: '0', 'margin-bottom': '16px', 'border-bottom': '1px solid rgba(120,120,120,0.2)' }}>
          <span
            style={{
              padding: '6px 16px',
              cursor: 'pointer',
              'font-size': '13px',
              'border-bottom': mode() === 'file' ? '2px solid #1677FF' : '2px solid transparent',
              opacity: mode() === 'file' ? 1 : 0.5
            }}
            onClick={() => setMode('file')}>
            {i18n('custom_data_file_paste', props.locale)}
          </span>
          <span
            style={{
              padding: '6px 16px',
              cursor: 'pointer',
              'font-size': '13px',
              'border-bottom': mode() === 'api' ? '2px solid #1677FF' : '2px solid transparent',
              opacity: mode() === 'api' ? 1 : 0.5
            }}
            onClick={() => setMode('api')}>
            {i18n('custom_data_api_stream', props.locale)}
          </span>
        </div>

        <div style={{ 'margin-bottom': '12px' }}>
          <label style={{ display: 'block', 'margin-bottom': '4px', 'font-size': '12px', opacity: 0.7 }}>
            {i18n('custom_data_ticker', props.locale)}
          </label>
          <Input
            value={ticker()}
            placeholder="e.g. BTCUSDT"
            onChange={v => setTicker(String(v))}
          />
        </div>
        <div style={{ 'margin-bottom': '12px' }}>
          <label style={{ display: 'block', 'margin-bottom': '4px', 'font-size': '12px', opacity: 0.7 }}>
            {i18n('custom_data_name', props.locale)}
          </label>
          <Input
            value={symbolName()}
            placeholder="e.g. Bitcoin / USDT"
            onChange={v => setSymbolName(String(v))}
          />
        </div>

        {/* Base Timeframe Selector — shared across both tabs */}
        <div style={{ 'margin-bottom': '12px' }}>
          <label style={{ display: 'block', 'margin-bottom': '4px', 'font-size': '12px', opacity: 0.7 }}>
            {i18n('custom_data_base_timeframe', props.locale)}
          </label>
          <select
            class="klinecharts-pro-input"
            style={{
              width: '100%',
              height: '30px',
              'font-size': '12px',
              cursor: 'pointer',
              'box-sizing': 'border-box'
            }}
            value={baseTimeframeIdx()}
            onChange={e => setBaseTimeframeIdx(Number((e.target as HTMLSelectElement).value))}
          >
            {TIMEFRAME_OPTIONS.map((opt, idx) => (
              <option value={idx}>{opt.label}</option>
            ))}
          </select>
        </div>

        <Show when={mode() === 'file'}>
          <div style={{ 'margin-bottom': '12px' }}>
            <label style={{ display: 'block', 'margin-bottom': '4px', 'font-size': '12px', opacity: 0.7 }}>
              {i18n('custom_data_file', props.locale)}
            </label>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
              <input
                ref={el => { fileInput = el }}
                type="file"
                accept=".json,.csv"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <button
                class="klinecharts-pro-button confirm"
                style={{ 'font-size': '12px', padding: '4px 12px' }}
                onClick={() => fileInput?.click()}>
                {i18n('custom_data_choose_file', props.locale)}
              </button>
              <span style={{ 'font-size': '12px', opacity: 0.7 }}>
                {fileName() || i18n('custom_data_no_file', props.locale)}
              </span>
            </div>
          </div>

          <div style={{ 'margin-bottom': '8px' }}>
            <label style={{ display: 'block', 'margin-bottom': '4px', 'font-size': '12px', opacity: 0.7 }}>
              {i18n('custom_data_paste', props.locale)}
            </label>
            <textarea
              class="klinecharts-pro-input"
              style={{
                width: '100%',
                height: '120px',
                resize: 'vertical',
                'font-family': 'monospace',
                'font-size': '11px',
                padding: '8px',
                'box-sizing': 'border-box'
              }}
              placeholder={`[{"timestamp":1709251200000,"open":65000,"high":65500,"low":64800,"close":65200,"volume":100}]`}
              value={pasteData()}
              onInput={(e) => {
                setPasteData(e.currentTarget.value)
                setFileData(null)
                setFileName('')
              }}
            />
          </div>

          {error() && (
            <div style={{ color: '#ef5350', 'font-size': '12px', 'margin-top': '4px' }}>
              {error()}
            </div>
          )}

          {fileData() && (
            <div style={{ color: '#26a69a', 'font-size': '12px', 'margin-top': '4px' }}>
              {`✓ ${fileData()!.length} ${i18n('custom_data_candles_loaded', props.locale)}`}
            </div>
          )}
        </Show>

        <Show when={mode() === 'api'}>
          <div style={{ 'margin-bottom': '12px' }}>
            <label style={{ display: 'block', 'margin-bottom': '4px', 'font-size': '12px', opacity: 0.7 }}>
              {i18n('custom_data_ws_url', props.locale)}
            </label>
            <Input
              value={wsUrl()}
              placeholder="ws://localhost:8080"
              onChange={v => setWsUrl(String(v))}
            />
          </div>

          <div style={{ 'margin-bottom': '12px' }}>
            <label style={{ display: 'block', 'margin-bottom': '8px', 'font-size': '12px', opacity: 0.7 }}>
              {i18n('custom_data_api_global', props.locale)}
            </label>
            <pre style={{
              'font-family': 'monospace',
              'font-size': '11px',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px',
              'border-radius': '4px',
              'white-space': 'pre-wrap',
              'word-break': 'break-all',
              'line-height': '1.5',
              margin: '0'
            }}>
{`// Load initial history
window.__klineChartPro.init([
  {timestamp, open, high, low, close, volume},
  ...
])

// Push real-time update
window.__klineChartPro.push({
  timestamp, open, high, low, close, volume
})

// Clear data
window.__klineChartPro.clear()`}
            </pre>
          </div>

          <div style={{ 'margin-bottom': '8px' }}>
            <label style={{ display: 'block', 'margin-bottom': '8px', 'font-size': '12px', opacity: 0.7 }}>
              {i18n('custom_data_api_ws', props.locale)} — {i18n('custom_data_api_format', props.locale)}
            </label>
            <pre style={{
              'font-family': 'monospace',
              'font-size': '11px',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px',
              'border-radius': '4px',
              'white-space': 'pre-wrap',
              'word-break': 'break-all',
              'line-height': '1.5',
              margin: '0'
            }}>
{`// Single candle
{"timestamp":...,"open":...,"high":...,"low":...,"close":...,"volume":...}

// History array
[{"timestamp":...,...}, ...]

// Typed messages
{"type":"history","data":[...]}
{"type":"update","data":{...}}`}
            </pre>
          </div>
        </Show>
      </div>
    </Modal>
  )
}

export default CustomDataModal
