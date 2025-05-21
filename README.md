
# 🚀 TRADO <> IIT Ropar Hackathon — Market Data Collector

Welcome to the **Trado <> IIT Ropar Hackathon**!
This is **Part 1** of a two-part challenge focused on building a **real-time market data ingestion service** using MQTT and TimescaleDB.

---

## 🧠 Project Overview

This project builds a **Node.js-based backend** that:

* Connects to an EMQX MQTT broker
* Subscribes to **index LTP topics** (like NIFTY, BANKNIFTY)
* Computes the **ATM (At-The-Money)** strike price
* Subscribes to **options data (CE & PE) around ATM**
* Decodes incoming market data (supports **Protobuf**, **Protobuf batch**, or **JSON**)
* Stores data in a **PostgreSQL DB with TimescaleDB extension** using **efficient batch inserts**

---

## ✅ Highlights of This Implementation

### ✅ Cloud-Ready Configuration

* Compatible with **Timescale Cloud**
* `.env` driven config for easy deployment
* Supports secure `sslmode=require` DB URLs

### ✅ Data Pipeline

* **Robust MQTT Client** with auto-reconnect
* **Modular pipeline**: MQTT → Decoder → ATM Detector → Option Subscriber → Batch DB Writer
* Supports **one-time ATM strike detection per index**

### ✅ Decoding + Processing

* Supports:

  * `marketdata.MarketData` (Protobuf)
  * `marketdata.MarketDataBatch` (Protobuf batch)
  * Fallback to plain JSON
* Automatically extracts LTP and routes data to DB

### ✅ Batched & Normalized Storage

* Stores all data to `ltp_data` table using:

  * **Batched inserts**
  * **Topic normalization** via `topics` table
* Creates **TimescaleDB hypertable** for time-series performance

---

## 📦 Setup Instructions

### 🔧 Prerequisites

* Node.js v16+
* `psql` CLI
* **PostgreSQL with TimescaleDB** (or Timescale Cloud)
* MQTT broker credentials (provided by Trado)

---

### 🛠️ Database Setup

> **Note**: Supports both local PostgreSQL + TimescaleDB and **Timescale Cloud**.

#### a. If Using Local PostgreSQL

```bash
createdb market_data
psql -d market_data -f scripts/db-schema.sql
```

#### b. If Using Timescale Cloud

1. Get your connection URL (like below):

   ```
   postgres://user:pass@host:port/dbname?sslmode=require
   ```

2. Run schema setup:

   ```bash
   psql "your_connection_url" -f scripts/db-schema.sql
   ```

---

### 🔧 Project Configuration

1. Clone this repo:

   ```bash
   git clone <repo_url>
   cd market-data-hackathon
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env`:

   ```bash
   cp .env.example .env
   ```

   Fill in your DB credentials (especially if using Timescale Cloud):

   ```env
   PG_HOST=your_host
   PG_PORT=your_port
   PG_USER=your_user
   PG_PASSWORD=your_password
   PG_DATABASE=your_db
   ```

---

## 🚀 Run the Project

```bash
npm start
```

---

## 💡 Implementation Details

### 1. MQTT Connection

* Connects using secure config with reconnects
* Client ID is auto-generated per session

### 2. Index Subscription

* Subscribes to:

  * `index/NIFTY`, `index/BANKNIFTY`, etc.
* Tracks whether first message received to trigger ATM logic only once

### 3. ATM Strike Calculation

* Automatically computed from first LTP received for each index
* Uses strike difference logic:

  * NIFTY: 50
  * BANKNIFTY: 100
  * FINNIFTY: 50
  * MIDCPNIFTY: 25

### 4. Options Subscription

* For ATM and ±5 strikes
* CE + PE for each strike
* Gets token from API like:

  ```
  https://api.trado.trade/token?index=NIFTY&expiryDate=22-05-2025&optionType=ce&strikePrice=25000
  ```
* Subscribes to `NSE_FO|<tokenNumber>`

### 5. Storage in TimescaleDB

* Topics are stored uniquely in `topics(topic_name, index_name, type, strike)`
* LTP data stored in `ltp_data(topic_id, ltp, received_at)`
* Uses batch inserts with configurable batch size & interval

---

## 🔧 Configurable via `.env`

| Variable        | Description                       |
| --------------- | --------------------------------- |
| PG\_HOST        | PostgreSQL DB host                |
| PG\_PORT        | PostgreSQL port                   |
| PG\_USER        | PostgreSQL username               |
| PG\_PASSWORD    | PostgreSQL password               |
| PG\_DATABASE    | Target database name              |
| INDEX\_PREFIX   | Prefix for index topics (`index`) |
| BATCH\_SIZE     | Max batch size before insert      |
| BATCH\_INTERVAL | Max delay (ms) before flush       |

---

## 🛠 Tips for Success

* Use `async/await` everywhere — which we’ve done
* All DB writes are batched
* Reconnection logic is robust for MQTT
* Code is modular:

  * `db/` for storage
  * `mqtt/` for connection, message processing, and subscriptions
  * `utils/` for strike logic

---

## 🧪 Testing Your Setup

Check if it's working:

1. Start the app: `npm start`

2. Watch logs like:

   ```
   Subscribing to index: index/NIFTY
   Subscribing to NIFTY options around ATM 22000
   Subscribed to option: NSE_FO|234123
   Flushing 100 items to DB...
   ```

3. Connect to DB:

   ```bash
   psql "your_connection_url"
   ```

4. Run:

   ```sql
   SELECT * FROM ltp_data ORDER BY received_at DESC LIMIT 10;
   ```

---

## 🧱 Project Structure

```
.
├── scripts/
│   └── db-schema.sql
├── src/
│   ├── db/
│   │   └── index.ts
│   ├── mqtt/
│   │   ├── client.ts
│   │   ├── messageProcessor.ts
│   │   └── subscriptionManager.ts
│   ├── utils/
│   │   └── index.ts
│   ├── config/
│   │   └── index.ts
│   └── index.ts
├── .env
├── package.json
```

---

