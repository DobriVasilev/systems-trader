import { NextResponse } from "next/server";

interface HyperliquidAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated: boolean;
}

interface HyperliquidMeta {
  universe: HyperliquidAsset[];
}

interface CoinPrice {
  coin: string;
  markPx: string;
  midPx: string;
  oraclePx: string;
}

export async function GET() {
  try {
    // Fetch perpetuals meta (all available coins)
    const metaResponse = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
    });

    if (!metaResponse.ok) {
      throw new Error("Failed to fetch meta from Hyperliquid");
    }

    const meta: HyperliquidMeta = await metaResponse.json();

    // Fetch all mid prices
    const pricesResponse = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });

    let prices: Record<string, string> = {};
    if (pricesResponse.ok) {
      prices = await pricesResponse.json();
    }

    // Combine data
    const coins = meta.universe.map((asset) => ({
      symbol: asset.name,
      price: prices[asset.name] ? parseFloat(prices[asset.name]) : null,
      maxLeverage: asset.maxLeverage,
      decimals: asset.szDecimals,
    }));

    // Sort by most popular (BTC, ETH first, then alphabetically)
    const priorityCoins = ["BTC", "ETH", "SOL", "DOGE", "XRP", "HYPE"];
    coins.sort((a, b) => {
      const aIndex = priorityCoins.indexOf(a.symbol);
      const bIndex = priorityCoins.indexOf(b.symbol);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.symbol.localeCompare(b.symbol);
    });

    return NextResponse.json({
      success: true,
      data: coins,
      count: coins.length,
    });
  } catch (error) {
    console.error("Error fetching Hyperliquid coins:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch coins",
      },
      { status: 500 }
    );
  }
}
