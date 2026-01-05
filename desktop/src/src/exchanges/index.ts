// Exchange module - exports all exchange implementations

export * from "./types";
export { HyperliquidExchange, createHyperliquidExchange } from "./hyperliquid";

import { Exchange, ExchangeType } from "./types";
import { createHyperliquidExchange } from "./hyperliquid";

// Factory to create exchange instance by type
export function createExchange(type: ExchangeType, isTestnet: boolean = false): Exchange {
  switch (type) {
    case "hyperliquid":
      return createHyperliquidExchange(isTestnet);
    default:
      throw new Error(`Unknown exchange type: ${type}`);
  }
}

// Default exchange
export const DEFAULT_EXCHANGE: ExchangeType = "hyperliquid";
