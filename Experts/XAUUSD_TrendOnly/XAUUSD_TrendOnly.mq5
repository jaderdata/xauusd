//+------------------------------------------------------------------+
//|                                             XAUUSD_TrendOnly.mq5 |
//|                                  Copyright 2025, Antigravity AI  |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, Antigravity AI"
#property link      "https://www.mql5.com"
#property version   "1.00"
#property description "Trend-Only Strategy for XAUUSD (H1 Trend + M15 Pullback)"

// Include Modules
#include "SignalEngine.mqh"
#include "TradeManager.mqh"
#include "RiskManager.mqh"
#include "Logger.mqh"
#include "Dashboard.mqh"
#include "NetworkManager.mqh"

// Inputs
input group "Strategy Settings"
input double   InpADXThreshold   = 25.0;     // Minimum H1 ADX
input int      InpTP_R           = 2;        // Take Profit (Risk Multiplier)
input int      InpSL_Buffer      = 50;       // Buffer points for SL

input group "Risk Settings"
input double   InpLotSize        = 0.10;     // Fixed Lot Size (Aggressive: 0.10)
input bool     InpUseRiskLots    = true;     // Use Auto-Lots based on Risk ($)
input double   InpRiskPerTrade   = 150.0;    // Risk ($) per trade (High Reward)
input int      InpMinRiskPoints  = 300;      // Min Points for Lot Calc (Safety)
input int      InpMaxSpread      = 40;       // Max Spread (Points)
input int      InpMaxTrades      = 2;        // Max Trades per Day
input int      InpMaxOpenPositions = 1;      // Max Concurrent Positions
input double   InpMaxDailyLoss   = 500.0;    // Max Daily Loss ($) (High limit)

input group "System"
input ulong    InpMagicNumber    = 123456;   // Magic Number
input bool     InpDebugMode      = true;     // Debug Mode (Print Logs)
input string   InpLogFile        = "xau_logs.txt"; // Log Filename

// Global Objects
CSignalEngine  ExtSignal;
CTradeManager  ExtTrade;
CRiskManager   ExtRisk;
CLogger        ExtLogger;
CDashboard    Dashboard;
CNetworkManager ExtNet;

// Control Flags
bool           ExtPaused = false;

// Global Variables
datetime       ExtLastCandleTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   // Initialize Modules
   if(!ExtSignal.Init(InpADXThreshold))
     {
      Print("Failed to initialize Signal Engine (Indicators)");
      return INIT_FAILED;
     }
     
   ExtTrade.Init(InpMagicNumber, InpLotSize);
   ExtRisk.Init(InpMaxSpread, InpMaxTrades, InpMaxDailyLoss, InpMagicNumber);
   ExtLogger.Init(InpLogFile, InpDebugMode);
   Dashboard.Init(_Symbol, InpMagicNumber);
   ExtNet.Init("http://localhost:3000/api");
   
   Print("XAUUSD Trend-Only EA V2 (Advanced) Initialized");
   return(INIT_SUCCEEDED);
  }
//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   Dashboard.Deinit();
   Print("XAUUSD Trend-Only EA Deinitialized");
  }
//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
  {
   // 0. Manage Open Positions (Every Tick)
   // Pass an estimated TP points for R calc (e.g. 500 points) or rely on internal logic.
   // Ideally we pass 0 and let logic derive from TP.
   ExtTrade.ManagePositions(0); 
   
   // Check Max Open Positions (Avoid Stacking Losses)
   if(PositionsTotal() >= InpMaxOpenPositions) return;
   
   // Check Max Open Positions (Avoid Stacking Losses)
   if(PositionsTotal() >= InpMaxOpenPositions) return;

   // 1. Check for New Candle (M15) for Entry Signals
   datetime currentTime[1];
   if(CopyTime(_Symbol, PERIOD_M15, 0, 1, currentTime) <= 0) return;
   
   if(currentTime[0] == ExtLastCandleTime) return; // Same candle
   ExtLastCandleTime = currentTime[0]; // New candle detected
   
   // 2. Risk Checks (Spread & Time & Daily Limit)
   // 2. Risk Checks (Spread & Time & Daily Limit)
   if(!ExtRisk.CheckTimeWindow()) return;
   
   // 3. Determine Regime (H1)
   ENUM_REGIME regime = ExtSignal.CheckTrendH1();
   
   string sRegime = "NO_TREND";
   if(regime == REGIME_TREND_UP) sRegime = "UP"; // Shortened for UI
   if(regime == REGIME_TREND_DOWN) sRegime = "DOWN"; // Shortened for UI
   
   // --- DASHBOARD UPDATE ---
   double dailyProfit = ExtRisk.GetDailyProfit();
   string sSignalUI = "Scanning...";
   // Simple logic to show signal status on UI
   if(regime == REGIME_NO_TREND) sSignalUI = "No Trend";
   else sSignalUI = "Trend " + sRegime;
   
   Dashboard.Update(dailyProfit, InpMaxDailyLoss, sRegime, sSignalUI, InpRiskPerTrade);
   
   // --- WEB UDPATE ---
   // Send current state every tick (or throttle it)
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   ExtNet.SendTick(_Symbol, bid, ask, equity, dailyProfit);
   
   // --- COMMAND CHECK (Fast Poll) ---
   // Ideally use OnTimer, but OnTick is okay for liquid market XAUUSD
   string cmd = ExtNet.GetCommand();
   if(StringLen(cmd) > 0)
     {
      Print("WEB COMMAND RECEIVED: ", cmd);
      if(cmd == "PAUSE") 
        { 
         ExtPaused = true; 
         Print("Bot PAUSED via Web"); 
        }
      if(cmd == "RESUME") 
        { 
         ExtPaused = false; 
         Print("Bot RESUMED via Web"); 
        }
      if(cmd == "CLOSE_ALL")
        {
         ExtTrade.CloseAll();
         ExtPaused = true;
         Print("PANIC CLOSE via Web");
        }
        
      // Force UI Update
      Dashboard.Update(dailyProfit, InpMaxDailyLoss, sRegime, sSignalUI, InpRiskPerTrade);
     }
   
   // PAUSE CHECK
   if(ExtPaused) return;
   
   // Daily Limit Check (After Dashboard update so we see the limit hit)
   if(!ExtRisk.CheckDailyLimit()) return;
   
   // 4. Check Signal (Pullback + Trigger)
   // We are at the OPEN of Candle 0. We analyze Candle 1 (Closed) and older.
   
   // Check if we HAD a pullback valid in the recent past?
   // The CheckPullbackM15 function looks at Bar 1.
   
   bool isPullback = ExtSignal.CheckPullbackM15(regime);
   if(!isPullback) return; // No pullback setup active
   
   double entryPrice = 0;
   double stopLoss = 0;
   
   if(ExtSignal.CheckConfirmationM15(regime, entryPrice, stopLoss))
     {
      // 5. Final Risk Check
      if(!ExtRisk.CheckSpread()) return;
      
      // Calculate Take Profit
      double risk = MathAbs(entryPrice - stopLoss);
      double takeProfit = 0;
      
      if(regime == REGIME_TREND_UP)
         takeProfit = entryPrice + (risk * InpTP_R);
      else
         takeProfit = entryPrice - (risk * InpTP_R);
         
      // Log Signal
      ExtLogger.LogSignal(TimeCurrent(), _Symbol, sRegime, 0.0, "Pullback", entryPrice, stopLoss, takeProfit, "Confirmed");
      
       double tradeLot = InpLotSize;
       if(InpUseRiskLots)
         {
          double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
          double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
          double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
          
          if(tickSize > 0 && point > 0)
            {
             double riskPoints = MathAbs(entryPrice - stopLoss) / point;
             
             // Safety: Treat risk as at least InpMinRiskPoints to avoid massive lots on tiny stops
             double plotRiskPoints = MathMax(riskPoints, InpMinRiskPoints);
             
             double lossPerLot = plotRiskPoints * (tickValue / (tickSize / point)); 
             // Note: (tickSize/point) handles cases where tick size != point
             
             if(lossPerLot > 0) tradeLot = InpRiskPerTrade / lossPerLot;
            }
            
          // Normalize Volume
          double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
          double minVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
          double maxVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
          
          if(step > 0) tradeLot = MathFloor(tradeLot / step) * step;
          if(tradeLot < minVol) tradeLot = minVol;
          if(tradeLot > maxVol) tradeLot = maxVol; 
         }

       // Execute
       bool res = false;
       if(regime == REGIME_TREND_UP)
          res = ExtTrade.ExecuteBuy(tradeLot, stopLoss, takeProfit, "TrendUp Buy");
       else
          res = ExtTrade.ExecuteSell(tradeLot, stopLoss, takeProfit, "TrendDown Sell");
         
      if(res)
         {
          ExtLogger.LogTrade(0, (regime==REGIME_TREND_UP ? "BUY":"SELL"), entryPrice, 0, "Order Sent");
          ExtNet.SendTrade(_Symbol, (regime==REGIME_TREND_UP ? "BUY":"SELL"), entryPrice, tradeLot, "Signal Confirmed");
         }
     }
  }
//+------------------------------------------------------------------+
//| Chart Event Handler                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
  {
   bool closeAll = false;
   if(Dashboard.OnEvent(id, lparam, dparam, sparam, ExtPaused, closeAll))
     {
      // If Close All triggered
      if(closeAll)
        {
         Print("PANIC BUTTON PRESSED: Closing All Positions!");
         ExtTrade.CloseAll();
         ExtPaused = true; // Auto-pause after panic
         
         // Force UI refresh to show Paused
         // Note: Dashboard.OnEvent handles button visual state, but we ensure logic sync
        }
        
      ChartRedraw();
     }
  }
