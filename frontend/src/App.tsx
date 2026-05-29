import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  TrendingUp, TrendingDown, RefreshCw, Star, AlertTriangle,
  ChevronDown, ChevronUp, Activity, Search, X, BookOpen, Info,
  ArrowUpCircle, ArrowDownCircle, MinusCircle, Ban
} from "lucide-react";

const API = "http://localhost:8000";

type Signal = { action: string; score: number; reasons: string[] };
type TickerData = {
  symbol: string; price: number; change_pct: number; volume: number;
  volume_ratio: number; rsi: number; macd: number; macd_signal: number;
  sma20: number; sma50: number; bb_upper: number; bb_lower: number;
  atr: number; support: number; resistance: number; stop_loss: number;
  target_1: number; target_2: number; signal: Signal;
  sector: string; pe_ratio: number | null; market_cap: number;
  price_history: { date: string; close: number }[];
  why_watch: string;
};
type Brief = {
  date: string; generated_at: string;
  watchlist: TickerData[];
  top_picks: TickerData[];
  avoid: TickerData[];
  market_summary: { bullish_count: number; bearish_count: number; neutral_count: number };
};
type OptionsData = {
  symbol: string; price: number; expiration: string;
  calls: { strike: number; lastPrice: number; volume: number; openInterest: number; iv: number }[];
  puts: { strike: number; lastPrice: number; volume: number; openInterest: number; iv: number }[];
};

const ACTION_BG: Record<string, string> = {
  "STRONG BUY": "bg-emerald-900 border-emerald-500",
  "BUY": "bg-emerald-950 border-emerald-700",
  "NEUTRAL": "bg-gray-800 border-gray-600",
  "CAUTION": "bg-amber-950 border-amber-700",
  "AVOID": "bg-red-950 border-red-700",
};

const ACTION_COLOR: Record<string, string> = {
  "STRONG BUY": "#10b981",
  "BUY": "#34d399",
  "NEUTRAL": "#6b7280",
  "CAUTION": "#f59e0b",
  "AVOID": "#ef4444",
};

const ACTION_PLAIN: Record<string, { emoji: string; headline: string; detail: string }> = {
  "STRONG BUY": {
    emoji: "🟢",
    headline: "Strong setup to buy",
    detail: "Multiple indicators align bullishly. Good risk/reward for an entry today.",
  },
  "BUY": {
    emoji: "🟩",
    headline: "Looks like a buy",
    detail: "More signals pointing up than down. Consider entering near current price.",
  },
  "NEUTRAL": {
    emoji: "⬜",
    headline: "No clear direction",
    detail: "Mixed signals. Best to wait and watch — don't force a trade.",
  },
  "CAUTION": {
    emoji: "🟡",
    headline: "Proceed with caution",
    detail: "Signals lean negative. If you're in, tighten your stop. If not, wait.",
  },
  "AVOID": {
    emoji: "🔴",
    headline: "Avoid today",
    detail: "Too many bearish signals. High risk of loss. Sit this one out.",
  },
};

const PLAIN_REASONS: Record<string, string> = {
  "Oversold (RSI)": "Price has dropped a lot recently — often bounces back up from here.",
  "Near oversold": "Price is getting low — potential buying opportunity forming.",
  "Overbought (RSI)": "Price has risen too fast — often pulls back from here. Risky to buy now.",
  "Near overbought": "Price is getting high — watch for signs of reversal before buying.",
  "MACD bullish crossover": "Momentum is picking up — buyers are gaining control.",
  "MACD bearish": "Momentum is slowing down — sellers may be taking over.",
  "Above SMA20 & SMA50 (uptrend)": "Price is above both short and long-term averages — strong uptrend.",
  "Below SMA20 & SMA50 (downtrend)": "Price is below both averages — in a downtrend. Avoid.",
  "Above SMA20": "Price is trending up short-term.",
};

const GLOSSARY: { term: string; simple: string; detail: string }[] = [
  {
    term: "RSI (Relative Strength Index)",
    simple: "Is the stock overbought or oversold?",
    detail: "Ranges 0–100. Below 30 = stock may be oversold (potential buy). Above 70 = stock may be overbought (potential sell or avoid). Think of it as a 'hype meter'.",
  },
  {
    term: "MACD",
    simple: "Is momentum increasing or decreasing?",
    detail: "Compares two moving averages. When the MACD line crosses above the signal line, momentum is picking up (bullish). When it crosses below, momentum is fading (bearish).",
  },
  {
    term: "Stop Loss",
    simple: "Your exit point if the trade goes wrong.",
    detail: "This is the price where you should sell to cut your loss. Never skip setting one. Rule: risk no more than 1–2% of your account on any trade.",
  },
  {
    term: "Target 1 / Target 2",
    simple: "Where to take profit.",
    detail: "Target 1 is a conservative profit goal. Target 2 is if the stock keeps running. You can sell half at T1 and let the rest ride to T2.",
  },
  {
    term: "Support",
    simple: "A price floor — where buyers tend to step in.",
    detail: "Support is a price level where the stock has bounced before. Buying near support gives you a better risk/reward because your stop loss is close.",
  },
  {
    term: "Resistance",
    simple: "A price ceiling — where sellers tend to step in.",
    detail: "Resistance is where the stock has stalled or reversed before. If price breaks through resistance, it can run fast (breakout). Avoid buying near resistance.",
  },
  {
    term: "ATR (Average True Range)",
    simple: "How much does this stock move in a day?",
    detail: "Higher ATR = bigger daily swings = more risk and reward. Used to set stop loss and profit targets proportionally to the stock's normal movement.",
  },
  {
    term: "SMA20 / SMA50",
    simple: "Short and medium-term trend direction.",
    detail: "SMA20 = average price over last 20 days. SMA50 = last 50 days. Price above both = uptrend. Below both = downtrend. Crossovers between them signal trend changes.",
  },
  {
    term: "Volume Ratio",
    simple: "Is today's trading activity unusually high?",
    detail: "1.0x = normal volume. 2.0x = twice the normal activity. High volume during a price move confirms the move is real. Low volume moves are less reliable.",
  },
  {
    term: "Bollinger Bands",
    simple: "A price range showing where the stock 'should' be.",
    detail: "The green dashed line = lower band (support zone). Red dashed line = upper band (resistance zone). Price outside the bands often snaps back inside.",
  },
  {
    term: "IV (Implied Volatility) — Options",
    simple: "How expensive are the options?",
    detail: "High IV = expensive options (market expects big move). Low IV = cheap options. Buy options when IV is low, avoid when IV is high — you overpay.",
  },
  {
    term: "Strike Price — Options",
    simple: "The price you bet the stock will reach.",
    detail: "For a call: you profit if stock goes above the strike. For a put: you profit if it falls below. Choose strikes close to current price for higher probability of profit.",
  },
  {
    term: "Open Interest — Options",
    simple: "How popular is this options contract?",
    detail: "Higher open interest = more traders watching this level = easier to buy/sell. Low open interest contracts are harder to exit quickly.",
  },
];

// ─── Tooltip component ───────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-gray-500 hover:text-blue-400 ml-1"
      >
        <Info size={12} />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-800 border border-gray-600 rounded-lg p-2 text-xs text-gray-200 z-50 shadow-xl">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-600" />
        </div>
      )}
    </div>
  );
}

// ─── Plain-English summary ────────────────────────────────────────
function PlainSummary({ data }: { data: TickerData }) {
  const meta = ACTION_PLAIN[data.signal.action] || ACTION_PLAIN["NEUTRAL"];
  const rsiNote =
    data.rsi < 35 ? "Price is beaten down and may bounce." :
    data.rsi > 65 ? "Price has run up a lot — be careful." :
    "Price is in healthy territory.";
  const volNote = data.volume_ratio > 1.5
    ? `Trading volume is ${data.volume_ratio.toFixed(1)}x higher than normal — strong conviction behind this move.`
    : "Volume is normal.";
  const riskReward = ((data.target_1 - data.price) / (data.price - data.stop_loss)).toFixed(1);

  return (
    <div className="bg-gray-900 rounded-lg p-3 mb-3 border border-gray-700">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{meta.emoji}</span>
        <span className="text-white font-bold text-sm">{meta.headline}</span>
      </div>
      <p className="text-gray-300 text-xs leading-relaxed">{meta.detail}</p>
      <p className="text-gray-400 text-xs mt-1">{rsiNote} {volNote}</p>
      {data.signal.action !== "AVOID" && data.signal.action !== "CAUTION" && (
        <div className="mt-2 pt-2 border-t border-gray-700 grid grid-cols-3 gap-1 text-center text-xs">
          <div>
            <div className="text-gray-500">Buy near</div>
            <div className="text-blue-400 font-bold">${data.price.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Cut loss at</div>
            <div className="text-red-400 font-bold">${data.stop_loss.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Risk/Reward</div>
            <div className={`font-bold ${Number(riskReward) >= 1.5 ? "text-emerald-400" : "text-yellow-400"}`}>1:{riskReward}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Signal badge ─────────────────────────────────────────────────
function SignalBadge({ action }: { action: string }) {
  const color = ACTION_COLOR[action] || "#6b7280";
  return (
    <span className="px-2 py-0.5 rounded text-xs font-bold border" style={{ color, borderColor: color }}>
      {action}
    </span>
  );
}

// ─── RSI bar ──────────────────────────────────────────────────────
function RSIBar({ value }: { value: number }) {
  const color = value < 30 ? "#10b981" : value > 70 ? "#ef4444" : "#6b7280";
  const label = value < 30 ? "Oversold — potential buy zone" : value > 70 ? "Overbought — risky to buy" : "Neutral zone";
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1 items-center">
        <span className="text-gray-400 flex items-center">
          RSI
          <InfoTooltip text="0–30: oversold (stock may be cheap). 70–100: overbought (stock may be expensive). Sweet spot to buy: 30–50." />
        </span>
        <span style={{ color }} className="font-bold">{value} — {label}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden relative">
        <div className="absolute left-0 top-0 h-full w-[30%] bg-emerald-900 opacity-40" />
        <div className="absolute right-0 top-0 h-full w-[30%] bg-red-900 opacity-40" />
        <div className="h-full rounded-full absolute" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color, opacity: 0.9 }} />
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-0.5">
        <span>30 Buy zone</span><span>Sell zone 70</span>
      </div>
    </div>
  );
}

// ─── Price chart ──────────────────────────────────────────────────
function PriceChart({ data, support, resistance }: {
  data: { date: string; close: number }[];
  support: number;
  resistance: number;
}) {
  return (
    <div>
      <div className="flex gap-3 text-xs mb-1">
        <span className="flex items-center gap-1 text-emerald-400"><span className="inline-block w-4 border-t-2 border-dashed border-emerald-400" /> Support (floor)</span>
        <span className="flex items-center gap-1 text-red-400"><span className="inline-block w-4 border-t-2 border-dashed border-red-400" /> Resistance (ceiling)</span>
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data}>
          <XAxis dataKey="date" hide />
          <YAxis domain={["auto", "auto"]} hide />
          <RechartsTooltip
            contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: "#9ca3af" }}
            itemStyle={{ color: "#34d399" }}
            formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, "Price"]}
          />
          <ReferenceLine y={support} stroke="#10b981" strokeDasharray="4 3" />
          <ReferenceLine y={resistance} stroke="#ef4444" strokeDasharray="4 3" />
          <Line type="monotone" dataKey="close" stroke="#60a5fa" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Ticker card ──────────────────────────────────────────────────
function TickerCard({ data, onSelect }: { data: TickerData; onSelect: (s: string) => void }) {
  const [showTech, setShowTech] = useState(false);
  const bgClass = ACTION_BG[data.signal.action] || "bg-gray-800 border-gray-600";
  const isUp = data.change_pct >= 0;

  const plainReasons = data.signal.reasons.map(r => PLAIN_REASONS[r] || r);

  return (
    <div className={`rounded-xl border p-4 ${bgClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg">{data.symbol}</span>
            <SignalBadge action={data.signal.action} />
          </div>
          <div className="text-gray-400 text-xs mt-0.5">{data.sector}</div>
          <div className="text-blue-300 text-xs mt-1 max-w-xs leading-relaxed">{data.why_watch}</div>
        </div>
        <div className="text-right">
          <div className="text-white font-bold text-xl">${data.price.toFixed(2)}</div>
          <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
            {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isUp ? "+" : ""}{data.change_pct.toFixed(2)}% today
          </div>
        </div>
      </div>

      {/* Plain English Summary */}
      <PlainSummary data={data} />

      {/* Chart */}
      <PriceChart data={data.price_history} support={data.support} resistance={data.resistance} />

      {/* Trade levels */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-900 rounded-lg p-2 border border-red-900">
          <div className="text-gray-400 text-xs flex items-center justify-center gap-1">
            Stop Loss
            <InfoTooltip text="Sell HERE if trade goes wrong. Protects you from big losses. Set a sell order at this price when you buy." />
          </div>
          <div className="text-red-400 font-bold">${data.stop_loss.toFixed(2)}</div>
          <div className="text-red-600 text-xs">Exit if hits this</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-2 border border-emerald-900">
          <div className="text-gray-400 text-xs flex items-center justify-center gap-1">
            Target 1
            <InfoTooltip text="Take some profit here. Consider selling half your position at this price." />
          </div>
          <div className="text-emerald-400 font-bold">${data.target_1.toFixed(2)}</div>
          <div className="text-emerald-700 text-xs">Take some profit</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-2 border border-emerald-950">
          <div className="text-gray-400 text-xs flex items-center justify-center gap-1">
            Target 2
            <InfoTooltip text="If the stock keeps climbing, this is your extended profit goal. Let remaining shares ride here." />
          </div>
          <div className="text-emerald-300 font-bold">${data.target_2.toFixed(2)}</div>
          <div className="text-emerald-800 text-xs">If it keeps running</div>
        </div>
      </div>

      {/* RSI bar */}
      <div className="mt-3">
        <RSIBar value={data.rsi} />
      </div>

      {/* Why section */}
      {plainReasons.length > 0 && (
        <div className="mt-3 bg-gray-900 rounded-lg p-3">
          <div className="text-xs text-gray-400 font-semibold mb-2">Why this signal?</div>
          <ul className="space-y-1">
            {plainReasons.map((r, i) => (
              <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 inline-block flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Technical details (collapsible) */}
      <div className="mt-3">
        <button
          onClick={() => setShowTech(!showTech)}
          className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 w-full"
        >
          {showTech ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showTech ? "Hide" : "Show"} technical details
        </button>
        {showTech && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="text-gray-400 flex items-center">
              RSI <InfoTooltip text="Momentum indicator. Below 30 = oversold. Above 70 = overbought." />: <span className="text-gray-200 ml-1 font-semibold">{data.rsi}</span>
            </div>
            <div className="text-gray-400 flex items-center">
              ATR <InfoTooltip text="Average daily price range — how much this stock normally moves per day." />: <span className="text-blue-400 ml-1 font-semibold">${data.atr.toFixed(2)}</span>
            </div>
            <div className="text-gray-400 flex items-center">
              Support <InfoTooltip text="Price floor where buyers tend to step in. Good place to buy." />: <span className="text-emerald-400 ml-1 font-semibold">${data.support.toFixed(2)}</span>
            </div>
            <div className="text-gray-400 flex items-center">
              Resistance <InfoTooltip text="Price ceiling where sellers tend to step in. Avoid buying near here." />: <span className="text-red-400 ml-1 font-semibold">${data.resistance.toFixed(2)}</span>
            </div>
            <div className="text-gray-400 flex items-center">
              Vol Ratio <InfoTooltip text="Today's volume vs. average. 2x = twice as many trades as normal = stronger signal." />: <span className={`ml-1 font-semibold ${data.volume_ratio > 1.5 ? "text-yellow-400" : "text-gray-300"}`}>{data.volume_ratio.toFixed(2)}x</span>
            </div>
            <div className="text-gray-400 flex items-center">
              SMA20 <InfoTooltip text="20-day average price. Price above this = short-term uptrend." />: <span className="text-gray-200 ml-1 font-semibold">${data.sma20.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => onSelect(data.symbol)}
        className="mt-3 w-full text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 rounded-lg py-1.5 transition-colors"
      >
        View Options Chain
      </button>
    </div>
  );
}

// ─── Glossary modal ───────────────────────────────────────────────
function GlossaryModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-400" />
            <h2 className="text-white font-bold text-xl">Beginner's Glossary</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          {GLOSSARY.map((g, i) => (
            <div key={i} className="border border-gray-800 rounded-xl p-4">
              <div className="text-blue-400 font-bold text-sm mb-1">{g.term}</div>
              <div className="text-emerald-400 text-xs font-semibold mb-2">In plain English: {g.simple}</div>
              <div className="text-gray-300 text-xs leading-relaxed">{g.detail}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-amber-950 border border-amber-700 rounded-xl p-3 text-xs text-amber-200">
          <strong>Reminder:</strong> These signals are based on technical analysis only. They don't account for news, earnings, or market conditions. Always use a stop loss. Never risk more than you can afford to lose. Consider paper trading (fake money) first.
        </div>
      </div>
    </div>
  );
}

// ─── Options modal ────────────────────────────────────────────────
function OptionsModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API}/api/options/${symbol}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => { setError("No options data available for this symbol."); setLoading(false); });
  }, [symbol]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-white font-bold text-xl">{symbol} Options Chain</h2>
            {data && <div className="text-gray-400 text-sm">Price: ${data.price.toFixed(2)} · Nearest Expiry: {data.expiration}</div>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="bg-blue-950 border border-blue-800 rounded-lg p-3 mb-4 text-xs text-blue-200">
          <strong>Options basics:</strong> A <span className="text-emerald-400 font-semibold">Call</span> profits if price goes UP past the strike. A <span className="text-red-400 font-semibold">Put</span> profits if price goes DOWN below the strike. Higher volume & open interest = more popular contract. Lower IV = cheaper premium.
        </div>

        {loading && <div className="text-gray-400 text-center py-8">Loading options chain...</div>}
        {error && <div className="text-red-400 text-center py-8">{error}</div>}

        {data && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-emerald-400 font-semibold mb-2 flex items-center gap-1">
                <TrendingUp size={14} /> Calls — Bet price goes UP
              </h3>
              <div className="space-y-2">
                {data.calls.map((c, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3 text-xs">
                    <div className="flex justify-between mb-1">
                      <div>
                        <span className="text-white font-bold">Strike ${c.strike.toFixed(2)}</span>
                        <div className="text-gray-500 text-xs">Stock must go above this</div>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-400 font-bold">${c.lastPrice.toFixed(2)}</span>
                        <div className="text-gray-500 text-xs">cost per contract ×100</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-gray-400 mt-1">
                      <span>Vol: <span className="text-gray-200">{c.volume.toLocaleString()}</span></span>
                      <span>OI: <span className="text-gray-200">{c.openInterest.toLocaleString()}</span></span>
                      <span>IV: <span className="text-yellow-400">{c.iv}%</span></span>
                    </div>
                  </div>
                ))}
                {data.calls.length === 0 && <div className="text-gray-500 text-xs">No call data</div>}
              </div>
            </div>
            <div>
              <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-1">
                <TrendingDown size={14} /> Puts — Bet price goes DOWN
              </h3>
              <div className="space-y-2">
                {data.puts.map((p, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3 text-xs">
                    <div className="flex justify-between mb-1">
                      <div>
                        <span className="text-white font-bold">Strike ${p.strike.toFixed(2)}</span>
                        <div className="text-gray-500 text-xs">Stock must drop below this</div>
                      </div>
                      <div className="text-right">
                        <span className="text-red-400 font-bold">${p.lastPrice.toFixed(2)}</span>
                        <div className="text-gray-500 text-xs">cost per contract ×100</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-gray-400 mt-1">
                      <span>Vol: <span className="text-gray-200">{p.volume.toLocaleString()}</span></span>
                      <span>OI: <span className="text-gray-200">{p.openInterest.toLocaleString()}</span></span>
                      <span>IV: <span className="text-yellow-400">{p.iv}%</span></span>
                    </div>
                  </div>
                ))}
                {data.puts.length === 0 && <div className="text-gray-500 text-xs">No put data</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── My Watchlist tab ─────────────────────────────────────────────
const MY_WATCHLIST_KEY = "my_watchlist_v1";

function MyWatchlistTab({ onSelect }: { onSelect: (s: string) => void }) {
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(MY_WATCHLIST_KEY) || "[]"); }
    catch { return []; }
  });
  const [input, setInput] = useState("");
  const [data, setData] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const persist = (list: string[]) => {
    setSaved(list);
    localStorage.setItem(MY_WATCHLIST_KEY, JSON.stringify(list));
  };

  const addTicker = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = input.trim().toUpperCase().replace(/\s/g, "");
    if (!sym) return;
    const tickers = sym.split(",").filter(s => s && !saved.includes(s));
    if (tickers.length) persist([...saved, ...tickers]);
    setInput("");
    setError("");
  };

  const removeTicker = (sym: string) => {
    persist(saved.filter(s => s !== sym));
    setData(prev => prev.filter(d => d.symbol !== sym));
  };

  const fetchMyWatchlist = useCallback(async () => {
    if (saved.length === 0) { setData([]); return; }
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/api/morning-brief?symbols=${saved.join(",")}`);
      setData(res.data.watchlist);
    } catch {
      setError("Failed to load data. Check tickers and try again.");
    }
    setLoading(false);
  }, [saved]);

  useEffect(() => { fetchMyWatchlist(); }, [fetchMyWatchlist]);

  return (
    <div>
      {/* Add ticker bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="text-white font-semibold mb-1">My Watchlist</div>
        <div className="text-gray-400 text-xs mb-3">Add any stock or ETF ticker. Saved in your browser — persists between sessions.</div>
        <form onSubmit={addTicker} className="flex gap-2 mb-4">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type ticker(s): AAPL or AAPL,GOOG,AMZN"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold flex items-center gap-1">
            <Search size={14} /> Add
          </button>
        </form>

        {/* Saved ticker chips */}
        {saved.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {saved.map(sym => (
              <div key={sym} className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm">
                <span className="text-white font-semibold">{sym}</span>
                <button onClick={() => removeTicker(sym)} className="text-gray-500 hover:text-red-400 ml-1">
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={fetchMyWatchlist}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        )}
      </div>

      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

      {saved.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Star size={36} className="mx-auto mb-3 text-gray-700" />
          <div className="text-lg text-gray-400">Your watchlist is empty</div>
          <div className="text-sm mt-1">Add tickers above to track your own stocks every morning.</div>
        </div>
      )}

      {loading && saved.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {saved.map((_, i) => <div key={i} className="h-96 bg-gray-900 rounded-xl animate-pulse border border-gray-800" />)}
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(t => <TickerCard key={t.symbol} data={t} onSelect={onSelect} />)}
        </div>
      )}

      {!loading && saved.length > 0 && data.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500 text-sm">No data returned. Tickers may be invalid.</div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────
type Tab = "brief" | "watchlist" | "mine" | "etfs";

export default function App() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [etfs, setEtfs] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("brief");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchBrief = useCallback(async () => {
    setLoading(true);
    try {
      const [briefRes, etfRes] = await Promise.all([
        axios.get(`${API}/api/morning-brief`),
        axios.get(`${API}/api/etfs`),
      ]);
      setBrief(briefRes.data);
      setEtfs(etfRes.data.etfs);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Failed to fetch data:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBrief(); }, [fetchBrief]);

  const ms = brief?.market_summary;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {selectedSymbol && <OptionsModal symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} />}
      {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}

      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={22} className="text-blue-400" />
              <h1 className="text-xl font-bold">Morning Trading Brief</h1>
            </div>
            {brief && (
              <div className="text-gray-500 text-xs mt-0.5">
                {new Date(brief.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                {lastUpdated && ` · Updated ${lastUpdated}`}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGlossary(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-semibold text-gray-300 transition-colors"
            >
              <BookOpen size={15} />
              Glossary
            </button>
            <button
              onClick={fetchBrief}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Market sentiment */}
        {ms && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 flex items-center gap-6 flex-wrap">
            <div className="text-gray-300 text-sm font-semibold">Today's Market Mood</div>
            <div className="flex items-center gap-2 text-emerald-400">
              <ArrowUpCircle size={18} />
              <span className="font-bold text-lg">{ms.bullish_count}</span>
              <span className="text-xs text-gray-400">stocks looking bullish (good to buy)</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <MinusCircle size={18} />
              <span className="font-bold text-lg">{ms.neutral_count}</span>
              <span className="text-xs">neutral (wait and see)</span>
            </div>
            <div className="flex items-center gap-2 text-red-400">
              <ArrowDownCircle size={18} />
              <span className="font-bold text-lg">{ms.bearish_count}</span>
              <span className="text-xs text-gray-400">bearish (avoid)</span>
            </div>
          </div>
        )}

        {/* Beginner tip bar */}
        <div className="bg-blue-950 border border-blue-900 rounded-xl p-3 mb-6 text-xs text-blue-200 flex items-start gap-2">
          <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong>How to use this:</strong> Check "Top Picks" each morning for the best setups. For each stock: buy near the current price, place a stop loss order immediately, and take profit at Target 1. Hover the <Info size={10} className="inline" /> icons for explanations. Click "Glossary" to learn any term.
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-lg w-fit border border-gray-800">
          {([
            { key: "brief" as Tab, label: "Top Picks", icon: <Star size={14} />, desc: "Best setups today" },
            { key: "watchlist" as Tab, label: "Market Watchlist", icon: <Activity size={14} />, desc: "Top 10 day trading stocks" },
            { key: "mine" as Tab, label: "My Watchlist", icon: <Star size={14} className="text-yellow-400" />, desc: "Your personal stocks" },
            { key: "etfs" as Tab, label: "ETFs", icon: <TrendingUp size={14} />, desc: "Lower risk funds" },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
              title={t.desc}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {loading && tab !== "mine" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-96 bg-gray-900 rounded-xl animate-pulse border border-gray-800" />
            ))}
          </div>
        )}

        {!loading && tab === "brief" && brief && (
          <>
            {brief.top_picks.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <AlertTriangle size={36} className="mx-auto mb-3 text-yellow-600" />
                <div className="text-lg text-gray-300">No strong signals today</div>
                <div className="text-sm mt-1">Market may be choppy. Best move: do nothing. Wait for clearer setups tomorrow.</div>
              </div>
            )}
            {brief.top_picks.length > 0 && (
              <>
                <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-widest">Today's Best Setups — Consider these first</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {brief.top_picks.map(t => <TickerCard key={t.symbol} data={t} onSelect={setSelectedSymbol} />)}
                </div>
              </>
            )}
            {brief.avoid.length > 0 && (
              <>
                <h2 className="text-xs font-semibold text-red-500 mb-3 uppercase tracking-widest flex items-center gap-1">
                  <Ban size={12} /> Avoid or Use Caution Today — Don't trade these
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brief.avoid.map(t => <TickerCard key={t.symbol} data={t} onSelect={setSelectedSymbol} />)}
                </div>
              </>
            )}
          </>
        )}

        {!loading && tab === "watchlist" && brief && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brief.watchlist.map(t => <TickerCard key={t.symbol} data={t} onSelect={setSelectedSymbol} />)}
          </div>
        )}

        {tab === "mine" && <MyWatchlistTab onSelect={setSelectedSymbol} />}

        {!loading && tab === "etfs" && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 text-xs text-gray-300">
              <strong className="text-white">What are ETFs?</strong> Exchange-Traded Funds hold many stocks at once (e.g. SPY holds all 500 S&P 500 companies). Lower risk than single stocks. Great for beginners. SPY and QQQ are the most popular day-traded ETFs.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {etfs.map(t => <TickerCard key={t.symbol} data={t} onSelect={setSelectedSymbol} />)}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-xs text-gray-600 text-center">
          Data from Yahoo Finance. For educational purposes only — not financial advice. Always do your own research. Past signals do not guarantee future results.
        </div>
      </footer>
    </div>
  );
}
