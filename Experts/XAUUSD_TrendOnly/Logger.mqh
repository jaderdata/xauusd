//+------------------------------------------------------------------+
//|                                                       Logger.mqh |
//|                                  Copyright 2025, Antigravity AI  |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"

class CLogger
  {
private:
   string            m_filename;
   bool              m_debug_mode;

public:
                     CLogger(void);
                    ~CLogger(void);
   
   void              Init(string filename="xauusd_logs.txt", bool debug=true);
   void              LogSignal(datetime time, string symbol, string regime, double adx_h1, string setup_type, double price, double sl, double tp, string reasons);
   void              LogTrade(long ticket, string type, double price, double profit, string comment);
   void              Write(string json_content);
  };
//+------------------------------------------------------------------+
//| Constructor                                                      |
//+------------------------------------------------------------------+
CLogger::CLogger(void) : m_debug_mode(true)
  {
  }
//+------------------------------------------------------------------+
//| Destructor                                                       |
//+------------------------------------------------------------------+
CLogger::~CLogger(void)
  {
  }
//+------------------------------------------------------------------+
//| Initialize                                                       |
//+------------------------------------------------------------------+
void CLogger::Init(string filename, bool debug)
  {
   m_filename = filename;
   m_debug_mode = debug;
  }
//+------------------------------------------------------------------+
//| Log a generated signal                                           |
//+------------------------------------------------------------------+
void CLogger::LogSignal(datetime time, string symbol, string regime, double adx_h1, string setup_type, double price, double sl, double tp, string reasons)
  {
   string json = StringFormat(
      "{\"event\":\"signal\", \"time\":\"%s\", \"symbol\":\"%s\", \"regime\":\"%s\", \"adx_h1\":%.2f, \"setup\":\"%s\", \"price\":%.2f, \"sl\":%.2f, \"tp\":%.2f, \"reasons\":\"%s\"}",
      TimeToString(time), symbol, regime, adx_h1, setup_type, price, sl, tp, reasons
   );
   
   Write(json);
  }
//+------------------------------------------------------------------+
//| Log trade execution                                              |
//+------------------------------------------------------------------+
void CLogger::LogTrade(long ticket, string type, double price, double profit, string comment)
  {
   string json = StringFormat(
      "{\"event\":\"trade\", \"ticket\":%d, \"type\":\"%s\", \"price\":%.2f, \"profit\":%.2f, \"comment\":\"%s\"}",
      ticket, type, price, profit, comment
   );
   
   Write(json);
  }
//+------------------------------------------------------------------+
//| Write to file or print                                           |
//+------------------------------------------------------------------+
void CLogger::Write(string json_content)
  {
   if(m_debug_mode)
      Print("LOG: ", json_content);
      
   // In a real scenario, we would open the file and append the line.
   // For now, Print is sufficient for the user to see in the 'Initial implementation'.
   int file_handle = FileOpen(m_filename, FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ);
   if(file_handle != INVALID_HANDLE)
     {
      FileSeek(file_handle, 0, SEEK_END);
      FileWrite(file_handle, json_content);
      FileClose(file_handle);
     }
  }
