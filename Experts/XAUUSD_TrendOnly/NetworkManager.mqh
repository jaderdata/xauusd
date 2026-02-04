//+------------------------------------------------------------------+
//|                                               NetworkManager.mqh |
//|                                  Copyright 2025, Antigravity AI  |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, Antigravity AI"
#property link      "https://www.mql5.com"

class CNetworkManager
  {
private:
   string            m_api_url;
   bool              m_enabled;
   
   bool              SendPost(string endpoint, string json_data);

public:
                     CNetworkManager();
                    ~CNetworkManager();
   
   void              Init(string url);
   void              SendTick(string symbol, double bid, double ask, double equity, double profit);
   void              SendTrade(string symbol, string type, double price, double vol, string comment);
   string            GetCommand();
   
   bool              SendPost(string endpoint, string json_data);
   string            SendGet(string endpoint);
  };
//+------------------------------------------------------------------+
//| Constructor                                                      |
//+------------------------------------------------------------------+
CNetworkManager::CNetworkManager() : m_api_url("http://localhost:3000/api"), m_enabled(true)
  {
  }
//+------------------------------------------------------------------+
//| Destructor                                                       |
//+------------------------------------------------------------------+
CNetworkManager::~CNetworkManager()
  {
  }
//+------------------------------------------------------------------+
//| Init                                                             |
//+------------------------------------------------------------------+
void CNetworkManager::Init(string url)
  {
   if(StringLen(url) > 0) m_api_url = url;
   
   // Test permissions
   string headers;
   char data[], result[];
   string strData = "{}";
   StringToCharArray(strData, data, 0, StringLen(strData));
   
   // Simple check if WebRequest is allowed
   // We don't block Init, but we warn
   if(!TerminalInfoInteger(TERMINAL_DLLS_ALLOWED) && false) 
     {
      // WebRequest doesn't need DLL, but needs URL allowance in Options
      Print("NetworkManager: MAKE SURE URL IS ADDED TO 'ALLOWED URLS' IN OPTION!");
     }
  }
//+------------------------------------------------------------------+
//| Send Tick Data                                                   |
//+------------------------------------------------------------------+
void CNetworkManager::SendTick(string symbol, double bid, double ask, double equity, double profit)
  {
   if(!m_enabled) return;
   
   string json = StringFormat(
      "{\"type\":\"tick\",\"symbol\":\"%s\",\"bid\":%G,\"ask\":%G,\"equity\":%.2f,\"profit\":%.2f}",
      symbol, bid, ask, equity, profit
   );
   
   SendPost("/tick", json);
  }
//+------------------------------------------------------------------+
//| Send Trade Event                                                 |
//+------------------------------------------------------------------+
void CNetworkManager::SendTrade(string symbol, string type, double price, double vol, string comment)
  {
   if(!m_enabled) return;
   
   string json = StringFormat(
      "{\"type\":\"trade\",\"symbol\":\"%s\",\"side\":\"%s\",\"price\":%G,\"vol\":%.2f,\"comment\":\"%s\"}",
      symbol, type, price, vol, comment
   );
   
   SendPost("/trade", json);
  }
//+------------------------------------------------------------------+
//| Get Command                                                      |
//+------------------------------------------------------------------+
string CNetworkManager::GetCommand(void)
  {
   if(!m_enabled) return "";
   
   string response = SendGet("/command");
   if(StringLen(response) == 0) return "";
   
   // Very simple manual JSON parse for "command":"CMD"
   // "command":"PAUSE"
   int start = StringFind(response, "\"command\":\"");
   if(start < 0) return "";
   
   start += 11; // Skip "command":"
   int end = StringFind(response, "\"", start);
   if(end < 0) return "";
   
   string cmd = StringSubstr(response, start, end - start);
   if(cmd == "null") return "";
   
   return cmd;
  }
//+------------------------------------------------------------------+
//| Internal Post Request                                            |
//+------------------------------------------------------------------+
bool CNetworkManager::SendPost(string endpoint, string json_data)
  {
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   string url = m_api_url + endpoint;
   
   StringToCharArray(json_data, data, 0, StringLen(json_data));
   
   int res = WebRequest("POST", url, headers, 1000, data, data, headers, result);
   
   if(res == -1)
     {
      int err = GetLastError();
      if(err == 4060) // ERROR_NOT_ALLOWED_PROGRAM
        {
         static bool printed = false;
         if(!printed)
           {
            Print("NetworkManager Error: URL NOT ALLOWED. Add '", m_api_url, "' to Tools->Options->Expert Advisors");
            printed = true;
           }
        }
      return false;
     }
     
   return (res == 200);
  }
//+------------------------------------------------------------------+
//| Internal Get Request                                             |
//+------------------------------------------------------------------+
string CNetworkManager::SendGet(string endpoint)
  {
   char data[];
   char result[];
   string headers = "";
   string url = m_api_url + endpoint;
   
   int res = WebRequest("GET", url, headers, 500, data, data, headers, result); // Low timeout 500ms
   
   if(res == -1 || res != 200) return "";
   
   return CharArrayToString(result);
  }
