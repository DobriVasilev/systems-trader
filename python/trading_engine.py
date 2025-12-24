#!/usr/bin/env python3
"""
Hyperliquid Trading Engine
Main entry point for the Python trading backend
"""

import json
import sys
from typing import Optional
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
from eth_account import Account


class TradingEngine:
    """Main trading engine that interfaces with Hyperliquid API"""

    def __init__(self, private_key: Optional[str] = None, testnet: bool = False):
        self.private_key = private_key
        self.testnet = testnet
        self.base_url = constants.TESTNET_API_URL if testnet else constants.MAINNET_API_URL
        self.info = Info(self.base_url, skip_ws=True)
        self.exchange: Optional[Exchange] = None
        self.account: Optional[Account] = None

        if private_key:
            self._setup_account()

    def _setup_account(self):
        """Initialize account from private key"""
        self.account = Account.from_key(self.private_key)
        self.exchange = Exchange(self.account, self.base_url)

    def get_user_state(self, address: str) -> dict:
        """Get account balances and positions"""
        return self.info.user_state(address)

    def get_all_mids(self) -> dict:
        """Get mid prices for all assets"""
        return self.info.all_mids()

    def get_meta(self) -> dict:
        """Get exchange metadata (assets, decimals, etc)"""
        return self.info.meta()

    def calculate_position_size(
        self,
        risk_amount: float,
        entry_price: float,
        stop_loss: float
    ) -> dict:
        """Calculate position size based on risk parameters"""
        sl_distance = abs(entry_price - stop_loss)
        sl_percent = (sl_distance / entry_price) * 100
        position_value = risk_amount / (sl_percent / 100)
        quantity = position_value / entry_price

        return {
            "position_value": round(position_value, 2),
            "quantity": round(quantity, 6),
            "sl_percent": round(sl_percent, 2),
            "risk_amount": risk_amount
        }

    def place_market_order(
        self,
        symbol: str,
        is_buy: bool,
        size: float,
        reduce_only: bool = False
    ) -> dict:
        """Place a market order"""
        if not self.exchange:
            return {"error": "Exchange not initialized. Set private key first."}

        return self.exchange.market_open(
            name=symbol,
            is_buy=is_buy,
            sz=size,
            reduce_only=reduce_only
        )

    def place_limit_order(
        self,
        symbol: str,
        is_buy: bool,
        size: float,
        price: float,
        reduce_only: bool = False
    ) -> dict:
        """Place a limit order"""
        if not self.exchange:
            return {"error": "Exchange not initialized. Set private key first."}

        return self.exchange.order(
            name=symbol,
            is_buy=is_buy,
            sz=size,
            limit_px=price,
            order_type={"limit": {"tif": "Gtc"}},
            reduce_only=reduce_only
        )

    def set_leverage(self, symbol: str, leverage: int, is_cross: bool = True) -> dict:
        """Set leverage for a symbol"""
        if not self.exchange:
            return {"error": "Exchange not initialized. Set private key first."}

        return self.exchange.update_leverage(leverage, symbol, is_cross)

    def close_position(self, symbol: str) -> dict:
        """Close all positions for a symbol"""
        if not self.exchange:
            return {"error": "Exchange not initialized. Set private key first."}

        return self.exchange.market_close(symbol)

    def get_open_orders(self, address: str) -> list:
        """Get all open orders for an address"""
        return self.info.open_orders(address)

    def cancel_order(self, symbol: str, order_id: int) -> dict:
        """Cancel a specific order"""
        if not self.exchange:
            return {"error": "Exchange not initialized. Set private key first."}

        return self.exchange.cancel(symbol, order_id)


def handle_command(engine: TradingEngine, command: dict) -> dict:
    """Handle a command from the Tauri frontend"""
    action = command.get("action")

    if action == "get_user_state":
        return engine.get_user_state(command["address"])

    elif action == "get_mids":
        return engine.get_all_mids()

    elif action == "get_meta":
        return engine.get_meta()

    elif action == "calculate_position":
        return engine.calculate_position_size(
            command["risk_amount"],
            command["entry_price"],
            command["stop_loss"]
        )

    elif action == "set_private_key":
        engine.private_key = command["private_key"]
        engine._setup_account()
        return {"success": True, "address": engine.account.address}

    elif action == "place_market_order":
        return engine.place_market_order(
            command["symbol"],
            command["is_buy"],
            command["size"],
            command.get("reduce_only", False)
        )

    elif action == "place_limit_order":
        return engine.place_limit_order(
            command["symbol"],
            command["is_buy"],
            command["size"],
            command["price"],
            command.get("reduce_only", False)
        )

    elif action == "set_leverage":
        return engine.set_leverage(
            command["symbol"],
            command["leverage"],
            command.get("is_cross", True)
        )

    elif action == "close_position":
        return engine.close_position(command["symbol"])

    elif action == "get_open_orders":
        return {"orders": engine.get_open_orders(command["address"])}

    elif action == "cancel_order":
        return engine.cancel_order(command["symbol"], command["order_id"])

    else:
        return {"error": f"Unknown action: {action}"}


def main():
    """Main entry point - reads JSON commands from stdin, outputs to stdout"""
    engine = TradingEngine()

    # Read commands from stdin (sent by Tauri)
    for line in sys.stdin:
        try:
            command = json.loads(line.strip())
            result = handle_command(engine, command)
            print(json.dumps(result), flush=True)
        except json.JSONDecodeError as e:
            print(json.dumps({"error": f"Invalid JSON: {e}"}), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
