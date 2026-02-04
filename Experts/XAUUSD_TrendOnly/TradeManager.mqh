//+------------------------------------------------------------------+
//|                                                 TradeManager.mqh |
//|                                  Copyright 2025, Antigravity AI  |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"

#include <Trade\Trade.mqh>

class CTradeManager
  {
private:
   CTrade            m_trade;
   ulong             m_magic;
   double            m_fixed_lot;

public:
                     CTradeManager(void);
                    ~CTradeManager(void);
   
   void              Init(ulong magic, double lot);
   bool              ExecuteBuy(double volume, double sl, double tp, string comment);
   bool              ExecuteSell(double volume, double sl, double tp, string comment);
   void              ManagePositions(int tp_points);
   void              CloseAll(void);
  };
//+------------------------------------------------------------------+
//| Constructor                                                      |
//+------------------------------------------------------------------+
CTradeManager::CTradeManager(void)
  {
  }
//+------------------------------------------------------------------+
//| Destructor                                                       |
//+------------------------------------------------------------------+
CTradeManager::~CTradeManager(void)
  {
  }
//+------------------------------------------------------------------+
//| Init                                                             |
//+------------------------------------------------------------------+
void CTradeManager::Init(ulong magic, double lot)
  {
   m_magic = magic;
   m_fixed_lot = lot;
   m_trade.SetExpertMagicNumber(m_magic);
   m_trade.SetDeviationInPoints(10);
   m_trade.SetTypeFilling(ORDER_FILLING_IOC); 
   // Note: Filling mode often depends on broker. IOC or FOK.
  }
//+------------------------------------------------------------------+
//| Execute Buy                                                      |
//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
//| Execute Buy                                                      |
//+------------------------------------------------------------------+
bool CTradeManager::ExecuteBuy(double volume, double sl, double tp, string comment)
  {
   // M15 Close execution: Market Order
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   // Normalize
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);
   
   return m_trade.Buy(volume, _Symbol, ask, sl, tp, comment);
  }
//+------------------------------------------------------------------+
//| Execute Sell                                                     |
//+------------------------------------------------------------------+
bool CTradeManager::ExecuteSell(double volume, double sl, double tp, string comment)
  {
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);
   return m_trade.Sell(volume, _Symbol, bid, sl, tp, comment);
  }
//+------------------------------------------------------------------+
//| Manage Open Positions (Trailing, BE, Partials)                   |
//+------------------------------------------------------------------+
void CTradeManager::ManagePositions(int tp_points)
  {
   // Loop all open positions
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      
      // Filter by Magic and Symbol
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
      
      // Get Data
      long type = PositionGetInteger(POSITION_TYPE);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double currentPrice = (type == POSITION_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double currentTP = PositionGetDouble(POSITION_TP);
      double volume = PositionGetDouble(POSITION_VOLUME);
      
      double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
      int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
      
      // Calculate 'R' (Risk defined implicitly or by TP distance)
      // Since we don't store initial SL, we approximate R.
      // Strategy says TP = 2R. So 1R = TP_Distance / 2.
      // Or we can use the fixed SL input if passed.
      // Let's assume passed 'tp_points' is the full 2R distance. So 1R = tp_points / 2.
      
      // NOTE: This logic assumes we know the original setup. For a stateless robot, 
      // best is to pass calculated R or store it in comment/magic.
      // Simplification: We will use a fixed logic based on current price progress.
      
      double profitPoints = 0;
      if(type == POSITION_TYPE_BUY)
         profitPoints = (currentPrice - openPrice) / point;
      else
         profitPoints = (openPrice - currentPrice) / point;
         
      // 1. Logic for Break-Even & Partials at 1R
      // Problem: How do we know what is 1R?
      // Hack: We look at the TP. TP is at 2R. So 1R is half-way to TP.
      double distToTP = MathAbs(currentTP - openPrice) / point;
      if(distToTP < 1) distToTP = 1000; // Safety
      double oneR = distToTP / 2.0; 
      
      // If Profit >= 1R
      if(profitPoints >= oneR)
        {
         // A) Partial Close (50%)
         // Check if we haven't done it yet. Comment check?
         string comment = PositionGetString(POSITION_COMMENT);
         if(StringFind(comment, "Partial") < 0 && volume >= 0.02) // Needs min volume
           {
             double halfVol = NormalizeDouble(volume / 2.0, 2);
             m_trade.PositionClosePartial(ticket, halfVol);
             // Note: Closing partial changes ticket ID usually.
             // We need to return to avoid processing invalid ticket loops.
             return; 
           }
         
         // B) Move SL to Break-Even + Buffer
         double newSL = 0;
         double buffer = 10 * point;
         
         if(type == POSITION_TYPE_BUY)
           {
            newSL = openPrice + buffer;
            if(sl < newSL) // Only move up
               m_trade.PositionModify(ticket, newSL, currentTP);
           }
         else
           {
            newSL = openPrice - buffer;
            if(sl > newSL || sl == 0) // Only move down
               m_trade.PositionModify(ticket, newSL, currentTP);
           }
        }
        
      // 2. Trailing Stop (EMA20) - simple version
      // If price is far ahead (>1.5R), trail behind EMA
      if(profitPoints > (oneR * 1.5))
        {
         // Get EMA20 M15
         int handle = iMA(_Symbol, PERIOD_M15, 20, 0, MODE_EMA, PRICE_CLOSE);
         double ema[];
         CopyBuffer(handle, 0, 1, 1, ema);
         double emaVal = ema[0];
         IndicatorRelease(handle); // Slow! Ideally pass engine handle.
         
         double newSL = 0;
         if(type == POSITION_TYPE_BUY)
           {
            if(emaVal > sl && emaVal < currentPrice)
               m_trade.PositionModify(ticket, emaVal, currentTP);
           }
         else
           {
            if(emaVal < sl && emaVal > currentPrice)
               m_trade.PositionModify(ticket, emaVal, currentTP);
           }
        }
     }
  }
//+------------------------------------------------------------------+
//| Close All Positions (Panic Button)                               |
//+------------------------------------------------------------------+
void CTradeManager::CloseAll(void)
  {
   // 1. Close Open Positions
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
      
      m_trade.PositionClose(ticket);
     }
     
   // 2. Delete Pending Orders (if any)
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket <= 0) continue;
      if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
      if(OrderGetInteger(ORDER_MAGIC) != m_magic) continue;
      
      m_trade.OrderDelete(ticket);
     }
  }
