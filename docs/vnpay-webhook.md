# VNPAY Payment API Documentation

This document describes the Netlify Functions implementation for VNPAY QR payments.

## Overview

Three API endpoints for VNPAY QR payments:
- **Generate QR** - Create payment QR code
- **Check Transaction** - Query transaction status
- **Webhook** - Receive payment callbacks

## File Structure

```
vnpay_payment/
├── package.json                    # Node.js dependencies
├── netlify.toml                    # Netlify configuration
└── netlify/
    └── functions/
        ├── generate-qr.js          # QR code generator
        ├── check-transaction.js    # Transaction checker
        └── webhook.js              # Payment callback handler
```

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/api/generate-qr` | POST | Generate payment QR code |
| `/api/check-transaction` | POST | Check transaction status |
| `/api/webhook` | POST | Receive payment callbacks |
| `/api/webhook/history` | GET | List callback history |

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VNPAY_MERCHANT_CODE` | Yes | VNPAY merchant code |
| `VNPAY_SECRET_KEY` | Yes | Secret key for QR generation |
| `VNPAY_CHECK_TRANS_SECRET_KEY` | Yes | Secret key for check transaction |
| `VNPAY_TERMINAL_ID` | Yes | Terminal ID |
| `VNPAY_MERCHANT_NAME` | No | Merchant name (default: MERCHANT) |
| `VNPAY_MERCHANT_TYPE` | No | Merchant type (default: 4513) |
| `VNPAY_MASTER_MER_CODE` | No | Master merchant code (default: A000000775) |
| `VNPAY_APP_ID` | No | App ID (default: MERCHANT) |
| `WEBHOOK_SECRET_KEY` | Yes* | Webhook secret for callbacks |
| `WEBHOOK_FORWARD_URL` | No | URL to forward callbacks |
| `WEBHOOK_MAX_HISTORY` | No | Max history entries (default: 100) |
| `WEBHOOK_TEST_MODE` | No | Skip checksum validation |

* Only required for webhook endpoint

### Set Environment Variables

```bash
# Required for QR Generation
netlify env:set VNPAY_MERCHANT_CODE "0317530616A"
netlify env:set VNPAY_SECRET_KEY "vnpay@MERCHANT"
netlify env:set VNPAY_TERMINAL_ID "PATEDET2"

# Required for Check Transaction
netlify env:set VNPAY_CHECK_TRANS_SECRET_KEY "vnpay@123@langhaHangLa"

# Required for Webhook
netlify env:set WEBHOOK_SECRET_KEY "vnpay@MERCHANT"

# Optional
netlify env:set VNPAY_MERCHANT_NAME "PATEDEL"
netlify env:set WEBHOOK_FORWARD_URL "https://your-app.com/webhook"
netlify env:set WEBHOOK_TEST_MODE "true"

# Deploy
netlify deploy --prod
```

## Request Format (VNPAY -> Your Server)

### Headers

```
Content-Type: application/json
```

### Body

```json
{
  "code": "00",
  "message": "Tru tien thanh cong, so trace 100550",
  "msgType": "1",
  "txnId": "ORDER123",
  "qrTrace": "000098469",
  "bankCode": "VIETCOMBANK",
  "mobile": "0989511021",
  "accountNo": "",
  "amount": "100000",
  "payDate": "20260227103000",
  "merchantCode": "0317530616A",
  "terminalId": "PATEDET2",
  "checksum": "5AE24506DD3A360BE6346766138AE6FF"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | String | Yes | Payment status code (`00` = success) |
| `message` | String | Yes | Status message |
| `msgType` | String | Yes | `1` = Payment, `2` = Order |
| `txnId` | String | Yes | Order ID / Bill number |
| `qrTrace` | String | Yes | Unique transaction trace number |
| `bankCode` | String | Yes | Paying bank's code |
| `mobile` | String | No | Customer's mobile number |
| `accountNo` | String | No | Account number |
| `amount` | String | Yes | Payment amount |
| `payDate` | String | Yes | Payment timestamp (yyyyMMddHHmmss) |
| `merchantCode` | String | Yes | VNPAY Merchant Code |
| `terminalId` | String | Yes | Terminal ID |
| `checksum` | String | Yes | MD5 hash for verification |

## Response Format (Your Server -> VNPAY)

### Success

```json
{
  "code": "00",
  "message": "acknowledged",
  "data": {
    "txnId": "ORDER123"
  }
}
```

### Error

```json
{
  "code": "01",
  "message": "Invalid checksum"
}
```

## Checksum Formula

```
MD5(code|msgType|txnId|qrTrace|bankCode|mobile|accountNo|amount|payDate|merchantCode|secretKey)
```

All fields concatenated with pipe `|` separator, then hashed with MD5 (uppercase hex).

## History API Response

### Get All History

```bash
GET /api/webhook/history
```

Response:
```json
{
  "code": "00",
  "data": [
    {
      "id": "uuid",
      "txnId": "ORDER123",
      "code": "00",
      "amount": "100000",
      "bankCode": "VIETCOMBANK",
      "receivedAt": "2026-02-27T12:00:00.000Z",
      "forwarded": true,
      "forwardStatus": 200
    }
  ],
  "total": 1
}
```

### Get Specific Callback

```bash
GET /api/webhook/history?txnId=ORDER123
```

## Generate QR API

### POST /api/generate-qr

Generate a payment QR code for customers to scan.

**Request:**

```json
{
  "amount": 10000,
  "orderId": "ORDER123",
  "description": "Payment for order #123"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `amount` | Yes | Payment amount in VND (min 1000) |
| `orderId` | No | Order ID (auto-generated if not provided) |
| `description` | No | Payment description |

**Response:**

```json
{
  "code": "00",
  "message": "Success",
  "data": "000201010212...",
  "idQrcode": "7433057680089948160",
  "orderId": "ORDER123",
  "amount": 10000
}
```

**Usage:**

```bash
curl -X POST https://vnpay-webhook.finizi.ai/api/generate-qr \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "description": "Test Payment"}'
```

## Check Transaction API

### POST /api/check-transaction

Check the status of a transaction.

**Request:**

```json
{
  "txnId": "ORDER123",
  "payDate": "27/02/2026"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `txnId` | Yes | Order/Transaction ID |
| `payDate` | No | Payment date (dd/MM/yyyy), defaults to today |

**Response:**

```json
{
  "code": "00",
  "message": "Success",
  "billNumber": "ORDER123",
  "txnId": "ORDER123",
  "payDate": "27/02/2026 14:30:00",
  "qrTrace": "244395023",
  "bankCode": "VIETCOMBANK",
  "debitAmount": "10000",
  "realAmount": "10000"
}
```

**Usage:**

```bash
curl -X POST https://vnpay-webhook.finizi.ai/api/check-transaction \
  -H "Content-Type: application/json" \
  -d '{"txnId": "ORDER123"}'
```

## Testing

### Local Testing

```bash
# Start local server
npm run dev

# Test webhook endpoint
curl -X POST http://localhost:8888/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "code": "00",
    "message": "Test payment",
    "msgType": "1",
    "txnId": "ORDER123",
    "qrTrace": "000098469",
    "bankCode": "VIETCOMBANK",
    "amount": "100000",
    "payDate": "20260227103000",
    "merchantCode": "0317530616A",
    "checksum": "test"
  }'
```

### Generate Valid Checksum

```javascript
const crypto = require('crypto');

const payload = {
  code: '00',
  msgType: '1',
  txnId: 'ORDER123',
  qrTrace: '000098469',
  bankCode: 'VIETCOMBANK',
  mobile: '',
  accountNo: '',
  amount: '100000',
  payDate: '20260227103000',
  merchantCode: '0317530616A',
  secretKey: 'vnpay@MERCHANT'
};

const checksum = crypto
  .createHash('md5')
  .update(Object.values(payload).join('|'))
  .digest('hex')
  .toUpperCase();

console.log(checksum);
```

## Deployment

### Set Environment Variables

```bash
# Using Netlify CLI
netlify env:set WEBHOOK_SECRET_KEY "your-secret-key"
netlify env:set WEBHOOK_FORWARD_URL "https://your-app.com/webhook"
netlify env:set VNPAY_MERCHANT_CODE "0317530616A"

# Deploy
netlify deploy --prod
```

### Configure VNPAY

Update your VNPAY merchant configuration to point webhook URL to:
```
https://your-site.netlify.app/api/webhook
```

## Error Codes

| Code | Description |
|------|-------------|
| `00` | Success |
| `01` | Invalid checksum |
| `02` | Missing required fields |
| `08` | Invalid merchant code |
| `99` | Unknown error |

## Notes

- History is stored in-memory (lost on function cold start)
- Forwarding is fire-and-forget (doesn't block response)
- Enable `WEBHOOK_TEST_MODE=true` to skip checksum validation during testing
