const statusText = document.querySelector('#status-text');
const rangeText = document.querySelector('#range-text');
const tableBody = document.querySelector('#table-body');
const refreshButton = document.querySelector('#refresh-button');
const daysSelect = document.querySelector('#days-select');

const latestEls = {
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

function formatValue(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(2)} €/MW,h`;
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

function getLatestPoint(series) {
  return Array.isArray(series) && series.length > 0 ? series[series.length - 1] : null;
}

function updateCards(series) {
  latestEls.fcrN.textContent = formatValue(getLatestPoint(series.fcrN)?.value ?? NaN);
  latestEls.fcrDUp.textContent = formatValue(getLatestPoint(series.fcrDUp)?.value ?? NaN);
  latestEls.fcrDDown.textContent = formatValue(getLatestPoint(series.fcrDDown)?.value ?? NaN);
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
  statusText.textContent = 'Loading data from the server…';
  refreshButton.disabled = true;

  try {
    const response = await fetch(`/api/fcr-prices?days=${days}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }

    updateCards(payload.series);
    updateChart(payload.series);
    updateTable(payload.series);

    rangeText.textContent = `${payload.range.days} days`;
    statusText.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    statusText.textContent = error.message;
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', loadData);
daysSelect.addEventListener('change', loadData);

loadData();
