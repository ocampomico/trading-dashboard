# Trading Dashboard

A personal morning trading brief — built for beginner day traders. Opens every morning with buy/sell signals, entry levels, stop losses, and profit targets for the top 10 most-traded stocks.

![Stack](https://img.shields.io/badge/Frontend-React-blue) ![Stack](https://img.shields.io/badge/Backend-FastAPI-green) ![Stack](https://img.shields.io/badge/Data-Yahoo%20Finance-purple)

---

## What It Does

- **Morning Brief** — Top buy setups ranked by signal strength each day
- **Plain-English summaries** — No jargon. Each stock tells you what to do and why
- **Entry, Stop Loss & Targets** — Exact price levels calculated automatically
- **RSI, MACD, Bollinger Bands** — Technical indicators with beginner tooltips
- **Options Chain** — Nearest expiry calls & puts near current price
- **My Watchlist** — Add your own tickers, saved across sessions
- **ETF tab** — Lower-risk funds (SPY, QQQ, IWM, etc.)
- **Glossary** — Every term explained in plain English

Data is free — pulled from Yahoo Finance. No API key needed.

---

## How to Run

**Every morning, double-click `Trading Dashboard` on your Desktop.**

The browser opens automatically to `http://localhost:3000`. Press `Ctrl+C` in the terminal to stop.

### First-time setup (one time only)

```bash
# 1. Clone the repo
git clone https://github.com/your-username/trading-dashboard.git
cd trading-dashboard

# 2. Set up the Python backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn yfinance pandas ta-lib

# 3. Set up the React frontend
cd ../frontend
npm install
```

---

## Project Structure

```
trading-dashboard/
├── backend/
│   └── main.py          # FastAPI server — fetches data, computes signals
├── frontend/
│   └── src/App.tsx      # React dashboard UI
├── start.sh             # Terminal launcher (alternative to Desktop icon)
└── Trading Dashboard.command   # Desktop double-click launcher (Mac)
```

---

## Default Watchlist

These 10 stocks are shown every morning — chosen for high liquidity and day trading suitability:

| Ticker | Why |
|--------|-----|
| SPY | Most traded security in the world. Tracks S&P 500. |
| QQQ | Nasdaq top 100 tech stocks. Moves big on tech news. |
| AAPL | Most liquid single stock. Reliable, clean trends. |
| NVDA | AI leader. Massive volume, big daily moves. |
| TSLA | High volatility = big opportunities and risks. |
| AMZN | Steady large cap. Good for momentum trades. |
| MSFT | Smoother trends. Great for beginners. |
| META | Strong momentum, high volume. |
| AMD | Follows NVDA, active daily range. |
| GOOGL | Liquid, consistent, lower volatility. |

---

## How Signals Work

Each stock is scored using:

| Indicator | What it checks |
|-----------|---------------|
| RSI | Overbought (>70) or oversold (<30) |
| MACD | Momentum direction and crossovers |
| SMA 20/50 | Short and medium-term trend |
| Bollinger Bands | Support and resistance levels |
| ATR | Daily range — used to size stop loss and targets |

**Signal ratings:** `STRONG BUY` → `BUY` → `NEUTRAL` → `CAUTION` → `AVOID`

Stop loss = 1.5× ATR below entry. Target 1 = 2× ATR above. Target 2 = 3.5× ATR above.

---

## Disclaimer

For educational purposes only. Not financial advice. Always use a stop loss. Consider paper trading before risking real money.
