import { DataLoaderGetBarsParams, DataLoaderSubscribeBarParams, DataLoaderUnsubscribeBarParams, KLineData } from "klinecharts";
import { ChartDataLoaderType, Datafeed, Period, SymbolInfo } from "./types";
import { period, setLoadingVisible, symbol } from "./ChartProComponent";

export default class ChartDataLoader implements ChartDataLoaderType {
  private _datafeed: Datafeed;
  private _loading: boolean;
  private _subscriptionSuspended: boolean;

  // Replay mode state
  private _replayMode: boolean = false;
  private _replayData: KLineData[] = [];
  private _replayIndex: number = 0; // Current visible end position (replay progress)
  private _historicalOffset: number = 0; // Number of candles prepended before original data
  private _isLoadingBackward: boolean = false; // Prevent continuous backward loading
  private _suppressBackwardLoading: boolean = false; // Suppress backward loading during playback
  private _onBackwardDataLoaded?: (newCandleCount: number) => void;

  constructor(datafeed: Datafeed) {
    console.info('ChartDataLoader initialized');
    this._datafeed = datafeed;
    this._loading = false;
    this._subscriptionSuspended = false;
  }

  private _fetchLimit: number = 500;

  setFetchLimit(limit: number): void {
    this._fetchLimit = limit;
  }

  get fetchLimit(): number {
    return this._fetchLimit;
  }

  async getBars(params: DataLoaderGetBarsParams): Promise<void> {
    console.info('ChartDataLoader getBars', params);
    const { type, timestamp: _t, symbol: _s, period: _p, callback } = params;

    // In replay mode, return data from the replay buffer
    if (this._replayMode && this._replayData.length > 0) {
      console.info('getBars: Replay mode active', {
        type,
        replayIndex: this._replayIndex,
        totalData: this._replayData.length
      });

      if (type === 'backward') {
        // Prevent backward loading during playback or during reload cycle
        if (this._isLoadingBackward || this._suppressBackwardLoading) {
          callback([], false);
          return;
        }

        // User scrolled left - try to load more historical data before current replay data
        const oldestTimestamp = this._replayData[0]?.timestamp;
        if (oldestTimestamp) {
          const p = period();
          const s = symbol();
          if (p && s) {
            // Calculate 'to' as one period BEFORE the oldest candle to avoid duplicates
            // We use adjustFromTo to get properly aligned timestamps
            const [oneBeforeOldest] = this.adjustFromTo(p, oldestTimestamp, 2);
            const [from] = this.adjustFromTo(p, oneBeforeOldest, this._fetchLimit);

            // Set flag to prevent re-entry during reload
            this._isLoadingBackward = true;

            this._datafeed.getHistoryKLineData(s, p, from, oneBeforeOldest).then(olderData => {
              if (olderData && olderData.length > 0) {
                // strict validation: filter ONLY data that is strictly older than what we have
                const oldestExisting = this._replayData[0]?.timestamp;

                // Filter data to ensure we only get historical candles
                const validOlderData = olderData.filter(d => d.timestamp < oldestExisting);

                // Sort by timestamp asc
                validOlderData.sort((a, b) => a.timestamp - b.timestamp);

                if (validOlderData.length > 0) {
                  // Double check the last one is still older
                  const lastNew = validOlderData[validOlderData.length - 1];
                  if (lastNew.timestamp < oldestExisting) {
                    // Prepend older data to replay data
                    this._replayData = [...validOlderData, ...this._replayData];
                    // Track offset
                    this._historicalOffset += validOlderData.length;
                    // Notify parent
                    this._onBackwardDataLoaded?.(validOlderData.length);
                    // Return empty to chart because we manually updated the data
                    callback([], false);
                  } else {
                    callback([], false);
                  }
                } else {
                  // No valid older data found
                  callback([], false);
                }
              } else {
                callback([], false);
              }

              // Reset flag
              setTimeout(() => {
                this._isLoadingBackward = false;
              }, 500);
            }).catch(() => {
              callback([], false);
              this._isLoadingBackward = false;
            });
          } else {
            callback([], false);
          }
        } else {
          callback([], false);
        }
        return;
      } else if (type === 'update') {
        // No live updates in replay mode
        callback([], false);
      } else {
        // Initial load ('forward' or undefined) - return visible data up to current position
        // Use historicalOffset + replayIndex to get the correct array position
        const visibleEndIndex = this._historicalOffset + this._replayIndex;
        const replaySlice = this._replayData.slice(0, visibleEndIndex + 1);
        // Pass true to indicate more backward data CAN be loaded when user scrolls left
        callback(replaySlice, true);
      }
      return;
    }

    if (type === 'backward' || type === 'update') {
      console.info('getBars: type is backward or update (no forward support yet)');
      callback([], false);
      return;
    }
    this._loading = true
    setLoadingVisible(true)
    const timestamp = _t ?? new Date().getTime()
    const get = async () => {
      const p = period()!
      const s = symbol()!
      const [to] = this.adjustFromTo(p, timestamp!, 1)
      const [from] = this.adjustFromTo(p, to, this._fetchLimit)
      const kLineDataList = await this._datafeed.getHistoryKLineData(s, p, from, to)
      callback(kLineDataList, kLineDataList.length > 0)
      this._loading = false
      setLoadingVisible(false)
    }
    await get();
  }

  subscribeBar(params: DataLoaderSubscribeBarParams): void {
    console.info('ChartDataLoader subscribeBar', params);
    if (this._subscriptionSuspended) {
      console.info('Subscription suspended (replay mode), skipping')
      return
    }
    const { symbol: _s, period: _p, callback } = params;
    this._datafeed.subscribe(symbol()!, period()!, callback)
  }

  unsubscribeBar(params: DataLoaderUnsubscribeBarParams): void {
    console.info('ChartDataLoader unsubscribeBar', params);
    const { symbol: _s, period: _p } = params;
    this._datafeed.unsubscribe(symbol()!, period()!)
  }

  /**
   * Suspend live data subscriptions (for replay mode)
   */
  suspendSubscription(): void {
    console.info('ChartDataLoader suspendSubscription')
    this._subscriptionSuspended = true
    // Unsubscribe from current feed
    this._datafeed.unsubscribe(symbol()!, period()!)
  }

  /**
   * Resume live data subscriptions (after replay mode)
   */
  resumeSubscription(): void {
    console.info('ChartDataLoader resumeSubscription')
    this._subscriptionSuspended = false
  }

  /**
   * Check if subscription is suspended
   */
  get isSubscriptionSuspended(): boolean {
    return this._subscriptionSuspended
  }

  searchSymbols(search?: string): Promise<SymbolInfo[]> {
    return this._datafeed.searchSymbols(search)
  }

  get loading(): boolean {
    return this._loading;
  }

  set loading(value: boolean) {
    this._loading = value;
  }

  /**
   * Get the underlying datafeed instance for direct access (e.g., replay mode)
   */
  get datafeed(): Datafeed {
    return this._datafeed;
  }

  /**
   * Get historical data for replay mode
   */
  async getHistoryData(symbol: SymbolInfo, period: Period, from: number, to: number): Promise<KLineData[]> {
    return this._datafeed.getHistoryKLineData(symbol, period, from, to);
  }

  /**
   * Set replay mode with data and starting index
   */
  setReplayData(data: KLineData[], startIndex: number): void {
    console.info('ChartDataLoader setReplayData', { dataLength: data.length, startIndex });
    this._replayMode = true;
    this._replayData = data;
    this._replayIndex = startIndex;
    this._historicalOffset = 0; // Reset historical offset when setting new replay data
    this._isLoadingBackward = false; // Reset loading flag
  }

  /**
   * Update the current replay index (for stepping forward/backward)
   * The index passed is the absolute array position, we convert it to replay progress
   */
  updateReplayIndex(index: number): void {
    console.info('ChartDataLoader updateReplayIndex', { index, offset: this._historicalOffset });
    // Convert from absolute array position to replay progress by subtracting offset
    const logicalIndex = index - this._historicalOffset;
    this._replayIndex = Math.max(0, Math.min(logicalIndex, this._replayData.length - this._historicalOffset - 1));
  }

  /**
   * Get current replay index
   */
  get replayIndex(): number {
    return this._replayIndex;
  }

  /**
   * Check if in replay mode
   */
  get isReplayMode(): boolean {
    return this._replayMode;
  }

  /**
   * Get total replay data length
   */
  get replayDataLength(): number {
    return this._replayData.length;
  }

  /**
   * Clear replay mode and return to normal operation
   */
  clearReplayMode(): void {
    console.info('ChartDataLoader clearReplayMode');
    this._replayMode = false;
    this._replayData = [];
    this._replayIndex = 0;
    this._historicalOffset = 0;
    this._isLoadingBackward = false;
    this._suppressBackwardLoading = false;
    this._onBackwardDataLoaded = undefined;
  }

  /**
   * Set callback for when backward historical data is loaded
   */
  setOnBackwardDataLoaded(callback: (newCandleCount: number) => void): void {
    this._onBackwardDataLoaded = callback;
  }

  /**
   * Get current replay data array
   */
  getReplayData(): KLineData[] {
    return this._replayData;
  }

  /**
   * Get the visible end index (historicalOffset + replayIndex)
   * This is the actual array index for the current visible end
   */
  get visibleEndIndex(): number {
    return this._historicalOffset + this._replayIndex;
  }

  /**
   * Set whether to suppress backward loading (during playback chart reloads)
   */
  setSuppressBackwardLoading(suppress: boolean): void {
    this._suppressBackwardLoading = suppress;
  }

  adjustFromTo(period: Period, toTimestamp: number, count: number) {
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

      case 'week': {
        const date = new Date(to)
        const day = date.getDay() || 7 // Sunday -> 7
        date.setHours(0, 0, 0, 0)
        to = date.getTime() - (day - 1) * 24 * 60 * 60 * 1000
        from = to - count * period.span * 7 * 24 * 60 * 60 * 1000
        break
      }

      case 'month': {
        const date = new Date(to)
        to = new Date(date.getFullYear(), date.getMonth(), 1).getTime()
        const _from = new Date(to - count * period.span * 30 * 24 * 60 * 60 * 1000)
        from = new Date(_from.getFullYear(), _from.getMonth(), 1).getTime()
        break
      }

      case 'year': {
        const date = new Date(to)
        to = new Date(date.getFullYear(), 0, 1).getTime()
        const _from = new Date(to - count * period.span * 365 * 24 * 60 * 60 * 1000)
        from = new Date(_from.getFullYear(), 0, 1).getTime()
        break
      }
    }

    return [from, to]
  }
}
