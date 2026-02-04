//+------------------------------------------------------------------+
//|                                                 SignalEngine.mqh |
//|                                  Copyright 2025, Antigravity AI  |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"

enum ENUM_REGIME
  {
   REGIME_NO_TRADE=0,
   REGIME_TREND_UP=1,
   REGIME_TREND_DOWN=2
  };

class CSignalEngine
  {
private:
   int               m_handle_ema200_h1;
   int               m_handle_ema50_h1;
   int               m_handle_adx_h1;
   
   int               m_handle_ema20_m15;
   int               m_handle_ema50_m15;
   int               m_handle_adx_m15;
   int               m_handle_atr_m15;
   int               m_handle_rsi_m15;
   
   double            m_adx_threshold;

public:
                     CSignalEngine(void);
                    ~CSignalEngine(void);
   
   bool              Init(double adx_min);
   ENUM_REGIME       CheckTrendH1(void);
   bool              CheckPullbackM15(ENUM_REGIME regime);
   bool              CheckConfirmationM15(ENUM_REGIME regime, double &entry, double &sl);
   
   double            GetIndicatorValue(int handle, int buffer, int index);
   double            GetATR(void);
  };
//+------------------------------------------------------------------+
//| Constructor                                                      |
//+------------------------------------------------------------------+
CSignalEngine::CSignalEngine(void) : m_handle_ema200_h1(INVALID_HANDLE)
  {
  }
//+------------------------------------------------------------------+
//| Destructor                                                       |
//+------------------------------------------------------------------+
CSignalEngine::~CSignalEngine(void)
  {
   IndicatorRelease(m_handle_ema200_h1);
   IndicatorRelease(m_handle_ema50_h1);
   IndicatorRelease(m_handle_adx_h1);
   IndicatorRelease(m_handle_ema20_m15);
   IndicatorRelease(m_handle_ema50_m15);
   IndicatorRelease(m_handle_adx_m15);
   IndicatorRelease(m_handle_atr_m15);
   IndicatorRelease(m_handle_rsi_m15);
  }
//+------------------------------------------------------------------+
//| Initialize Indicators                                            |
//+------------------------------------------------------------------+
bool CSignalEngine::Init(double adx_min)
  {
   m_adx_threshold = adx_min;
   
   // H1 Indicators
   m_handle_ema200_h1 = iMA(_Symbol, PERIOD_H1, 200, 0, MODE_EMA, PRICE_CLOSE);
   m_handle_ema50_h1  = iMA(_Symbol, PERIOD_H1, 50, 0, MODE_EMA, PRICE_CLOSE);
   m_handle_adx_h1    = iADX(_Symbol, PERIOD_H1, 14);
   
   // M15 Indicators
   m_handle_ema20_m15 = iMA(_Symbol, PERIOD_M15, 20, 0, MODE_EMA, PRICE_CLOSE);
   m_handle_ema50_m15 = iMA(_Symbol, PERIOD_M15, 50, 0, MODE_EMA, PRICE_CLOSE);
   m_handle_adx_m15   = iADX(_Symbol, PERIOD_M15, 14);
   m_handle_atr_m15   = iATR(_Symbol, PERIOD_M15, 14);
   m_handle_rsi_m15   = iRSI(_Symbol, PERIOD_M15, 14, PRICE_CLOSE);
   
   if(m_handle_ema200_h1 == INVALID_HANDLE || m_handle_ema50_h1 == INVALID_HANDLE || m_handle_adx_h1 == INVALID_HANDLE)
      return false;
      
   return true;
  }
//+------------------------------------------------------------------+
//| Helper to get indicator value                                    |
//+------------------------------------------------------------------+
double CSignalEngine::GetIndicatorValue(int handle, int buffer, int index)
  {
   double result[];
   if(CopyBuffer(handle, buffer, index, 1, result) > 0)
      return result[0];
   return 0.0;
  }

double CSignalEngine::GetATR(void)
  {
   return GetIndicatorValue(m_handle_atr_m15, 0, 1);
  }

//+------------------------------------------------------------------+
//| Determine H1 Market Regime                                       |
//+------------------------------------------------------------------+
ENUM_REGIME CSignalEngine::CheckTrendH1(void)
  {
   double ema200 = GetIndicatorValue(m_handle_ema200_h1, 0, 0); // Current H1 candle (or 1 for closed)
   double ema50  = GetIndicatorValue(m_handle_ema50_h1, 0, 0);  // Using 0 usually represents forming, 1 is closed
   // Strategy says "Context", usually safer to look at closed candle (index 1) for stable trend.
   // Let's use index 1 (closed H1 candle) to avoid repainting during the hour.
   
   ema200 = GetIndicatorValue(m_handle_ema200_h1, 0, 1);
   ema50  = GetIndicatorValue(m_handle_ema50_h1, 0, 1);
   double adx = GetIndicatorValue(m_handle_adx_h1, 0, 1);
   
   // Close price of H1
   double close[]; 
   CopyClose(_Symbol, PERIOD_H1, 1, 1, close);
   double close_h1 = close[0];
   
   // Slope check (EMA50 current > EMA50 prev)
   double ema50_prev = GetIndicatorValue(m_handle_ema50_h1, 0, 2);
   bool slope_up = (ema50 > ema50_prev);
   bool slope_down = (ema50 < ema50_prev);
   
   if(ema50 > ema200 && close_h1 > ema50 && adx >= m_adx_threshold && slope_up)
      return REGIME_TREND_UP;
      
   if(ema50 < ema200 && close_h1 < ema50 && adx >= m_adx_threshold && slope_down)
      return REGIME_TREND_DOWN;
      
   return REGIME_NO_TRADE;
  }

//+------------------------------------------------------------------+
//| Check for Pullback conditions in M15                             |
//+------------------------------------------------------------------+
bool CSignalEngine::CheckPullbackM15(ENUM_REGIME regime)
  {
   if(regime == REGIME_NO_TRADE) return false;
   
   double rsi = GetIndicatorValue(m_handle_rsi_m15, 0, 1); // Last closed M15
   
   // Check RSI Neutrality
   bool rsi_ok = false;
   if(regime == REGIME_TREND_UP)
     {
      // RSI must drop to neutral (e.g., 40-55)
      if(rsi >= 40 && rsi <= 55) rsi_ok = true;
     }
   else if(regime == REGIME_TREND_DOWN)
     {
      // RSI must rise to neutral (e.g., 45-60)
      if(rsi >= 45 && rsi <= 60) rsi_ok = true;
     }
     
   if(!rsi_ok) return false;
   
   // Check Touch of EMA
   double ema20 = GetIndicatorValue(m_handle_ema20_m15, 0, 1);
   double ema50 = GetIndicatorValue(m_handle_ema50_m15, 0, 1);
   
   double low[];
   double high[];
   double close[];
   CopyLow(_Symbol, PERIOD_M15, 1, 1, low);
   CopyHigh(_Symbol, PERIOD_M15, 1, 1, high);
   CopyClose(_Symbol, PERIOD_M15, 1, 1, close);
   
   double price_low = low[0];
   double price_high = high[0];
   double price_close = close[0];
   
   // Buffer for "Touch" - defined in plan as 0.5 * ATR
   double atr = GetIndicatorValue(m_handle_atr_m15, 0, 1);
   double buffer = 0.5 * atr;
   
   bool touch_ema20 = false;
   bool touch_ema50 = false;
   
   if(regime == REGIME_TREND_UP)
     {
      // Price dipped near EMA?
      if(MathAbs(price_low - ema20) < buffer || (price_low < ema20 && price_close > ema20)) touch_ema20 = true;
      if(MathAbs(price_low - ema50) < buffer || (price_low < ema50 && price_close > ema50)) touch_ema50 = true;
     }
   else
     {
      if(MathAbs(price_high - ema20) < buffer || (price_high > ema20 && price_close < ema20)) touch_ema20 = true;
      if(MathAbs(price_high - ema50) < buffer || (price_high > ema50 && price_close < ema50)) touch_ema50 = true;
     }
     
   return (touch_ema20 || touch_ema50);
  }

//+------------------------------------------------------------------+
//| Check for Confirmation Candle (Trigger)                          |
//+------------------------------------------------------------------+
bool CSignalEngine::CheckConfirmationM15(ENUM_REGIME regime, double &entry, double &sl)
  {
   // Analyzing specific candle shapes logic
   // "Candle closes above previous high" (for buy)
   
   double high[], low[], close[], open[];
   CopyHigh(_Symbol, PERIOD_M15, 1, 2, high); // Index 1 and 2
   CopyLow(_Symbol, PERIOD_M15, 1, 2, low);
   CopyClose(_Symbol, PERIOD_M15, 1, 2, close);
   CopyOpen(_Symbol, PERIOD_M15, 1, 2, open);
   
   // Index 0 in these arrays = Candle 2 (Previous Previous) due to copy order? 
   // Wait, CopySeries usually returns [0]=oldest if not carefully handled with ArraySetAsSeries.
   // Let's assume standard copy: [0] is oldest, [count-1] is newest (Bar 1).
   // So [0] is Bar 2, [1] is Bar 1.
   
   double h1 = high[1]; double l1 = low[1]; double c1 = close[1]; double o1 = open[1];
   double h2 = high[0]; double l2 = low[0]; // Previous candle
   
   bool signal = false;
   
   if(regime == REGIME_TREND_UP)
     {
      // 1. Engulfing/Breakout: Close > Previous High
      if(c1 > h2) signal = true;
      
      // 2. Rejection: Lower wick + Close in top third
      double range = h1 - l1;
      if(range > 0)
        {
         double body_top = MathMax(o1, c1);
         double top_third = l1 + (range * 0.66);
         if(body_top > top_third && (c1 > o1) ) // Bullish candle in top third
             signal = true;
        }
        
      if(signal)
        {
         entry = c1;
         // Stop loss below swing low (lowest of last 3 bars for simplicity or just this bar)
         sl = MathMin(l1, l2) - 100 * _Point; // 100 points buffer
        }
     }
   else if(regime == REGIME_TREND_DOWN)
     {
      // 1. Breakout: Close < Previous Low
      if(c1 < l2) signal = true;
      
      // 2. Rejection: Upper wick + Close in bottom third
      double range = h1 - l1;
      if(range > 0)
        {
         double body_bottom = MathMin(o1, c1);
         double bottom_third = l1 + (range * 0.33);
         if(body_bottom < bottom_third && (c1 < o1)) // Bearish candle
             signal = true;
        }
        
      if(signal)
        {
         entry = c1;
         sl = MathMax(h1, h2) + 100 * _Point;
        }
     }
     
   return signal;
  }
