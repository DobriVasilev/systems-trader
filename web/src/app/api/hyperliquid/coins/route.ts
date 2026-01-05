import { NextResponse } from "next/server";

const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info";

interface HyperliquidAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

interface HyperliquidSpotToken {
  name: string;
  szDecimals: number;
  weiDecimals: number;
  index: number;
  tokenId: string;
  isCanonical?: boolean;
  evmContract?: string | null;
  fullName?: string;
}

interface HyperliquidSpotMeta {
  tokens: HyperliquidSpotToken[];
  universe: Array<{
    name: string;
    tokens: number[];
    index: number;
    isCanonical?: boolean;
  }>;
}

interface HyperliquidMeta {
  universe: HyperliquidAsset[];
}

interface CoinInfo {
  symbol: string;
  name: string;
  price: number | null;
  maxLeverage: number | null;
  decimals: number;
  type: "perp" | "spot" | "pre-launch";
  icon?: string;
}

// Map common crypto symbols to CoinGecko IDs for icons
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  DOGE: "dogecoin",
  XRP: "ripple",
  HYPE: "hyperliquid",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  ALGO: "algorand",
  VET: "vechain",
  FIL: "filecoin",
  TRX: "tron",
  ETC: "ethereum-classic",
  XMR: "monero",
  AAVE: "aave",
  MKR: "maker",
  COMP: "compound-governance-token",
  SNX: "synthetix-network-token",
  CRV: "curve-dao-token",
  SUSHI: "sushi",
  YFI: "yearn-finance",
  "1INCH": "1inch",
  ENJ: "enjincoin",
  MANA: "decentraland",
  SAND: "the-sandbox",
  AXS: "axie-infinity",
  GALA: "gala",
  APE: "apecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  FLOKI: "floki",
  WIF: "dogwifcoin",
  BONK: "bonk",
  ARB: "arbitrum",
  OP: "optimism",
  SUI: "sui",
  APT: "aptos",
  SEI: "sei-network",
  INJ: "injective-protocol",
  TIA: "celestia",
  JUP: "jupiter-exchange-solana",
  PYTH: "pyth-network",
  STX: "stacks",
  IMX: "immutable-x",
  BLUR: "blur",
  LDO: "lido-dao",
  RPL: "rocket-pool",
  FXS: "frax-share",
  GMX: "gmx",
  DYDX: "dydx",
  JTO: "jito-governance-token",
  WLD: "worldcoin-wld",
  STRK: "starknet",
  NEAR: "near",
  FTM: "fantom",
  RENDER: "render-token",
  GRT: "the-graph",
  AR: "arweave",
  ICP: "internet-computer",
  EGLD: "multiversx-egld",
  FLOW: "flow",
  KAVA: "kava",
  ROSE: "oasis-network",
  ZEC: "zcash",
  DASH: "dash",
  NEO: "neo",
  WAVES: "waves",
  IOTA: "iota",
  ZIL: "zilliqa",
  ONT: "ontology",
  QTUM: "qtum",
  ZRX: "0x",
  BAT: "basic-attention-token",
  KNC: "kyber-network-crystal",
  REN: "republic-protocol",
  OCEAN: "ocean-protocol",
  ANKR: "ankr",
  CELO: "celo",
  SKL: "skale",
  STORJ: "storj",
  NKN: "nkn",
  BAND: "band-protocol",
  KLAY: "klaytn",
  ONE: "harmony",
  HOT: "holotoken",
  IOTX: "iotex",
  HBAR: "hedera-hashgraph",
  XTZ: "tezos",
  EOS: "eos",
  THETA: "theta-token",
  CHZ: "chiliz",
  ENS: "ethereum-name-service",
  CAKE: "pancakeswap-token",
  RUNE: "thorchain",
  OSMO: "osmosis",
  CKB: "nervos-network",
  KAS: "kaspa",
  RNDR: "render-token",
  ORDI: "ordinals",
  WOO: "woo-network",
  CFX: "conflux-token",
  MINA: "mina-protocol",
  ASTR: "astar",
  FLR: "flare-networks",
  AGIX: "singularitynet",
  FET: "fetch-ai",
  TAO: "bittensor",
  PENDLE: "pendle",
  SSV: "ssv-network",
  ACH: "alchemy-pay",
  MAGIC: "magic",
  RDNT: "radiant-capital",
  LQTY: "liquity",
  ID: "space-id",
  EDU: "open-campus",
  SXP: "swipe",
  RAY: "raydium",
  ORCA: "orca",
  MSOL: "marinade-staked-sol",
  JITO: "jito-governance-token",
  MNGO: "mango-markets",
  HNT: "helium",
  MOB: "mobilecoin",
  GMT: "stepn",
  GST: "green-satoshi-token",
  MASK: "mask-network",
  SUPER: "superfarm",
  LOOKS: "looksrare",
  X2Y2: "x2y2",
  SUDO: "sudoswap",
  LEVER: "leverfi",
  HIGH: "highstreet",
  LUNC: "terra-luna",
  USTC: "terrausd",
  LUNA: "terra-luna-2",
};

// Use CoinCap for coin icons (most reliable)
function getCoinIcon(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();

  // Try CryptoCompare first (most reliable)
  return `https://assets.coincap.io/assets/icons/${upperSymbol.toLowerCase()}@2x.png`;
}

export async function GET() {
  try {
    // Fetch all data in parallel
    const [perpsMetaResponse, spotMetaResponse, allMidsResponse] = await Promise.all([
      // Perpetuals meta
      fetch(HYPERLIQUID_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "meta" }),
      }),
      // Spot meta
      fetch(HYPERLIQUID_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "spotMeta" }),
      }),
      // All mid prices (includes perps and spot)
      fetch(HYPERLIQUID_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "allMids" }),
      }),
    ]);

    // Parse responses
    const perpsMeta: HyperliquidMeta = perpsMetaResponse.ok
      ? await perpsMetaResponse.json()
      : { universe: [] };

    const spotMeta: HyperliquidSpotMeta = spotMetaResponse.ok
      ? await spotMetaResponse.json()
      : { tokens: [], universe: [] };

    const allMids: Record<string, string> = allMidsResponse.ok
      ? await allMidsResponse.json()
      : {};

    const coins: CoinInfo[] = [];
    const seenSymbols = new Set<string>();

    // Add perpetual assets
    perpsMeta.universe.forEach((asset) => {
      const symbol = asset.name;
      if (!seenSymbols.has(symbol)) {
        seenSymbols.add(symbol);
        coins.push({
          symbol,
          name: getFullName(symbol),
          price: allMids[symbol] ? parseFloat(allMids[symbol]) : null,
          maxLeverage: asset.maxLeverage,
          decimals: asset.szDecimals,
          type: "perp",
          icon: getCoinIcon(symbol),
        });
      }
    });

    // Add spot tokens
    spotMeta.tokens?.forEach((token) => {
      const symbol = token.name;
      if (!seenSymbols.has(symbol)) {
        seenSymbols.add(symbol);
        coins.push({
          symbol,
          name: token.fullName || getFullName(symbol),
          price: allMids[symbol] ? parseFloat(allMids[symbol]) : null,
          maxLeverage: null,
          decimals: token.szDecimals,
          type: "spot",
          icon: getCoinIcon(symbol),
        });
      }
    });

    // Also check spot universe for any additional trading pairs
    spotMeta.universe?.forEach((pair) => {
      const symbol = pair.name;
      if (!seenSymbols.has(symbol) && symbol.includes("/")) {
        // This is a trading pair like "HYPE/USDC"
        const baseSymbol = symbol.split("/")[0];
        if (!seenSymbols.has(baseSymbol)) {
          seenSymbols.add(baseSymbol);
          coins.push({
            symbol: baseSymbol,
            name: getFullName(baseSymbol),
            price: allMids[baseSymbol] ? parseFloat(allMids[baseSymbol]) : null,
            maxLeverage: null,
            decimals: 8,
            type: "spot",
            icon: getCoinIcon(baseSymbol),
          });
        }
      }
    });

    // Sort by priority and then alphabetically
    const priorityCoins = ["BTC", "ETH", "SOL", "DOGE", "XRP", "HYPE", "ARB", "OP", "SUI", "APT"];
    coins.sort((a, b) => {
      const aIndex = priorityCoins.indexOf(a.symbol);
      const bIndex = priorityCoins.indexOf(b.symbol);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Then by type (perp first, then spot)
      if (a.type !== b.type) {
        return a.type === "perp" ? -1 : 1;
      }

      return a.symbol.localeCompare(b.symbol);
    });

    return NextResponse.json({
      success: true,
      data: coins,
      count: coins.length,
      breakdown: {
        perps: coins.filter(c => c.type === "perp").length,
        spot: coins.filter(c => c.type === "spot").length,
        preLaunch: coins.filter(c => c.type === "pre-launch").length,
      },
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

// Helper to get full coin names
function getFullName(symbol: string): string {
  const names: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    SOL: "Solana",
    DOGE: "Dogecoin",
    XRP: "XRP",
    HYPE: "Hyperliquid",
    ADA: "Cardano",
    AVAX: "Avalanche",
    DOT: "Polkadot",
    MATIC: "Polygon",
    LINK: "Chainlink",
    UNI: "Uniswap",
    ATOM: "Cosmos",
    LTC: "Litecoin",
    BCH: "Bitcoin Cash",
    ARB: "Arbitrum",
    OP: "Optimism",
    SUI: "Sui",
    APT: "Aptos",
    SEI: "Sei",
    INJ: "Injective",
    TIA: "Celestia",
    JUP: "Jupiter",
    PYTH: "Pyth",
    WIF: "dogwifhat",
    BONK: "Bonk",
    PEPE: "Pepe",
    SHIB: "Shiba Inu",
    FLOKI: "Floki",
    NEAR: "NEAR Protocol",
    FTM: "Fantom",
    RENDER: "Render",
    GRT: "The Graph",
    AR: "Arweave",
    ICP: "Internet Computer",
    STX: "Stacks",
    IMX: "Immutable X",
    BLUR: "Blur",
    LDO: "Lido DAO",
    GMX: "GMX",
    DYDX: "dYdX",
    WLD: "Worldcoin",
    STRK: "Starknet",
    TAO: "Bittensor",
    FET: "Fetch.ai",
    AGIX: "SingularityNET",
    PENDLE: "Pendle",
    ORDI: "ORDI",
    KAS: "Kaspa",
    OSMO: "Osmosis",
    RUNE: "THORChain",
    CKB: "Nervos",
    MINA: "Mina",
    ASTR: "Astar",
    CFX: "Conflux",
    WOO: "WOO",
    CAKE: "PancakeSwap",
    ENS: "ENS",
    CHZ: "Chiliz",
    THETA: "Theta",
    EOS: "EOS",
    XTZ: "Tezos",
    HBAR: "Hedera",
    ONE: "Harmony",
    KLAY: "Klaytn",
    CELO: "Celo",
    OCEAN: "Ocean Protocol",
    BAND: "Band Protocol",
    ANKR: "Ankr",
    REN: "Ren",
    KNC: "Kyber Network",
    BAT: "Basic Attention Token",
    ZRX: "0x",
    QTUM: "Qtum",
    ONT: "Ontology",
    ZIL: "Zilliqa",
    WAVES: "Waves",
    NEO: "Neo",
    DASH: "Dash",
    ZEC: "Zcash",
    ROSE: "Oasis",
    KAVA: "Kava",
    FLOW: "Flow",
    EGLD: "MultiversX",
    SNX: "Synthetix",
    AAVE: "Aave",
    MKR: "Maker",
    COMP: "Compound",
    CRV: "Curve",
    SUSHI: "SushiSwap",
    YFI: "yearn.finance",
    "1INCH": "1inch",
    ENJ: "Enjin",
    MANA: "Decentraland",
    SAND: "The Sandbox",
    AXS: "Axie Infinity",
    GALA: "Gala",
    APE: "ApeCoin",
    MAGIC: "Magic",
    GMT: "STEPN",
    MASK: "Mask Network",
    LOOKS: "LooksRare",
    LQTY: "Liquity",
    ID: "SPACE ID",
    EDU: "Open Campus",
    RAY: "Raydium",
    ORCA: "Orca",
    HNT: "Helium",
    FIL: "Filecoin",
    TRX: "TRON",
    ETC: "Ethereum Classic",
    XMR: "Monero",
    ALGO: "Algorand",
    VET: "VeChain",
    XLM: "Stellar",
  };
  return names[symbol.toUpperCase()] || symbol;
}
