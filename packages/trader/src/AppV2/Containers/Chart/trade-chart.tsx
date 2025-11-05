import React from 'react';

import { TActiveSymbolsResponse, TTicksStreamResponse } from '@deriv/api';
import {
    ChartBarrierStore,
    isAccumulatorContract,
    isContractSupportedAndStarted,
    isTurbosContract,
    isVanillaContract,
    TRADE_TYPES,
} from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';

import { filterByContractType } from 'App/Components/Elements/PositionsDrawer/helpers';
import useActiveSymbols from 'AppV2/Hooks/useActiveSymbols';
import useDefaultSymbol from 'AppV2/Hooks/useDefaultSymbol';
import { SmartChart } from 'Modules/SmartChart';
import AccumulatorsChartElements from 'Modules/SmartChart/Components/Markers/accumulators-chart-elements';
import ToolbarWidgets from 'Modules/SmartChart/Components/toolbar-widgets';
import { useSmartChartsAdapter } from 'Modules/SmartChart/Hooks/useSmartChartsAdapter';
import { CHART_CONSTANTS, getMarketsOrder } from 'Modules/SmartChart/Utils/chart-utils';
import { useTraderStore } from 'Stores/useTraderStores';

type TickSpotData = NonNullable<TTicksStreamResponse['tick']>;

type TBottomWidgetsParams = {
    digits: number[];
    tick: TickSpotData | null;
};

const BottomWidgetsMobile = observer(({ digits, tick }: TBottomWidgetsParams) => {
    const { setDigitStats, setTickData } = useTraderStore();

    // Using bottom widgets in V2 to get tick data for all trade types and to get digit stats for Digit trade types
    React.useEffect(() => {
        setTickData(tick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tick]);

    React.useEffect(() => {
        setDigitStats(digits);
        // For digits array, which is coming from SmartChart, reference is not always changing.
        // As it is the same, this useEffect was not triggered on every array update.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [digits.join('-')]);

    // render no bottom widgets on chart
    return null;
});

const TradeChart = observer(() => {
    const { ui, common, contract_trade, portfolio } = useStore();
    const { isMobile } = useDevice();
    const {
        accumulator_barriers_data,
        accumulator_contract_barriers_data,
        chart_type,
        granularity,
        has_crossed_accu_barriers,
        markers_array,
        updateChartType,
        updateGranularity,
        updateAccumulatorBarriersData,
    } = contract_trade;
    const ref = React.useRef<{ hasPredictionIndicators(): void; triggerPopup(arg: () => void): void }>(null);
    const { all_positions, removePositionById: onClickRemove } = portfolio;
    const { is_chart_countdown_visible, is_chart_layout_default, is_dark_mode_on, is_positions_drawer_on } = ui;
    const { current_language, is_socket_opened } = common;
    const { activeSymbols: active_symbols } = useActiveSymbols();
    const { symbol } = useDefaultSymbol();
    const {
        barriers_flattened: extra_barriers,
        chartStateChange,
        chart_layout,
        contract_type,
        exportLayout,
        has_alternative_source,
        has_barrier,
        main_barrier_flattened: main_barrier,
        setChartStatus,
        show_digits_stats,
        onChange,
        setTickData,
        prev_contract_type,
    } = useTraderStore();
    const is_accumulator = isAccumulatorContract(contract_type);
    const settings = {
        countdown: is_chart_countdown_visible,
        isHighestLowestMarkerEnabled: false, // TODO: Pending UI,
        language: current_language.toLowerCase(),
        position: is_chart_layout_default ? 'bottom' : 'left',
        theme: is_dark_mode_on ? 'dark' : 'light',
        ...(is_accumulator
            ? {
                  whitespace: CHART_CONSTANTS.ACCUMULATOR_WHITESPACE,
                  minimumLeftBars: isMobile ? CHART_CONSTANTS.ACCUMULATOR_MIN_LEFT_BARS_MOBILE : undefined,
              }
            : {}),
        ...(has_barrier ? { whitespace: CHART_CONSTANTS.BARRIER_WHITESPACE } : {}),
    };

    const { current_spot, current_spot_time } = accumulator_barriers_data || {};

    // Use centralized SmartCharts adapter hook
    const { chartData, isLoading, error, getQuotes, subscribeQuotes, unsubscribeQuotes, retryFetchChartData } =
        useSmartChartsAdapter({
            debug: false,
            activeSymbols: active_symbols,
            is_accumulator,
            updateAccumulatorBarriersData,
            setTickData,
        });

    React.useEffect(() => {
        if ((is_accumulator || show_digits_stats) && ref.current?.hasPredictionIndicators()) {
            const cancelCallback = () => onChange({ target: { name: 'contract_type', value: prev_contract_type } });
            ref.current?.triggerPopup(cancelCallback);
        }
    }, [is_accumulator, onChange, prev_contract_type, show_digits_stats]);

    const barriers: ChartBarrierStore[] = main_barrier ? [main_barrier, ...extra_barriers] : extra_barriers;

    // max ticks to display for mobile view for tick chart
    const max_ticks =
        granularity === 0 ? CHART_CONSTANTS.MAX_TICKS_MOBILE_TICK : CHART_CONSTANTS.MAX_TICKS_MOBILE_CANDLE;

    // Filter positions based on current symbol and contract type
    const filtered_positions = all_positions.filter(
        p =>
            isContractSupportedAndStarted(symbol, p.contract_info) &&
            (isTurbosContract(contract_type) || isVanillaContract(contract_type)
                ? filterByContractType(
                      p.contract_info,
                      isTurbosContract(contract_type) ? TRADE_TYPES.TURBOS.SHORT : TRADE_TYPES.VANILLA.CALL
                  ) ||
                  filterByContractType(
                      p.contract_info,
                      isTurbosContract(contract_type) ? TRADE_TYPES.TURBOS.LONG : TRADE_TYPES.VANILLA.PUT
                  )
                : filterByContractType(p.contract_info, contract_type))
    );

    // Get IDs of closed positions to auto-remove
    const closed_positions_ids =
        filtered_positions &&
        filtered_positions.filter(position => position.contract_info?.is_sold).map(p => p.contract_info.contract_id);

    // Automatically remove closed positions after 8 seconds
    React.useEffect(() => {
        const timeouts: NodeJS.Timeout[] = [];

        closed_positions_ids.forEach(positionId => {
            const timeout = setTimeout(() => {
                onClickRemove(positionId);
            }, CHART_CONSTANTS.CLOSED_POSITION_REMOVE_TIMEOUT);
            timeouts.push(timeout);
        });

        return () => {
            timeouts.forEach(timeout => clearTimeout(timeout));
        };
    }, [closed_positions_ids, onClickRemove]);

    if (!symbol || !active_symbols.length) return null;

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <div>Loading chart data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '400px',
                    gap: '16px',
                }}
            >
                <div>Error loading chart data: {error.message}</div>
                <button onClick={retryFetchChartData} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                    Retry
                </button>
            </div>
        );
    }

    if (!chartData || !chartData.tradingTimes) return null;

    return (
        <SmartChart
            drawingToolFloatingMenuPosition={
                isMobile ? CHART_CONSTANTS.MOBILE_DRAWING_TOOL_POSITION : CHART_CONSTANTS.DESKTOP_DRAWING_TOOL_POSITION
            }
            ref={ref}
            barriers={barriers}
            contracts_array={markers_array}
            bottomWidgets={BottomWidgetsMobile}
            showLastDigitStats
            chartControlsWidgets={null}
            chartStatusListener={(v: boolean) => setChartStatus(!v, true)}
            chartType={chart_type}
            chartData={chartData}
            getQuotes={getQuotes}
            subscribeQuotes={subscribeQuotes}
            unsubscribeQuotes={unsubscribeQuotes}
            enabledNavigationWidget={!isMobile}
            enabledChartFooter={false}
            id='trade'
            isMobile={isMobile}
            isVerticalScrollEnabled={false}
            maxTick={isMobile ? max_ticks : undefined}
            granularity={show_digits_stats || is_accumulator ? 0 : granularity}
            settings={settings}
            allowTickChartTypeOnly={show_digits_stats || is_accumulator}
            stateChangeListener={chartStateChange}
            symbol={symbol}
            topWidgets={() => <div /> /* to hide the original chart market dropdown */}
            isConnectionOpened={is_socket_opened}
            clearChart={false}
            toolbarWidget={() => {
                return <ToolbarWidgets updateChartType={updateChartType} updateGranularity={updateGranularity} />;
            }}
            importedLayout={chart_layout}
            onExportLayout={exportLayout}
            shouldFetchTradingTimes={false}
            hasAlternativeSource={has_alternative_source}
            getMarketsOrder={getMarketsOrder}
            should_zoom_out_on_yaxis={is_accumulator}
            yAxisMargin={{
                top: isMobile ? CHART_CONSTANTS.Y_AXIS_MARGIN_MOBILE : CHART_CONSTANTS.Y_AXIS_MARGIN_DESKTOP,
            }}
            isLive
            leftMargin={
                !isMobile && is_positions_drawer_on
                    ? CHART_CONSTANTS.LEFT_MARGIN_WITH_DRAWER
                    : CHART_CONSTANTS.LEFT_MARGIN_DEFAULT
            }
        >
            {is_accumulator && (
                <AccumulatorsChartElements
                    all_positions={all_positions}
                    current_spot={current_spot}
                    current_spot_time={current_spot_time}
                    has_crossed_accu_barriers={has_crossed_accu_barriers}
                    should_show_profit_text={!!accumulator_contract_barriers_data.accumulators_high_barrier}
                    symbol={symbol}
                    is_mobile={isMobile}
                />
            )}
        </SmartChart>
    );
});
export default TradeChart;
