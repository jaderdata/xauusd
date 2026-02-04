'use client';

import { useEffect, useState, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, DollarSign, Activity, Wallet } from 'lucide-react';

export default function Dashboard() {
  const [tick, setTick] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<any>(null);
  const [series, setSeries] = useState<any>(null);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartInstance = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' }, // Zinc-950
        textColor: '#d4d4d8',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const newSeries = (chartInstance as any).addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Fit content
    chartInstance.timeScale().fitContent();

    setChart(chartInstance);
    setSeries(newSeries);

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

  // Poll Data
  useEffect(() => {
    const interval = setInterval(async () => {
      // Fetch Tick
      try {
        const resTick = await fetch('/api/tick');
        const dataTick = await resTick.json();
        setTick(dataTick);

        // Update Chart real-time if we had candle data (Mocking candle updates for now based on Bid)
        // Ideally we receive OHLC. For now let's just show Bid line would be better?
        // Let's stick to simple stats for V1 and placeholder chart.
      } catch (e) {
        console.error("Poll error", e);
      }

      // Fetch Trades
      try {
        const resTrades = await fetch('/api/trade');
        const dataTrades = await resTrades.json();
        setTrades(dataTrades);
      } catch (e) { console.error(e); }

    }, 1000); // 1 sec poll

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              XAUUSD PRO SYSTEM
            </h1>
            <p className="text-zinc-500">Real-Time Algorithmic Trading Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm text-green-500 font-medium">SYSTEM ONLINE</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card
            title="Equity"
            value={tick ? `$${tick.equity.toFixed(2)}` : 'Loading...'}
            icon={<Wallet className="text-blue-500" />}
          />
          <Card
            title="Daily Profit"
            value={tick ? `$${tick.profit.toFixed(2)}` : 'Loading...'}
            color={tick?.profit >= 0 ? "text-green-500" : "text-red-500"}
            icon={<DollarSign className="text-yellow-500" />}
          />
          <Card
            title="Current Bid"
            value={tick ? tick.bid.toFixed(2) : '0.00'}
            icon={<Activity className="text-zinc-500" />}
          />
          <Card
            title="Active Symbol"
            value={tick ? tick.symbol : 'XAUUSD'}
            icon={<ArrowUp className="text-zinc-500" />}
          />
        </div>

        {/* Main Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Chart Area */}
          <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 h-[450px] shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-zinc-300">Market Overview</h3>
            <div ref={chartContainerRef} className="w-full h-[380px]" />
          </div>

          {/* Recent Trades / Console */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 h-[450px] overflow-hidden flex flex-col shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-zinc-300">Control & Logs</h3>

            {/* Controls */}
            <div className="mb-4">
              <ControlPanel />
            </div>

            <h4 className="text-xs font-uppercase text-zinc-500 mb-2">Recent Activity</h4>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {trades.length === 0 && <div className="text-zinc-600 text-center mt-4">No trades today...</div>}
              {trades.map((t) => (
                <div key={t.id} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "p-1.5 rounded-md",
                      t.side === 'BUY' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    )}>
                      {t.side === 'BUY' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </span>
                    <div>
                      <div className="font-medium text-sm text-zinc-200">{t.side} {t.symbol}</div>
                      <div className="text-xs text-zinc-500">@{t.price}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-zinc-300">{t.vol} lots</div>
                    <div className="text-xs text-zinc-500">{new Date(t.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Control Panel */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-zinc-300">System Controls</h3>
          <ControlPanel />
        </div>

      </div>
    </div>
  );
}

function Card({ title, value, color, icon }: any) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl flex items-center justify-between hover:bg-zinc-900 transition-colors shadow-lg">
      <div>
        <h3 className="text-sm font-medium text-zinc-500 mb-1">{title}</h3>
        <p className={cn("text-2xl font-bold tracking-tight", color || "text-zinc-100")}>{value}</p>
      </div>
      <div className="h-10 w-10 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800">
        {icon}
      </div>
    </div>
  );
}

function ControlPanel() {
  const sendCommand = async (cmd: string) => {
    await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd }),
    });
    alert(`Command Sent: ${cmd}`);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        onClick={() => sendCommand('PAUSE')}
        className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 border border-yellow-600/50 p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
      >
        <span>⏸ PAUSE ROBOT</span>
      </button>
      <button
        onClick={() => sendCommand('RESUME')}
        className="bg-green-600/20 hover:bg-green-600/30 text-green-500 border border-green-600/50 p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
      >
        <span>▶ RESUME</span>
      </button>
      <button
        onClick={() => sendCommand('CLOSE_ALL')}
        className="col-span-2 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-600/50 p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
      >
        <span>⚠ CLOSE ALL POSITIONS</span>
      </button>
    </div>
  );
}
