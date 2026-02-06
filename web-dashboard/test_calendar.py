import MetaTrader5 as mt5
from datetime import datetime, timedelta

if not mt5.initialize():
    print("Failed to initialize MT5")
    quit()

# Get events for the current week
start = datetime.now()
end = start + timedelta(days=1)

items = mt5.calendar_items_get()
if items:
    print(f"Total calendar items found: {len(items)}")
    # Filter for USD events with high/medium importance
    usd_items = [i for i in items if i.country == 'United States']
    print(f"USD items found: {len(usd_items)}")
    for item in usd_items[:5]:
        print(f"- {item.name} (Importance: {item.importance})")
else:
    print("No calendar items found.")

mt5.shutdown()
