
// Mock types
interface Period {
  type: string;
  span: number;
  text?: string;
}

// Mock types
interface SymbolInfo {
  ticker: string;
}

// Copied from BinanceDatafeed.ts (simplified for testing)
const SUPPORTED_INTERVALS = {
  second: [1],
  minute: [1, 3, 5, 15, 30],
  hour: [1, 2, 4, 6, 8, 12],
  day: [1, 3],
  week: [1],
  month: [1]
}

function getStrategy(period: Period) {
  const { span, type } = period
  if (type === 'minute') return { interval: `${span}m`, multiplier: 1, baseSpan: 1, baseType: 'minute' }
  if (type === 'hour') return { interval: `${span}h`, multiplier: 1, baseSpan: 1, baseType: 'hour' }
  if (type === 'day') return { interval: `${span}d`, multiplier: 1, baseSpan: 1, baseType: 'day' }
  return { interval: '1m', multiplier: 1, baseSpan: 1, baseType: 'minute' }
}

// Copied from DataLoader.ts
function adjustFromTo(period: Period, toTimestamp: number, count: number) {
  let to = toTimestamp
  let from = to

  switch (period.type) {
    case 'minute':
      to -= to % (60 * 1000)
      from = to - count * period.span * 60 * 1000
      break

    case 'hour':
      to -= to % (60 * 60 * 1000)
      from = to - count * period.span * 60 * 60 * 1000
      break

    case 'day':
      to -= to % (24 * 60 * 60 * 1000)
      from = to - count * period.span * 24 * 60 * 60 * 1000
      break
  }

  return [from, to]
}

// Test Simulation
async function runTest() {
  console.log("Starting Test...");

  const p: Period = { type: 'day', span: 1, text: '1D' };
  const s: SymbolInfo = { ticker: 'BTCUSDT' };

  // Simulate current state: Oldest candle is Aug 01, 2024
  const oldestTimestamp = new Date('2024-08-01T00:00:00Z').getTime();
  console.log("Oldest Timestamp (Simulated):", new Date(oldestTimestamp).toISOString(), oldestTimestamp);

  // Step 1: adjustFromTo logic
  const [oneBeforeOldest] = adjustFromTo(p, oldestTimestamp, 2);
  console.log("oneBeforeOldest:", new Date(oneBeforeOldest).toISOString(), oneBeforeOldest);

  const [from] = adjustFromTo(p, oneBeforeOldest, 500);
  console.log("from:", new Date(from).toISOString(), from);

  // Step 2: Binance Fetch URL generation logic
  const strategy = getStrategy(p);

  // Simulate what BinanceDatafeed does
  let unitMs = 24 * 60 * 60 * 1000;
  const baseDuration = strategy.baseSpan * unitMs;
  const neededCandles = Math.ceil((oneBeforeOldest - from) / baseDuration);
  const limit = Math.min(1000, Math.max(1, neededCandles)); // Simplified

  const safeTo = Math.floor(oneBeforeOldest);

  const url = `https://api.binance.com/api/v3/klines?symbol=${s.ticker}&interval=${strategy.interval}&endTime=${safeTo}&limit=${limit}`;
  console.log("Generated URL:", url);

  // Step 3: Fetch Data (Actual Network Call)
  console.log("Fetching from Binance...");
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (Array.isArray(data)) {
      const first = data[0];
      const last = data[data.length - 1];
      console.log("Received Candles Count:", data.length);
      console.log("First Candle Time:", new Date(first[0]).toISOString());
      console.log("Last Candle Time:", new Date(last[0]).toISOString());

      if (last[0] > oldestTimestamp) {
        console.error("FAIL: Fetched data is NEWER than oldestTimestamp!");
      } else {
        console.log("PASS: Fetched data is older.");
      }
    } else {
      console.error("Error response:", data);
    }
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

runTest();
