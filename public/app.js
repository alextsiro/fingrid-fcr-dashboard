const statusText = document.querySelector('#status-text');
const rangeText = document.querySelector('#range-text');
const tableBody = document.querySelector('#table-body');
const refreshButton = document.querySelector('#refresh-button');
const daysSelect = document.querySelector('#days-select');

const summaryEls = {
  fcrN: document.querySelector('#fcrn-latest'),
  fcrDUp: document.querySelector('#fcrdup-latest'),
  fcrDDown: document.querySelector('#fcrddown-latest'),
};

const colors = {
  fcrN: '#60a5fa',
  fcrDUp: '#34d399',
  fcrDDown: '#f59e0b',
};

let chart;
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
  tableBody.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${formatHour(row.startTime)}</td>
        <td>${formatValue(row.fcrN ?? NaN)}</td>
        <td>${formatValue(row.fcrDUp ?? NaN)}</td>
        <td>${formatValue(row.fcrDDown ?? NaN)}</td>
      </tr>
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

async function loadData() {
  const days = daysSelect.value;
  const generation = ++loadGeneration;

  statusText.textContent = 'Loading data from the server…';
  refreshButton.disabled = true;
  daysSelect.disabled = true;

  try {
    const response = await fetch(`/api/fcr-prices?days=${days}`, { cache: 'no-store' });
    const payload = await response.json();

    // Discard stale responses from an earlier selection
    if (generation !== loadGeneration) return;

    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }

    // Slice to the most-recent N points so the view always shows
    // the newest published prices for the chosen range.
    const limit = pointLimits[days];
    const series = limit
      ? {
          fcrN: payload.series.fcrN.slice(-limit),
          fcrDUp: payload.series.fcrDUp.slice(-limit),
          fcrDDown: payload.series.fcrDDown.slice(-limit),
        }
      : payload.series;

    updateCards(series);
    updateChart(series);
    updateTable(series);

    const first = series.fcrN[0] ?? series.fcrDUp[0] ?? series.fcrDDown[0];
    const last = series.fcrN.at(-1) ?? series.fcrDUp.at(-1) ?? series.fcrDDown.at(-1);
    const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    const label = days === '1' ? '1 day' : `${days} days`;
    rangeText.textContent = first ? `${label} · ${fmt(first.startTime)} – ${fmt(last.startTime)}` : label;
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
