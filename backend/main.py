from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import talib
import numpy as np
from datetime import datetime, date
from typing import Optional
import warnings
warnings.filterwarnings("ignore")

app = FastAPI(title="Trading Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Top 10 most actively traded, liquid stocks — ideal for day trading beginners.
# High volume = easy to buy/sell quickly, tight spreads, lots of data.
DEFAULT_WATCHLIST = [
    "SPY",   # S&P 500 ETF — most traded security in the world, great for reading market direction
    "QQQ",   # Nasdaq ETF — tech-heavy, moves big on tech news
    "AAPL",  # Apple — highest market cap, extremely liquid, reliable mover
    "NVDA",  # NVIDIA — AI darling, huge daily moves, high volume
    "TSLA",  # Tesla — volatile, emotional stock, big swings = day trading opportunities
    "AMZN",  # Amazon — large cap, steady trends, good for beginners
    "MSFT",  # Microsoft — less volatile than TSLA/NVDA, smoother trends
    "META",  # Meta — high volume, moves well on momentum
    "AMD",   # AMD — semiconductor, active, follows NVDA direction often
    "GOOGL", # Google — large cap, liquid, good range
]
ETF_LIST = ["SPY", "QQQ", "IWM", "DIA", "XLF", "XLK", "ARKK"]

TICKER_WHY: dict[str, str] = {
    "SPY":   "Most liquid security in the world. Tracks all 500 largest US companies. Great for reading overall market direction before trading anything else.",
    "QQQ":   "Tracks the top 100 Nasdaq tech stocks. Moves big on tech news and earnings. High volume every day.",
    "AAPL":  "Apple — most actively traded single stock. Extremely liquid, reliable trends, and rarely has wild unpredictable swings.",
    "NVDA":  "NVIDIA — AI chip leader. Massive daily volume and big price moves. One of the most popular day trading stocks right now.",
    "TSLA":  "Tesla — high volatility and emotion. Big swings create big opportunities (and risks). Follow the trend closely.",
    "AMZN":  "Amazon — steady large cap with reliable trends. Good stock to trade breakouts and momentum.",
    "MSFT":  "Microsoft — less volatile than TSLA or NVDA. Cleaner, smoother trends. Great for beginners learning to read charts.",
    "META":  "Meta (Facebook) — high volume, strong momentum moves. Reacts well to market sentiment.",
    "AMD":   "AMD — semiconductor stock that often mirrors NVDA's direction. Active, liquid, good daily range.",
    "GOOGL": "Google — massive liquid stock with consistent volume. Lower volatility than TSLA, reliable technical setups.",
}


def get_signal(rsi: float, macd: float, macd_signal: float, price: float, sma20: float, sma50: float) -> dict:
    signals = []
    score = 0

    if rsi < 30:
        signals.append("Oversold (RSI)")
        score += 2
    elif rsi < 40:
        signals.append("Near oversold")
        score += 1
    elif rsi > 70:
        signals.append("Overbought (RSI)")
        score -= 2
    elif rsi > 60:
        signals.append("Near overbought")
        score -= 1

    if macd > macd_signal:
        signals.append("MACD bullish crossover")
        score += 1
    else:
        signals.append("MACD bearish")
        score -= 1

    if price > sma20 > sma50:
        signals.append("Above SMA20 & SMA50 (uptrend)")
        score += 2
    elif price < sma20 < sma50:
        signals.append("Below SMA20 & SMA50 (downtrend)")
        score -= 2
    elif price > sma20:
        signals.append("Above SMA20")
        score += 1

    if score >= 3:
        action = "STRONG BUY"
    elif score >= 1:
        action = "BUY"
    elif score <= -3:
        action = "AVOID"
    elif score <= -1:
        action = "CAUTION"
    else:
        action = "NEUTRAL"

    return {"action": action, "score": score, "reasons": signals}


def analyze_ticker(symbol: str) -> dict:
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="3mo")

        if hist.empty or len(hist) < 50:
            return None

        close = hist["Close"].values.astype(float)
        high = hist["High"].values.astype(float)
        low = hist["Low"].values.astype(float)
        volume = hist["Volume"].values.astype(float)

        rsi = talib.RSI(close, timeperiod=14)
        macd, macd_signal, _ = talib.MACD(close)
        sma20 = talib.SMA(close, timeperiod=20)
        sma50 = talib.SMA(close, timeperiod=50)
        bb_upper, bb_mid, bb_lower = talib.BBANDS(close, timeperiod=20)
        atr = talib.ATR(high, low, close, timeperiod=14)

        current_price = float(close[-1])
        current_rsi = float(rsi[-1]) if not np.isnan(rsi[-1]) else 50.0
        current_macd = float(macd[-1]) if not np.isnan(macd[-1]) else 0.0
        current_signal = float(macd_signal[-1]) if not np.isnan(macd_signal[-1]) else 0.0
        current_sma20 = float(sma20[-1]) if not np.isnan(sma20[-1]) else current_price
        current_sma50 = float(sma50[-1]) if not np.isnan(sma50[-1]) else current_price
        current_bb_upper = float(bb_upper[-1]) if not np.isnan(bb_upper[-1]) else current_price
        current_bb_lower = float(bb_lower[-1]) if not np.isnan(bb_lower[-1]) else current_price
        current_atr = float(atr[-1]) if not np.isnan(atr[-1]) else 0.0

        prev_close = float(close[-2]) if len(close) > 1 else current_price
        day_change_pct = ((current_price - prev_close) / prev_close) * 100

        avg_volume = float(np.mean(volume[-20:]))
        current_volume = float(volume[-1])
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0

        signal = get_signal(current_rsi, current_macd, current_signal, current_price, current_sma20, current_sma50)

        support = round(current_bb_lower, 2)
        resistance = round(current_bb_upper, 2)
        stop_loss = round(current_price - (current_atr * 1.5), 2)
        target_1 = round(current_price + (current_atr * 2), 2)
        target_2 = round(current_price + (current_atr * 3.5), 2)

        info = ticker.info
        market_cap = info.get("marketCap", 0)
        sector = info.get("sector", "N/A")
        pe_ratio = info.get("trailingPE", None)

        price_history = [
            {"date": str(hist.index[i].date()), "close": round(float(close[i]), 2)}
            for i in range(-30, 0)
        ]

        return {
            "symbol": symbol,
            "price": round(current_price, 2),
            "change_pct": round(day_change_pct, 2),
            "volume": int(current_volume),
            "volume_ratio": round(volume_ratio, 2),
            "rsi": round(current_rsi, 1),
            "macd": round(current_macd, 4),
            "macd_signal": round(current_signal, 4),
            "sma20": round(current_sma20, 2),
            "sma50": round(current_sma50, 2),
            "bb_upper": round(current_bb_upper, 2),
            "bb_lower": round(current_bb_lower, 2),
            "atr": round(current_atr, 2),
            "support": support,
            "resistance": resistance,
            "stop_loss": stop_loss,
            "target_1": target_1,
            "target_2": target_2,
            "signal": signal,
            "sector": sector,
            "pe_ratio": round(pe_ratio, 2) if pe_ratio else None,
            "market_cap": market_cap,
            "price_history": price_history,
            "why_watch": TICKER_WHY.get(symbol, "High-volume stock suitable for day trading."),
        }
    except Exception as e:
        print(f"Error analyzing {symbol}: {e}")
        return None


def get_options_snapshot(symbol: str, price: float) -> dict:
    try:
        ticker = yf.Ticker(symbol)
        expirations = ticker.options
        if not expirations:
            return None

        nearest_exp = expirations[0]
        chain = ticker.option_chain(nearest_exp)

        calls = chain.calls
        puts = chain.puts

        near_calls = calls[
            (calls["strike"] >= price * 0.97) & (calls["strike"] <= price * 1.05)
        ].nlargest(3, "volume")[["strike", "lastPrice", "volume", "openInterest", "impliedVolatility"]]

        near_puts = puts[
            (puts["strike"] >= price * 0.95) & (puts["strike"] <= price * 1.03)
        ].nlargest(3, "volume")[["strike", "lastPrice", "volume", "openInterest", "impliedVolatility"]]

        def df_to_list(df):
            rows = []
            for _, row in df.iterrows():
                rows.append({
                    "strike": float(row["strike"]),
                    "lastPrice": float(row["lastPrice"]),
                    "volume": int(row["volume"]) if not pd.isna(row["volume"]) else 0,
                    "openInterest": int(row["openInterest"]) if not pd.isna(row["openInterest"]) else 0,
                    "iv": round(float(row["impliedVolatility"]) * 100, 1) if not pd.isna(row["impliedVolatility"]) else 0,
                })
            return rows

        return {
            "expiration": nearest_exp,
            "calls": df_to_list(near_calls),
            "puts": df_to_list(near_puts),
        }
    except Exception as e:
        print(f"Options error {symbol}: {e}")
        return None


@app.get("/api/morning-brief")
def morning_brief(symbols: Optional[str] = None):
    watchlist = symbols.split(",") if symbols else DEFAULT_WATCHLIST
    results = []

    for sym in watchlist:
        data = analyze_ticker(sym.strip().upper())
        if data:
            results.append(data)

    results.sort(key=lambda x: x["signal"]["score"], reverse=True)

    top_picks = [r for r in results if r["signal"]["action"] in ("STRONG BUY", "BUY")][:3]
    avoid = [r for r in results if r["signal"]["action"] in ("AVOID", "CAUTION")]

    return {
        "date": str(date.today()),
        "generated_at": datetime.now().isoformat(),
        "watchlist": results,
        "top_picks": top_picks,
        "avoid": avoid,
        "market_summary": {
            "bullish_count": len([r for r in results if r["signal"]["score"] > 0]),
            "bearish_count": len([r for r in results if r["signal"]["score"] < 0]),
            "neutral_count": len([r for r in results if r["signal"]["score"] == 0]),
        },
    }


@app.get("/api/options/{symbol}")
def get_options(symbol: str):
    ticker = yf.Ticker(symbol.upper())
    hist = ticker.history(period="5d")
    if hist.empty:
        raise HTTPException(status_code=404, detail="Symbol not found")
    price = float(hist["Close"].iloc[-1])
    options = get_options_snapshot(symbol.upper(), price)
    if not options:
        raise HTTPException(status_code=404, detail="No options data")
    return {"symbol": symbol.upper(), "price": round(price, 2), **options}


@app.get("/api/etfs")
def get_etfs():
    results = []
    for sym in ETF_LIST:
        data = analyze_ticker(sym)
        if data:
            results.append(data)
    return {"etfs": results}


@app.get("/api/ticker/{symbol}")
def get_ticker(symbol: str):
    data = analyze_ticker(symbol.upper())
    if not data:
        raise HTTPException(status_code=404, detail="Could not fetch data")
    options = get_options_snapshot(symbol.upper(), data["price"])
    return {**data, "options": options}


@app.get("/health")
def health():
    return {"status": "ok"}
