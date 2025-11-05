import React from 'react';

import { TActiveSymbolsResponse } from '@deriv/api';
import { ChartBarrierStore } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { useDevice } from '@deriv-com/ui';

import { SmartChart } from 'Modules/SmartChart';
import { useSmartChartsAdapter } from 'Modules/SmartChart/Hooks/useSmartChartsAdapter';
import { CHART_CONSTANTS, getMarketsOrder } from 'Modules/SmartChart/Utils/chart-utils';
import { useTraderStore } from 'Stores/useTraderStores';

import AccumulatorsChartElements from '../../SmartChart/Components/Markers/accumulators-chart-elements';
import ToolbarWidgets from '../../SmartChart/Components/toolbar-widgets';

import { ChartBottomWidgets } from './chart-widgets';
import type { TBottomWidgetsParams } from './trade';

type TTradeChartProps = {
    bottomWidgets?: (props: TBottomWidgetsParams) => React.ReactElement;
    has_barrier?: boolean;
    is_accumulator: boolean;
    topWidgets: (() => JSX.Element) | null | undefined;
    children?: React.ReactNode;
};

const TradeChart = observer((props: TTradeChartProps) => {
    const { has_barrier, is_accumulator, topWidgets } = props;
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
    const { all_positions } = portfolio;
    const { is_chart_countdown_visible, is_chart_layout_default, is_dark_mode_on, is_positions_drawer_on } = ui;
    const { current_language, is_socket_opened } = common;
    const {
        active_symbols,
        barriers_flattened: extra_barriers,
        chartStateChange,
        chart_layout,
        exportLayout,
        has_alternative_source,
        is_trade_enabled,
        main_barrier_flattened: main_barrier,
        setChartStatus,
        show_digits_stats,
        symbol,
        onChange,
        setTickData,
        prev_contract_type,
    } = useTraderStore();

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

    const bottomWidgets = React.useCallback(
        ({ digits, tick }: TBottomWidgetsParams) => (
            <ChartBottomWidgets digits={digits} tick={tick} show_accumulators_stats={is_accumulator} />
        ),
        [is_accumulator]
    );

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
            id='trade'
            ref={ref}
            barriers={barriers}
            showLastDigitStats={show_digits_stats}
            chartControlsWidgets={null}
            stateChangeListener={chartStateChange}
            enabledChartFooter={false}
            toolbarWidget={() => {
                return <ToolbarWidgets updateChartType={updateChartType} updateGranularity={updateGranularity} />;
            }}
            chartType={chart_type}
            chartData={chartData}
            isMobile={isMobile}
            getQuotes={getQuotes}
            subscribeQuotes={subscribeQuotes}
            unsubscribeQuotes={unsubscribeQuotes}
            granularity={show_digits_stats || is_accumulator ? 0 : granularity}
            bottomWidgets={(is_accumulator || show_digits_stats) && !isMobile ? bottomWidgets : props.bottomWidgets}
            contracts_array={markers_array}
            chartStatusListener={(v: boolean) => setChartStatus(false, true)}
            enabledNavigationWidget={!isMobile}
            maxTick={isMobile ? max_ticks : undefined}
            settings={settings}
            allowTickChartTypeOnly={show_digits_stats || is_accumulator}
            symbol={symbol}
            topWidgets={is_trade_enabled ? topWidgets : null}
            isConnectionOpened={is_socket_opened}
            clearChart={false}
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
