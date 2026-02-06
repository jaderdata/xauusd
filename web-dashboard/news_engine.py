import requests
from datetime import datetime
import pytz

API_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"

def get_today_news():
    """Fetches and filters today's high impact news for USD"""
    try:
        response = requests.get(API_URL, timeout=10)
        data = response.json()
        
        today = datetime.now().date()
        news_items = []
        
        for item in data:
            # Parse date (format: 2026-02-01T05:15:00-05:00)
            item_date = datetime.fromisoformat(item['date']).date()
            
            if item_date == today:
                # Filter for High impact or pertinent USD news
                if item['country'] in ['USD', 'All'] and item['impact'] in ['High', 'Medium']:
                    news_items.append({
                        "title": item['title'],
                        "impact": item['impact'],
                        "time": item['date']
                    })
        
        return news_items
    except Exception as e:
        print(f"Error fetching news: {e}")
        return []

if __name__ == "__main__":
    import json
    import sys
    
    today_news = get_today_news()
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        print(json.dumps(today_news))
    else:
        print(f"Found {len(today_news)} important events for today:")
        for n in today_news:
            print(f"[{n['impact']}] {n['title']} at {n['time']}")
