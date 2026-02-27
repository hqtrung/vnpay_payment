/**
 * VNPAY Check Transaction
 * Netlify Function for checking transaction status
 */

const crypto = require('crypto');
const axios = require('axios');

// Configuration from environment variables
const config = {
  merchantCode: process.env.VNPAY_MERCHANT_CODE,
  terminalId: process.env.VNPAY_TERMINAL_ID,
  checkTransSecretKey: process.env.VNPAY_CHECK_TRANS_SECRET_KEY,
  apiUrl: process.env.VNPAY_CHECK_TRANS_API_URL || 'https://doitac-tran.vnpaytest.vn/CheckTransaction/rest/api/CheckTrans',
};

/**
 * Generate checksum for check transaction
 * Formula: MD5(payDate|txnId|merchantCode|terminalID|secretKey)
 */
function generateChecksum(fields, secretKey) {
  const dataStr = fields.join('|') + '|' + secretKey;
  return crypto.createHash('md5').update(dataStr).digest('hex').toUpperCase();
}

/**
 * Check Transaction Status
 */
exports.handler = async function(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ code: '99', message: 'Method not allowed' }),
    };
  }

  // Check required config
  if (!config.merchantCode || !config.terminalId || !config.checkTransSecretKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ code: '99', message: 'Missing required environment variables' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { txnId, payDate } = body;

    if (!txnId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ code: '02', message: 'Missing txnId parameter' }),
      };
    }

    const dateStr = payDate || new Date().toLocaleDateString('vi-VN');

    // Build payload
    const payload = {
      txnId: txnId,
      merchantCode: config.merchantCode,
      terminalID: config.terminalId,
      payDate: dateStr,
    };

    // Generate checksum
    const checksumFields = [dateStr, txnId, config.merchantCode, config.terminalId];
    payload.checkSum = generateChecksum(checksumFields, config.checkTransSecretKey);

    // Call VNPAY API
    const response = await axios.post(config.apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const result = response.data;

    if (result.code === '00') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          code: '00',
          message: result.message || 'Success',
          billNumber: result.billNumber,
          txnId: result.txnId,
          payDate: result.payDate,
          qrTrace: result.qrTrace,
          bankCode: result.bankCode,
          debitAmount: result.debitAmount,
          realAmount: result.realAmount,
        }),
      };
    } else {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          code: result.code || '01',
          message: result.message || 'Transaction not found',
        }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        code: '99',
        message: error.message || 'Internal error',
      }),
    };
  }
};
