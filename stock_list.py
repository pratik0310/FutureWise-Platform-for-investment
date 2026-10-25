import pandas as pd

# Change this to your actual file name
file = "D:\\finetuning\\EQUITY_L.csv"

df = pd.read_csv(file)

print(df.head())
print(df.columns)
print("Total stocks:", len(df))