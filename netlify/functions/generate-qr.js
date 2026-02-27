/**
 * VNPAY QR Code Generator
 * Netlify Function for generating payment QR codes
 */

const crypto = require('crypto');
const axios = require('axios');

// Configuration from environment variables
const config = {
  merchantCode: process.env.VNPAY_MERCHANT_CODE,
  merchantName: process.env.VNPAY_MERCHANT_NAME || 'MERCHANT',
  merchantType: process.env.VNPAY_MERCHANT_TYPE || '4513',
  terminalId: process.env.VNPAY_TERMINAL_ID,
  secretKey: process.env.VNPAY_SECRET_KEY,
  masterMerCode: process.env.VNPAY_MASTER_MER_CODE || 'A000000775',
  appId: process.env.VNPAY_APP_ID || 'MERCHANT',
  apiUrl: process.env.VNPAY_QR_API_URL || 'https://doitac-tran.vnpaytest.vn/QRCreateAPIRestV2/rest/CreateQrcodeApi/createQrcode',
};

/**
 * Generate checksum for QR request
 * Formula: MD5 of pipe-separated fields + secretKey
 */
function generateChecksum(fields, secretKey) {
  const dataStr = fields.join('|') + '|' + secretKey;
  return crypto.createHash('md5').update(dataStr).digest('hex').toUpperCase();
}

/**
 * Generate QR Code
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
  if (!config.merchantCode || !config.terminalId || !config.secretKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ code: '99', message: 'Missing required environment variables' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { amount, orderId, description } = body;

    if (!amount || amount < 1000) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ code: '02', message: 'Amount must be at least 1000 VND' }),
      };
    }

    const txnId = orderId || `ORDER${Date.now()}`;

    // Build payload
    const payload = {
      appId: config.appId,
      merchantName: config.merchantName,
      serviceCode: '03',
      countryCode: 'VN',
      masterMerCode: config.masterMerCode,
      merchantType: config.merchantType,
      merchantCode: config.merchantCode,
      terminalId: config.terminalId,
      payType: '03',
      productId: '',
      txnId: txnId,
      billNumber: txnId,
      amount: String(amount),
      tipAndFee: '',
      ccy: '704',
      expDate: '',
      desc: description || 'Payment',
    };

    // Generate checksum
    const checksumFields = [
      payload.appId,
      payload.merchantName,
      payload.serviceCode,
      payload.countryCode,
      payload.masterMerCode,
      payload.merchantType,
      payload.merchantCode,
      payload.terminalId,
      payload.payType,
      payload.productId,
      payload.txnId,
      payload.amount,
      payload.tipAndFee,
      payload.ccy,
      payload.expDate,
    ];
    payload.checksum = generateChecksum(checksumFields, config.secretKey);

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
          message: 'Success',
          data: result.data,
          idQrcode: result.idQrcode,
          orderId: txnId,
          amount: amount,
        }),
      };
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          code: result.code || '99',
          message: result.message || 'Unknown error',
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
