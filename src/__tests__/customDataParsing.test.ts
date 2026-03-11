import { describe, it, expect } from 'vitest'

// Replicate the module-scoped parsing functions from custom-data-modal
// so they can be tested in isolation.

function parseOHLCV(text: string) {
  const raw = JSON.parse(text)
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Expected a non-empty JSON array')
  }
  const first = raw[0]
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

function parseCSV(text: string) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row')
  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const tsIdx = header.findIndex(h => ['timestamp', 'time', 'date', 't'].includes(h))
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

describe('parseOHLCV', () => {
  it('parses array-of-objects with standard keys', () => {
    const json = JSON.stringify([
      { timestamp: 1000, open: 10, high: 15, low: 8, close: 12, volume: 500 }
    ])
    const result = parseOHLCV(json)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      timestamp: 1000, open: 10, high: 15, low: 8, close: 12, volume: 500
    })
  })

  it('parses array-of-objects with shorthand keys', () => {
    const json = JSON.stringify([
      { t: 2000, o: 20, h: 25, l: 18, c: 22, v: 300 }
    ])
    const result = parseOHLCV(json)
    expect(result[0]).toEqual({
      timestamp: 2000, open: 20, high: 25, low: 18, close: 22, volume: 300
    })
  })

  it('parses array-of-arrays format', () => {
    const json = JSON.stringify([[1000, 10, 15, 8, 12, 500]])
    const result = parseOHLCV(json)
    expect(result[0]).toEqual({
      timestamp: 1000, open: 10, high: 15, low: 8, close: 12, volume: 500
    })
  })

  it('defaults volume to 0 when missing in array format', () => {
    const json = JSON.stringify([[1000, 10, 15, 8, 12]])
    const result = parseOHLCV(json)
    expect(result[0].volume).toBe(0)
  })

  it('handles multiple candles', () => {
    const json = JSON.stringify([
      { timestamp: 1000, open: 10, high: 15, low: 8, close: 12, volume: 100 },
      { timestamp: 2000, open: 12, high: 18, low: 11, close: 16, volume: 200 },
      { timestamp: 3000, open: 16, high: 20, low: 14, close: 19, volume: 300 }
    ])
    const result = parseOHLCV(json)
    expect(result).toHaveLength(3)
    expect(result[2].timestamp).toBe(3000)
  })

  it('uses "time" key as fallback for timestamp', () => {
    const json = JSON.stringify([{ time: 5000, open: 1, high: 2, low: 0, close: 1 }])
    const result = parseOHLCV(json)
    expect(result[0].timestamp).toBe(5000)
  })

  it('defaults missing fields to 0', () => {
    const json = JSON.stringify([{ timestamp: 1000 }])
    const result = parseOHLCV(json)
    expect(result[0]).toEqual({
      timestamp: 1000, open: 0, high: 0, low: 0, close: 0, volume: 0
    })
  })

  it('throws on empty array', () => {
    expect(() => parseOHLCV('[]')).toThrow('Expected a non-empty JSON array')
  })

  it('throws on non-array input', () => {
    expect(() => parseOHLCV('"hello"')).toThrow('Expected a non-empty JSON array')
  })

  it('throws on array of primitives', () => {
    expect(() => parseOHLCV('[1, 2, 3]')).toThrow('Unrecognized data format')
  })

  it('throws on invalid JSON', () => {
    expect(() => parseOHLCV('not json')).toThrow()
  })
})

describe('parseCSV', () => {
  it('parses standard CSV with header', () => {
    const csv = `timestamp,open,high,low,close,volume
1709251200000,65000,65500,64800,65200,100`
    const result = parseCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      timestamp: 1709251200000,
      open: 65000, high: 65500, low: 64800, close: 65200, volume: 100
    })
  })

  it('handles shorthand column names', () => {
    const csv = `t,o,h,l,c,vol
1000,10,15,8,12,500`
    const result = parseCSV(csv)
    expect(result[0].timestamp).toBe(1000000) // seconds → ms conversion
    expect(result[0].open).toBe(10)
    expect(result[0].volume).toBe(500)
  })

  it('converts seconds timestamps to milliseconds', () => {
    const csv = `timestamp,open,high,low,close
1709251200,65000,65500,64800,65200`
    const result = parseCSV(csv)
    expect(result[0].timestamp).toBe(1709251200000)
  })

  it('handles date string timestamps', () => {
    const csv = `date,open,high,low,close
2024-03-01,65000,65500,64800,65200`
    const result = parseCSV(csv)
    expect(result[0].timestamp).toBeGreaterThan(0)
    expect(isNaN(result[0].timestamp)).toBe(false)
  })

  it('defaults volume to 0 when column missing', () => {
    const csv = `timestamp,open,high,low,close
1000,10,15,8,12`
    const result = parseCSV(csv)
    expect(result[0].volume).toBe(0)
  })

  it('skips empty data lines', () => {
    const csv = `timestamp,open,high,low,close
1000,10,15,8,12

2000,20,25,18,22
`
    const result = parseCSV(csv)
    expect(result).toHaveLength(2)
  })

  it('handles multiple rows', () => {
    const csv = `timestamp,open,high,low,close,volume
1709251200000,65000,65500,64800,65200,100
1709337600000,65200,66000,65100,65800,150
1709424000000,65800,66500,65500,66200,200`
    const result = parseCSV(csv)
    expect(result).toHaveLength(3)
    expect(result[0].timestamp).toBe(1709251200000)
    expect(result[2].close).toBe(66200)
  })

  it('trims whitespace from headers and values', () => {
    const csv = ` timestamp , open , high , low , close , volume 
 1000 , 10 , 15 , 8 , 12 , 500 `
    const result = parseCSV(csv)
    expect(result[0].open).toBe(10)
    expect(result[0].volume).toBe(500)
  })

  it('throws when missing required columns', () => {
    const csv = `timestamp,price\n1000,100`
    expect(() => parseCSV(csv)).toThrow('CSV must have open, high, low, close columns')
  })

  it('throws on header-only CSV', () => {
    expect(() => parseCSV('timestamp,open,high,low,close')).toThrow(
      'CSV needs a header row and at least one data row'
    )
  })

  it('throws on empty string', () => {
    expect(() => parseCSV('')).toThrow()
  })
})
