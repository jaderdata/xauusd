//+------------------------------------------------------------------+
//|                                                    Dashboard.mqh |
//|                                  Copyright 2025, Antigravity AI  |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, Antigravity AI"
#property link      "https://www.mql5.com"

class CDashboard
  {
private:
   string            m_prefix;
   int               m_x_offset;
   int               m_y_offset;
   color             m_bg_color;
   color             m_text_color;
   
   // Object Names
   string            ObjName(string name) { return m_prefix + name; }
   
   // Helper Create Functions
   void CreateRectLabel(string name, int x, int y, int w, int h, color bg, int corner=CORNER_LEFT_UPPER);
   void CreateLabel(string name, int x, int y, string text, int fontSize, color clr, bool bold=false);
   void CreateButton(string name, int x, int y, int w, int h, string text, color bg, color txtColor);

public:
                     CDashboard();
                    ~CDashboard();
   
   void              Init(string symbol, int magic);
   void              Update(double dailyProfit, double maxDailyLoss, string h1Trend, string m15Signal, double riskAmount);
   void              Deinit();
   
   // Event Handling returns true if a button was clicked and handled
   bool              OnEvent(int id, long &lparam, double &dparam, string &sparam, bool &pauseState, bool &closeAllState);
  };
//+------------------------------------------------------------------+
//| Constructor                                                      |
//+------------------------------------------------------------------+
CDashboard::CDashboard() : m_prefix("XAU_dash_"), m_x_offset(20), m_y_offset(50), m_bg_color(C'30,30,30'), m_text_color(clrWhite)
  {
  }
//+------------------------------------------------------------------+
//| Destructor                                                       |
//+------------------------------------------------------------------+
CDashboard::~CDashboard()
  {
   Deinit();
  }
//+------------------------------------------------------------------+
//| Initialize Dashboard Objects                                     |
//+------------------------------------------------------------------+
void CDashboard::Init(string symbol, int magic)
  {
   Deinit(); // Clean up first
   
   // 1. Background Panel
   CreateRectLabel("bg", m_x_offset, m_y_offset, 250, 320, m_bg_color);
   
   // 2. Header
   CreateLabel("title", m_x_offset + 10, m_y_offset + 10, "XAUUSD SYSTEM PRO", 10, clrGold, true);
   CreateLabel("status", m_x_offset + 160, m_y_offset + 10, "⚫ INIT", 8, clrGray);
   
   // 3. Profit Section (Large)
   CreateLabel("lbl_profit", m_x_offset + 10, m_y_offset + 40, "Daily Profit/Loss:", 8, clrSilver);
   CreateLabel("val_profit", m_x_offset + 10, m_y_offset + 55, "$0.00", 16, clrWhite, true);
   
   // 4. Risk Bar
   CreateRectLabel("risk_bg", m_x_offset + 10, m_y_offset + 90, 230, 5, C'50,50,50');
   CreateRectLabel("risk_fill", m_x_offset + 10, m_y_offset + 90, 0, 5, clrRed); // Dynamic width
   CreateLabel("lbl_dd", m_x_offset + 10, m_y_offset + 100, "DD: 0%", 8, clrSilver);
   CreateLabel("lbl_limit", m_x_offset + 150, m_y_offset + 100, "Limit: $500", 8, clrSilver);
   
   // 5. Strategy Info
   int y_strat = m_y_offset + 130;
   CreateLabel("lbl_trend", m_x_offset + 10, y_strat, "H1 Trend:", 9, clrSilver);
   CreateLabel("val_trend", m_x_offset + 80, y_strat, "WAIT", 9, clrWhite, true);
   
   CreateLabel("lbl_sig", m_x_offset + 10, y_strat + 20, "M15 Signal:", 9, clrSilver);
   CreateLabel("val_sig", m_x_offset + 80, y_strat + 20, "Scanning...", 8, clrGray);
   
   CreateLabel("lbl_risk", m_x_offset + 10, y_strat + 40, "Risk Mode:", 9, clrSilver);
   CreateLabel("val_risk", m_x_offset + 80, y_strat + 40, "$50", 9, clrWhite);
   
   // 6. Buttons
   int y_btn = m_y_offset + 220;
   CreateButton("btn_pause", m_x_offset + 10, y_btn, 110, 30, "PAUSE BOT", C'60,60,60', clrWhite);
   CreateButton("btn_close", m_x_offset + 130, y_btn, 110, 30, "CLOSE ALL", clrCrimson, clrWhite);
   
   ChartRedraw();
  }
//+------------------------------------------------------------------+
//| Update Values                                                    |
//+------------------------------------------------------------------+
void CDashboard::Update(double dailyProfit, double maxDailyLoss, string h1Trend, string m15Signal, double riskAmount)
  {
   // Profit
   string sProfit = DoubleToString(dailyProfit, 2);
   if(dailyProfit >= 0) sProfit = "+$" + sProfit;
   else sProfit = "-$" + DoubleToString(MathAbs(dailyProfit), 2);
   
   ObjectSetString(0, ObjName("val_profit"), OBJPROP_TEXT, sProfit);
   ObjectSetInteger(0, ObjName("val_profit"), OBJPROP_COLOR, (dailyProfit >= 0 ? clrLime : clrRed));
   
   // Risk Fill calculation
   double lossAbs = MathAbs(MathMin(0, dailyProfit));
   double pct = (maxDailyLoss > 0) ? (lossAbs / maxDailyLoss) : 0;
   if(pct > 1) pct = 1;
   int barWidth = (int)(230 * pct);
   ObjectSetInteger(0, ObjName("risk_fill"), OBJPROP_XSIZE, barWidth);
   
   // Labels
   ObjectSetString(0, ObjName("lbl_dd"), OBJPROP_TEXT, "Risk Used: " + DoubleToString(pct*100, 1) + "%");
   ObjectSetString(0, ObjName("lbl_limit"), OBJPROP_TEXT, "Max: $" + DoubleToString(maxDailyLoss, 0));
   
   // Trend
   ObjectSetString(0, ObjName("val_trend"), OBJPROP_TEXT, h1Trend);
   color cTrend = clrGray;
   if(h1Trend == "UP") cTrend = clrDeepSkyBlue;
   if(h1Trend == "DOWN") cTrend = clrOrangeRed;
   ObjectSetInteger(0, ObjName("val_trend"), OBJPROP_COLOR, cTrend);
   
   // Signal
   ObjectSetString(0, ObjName("val_sig"), OBJPROP_TEXT, m15Signal);
   
   // Risk Mode
   string sRisk = "$" + DoubleToString(riskAmount, 0);
   if(riskAmount >= 100) sRisk += " (ATTACK)";
   else sRisk += " (DEFENSE)";
   ObjectSetString(0, ObjName("val_risk"), OBJPROP_TEXT, sRisk);
   ObjectSetInteger(0, ObjName("val_risk"), OBJPROP_COLOR, (riskAmount >= 100 ? clrGold : clrSilver));
   
   ChartRedraw();
  }
//+------------------------------------------------------------------+
//| Handle Chart Events (Clicks)                                     |
//+------------------------------------------------------------------+
bool CDashboard::OnEvent(int id, long &lparam, double &dparam, string &sparam, bool &pauseState, bool &closeAllState)
  {
   if(id == CHARTEVENT_OBJECT_CLICK)
     {
      // Pause Button
      if(sparam == ObjName("btn_pause"))
        {
         pauseState = !pauseState; // Toggle
         
         // Visual Feedback
         ObjectSetInteger(0, ObjName("btn_pause"), OBJPROP_BGCOLOR, (pauseState ? clrOrange : C'60,60,60'));
         ObjectSetString(0, ObjName("btn_pause"), OBJPROP_TEXT, (pauseState ? "RESUME" : "PAUSE BOT"));
         
         // Status Header
         ObjectSetString(0, ObjName("status"), OBJPROP_TEXT, (pauseState ? "🔴 PAUSED" : "🟢 RUNNING"));
         ObjectSetInteger(0, ObjName("status"), OBJPROP_COLOR, (pauseState ? clrRed : clrLime));
         
         ChartRedraw();
         return true;
        }
        
      // Close All Button
      if(sparam == ObjName("btn_close"))
        {
         ObjectSetInteger(0, ObjName("btn_close"), OBJPROP_STATE, true); // Press effect
         Sleep(100);
         ObjectSetInteger(0, ObjName("btn_close"), OBJPROP_STATE, false);
         ChartRedraw();
         
         closeAllState = true; // Trigger Signal
         return true;
        }
     }
   return false;
  }
//+------------------------------------------------------------------+
//| Cleanup                                                          |
//+------------------------------------------------------------------+
void CDashboard::Deinit()
  {
   ObjectsDeleteAll(0, m_prefix);
  }
//+------------------------------------------------------------------+
//| Helpers                                                          |
//+------------------------------------------------------------------+
void CDashboard::CreateRectLabel(string name, int x, int y, int w, int h, color bg, int corner)
  {
   string n = ObjName(name);
   if(ObjectCreate(0, n, OBJ_RECTANGLE_LABEL, 0, 0, 0))
     {
      ObjectSetInteger(0, n, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(0, n, OBJPROP_XSIZE, w);
      ObjectSetInteger(0, n, OBJPROP_YSIZE, h);
      ObjectSetInteger(0, n, OBJPROP_BGCOLOR, bg);
      ObjectSetInteger(0, n, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, n, OBJPROP_CORNER, corner);
      ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, n, OBJPROP_HIDDEN, true);
     }
  }

void CDashboard::CreateLabel(string name, int x, int y, string text, int fontSize, color clr, bool bold)
  {
   string n = ObjName(name);
   if(ObjectCreate(0, n, OBJ_LABEL, 0, 0, 0))
     {
      ObjectSetInteger(0, n, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
      ObjectSetString(0, n, OBJPROP_TEXT, text);
      ObjectSetString(0, n, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(0, n, OBJPROP_FONTSIZE, fontSize);
      ObjectSetInteger(0, n, OBJPROP_COLOR, clr);
      if(bold) ObjectSetInteger(0, n, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER); // Simple bold sim not available, rely on font
      ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, n, OBJPROP_HIDDEN, true);
     }
  }

void CDashboard::CreateButton(string name, int x, int y, int w, int h, string text, color bg, color txtColor)
  {
   string n = ObjName(name);
   if(ObjectCreate(0, n, OBJ_BUTTON, 0, 0, 0))
     {
      ObjectSetInteger(0, n, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(0, n, OBJPROP_XSIZE, w);
      ObjectSetInteger(0, n, OBJPROP_YSIZE, h);
      ObjectSetString(0, n, OBJPROP_TEXT, text);
      ObjectSetString(0, n, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(0, n, OBJPROP_FONTSIZE, 9);
      ObjectSetInteger(0, n, OBJPROP_COLOR, txtColor);
      ObjectSetInteger(0, n, OBJPROP_BGCOLOR, bg);
      ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, n, OBJPROP_HIDDEN, true);
     }
  }
