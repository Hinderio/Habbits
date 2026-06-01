(function enhanceDashboardChartColors(window, document) {
  'use strict';

  const Chart = window.Chart;
  if (!Chart || Chart.registry?.plugins?.get?.('habitflow-solid-dashboard-fills')) return;

  const POSITIVE = '#64D0CB';
  const NEGATIVE = '#FB9953';
  const DASHBOARD_CHART_IDS = new Set(['trendChart', 'pointsChart']);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function chartId(chart) {
    return chart?.canvas?.id || '';
  }

  function selectedTrendMetric() {
    return document.getElementById('trendMetricSelect')?.value || '';
  }

  function isLowerBetterTrend(chart) {
    if (chartId(chart) !== 'trendChart') return false;
    const metric = selectedTrendMetric();
    return metric === 'cigarettes' || metric === 'alcohol';
  }

  function numericValue(raw) {
    if (raw && typeof raw === 'object') return Number(raw.y ?? raw.value ?? 0) || 0;
    return Number(raw || 0) || 0;
  }

  function pointTone(chart, value) {
    if (isLowerBetterTrend(chart)) return NEGATIVE;
    if (chartId(chart) === 'pointsChart' || selectedTrendMetric() === 'points') return value < 0 ? NEGATIVE : POSITIVE;
    return POSITIVE;
  }

  function datasetValues(dataset) {
    return (dataset?.data || []).map(numericValue);
  }

  function zeroBaseline(chart, meta) {
    const area = chart.chartArea;
    const yScale = meta?.yScale || chart.scales?.y;
    if (!area || !yScale?.getPixelForValue) return area?.bottom || 0;
    return clamp(yScale.getPixelForValue(0), area.top, area.bottom);
  }

  function fillPolygon(ctx, points, color) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function fillSolidTrendArea(chart, meta, values) {
    const area = chart.chartArea;
    const points = meta?.data || [];
    if (!area || points.length < 2) return;
    const baseY = zeroBaseline(chart, meta);
    const color = isLowerBetterTrend(chart) ? NEGATIVE : POSITIVE;
    const polygon = [
      { x: points[0].x, y: baseY },
      ...points.map(point => ({ x: point.x, y: point.y })),
      { x: points[points.length - 1].x, y: baseY }
    ];
    fillPolygon(chart.ctx, polygon, color);
  }

  function fillSolidSignedArea(chart, meta, values) {
    const area = chart.chartArea;
    const points = meta?.data || [];
    if (!area || points.length < 2) return;
    const baseY = zeroBaseline(chart, meta);
    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index];
      const right = points[index + 1];
      const leftValue = values[index] || 0;
      const rightValue = values[index + 1] || 0;
      if (!Number.isFinite(left.x + left.y + right.x + right.y)) continue;

      if ((leftValue >= 0 && rightValue >= 0) || (leftValue < 0 && rightValue < 0)) {
        const color = leftValue < 0 && rightValue < 0 ? NEGATIVE : POSITIVE;
        fillPolygon(chart.ctx, [
          { x: left.x, y: baseY },
          { x: left.x, y: left.y },
          { x: right.x, y: right.y },
          { x: right.x, y: baseY }
        ], color);
        continue;
      }

      const total = Math.abs(leftValue) + Math.abs(rightValue);
      const t = total ? Math.abs(leftValue) / total : 0.5;
      const crossX = left.x + (right.x - left.x) * t;
      const crossing = { x: crossX, y: baseY };
      const leftColor = leftValue < 0 ? NEGATIVE : POSITIVE;
      const rightColor = rightValue < 0 ? NEGATIVE : POSITIVE;
      fillPolygon(chart.ctx, [
        { x: left.x, y: baseY },
        { x: left.x, y: left.y },
        crossing
      ], leftColor);
      fillPolygon(chart.ctx, [
        crossing,
        { x: right.x, y: right.y },
        { x: right.x, y: baseY }
      ], rightColor);
    }
  }

  function applyDashboardDatasetStyle(chart) {
    if (!DASHBOARD_CHART_IDS.has(chartId(chart))) return;
    chart.data.datasets.forEach(dataset => {
      dataset.fill = false;
      dataset.backgroundColor = 'transparent';
      dataset.pointBorderColor = '#ffffff';
      dataset.pointBackgroundColor = context => pointTone(chart, numericValue(context.raw));
      dataset.borderColor = context => pointTone(chart, numericValue(context.raw));
      dataset.segment = {
        ...(dataset.segment || {}),
        borderColor: context => {
          const startValue = Number(context?.p0?.parsed?.y || 0);
          const endValue = Number(context?.p1?.parsed?.y || 0);
          if (isLowerBetterTrend(chart)) return NEGATIVE;
          if (chartId(chart) === 'pointsChart' || selectedTrendMetric() === 'points') return startValue < 0 || endValue < 0 ? NEGATIVE : POSITIVE;
          return POSITIVE;
        }
      };
    });
  }

  const plugin = {
    id: 'habitflow-solid-dashboard-fills',
    beforeUpdate(chart) {
      applyDashboardDatasetStyle(chart);
    },
    beforeDatasetsDraw(chart) {
      if (!DASHBOARD_CHART_IDS.has(chartId(chart))) return;
      const area = chart.chartArea;
      if (!area) return;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      const values = datasetValues(dataset);
      const ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
      ctx.clip();
      ctx.globalCompositeOperation = 'destination-over';
      if (chartId(chart) === 'pointsChart' || selectedTrendMetric() === 'points') fillSolidSignedArea(chart, meta, values);
      else fillSolidTrendArea(chart, meta, values);
      ctx.restore();
    }
  };

  Chart.register(plugin);
})(window, document);
