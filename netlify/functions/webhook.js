/**
 * VNPAY Webhook Handler
 * Receives payment callbacks and forwards to ERP
 */

const crypto = require('crypto');
const axios = require('axios');
const { getStore } = require('@netlify/blobs');

// Blob store
let blobStore;
function getBlobStore() {
  if (!blobStore) {
    // Netlify functions automatically have NETLIFY_SITE_ID env var
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    blobStore = getStore({
      name: 'webhook-history',
      siteID: siteID,
    });
    console.log('[WEBHOOK] Blob store initialized, siteID:', siteID);
  }
  return blobStore;
}

// In-memory cache
let callbackHistory = [];

/**
 * Load history from blobs
 */
async function loadHistory() {
  if (callbackHistory.length > 0) return;

  try {
    const store = getBlobStore();
    const entries = [];
    for await (const blob of store.list()) {
      const data = await store.get(blob.key, { type: 'json' });
      if (data) entries.push(data);
    }
    callbackHistory = entries.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
  } catch (err) {
    console.log('[WEBHOOK] Load from blobs failed:', err.message);
  }
}

/**
 * Main webhook handler
 */
exports.handler = async function(event, context) {
  // Route GET requests to history handler
  if (event.httpMethod === 'GET') {
    if (!event.path || !event.path.includes('/history')) {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '99', message: 'Use POST for webhook or GET for /api/webhook/history' }),
      };
    }
    return exports.history(event, context);
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '99', message: 'Method not allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const receivedAt = new Date().toISOString();

    const entry = {
      id: crypto.randomUUID(),
      originalPayload: payload,
      receivedAt,
      forwarded: false,
      forwardStatus: null,
    };

    callbackHistory.unshift(entry);

    // Persist to blobs
    try {
      const store = getBlobStore();
      await store.setJSON(entry.id, entry);
    } catch (err) {
      console.log('[WEBHOOK] Blob write failed:', err.message);
    }

    // Forward to ERP - add mock flag
    const forwardUrl = process.env.WEBHOOK_FORWARD_URL;
    if (forwardUrl) {
      // Clone payload and add mock flag
      const payloadForERP = { ...payload, mock: true };
      console.log('[WEBHOOK] Forwarding to ERP with mock=true');

      try {
        const response = await axios.post(forwardUrl, payloadForERP, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
        entry.forwarded = true;
        entry.forwardStatus = response.status;
      } catch (error) {
        entry.forwarded = false;
        entry.forwardStatus = error.response?.status || null;
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '00',
        message: 'acknowledged',
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '99', message: error.message }),
    };
  }
};

/**
 * History endpoint handler
 */
exports.history = async function(event, context) {
  await loadHistory();

  const txnId = event.queryStringParameters?.txnId;

  if (txnId) {
    const entry = callbackHistory.find(e => e.originalPayload?.txnId === txnId);
    if (!entry) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '04', message: 'Transaction not found' }),
      };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '00',
        data: entry,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: '00',
      data: callbackHistory,
      total: callbackHistory.length,
    }),
  };
};
