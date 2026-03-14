import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const fingridApiKey = process.env.FINGRID_API_KEY;
const fingridBaseUrl = 'https://data.fingrid.fi/api';

const datasetNames = {
  fcrN: 'Frequency Containment Reserve for Normal operation, hourly market prices',
  fcrDUp: 'Frequency Containment Reserve for Disturbances upwards regulation, hourly market prices',
  fcrDDown: 'Frequency Containment Reserve for Disturbances downwards regulation, hourly market prices',
  mfrrCmUpPrice: 'Balancing Capacity Market (mFRR), up, hourly market, price',
  mfrrCmDownPrice: 'Balancing Capacity (mFRR), down, hourly market, price',
};

let fcrDatasetIdCache = null;
let mfrrDatasetIdCache = null;
const responseCache = new Map();
const inFlightResponses = new Map();
const cacheTtlMs = 2 * 60 * 1000;

app.use(express.static(path.join(__dirname, 'public')));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(response, body, attempt) {
  const retryAfterHeader = response.headers.get('retry-after');
  const retryAfterSeconds = Number(retryAfterHeader);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  const match = typeof body === 'string' ? body.match(/Try again in (\d+) seconds?/i) : null;
  if (match) {
    return Number(match[1]) * 1000;
  }

  return (attempt + 1) * 2000;
}

function getCachedValue(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    responseCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedValue(cacheKey, value) {
  responseCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + cacheTtlMs,
  });
}

function assertApiKey() {
  if (!fingridApiKey) {
    const error = new Error('Missing FINGRID_API_KEY. Copy .env.example to .env and add your key.');
    error.statusCode = 500;
    throw error;
  }
}

async function fetchFingridJson(endpoint, query = {}) {
  assertApiKey();

  const url = new URL(`${fingridBaseUrl}${endpoint}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const cacheKey = url.toString();
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  if (inFlightResponses.has(cacheKey)) {
    return inFlightResponses.get(cacheKey);
  }

  const requestPromise = (async () => {
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, {
        headers: {
          'x-api-key': fingridApiKey,
          accept: 'application/json',
        },
      });

      if (response.ok) {
        const payload = await response.json();
        setCachedValue(cacheKey, payload);
        return payload;
      }

      const body = await response.text();
      lastError = new Error(`Fingrid API request failed (${response.status}): ${body}`);
      lastError.statusCode = response.status;

      if (response.status !== 429 || attempt === 2) {
        throw lastError;
      }

      await sleep(getRetryDelayMs(response, body, attempt));
    }

    throw lastError;
  })();

  inFlightResponses.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightResponses.delete(cacheKey);
  }
}

function getCollection(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.datasets)) return payload.datasets;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.results)) return payload.results;
  }

  return [];
}

function normalizePoint(item) {
  const startTime = item.startTime || item.start_time || item.timestamp || item.periodStart || item.from;
  const endTime = item.endTime || item.end_time || item.periodEnd || item.to || null;
  const value = Number(item.value ?? item.amount ?? item.price ?? item.quantity ?? item.Value);

  return {
    startTime,
    endTime,
    value,
    unit: item.unit || item.Unit || '€/MW,h',
  };
}

async function resolveDatasetIds() {
  if (fcrDatasetIdCache) {
    return fcrDatasetIdCache;
  }

  const configuredIds = {
    fcrN: process.env.FINGRID_DATASET_FCR_N,
    fcrDUp: process.env.FINGRID_DATASET_FCR_D_UP,
    fcrDDown: process.env.FINGRID_DATASET_FCR_D_DOWN,
  };

  if (configuredIds.fcrN && configuredIds.fcrDUp && configuredIds.fcrDDown) {
    fcrDatasetIdCache = configuredIds;
    return fcrDatasetIdCache;
  }

  const payload = await fetchFingridJson('/datasets');
  const datasets = getCollection(payload);

  const findIdByName = (targetName) => {
    const match = datasets.find((item) => {
      const candidates = [item?.name, item?.title, item?.datasetName, item?.label, item?.nameEn, item?.nameFi]
        .filter(Boolean)
        .map((value) => String(value).trim());

      return candidates.includes(targetName);
    });

    return match?.id || match?.datasetId || match?.identifier || null;
  };

  fcrDatasetIdCache = {
    fcrN: configuredIds.fcrN || findIdByName(datasetNames.fcrN),
    fcrDUp: configuredIds.fcrDUp || findIdByName(datasetNames.fcrDUp),
    fcrDDown: configuredIds.fcrDDown || findIdByName(datasetNames.fcrDDown),
  };

  const unresolved = Object.entries(fcrDatasetIdCache)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (unresolved.length > 0) {
    const error = new Error(`Could not resolve dataset IDs for: ${unresolved.join(', ')}. Set them in .env if Fingrid changes the metadata shape.`);
    error.statusCode = 500;
    throw error;
  }

  return fcrDatasetIdCache;
}

async function resolveMfrrCmDatasetIds() {
  if (mfrrDatasetIdCache) {
    return mfrrDatasetIdCache;
  }

  const configuredIds = {
    mfrrCmUpPrice: process.env.FINGRID_DATASET_MFRR_CM_UP_PRICE,
    mfrrCmDownPrice: process.env.FINGRID_DATASET_MFRR_CM_DOWN_PRICE,
  };

  if (configuredIds.mfrrCmUpPrice && configuredIds.mfrrCmDownPrice) {
    mfrrDatasetIdCache = configuredIds;
    return mfrrDatasetIdCache;
  }

  const payload = await fetchFingridJson('/datasets', { pageSize: 5000 });
  const datasets = getCollection(payload);

  const findIdByName = (targetName) => {
    const match = datasets.find((item) => {
      const candidates = [item?.name, item?.title, item?.datasetName, item?.label, item?.nameEn, item?.nameFi]
        .filter(Boolean)
        .map((value) => String(value).trim());

      return candidates.includes(targetName);
    });

    return match?.id || match?.datasetId || match?.identifier || null;
  };

  mfrrDatasetIdCache = {
    mfrrCmUpPrice: configuredIds.mfrrCmUpPrice || findIdByName(datasetNames.mfrrCmUpPrice),
    mfrrCmDownPrice: configuredIds.mfrrCmDownPrice || findIdByName(datasetNames.mfrrCmDownPrice),
  };

  const unresolved = Object.entries(mfrrDatasetIdCache)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (unresolved.length > 0) {
    const error = new Error(`Could not resolve mFRR CM dataset IDs for: ${unresolved.join(', ')}. Set FINGRID_DATASET_MFRR_CM_UP_PRICE and FINGRID_DATASET_MFRR_CM_DOWN_PRICE in .env.`);
    error.statusCode = 500;
    throw error;
  }

  return mfrrDatasetIdCache;
}

async function fetchSeries(datasetId, startTime, endTime) {
  const payload = await fetchFingridJson(`/datasets/${datasetId}/data`, {
    startTime,
    endTime,
    pageSize: 10000,
    oneRowPerTimePeriod: false,
  });

  return getCollection(payload)
    .map(normalizePoint)
    .filter((item) => item.startTime && Number.isFinite(item.value))
    .sort((left, right) => new Date(left.startTime) - new Date(right.startTime));
}

function getIsoRange(days) {
  const now = new Date();
  // Extend end by 30 h so pre-published prices (released each evening at 21:00
  // for the following day) are always included in the response.
  const end = new Date(now.getTime() + 30 * 60 * 60 * 1000);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/fcr-prices', async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');

  try {
    const requestedDays = Number(request.query.days || 1);
    const days = Number.isFinite(requestedDays) && requestedDays > 0 && requestedDays <= 31 ? requestedDays : 1;
    const requestCacheKey = `fcr-prices:${days}`;
    const cachedResponse = getCachedValue(requestCacheKey);

    if (cachedResponse) {
      response.json(cachedResponse);
      return;
    }

    const { startTime, endTime } = getIsoRange(days);
    const datasetIds = await resolveDatasetIds();

    const fcrN = await fetchSeries(datasetIds.fcrN, startTime, endTime);
    const fcrDUp = await fetchSeries(datasetIds.fcrDUp, startTime, endTime);
    const fcrDDown = await fetchSeries(datasetIds.fcrDDown, startTime, endTime);

    const payload = {
      range: { startTime, endTime, days },
      datasetIds,
      series: { fcrN, fcrDUp, fcrDDown },
    };

    setCachedValue(requestCacheKey, payload);
    response.json(payload);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message || 'Unknown server error',
    });
  }
});

app.get('/api/mfrr-cm-prices', async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');

  try {
    const requestedDays = Number(request.query.days || 1);
    const days = Number.isFinite(requestedDays) && requestedDays > 0 && requestedDays <= 31 ? requestedDays : 1;
    const requestCacheKey = `mfrr-cm-prices:${days}`;
    const cachedResponse = getCachedValue(requestCacheKey);

    if (cachedResponse) {
      response.json(cachedResponse);
      return;
    }

    const { startTime, endTime } = getIsoRange(days);
    const datasetIds = await resolveMfrrCmDatasetIds();

    const upPrice = await fetchSeries(datasetIds.mfrrCmUpPrice, startTime, endTime);
    const downPrice = await fetchSeries(datasetIds.mfrrCmDownPrice, startTime, endTime);

    const payload = {
      range: { startTime, endTime, days },
      datasetIds,
      series: { upPrice, downPrice },
    };

    setCachedValue(requestCacheKey, payload);
    response.json(payload);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message || 'Unknown server error',
    });
  }
});

app.listen(port, () => {
  console.log(`Fingrid dashboard running at http://localhost:${port}`);
});
