#!/usr/bin/env python3
"""
DataFrameメモリ最適化テクニック
"""

import pandas as pd
import numpy as np

def optimize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    DataFrameのメモリ使用量を最適化
    
    - float64 → float32（精度は十分）
    - 不要な列を削除
    """
    # float64 → float32
    float_cols = df.select_dtypes(include=['float64']).columns
    df[float_cols] = df[float_cols].astype('float32')
    
    # timestampは不要（indexで管理）
    if 'timestamp' in df.columns:
        df = df.drop('timestamp', axis=1)
    
    # quote_volumeは不要（volumeだけ使用）
    if 'quote_volume' in df.columns:
        df = df.drop('quote_volume', axis=1)
    
    return df

# 使用例
if __name__ == "__main__":
    # テストデータ
    df = pd.DataFrame({
        'open': np.random.rand(1000) * 100,
        'high': np.random.rand(1000) * 100,
        'low': np.random.rand(1000) * 100,
        'close': np.random.rand(1000) * 100,
        'volume': np.random.rand(1000) * 1000000
    })
    
    print("最適化前:")
    print(df.dtypes)
    print(f"メモリ: {df.memory_usage(deep=True).sum() / 1024:.2f} KB")
    
    df_optimized = optimize_dataframe(df)
    
    print("\n最適化後:")
    print(df_optimized.dtypes)
    print(f"メモリ: {df_optimized.memory_usage(deep=True).sum() / 1024:.2f} KB")
    print(f"削減率: {(1 - df_optimized.memory_usage(deep=True).sum() / df.memory_usage(deep=True).sum()) * 100:.1f}%")
