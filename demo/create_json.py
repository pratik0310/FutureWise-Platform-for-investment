import pandas as pd
import json
import os

def clean_value(val):
    """Safely convert any value to string and strip whitespace"""
    if pd.isna(val):
        return ""
    return str(val).strip()

def process_nse_stocks(csv_file="EQUITY_L.csv"):
    """Process NSE stocks"""
    stocks = []
    
    if not os.path.exists(csv_file):
        print(f"⚠️ Warning: {csv_file} not found, skipping NSE stocks")
        return stocks
    
    try:
        df = pd.read_csv(csv_file)
        df.columns = df.columns.str.strip()
        
        print("📋 NSE Columns:", df.columns.tolist())
        
        symbol_col = "SYMBOL"
        name_col = "NAME OF COMPANY"
        
        if symbol_col not in df.columns or name_col not in df.columns:
            print(f"⚠️ NSE CSV missing required columns")
            return stocks
        
        if "SERIES" in df.columns:
            df = df[df["SERIES"].astype(str).str.strip() == "EQ"]
        
        for _, row in df.iterrows():
            symbol = clean_value(row.get(symbol_col, ""))
            name = clean_value(row.get(name_col, ""))
            
            if symbol and name:
                stocks.append({
                    "symbol": symbol,
                    "name": name,
                    "exchange": "NSE",
                    "yahooSymbol": f"{symbol}.NS"
                })
        
        print(f"✅ NSE: {len(stocks)} stocks loaded")
        
    except Exception as e:
        print(f"❌ Error processing NSE stocks: {e}")
    
    return stocks

def process_us_stocks(csv_file):
    """Process US stocks with exact same format as NSE"""
    stocks = []
    
    if not os.path.exists(csv_file):
        print(f"⚠️ Warning: {csv_file} not found!")
        print(f"   Available files: {os.listdir('.')}")
        return stocks
    
    try:
        df = pd.read_csv(csv_file)
        df.columns = df.columns.str.strip()
        
        print("📋 US Columns:", df.columns.tolist())
        print(f"📋 US Rows: {len(df)}")
        
        # Find Symbol and Name columns
        symbol_col = None
        name_col = None
        
        # Look for Symbol column
        for col in df.columns:
            if col.lower() in ['symbol', 'ticker', 'stock symbol']:
                symbol_col = col
                break
        
        # Look for Name column
        for col in df.columns:
            if col.lower() in ['name', 'company name', 'company', 'security name']:
                name_col = col
                break
        
        # If not found, try to use first two columns
        if symbol_col is None and len(df.columns) >= 1:
            symbol_col = df.columns[0]
            print(f"   Using '{symbol_col}' as Symbol column")
        
        if name_col is None and len(df.columns) >= 2:
            name_col = df.columns[1]
            print(f"   Using '{name_col}' as Name column")
        
        if symbol_col is None or name_col is None:
            print(f"⚠️ Could not find Symbol/Name columns!")
            print(f"   Available columns: {df.columns.tolist()}")
            return stocks
        
        print(f"📌 Using columns: Symbol='{symbol_col}', Name='{name_col}'")
        
        for _, row in df.iterrows():
            symbol = clean_value(row.get(symbol_col, ""))
            name = clean_value(row.get(name_col, ""))
            
            # Remove exchange suffixes if any
            clean_symbol = symbol.split(".")[0] if "." in symbol else symbol
            
            if clean_symbol and name:
                stocks.append({
                    "symbol": clean_symbol,
                    "name": name,
                    "exchange": "US",
                    "yahooSymbol": clean_symbol
                })
        
        print(f"✅ US: {len(stocks)} stocks loaded")
        
    except Exception as e:
        print(f"❌ Error processing US stocks: {e}")
        import traceback
        traceback.print_exc()
    
    return stocks

# ===== Main Execution =====
print("🚀 Starting stock processing...")
print("=" * 50)
print(f"📁 Current directory: {os.getcwd()}")
print(f"📁 Files found: {os.listdir('.')}")
print("=" * 50)

# Get US file name from user
print("\n📝 Enter your US stocks CSV filename:")
print("   (e.g., nasdaq_stocks.csv, us_stocks.csv, EQUITY_US.csv)")
us_file = input("   Filename: ").strip()

if not us_file:
    print("❌ No filename provided! Exiting...")
    exit()

print(f"\n📂 Processing US file: {us_file}")

# Process both
nse_stocks = process_nse_stocks("EQUITY_L.csv")
us_stocks = process_us_stocks(us_file)

# Combine into single array (flat structure)
all_stocks = nse_stocks + us_stocks

# Save as a single JSON file
try:
    with open("all_stocks.json", "w", encoding="utf-8") as f:
        json.dump(all_stocks, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 50)
    print("✅ all_stocks.json created successfully!")
    print("=" * 50)
    print(f"   📊 Total stocks: {len(all_stocks)}")
    print(f"   🇮🇳 NSE: {len(nse_stocks)}")
    print(f"   🇺🇸 US: {len(us_stocks)}")
    print(f"   📁 File saved: all_stocks.json")
    print("=" * 50)
    
except Exception as e:
    print(f"❌ Error saving JSON: {e}")