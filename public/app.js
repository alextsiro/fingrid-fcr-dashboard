const statusText = document.querySelector('#status-text');
const rangeText = document.querySelector('#range-text');
const recentHoursList = document.querySelector('#recent-hours-list');
const recentHoursSummary = document.querySelector('#recent-hours-summary');
const mfrrRangeText = document.querySelector('#mfrr-range-text');
const mfrrRecentHoursList = document.querySelector('#mfrr-recent-hours-list');
const mfrrRecentHoursSummary = document.querySelector('#mfrr-recent-hours-summary');
const refreshButton = document.querySelector('#refresh-button');
const daysSelect = document.querySelector('#days-select');

const summaryEls = {
  fcrN: document.querySelector('#fcrn-latest'),
  fcrDUp: document.querySelector('#fcrdup-latest'),
  fcrDDown: document.querySelector('#fcrddown-latest'),
};

const mfrrSummaryEls = {
  upPrice: document.querySelector('#mfrr-up-average'),
  downPrice: document.querySelector('#mfrr-down-average'),
};

const colors = {
  fcrN: '#60a5fa',
  fcrDUp: '#34d399',
  fcrDDown: '#f59e0b',
  mfrrUpPrice: '#a855f7',
  mfrrDownPrice: '#2dd4bf',
};

let chart;
let mfrrChart;
let loadGeneration = 0;

// How many hourly points to display per range selection.
// Data is pre-published each evening at 21:00 for the next day,
// so the server extends its query window forward by 30 h to capture those.
const pointLimits = { '1': 24, '3': 72 }; // '7' has no hard limit – show everything

function formatValue(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(2)} €/MW`;
}

function formatHour(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatRangeText(series, days) {
  const first = series[0];
  const last = series.at(-1);
  const label = days === '1' ? '1 day' : `${days} days`;

  if (!first || !last) return label;

  const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  return `${label} · ${fmt(first.startTime)} – ${fmt(last.startTime)}`;
}

function getAverageValue(points) {
  if (!Array.isArray(points) || points.length === 0) return NaN;

  const values = points
    .map((point) => Number(point.value))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return NaN;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function updateCards(series) {
  summaryEls.fcrN.textContent = formatValue(getAverageValue(series.fcrN));
  summaryEls.fcrDUp.textContent = formatValue(getAverageValue(series.fcrDUp));
  summaryEls.fcrDDown.textContent = formatValue(getAverageValue(series.fcrDDown));
}

function updateMfrrCards(series) {
  mfrrSummaryEls.upPrice.textContent = formatValue(getAverageValue(series.upPrice));
  mfrrSummaryEls.downPrice.textContent = formatValue(getAverageValue(series.downPrice));
}

function buildMfrrRows(series) {
  const map = new Map();

  [['upPrice', series.upPrice], ['downPrice', series.downPrice]].forEach(([key, points]) => {
    points.forEach((point) => {
      const row = map.get(point.startTime) || { startTime: point.startTime };
      row[key] = point.value;
      map.set(point.startTime, row);
    });
  });

  return [...map.values()]
    .sort((left, right) => new Date(right.startTime) - new Date(left.startTime))
    .slice(0, 24);
}

function updateMfrrRecentHours(series) {
  const rows = buildMfrrRows(series);
  mfrrRecentHoursSummary.textContent = `Recent hours (${rows.length})`;
  mfrrRecentHoursList.innerHTML = rows
    .map((row) => `
      <li class="recent-hours-item">
        <span class="hour">${formatHour(row.startTime)}</span>
        <span class="value">mFRR CM up: ${formatValue(row.upPrice ?? NaN)}</span>
        <span class="value">mFRR CM down: ${formatValue(row.downPrice ?? NaN)}</span>
      </li>
    `)
    .join('');
}

function buildMergedRows(series) {
  const map = new Map();

  [['fcrN', series.fcrN], ['fcrDUp', series.fcrDUp], ['fcrDDown', series.fcrDDown]].forEach(([key, points]) => {
    points.forEach((point) => {
      const row = map.get(point.startTime) || { startTime: point.startTime };
      row[key] = point.value;
      map.set(point.startTime, row);
    });
  });

  return [...map.values()]
    .sort((left, right) => new Date(right.startTime) - new Date(left.startTime))
    .slice(0, 24);
}

function updateTable(series) {
  const rows = buildMergedRows(series);
  recentHoursSummary.textContent = `Recent hours (${rows.length})`;
  recentHoursList.innerHTML = rows
    .map((row) => `
      <li class="recent-hours-item">
        <span class="hour">${formatHour(row.startTime)}</span>
        <span class="value">FCR-N: ${formatValue(row.fcrN ?? NaN)}</span>
        <span class="value">FCR-D up: ${formatValue(row.fcrDUp ?? NaN)}</span>
        <span class="value">FCR-D down: ${formatValue(row.fcrDDown ?? NaN)}</span>
      </li>
    `)
    .join('');
}

function updateChart(series) {
  const labels = series.fcrN.map((point) => formatHour(point.startTime));
  const datasets = [
    { key: 'fcrN', label: 'FCR-N' },
    { key: 'fcrDUp', label: 'FCR-D up' },
    { key: 'fcrDDown', label: 'FCR-D down' },
  ].map(({ key, label }) => ({
    label,
    data: series[key].map((point) => point.value),
    borderColor: colors[key],
    backgroundColor: `${colors[key]}33`,
    tension: 0.25,
    borderWidth: 2,
    fill: false,
    pointRadius: 0,
  }));

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.update();
    return;
  }

  const context = document.querySelector('#price-chart');
  chart = new Chart(context, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#e5eefb' },
        },
      },
      scales: {
        x: {
          ticks: { color: '#a7b4c9', maxTicksLimit: 8 },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y: {
          ticks: { color: '#a7b4c9' },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
      },
    },
  });
}

function updateMfrrChart(series) {
  const labelSource = series.upPrice.length > 0 ? series.upPrice : series.downPrice;
  const labels = labelSource.map((point) => formatHour(point.startTime));
  const datasets = [
    { key: 'upPrice', label: 'mFRR CM up price', color: colors.mfrrUpPrice },
    { key: 'downPrice', label: 'mFRR CM down price', color: colors.mfrrDownPrice },
  ].map(({ key, label, color }) => ({
    label,
    data: series[key].map((point) => point.value),
    borderColor: color,
    backgroundColor: `${color}33`,
    tension: 0.25,
    borderWidth: 2,
    fill: false,
    pointRadius: 0,
  }));

  if (mfrrChart) {
    mfrrChart.data.labels = labels;
    mfrrChart.data.datasets = datasets;
    mfrrChart.update();
    return;
  }

  const context = document.querySelector('#mfrr-price-chart');
  mfrrChart = new Chart(context, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#e5eefb' },
        },
      },
      scales: {
        x: {
          ticks: { color: '#a7b4c9', maxTicksLimit: 8 },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y: {
          ticks: { color: '#a7b4c9' },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
      },
    },
  });
}

async function loadData() {
  const days = daysSelect.value;
  const generation = ++loadGeneration;

  statusText.textContent = 'Loading data from the server…';
  refreshButton.disabled = true;
  daysSelect.disabled = true;

  try {
    const [fcrResponse, mfrrResponse] = await Promise.all([
      fetch(`/api/fcr-prices?days=${days}`, { cache: 'no-store' }),
      fetch(`/api/mfrr-cm-prices?days=${days}`, { cache: 'no-store' }),
    ]);

    const [fcrPayload, mfrrPayload] = await Promise.all([
      fcrResponse.json(),
      mfrrResponse.json(),
    ]);

    // Discard stale responses from an earlier selection
    if (generation !== loadGeneration) return;

    if (!fcrResponse.ok || !mfrrResponse.ok) {
      throw new Error(fcrPayload.error || mfrrPayload.error || 'Request failed');
    }

    // Slice to the most-recent N points so the view always shows
    // the newest published prices for the chosen range.
    const limit = pointLimits[days];
    const fcrSeries = limit
      ? {
          fcrN: fcrPayload.series.fcrN.slice(-limit),
          fcrDUp: fcrPayload.series.fcrDUp.slice(-limit),
          fcrDDown: fcrPayload.series.fcrDDown.slice(-limit),
        }
      : fcrPayload.series;

    const mfrrSeries = limit
      ? {
          upPrice: mfrrPayload.series.upPrice.slice(-limit),
          downPrice: mfrrPayload.series.downPrice.slice(-limit),
        }
      : mfrrPayload.series;

    updateCards(fcrSeries);
    updateChart(fcrSeries);
    updateTable(fcrSeries);

    updateMfrrCards(mfrrSeries);
    updateMfrrChart(mfrrSeries);
    updateMfrrRecentHours(mfrrSeries);

    rangeText.textContent = formatRangeText(
      fcrSeries.fcrN.length > 0 ? fcrSeries.fcrN : (fcrSeries.fcrDUp.length > 0 ? fcrSeries.fcrDUp : fcrSeries.fcrDDown),
      days,
    );
    mfrrRangeText.textContent = formatRangeText(
      mfrrSeries.upPrice.length > 0 ? mfrrSeries.upPrice : mfrrSeries.downPrice,
      days,
    );
    statusText.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    if (generation === loadGeneration) statusText.textContent = error.message;
  } finally {
    if (generation === loadGeneration) {
      refreshButton.disabled = false;
      daysSelect.disabled = false;
    }
  }
}

refreshButton.addEventListener('click', loadData);
daysSelect.addEventListener('change', loadData);

loadData();
