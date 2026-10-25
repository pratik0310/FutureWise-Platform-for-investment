import pandas as pd
import json

CSV_FILE = "EQUITY_L.csv"

# Read NSE stock list
df = pd.read_csv(CSV_FILE)

print("Columns:")
print(df.columns.tolist())

# Keep only Equity series
df = df[df[" SERIES"].astype(str).str.strip() == "EQ"]

stocks = []

for _, row in df.iterrows():

    symbol = str(row["SYMBOL"]).strip()
    name = str(row["NAME OF COMPANY"]).strip()

    stocks.append({
        "symbol": symbol,
        "name": name,
        "exchange": "NSE",
        "yahooSymbol": symbol + ".NS"
    })

# Create JSON
with open("stocks.json", "w", encoding="utf-8") as f:
    json.dump(stocks, f, indent=2, ensure_ascii=False)

print()
print("✅ stocks.json created!")
print("Total stocks:", len(stocks))