/**
 * VNPAY Webhook Handler
 * Netlify Function for receiving payment callbacks
 */

const crypto = require('crypto');
const axios = require('axios');

// Configuration from environment variables
// Required: WEBHOOK_SECRET_KEY, VNPAY_MERCHANT_CODE
const config = {
  secretKey: process.env.WEBHOOK_SECRET_KEY,
  forwardUrl: process.env.WEBHOOK_FORWARD_URL || '',
  merchantCode: process.env.VNPAY_MERCHANT_CODE,
  terminalId: process.env.VNPAY_TERMINAL_ID || '',
  maxHistorySize: parseInt(process.env.WEBHOOK_MAX_HISTORY || '100', 10),
};

// In-memory callback history storage
const callbackHistory = [];

/**
 * Verify webhook checksum from VNPAY callback
 * Formula: MD5(code|msgType|txnId|qrTrace|bankCode|mobile|accountNo|amount|payDate|merchantCode|secretKey)
 */
function verifyChecksum(payload, secretKey) {
  const receivedChecksum = (payload.checksum || '').toUpperCase();

  const checksumData = [
    payload.code || '',
    payload.msgType || '',
    payload.txnId || '',
    payload.qrTrace || '',
    payload.bankCode || '',
    payload.mobile || '',
    payload.accountNo || '',
    payload.amount || '',
    payload.payDate || '',
    payload.merchantCode || '',
    secretKey
  ].join('|');

  const expectedChecksum = crypto
    .createHash('md5')
    .update(checksumData)
    .digest('hex')
    .toUpperCase();

  return receivedChecksum === expectedChecksum;
}

/**
 * Add callback to history
 */
function addToHistory(callbackData) {
  const entry = {
    id: crypto.randomUUID(),
    txnId: callbackData.txnId || '',
    qrTrace: callbackData.qrTrace || '',
    code: callbackData.code || '',
    message: callbackData.message || '',
    amount: callbackData.amount || '',
    bankCode: callbackData.bankCode || '',
    payDate: callbackData.payDate || '',
    merchantCode: callbackData.merchantCode || '',
    terminalId: callbackData.terminalId || '',
    mobile: callbackData.mobile || '',
    accountNo: callbackData.accountNo || '',
    receivedAt: new Date().toISOString(),
    forwarded: false,
    forwardStatus: null,
  };

  callbackHistory.unshift(entry);

  // FIFO: Remove oldest entries if exceeding limit
  while (callbackHistory.length > config.maxHistorySize) {
    callbackHistory.pop();
  }

  return entry;
}

/**
 * Get all callback history
 */
function getHistory() {
  return callbackHistory;
}

/**
 * Get callback by transaction ID
 */
function getHistoryByTxnId(txnId) {
  return callbackHistory.find(entry => entry.txnId === txnId) || null;
}

/**
 * Update forward status for a callback
 */
function updateForwardStatus(txnId, forwarded, status) {
  const entry = callbackHistory.find(e => e.txnId === txnId);
  if (entry) {
    entry.forwarded = forwarded;
    entry.forwardStatus = status;
  }
}

/**
 * Forward callback to external URL
 */
async function forwardCallback(payload) {
  if (!config.forwardUrl) return;

  try {
    const response = await axios.post(config.forwardUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    updateForwardStatus(payload.txnId, true, response.status);
  } catch (error) {
    updateForwardStatus(payload.txnId, false, error.response?.status || null);
  }
}

/**
 * Main webhook handler
 */
exports.handler = async function(event, context) {
  // Route GET requests to history handler
  if (event.httpMethod === 'GET') {
    return exports.history(event, context);
  }

  // Only allow POST method for webhook
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '99', message: 'Method not allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');

    // Validate required fields
    const requiredFields = ['code', 'msgType', 'txnId', 'qrTrace', 'bankCode', 'amount', 'payDate', 'merchantCode', 'checksum'];
    const missingFields = requiredFields.filter(f => !payload[f]);

    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '02', message: `Missing required fields: ${missingFields.join(', ')}` }),
      };
    }

    // Verify merchant code matches
    if (config.merchantCode && payload.merchantCode !== config.merchantCode) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '08', message: 'Invalid merchant code' }),
      };
    }

    // Verify secret key is configured
    if (!config.secretKey && process.env.WEBHOOK_TEST_MODE !== 'true') {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '99', message: 'WEBHOOK_SECRET_KEY not configured' }),
      };
    }

    // Verify checksum (allow bypass in test mode)
    const testMode = process.env.WEBHOOK_TEST_MODE === 'true';
    if (!testMode && !verifyChecksum(payload, config.secretKey)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '01', message: 'Invalid checksum' }),
      };
    }

    const txnId = payload.txnId;

    // Add to history
    addToHistory(payload);

    // Forward to external URL (fire-and-forget)
    if (config.forwardUrl) {
      forwardCallback(payload); // Don't await - fire and forget
    }

    // Acknowledge VNPAY
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '00',
        message: 'acknowledged',
        data: { txnId },
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
  const txnId = event.queryStringParameters?.txnId;

  if (txnId) {
    // Get specific callback
    const entry = getHistoryByTxnId(txnId);
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

  // Get all history
  const history = getHistory();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: '00',
      data: history,
      total: history.length,
    }),
  };
};
