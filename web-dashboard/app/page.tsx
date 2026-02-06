'use client';

import { useEffect, useState, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, DollarSign, Activity, Wallet, Cpu, TrendingUp, RefreshCw, Settings, ShieldCheck, Server, Globe, Calendar, Download } from 'lucide-react';

export default function Dashboard() {
  const [tick, setTick] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<'ONLINE' | 'OFFLINE' | 'RECONNECTING'>('OFFLINE');
  const [showSettings, setShowSettings] = useState(false);
  const [mt5Config, setMt5Config] = useState({ login: '', password: '', server: '' });
  const [currentTimeframe, setCurrentTimeframe] = useState('M15');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [series, setSeries] = useState<ISeriesApi<"Candlestick"> | null>(null);
  const [lastCandle, setLastCandle] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestResults, setBacktestResults] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [lastTickTime, setLastTickTime] = useState<number>(Date.now());
  const [isWatchdogActive, setIsWatchdogActive] = useState(true);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const cumulativePVRef = useRef<number>(0);
  const cumulativeVRef = useRef<number>(0);

  // Load Config on Load
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.login) setMt5Config(prev => ({ ...prev, login: data.login, server: data.server }));
      });
  }, []);

  // 1. Initialize Chart (Once)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartInstance = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#64748b',
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: 'rgba(255, 255, 255, 0.05)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const candlestickSeries = chartInstance.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const vwapSeries = chartInstance.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'VWAP',
    });

    chartInstanceRef.current = chartInstance;
    setSeries(candlestickSeries);
    vwapSeriesRef.current = vwapSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chartInstance.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.remove();
    };
  }, []);

  // 2. Fetch History on Timeframe change
  useEffect(() => {
    if (!series || !chartInstanceRef.current) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/history?tf=${currentTimeframe}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const sorted = data
            .map((d: any) => ({
              time: Number(d.time) as Time,
              open: Number(d.open),
              high: Number(d.high),
              low: Number(d.low),
              close: Number(d.close),
            }))
            .sort((a, b) => (a.time as number) - (b.time as number));

          series.setData(sorted);
          setLastCandle(sorted[sorted.length - 1]);

          // Calculate and set VWAP
          let cpv = 0;
          let cv = 0;
          const vwapData = sorted.map(d => {
            const vol = (d as any).volume || 1;
            const typicalPrice = (d.high + d.low + d.close) / 3;
            cpv += typicalPrice * vol;
            cv += vol;
            return { time: d.time, value: cpv / cv };
          });
          cumulativePVRef.current = cpv;
          cumulativeVRef.current = cv;
          vwapSeriesRef.current?.setData(vwapData);

          chartInstanceRef.current?.timeScale().fitContent();
          setLastTickTime(Date.now());
          setSystemStatus('ONLINE');
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };

    fetchHistory();
  }, [series, currentTimeframe]);

  // 3. Poll Real-Time Data
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const resTick = await fetch('/api/tick');
        const dataTick = await resTick.json();
        if (dataTick.bid > 0) {
          setTick(dataTick);
          setLastTickTime(Date.now());
          setSystemStatus('ONLINE');

          if (series && lastCandle) {
            const price = dataTick.bid;
            if (price < 100) return;

            setLastCandle((prev: any) => {
              if (!prev) return null;
              const updated = {
                ...prev,
                close: price,
                high: Math.max(prev.high, price),
                low: Math.min(prev.low, price)
              };
              series.update(updated);

              // Update VWAP live (Estimate)
              const vwapValue = (cumulativePVRef.current + price) / (cumulativeVRef.current + 1);
              vwapSeriesRef.current?.update({ time: updated.time, value: vwapValue });

              return updated;
            });
          }
        }

        const resTrades = await fetch('/api/trade');
        const dataTrades = await resTrades.json();
        setTrades(Array.isArray(dataTrades) ? dataTrades : []);
      } catch (error) {
        setSystemStatus('OFFLINE');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [series, lastCandle]);

  // --- WATCHDOG SYSTEM ---
  useEffect(() => {
    const watchdogInterval = setInterval(async () => {
      if (!isWatchdogActive || systemStatus !== 'ONLINE') return;

      const timeSinceLastTick = Date.now() - lastTickTime;

      if (timeSinceLastTick > 15000) {
        console.warn(`Watchdog: Data stalled for ${timeSinceLastTick}ms. Attempting auto-restart...`);
        setSystemStatus('RECONNECTING');
        try {
          const res = await fetch('/api/bridge/restart', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            console.log("Watchdog: Restart command sent successfully.");
          }
        } catch (e) {
          console.error("Watchdog: Failed to send restart command", e);
        }
      }
    }, 1000);

    return () => clearInterval(watchdogInterval);
  }, [lastTickTime, isWatchdogActive, systemStatus]);

  // Fetch News Context on mount
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const resp = await fetch('/api/context');
        const data = await resp.json();
        if (data.success) {
          setNews(data.news);
        }
      } catch (e) {
        console.error("Failed to fetch news context", e);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 3600000); // Hourly
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans selection:bg-blue-500/30">
      <div className="relative z-10 max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">

        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-500/10 rounded-md border border-blue-500/20">
              <TrendingUp className="text-blue-500 w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase flex items-center gap-2">
              XAUUSD <span className="text-slate-500 font-light">QUANT VERSION</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-slate-800/80 border border-slate-700/50 rounded-md flex items-center gap-3">
              <div className="flex items-center gap-1.5 border-r border-white/5 pr-3">
                <ShieldCheck className={cn("w-3 h-3", isWatchdogActive ? "text-blue-500" : "text-slate-600")} />
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">WD</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full", systemStatus === 'ONLINE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : systemStatus === 'RECONNECTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500')} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  {systemStatus}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 bg-slate-800/80 border border-slate-700/50 rounded-md hover:bg-slate-700 transition-colors text-slate-400"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="text-blue-500 w-4 h-4" /> TERMINAL CONFIG
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white">✕</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Account ID</label>
                  <input
                    type="text"
                    value={mt5Config.login}
                    onChange={(e) => setMt5Config({ ...mt5Config, login: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-xs focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Key</label>
                  <input
                    type="password"
                    value={mt5Config.password}
                    onChange={(e) => setMt5Config({ ...mt5Config, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-xs focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Server Node</label>
                  <input
                    type="text"
                    value={mt5Config.server}
                    onChange={(e) => setMt5Config({ ...mt5Config, server: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-xs focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-slate-300 uppercase">Auto-Watchdog</div>
                    <div className="text-[8px] text-slate-500 uppercase">Auto-restart if data stalls</div>
                  </div>
                  <button
                    onClick={() => setIsWatchdogActive(!isWatchdogActive)}
                    className={cn(
                      "w-10 h-5 rounded-full relative transition-all",
                      isWatchdogActive ? "bg-blue-600" : "bg-slate-800"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                      isWatchdogActive ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
              </div>

              <button
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mt5Config)
                  });
                  setIsSaving(false);
                  setShowSettings(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-md text-xs transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'SECURING...' : 'AUTHORIZE CONNECTION'}
              </button>
            </div>
          </div>
        )}

        {/* Financial Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Equity"
            value={tick?.equity ? `$${tick.equity.toLocaleString()}` : '$0.00'}
            icon={<Wallet className="text-blue-500" />}
          />
          <StatCard
            label="Daily PnL"
            value={tick?.profit ? `${tick.profit > 0 ? '+' : ''}$${tick.profit.toFixed(2)}` : '$0.00'}
            icon={<DollarSign className="text-emerald-500" />}
            trend={tick?.profit > 0 ? 'up' : tick?.profit < 0 ? 'down' : undefined}
          />
          <StatCard
            label="XAUUSD Price"
            value={tick?.bid ? tick.bid.toFixed(2) : '0.00'}
            icon={<Activity className="text-orange-500" />}
          />
          <StatCard
            label="Execution Status"
            value={tick ? 'RUNNING' : 'IDLE'}
            icon={<Cpu className="text-purple-500" />}
          />
        </div>

        {/* Primary Viewport */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* Chart Section */}
          <div className="xl:col-span-8">
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-lg border-t-2 border-t-blue-500/50">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Activity className="w-3 h-3 text-blue-500" /> REALTIME STREAM
                </h3>
                <div className="flex gap-1 bg-slate-800 p-0.5 rounded border border-slate-700">
                  {['M1', 'M5', 'M15'].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setCurrentTimeframe(tf)}
                      className={cn(
                        "px-2.5 py-1 rounded text-[9px] font-bold transition-all",
                        currentTimeframe === tf
                          ? "bg-slate-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-2">
                <div ref={chartContainerRef} className="w-full h-[400px]" />
              </div>
            </div>
          </div>

          {/* Activity Section */}
          <div className="xl:col-span-4 space-y-4">
            {/* Realtime Stream Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-lg border-t-2 border-t-emerald-500/50">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Activity className="w-3 h-3 text-emerald-500" /> REALTIME STREAM
              </h3>
              <RealtimeStream data={tick?.prediction} />
              {tick?.prediction?.analysis && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-300 italic leading-relaxed">
                  " {tick.prediction.analysis} "
                </div>
              )}
            </div>

            {/* Market Context Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-lg border-t-2 border-t-amber-500/50">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Globe className="w-3 h-3 text-amber-500" /> MARKET CONTEXT
              </h3>
              <div className="space-y-2">
                {news.length === 0 ? (
                  <div className="text-[9px] text-slate-600 uppercase tracking-tighter">No high impact news detected for today.</div>
                ) : (
                  news.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-950 rounded border border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-300">{item.title}</span>
                        <span className="text-[8px] text-slate-500 uppercase">{new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={cn(
                        "px-1.5 py-0.5 rounded text-[7px] font-bold uppercase",
                        item.impact === 'High' ? "bg-red-500/20 text-red-500" : "bg-amber-500/20 text-amber-500"
                      )}>
                        {item.impact}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dashboard Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-lg">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Cpu className="w-3 h-3 text-purple-500" /> CONTROL CENTER
              </h3>
              <ControlInterface />
            </div>

            {/* AI Training Lab Hub */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-lg border-t-2 border-t-purple-500/50">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Activity className="w-3 h-3 text-purple-500" /> AI TRAINING LAB
              </h3>
              <AITrainingLab isTraining={isTraining} setIsTraining={setIsTraining} />
            </div>

            {/* Backtest Lab */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-lg border-t-2 border-t-blue-500/50">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-blue-500" /> BACKTEST ANALYZER
              </h3>
              <BacktestLab isBacktesting={isBacktesting} setIsBacktesting={setIsBacktesting} results={backtestResults} setResults={setBacktestResults} />
            </div>

            {/* Recent Executions */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-lg h-[241px] flex flex-col">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">EXECUTION HISTORY</h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {trades.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-10">
                    <Activity className="w-8 h-8 mb-2" />
                    <span className="text-[9px] font-bold uppercase">Awaiting Feed...</span>
                  </div>
                )}
                {trades.map((t) => (
                  <TradeRow key={t.id} trade={t} />
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, icon, trend }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-sm group hover:border-slate-700 transition-all border-b-2 border-b-transparent hover:border-b-blue-500/50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</h4>
        {icon}
      </div>
      <div className="flex items-end justify-between">
        <div className="text-lg font-bold tracking-tight text-white">{value}</div>
        {trend && (
          <div className={cn(
            "text-[9px] font-bold px-1 rounded",
            trend === 'up' ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"
          )}>
            {trend === 'up' ? '▲' : '▼'}
          </div>
        )}
      </div>
    </div>
  );
}

function TradeRow({ trade }: any) {
  const isBuy = trade.side === 'BUY';
  return (
    <div className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-800 rounded hover:bg-slate-800/40 transition-colors">
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-1 h-6 rounded-full",
          isBuy ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]"
        )} />
        <div>
          <div className="text-[10px] font-bold uppercase text-white">{trade.side} {trade.symbol}</div>
          <div className="text-[9px] text-slate-500 tabular-nums">@{trade.price}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] font-bold text-slate-300">{trade.vol}L</div>
        <div className="text-[8px] text-slate-600 uppercase">{new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function RealtimeStream({ data }: { data: any }) {
  if (!data) return <div className="text-[10px] text-slate-600 italic">No prediction stream...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-slate-950 border border-slate-800 rounded p-3 text-center">
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Prediction</div>
        <div className={cn(
          "text-sm font-black tracking-tighter uppercase",
          data.status.includes('SHORT') ? "text-red-500" : "text-emerald-500"
        )}>
          {data.status}
        </div>
      </div>

      <div className="space-y-2.5">
        <ProbabilityBar label="LONG" value={data.long} subValue={data.long_hold} color="emerald" subLabel="↳ Hold" />
        <ProbabilityBar label="SHORT" value={data.short} subValue={data.short_hold} color="red" subLabel="↳ Hold" />
        <ProbabilityBar label="FLAT" value={data.flat} color="slate" />
        <ProbabilityBar label="NEUTRAL" value={data.neutral} color="blue" />
      </div>

      <div className="text-[8px] text-slate-600 text-right font-mono uppercase">
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}

function ProbabilityBar({ label, value, subValue, color, subLabel }: any) {
  const colors: any = {
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    slate: "bg-slate-500",
    blue: "bg-blue-500"
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[9px] font-bold tracking-tight">
        <span className="text-slate-400 uppercase">{label}</span>
        <span className="text-white">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-1000", colors[color])} style={{ width: `${value}%` }} />
      </div>
      {subValue !== undefined && (
        <div className="flex justify-between items-center text-[8px] font-bold pl-2 border-l border-slate-800">
          <span className="text-slate-500 uppercase italic">{subLabel}</span>
          <span className="text-slate-300">{subValue.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function AITrainingLab({ isTraining, setIsTraining }: any) {
  const startTraining = async () => {
    setIsTraining(true);
    try {
      const resp = await fetch('/api/train', { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        alert("Training Complete! New model deployed.");
      } else {
        alert("Training Error: " + data.error);
      }
    } catch (e) {
      alert("Network Error");
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-950 rounded border border-slate-800/50">
        <p className="text-[9px] text-slate-500 leading-relaxed uppercase tracking-tight">
          Treine o Agente de IA com os últimos 10.000 períodos.
          O modelo aprenderá padrões de confluência (RSI, ATR, VWAP, EMA)
          para prever as próximas 5 velas.
        </p>
      </div>

      <button
        disabled={isTraining}
        onClick={startTraining}
        className={cn(
          "w-full py-2.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
          isTraining
            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 active:scale-95"
        )}
      >
        {isTraining ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> TRAINING BRAIN...
          </span>
        ) : "START BRAIN TRAINING"}
      </button>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
          <span className="text-[8px] font-bold text-slate-500 uppercase">Model Standard: XGBoost</span>
        </div>
        <span className="text-[8px] font-bold text-slate-600 uppercase">Feature-Set: 8 Vars</span>
      </div>
    </div>
  );
}

function BacktestLab({ isBacktesting, setIsBacktesting, results, setResults }: any) {
  const [dates, setDates] = useState({ start: '2025-01-01', end: '2026-01-01' });
  const [showDetails, setShowDetails] = useState(false);

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    setDates({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  const runBacktest = async () => {
    setIsBacktesting(true);
    try {
      const resp = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'XAUUSD',
          startDate: dates.start,
          endDate: dates.end,
          timeframe: 'M15'
        })
      });
      const data = await resp.json();
      if (data.success) {
        setResults(data.data);
      } else {
        alert("Backtest Error: " + data.error);
      }
    } catch (e) {
      alert("Network Error");
    } finally {
      setIsBacktesting(false);
    }
  };

  const exportToCSV = () => {
    if (!results || !results.trades) return;

    const headers = ["Type", "Entry Price", "Entry Time", "Exit Price", "Exit Time", "Profit", "Motive"];
    const rows = results.trades.map((t: any) => [
      t.type,
      t.entry_price,
      t.entry_time,
      t.exit_price || 'N/A',
      t.exit_time || 'N/A',
      t.profit,
      t.motive
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((e: any) => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `backtest_report_${dates.start}_to_${dates.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Presets Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {[
            { label: '7D', days: 7 },
            { label: '30D', days: 30 },
            { label: '1Y', days: 365 }
          ].map(p => (
            <button
              key={p.label}
              onClick={() => setPreset(p.days)}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[8px] font-bold text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition-all"
            >
              {p.label}
            </button>
          ))}
        </div>
        <Calendar className="w-3 h-3 text-slate-600" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="relative group">
          <label className="text-[7px] font-black text-slate-500 uppercase absolute -top-1.5 left-2 bg-slate-900 px-1 z-10 transition-colors group-focus-within:text-blue-500">
            Start Range
          </label>
          <input
            type="date"
            value={dates.start}
            onChange={(e) => setDates({ ...dates, start: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-[10px] text-slate-300 outline-none focus:border-blue-500 transition-all cursor-pointer hover:bg-slate-900/50"
          />
        </div>
        <div className="relative group">
          <label className="text-[7px] font-black text-slate-500 uppercase absolute -top-1.5 left-2 bg-slate-900 px-1 z-10 transition-colors group-focus-within:text-blue-500">
            End Range
          </label>
          <input
            type="date"
            value={dates.end}
            onChange={(e) => setDates({ ...dates, end: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-[10px] text-slate-300 outline-none focus:border-blue-500 transition-all cursor-pointer hover:bg-slate-900/50"
          />
        </div>
      </div>

      <button
        disabled={isBacktesting}
        onClick={runBacktest}
        className={cn(
          "w-full py-2.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
          isBacktesting
            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95 shadow-blue-500/10"
        )}
      >
        {isBacktesting ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> RUNNING SIMULATION...
          </span>
        ) : "EXECUTE ANALYZER"}
      </button>

      {results && (
        <div className="space-y-4">
          <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-slate-900 border border-white/5 rounded">
                <div className="text-[8px] text-slate-500 uppercase">Win Rate</div>
                <div className="text-sm font-bold text-emerald-500">{results.summary.win_rate.toFixed(1)}%</div>
              </div>
              <div className="p-2 bg-slate-900 border border-white/5 rounded">
                <div className="text-[8px] text-slate-500 uppercase">Profit</div>
                <div className="text-sm font-bold text-white">${results.summary.profit.toFixed(2)}</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500">
                <span>Trades: {results.summary.total_trades}</span>
                <span>W:{results.summary.wins} / L:{results.summary.losses}</span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${results.summary.win_rate}%` }} />
                <div className="bg-red-500 h-full" style={{ width: `${100 - results.summary.win_rate}%` }} />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex-1 py-1 text-[8px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors bg-slate-800/50 rounded border border-white/5"
              >
                {showDetails ? "Hide Detailed Report" : "View Detailed Report"}
              </button>
              <button
                onClick={exportToCSV}
                className="px-3 py-1 bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 rounded hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1.5 text-[8px] font-bold uppercase"
              >
                <Download className="w-2.5 h-2.5" /> Export
              </button>
            </div>
          </div>

          {showDetails && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Daily Breakdown */}
              <div className="bg-slate-950 rounded border border-slate-800 overflow-hidden">
                <div className="bg-slate-900 px-3 py-1.5 border-b border-slate-800 text-[8px] font-bold uppercase tracking-widest text-slate-400">
                  Daily Summary
                </div>
                <div className="max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                  <table className="w-full text-left text-[9px]">
                    <thead className="sticky top-0 bg-slate-950 text-slate-500 border-b border-white/5">
                      <tr>
                        <th className="p-2 uppercase font-bold">Date</th>
                        <th className="p-2 uppercase font-bold">Trades</th>
                        <th className="p-2 uppercase font-bold text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {Object.entries(results.summary.daily_breakdown).map(([day, stats]: any) => (
                        <tr key={day} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-2 font-mono text-slate-400">{day}</td>
                          <td className="p-2 text-slate-500">{stats.trades} (W:{stats.wins})</td>
                          <td className={cn(
                            "p-2 text-right font-bold",
                            stats.profit >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trade Log */}
              <div className="bg-slate-950 rounded border border-slate-800 overflow-hidden">
                <div className="bg-slate-900 px-3 py-1.5 border-b border-slate-800 text-[8px] font-bold uppercase tracking-widest text-slate-400">
                  Full Execution Log
                </div>
                <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                  <div className="divide-y divide-white/5">
                    {results.trades.map((t: any, idx: number) => (
                      <div key={idx} className="p-3 space-y-2 hover:bg-slate-900/50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                              t.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                            )}>
                              {t.type}
                            </div>
                            <span className="text-[10px] font-bold text-slate-300">XAUUSD</span>
                          </div>
                          <div className={cn(
                            "text-[10px] font-bold",
                            t.profit >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            {t.profit >= 0 ? '+' : ''}{t.profit.toFixed(2)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-[8px] uppercase tracking-tighter">
                          <div className="space-y-0.5">
                            <span className="text-slate-600 block">Entry ({t.entry_price})</span>
                            <span className="text-slate-400 font-mono">{t.entry_time}</span>
                          </div>
                          <div className="space-y-0.5 text-right">
                            <span className="text-slate-600 block">Exit ({t.exit_price})</span>
                            <span className="text-slate-400 font-mono">{t.exit_time || 'N/A'}</span>
                          </div>
                        </div>
                        {t.motive && (
                          <div className="text-[7px] text-blue-400/80 bg-blue-500/5 p-1.5 rounded border border-blue-500/10 italic">
                            Motive: {t.motive}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ControlInterface() {
  const sendCommand = async (cmd: string) => {
    try {
      await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      // Minimalist UI feedback
    } catch { }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <ControlButton label="PAUSE" onClick={() => sendCommand('PAUSE')} color="yellow" />
      <ControlButton label="RESUME" onClick={() => sendCommand('RESUME')} color="emerald" />
      <ControlButton label="CLOSE ALL" onClick={() => sendCommand('CLOSE_ALL')} color="red" full />
    </div>
  );
}

function ControlButton({ label, onClick, color, full }: any) {
  const colors: any = {
    yellow: "bg-orange-500/5 text-orange-500 border-orange-500/20 hover:bg-orange-500 hover:text-white",
    emerald: "bg-emerald-500/5 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white",
    red: "bg-red-500/5 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-2 border rounded font-bold text-[9px] uppercase tracking-wider transition-all active:scale-[0.98]",
        full ? "col-span-2" : "",
        colors[color]
      )}
    >
      {label}
    </button>
  );
}
