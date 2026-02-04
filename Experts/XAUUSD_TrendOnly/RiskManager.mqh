//+------------------------------------------------------------------+
//|                                                  RiskManager.mqh |
//|                                  Copyright 2025, Antigravity AI  |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"

class CRiskManager
  {
private:
   int               m_max_spread_points;
   int               m_max_trades_day;
   double            m_max_daily_loss; // USD
   ulong             m_magic;
   
public:
                     CRiskManager(void);
                    ~CRiskManager(void);
   
   void              Init(int max_spread, int max_trades, double max_daily_loss, ulong magic);
   bool              CheckSpread(void);
   bool              CheckTimeWindow(void);
   bool              CheckDailyLimit(void);
   double            GetDailyProfit(void);
  };
//+------------------------------------------------------------------+
//| Constructor                                                      |
//+------------------------------------------------------------------+
CRiskManager::CRiskManager(void) : m_max_spread_points(35), m_max_trades_day(3), m_max_daily_loss(0.0), m_magic(0)
  {
  }
//+------------------------------------------------------------------+
//| Destructor                                                       |
//+------------------------------------------------------------------+
CRiskManager::~CRiskManager(void)
  {
  }
//+------------------------------------------------------------------+
//| Init                                                             |
//+------------------------------------------------------------------+
void CRiskManager::Init(int max_spread, int max_trades, double max_daily_loss, ulong magic)
  {
   m_max_spread_points = max_spread;
   m_max_trades_day = max_trades;
   m_max_daily_loss = max_daily_loss;
   m_magic = magic;
  }
//+------------------------------------------------------------------+
//| Check Spread                                                     |
//+------------------------------------------------------------------+
bool CRiskManager::CheckSpread(void)
  {
   long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   if(spread > m_max_spread_points)
      return false;
   return true;
  }
//+------------------------------------------------------------------+
//| Check Operating Hours (London/NY)                                |
//+------------------------------------------------------------------+
bool CRiskManager::CheckTimeWindow(void)
  {
   datetime now = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(now, dt);
   
   // London Open (08:00) to NY Close (17:00) Server Time (approx)
   // Better to expose this as input parameters in V2
   if(dt.hour >= 8 && dt.hour < 20) 
      return true;
      
   return false;
  }
//+------------------------------------------------------------------+
//| Check Daily Limit (Max Trades & Max Loss)                        |
//+------------------------------------------------------------------+
bool CRiskManager::CheckDailyLimit(void)
  {
   // Select history for today
   datetime start_day = iTime(_Symbol, PERIOD_D1, 0);
   datetime end_day = TimeCurrent() + 86400; // Future
   
   if(!HistorySelect(start_day, end_day)) return true; // Could not select, assume safe or error
   
   int total_deals = HistoryDealsTotal();
   int trades_count = 0;
   // Recalculate count, but use GetDailyProfit for PnL potentially? 
   // Doing full loop again for count is safest to match logic. 
   // Optimization: Let's keep logic separate or robust.
   // For speed, we will keep loop here but it's fine.
   double daily_pnl = GetDailyProfit(); // Use the new function for value
   
   for(int i = 0; i < total_deals; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      ulong magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      
      if(magic != m_magic || symbol != _Symbol) continue;
      
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_OUT)
         trades_count++;
     }
     
   // Check Max Trades
   if(trades_count >= m_max_trades_day)
     {
      // Print("Risk Manager: Max Daily Trades Reached (", trades_count, ")");
      return false;
     }
     
   // Check Max Daily Loss (Input should be positive, e.g., 100.0)
   // If pnl is -150 and limit is 100, -150 < -100 is True -> Stop
   if(m_max_daily_loss > 0 && daily_pnl < (-1.0 * m_max_daily_loss))
     {
      // Print("Risk Manager: Daily Loss Limit Hit (", daily_pnl, ")");
      return false;
     }
     
   return true;
  }
//+------------------------------------------------------------------+
//| Get Daily Profit (Public)                                        |
//+------------------------------------------------------------------+
double CRiskManager::GetDailyProfit(void)
  {
   datetime start_day = iTime(_Symbol, PERIOD_D1, 0);
   datetime end_day = TimeCurrent() + 86400; 
   
   if(!HistorySelect(start_day, end_day)) return 0.0;
   
   int total_deals = HistoryDealsTotal();
   double daily_pnl = 0.0;
   
   for(int i = 0; i < total_deals; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      ulong magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      
      if(magic != m_magic || symbol != _Symbol) continue;
      
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_OUT)
        {
         double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
         double swap = HistoryDealGetDouble(ticket, DEAL_SWAP);
         double comm = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
         daily_pnl += (profit + swap + comm);
        }
     }
   return daily_pnl;
  }
