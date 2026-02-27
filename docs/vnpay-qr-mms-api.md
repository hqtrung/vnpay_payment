# VNPAY QR MMS API Integration Guide

This document provides complete integration reference for VNPAY QR MMS API, including JSON payloads, error codes, and implementation samples.

---

## Table of Contents

1. [Create QRCode API](#1-create-qrcode-api-createqrcode)
2. [Payment Callback API (Webhook)](#2-payment-callback-api-merchant-payment)
3. [Check Transaction API](#3-check-transaction-api-checktrans)
4. [Refund API](#4-refund-api-merchantrefund)
5. [Error Codes Reference](#5-error-codes-reference)

---

## 1. Create QRCode API (`CreateQRCode`)

Generate a QR code string from VNPAY to display to customers.

| Environment | Endpoint |
|-------------|----------|
| Test | `https://doitac-tran.vnpaytest.vn/QRCreateAPIRestV2/rest/CreateOrcodeApi/createQrcode` |
| Production | `https://qrcode.vnpay.vn/QRCreateAPIRestV2/rest/CreateOrcodeApi/createQrcode` |

- **HTTP Method:** `POST`
- **Content-Type:** `text/plain`

### Request Parameters

| Parameter | Type | Max Length | Required | Description |
|-----------|------|------------|----------|-------------|
| `appId` | String | 100 | Yes | Provided uniquely by VNPAY for each partner |
| `merchantName` | String | 25 | Yes | Abbreviated name of the Merchant |
| `serviceCode` | String | 20 | Yes | QR service code, default is `03` |
| `countryCode` | String | - | Yes | Country code, default is `VN` |
| `masterMerCode` | String | 100 | Yes | Master merchant code, default is `A000000775` |
| `merchantType` | String | 9 | Yes | Enterprise business type code |
| `merchantCode` | String | 20 | Yes | Merchant code |
| `terminalId` | String | 8 | Yes | Terminal/collection point code |
| `payType` | String | 4 | Yes | Payment type, default is `03` |
| `productId` | String | 20 | No | Product ID, default is empty |
| `txnId` | String | 15 | Conditional | Transaction/Order ID. Required if `payType = 01` |
| `billNumber` | String | 20 | Yes | Bill number, applied when `payType = 03` |
| `amount` | String | 13 | Yes | Payment amount |
| `tipAndFee` | String | 20 | No | Tip and fee amount, default is empty |
| `ccy` | String | 3 | Yes | Currency code, default is `704` (VND) |
| `expDate` | String | 14 | Yes | Expiration date formatted as `yyMMddHHmm` |
| `desc` | String | 19 | No | Additional description |
| `consumerID` | String | 20 | Conditional | Customer ID, required if `payType = 04` |
| `purpose` | String | 19 | Conditional | Billing service code for `payType = 04` |
| `checksum` | String | 32 | Yes | MD5 hash of concatenated values |

### Checksum Formula

```
MD5(appId + "|" + merchantName + "|" + serviceCode + "|" + countryCode + "|" +
    masterMerCode + "|" + merchantType + "|" + merchantCode + "|" + terminalId + "|" +
    payType + "|" + productId + "|" + txnId + "|" + amount + "|" + tipAndFee + "|" +
    ccy + "|" + expDate + "|" + secretKey)
```

### Request JSON Sample

```json
{
  "appId": "MERCHANT",
  "merchantName": "VNPAY TEST",
  "serviceCode": "03",
  "countryCode": "VN",
  "masterMerCode": "A000000775",
  "merchantType": "9999",
  "merchantCode": "88888888",
  "payloadFormat": "",
  "terminalId": "PSSTEST",
  "payType": "03",
  "productId": "",
  "txnId": "VNP_TEST888",
  "amount": "100000",
  "tipAndFee": "",
  "ccy": "704",
  "expDate": "",
  "desc": "",
  "checksum": "A8833240FA23EE9FA5D5D081EA8A7540",
  "mobile": "",
  "billNumber": "VNP_TEST888",
  "consumerID": "",
  "purpose": ""
}
```

### Response Parameters

| Parameter | Type | Max Length | Required | Description |
|-----------|------|------------|----------|-------------|
| `code` | String | 20 | Yes | Return error code |
| `message` | String | 100 | Yes | Description of the error code |
| `data` | String | Free | No | The generated QR code string data |
| `url` | String | Free | No | Returned URL, default is null |
| `checksum` | String | 32 | Yes | MD5 hash validating response |

### Response Checksum Formula

```
MD5(code + "|" + message + "|" + data + "|" + url + "|" + secretKey)
```

### Response JSON Sample

```json
{
  "code": "00",
  "message": "Success",
  "data": "00020101021226260010A00000077501088888888852049999530370454061000005802VN5910VNPAY TEST6005HANOI62330111VNP_TEST8880303PSS0707PSSTEST63046DF7",
  "url": null,
  "checksum": "732BEFB12DEF461C90E9E4588538C5D9",
  "isDelete": true,
  "idQrcode": "7178242194757656576"
}
```

### Frontend QR Code Generation (React/JS)

Use a QR generation library to render the `data` string inside the VNPAY standard frame.

```javascript
// HTML/JSX Structure
<Col span={18} offset={3} className="mb-2 container-qrcode pd-10-percent text-center" style={{ backgroundImage: `url(${urlQrBg})` }}>
    <div id="qrcode" />
</Col>

// JS Implementation
if (localStorage.getItem('qrItemTerminal')) {
    const qrItemTerminal = JSON.parse(localStorage.getItem('qrItemTerminal'));
    getQrItemTerminal({
        id: (qrItemTerminal && qrItemTerminal.id) || 0,
        createDate: (qrItemTerminal && qrItemTerminal.createDate) || "",
    }).then((res) => {
        if (res && res.code === '00') {
            setQrCodeDetail(res.data ? res.data : []);
            const options = {
                text: res && res.data && res.data.qrData, // The 'data' string from the API response
                width: 200,
                height: 200,
                correctLevel: QRCode.CorrectLevel.M,
                PO_TL: '#005AAB',
                PI_TL: '#005AAB',
                PO_TR: '#005AAB',
                PI_TR: '#005AAB',
                PO_BL: '#C9181E',
                PI_BL: '#C9181E',
            };
            new QRCode(document.getElementById('qrcode'), options);
            new QRCode(document.getElementById('qr-download'), options);
            new QRCode(qrcodePrint.current, options);
        } else {
            notification.destroy();
            notification.error({
                message: 'Thông báo',
                description: 'Có lỗi trong quá trình xử lí, vui lòng thử lại sau!',
            });
        }
    });
}
```

---

## 2. Payment Callback API (Merchant Payment)

This is a RESTful API built and hosted by the Merchant. VNPAY MMS triggers this webhook to notify the Merchant when a customer's payment succeeds or fails.

### Request Parameters (VNPAY -> Merchant)

| Parameter | Type | Max Length | Required | Description |
|-----------|------|------------|----------|-------------|
| `code` | String | 10 | Yes | Payment deduction status code |
| `message` | String | 100 | Yes | Payment deduction status message |
| `msgType` | String | 10 | Yes | `1` for Payment, `2` for Order placement |
| `txnId` | String | 20 | Yes | Order ID / Bill number within the QR code |
| `qrTrace` | String | 10 | Yes | Unique transaction trace number |
| `bankCode` | String | 10 | Yes | Paying bank's code |
| `mobile` | String | 20 | No | Customer's mobile number |
| `accountNo` | String | 30 | No | Account number |
| `amount` | String | 13 | Yes | Payment amount |
| `payDate` | String | 14 | Yes | Payment time/deadline |
| `merchantCode` | String | 20 | Yes | VNPAY Merchant Code |
| `terminalId` | String | 8 | Yes | Terminal ID |
| `addData` | String/Json | Free | No | Additional array containing `productId`, `amount`, `tipAndFee`, `ccy`, `qty`, and `note` |
| `checksum` | String | 32 | Yes | MD5 Hash |

### Checksum Formula

```
MD5(code + "|" + msgType + "|" + txnId + "|" + qrTrace + "|" + bankCode + "|" +
    mobile + "|" + accountNo + "|" + amount + "|" + payDate + "|" + merchantCode + "|" + secretKey)
```

### Request JSON Sample

```json
{
  "code": "00",
  "message": "Tru tien thanh cong, so trace 100550",
  "msgType": "1",
  "txnId": "50141",
  "qrTrace": "000098469",
  "bankCode": "VIETCOMBANK",
  "mobile": "0989511021",
  "accountNo": "",
  "amount": "1000000",
  "payDate": "20180807164732",
  "masterMerCode": "A000000775",
  "merchantCode": "0311609355",
  "terminalId": "FPT02",
  "addData": [{
    "merchantType": "5045",
    "serviceCode": "06",
    "masterMerCode": "A000000775",
    "merchantCode": "0311609355",
    "terminalId": "FPT02",
    "productId": "",
    "amount": "100000",
    "ccy": "704",
    "qty": "1",
    "note": ""
  }],
  "checksum": "81F77683FEA4EBE2CE748AFC99CC3AE9",
  "ccy": "704",
  "secretKey": "VNPAY"
}
```

### Expected Response (Merchant -> VNPAY)

The Merchant must acknowledge the webhook with the following schema:

| Parameter | Type | Max Length | Required | Description |
|-----------|------|------------|----------|-------------|
| `code` | String | 20 | Yes | Merchant processing result code |
| `message` | String | 100 | Yes | Description of the result |
| `data` | Json | Free | No | Detailed data, typically echoing the `txnId` |

### Response JSON Sample

```json
{
  "code": "00",
  "message": "đặt hàng thành công",
  "data": {
    "txnId": "50141"
  }
}
```

---

## 3. Check Transaction API (`CheckTrans`)

Used to actively query the status of a specific transaction.

| Environment | Endpoint |
|-------------|----------|
| Test | `https://doitac-tran.vnpaytest.vn/CheckTransaction/rest/api/CheckTrans` |
| Production | `https://qrcode.vnpay.vn/CheckTransaction/rest/api/CheckTrans` |

- **HTTP Method:** `POST`
- **Content-Type:** `application/json`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `txnId` | String | Yes | Dynamic QR invoice/transaction ID |
| `merchantCode` | String | Yes | Merchant identifier |
| `terminalID` | String | Yes | Terminal identifier |
| `payDate` | String | Yes | Transaction date formatted strictly as `dd/MM/yyyy` |
| `checkSum` | String | Yes | MD5 Hash |

### Checksum Formula

```
MD5(payDate + "|" + txnId + "|" + merchantCode + "|" + terminalID + "|" + secretKey)
```

### Request JSON Sample

```json
{
  "merchantCode": "88888888",
  "checkSum": "8417a925dfee935744c57cb3340030ef",
  "terminalID": "PSSTEST",
  "txnId": "SCSREWITSP",
  "payDate": "27/03/2024"
}
```

### Response JSON Sample

```json
{
  "code": "00",
  "message": "Giao dich thanh cong.",
  "masterMerchantCode": "A000000775",
  "merchantCode": "88888888",
  "terminalID": "PSSTEST",
  "billNumber": "SCSREWITSP",
  "txnId": "SCSREWITSP",
  "payDate": "27/03/2024 13:56:24",
  "qrTrace": "244395023",
  "bankCode": "VNPAYEWALLET",
  "debitAmount": "100000",
  "realAmount": "100000",
  "checkSum": "3F907FC92DE68728EBD11A826877628F"
}
```

---

## 4. Refund API (`MerchantRefund`)

Allows the Merchant to trigger partial or full refunds.

| Environment | Endpoint |
|-------------|----------|
| Test | `https://doitac-tran.vnpaytest.vn/mms/refund` |
| Production | `https://qrcode.vnpay.vn/mms/refund` |

- **HTTP Method:** `POST`
- **Content-Type:** `application/json`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantCode` | String | Yes | Merchant Code |
| `qrTrace` | String | Yes | QR Trace Number |
| `payTxnId` | String | Yes | Invoice Number |
| `refundTxnId` | Long | Yes | Merchant's unique trace number for this refund attempt |
| `typeRefund` | String | Yes | `1` for full refund, `2` for partial refund |
| `amount` | int | Yes | Refund amount |
| `refundContent` | String | Yes | Refund reason/description |
| `payDate` | String | Yes | Original payment timestamp formatted as `YYYYmmDDhhMMSS` |
| `checkSum` | String | Yes | MD5 Hash |

### Checksum Formula

```
MD5(secretKey + merchantCode + qrTrace + payTxnId + refundTxnId + typeRefund + amount + payDate)
```

### Request JSON Sample

```json
{
  "merchantCode": "0315275368A",
  "amount": "147000",
  "refundTxnId": "575214",
  "typeRefund": "1",
  "qrTrace": "244202482",
  "checkSum": "3d799685c7d315c748ddceedc17b94b3",
  "refundContent": "",
  "payTxnId": "679363",
  "payDate": "20210721153311"
}
```

### Response JSON Sample

```json
{
  "code": "00",
  "message": "Refund Success.",
  "qrTraceRefund": "000000521",
  "refundDate": "20170505093009",
  "checkSum": "AB5ED43B77FCA16D6A0DE797BE1FA9D9"
}
```

---

## 5. Error Codes Reference

### Common Response Codes

| Code | Description |
|------|-------------|
| `00` | Success |
| `01` | Invalid checksum |
| `02` | Invalid request parameters |
| `03` | Merchant not found |
| `04` | Transaction not found |
| `05` | Insufficient balance |
| `06` | Transaction already processed |
| `07` | Transaction expired |
| `08` | Invalid merchant |
| `09` | Invalid terminal |
| `10` | Duplicate transaction |
| `11` | Invalid amount |
| `12` | Invalid currency |
| `13` | Invalid date format |
| `14` | System error |
| `15` | Timeout |
| `16` | Network error |
| `17` | Invalid QR code |
| `18` | QR code expired |
| `19` | Refund not allowed |
| `20` | Refund amount exceeds original transaction |
| `99` | Unknown error |

### Payment Status Codes (Webhook)

| Code | Description |
|------|-------------|
| `00` | Payment successful |
| `01` | Payment failed |
| `02` | Payment pending |
| `03` | Payment cancelled |
| `04` | Payment expired |
| `05` | Payment declined |
| `06` | Invalid card |
| `07` | Insufficient funds |
| `08` | Bank connection error |
| `09` | Duplicate payment |
| `99` | Unknown error |

---

## Quick Reference

### Test Credentials

| Field | Value |
|-------|-------|
| merchantCode | 0317530616A |
| merchantName | PATEDEL |
| merchantType | 4513 |
| terminalId | PATEDET2 |
| appID | MERCHANT |
| secretKey (Gen QR) | vnpay@MERCHANT |
| secretKey (Check Trans) | vnpay@123@langhaHangLa |
| secretKey (Refund) | vnpayRefund |

### Pay Types

| Code | Description |
|------|-------------|
| `01` | Dynamic QR (requires txnId) |
| `02` | Static QR |
| `03` | Bill Payment (requires billNumber) |
| `04` | Pre-authorization (requires consumerID and purpose) |

### Currency Codes

| Code | Currency |
|------|----------|
| `704` | VND (Vietnam Dong) |

---

## Implementation Notes

1. **Checksum Validation**: Always validate checksums on both request and response to ensure data integrity
2. **Idempotency**: Implement idempotent handling for webhook callbacks to prevent duplicate processing
3. **Timeout**: Set appropriate timeout values (recommended: 30-60 seconds)
4. **Logging**: Log all API requests and responses for debugging
5. **Retry Logic**: Implement retry logic for transient failures
6. **Security**: Never expose secret keys in client-side code
