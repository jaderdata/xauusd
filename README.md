# XAUUSD Trend-Only System 🚀

A professional Automated Trading System for MetaTrader 5 (XAUUSD), integrated with a React/Next.js Web Dashboard for storage and remote control.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Dashboard+Preview)

## 🌟 Features

### 🤖 Expert Advisor (MQL5)
*   **Strategy:** H1 Trend Following + M15 Pullback Entries.
*   **Risk Management:** Daily Loss Limit ($500), Time Window (London/NY), Max Spreads.
*   **Execution:** Automated Trade Management (Break-Even, Trailing Stop EMA20).
*   **Connectivity:** Real-time HTTP communication with Web Dashboard.

### 💻 Web Dashboard (Next.js)
*   **Real-Time Monitoring:** Equity, Profit, and Price Ticks update every second.
*   **Control Panel:** Remote "PAUSE", "RESUME", and "CLOSE ALL" buttons.
*   **Database:** Local SQLite (`trading.db`) persistence for trade history.
*   **UI:** Modern Dark Mode interface tailored for traders.

---

## 🛠️ Installation

### 1. Metatrader 5 (EA)
1.  Copy the `Experts/XAUUSD_TrendOnly` folder to your MT5 Data Folder (`MQL5/Experts/`).
2.  Open **MetaEditor**, compile `XAUUSD_TrendOnly.mq5`.
3.  In MT5, go to **Tools > Options > Expert Advisors**.
4.  ✅ Enable **"Allow WebRequest for listed URL"**.
5.  Add URL: `http://localhost:3000`.
6.  Attach EA to **XAUUSD M15** Chart.

### 2. Web Dashboard
1.  Install Node.js (v18+).
2.  Open terminal in the `web-dashboard` folder:
    ```bash
    cd web-dashboard
    npm install
    npm run dev
    ```
3.  Access: [http://localhost:3000](http://localhost:3000)

---

## 📂 Project Structure

```text
.
├── Experts/
│   └── XAUUSD_TrendOnly/   # MQL5 Source Code
│       ├── SignalEngine.mqh
│       ├── TradeManager.mqh
│       ├── RiskManager.mqh
│       ├── Dashboard.mqh
│       ├── NetworkManager.mqh
│       └── XAUUSD_TrendOnly.mq5
│
└── web-dashboard/          # Next.js Application
    ├── app/                # Frontend Pages & API Routes
    ├── lib/                # Database Logic (SQLite)
    └── ...
```

## ⚠️ Risk Warning
Trading Forex and Commodities involves substantial risk. This software is for educational purposes. Use at your own risk.
