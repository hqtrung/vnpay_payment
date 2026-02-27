---
title: Introduction
description: VNPAY QR Payment Integration API
---

# VNPAY Payment API

Integration with VNPAY QR MMS for QR code payments.

## Features

- **Generate QR Code** - Create payment QR codes
- **Check Transaction** - Query transaction status
- **Webhook** - Receive payment callbacks

## Base URL

```
https://vnpay-webhook.finizi.ai/api
```

## Quick Start

```bash
# Generate QR Code
curl -X POST https://vnpay-webhook.finizi.ai/api/generate-qr \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "description": "Test Payment"}'

# Check Transaction
curl -X POST https://vnpay-webhook.finizi.ai/api/check-transaction \
  -H "Content-Type: application/json" \
  -d '{"txnId": "ORDER123"}'
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VNPAY_MERCHANT_CODE` | Yes | Merchant code |
| `VNPAY_SECRET_KEY` | Yes | Secret key for QR generation |
| `VNPAY_CHECK_TRANS_SECRET_KEY` | Yes | Secret key for check transaction |
| `VNPAY_TERMINAL_ID` | Yes | Terminal ID |
| `WEBHOOK_SECRET_KEY` | Yes | Webhook callback secret |

## Demo UI

Use `test_qr_ui.html` to test the payment flow in your browser.
