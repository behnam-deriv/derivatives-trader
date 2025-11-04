import React from 'react';
import { toJS } from 'mobx';

import {
    createSmartChartsChampionAdapter,
    TGetQuotes,
    TGranularity,
    TSubscribeQuotes,
    TUnsubscribeQuotes,
} from '../Adapters';

interface UseSmartChartsAdapterConfig {
    debug?: boolean;
    activeSymbols?: any;
    granularity?: number;
    is_accumulator?: boolean;
    updateAccumulatorBarriersData?: (data: any) => void;
    setTickData?: (data: any) => void;
}

interface ChartData {
    activeSymbols: any;
    tradingTimes?: Record<string, { isOpen: boolean; openTime: string; closeTime: string }>;
}

interface UseSmartChartsAdapterReturn {
    smartChartsAdapter: ReturnType<typeof createSmartChartsChampionAdapter>;
    chartData: ChartData;
    isLoading: boolean;
    error: Error | null;
    getQuotes: TGetQuotes;
    subscribeQuotes: TSubscribeQuotes;
    unsubscribeQuotes: TUnsubscribeQuotes;
    retryFetchChartData: () => Promise<void>;
    isValidGranularity: (g: number) => g is TGranularity;
}

/**
 * Custom hook to manage SmartCharts Champion Adapter logic
 * Centralizes the common functionality used across all chart components
 */
export const useSmartChartsAdapter = (config: UseSmartChartsAdapterConfig = {}): UseSmartChartsAdapterReturn => {
    const {
        debug = false,
        activeSymbols,
        granularity,
        is_accumulator,
        updateAccumulatorBarriersData,
        setTickData,
    } = config;

    // Initialize SmartCharts Champion Adapter
    const smartChartsAdapter = React.useMemo(() => {
        return createSmartChartsChampionAdapter({
            debug,
        });
    }, [debug]);

    // Chart data state
    const [chartData, setChartData] = React.useState<ChartData>({
        activeSymbols: activeSymbols ? toJS(activeSymbols) : [],
    });
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    // Type guard for granularity validation
    const isValidGranularity = React.useCallback((g: number): g is TGranularity => {
        return [0, 60, 120, 180, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400].includes(g);
    }, []);

    // Fetch chart data including trading times
    const fetchChartData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await smartChartsAdapter.getChartData();
            setChartData({
                activeSymbols: data.activeSymbols,
                tradingTimes: data.tradingTimes,
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error fetching chart data:', error);
            setError(error instanceof Error ? error : new Error('Failed to fetch chart data'));
        } finally {
            setIsLoading(false);
        }
    }, [smartChartsAdapter]);

    // Retry function for error recovery
    const retryFetchChartData = React.useCallback(async () => {
        await fetchChartData();
    }, [fetchChartData]);

    // Initialize chart data on mount
    React.useEffect(() => {
        fetchChartData();
    }, [fetchChartData]);

    // Memoized getQuotes function
    const getQuotes = React.useCallback<TGetQuotes>(
        async params => {
            if (!smartChartsAdapter) {
                throw new Error('Adapter not initialized');
            }

            // Validate granularity with type guard
            const validatedGranularity = isValidGranularity(params.granularity) ? params.granularity : 0;

            const result = await smartChartsAdapter.getQuotes({
                symbol: params.symbol,
                granularity: validatedGranularity,
                count: params.count,
                start: params.start,
                end: params.end,
            });

            // Transform adapter result to SmartCharts Champion format
            if (params.granularity === 0) {
                // For ticks, return history format
                return {
                    history: {
                        prices: result.quotes.map(q => q.Close),
                        times: result.quotes.map(q => parseInt(q.Date)),
                    },
                };
            }
            // For candles, return candles format
            return {
                candles: result.quotes.map(q => ({
                    open: q.Open || q.Close,
                    high: q.High || q.Close,
                    low: q.Low || q.Close,
                    close: q.Close,
                    epoch: parseInt(q.Date),
                })),
            };
        },
        [smartChartsAdapter, isValidGranularity]
    );

    // Memoized subscribeQuotes function
    const subscribeQuotes = React.useCallback<TSubscribeQuotes>(
        (params, callback) => {
            if (!smartChartsAdapter) {
                return () => {};
            }

            const passthrough_callback = (...args: [any]) => {
                callback(...args);

                // Handle tick data for non-tick granularities
                if ('ohlc' in args[0] && granularity !== 0 && setTickData) {
                    const { close, pip_size } = args[0].ohlc as { close: string; pip_size: number };
                    if (close && pip_size) setTickData({ pip_size, quote: Number(close) });
                }

                // Handle accumulator barriers data
                if (is_accumulator && updateAccumulatorBarriersData) {
                    interface AccumulatorBarriersData {
                        current_spot?: number;
                        current_spot_time?: number;
                        tick_update_timestamp?: number;
                        accumulators_high_barrier?: string;
                        accumulators_low_barrier?: string;
                        barrier_spot_distance?: string;
                        previous_spot_time?: number;
                    }

                    let current_spot_data: AccumulatorBarriersData = {};

                    if ('tick' in args[0]) {
                        const { epoch, quote } = args[0].tick as any;
                        current_spot_data = {
                            current_spot: quote,
                            current_spot_time: epoch,
                        };
                    } else if ('history' in args[0]) {
                        const { prices, times } = args[0].history as any;
                        current_spot_data = {
                            current_spot: prices?.[prices?.length - 1],
                            current_spot_time: times?.[times?.length - 1],
                            previous_spot_time: times?.[times?.length - 2],
                        };
                    } else {
                        return;
                    }

                    updateAccumulatorBarriersData(current_spot_data);
                }
            };

            // Validate granularity with type guard
            const validatedGranularity = isValidGranularity(params.granularity) ? params.granularity : 0;

            return smartChartsAdapter.subscribeQuotes(
                {
                    symbol: params.symbol,
                    granularity: validatedGranularity,
                },
                quote => {
                    passthrough_callback(quote);
                }
            );
        },
        [
            smartChartsAdapter,
            granularity,
            is_accumulator,
            updateAccumulatorBarriersData,
            setTickData,
            isValidGranularity,
        ]
    );

    // Memoized unsubscribeQuotes function
    const unsubscribeQuotes = React.useCallback<TUnsubscribeQuotes>(
        request => {
            if (smartChartsAdapter) {
                // If we have request details, use the adapter's unsubscribe method
                if (request?.symbol && typeof request.granularity !== 'undefined') {
                    // Validate granularity with type guard
                    const validatedGranularity = isValidGranularity(request.granularity) ? request.granularity : 0;
                    smartChartsAdapter.unsubscribeQuotes({
                        symbol: request.symbol,
                        granularity: validatedGranularity,
                    });
                } else {
                    // Fallback: unsubscribe all via transport
                    smartChartsAdapter.transport.unsubscribeAll('ticks');
                }
            }
        },
        [smartChartsAdapter, isValidGranularity]
    );

    return {
        smartChartsAdapter,
        chartData,
        isLoading,
        error,
        getQuotes,
        subscribeQuotes,
        unsubscribeQuotes,
        retryFetchChartData,
        isValidGranularity,
    };
};

export default useSmartChartsAdapter;
