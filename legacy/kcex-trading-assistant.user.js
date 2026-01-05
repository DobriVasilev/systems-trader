// ==UserScript==
// @name         KCEX Trading Assistant
// @namespace    http://tampermonkey.net/
// @version      9.31
// @description  Auto-calculate position size, auto-fill forms, auto-place trades on KCEX
// @author       Claude
// @match        https://www.kcex.com/futures/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION (defaults, can be overridden by saved settings)
    // ============================================
    const DEFAULT_CONFIG = {
        riskAmount: 1.00,
        leverage: 25,
        autoUpdateEntry: true,
        updateInterval: 500,
        sidebarWidth: 280,
        // Liquidation safety thresholds (SL to Liquidation distance in $)
        // < 100: DANGER - requires checkbox acknowledgment or auto-adjust leverage
        // 100-300: WARNING - just shows warning message
        // > 300: SAFE - no warning
        liqDangerDistance: 100,   // Below this = DANGER (checkbox required or suggest leverage change)
        liqWarningDistance: 300,  // Below this = WARNING (just show warning)
        liqSafeTargetMin: 150,    // When auto-adjusting leverage, target at least this distance
        liqSafeTargetMax: 300,    // When auto-adjusting leverage, target at most this distance
        // Maintenance Margin Rate - KCEX uses 0.5% for BTC Tier 1 (0-30 BTC)
        // Higher tiers have higher MMR (1% for 30-36 BTC, etc.)
        maintenanceMarginRate: 0.005,  // 0.5%
        // PNL Verification Settings
        pnlVerification: true,         // Enable PNL verification with KCEX
        pnlTolerance: 0.10,            // 10% tolerance (0.10 = 10%)
        pnlMaxIterations: 3,           // Max adjustment iterations
        takerFeeRate: 0.0006,          // 0.06% taker fee
        // Google Sheets Integration
        googleSheetsUrl: '',           // Web app URL for logging trades
        copyTradeToClipboard: false,   // Copy trade data to clipboard (for Google Sheets paste)
        copyReportToClipboard: false,  // Copy trade report to clipboard
        // Confirmation Modal Settings
        updateEntryOnConfirm: false,   // Update entry price to latest when clicking confirm
        // Unfilled Order Settings
        autoRetryUnfilled: false,      // Automatically retry unfilled orders with new entry
        unfilledWaitTime: 30000,       // How long to wait for fill before prompting retry (ms)
        maxRiskMultiplier: 2.0,        // Max allowed risk increase when editing entry (2.0 = 2x risk)
        // Chart Screenshot Settings
        chartScreenshotOnEntry: false, // Attempt to capture chart screenshot on entry fill
        // Balance & Leverage Settings
        autoAdjustLeverage: true,      // Auto-increase leverage if balance insufficient (when safe)
        // Debug Settings
        debugLogging: false,           // Enable console logging for debugging (turn off for performance)
    };

    // Load saved settings or use defaults
    function loadSettings() {
        try {
            const saved = localStorage.getItem('kcex_settings');
            if (saved) {
                return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
            }
        } catch (e) {}
        return { ...DEFAULT_CONFIG };
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem('kcex_settings', JSON.stringify(settings));
        } catch (e) {}
    }

    let CONFIG = loadSettings();

    // ============================================
    // GOOGLE SHEETS INTEGRATION
    // ============================================

    // Get current timeframe from KCEX (e.g., "5m", "1H")
    function getTimeframe() {
        const activeInterval = document.querySelector('.klineInterval_activeInterval__AmMwu span');
        return activeInterval ? activeInterval.textContent.trim() : '5m';
    }

    // Get trading pair from KCEX (e.g., "BTC USDT" -> "BTCUSDT")
    function getTradingPair() {
        const pairEl = document.querySelector('.contractDetail_contractName__dCJZa');
        if (pairEl) {
            return pairEl.textContent.trim().replace(/\s+/g, '');
        }
        // Fallback: parse from URL
        const url = window.location.href;
        const match = url.match(/futures\/([A-Z]+_[A-Z]+)/i);
        return match ? match[1].replace('_', '') : 'BTCUSDT';
    }

    // Format date as DD/MM
    function formatDateDDMM(date) {
        const d = date || new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    }

    // Format time as HH:MM
    function formatTimeHHMM(date) {
        const d = date || new Date();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    function logTradeToGoogleSheets(tradeData) {
        if (!CONFIG.googleSheetsUrl) {
            log('[Sheets] No Google Sheets URL configured - skipping');
            return false;
        }

        log('[Sheets] Sending trade data to Google Sheets...');

        // Format data for the spreadsheet columns
        const sheetData = {
            date: tradeData.date,           // Column B: DD/MM
            time: tradeData.timeHHMM,       // Column C: HH:MM
            entry: tradeData.entry,         // Column G: Avg Entry
            sl: tradeData.sl,               // Column H: Stop Loss
            risk: tradeData.targetRisk,     // Column J: Risk (target)
            expectedLoss: tradeData.risk,   // Column K: Expected Loss (KCEX-verified)
            positionSize: tradeData.positionSize, // Column O: Position size in coin units
        };

        // Use GM_xmlhttpRequest to bypass CSP restrictions
        // eslint-disable-next-line no-undef
        GM_xmlhttpRequest({
            method: 'POST',
            url: CONFIG.googleSheetsUrl,
            headers: {
                'Content-Type': 'application/json',
            },
            data: JSON.stringify(sheetData),
            onload: function(response) {
                if (response.status >= 200 && response.status < 400) {
                    log('[Sheets] ✓ Trade logged to Google Sheets (status: ' + response.status + ')');
                } else {
                    log('[Sheets] ⚠ Response status: ' + response.status);
                    console.log('[KCEX Sheets] Response:', response.responseText);
                }
            },
            onerror: function(error) {
                log('[Sheets] ✗ Failed to log trade: ' + error.error);
                console.error('[KCEX Sheets]', error);
            }
        });

        return true; // Return immediately, request is async
    }

    // Copy trade data to clipboard as tab-separated values (for manual paste into sheets)
    function copyTradeToClipboard(tradeData) {
        if (!CONFIG.copyTradeToClipboard) return;

        // Format: Date, Time, Entry, SL, Risk, Expected Loss, Position Size
        // Columns: B, C, G, H, J, K, O
        const row = [
            tradeData.date,           // B: Date (DD/MM)
            tradeData.timeHHMM,       // C: Time (HH:MM)
            '',                       // D: Coin (skip - pre-filled)
            '',                       // E: Direction (skip - formula)
            '',                       // F: Entry Order Type (skip - pre-filled)
            tradeData.entry,          // G: Avg Entry
            tradeData.sl,             // H: Stop Loss
            '',                       // I: Avg Exit (skip - manual)
            tradeData.targetRisk,     // J: Risk (target)
            tradeData.risk,           // K: Expected Loss
            '',                       // L: Realized Loss (skip)
            '',                       // M: Realized Win (skip)
            '',                       // N: Deviation (skip - formula)
            tradeData.positionSize,   // O: Position Size
        ].join('\t');

        navigator.clipboard.writeText(row).then(() => {
            log('[Clipboard] ✓ Trade data copied to clipboard (Sheet format)');
        }).catch(err => {
            log('[Clipboard] ✗ Failed to copy: ' + err.message);
        });
    }

    // Copy trade report to clipboard
    function copyReportToClipboard(tradeData) {
        if (!CONFIG.copyReportToClipboard) return;

        const pair = tradeData.pair || 'BTCUSDT';
        const direction = tradeData.direction.toUpperCase();
        const timeframe = tradeData.timeframe || '5m';

        const riskFormatted = typeof tradeData.risk === 'number' ? tradeData.risk.toFixed(2) : tradeData.risk;

        const report = `${pair}: ${direction} ${timeframe}

Entry: $${tradeData.entry}

Stop Loss: $${tradeData.sl}

Take Profit: $${tradeData.tp || 'N/A'}

Risk: $${riskFormatted} USDT`;

        navigator.clipboard.writeText(report).then(() => {
            log('[Clipboard] ✓ Trade report copied to clipboard');
            pendingClipboardText = null; // Clear any pending
        }).catch(err => {
            log('[Clipboard] ✗ Failed to copy report: ' + err.message);
            // Store for retry when window gets focus
            pendingClipboardText = report;
            log('📋 Trade report stored - will copy when window is focused');
        });
    }

    // ============================================
    // STATE
    // ============================================
    // Pending clipboard content (when window not focused) - declared early for use by copyTradeReportToClipboard
    let pendingClipboardText = null;

    let state = {
        currentPrice: 0,
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        direction: null,
        quantity: 0,
        estimatedPNL: 0,
        leverage: CONFIG.leverage,
        riskAmount: CONFIG.riskAmount,
        autoUpdateEntry: CONFIG.autoUpdateEntry,
        isExecuting: false,
        priceUpdateInterval: null,
        tradeHistory: [],
        liquidationPrice: 0,
        // Dragging state
        isDragging: false,
        dragOffset: { x: 0, y: 0 },
        panelPosition: { x: null, y: null }, // null = use default CSS position
        // Settings panel
        showSettings: false,
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function parsePrice(str) {
        if (!str) return 0;
        return parseFloat(str.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    }

    function formatPrice(num) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }

    function formatUSDT(num) {
        return num.toFixed(2);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Check if there's an open position (order filled)
    // Returns: { filled: boolean, method: string, details: string }
    function checkPositionFilled() {
        // Method 1: Check "Open Position(N)" tab - most reliable indicator
        const allTabs = document.querySelectorAll('.ant-tabs-tab-btn span, .ant-tabs-tab span, [class*="ListNav"] span');
        for (const tab of allTabs) {
            const tabText = tab.textContent.trim();
            const match = tabText.match(/Open Position\s*\((\d+)\)/i);
            if (match && parseInt(match[1]) > 0) {
                return { filled: true, method: 'tab_count', details: 'Open Position(' + match[1] + ')' };
            }
        }

        // Method 2: Check for actual position row in the position table
        const positionTable = document.querySelector('#kcex-web-inspection-futures-exchange-current-position');
        if (positionTable) {
            const positionRows = positionTable.querySelectorAll('.ant-table-row:not(.ant-table-measure-row)');
            for (const row of positionRows) {
                const cells = row.querySelectorAll('.ant-table-cell');
                if (cells.length > 1) {
                    const firstCell = cells[0].textContent.trim();
                    if (firstCell.includes('BTC') || firstCell.includes('ETH') || firstCell.includes('USDT')) {
                        return { filled: true, method: 'position_row', details: firstCell.substring(0, 30) };
                    }
                }
            }
        }

        // Method 3: Check TP/SL Order tab - if count > 0, a TP/SL was set meaning position exists
        for (const tab of allTabs) {
            const tabText = tab.textContent.trim();
            const tpslMatch = tabText.match(/TP\/SL Order\s*\((\d+)\)/i);
            if (tpslMatch && parseInt(tpslMatch[1]) > 0) {
                return { filled: true, method: 'tpsl_order', details: 'TP/SL Order(' + tpslMatch[1] + ')' };
            }
        }

        return { filled: false, method: null, details: null };
    }

    // Get actual entry price from open position table
    // Returns the "Avg Entry Price" from the first position row, or null if not found
    function getActualEntryPrice() {
        const positionTable = document.querySelector('#kcex-web-inspection-futures-exchange-current-position');
        if (!positionTable) return null;

        const positionRows = positionTable.querySelectorAll('.ant-table-row:not(.ant-table-measure-row)');
        if (positionRows.length === 0) return null;

        // Get the first position row
        const firstRow = positionRows[0];
        const cells = firstRow.querySelectorAll('.ant-table-cell');

        // Avg Entry Price is typically the 3rd column (index 2)
        // Column order: Perpetual, Open Interest, Avg Entry Price, ...
        if (cells.length >= 3) {
            const entryCell = cells[2];
            const entryText = entryCell.textContent.trim();
            const price = parsePrice(entryText);
            if (price > 0) {
                return price;
            }
        }

        return null;
    }

    // Recalculate TP price when entry changes to maintain the same R:R ratio
    // originalEntry: the entry price when trade was planned
    // originalTP: the TP price when trade was planned
    // originalSL: the SL price (doesn't change)
    // actualEntry: the actual fill price
    // dir: 'long' or 'short'
    // Returns: new TP price that maintains same R:R ratio, or null if no TP was set
    function recalculateTPForNewEntry(originalEntry, originalTP, originalSL, actualEntry, dir) {
        if (!originalTP || originalTP <= 0) return null;
        if (!originalEntry || !actualEntry || !originalSL) return null;

        // Calculate original R:R ratio
        const originalRisk = Math.abs(originalEntry - originalSL);
        const originalReward = Math.abs(originalTP - originalEntry);

        if (originalRisk <= 0) return originalTP; // Can't calculate ratio

        const rrRatio = originalReward / originalRisk;

        // Calculate new risk (SL stays same, but entry changed)
        const newRisk = Math.abs(actualEntry - originalSL);

        // Calculate new TP to maintain same R:R
        const newReward = newRisk * rrRatio;

        let newTP;
        if (dir === 'long') {
            // Long: TP is above entry
            newTP = actualEntry + newReward;
        } else {
            // Short: TP is below entry
            newTP = actualEntry - newReward;
        }

        // Round to 1 decimal place (KCEX precision)
        newTP = Math.round(newTP * 10) / 10;

        log('    TP Recalculation:');
        log('      Original: Entry=' + originalEntry + ', TP=' + originalTP + ', SL=' + originalSL);
        log('      Original R:R ratio: ' + rrRatio.toFixed(2) + ' (' + originalReward.toFixed(1) + ' / ' + originalRisk.toFixed(1) + ')');
        log('      New entry: ' + actualEntry + ' (moved ' + (actualEntry - originalEntry).toFixed(1) + ')');
        log('      New risk: ' + newRisk.toFixed(1) + ', maintaining ' + rrRatio.toFixed(2) + 'R');
        log('      New TP: ' + newTP + ' (was ' + originalTP + ')');

        return newTP;
    }

    // Wait for element to appear - polls every 20ms, times out after maxWait
    function waitForElement(selector, maxWait = 3000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                const el = document.querySelector(selector);
                if (el) {
                    resolve(el);
                } else if (Date.now() - startTime > maxWait) {
                    reject(new Error(`Timeout waiting for: ${selector}`));
                } else {
                    setTimeout(check, 20);
                }
            };
            check();
        });
    }

    // Wait for element with custom condition
    function waitForCondition(conditionFn, maxWait = 3000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                const result = conditionFn();
                if (result) {
                    resolve(result);
                } else if (Date.now() - startTime > maxWait) {
                    reject(new Error('Timeout waiting for condition'));
                } else {
                    setTimeout(check, 20);
                }
            };
            check();
        });
    }

    // Execution timer
    let tradeStartTime = 0;

    function log(msg) {
        if (!CONFIG.debugLogging) return; // Skip logging when disabled for performance
        const now = Date.now();
        const elapsed = tradeStartTime > 0 ? '+' + (now - tradeStartTime) + 'ms' : '';
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now % 1000).padStart(3, '0');
        console.log('[KCEX ' + timestamp + '] ' + (elapsed ? '[' + elapsed + '] ' : '') + msg);
    }

    function logTime(label) {
        const now = Date.now();
        const elapsed = tradeStartTime > 0 ? (now - tradeStartTime) : 0;
        log('⏱️ ' + label + ': ' + elapsed + 'ms since start');
    }

    // ============================================
    // DOM FUNCTIONS
    // ============================================
    function getLastPrice() {
        // Try multiple selectors
        const selectors = [
            'h2.contractDetail_lastPrice__W23NX .PriceText_text__STO26',
            '.contractDetail_lastPrice__W23NX',
            '.PriceText_text__STO26'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const price = parsePrice(el.textContent);
                if (price > 0) return price;
            }
        }
        return 0;
    }

    // Calculate liquidation price ourselves for accuracy
    // Formula for ISOLATED margin:
    // LONG:  Liq Price = Entry × (1 - 1/Leverage + MMR)
    // SHORT: Liq Price = Entry × (1 + 1/Leverage - MMR)
    // Where MMR = Maintenance Margin Rate (typically 0.4% for BTC on most exchanges)
    function calculateLiquidationPrice(entryPrice, leverage, direction) {
        if (!entryPrice || !leverage || !direction) return 0;

        const mmr = CONFIG.maintenanceMarginRate || 0.004; // 0.4% default

        if (direction === 'long') {
            // Long: price drops, you get liquidated
            // Liq = Entry × (1 - 1/Leverage + MMR)
            return entryPrice * (1 - (1 / leverage) + mmr);
        } else {
            // Short: price rises, you get liquidated
            // Liq = Entry × (1 + 1/Leverage - MMR)
            return entryPrice * (1 + (1 / leverage) - mmr);
        }
    }

    // Also keep the scraper as a fallback/comparison
    function getLiquidationPricesFromPage() {
        const longLiq = document.querySelector('.EstimatedStrongParity_openLong__ShmMl .EstimatedStrongParity_itemValue__azkfb');
        const shortLiq = document.querySelector('.EstimatedStrongParity_openShort__IJBX9 .EstimatedStrongParity_itemValue__azkfb');
        return {
            long: longLiq ? parsePrice(longLiq.textContent) : 0,
            short: shortLiq ? parsePrice(shortLiq.textContent) : 0
        };
    }

    function setInputValue(input, value) {
        if (!input) return false;
        try {
            input.focus();
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(input, String(value));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
        } catch (e) {
            log('Error setting input: ' + e);
            return false;
        }
    }

    // More aggressive input setting for React components that don't respond to normal events
    async function setInputValueAggressive(input, value) {
        if (!input) return false;
        try {
            const strValue = String(value);

            // Step 1: Focus and click the input
            input.focus();
            input.click();
            await sleep(50);

            // Step 2: Select all existing content
            input.select();
            await sleep(30);

            // Step 3: Clear the input using multiple methods
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

            // Clear first
            nativeInputValueSetter.call(input, '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(30);

            // Step 4: Set the new value
            nativeInputValueSetter.call(input, strValue);

            // Step 5: Dispatch ALL possible events to ensure React catches the change
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // Also dispatch keyboard events to simulate typing
            input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a', code: 'KeyA' }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a', code: 'KeyA' }));

            await sleep(50);

            // Step 6: Blur to confirm the change
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

            await sleep(50);

            // Step 7: Verify the value stuck
            const actualValue = input.value;
            log('    setInputValueAggressive: target=' + strValue + ', actual=' + actualValue);

            if (actualValue !== strValue) {
                // Try one more time with direct property assignment
                log('    setInputValueAggressive: Value mismatch, trying direct assignment...');
                input.value = strValue;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                await sleep(30);
            }

            return true;
        } catch (e) {
            log('Error in setInputValueAggressive: ' + e);
            return false;
        }
    }

    function clickElement(el) {
        if (!el) return false;
        // Only use one click method to avoid duplicate events
        el.click();
        return true;
    }

    // Click Ant Design checkbox - single click only to avoid duplicates
    function clickAntCheckbox(wrapper) {
        if (!wrapper) return false;

        // Find the checkbox input to check its current state
        const input = wrapper.querySelector('input.ant-checkbox-input') || wrapper.querySelector('input[type="checkbox"]');
        const wasChecked = input ? input.checked : false;
        log('    clickAntCheckbox: input was checked = ' + wasChecked);

        // Only click if NOT already checked (to enable it)
        // Use SINGLE click on the wrapper - Ant Design handles the rest
        if (!wasChecked) {
            const checkboxWrapper = wrapper.querySelector('.ant-checkbox-wrapper') || wrapper.closest('.ant-checkbox-wrapper') || wrapper;
            checkboxWrapper.click();
            log('    clickAntCheckbox: clicked wrapper once');
        } else {
            log('    clickAntCheckbox: already checked, skipping click');
        }

        return true;
    }

    // ============================================
    // CALCULATIONS
    // ============================================
    function detectDirection(entry, sl) {
        if (!entry || !sl) return null;
        return sl < entry ? 'long' : 'short';
    }

    function calculateQuantity(entry, sl, risk) {
        if (!entry || !sl || !risk) return 0;
        const distance = Math.abs(sl - entry);
        if (distance === 0) return 0;

        // IMPORTANT: Aim for 10% UNDER target risk
        // Per experienced trader advice: the 10% deviation should be a CEILING, not a target
        // So if target is $1.00, we aim for $0.90 loss so WITH fees/slippage max loss = $1.00
        // This ensures you never lose more than your target, only less
        const safetyFactor = 0.90; // Aim for 90% of target (10% under)
        const adjustedRisk = risk * safetyFactor;

        // Base quantity calculation with reduced risk target
        const baseQty = (adjustedRisk * entry) / distance;

        // Use Math.round for accuracy
        return Math.round(baseQty);
    }

    // ============================================
    // KCEX PNL CALCULATION - REVERSE ENGINEERED
    // ============================================
    // Based on analysis of KCEX's source code:
    //
    // KCEX uses bid/ask prices for close price estimation:
    // - LONG close: uses bid1 (best bid) or entered price, whichever is HIGHER
    // - SHORT close: uses ask1 (best ask) or entered price, whichever is LOWER
    //
    // Formula:
    // closePrice = For LONG: max(bid1, slPrice) | For SHORT: min(ask1, slPrice)
    // priceDiff = |closePrice - entryPrice|
    // positionSize = qty / entryPrice (in BTC)
    // rawPNL = priceDiff × positionSize
    // fee = qty × takerFeeRate × 2 (entry + exit)
    // netPNL = rawPNL - fee
    //
    // KCEX's default taker fee rate: 0.06% (0.0006)

    // Get bid/ask prices from KCEX order book display
    function getBidAskPrices() {
        const result = { bid1: 0, ask1: 0 };

        // Strategy 1: Look in order book rows
        // Ask prices (sell orders) are typically shown with red/down color
        // Bid prices (buy orders) are typically shown with green/up color
        const orderBookSelectors = [
            // KCEX order book price elements
            '.OrderBook_askRow__price',
            '.OrderBook_bidRow__price',
            '[class*="askRow"] [class*="price"]',
            '[class*="bidRow"] [class*="price"]',
            '[class*="orderbook"] [class*="ask"]',
            '[class*="orderbook"] [class*="bid"]',
            // Generic order book
            '.depth_askPrice',
            '.depth_bidPrice',
        ];

        // Try to find from order book
        for (const sel of orderBookSelectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                const price = parsePrice(el.textContent);
                if (price > 0) {
                    const isAsk = sel.toLowerCase().includes('ask') ||
                                  el.className.toLowerCase().includes('ask') ||
                                  el.closest('[class*="ask"]');
                    if (isAsk && (result.ask1 === 0 || price < result.ask1)) {
                        result.ask1 = price;
                    } else if (!isAsk && price > result.bid1) {
                        result.bid1 = price;
                    }
                }
            }
        }

        // Strategy 2: Use last price as fallback (bid ≈ ask ≈ last for liquid markets)
        if (result.bid1 === 0 || result.ask1 === 0) {
            const lastPrice = getLastPrice();
            if (lastPrice > 0) {
                // Estimate a small spread (0.01% typical for BTC)
                const spread = lastPrice * 0.0001;
                if (result.bid1 === 0) result.bid1 = lastPrice - spread / 2;
                if (result.ask1 === 0) result.ask1 = lastPrice + spread / 2;
            }
        }

        return result;
    }

    // KCEX fee rates (can be overridden in config)
    const KCEX_TAKER_FEE_RATE = 0.0006; // 0.06%

    // Last logged PNL to avoid spamming console
    let lastLoggedPNL = { entry: 0, sl: 0, qty: 0 };

    // ============================================
    // BALANCE CHECK
    // ============================================
    // Get available balance from KCEX trading panel

    function getAvailableBalance() {
        // Strategy 1: Look for "Available XX.XX USDT" in the trading panel (most reliable)
        // This is shown right next to the order form
        const availableEl = document.querySelector('.AssetsItem_num__E7zsM');
        if (availableEl) {
            const text = availableEl.textContent.trim();
            const balance = parseFloat(text.replace(/[^0-9.]/g, ''));
            if (!isNaN(balance)) {
                log('    Found available balance: $' + balance.toFixed(2));
                return balance;
            }
        }

        // Strategy 2: Look for "Available Margin" in the wallet section
        const walletRows = document.querySelectorAll('.assets_walletRow__iX08D');
        for (const row of walletRows) {
            if (row.textContent.includes('Available Margin')) {
                const valueEl = row.querySelector('.ant-col.hasUnitDir');
                if (valueEl) {
                    const balance = parseFloat(valueEl.textContent.replace(/[^0-9.]/g, ''));
                    if (!isNaN(balance)) {
                        log('    Found available margin: $' + balance.toFixed(2));
                        return balance;
                    }
                }
            }
        }

        // Strategy 3: Look for any element with "Available" followed by USDT amount
        const allText = document.body.innerText;
        const match = allText.match(/Available[^\d]*(\d+\.?\d*)\s*USDT/i);
        if (match) {
            const balance = parseFloat(match[1]);
            if (!isNaN(balance)) {
                log('    Found available (text match): $' + balance.toFixed(2));
                return balance;
            }
        }

        log('    ⚠ Could not determine available balance');
        return null;
    }

    // Calculate minimum leverage needed for a position size given available balance
    function calculateMinLeverage(positionSize, availableBalance, bufferPercent = 0.9) {
        // Buffer: only use 90% of balance to leave room for fees
        const usableBalance = availableBalance * bufferPercent;
        if (usableBalance <= 0) return 100; // Max leverage

        // Margin = Position Size / Leverage
        // Leverage = Position Size / Margin
        const minLeverage = Math.ceil(positionSize / usableBalance);
        return Math.min(Math.max(minLeverage, 1), 125); // Clamp to 1-125x
    }

    // Check if we have enough balance for a trade, and suggest leverage if not
    function checkBalanceForTrade(positionSize, currentLeverage, entryPrice, stopLoss, dir) {
        const requiredMargin = positionSize / currentLeverage;
        const availableBalance = getAvailableBalance();

        if (availableBalance === null) {
            log('    ⚠ Could not check balance - proceeding anyway');
            return { sufficient: true, availableBalance: null };
        }

        log('    Available balance: $' + availableBalance.toFixed(2));
        log('    Required margin: $' + requiredMargin.toFixed(2) + ' (' + currentLeverage + 'x leverage)');

        if (availableBalance >= requiredMargin) {
            log('    ✓ Balance sufficient');
            return {
                sufficient: true,
                availableBalance,
                requiredMargin,
                currentLeverage
            };
        }

        // Not enough balance - calculate minimum leverage needed
        const minLeverage = calculateMinLeverage(positionSize, availableBalance);
        const newMargin = positionSize / minLeverage;

        // Also check if new leverage would be safe (SL not past liquidation)
        const newLiq = calculateLiquidationPrice(entryPrice, minLeverage, dir);
        const liqSafe = (dir === 'long' && stopLoss > newLiq) || (dir === 'short' && stopLoss < newLiq);

        log('    ❌ INSUFFICIENT BALANCE');
        log('    Suggested leverage: ' + minLeverage + 'x (margin: $' + newMargin.toFixed(2) + ')');
        log('    Liquidation safe at ' + minLeverage + 'x: ' + (liqSafe ? '✓ YES' : '❌ NO'));

        return {
            sufficient: false,
            availableBalance,
            requiredMargin,
            currentLeverage,
            suggestedLeverage: minLeverage,
            newMargin,
            liqSafe
        };
    }

    // Calculate PNL using KCEX's actual formula
    // This matches their getProfitAndLoss function from source analysis
    function calculatePNL(entry, sl, qty, direction = null, options = {}) {
        if (!entry || !sl || !qty) return 0;

        // Auto-detect direction if not provided
        const dir = direction || detectDirection(entry, sl);
        const isLong = dir === 'long';

        // Get bid/ask prices
        const { bid1, ask1 } = options.bidAsk || getBidAskPrices();

        // Determine close price based on KCEX logic:
        // - LONG positions close at bid (or SL if lower)
        // - SHORT positions close at ask (or SL if higher)
        let closePrice;
        if (isLong) {
            // For LONG: closing is a SELL, so we look at bid price
            // KCEX uses: max(bid1, slPrice) for limit orders, just bid1 for market
            closePrice = options.isLimit && sl ? Math.max(bid1, sl) : (bid1 || sl);
        } else {
            // For SHORT: closing is a BUY, so we look at ask price
            // KCEX uses: min(ask1, slPrice) for limit orders, just ask1 for market
            closePrice = options.isLimit && sl ? Math.min(ask1, sl) : (ask1 || sl);
        }

        // If no bid/ask available, fall back to SL price
        if (!closePrice || closePrice <= 0) {
            closePrice = sl;
        }

        // Calculate raw PNL
        const priceDiff = Math.abs(closePrice - entry);
        const positionSizeBTC = qty / entry;
        const rawPNL = priceDiff * positionSizeBTC;

        // Calculate fees (entry + exit)
        const feeRate = options.feeRate || KCEX_TAKER_FEE_RATE;
        const entryFee = qty * feeRate;
        const exitFee = qty * feeRate; // Approximate, actual would use close value
        const totalFees = entryFee + exitFee;

        // Net PNL (subtract fees if includeFees option is true)
        const includeFees = options.includeFees !== false; // Default true
        const netPNL = includeFees ? rawPNL - totalFees : rawPNL;

        // For our risk calculation, we want the LOSS amount (positive number)
        const pnl = Math.abs(netPNL);

        // Only log if inputs have changed significantly
        const inputsChanged = Math.abs(lastLoggedPNL.entry - entry) > 10 ||
                             Math.abs(lastLoggedPNL.sl - sl) > 10 ||
                             Math.abs(lastLoggedPNL.qty - qty) > 0;

        if (inputsChanged) {
            lastLoggedPNL = { entry, sl, qty };
            const slPercent = (Math.abs(sl - entry) / entry * 100).toFixed(2);
            console.log('[PNL-KCEX] Entry=' + entry.toFixed(1) + ', SL=' + sl.toFixed(1) +
                       ', Qty=' + qty + ', Dir=' + dir +
                       ' | Close@' + closePrice.toFixed(1) +
                       ' (bid=' + bid1.toFixed(1) + ', ask=' + ask1.toFixed(1) + ')' +
                       ' | Raw=$' + rawPNL.toFixed(4) + ', Fees=$' + totalFees.toFixed(4) +
                       ' → Net Risk=$' + pnl.toFixed(2) + ' (SL%=' + slPercent + '%)');
        }

        return pnl;
    }

    // Simple PNL calculation (without bid/ask, for quick estimates)
    function calculatePNLSimple(entry, sl, qty) {
        if (!entry || !sl || !qty) return 0;
        const slDistancePercent = Math.abs(sl - entry) / entry;
        return slDistancePercent * qty;
    }

    // Try to scrape KCEX's displayed PNL for comparison
    function getKCEXDisplayedPNL() {
        // Look for PNL displays on the page - these may be in various places
        const selectors = [
            '.EstimatedStrongParity_itemValue__azkfb', // Near liquidation display
            '[class*="pnl"]',
            '[class*="Pnl"]',
            '[class*="PNL"]',
            '[class*="profit"]',
            '[class*="Profit"]',
            '[class*="unrealized"]',
            '[class*="Unrealized"]',
            // Open positions table cells
            '.component_holdPositionRow__uoVQD span',
            '.component_holdPositionRow__uoVQD div',
        ];

        const results = [];
        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                const text = el.textContent.trim();
                // Look for dollar amounts (positive or negative)
                const match = text.match(/([-+]?)\$?([\d,]+\.?\d*)/);
                if (match && parseFloat(match[2].replace(/,/g, '')) > 0) {
                    const value = parseFloat(match[2].replace(/,/g, ''));
                    const isNegative = match[1] === '-' || text.includes('-');
                    results.push({
                        selector: sel,
                        text: text,
                        value: isNegative ? -value : value,
                        element: el.className || el.tagName
                    });
                }
            }
        }

        if (results.length > 0) {
            console.log('[PNL VERIFY] ═══════════════════════════════════════');
            console.log('[PNL VERIFY] KCEX page values found:');
            results.forEach(r => console.log('[PNL VERIFY]   [' + r.element.substring(0, 30) + ']: "' + r.text + '" → $' + r.value.toFixed(2)));
            console.log('[PNL VERIFY] ═══════════════════════════════════════');
        } else {
            console.log('[PNL VERIFY] No KCEX PNL values found on page');
        }

        return results;
    }

    // Calculate PNL including fees for more accurate comparison
    // KCEX fees: 0.02% maker, 0.06% taker
    // NOTE: This is now handled in the main calculatePNL function with includeFees option
    function calculatePNLWithFees(entry, sl, qty, isMaker = true) {
        const feeRate = isMaker ? 0.0002 : 0.0006;
        return calculatePNL(entry, sl, qty, null, { feeRate, includeFees: true });
    }

    // ============================================
    // MODAL PNL READER - Read KCEX's displayed PNL from SL/TP modal
    // ============================================
    // KCEX displays the expected PNL in the Advanced modal when setting SL
    // Class: .EditStopOrder_downColor__a7IcV (for losses, shown in red)
    // Format: "-0.06 USDT" or similar
    function readKCEXModalPNL(modal) {
        if (!modal) return null;

        // Primary selector: KCEX's specific class for PNL display in stop order modal
        const pnlSelectors = [
            '[class*="EditStopOrder_downColor"]',      // Loss (red) in stop order modal
            '[class*="EditStopOrder_upColor"]',        // Profit (green) in stop order modal
            '[class*="downColor"][class*="hasUnitDir"]',
            '[class*="upColor"][class*="hasUnitDir"]',
            '.hasUnitDir',                              // Generic USDT-valued elements
        ];

        for (const sel of pnlSelectors) {
            const els = modal.querySelectorAll(sel);
            for (const el of els) {
                const text = el.textContent.trim();
                // Look for patterns like "-0.06 USDT" or "0.10 USDT" or just "-0.06"
                const match = text.match(/^([-+]?)([\d.]+)\s*(USDT)?$/);
                if (match) {
                    const value = parseFloat(match[2]);
                    if (value > 0 && value < 1000) { // Reasonable PNL range
                        const isNegative = match[1] === '-';
                        log('    [MODAL PNL] Found: "' + text + '" → $' + value.toFixed(2) + ' (negative=' + isNegative + ')');
                        return {
                            value: value,
                            isNegative: isNegative,
                            raw: text
                        };
                    }
                }
            }
        }

        // Fallback: scan all spans/divs for PNL-like values
        const allElements = modal.querySelectorAll('span, div');
        for (const el of allElements) {
            const text = el.textContent.trim();
            // Match patterns like "-0.06 USDT", "0.10", "-$0.08"
            if (text.match(/^[-+]?[\d.]+\s*(USDT)?$/) && text.length < 15) {
                const cleanVal = text.replace(/[^0-9.-]/g, '');
                const val = parseFloat(cleanVal);
                if (!isNaN(val) && Math.abs(val) > 0 && Math.abs(val) < 100) {
                    log('    [MODAL PNL] Fallback found: "' + text + '" → $' + Math.abs(val).toFixed(2));
                    return {
                        value: Math.abs(val),
                        isNegative: val < 0 || text.includes('-'),
                        raw: text
                    };
                }
            }
        }

        log('    [MODAL PNL] Could not find PNL value in modal');
        return null;
    }

    // ============================================
    // ITERATIVE PNL VERIFICATION
    // ============================================
    // After setting SL, verify KCEX's displayed PNL matches our target
    // If KCEX PNL is OVER target by more than tolerance, we MUST reduce quantity
    // If KCEX PNL is UNDER target by more than tolerance, we SHOULD increase quantity
    // This ensures the actual risk matches the user's intended risk amount
    // Returns the KCEX PNL so it can be stored in trade history.
    async function verifyAndAdjustPNL(modal, targetPNL, currentQty, slPrice, entryPrice, direction, options = {}) {
        const tolerance = options.tolerance || 0.10; // 10% default
        const maxIterations = 3; // Max attempts to get within tolerance

        log('    ╔══════════════════════════════════════════════════════════════╗');
        log('    ║ PNL VERIFICATION - Target: $' + targetPNL.toFixed(2) + ' (±' + (tolerance * 100) + '% tolerance)');
        log('    ╚══════════════════════════════════════════════════════════════╝');

        // Wait for KCEX to calculate after our input
        await sleep(300);

        // Read KCEX's displayed PNL
        const kcexPNL = readKCEXModalPNL(modal);

        if (!kcexPNL) {
            log('    ⚠️ Could not read KCEX PNL - using our calculation as fallback');
            return {
                verified: true, // Can't verify, proceed with our calculation
                finalQty: currentQty,
                iterations: 0,
                kcexPNL: null, // No KCEX PNL available
                needsRetry: false
            };
        }

        let displayedPNL = kcexPNL.value;
        const overTarget = displayedPNL > targetPNL;
        const overPercent = overTarget ? ((displayedPNL - targetPNL) / targetPNL) * 100 : 0;

        log('    KCEX PNL: $' + displayedPNL.toFixed(2));
        log('    Our Target: $' + targetPNL.toFixed(2));

        const underPercent = !overTarget ? ((targetPNL - displayedPNL) / targetPNL) * 100 : 0;

        if (overTarget) {
            log('    ⚠️ OVER target by: $' + (displayedPNL - targetPNL).toFixed(4) + ' (+' + overPercent.toFixed(1) + '%)');
        } else {
            log('    ⚠️ UNDER target by: $' + (targetPNL - displayedPNL).toFixed(4) + ' (-' + underPercent.toFixed(1) + '%)');
        }

        // Check if OVER target by more than tolerance - need to reduce quantity
        const isOverTolerance = overTarget && (overPercent > tolerance * 100);

        if (isOverTolerance) {
            log('    ❌ OVER TOLERANCE: KCEX PNL exceeds target by more than ' + (tolerance * 100) + '%!');
            log('    ❌ This trade would risk more than your target. Signaling for quantity reduction.');

            // Calculate reduced quantity to bring PNL back within tolerance
            const reductionRatio = (targetPNL / displayedPNL) * 0.95;
            const suggestedQty = Math.floor(currentQty * reductionRatio);

            log('    📉 Suggested reduced quantity: ' + currentQty + ' → ' + suggestedQty + ' USDT');

            return {
                verified: false,
                finalQty: currentQty,
                suggestedQty: suggestedQty,
                iterations: 1,
                kcexPNL: displayedPNL,
                needsRetry: true,
                adjustDirection: 'decrease',
                overPercent: overPercent
            };
        }

        // Check if UNDER target by more than tolerance - need to increase quantity
        const isUnderTolerance = !overTarget && (underPercent > tolerance * 100);

        if (isUnderTolerance) {
            log('    ⚠️ UNDER TOLERANCE: KCEX PNL is ' + underPercent.toFixed(1) + '% below target!');
            log('    ⚠️ Position is too small. Signaling for quantity increase.');

            // Calculate increased quantity to bring PNL closer to target
            // New qty should be: currentQty × (targetPNL / displayedPNL) × 1.02 (2% buffer for safety)
            const increaseRatio = (targetPNL / displayedPNL) * 1.02;
            const suggestedQty = Math.ceil(currentQty * increaseRatio);

            log('    📈 Suggested increased quantity: ' + currentQty + ' → ' + suggestedQty + ' USDT');

            return {
                verified: false,
                finalQty: currentQty,
                suggestedQty: suggestedQty,
                iterations: 1,
                kcexPNL: displayedPNL,
                needsRetry: true,
                adjustDirection: 'increase',
                underPercent: underPercent
            };
        }

        // Within tolerance - acceptable
        log('    ✓ PNL VERIFIED - within acceptable range!');
        log('    ════════════════════════════════════════════════════════════════');

        return {
            verified: true,
            finalQty: currentQty,
            iterations: 1,
            kcexPNL: displayedPNL,
            needsRetry: false
        };
    }

    function validateLiquidation(dir, sl, liq) {
        if (!sl || !liq) return { valid: true, warning: '' };

        // For LONG: SL must be ABOVE liquidation price (SL > Liq)
        // If SL <= Liq, you get liquidated BEFORE your stop loss triggers!
        if (dir === 'long' && sl <= liq) {
            return { valid: false, warning: 'SL below liquidation! Lower leverage or widen SL.' };
        }

        // For SHORT: SL must be BELOW liquidation price (SL < Liq)
        // If SL >= Liq, you get liquidated BEFORE your stop loss triggers!
        if (dir === 'short' && sl >= liq) {
            return { valid: false, warning: 'SL above liquidation! Lower leverage or widen SL.' };
        }

        return { valid: true, warning: '' };
    }

    // KCEX minimum order sizes (approximate, may vary)
    const MIN_ORDER_SIZE = {
        'BTC_USDT': 10,  // ~10 USDT minimum
        'ETH_USDT': 5,
        'default': 5
    };

    function getMinOrderSize() {
        const url = window.location.href;
        if (url.includes('BTC_USDT')) return MIN_ORDER_SIZE['BTC_USDT'];
        if (url.includes('ETH_USDT')) return MIN_ORDER_SIZE['ETH_USDT'];
        return MIN_ORDER_SIZE['default'];
    }

    // Calculate maximum safe leverage for a given SL distance
    function calculateSafeLeverage(entry, sl) {
        if (!entry || !sl) return 125;
        const slDistancePercent = Math.abs(sl - entry) / entry;
        const mmr = CONFIG.maintenanceMarginRate || 0.005;

        // Safe leverage = 1 / (SL% + MMR) with some safety buffer
        // We add 0.5% buffer to be safe
        const safeBuffer = 0.005;
        const maxLeverage = Math.floor(1 / (slDistancePercent + mmr + safeBuffer));

        // Clamp between 1 and 125
        return Math.max(1, Math.min(125, maxLeverage));
    }

    // Get current leverage from KCEX page
    function getCurrentLeverageFromPage() {
        const leverageEl = document.querySelector('.LeverageEdit_short__OrOaz .LeverageEdit_leverageText__Ef6wP');
        if (leverageEl) {
            const text = leverageEl.textContent.trim();
            const match = text.match(/(\d+)/);
            if (match) return parseInt(match[1]);
        }
        return null;
    }

    // Change leverage on KCEX
    async function changeLeverageOnKCEX(newLeverage) {
        log('>>> Changing leverage to ' + newLeverage + 'x...');

        // Step 1: Click on leverage display to open modal
        const leverageWrapper = document.querySelector('.LeverageEdit_leverageEditWrapper__gGah4');
        if (!leverageWrapper) {
            log('    ERROR: Could not find leverage wrapper');
            return false;
        }

        const leverageBtn = leverageWrapper.querySelector('.LeverageEdit_short__OrOaz');
        if (!leverageBtn) {
            log('    ERROR: Could not find leverage button');
            return false;
        }

        clickElement(leverageBtn);
        log('    Clicked leverage button');

        // Step 2: Wait for modal to appear
        await sleep(300);

        const modal = await waitForCondition(() => {
            return document.querySelector('.LeverageSimpleMode_marginModeModal__38VQ6');
        }, 2000).catch(() => null);

        if (!modal) {
            log('    ERROR: Leverage modal did not appear');
            return false;
        }
        log('    Leverage modal opened');

        // Step 3: Uncheck "Applies to all futures" if checked
        const applyAllCheckbox = modal.querySelector('.LeverageSimpleMode_applyAllFutures__L_Nyx .ant-checkbox-input');
        if (applyAllCheckbox && applyAllCheckbox.checked) {
            const checkboxWrapper = modal.querySelector('.LeverageSimpleMode_applyAllFutures__L_Nyx .ant-checkbox-wrapper');
            if (checkboxWrapper) {
                clickElement(checkboxWrapper);
                log('    Unchecked "Applies to all futures"');
                await sleep(100);
            }
        }

        // Step 4: Set leverage value in input
        const leverageInput = modal.querySelector('.LeverageProgress_leverageInput__iWDFl');
        if (!leverageInput) {
            log('    ERROR: Could not find leverage input');
            return false;
        }

        const oldLeverage = leverageInput.value;
        await setInputValueAggressive(leverageInput, newLeverage);
        log('    Set leverage input: ' + oldLeverage + ' → ' + newLeverage);

        await sleep(200);

        // Step 5: Click Confirm button
        const confirmBtn = modal.querySelector('.ant-btn-primary');
        if (!confirmBtn) {
            log('    ERROR: Could not find confirm button');
            return false;
        }

        clickElement(confirmBtn);
        log('    Clicked Confirm');

        // Step 6: Wait for modal to close
        await sleep(500);

        // Step 7: Verify leverage changed
        const newPageLeverage = getCurrentLeverageFromPage();
        if (newPageLeverage === newLeverage) {
            log('    ✓ Leverage successfully changed to ' + newLeverage + 'x');
            return true;
        } else {
            log('    ⚠️ Leverage verification: page shows ' + newPageLeverage + 'x');
            return true; // Still return true, might just be timing
        }
    }

    // ============================================
    // TRADE EXECUTION
    // ============================================
    async function executeTrade(dir) {
        if (state.isExecuting) return;
        state.isExecuting = true;
        updateStatus('Executing...');

        // Enable and start aggressive Risk reminder polling during trade execution
        riskReminderEnabled = true;
        startRiskReminderPolling();

        tradeStartTime = Date.now();
        log('');
        log('╔══════════════════════════════════════════════════════════════╗');
        log('║           STARTING TRADE EXECUTION                          ║');
        log('╚══════════════════════════════════════════════════════════════╝');
        log('');

        try {
            const { entryPrice, stopLoss, takeProfit, leverage, riskAmount } = state;
            let quantity = state.quantity; // Use let so retry loop can adjust quantity
            const currentLivePrice = getLastPrice();
            const slDistance = Math.abs(entryPrice - stopLoss);
            const slDistancePercent = ((slDistance / entryPrice) * 100).toFixed(3);
            const tpDistance = takeProfit > 0 ? Math.abs(takeProfit - entryPrice) : 0;
            const tpDistancePercent = takeProfit > 0 ? ((tpDistance / entryPrice) * 100).toFixed(3) : 0;
            const margin = quantity / leverage;
            const riskRewardRatio = takeProfit > 0 ? (tpDistance / slDistance).toFixed(2) : 'N/A';

            log('┌─── TRADE PARAMETERS ───────────────────────────────────────┐');
            log('│ Direction:        ' + dir.toUpperCase());
            log('│ Risk Amount:      $' + riskAmount);
            log('│ Leverage:         ' + leverage + 'x');
            log('├─── PRICES ─────────────────────────────────────────────────┤');
            log('│ Current Live:     ' + currentLivePrice);
            log('│ Entry Price:      ' + entryPrice);
            log('│ Price Diff:       ' + (entryPrice - currentLivePrice).toFixed(1) + ' (' + (((entryPrice - currentLivePrice) / currentLivePrice) * 100).toFixed(4) + '%)');
            log('├─── STOP LOSS ──────────────────────────────────────────────┤');
            log('│ SL Price:         ' + stopLoss);
            log('│ SL Distance:      ' + slDistance.toFixed(1) + ' (' + slDistancePercent + '%)');
            log('├─── TAKE PROFIT ────────────────────────────────────────────┤');
            log('│ TP Price:         ' + (takeProfit || 'Not set'));
            log('│ TP Distance:      ' + (takeProfit ? tpDistance.toFixed(1) + ' (' + tpDistancePercent + '%)' : 'N/A'));
            log('│ Risk:Reward:      ' + riskRewardRatio);
            log('├─── POSITION SIZE ──────────────────────────────────────────┤');
            log('│ Quantity:         ' + quantity + ' USDT');
            log('│ Margin Required:  $' + margin.toFixed(2));
            log('│ Est. Risk (PNL):  -$' + state.estimatedPNL.toFixed(2));
            log('├─── LIQUIDATION ────────────────────────────────────────────┤');
            const calculatedLiq = calculateLiquidationPrice(entryPrice, leverage, dir);
            const slToLiqDistance = Math.abs(stopLoss - calculatedLiq);
            const slToLiqPercent = ((slToLiqDistance / entryPrice) * 100).toFixed(3);
            log('│ Calculated Liq:   ' + formatPrice(calculatedLiq));
            log('│ SL to Liq Dist:   $' + slToLiqDistance.toFixed(2) + ' (' + slToLiqPercent + '%)');
            if (dir === 'long') {
                log('│ Safety Check:     SL (' + stopLoss + ') > Liq (' + formatPrice(calculatedLiq) + ')? ' + (stopLoss > calculatedLiq ? '✓ SAFE' : '❌ DANGER'));
            } else {
                log('│ Safety Check:     SL (' + stopLoss + ') < Liq (' + formatPrice(calculatedLiq) + ')? ' + (stopLoss < calculatedLiq ? '✓ SAFE' : '❌ DANGER'));
            }
            if (slToLiqDistance < CONFIG.liqDangerDistance) {
                log('│ ⚠️ DANGER:        SL within $' + CONFIG.liqDangerDistance + ' of liquidation!');
            } else if (slToLiqDistance < CONFIG.liqWarningDistance) {
                log('│ ⚠️ WARNING:       SL within $' + CONFIG.liqWarningDistance + ' of liquidation');
            }
            log('└─────────────────────────────────────────────────────────────┘');
            log('');

            if (!entryPrice || !quantity || !stopLoss) {
                throw new Error('Missing entry, quantity, or stop loss');
            }

            // Step 0: Check if leverage needs adjustment for safe SL
            logTime('STEP 0 - LEVERAGE CHECK');
            log('>>> STEP 0: Checking leverage safety...');

            const safeLeverage = calculateSafeLeverage(entryPrice, stopLoss);
            const currentPageLeverage = getCurrentLeverageFromPage();
            log('    Current page leverage: ' + currentPageLeverage + 'x');
            log('    Safe leverage for this SL: ' + safeLeverage + 'x');
            log('    Our selected leverage: ' + leverage + 'x');

            let actualLeverage = leverage;

            // Check if SL is past liquidation with current leverage
            const currentLiq = calculateLiquidationPrice(entryPrice, leverage, dir);
            const slIsDangerous = (dir === 'long' && stopLoss <= currentLiq) ||
                                  (dir === 'short' && stopLoss >= currentLiq);

            if (slIsDangerous) {
                log('    ⚠️ SL is PAST liquidation with ' + leverage + 'x leverage!');
                log('    AUTO-ADJUSTING leverage to ' + safeLeverage + 'x for safety...');

                // Update our state
                actualLeverage = safeLeverage;
                state.leverage = safeLeverage;

                // Change leverage on KCEX
                const leverageChanged = await changeLeverageOnKCEX(safeLeverage);
                if (leverageChanged) {
                    log('    ✓ Leverage adjusted: ' + leverage + 'x → ' + safeLeverage + 'x');
                    showNotification('Leverage auto-adjusted to ' + safeLeverage + 'x for safe SL', 'info');

                    // Recalculate with new leverage
                    const newLiq = calculateLiquidationPrice(entryPrice, safeLeverage, dir);
                    log('    New liquidation price: ' + formatPrice(newLiq));
                    log('    SL (' + stopLoss + ') vs Liq (' + formatPrice(newLiq) + '): ' +
                        ((dir === 'long' && stopLoss > newLiq) || (dir === 'short' && stopLoss < newLiq) ? '✓ SAFE' : '❌ STILL DANGEROUS'));
                } else {
                    log('    ❌ Failed to change leverage! Aborting trade for safety.');
                    throw new Error('Could not adjust leverage for safe SL. Trade aborted.');
                }

                // Update UI leverage display
                document.getElementById('kcex-leverage').value = safeLeverage;
            } else if (currentPageLeverage !== leverage) {
                // Leverage mismatch but not dangerous - still sync it
                log('    Page leverage (' + currentPageLeverage + 'x) differs from our setting (' + leverage + 'x)');
                log('    Syncing leverage to ' + leverage + 'x...');
                await changeLeverageOnKCEX(leverage);
            } else {
                log('    ✓ Leverage is safe, no adjustment needed');
            }

            // Step 0b: Check if we have enough balance for this trade
            logTime('STEP 0b - BALANCE CHECK');
            log('>>> STEP 0b: Checking available balance...');

            const balanceCheck = await checkBalanceForTrade(quantity, actualLeverage, entryPrice, stopLoss, dir);

            if (!balanceCheck.sufficient) {
                log('    ❌ INSUFFICIENT BALANCE');
                log('    Available: $' + balanceCheck.availableBalance.toFixed(2));
                log('    Required margin: $' + balanceCheck.requiredMargin.toFixed(2));
                log('    Current leverage: ' + actualLeverage + 'x');

                if (CONFIG.autoAdjustLeverage && balanceCheck.liqSafe) {
                    // Can safely increase leverage (and setting is enabled)
                    log('    ✓ Can increase leverage to ' + balanceCheck.suggestedLeverage + 'x safely');
                    showNotification('Insufficient balance! Increasing leverage to ' + balanceCheck.suggestedLeverage + 'x', 'warning');

                    // Auto-adjust leverage
                    actualLeverage = balanceCheck.suggestedLeverage;
                    state.leverage = balanceCheck.suggestedLeverage;

                    const leverageChanged = await changeLeverageOnKCEX(balanceCheck.suggestedLeverage);
                    if (leverageChanged) {
                        log('    ✓ Leverage increased: ' + leverage + 'x → ' + balanceCheck.suggestedLeverage + 'x');
                        document.getElementById('kcex-leverage').value = balanceCheck.suggestedLeverage;
                    } else {
                        throw new Error('Could not increase leverage. Insufficient balance for trade.');
                    }
                } else if (!CONFIG.autoAdjustLeverage && balanceCheck.liqSafe) {
                    // Could increase leverage but setting is disabled
                    log('    ⚠ Could increase leverage to ' + balanceCheck.suggestedLeverage + 'x but auto-adjust is disabled');
                    showNotification('Insufficient balance! Enable "Auto-Adjust Leverage" or increase manually to ' + balanceCheck.suggestedLeverage + 'x', 'error');
                    throw new Error('Insufficient balance. Auto-adjust leverage is disabled. Suggested: ' + balanceCheck.suggestedLeverage + 'x');
                } else {
                    // Cannot increase leverage safely - SL would be past liquidation
                    log('    ❌ Cannot increase leverage - SL would be past liquidation!');
                    log('    Trade requires more capital or wider SL');
                    showNotification('Insufficient balance! Cannot increase leverage (SL too tight)', 'error');
                    throw new Error('Insufficient balance and cannot safely increase leverage. Trade aborted.');
                }
            }

            // Recalculate margin with actual leverage
            const actualMargin = quantity / actualLeverage;

            // Step 1: Fill price input (instant - element already exists)
            logTime('STEP 1 START');
            log('>>> STEP 1: Setting price input...');
            updateStatus('Setting price...');
            const priceInputs = document.querySelectorAll('.InputNumberExtend_wrapper__qxkpD input.ant-input');
            log('    Found ' + priceInputs.length + ' input fields on page');
            if (priceInputs[0]) {
                const priceToSet = Math.round(entryPrice * 10) / 10;
                const priceBefore = priceInputs[0].value;
                setInputValue(priceInputs[0], priceToSet);
                const priceAfter = priceInputs[0].value;
                log('    Price input: ' + priceBefore + ' → ' + priceAfter + ' (target: ' + priceToSet + ')');
            } else {
                log('    ⚠️ WARNING: Price input not found!');
            }

            // Step 2: Fill quantity (instant)
            logTime('STEP 2 START');
            log('>>> STEP 2: Setting quantity input...');
            updateStatus('Setting quantity...');
            if (priceInputs[1]) {
                const qtyBefore = priceInputs[1].value;
                setInputValue(priceInputs[1], quantity);
                const qtyAfter = priceInputs[1].value;
                log('    Quantity input: ' + qtyBefore + ' → ' + qtyAfter + ' (target: ' + quantity + ')');
            } else {
                log('    ⚠️ WARNING: Quantity input not found!');
            }

            // Step 2.5: Verify KCEX liquidation price matches our calculation
            logTime('STEP 2.5 - LIQUIDATION VERIFICATION');
            log('>>> STEP 2.5: Verifying liquidation price with KCEX...');
            await sleep(300); // Give KCEX time to calculate after we filled qty

            const kcexLiqPrices = getLiquidationPricesFromPage();
            const kcexLiq = dir === 'long' ? kcexLiqPrices.long : kcexLiqPrices.short;
            log('    Our calculated liq:  ' + formatPrice(calculatedLiq));
            log('    KCEX displayed liq:  ' + (kcexLiq > 0 ? formatPrice(kcexLiq) : 'N/A (not shown yet)'));

            if (kcexLiq > 0) {
                const liqDifference = Math.abs(calculatedLiq - kcexLiq);
                const liqDiffPercent = ((liqDifference / entryPrice) * 100).toFixed(3);
                log('    Difference:          $' + liqDifference.toFixed(2) + ' (' + liqDiffPercent + '%)');

                if (liqDifference > 500) {
                    log('    ⚠️ LARGE DIFFERENCE! Our calc may be inaccurate. Using KCEX value.');
                    // Could update state.liquidationPrice = kcexLiq here if needed
                } else if (liqDifference > 100) {
                    log('    ⚠️ Minor difference - within acceptable range');
                } else {
                    log('    ✓ Liquidation prices match closely');
                }
            } else {
                log('    ℹ️ KCEX liq not available yet - using our calculation');
            }

            // Step 3: Enable TP/SL checkbox
            logTime('STEP 3 START');
            log('>>> STEP 3: Enabling TP/SL checkbox...');
            updateStatus('Enabling TP/SL...');

            // Find and click the TP/SL checkbox
            const tpslWrapper = document.querySelector('.component_strategyWrapper__Wv3_z');
            if (tpslWrapper) {
                const checkboxInput = tpslWrapper.querySelector('input');
                const wasChecked = checkboxInput ? checkboxInput.checked : 'unknown';
                log('    Found TP/SL wrapper, checkbox was: ' + wasChecked);
                clickAntCheckbox(tpslWrapper);
                const isNowChecked = checkboxInput ? checkboxInput.checked : 'unknown';
                log('    After click, checkbox is: ' + isNowChecked);
            } else {
                log('    ⚠️ Primary selector failed, trying fallback...');
                // Fallback methods
                const allCheckboxWrappers = document.querySelectorAll('.ant-checkbox-wrapper');
                log('    Found ' + allCheckboxWrappers.length + ' checkbox wrappers');
                for (const wrapper of allCheckboxWrappers) {
                    const text = wrapper.textContent || '';
                    if (text.includes('TP/SL')) {
                        log('    ✓ Found TP/SL checkbox by text content');
                        clickAntCheckbox(wrapper);
                        break;
                    }
                }
            }

            // Step 4: Wait for and click Advanced button (event-driven)
            logTime('STEP 4 START');
            log('>>> STEP 4: Looking for Advanced button...');
            updateStatus('Opening TP/SL modal...');
            const advancedBtn = await waitForCondition(() => {
                const btns = document.querySelectorAll('.component_refreshText__XIJuo, [class*="refreshText"], span');
                for (const btn of btns) {
                    if (btn.textContent.trim() === 'Advanced' && btn.offsetParent !== null) {
                        return btn;
                    }
                }
                return null;
            }, 2000);

            log('    ✓ Found Advanced button');
            clickElement(advancedBtn);
            log('    Clicked Advanced button');

            // Step 5: Wait for modal to appear (event-driven)
            logTime('STEP 5 START');
            log('>>> STEP 5: Waiting for SL/TP modal...');
            updateStatus('Setting stop loss...');

            // Find modal by multiple strategies since class names can change
            const modal = await waitForCondition(() => {
                // Strategy 1: Look for modal with EditStopOrder in class name
                let m = document.querySelector('.ant-modal[class*="EditStopOrder"]');
                if (m && m.offsetParent !== null) return m;

                // Strategy 2: Look for any visible ant-modal with "Long" and "Short" tabs
                const modals = document.querySelectorAll('.ant-modal');
                for (const modal of modals) {
                    if (modal.offsetParent === null) continue; // Skip hidden
                    const text = modal.textContent || '';
                    // The SL/TP modal has "Long", "Short", "Trigger Price" text
                    if (text.includes('Trigger Price') && (text.includes('Long') || text.includes('Short'))) {
                        return modal;
                    }
                }

                // Strategy 3: Look for modal with specific input structure
                for (const modal of modals) {
                    if (modal.offsetParent === null) continue;
                    const priceInputs = modal.querySelectorAll('.ant-input-affix-wrapper');
                    if (priceInputs.length >= 2) {
                        // Likely the SL/TP modal
                        return modal;
                    }
                }

                return null;
            }, 3000);

            log('    ✓ Modal appeared (class: ' + modal.className.substring(0, 50) + '...)');

            // Select Long/Short tab in modal
            log('    Selecting ' + dir.toUpperCase() + ' tab in modal...');

            // Find tabs by multiple strategies
            let tabs = modal.querySelectorAll('[class*="tabText"]');
            if (tabs.length === 0) {
                // Fallback: find clickable elements with "Long" or "Short" text
                tabs = modal.querySelectorAll('span, div');
            }
            log('    Found ' + tabs.length + ' potential tab elements');

            for (const tab of tabs) {
                const text = tab.textContent.trim().toLowerCase();
                if (text === dir || text === dir + ' ') {
                    // Check if already active by looking for "active" in class name
                    const isActive = tab.className.includes('active') || tab.classList.contains('active');
                    if (!isActive) {
                        clickElement(tab);
                        log('    Clicked ' + dir.toUpperCase() + ' tab');
                    } else {
                        log('    ' + dir.toUpperCase() + ' tab already active');
                    }
                    break;
                }
            }

            // Wait for inputs to be ready
            log('    Waiting for SL input fields...');
            const inputWrappers = await waitForCondition(() => {
                // Strategy 1: Look for specific class
                let wrappers = modal.querySelectorAll('.ant-input-affix-wrapper[class*="priceInput"]');
                if (wrappers.length >= 2) return wrappers;

                // Strategy 2: Look for all ant-input-affix-wrapper in modal
                wrappers = modal.querySelectorAll('.ant-input-affix-wrapper');
                if (wrappers.length >= 2) return wrappers;

                return null;
            }, 1000);
            log('    ✓ Found ' + inputWrappers.length + ' input wrappers (need 2+)');

            // Stop Loss is the second Trigger Price input
            const slInput = inputWrappers[1].querySelector('input.ant-input');
            if (!slInput) {
                throw new Error('Could not find Stop Loss input in modal');
            }

            const slBefore = slInput.value;
            setInputValue(slInput, stopLoss);
            const slAfter = slInput.value;
            log('    SL input: ' + slBefore + ' → ' + slAfter + ' (target: ' + stopLoss + ')');

            // NOTE: We do NOT set Take Profit here anymore
            // TP will be set via the Close tab after order is placed (lower fees!)
            log('    (TP will be set via Close tab for lower fees)');

            // Step 5.5: PNL VERIFICATION AND ADJUSTMENT
            // =========================================
            // Read KCEX's displayed PNL and verify it matches our target risk
            // If not within tolerance, iteratively adjust quantity
            logTime('STEP 5.5 - PNL VERIFICATION');

            let verificationResult = { verified: true, finalQty: quantity, iterations: 0, kcexPNL: null };

            if (CONFIG.pnlVerification !== false) {
                log('>>> STEP 5.5: Verifying PNL with KCEX...');
                updateStatus('Verifying PNL...');

                // Get reference to main form price inputs for potential quantity adjustment
                const mainFormInputs = document.querySelectorAll('.ant-input-affix-wrapper input.ant-input');

                // Run PNL verification - may need multiple attempts if over tolerance
                let retryCount = 0;
                const maxRetries = 2; // Max retries for hard cap violation

                while (retryCount <= maxRetries) {
                    verificationResult = await verifyAndAdjustPNL(
                        modal,
                        riskAmount,           // Target PNL (our desired risk)
                        quantity,             // Current quantity
                        stopLoss,             // SL price
                        entryPrice,           // Entry price
                        dir,                  // Direction: 'long' or 'short'
                        {
                            tolerance: CONFIG.pnlTolerance || 0.10,  // 10% tolerance default
                        }
                    );

                    // If tolerance violated (over or under), we need to adjust quantity
                    if (verificationResult.needsRetry && verificationResult.suggestedQty) {
                        retryCount++;
                        const adjustDir = verificationResult.adjustDirection || 'decrease';
                        const adjustText = adjustDir === 'increase' ? 'increasing' : 'reducing';
                        log('    🔄 TOLERANCE RETRY ' + retryCount + '/' + maxRetries + ' - ' + adjustText + ' quantity');

                        if (retryCount > maxRetries) {
                            log('    ⚠️ Max retries reached - proceeding with current quantity');
                            break;
                        }

                        // Cancel the current modal
                        const cancelBtn = modal.querySelector('.ant-btn:not(.ant-btn-primary)');
                        if (cancelBtn) {
                            log('    Cancelling modal to adjust quantity...');
                            clickElement(cancelBtn);
                            await sleep(300);
                        }

                        // Update quantity to suggested reduced amount
                        quantity = verificationResult.suggestedQty;
                        state.quantity = quantity;
                        log('    Updated quantity to: ' + quantity + ' USDT');

                        // Update the main form quantity input
                        const qtyInput = mainFormInputs[1];
                        if (qtyInput) {
                            await setInputValueAggressive(qtyInput, quantity);
                            log('    Updated main form quantity input');
                        }

                        // Re-open TP/SL modal
                        await sleep(200);
                        const tpslCheckbox = document.querySelector('.component_checkBox__UQgNi input[type="checkbox"]');
                        if (tpslCheckbox && !tpslCheckbox.checked) {
                            tpslCheckbox.click();
                            await sleep(100);
                        }
                        const tpslAdvanced = document.querySelector('.component_checkBoxInput__OjLjA');
                        if (tpslAdvanced) {
                            clickElement(tpslAdvanced);
                            await sleep(400);
                        }

                        // Find the new modal
                        modal = await waitForElement('.ant-modal-content', 2000);
                        if (!modal) {
                            log('    ⚠️ Could not re-open modal for retry');
                            break;
                        }

                        // Re-enter SL
                        const newInputWrappers = modal.querySelectorAll('.ant-input-affix-wrapper');
                        const newSlInput = newInputWrappers[1]?.querySelector('input.ant-input');
                        if (newSlInput) {
                            setInputValue(newSlInput, stopLoss);
                            log('    Re-entered SL: ' + stopLoss);
                            await sleep(300);
                        }

                        // Continue loop to verify again
                        continue;
                    }

                    // Verification passed or failed without needing retry
                    break;
                }

                // Update state with final quantity
                if (verificationResult.finalQty !== quantity) {
                    log('    📊 Final quantity: ' + verificationResult.finalQty + ' USDT');
                    state.quantity = verificationResult.finalQty;
                    state.estimatedPNL = calculatePNL(entryPrice, stopLoss, verificationResult.finalQty, dir);
                }

                if (verificationResult.verified) {
                    log('    ✓ PNL verification complete - proceeding with trade');
                } else {
                    log('    ⚠️ PNL verification incomplete - proceeding with best available');
                }
            } else {
                log('>>> STEP 5.5: PNL verification disabled - skipping');
            }

            // Step 6: Click Confirm in modal
            logTime('STEP 6 START');
            log('>>> STEP 6: Confirming SL in modal...');
            updateStatus('Confirming TP/SL...');
            const confirmBtn = modal.querySelector('.ant-btn-primary');
            if (confirmBtn) {
                log('    ✓ Found Confirm button');
                clickElement(confirmBtn);
                log('    Clicked Confirm');
            } else {
                log('    ⚠️ WARNING: Confirm button not found!');
            }

            // Step 7: Wait for modal to close, then click Open Long/Short
            logTime('STEP 7 START');
            log('>>> STEP 7: Placing main order...');
            log('    Waiting for modal to close...');
            updateStatus('Placing order...');
            await waitForCondition(() => {
                // Check if any SL/TP modal is still visible
                const modals = document.querySelectorAll('.ant-modal');
                for (const m of modals) {
                    if (m.offsetParent === null) continue; // Skip hidden
                    const text = m.textContent || '';
                    if (text.includes('Trigger Price')) {
                        return false; // Modal still open
                    }
                }
                return true; // No visible SL/TP modal
            }, 2000).catch(() => {
                log('    ⚠️ WARNING: Modal close timeout (continuing anyway)');
            });

            log('    ✓ Modal closed');
            await sleep(50); // Tiny buffer for DOM to settle

            // Check current price again right before placing order
            const priceAtOrderTime = getLastPrice();
            log('    Price at order time: ' + priceAtOrderTime);
            log('    Entry price we set: ' + entryPrice);
            log('    Difference: ' + (priceAtOrderTime - entryPrice).toFixed(1));

            log('    Looking for ' + dir.toUpperCase() + ' order button...');
            let orderBtn;
            if (dir === 'long') {
                orderBtn = document.querySelector('.component_longBtn__JPpVz');
                log('    Selector: .component_longBtn__JPpVz');
            } else {
                orderBtn = document.querySelector('.component_shortBtn__bcJ0L');
                log('    Selector: .component_shortBtn__bcJ0L');
            }

            if (!orderBtn) {
                throw new Error('Could not find ' + dir + ' order button');
            }

            log('    ✓ Found order button: ' + orderBtn.textContent.trim());
            clickElement(orderBtn);
            logTime('ORDER BUTTON CLICKED');
            log('    🚀 CLICKED ' + dir.toUpperCase() + ' BUTTON');

            // CRITICAL: Wait for Risk reminder modal to appear and be auto-confirmed
            // The modal appears asynchronously after button click, typically 100-500ms
            log('    Waiting for Risk reminder modal (if any)...');
            await waitForRiskReminderHandled(2000);
            log('    ✓ Risk reminder check complete - ORDER SUBMITTED!');

            // Success - save to history
            log('');
            log('┌─── ORDER SUBMITTED ────────────────────────────────────────┐');
            log('│ ✅ Main order placed successfully!');
            log('│ Direction: ' + dir.toUpperCase());
            log('│ Entry: ' + entryPrice);
            log('│ Qty: ' + quantity + ' USDT');
            log('│ SL: ' + stopLoss);
            log('│ TP: ' + (takeProfit || 'None'));
            log('└─────────────────────────────────────────────────────────────┘');

            // PNL VERIFICATION LOGGING
            log('');
            log('┌─── PNL CALCULATION VERIFICATION ──────────────────────────┐');
            log('│ FORMULA: PNL = |SL - Entry| × (Qty / Entry)');
            log('│');
            log('│ INPUTS:');
            log('│   Entry Price:      ' + entryPrice + ' USDT');
            log('│   Stop Loss:        ' + stopLoss + ' USDT');
            log('│   Quantity:         ' + quantity + ' USDT (position value)');
            log('│');
            log('│ CALCULATION STEPS:');
            const pnlPriceMove = Math.abs(stopLoss - entryPrice);
            const pnlSlPercent = (pnlPriceMove / entryPrice) * 100;
            const pnlPositionBTC = quantity / entryPrice;
            const pnlCalculated = pnlPriceMove * pnlPositionBTC;
            const pnlAltMethod = (pnlSlPercent / 100) * quantity;
            log('│   1. Price move if SL hit: |' + stopLoss + ' - ' + entryPrice + '| = ' + pnlPriceMove.toFixed(2) + ' USDT');
            log('│   2. SL distance percent:  ' + pnlPriceMove.toFixed(2) + ' / ' + entryPrice + ' = ' + pnlSlPercent.toFixed(4) + '%');
            log('│   3. Position in BTC:      ' + quantity + ' / ' + entryPrice + ' = ' + pnlPositionBTC.toFixed(8) + ' BTC');
            log('│   4. PNL (move × pos):     ' + pnlPriceMove.toFixed(2) + ' × ' + pnlPositionBTC.toFixed(8) + ' = $' + pnlCalculated.toFixed(4));
            log('│   5. PNL (% × qty):        ' + pnlSlPercent.toFixed(4) + '% × ' + quantity + ' = $' + pnlAltMethod.toFixed(4));
            log('│');
            log('│ OUR DISPLAYED PNL:   -$' + state.estimatedPNL.toFixed(2));
            log('│');
            log('│ FEE IMPACT (if using limit order = maker fee 0.02%):');
            const makerFeeRate = 0.0002;
            const takerFeeRate = 0.0006;
            const entryFeeMaker = quantity * makerFeeRate;
            const exitFeeMaker = quantity * makerFeeRate;
            const entryFeeTaker = quantity * takerFeeRate;
            const exitFeeTaker = quantity * takerFeeRate;
            log('│   Maker fee (entry): $' + entryFeeMaker.toFixed(4));
            log('│   Maker fee (exit):  $' + exitFeeMaker.toFixed(4));
            log('│   PNL + maker fees:  -$' + (pnlCalculated + entryFeeMaker + exitFeeMaker).toFixed(4));
            log('│');
            log('│   Taker fee (entry): $' + entryFeeTaker.toFixed(4));
            log('│   Taker fee (exit):  $' + exitFeeTaker.toFixed(4));
            log('│   PNL + taker fees:  -$' + (pnlCalculated + entryFeeTaker + exitFeeTaker).toFixed(4));
            log('│');
            log('│ NOTE: KCEX displayed PNL may differ due to:');
            log('│   - Unrealized PNL uses mark price, not entry');
            log('│   - Funding rate if position held overnight');
            log('│   - Price slippage between order and fill');
            log('│   - Different rounding methods');
            log('└────────────────────────────────────────────────────────────┘');

            // Try to scrape KCEX's PNL for comparison
            log('');
            log('>>> Checking KCEX page for displayed PNL values...');
            getKCEXDisplayedPNL();

            // Use KCEX-verified PNL if available, otherwise fall back to our estimate
            const actualRiskPNL = verificationResult.kcexPNL !== null
                ? verificationResult.kcexPNL
                : state.estimatedPNL;

            // Calculate position size in coin units (e.g., BTC)
            const positionSizeInCoin = quantity / entryPrice;

            const now = new Date();
            const trade = {
                id: Date.now(),
                direction: dir,
                entry: entryPrice,
                sl: stopLoss,
                tp: takeProfit,
                qty: quantity,
                risk: actualRiskPNL, // KCEX-verified PNL (expected loss)
                targetRisk: riskAmount, // Target risk from settings
                time: now.toLocaleString(),
                date: formatDateDDMM(now), // DD/MM format
                timeHHMM: formatTimeHHMM(now), // HH:MM format
                leverage: leverage,
                positionSize: positionSizeInCoin.toFixed(6), // Position size in coin units
                pair: getTradingPair(), // e.g., "BTCUSDT"
                timeframe: getTimeframe(), // e.g., "5m"
            };
            state.tradeHistory.unshift(trade);
            if (state.tradeHistory.length > 20) state.tradeHistory.pop();
            saveHistory();
            renderHistory();

            // Set active trade for close monitoring
            setActiveTradeForMonitoring(trade);

            // NOTE: Google Sheets and clipboard copy moved to AFTER position fills
            // This ensures we capture the actual fill price, not the requested price

            updateStatus('Order placed!');
            showNotification(`${dir.toUpperCase()} order placed!`, 'success');

            // CRITICAL: Stop Risk Reminder auto-confirm IMMEDIATELY after order is placed
            // Otherwise it will keep clicking Confirm on risk reminders, which re-submits orders!
            stopRiskReminderPolling();
            riskReminderEnabled = false; // Disable observer too

            // Step 8: Wait for order to fill (applies to all limit orders)
            log('');
            log('>>> STEP 8: Waiting for order to fill...');
            log('    Checking if position fills (limit orders may take time)...');

            // Wait for position to actually have quantity (order filled)
            // Check for filled position by looking at Open Position tab content
            const maxWaitTime = CONFIG.unfilledWaitTime || 30000; // Configurable wait time
            const checkInterval = 500; // Check every 500ms
            let waitedTime = 0;
            let positionFilled = false;

            while (waitedTime < maxWaitTime && !positionFilled) {
                await sleep(checkInterval);
                waitedTime += checkInterval;

                // Use helper function to check if position is filled
                const fillCheck = checkPositionFilled();
                if (fillCheck.filled) {
                    positionFilled = true;
                    log('    ✓ Position filled! ' + fillCheck.details + ' (method: ' + fillCheck.method + ', waited ' + waitedTime + 'ms)');
                    break;
                }

                if (waitedTime % 2000 === 0) {
                    log('    Still waiting for order to fill... (' + (waitedTime/1000) + 's)');
                }
            }

            if (positionFilled) {
                // Order filled - get actual entry price and update trade data
                const actualEntry = getActualEntryPrice();
                let tpToSet = takeProfit; // Default to original TP

                if (actualEntry && actualEntry !== entryPrice) {
                    log('    Entry price changed: ' + entryPrice + ' → ' + actualEntry);
                    trade.entry = actualEntry;
                    trade.actualEntry = actualEntry;
                    trade.requestedEntry = entryPrice;

                    // CRITICAL: Calculate actual risk with new entry (SL unchanged, qty unchanged)
                    const originalRisk = Math.abs(entryPrice - stopLoss) * (quantity / entryPrice);
                    const actualRisk = Math.abs(actualEntry - stopLoss) * (quantity / actualEntry);
                    const riskChange = actualRisk - originalRisk;
                    const riskChangePercent = ((actualRisk / originalRisk) - 1) * 100;

                    trade.originalRisk = originalRisk;
                    trade.actualRisk = actualRisk;
                    trade.risk = actualRisk; // Update the risk to actual

                    log('    ⚠️ RISK CHANGED:');
                    log('      Original risk: $' + originalRisk.toFixed(2) + ' (entry ' + entryPrice + ')');
                    log('      Actual risk:   $' + actualRisk.toFixed(2) + ' (entry ' + actualEntry + ')');
                    log('      Risk change:   ' + (riskChange > 0 ? '+' : '') + '$' + riskChange.toFixed(2) + ' (' + riskChangePercent.toFixed(1) + '%)');

                    if (riskChangePercent > 50) {
                        showNotification('⚠️ RISK INCREASED ' + riskChangePercent.toFixed(0) + '%! Now $' + actualRisk.toFixed(2), 'warning');
                        log('    ⚠️ WARNING: Risk increased by more than 50%!');
                    }

                    // Recalculate TP to maintain same R:R ratio
                    if (takeProfit > 0) {
                        const recalculatedTP = recalculateTPForNewEntry(entryPrice, takeProfit, stopLoss, actualEntry, dir);
                        if (recalculatedTP) {
                            tpToSet = recalculatedTP;
                            trade.tp = recalculatedTP;
                            trade.originalTP = takeProfit;
                            log('    TP adjusted for new entry: ' + takeProfit + ' → ' + recalculatedTP);
                        }
                    }

                    // Update history with actual entry and adjusted TP
                    saveHistory();
                }

                // NOW copy to Google Sheets and clipboard (after we have actual entry)
                log('    Copying trade report with actual fill price...');
                logTradeToGoogleSheets(trade);
                copyTradeToClipboard(trade);
                copyReportToClipboard(trade);

                // Order filled - proceed to set TP if provided
                if (tpToSet > 0) {
                    await sleep(300); // Small buffer after detecting fill
                    await setTakeProfitViaCloseTab(dir, tpToSet);
                } else {
                    log('');
                    log('>>> STEP 9: No Take Profit specified, skipping TP setup');
                }

                // Attempt chart screenshot AFTER TP is set (so screenshot shows complete setup)
                if (CONFIG.chartScreenshotOnEntry) {
                    await captureChartScreenshot();
                }
            } else {
                // Order NOT filled - edit the existing order with new entry price
                log('    ⚠ Position did not fill within ' + (maxWaitTime/1000) + 's');

                // Loop: keep editing the order until it fills, is cancelled, or max attempts reached
                const maxEditAttempts = 10;
                let editAttempts = 0;
                let orderStatus = 'unfilled';
                let lastPrice = getLastPrice();
                let priceDirection = 0; // Track price movement: positive = rising, negative = falling

                while (orderStatus !== 'filled' && orderStatus !== 'cancelled' && editAttempts < maxEditAttempts) {
                    editAttempts++;

                    // Get current price and calculate direction
                    const currentPrice = getLastPrice();
                    if (lastPrice && currentPrice) {
                        priceDirection = currentPrice - lastPrice;
                    }
                    lastPrice = currentPrice;

                    // Calculate entry with offset in direction of price movement
                    // For SHORT: if price falling (red candle), go lower by $10-15
                    // For LONG: if price rising (green candle), go higher by $10-15
                    const priceOffset = 12; // $12 buffer
                    let targetEntry = currentPrice;

                    if (dir === 'short') {
                        // For shorts, we want to sell - go slightly lower to ensure fill
                        targetEntry = currentPrice - priceOffset;
                        log('    SHORT: Current ' + currentPrice + ' → Target ' + targetEntry + ' (offset -$' + priceOffset + ')');
                    } else {
                        // For longs, we want to buy - go slightly higher to ensure fill
                        targetEntry = currentPrice + priceOffset;
                        log('    LONG: Current ' + currentPrice + ' → Target ' + targetEntry + ' (offset +$' + priceOffset + ')');
                    }

                    // SAFEGUARD: Check if new entry would increase risk too much
                    const originalSLDistance = Math.abs(entryPrice - stopLoss);
                    const newSLDistance = Math.abs(targetEntry - stopLoss);
                    const riskMultiplier = newSLDistance / originalSLDistance;
                    const maxRiskMultiplier = CONFIG.maxRiskMultiplier || 2.0; // Default: don't allow more than 2x risk

                    if (riskMultiplier > maxRiskMultiplier) {
                        log('    ⚠️ SAFEGUARD: New entry would increase risk ' + riskMultiplier.toFixed(1) + 'x (max: ' + maxRiskMultiplier + 'x)');
                        log('    Original SL distance: $' + originalSLDistance.toFixed(1));
                        log('    New SL distance: $' + newSLDistance.toFixed(1));
                        showNotification('Entry edit blocked - would increase risk ' + riskMultiplier.toFixed(1) + 'x', 'warning');

                        // Stop auto-retry and let user handle it
                        orderStatus = 'cancelled';
                        log('    Auto-retry stopped to prevent excessive risk. Please manage order manually.');
                        showNotification('Auto-retry stopped - excessive risk. Manage order manually.', 'warning');
                        break;
                    }

                    if (CONFIG.autoRetryUnfilled) {
                        // Auto-retry: edit order automatically
                        log('    Auto-retry attempt ' + editAttempts + ' - editing order to: ' + targetEntry);
                        showNotification('Edit #' + editAttempts + ': ' + formatPrice(targetEntry), 'info');

                        orderStatus = await editUnfilledOrder(targetEntry, entryPrice, stopLoss, riskAmount);

                        if (orderStatus === 'edited') {
                            log('    Order edited successfully, waiting 15s for fill...');
                            // Wait 15 seconds for this edit to fill
                            const shortWait = 15000;
                            let shortWaited = 0;
                            while (shortWaited < shortWait) {
                                await sleep(500);
                                shortWaited += 500;

                                // Check if position filled using helper
                                const fillCheck = checkPositionFilled();
                                if (fillCheck.filled) {
                                    orderStatus = 'filled';
                                    log('    ✓ Position filled after edit! ' + fillCheck.details + ' (waited ' + shortWaited + 'ms)');
                                    break;
                                }

                                if (shortWaited % 5000 === 0) {
                                    log('    Still waiting for edited order to fill... (' + (shortWaited/1000) + 's)');
                                }
                            }

                            if (orderStatus !== 'filled') {
                                log('    Order still not filled after 15s, will try editing again...');
                            }
                        } else if (orderStatus === 'partially_filled') {
                            log('    Order is partially filled - waiting for full fill...');
                            showNotification('Order partially filled - waiting...', 'info');
                            // Wait longer for partial fills, check periodically
                            let partialWait = 0;
                            while (partialWait < 30000) {
                                await sleep(1000);
                                partialWait += 1000;
                                const fillCheck = checkPositionFilled();
                                if (fillCheck.filled) {
                                    orderStatus = 'filled';
                                    log('    ✓ Partially filled order now fully filled! ' + fillCheck.details);
                                    break;
                                }
                            }
                        } else if (orderStatus === 'filled') {
                            log('    ✓ Order is filled!');
                            break;
                        } else if (orderStatus === 'cancelled' || orderStatus === 'not_found') {
                            // IMPORTANT: "not_found" may mean the DOM didn't render, NOT that order was cancelled
                            // First check if the position actually filled (maybe it filled while we were looking!)
                            log('    Order not found in DOM - checking if it filled...');
                            await sleep(500);

                            const fillCheck = checkPositionFilled();
                            if (fillCheck.filled) {
                                orderStatus = 'filled';
                                log('    ✓ Position actually filled! ' + fillCheck.details);
                                break;
                            }

                            // Not filled - keep monitoring, don't assume cancelled
                            // The order may still be pending but DOM didn't render the Open Orders table
                            log('    Position not filled yet - will keep monitoring...');
                            log('    (DOM may not have rendered Open Orders section properly)');

                            // Wait a bit and check for fill again
                            await sleep(3000);
                            const fillCheck2 = checkPositionFilled();
                            if (fillCheck2.filled) {
                                orderStatus = 'filled';
                                log('    ✓ Position filled! ' + fillCheck2.details);
                                break;
                            }

                            // Still not filled - continue the edit loop (don't break!)
                            // This gives the order more chances to fill at original price
                            log('    Order still pending - continuing to monitor...');
                            orderStatus = 'pending'; // Reset status to continue loop
                        } else {
                            log('    ⚠ Could not edit order (status: ' + orderStatus + '), will retry in 3s...');
                            await sleep(3000);
                        }
                    } else {
                        // Manual retry: show modal asking user
                        log('    Showing retry modal...');
                        const result = await showRetryUnfilledModal(dir, entryPrice, stopLoss, takeProfit, quantity, leverage);

                        if (result.retry && result.newEntry) {
                            // Add offset to user's chosen entry
                            let userEntry = result.newEntry;
                            if (dir === 'short') {
                                userEntry = result.newEntry - priceOffset;
                            } else {
                                userEntry = result.newEntry + priceOffset;
                            }

                            log('    User chose to edit order to: ' + userEntry + ' (with offset)');
                            showNotification('Editing order to ' + formatPrice(userEntry) + '...', 'info');

                            orderStatus = await editUnfilledOrder(userEntry, entryPrice, stopLoss, riskAmount);

                            if (orderStatus === 'edited') {
                                log('    Order edited, waiting 15s for fill...');
                                const shortWait = 15000;
                                let shortWaited = 0;
                                while (shortWaited < shortWait) {
                                    await sleep(500);
                                    shortWaited += 500;
                                    const fillCheck = checkPositionFilled();
                                    if (fillCheck.filled) {
                                        orderStatus = 'filled';
                                        log('    ✓ Position filled! ' + fillCheck.details);
                                        break;
                                    }
                                }
                            } else if (orderStatus === 'partially_filled') {
                                showNotification('Order partially filled - waiting...', 'info');
                                await sleep(10000);
                            } else if (orderStatus === 'filled') {
                                break;
                            } else if (orderStatus === 'not_found') {
                                // Check if actually filled before assuming cancelled
                                log('    Order not found - checking if it filled...');
                                await sleep(500);
                                const fillCheck = checkPositionFilled();
                                if (fillCheck.filled) {
                                    orderStatus = 'filled';
                                    log('    ✓ Position actually filled! ' + fillCheck.details);
                                    break;
                                }
                                // Keep monitoring instead of assuming cancelled
                                log('    Position not filled, will keep monitoring...');
                                orderStatus = 'pending';
                            }
                        } else {
                            log('    User declined retry - keeping pending order');
                            showNotification('Order still pending - manually manage it', 'warning');
                            orderStatus = 'cancelled'; // Exit loop
                            break;
                        }
                    }
                }

                // After loop: check if we got filled
                if (orderStatus === 'filled') {
                    positionFilled = true;
                    showNotification('Order filled! Setting TP...', 'success');

                    // Get actual entry price after edits and update trade data
                    const actualEntry = getActualEntryPrice();
                    let tpToSet = takeProfit; // Default to original TP

                    if (actualEntry) {
                        log('    Actual fill entry: ' + actualEntry + ' (original: ' + entryPrice + ')');
                        trade.entry = actualEntry;
                        trade.actualEntry = actualEntry;
                        trade.requestedEntry = entryPrice;

                        // CRITICAL: Calculate actual risk with new entry (SL unchanged, qty unchanged)
                        if (actualEntry !== entryPrice) {
                            const originalRisk = Math.abs(entryPrice - stopLoss) * (quantity / entryPrice);
                            const actualRisk = Math.abs(actualEntry - stopLoss) * (quantity / actualEntry);
                            const riskChange = actualRisk - originalRisk;
                            const riskChangePercent = ((actualRisk / originalRisk) - 1) * 100;

                            trade.originalRisk = originalRisk;
                            trade.actualRisk = actualRisk;
                            trade.risk = actualRisk; // Update the risk to actual

                            log('    ⚠️ RISK CHANGED:');
                            log('      Original risk: $' + originalRisk.toFixed(2) + ' (entry ' + entryPrice + ')');
                            log('      Actual risk:   $' + actualRisk.toFixed(2) + ' (entry ' + actualEntry + ')');
                            log('      Risk change:   ' + (riskChange > 0 ? '+' : '') + '$' + riskChange.toFixed(2) + ' (' + riskChangePercent.toFixed(1) + '%)');

                            if (riskChangePercent > 50) {
                                showNotification('⚠️ RISK INCREASED ' + riskChangePercent.toFixed(0) + '%! Now $' + actualRisk.toFixed(2), 'warning');
                                log('    ⚠️ WARNING: Risk increased by more than 50%!');
                            }

                            // Recalculate TP to maintain same R:R ratio
                            if (takeProfit > 0) {
                                const recalculatedTP = recalculateTPForNewEntry(entryPrice, takeProfit, stopLoss, actualEntry, dir);
                                if (recalculatedTP) {
                                    tpToSet = recalculatedTP;
                                    trade.tp = recalculatedTP;
                                    trade.originalTP = takeProfit;
                                    log('    TP adjusted for new entry: ' + takeProfit + ' → ' + recalculatedTP);
                                }
                            }
                        }

                        // Update history with actual entry and adjusted TP
                        saveHistory();
                    }

                    // NOW copy to Google Sheets and clipboard (after edits complete)
                    log('    Copying trade report with actual fill price...');
                    logTradeToGoogleSheets(trade);
                    copyTradeToClipboard(trade);
                    copyReportToClipboard(trade);

                    // Now set TP if needed
                    if (tpToSet > 0) {
                        await sleep(500);
                        await setTakeProfitViaCloseTab(dir, tpToSet);
                    }
                } else if (orderStatus === 'cancelled') {
                    log('    Order was cancelled - no TP to set');
                    showNotification('Order cancelled', 'warning');
                } else if (editAttempts >= maxEditAttempts) {
                    log('    ⚠ Max edit attempts (' + maxEditAttempts + ') reached - order still pending');
                    log('    Price is too volatile - please manage order manually');
                    showNotification('Max retries reached (' + maxEditAttempts + ') - manage order manually', 'warning');
                } else {
                    log('    Order management complete - position may still be pending');
                }
            }

            // Reset for next trade
            log('');
            log('Resetting form for next trade in 2 seconds...');
            setTimeout(() => {
                state.stopLoss = 0;
                state.takeProfit = 0;
                document.getElementById('kcex-sl').value = '';
                document.getElementById('kcex-tp').value = '';
                recalculate();
                updateStatus('');
                log('Form reset complete. Ready for next trade.');
            }, 2000);

        } catch (error) {
            log('');
            log('╔══════════════════════════════════════════════════════════════╗');
            log('║           ❌ TRADE EXECUTION FAILED                          ║');
            log('╚══════════════════════════════════════════════════════════════╝');
            log('Error: ' + error.message);
            console.error('[KCEX] Full error stack:', error);
            showNotification('Trade failed: ' + error.message, 'error');
            updateStatus('');
        } finally {
            state.isExecuting = false;
            stopRiskReminderPolling(); // Stop polling when trade execution ends
            const totalTime = Date.now() - tradeStartTime;
            log('');
            log('═══════════════════════════════════════════════════════════════');
            log('                    TRADE EXECUTION END');
            log('═══════════════════════════════════════════════════════════════');
            log('⏱️ TOTAL EXECUTION TIME: ' + totalTime + 'ms (' + (totalTime/1000).toFixed(2) + ' seconds)');
            log('');
            tradeStartTime = 0; // Reset timer
        }
    }

    function updateStatus(text) {
        const el = document.getElementById('kcex-status-text');
        if (el) el.textContent = text;
    }

    // ============================================
    // TAKE PROFIT VIA CLOSE TAB (Lower fees!)
    // ============================================
    async function setTakeProfitViaCloseTab(dir, tpPrice) {
        if (!tpPrice || tpPrice <= 0) return;

        logTime('TP FLOW START');
        log('--- TP FLOW START ---');
        log('TP Direction: ' + dir + ', TP Price: ' + tpPrice);
        updateStatus('Setting Take Profit...');

        try {
            // Step 1: Click the "Close" tab
            log('TP Step 1: Looking for Close tab...');
            const closeTab = await waitForCondition(() => {
                const tabs = document.querySelectorAll('.handle_tabs__BKV6w span, .handle_vInner__d7iEs span');
                for (const tab of tabs) {
                    if (tab.textContent.trim() === 'Close') {
                        return tab;
                    }
                }
                return null;
            }, 2000);

            clickElement(closeTab);
            log('TP Step 1: Clicked Close tab');

            // Step 2: Make sure we're on Limit order (not Market)
            await sleep(100);
            log('TP Step 2: Checking for Limit order type...');
            const limitTab = await waitForCondition(() => {
                const tabs = document.querySelectorAll('.EntrustTabs_tabs__To_YQ span');
                for (const tab of tabs) {
                    if (tab.textContent.trim() === 'Limit') {
                        return tab;
                    }
                }
                return null;
            }, 1000);

            if (!limitTab.classList.contains('EntrustTabs_active__IkEkU')) {
                clickElement(limitTab);
                log('TP Step 2: Switched to Limit order');
                await sleep(100);
            } else {
                log('TP Step 2: Already on Limit order');
            }

            // Step 3: Fill the price input with TP price
            // CRITICAL: The page has TWO forms - Open tab (display:none) and Close tab (display:block)
            // Both have identical class names, so we MUST find the one in the VISIBLE container
            log('TP Step 3: Looking for Close tab price input...');

            await sleep(200); // Give Close tab form time to render

            let closePriceInput = null;

            // Strategy: Find the visible wrapper (display: block) and get its price input
            // The Close tab content is inside a div with style="display: block;"
            // The Open tab content is inside a div with style="display: none;"
            const allDivs = document.querySelectorAll('div[style*="display"]');
            let visibleSection = null;

            for (const div of allDivs) {
                const style = div.getAttribute('style') || '';
                // Look for the visible section that contains the Close tab form
                if (style.includes('display: block') || style.includes('display:block')) {
                    // Check if this section has a price input (component_numberInput__Zn62S)
                    const hasNumberInput = div.querySelector('.component_numberInput__Zn62S');
                    if (hasNumberInput) {
                        visibleSection = div;
                        log('TP Step 3: Found visible section with form inputs');
                        break;
                    }
                }
            }

            if (visibleSection) {
                // Find the price input WITHIN the visible section
                // The price input is in a .component_numberInput__Zn62S container with margin-bottom: 16px
                const numberInputContainers = visibleSection.querySelectorAll('.component_numberInput__Zn62S');
                log('TP Step 3: Found ' + numberInputContainers.length + ' number input containers in visible section');

                for (const container of numberInputContainers) {
                    const style = container.getAttribute('style') || '';
                    if (style.includes('margin-bottom: 16px') || style.includes('margin-bottom:16px')) {
                        closePriceInput = container.querySelector('input.ant-input');
                        log('TP Step 3: Found Close tab price container by margin-bottom style');
                        break;
                    }
                }

                // Fallback: first input in the visible section's numberInput container
                if (!closePriceInput && numberInputContainers.length > 0) {
                    closePriceInput = numberInputContainers[0].querySelector('input.ant-input');
                    log('TP Step 3: Fallback - using first numberInput in visible section');
                }
            }

            // Second fallback: Try finding by InputNumberExtend_wrapper (the price input wrapper)
            if (!closePriceInput) {
                log('TP Step 3: Trying InputNumberExtend_wrapper fallback...');
                const allWrappers = document.querySelectorAll('.InputNumberExtend_wrapper__qxkpD');
                log('TP Step 3: Found ' + allWrappers.length + ' InputNumberExtend wrappers');

                // Find wrappers that are visible (offsetParent !== null)
                const visibleWrappers = [];
                for (const wrapper of allWrappers) {
                    if (wrapper.offsetParent !== null) {
                        visibleWrappers.push(wrapper);
                    }
                }
                log('TP Step 3: ' + visibleWrappers.length + ' visible wrappers');

                // After clicking Close tab, the Close tab inputs should be the later ones in DOM order
                // The Open tab has 2 inputs (price, qty), Close tab has 2 inputs (price, qty)
                // If we have 4+ visible inputs, index 2 should be Close tab price
                if (visibleWrappers.length >= 3) {
                    closePriceInput = visibleWrappers[2].querySelector('input.ant-input');
                    log('TP Step 3: Using wrapper[2] input as Close tab price');
                }
            }

            if (closePriceInput) {
                const oldValue = closePriceInput.value;
                log('TP Step 3: Found Close tab price input, current value: ' + oldValue);
                log('TP Step 3: Input element ID: ' + (closePriceInput.id || 'none'));
                log('TP Step 3: Input parent class: ' + (closePriceInput.parentElement?.className || 'none'));

                // Use aggressive input setter for React components
                await setInputValueAggressive(closePriceInput, tpPrice);

                const newValue = closePriceInput.value;
                log('TP Step 3: Set Close tab price: ' + oldValue + ' → ' + newValue + ' (target: ' + tpPrice + ')');

                // Double-check and retry if needed
                if (parseFloat(newValue) !== tpPrice) {
                    log('TP Step 3: WARNING - Value mismatch! Retrying...');
                    await sleep(100);
                    await setInputValueAggressive(closePriceInput, tpPrice);
                    log('TP Step 3: After retry, value is: ' + closePriceInput.value);
                }
            } else {
                log('TP Step 3: ERROR - Could not find Close tab price input!');
            }

            // Step 4: Set 100% quantity - MUST target the CLOSE tab slider specifically
            // Use the same visible section approach to find the correct slider
            await sleep(300); // Wait for Close tab to fully render
            log('TP Step 4: Setting 100% position to close...');

            let sliderSuccess = false;
            let closeTabSlider = null;

            // Find the slider in the VISIBLE section (display: block)
            const sliderDivs = document.querySelectorAll('div[style*="display"]');
            for (const div of sliderDivs) {
                const style = div.getAttribute('style') || '';
                if (style.includes('display: block') || style.includes('display:block')) {
                    const sliderRow = div.querySelector('.component_sliderRow__4Ro_h');
                    if (sliderRow) {
                        closeTabSlider = sliderRow;
                        log('TP Step 4: Found slider in visible section');
                        break;
                    }
                }
            }

            // Fallback: use the second slider row (Close tab)
            if (!closeTabSlider) {
                const allSliderRows = document.querySelectorAll('.component_sliderRow__4Ro_h');
                log('TP Step 4: Fallback - Found ' + allSliderRows.length + ' slider rows on page');
                if (allSliderRows.length >= 2) {
                    closeTabSlider = allSliderRows[1];
                    log('TP Step 4: Using second slider row (Close tab)');
                } else if (allSliderRows.length === 1) {
                    closeTabSlider = allSliderRows[0];
                    log('TP Step 4: Only 1 slider row found, using it');
                }
            }

            if (closeTabSlider) {
                // Method 1: Click the 100% mark text WITHIN the Close tab slider
                const marks = closeTabSlider.querySelectorAll('.ant-slider-mark-text');
                log('TP Step 4: Found ' + marks.length + ' marks in Close tab slider');

                for (const mark of marks) {
                    const text = mark.textContent.trim();
                    if (text === '100%') {
                        log('TP Step 4a: Clicking 100% mark in Close tab slider...');
                        mark.click();
                        sliderSuccess = true;
                        await sleep(200);
                        break;
                    }
                }

                // Method 2: Click the 100% dot WITHIN the Close tab slider
                const dots = closeTabSlider.querySelectorAll('.ant-slider-dot');
                log('TP Step 4: Found ' + dots.length + ' dots in Close tab slider');
                if (dots.length >= 5) {
                    const dot100 = dots[dots.length - 1]; // Last dot = 100%
                    log('TP Step 4b: Clicking last dot (100%) in Close tab slider...');
                    dot100.click();
                    await sleep(200);
                }

                // Method 3: Click the slider rail at 100% position
                const rail = closeTabSlider.querySelector('.ant-slider-rail');
                if (rail) {
                    const railRect = rail.getBoundingClientRect();
                    if (railRect.width > 0) {
                        const clickX = railRect.left + railRect.width * 0.99;
                        const clickY = railRect.top + railRect.height / 2;
                        log('TP Step 4c: Clicking rail at x=' + Math.round(clickX) + ' (width=' + Math.round(railRect.width) + ')');

                        const evt = new MouseEvent('click', {
                            bubbles: true, cancelable: true,
                            clientX: clickX, clientY: clickY
                        });
                        rail.dispatchEvent(evt);
                        await sleep(200);
                    }
                }

                // Method 4: Check if slider handle moved to 100%
                const handle = closeTabSlider.querySelector('.ant-slider-handle');
                if (handle) {
                    const ariaValue = handle.getAttribute('aria-valuenow');
                    log('TP Step 4d: Slider handle aria-valuenow = ' + ariaValue);
                    if (ariaValue === '100') {
                        sliderSuccess = true;
                    }
                }
            } else {
                log('TP Step 4: ERROR - Could not find Close tab slider row!');
            }

            await sleep(300);

            // Final verification: Check if qty input now shows the position size
            // In Close tab, if slider is at 100%, the qty input should have a value
            const qtyInputs = document.querySelectorAll('.InputNumberExtend_wrapper__qxkpD input.ant-input');
            log('TP Step 4: Found ' + qtyInputs.length + ' inputs on page');
            // The qty input for Close tab should be the 4th one (index 3) when both Open and Close are visible
            // Or we look for the one with a non-empty value after slider interaction
            for (let i = 0; i < qtyInputs.length; i++) {
                const val = qtyInputs[i].value;
                if (val && parseFloat(val) > 0) {
                    log('TP Step 4: Input[' + i + '] has value: ' + val);
                }
            }

            // Check track width to verify 100%
            if (closeTabSlider) {
                const track = closeTabSlider.querySelector('.ant-slider-track');
                if (track) {
                    const trackStyle = track.getAttribute('style') || '';
                    log('TP Step 4: Track style: ' + trackStyle);
                    if (trackStyle.includes('width: 100%')) {
                        log('TP Step 4: SUCCESS - Track is at 100%!');
                        sliderSuccess = true;
                    }
                }
            }

            await sleep(200);

            // Step 4.5: VERIFY the Close tab price input has the correct TP price before clicking button
            // Use the same visible section approach as Step 3
            log('TP Step 4.5: Verifying Close tab price before submitting...');

            let priceVerified = false;
            let verifyInput = null;

            // Re-find the visible section (same logic as Step 3)
            const verifyDivs = document.querySelectorAll('div[style*="display"]');
            for (const div of verifyDivs) {
                const style = div.getAttribute('style') || '';
                if (style.includes('display: block') || style.includes('display:block')) {
                    const hasNumberInput = div.querySelector('.component_numberInput__Zn62S');
                    if (hasNumberInput) {
                        // Find the price input in this visible section
                        const containers = div.querySelectorAll('.component_numberInput__Zn62S');
                        for (const container of containers) {
                            const containerStyle = container.getAttribute('style') || '';
                            if (containerStyle.includes('margin-bottom: 16px') || containerStyle.includes('margin-bottom:16px')) {
                                verifyInput = container.querySelector('input.ant-input');
                                break;
                            }
                        }
                        // Fallback to first container
                        if (!verifyInput && containers.length > 0) {
                            verifyInput = containers[0].querySelector('input.ant-input');
                        }
                        break;
                    }
                }
            }

            if (verifyInput) {
                const currentVal = verifyInput.value;
                log('TP Step 4.5: Close tab price input current value: ' + currentVal);

                if (parseFloat(currentVal) !== tpPrice) {
                    log('TP Step 4.5: MISMATCH! Re-setting price to ' + tpPrice + ' using aggressive method');
                    await setInputValueAggressive(verifyInput, tpPrice);
                    await sleep(100);
                    log('TP Step 4.5: After re-set, value is: ' + verifyInput.value);

                    // If still not matching, try using keyboard simulation
                    if (parseFloat(verifyInput.value) !== tpPrice) {
                        log('TP Step 4.5: STILL MISMATCH! Trying keyboard simulation...');

                        // Clear and type character by character
                        verifyInput.focus();
                        await sleep(50);
                        verifyInput.select();
                        await sleep(30);

                        // Delete all content
                        verifyInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete', code: 'Delete' }));
                        await sleep(30);

                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        nativeSetter.call(verifyInput, '');
                        verifyInput.dispatchEvent(new Event('input', { bubbles: true }));
                        await sleep(50);

                        // Type the price character by character
                        const priceStr = String(tpPrice);
                        for (const char of priceStr) {
                            nativeSetter.call(verifyInput, verifyInput.value + char);
                            verifyInput.dispatchEvent(new Event('input', { bubbles: true }));
                            verifyInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: char }));
                            verifyInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: char }));
                            await sleep(20);
                        }

                        verifyInput.dispatchEvent(new Event('change', { bubbles: true }));
                        verifyInput.dispatchEvent(new Event('blur', { bubbles: true }));
                        await sleep(100);

                        log('TP Step 4.5: After char-by-char typing, value is: ' + verifyInput.value);
                    }

                    if (parseFloat(verifyInput.value) === tpPrice) {
                        log('TP Step 4.5: Price now correct after retry!');
                        priceVerified = true;
                    }
                } else {
                    log('TP Step 4.5: Price is correct!');
                    priceVerified = true;
                }
            } else {
                log('TP Step 4.5: WARNING - Could not find verify input!');
            }

            // Final sanity check
            if (!priceVerified) {
                log('TP Step 4.5: WARNING - Price verification did not confirm correct value!');
            }

            // Step 5: Click Close Long or Close Short button
            // IMPORTANT: Find by TEXT content, not by class (class is same for Open/Close tabs)
            await sleep(150);
            const targetText = dir === 'long' ? 'close long' : 'close short';
            log('TP Step 5: Looking for button with text: "' + targetText + '"...');

            const closeBtn = await waitForCondition(() => {
                // Search ALL buttons on the page for the correct text
                const allBtns = document.querySelectorAll('button');
                for (const btn of allBtns) {
                    const text = btn.textContent.trim().toLowerCase();
                    if (text.includes(targetText)) {
                        log('TP Step 5: Found button: "' + btn.textContent.trim() + '"');
                        return btn;
                    }
                }
                log('TP Step 5: No button found with text "' + targetText + '", searching...');
                return null;
            }, 2000);

            if (closeBtn) {
                // Check if button is already disabled (prevent double-click)
                if (closeBtn.disabled || closeBtn.classList.contains('ant-btn-loading')) {
                    log('TP Step 5: Button already disabled/loading - skipping duplicate click');
                } else {
                    clickElement(closeBtn);
                    log('TP Step 5: SUCCESS - Clicked "' + closeBtn.textContent.trim() + '" button');
                }

                // Step 5b: Actively poll for and close any Risk reminder that appears
                // ONLY look for Risk reminder modal specifically - NOT any random confirm button
                log('TP Step 5b: Polling for Risk reminder modal...');
                for (let i = 0; i < 10; i++) { // Poll for up to 1 second
                    await sleep(100);
                    if (closeRiskReminderIfPresent()) {
                        log('TP Step 5b: Risk reminder closed via polling');
                        await sleep(200);
                        break;
                    }
                }

                // NOTE: Removed catch-all modal confirm click that was causing duplicate orders
                // The Risk reminder observer handles any Risk reminder popups automatically

                // Check for success notification or order placed
                log('TP Step 5b: Waiting for TP order to register...');
                await sleep(300);
                updateStatus('TP order placed!');
            } else {
                log('TP Step 5: FAILED - Could not find Close button!');
                updateStatus('TP: Could not find close button');
            }

            // Step 6: Switch back to Open tab for next trade
            await sleep(300);
            log('TP Step 6: Switching back to Open tab...');
            const allTabs = document.querySelectorAll('.handle_tabs__BKV6w span, .handle_vInner__d7iEs span');
            for (const tab of allTabs) {
                if (tab.textContent.trim() === 'Open') {
                    clickElement(tab);
                    log('TP Step 6: Switched back to Open tab');
                    break;
                }
            }

            logTime('TP FLOW END');
            log('--- TP FLOW END ---');

        } catch (error) {
            logTime('TP FLOW FAILED');
            log('--- TP FLOW FAILED ---');
            log('TP Error: ' + error.message);
            console.error('[KCEX] TP Full error:', error);
            updateStatus('TP failed: ' + error.message);
        }
    }

    // ============================================
    // HISTORY
    // ============================================
    function loadHistory() {
        try {
            const saved = localStorage.getItem('kcex_trade_history');
            if (saved) {
                state.tradeHistory = JSON.parse(saved);
            }
        } catch (e) {
            state.tradeHistory = [];
        }
    }

    function saveHistory() {
        try {
            localStorage.setItem('kcex_trade_history', JSON.stringify(state.tradeHistory));
        } catch (e) {}
    }

    function renderHistory() {
        const container = document.getElementById('kcex-history-list');
        const countEl = document.getElementById('kcex-history-count');
        if (!container) return;

        // Update count badge
        if (countEl) {
            countEl.textContent = state.tradeHistory.length;
        }

        if (state.tradeHistory.length === 0) {
            container.innerHTML = '<div class="kcex-history-empty">No trades yet. Place a trade to see history here.</div>';
            return;
        }

        container.innerHTML = state.tradeHistory.slice(0, 10).map(t => {
            // Calculate potential profit if TP exists
            let profitPNL = 0;
            if (t.tp && t.entry && t.qty) {
                profitPNL = (Math.abs(t.tp - t.entry) / t.entry) * t.qty;
            }
            return `
            <div class="kcex-history-item ${t.direction}">
                <div class="kcex-history-row">
                    <span class="dir ${t.direction}">${t.direction.toUpperCase()}</span>
                    <span class="time">${t.time.split(' ')[1] || t.time}</span>
                </div>
                <div class="kcex-history-row">
                    <span>Entry: ${formatPrice(t.entry)}</span>
                    <span>Qty: ${t.qty}</span>
                </div>
                <div class="kcex-history-row">
                    <span>SL: ${formatPrice(t.sl)}</span>
                    ${t.tp ? `<span>TP: ${formatPrice(t.tp)}</span>` : '<span>TP: --</span>'}
                </div>
                <div class="kcex-history-row">
                    <span class="risk">Risk: -$${formatUSDT(t.risk)}</span>
                    ${profitPNL > 0 ? `<span class="profit">Profit: +$${formatUSDT(profitPNL)}</span>` : '<span>Profit: --</span>'}
                </div>
            </div>`;
        }).join('');
    }

    // ============================================
    // PANEL POSITION PERSISTENCE
    // ============================================
    function loadPanelPosition() {
        try {
            const saved = localStorage.getItem('kcex_panel_position');
            if (saved) {
                state.panelPosition = JSON.parse(saved);
            }
        } catch (e) {}
    }

    function savePanelPosition() {
        try {
            localStorage.setItem('kcex_panel_position', JSON.stringify(state.panelPosition));
        } catch (e) {}
    }

    function applyPanelPosition() {
        const panel = document.getElementById('kcex-assistant');
        if (panel && state.panelPosition.x !== null && state.panelPosition.y !== null) {
            panel.style.left = state.panelPosition.x;
            panel.style.top = state.panelPosition.y;
            panel.style.right = 'auto';
        }
    }

    // ============================================
    // UI
    // ============================================
    function createUI() {
        const existing = document.getElementById('kcex-assistant');
        if (existing) existing.remove();

        loadHistory();
        loadPanelPosition();

        const panel = document.createElement('div');
        panel.id = 'kcex-assistant';
        panel.innerHTML = `
            <style>
                #kcex-assistant {
                    position: fixed;
                    top: 55px;
                    right: 10px;
                    width: ${CONFIG.sidebarWidth}px;
                    max-height: calc(100vh - 70px);
                    background: #1a1a2e;
                    border: 1px solid #00d4ff;
                    border-radius: 12px;
                    z-index: 9999;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    color: #eee;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                    font-size: 12px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                #kcex-assistant.collapsed .kcex-body { display: none; }
                #kcex-assistant.collapsed { width: auto; max-height: none; }

                .kcex-header {
                    background: linear-gradient(135deg, #00d4ff, #0099cc);
                    padding: 8px 12px;
                    border-radius: 11px 11px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: grab;
                    user-select: none;
                    flex-shrink: 0;
                }
                .kcex-header:active { cursor: grabbing; }
                .kcex-header-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .kcex-header-title {
                    font-weight: 700;
                    color: #000;
                    font-size: 13px;
                }
                .kcex-header-right {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .kcex-header-btn {
                    background: rgba(0,0,0,0.2);
                    border: none;
                    color: #000;
                    width: 22px;
                    height: 22px;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    transition: background 0.2s;
                }
                .kcex-header-btn:hover { background: rgba(0,0,0,0.3); }
                .kcex-toggle {
                    color: #000;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,0,0,0.15);
                    border-radius: 6px;
                    transition: background 0.2s;
                }
                .kcex-toggle:hover { background: rgba(0,0,0,0.3); }

                .kcex-body {
                    padding: 10px;
                    overflow-y: auto;
                    flex: 1;
                    min-height: 0;
                }

                /* Settings Panel */
                .kcex-settings {
                    display: none;
                    padding: 10px;
                    background: #0f0f23;
                    border-bottom: 1px solid #2a3f5f;
                }
                .kcex-settings.visible { display: block; }
                .kcex-settings-title {
                    color: #00d4ff;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    margin-bottom: 10px;
                }
                .kcex-settings-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .kcex-settings-label {
                    color: #888;
                    font-size: 11px;
                }
                .kcex-settings-input {
                    width: 80px;
                    padding: 4px 8px;
                    background: #1a1a2e;
                    border: 1px solid #2a3f5f;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 11px;
                    text-align: right;
                }
                .kcex-settings-input:focus {
                    outline: none;
                    border-color: #00d4ff;
                }
                .kcex-settings-checkbox {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }
                .kcex-settings-save {
                    width: 100%;
                    padding: 8px;
                    background: linear-gradient(135deg, #00d4ff, #0099cc);
                    border: none;
                    border-radius: 6px;
                    color: #000;
                    font-weight: 600;
                    cursor: pointer;
                    margin-top: 8px;
                }
                .kcex-settings-save:hover {
                    opacity: 0.9;
                }

                .kcex-price-box {
                    background: #0f0f23;
                    border-radius: 8px;
                    padding: 10px;
                    text-align: center;
                    margin-bottom: 10px;
                }
                .kcex-price {
                    font-size: 22px;
                    font-weight: 700;
                    color: #00d4ff;
                    font-family: 'SF Mono', Monaco, monospace;
                }
                .kcex-price-label { color: #666; font-size: 10px; }

                .kcex-config {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 10px;
                }
                .kcex-config-item {
                    flex: 1;
                    background: #0f0f23;
                    border-radius: 6px;
                    padding: 6px;
                    text-align: center;
                    cursor: pointer;
                    border: 1px solid #2a3f5f;
                }
                .kcex-config-item:hover { border-color: #00d4ff; }
                .kcex-config-label { color: #666; font-size: 9px; display: block; }
                .kcex-config-value { color: #fff; font-weight: 600; }
                .kcex-config-input {
                    width: 100%;
                    background: transparent;
                    border: none;
                    color: #fff;
                    text-align: center;
                    font-weight: 600;
                    font-size: 12px;
                }
                .kcex-config-input:focus { outline: none; }

                .kcex-input-group {
                    margin-bottom: 8px;
                }
                .kcex-input-group label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #888;
                    font-size: 10px;
                    margin-bottom: 3px;
                }
                .kcex-input-group input[type="number"] {
                    width: 100%;
                    padding: 8px;
                    background: #0f0f23;
                    border: 1px solid #2a3f5f;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 13px;
                }
                .kcex-input-group input:focus {
                    outline: none;
                    border-color: #00d4ff;
                }

                .kcex-auto-toggle {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    cursor: pointer;
                }
                .kcex-auto-toggle input { cursor: pointer; }

                .kcex-calc {
                    background: #0f0f23;
                    border-radius: 8px;
                    padding: 8px;
                    margin: 10px 0;
                }
                .kcex-calc-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 3px 0;
                    font-size: 11px;
                }
                .kcex-calc-label { color: #666; }
                .kcex-calc-value { color: #fff; font-weight: 500; }
                .kcex-calc-value.long { color: #00c853; }
                .kcex-calc-value.short { color: #ff4444; }
                .kcex-calc-value.warn { color: #ffaa00; }
                .kcex-calc-value.danger { color: #ff4444; }

                .kcex-warning {
                    background: rgba(255,68,68,0.1);
                    border: 1px solid #ff4444;
                    border-radius: 6px;
                    padding: 6px;
                    color: #ff4444;
                    font-size: 10px;
                    margin-bottom: 8px;
                    display: none;
                }
                .kcex-warning.visible { display: block; }

                .kcex-buttons {
                    display: flex;
                    gap: 8px;
                }
                .kcex-btn {
                    flex: 1;
                    padding: 12px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .kcex-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
                .kcex-btn.long {
                    background: linear-gradient(135deg, #00c853, #009624);
                    color: #fff;
                }
                .kcex-btn.short {
                    background: linear-gradient(135deg, #ff4444, #cc0000);
                    color: #fff;
                }
                .kcex-btn:not(:disabled):hover {
                    transform: translateY(-1px);
                }

                .kcex-status {
                    text-align: center;
                    padding: 6px;
                    color: #00d4ff;
                    font-size: 11px;
                    min-height: 18px;
                }

                .kcex-history {
                    border-top: 1px solid #2a3f5f;
                    margin-top: 10px;
                    padding-top: 10px;
                }
                .kcex-history-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    padding: 6px 8px;
                    background: #0f0f23;
                    border-radius: 6px;
                    margin-bottom: 8px;
                }
                .kcex-history-header:hover {
                    background: #1a1a3e;
                }
                .kcex-history-title {
                    color: #00d4ff;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .kcex-history-toggle {
                    color: #00d4ff;
                    font-size: 14px;
                }
                .kcex-history-count {
                    background: #00d4ff;
                    color: #000;
                    font-size: 10px;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 10px;
                    margin-left: 8px;
                }
                .kcex-history-list {
                    max-height: 200px;
                    overflow-y: auto;
                }
                .kcex-history-list.collapsed {
                    display: none;
                }
                .kcex-history-item {
                    background: #0f0f23;
                    border-radius: 6px;
                    padding: 6px;
                    margin-bottom: 6px;
                    border-left: 3px solid #666;
                }
                .kcex-history-item.long { border-left-color: #00c853; }
                .kcex-history-item.short { border-left-color: #ff4444; }
                .kcex-history-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: #888;
                }
                .kcex-history-row .dir { font-weight: 700; }
                .kcex-history-row .dir.long { color: #00c853; }
                .kcex-history-row .dir.short { color: #ff4444; }
                .kcex-history-row .risk { color: #ff4444; }
                .kcex-history-row .profit { color: #00c853; }
                .kcex-history-row .time { color: #666; }
                .kcex-history-empty {
                    color: #666;
                    text-align: center;
                    padding: 15px;
                    font-size: 11px;
                }

                /* Custom Confirmation Modal */
                .kcex-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(4px);
                }
                .kcex-modal {
                    background: #1a1a2e;
                    border-radius: 16px;
                    padding: 24px;
                    min-width: 320px;
                    max-width: 400px;
                    border: 2px solid #00d4ff;
                    box-shadow: 0 8px 32px rgba(0, 212, 255, 0.2);
                }
                .kcex-modal-title {
                    font-size: 18px;
                    font-weight: 700;
                    text-align: center;
                    margin-bottom: 20px;
                    padding: 8px 16px;
                    border-radius: 8px;
                }
                .kcex-modal-title.long {
                    background: linear-gradient(135deg, rgba(0, 200, 83, 0.2), rgba(0, 150, 36, 0.2));
                    color: #00c853;
                    border: 1px solid #00c853;
                }
                .kcex-modal-title.short {
                    background: linear-gradient(135deg, rgba(255, 68, 68, 0.2), rgba(204, 0, 0, 0.2));
                    color: #ff4444;
                    border: 1px solid #ff4444;
                }
                .kcex-modal-main {
                    background: #0f0f23;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 16px;
                }
                .kcex-modal-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                }
                .kcex-modal-row.highlight {
                    font-size: 18px;
                    font-weight: 700;
                }
                .kcex-modal-row.highlight .kcex-modal-value {
                    color: #ff4444;
                    font-size: 22px;
                }
                .kcex-modal-row.important {
                    font-size: 15px;
                    font-weight: 600;
                }
                .kcex-modal-row.secondary {
                    font-size: 12px;
                    opacity: 0.6;
                }
                .kcex-modal-row.target-r {
                    opacity: 1;
                    font-size: 14px;
                    margin-top: 4px;
                }
                .kcex-modal-value.highlight {
                    color: #00d4ff;
                    font-weight: 700;
                }
                .kcex-modal-label {
                    color: #888;
                }
                .kcex-modal-value {
                    color: #fff;
                    font-weight: 500;
                }
                .kcex-modal-value.long { color: #00c853; }
                .kcex-modal-value.short { color: #ff4444; }
                .kcex-modal-divider {
                    height: 1px;
                    background: #2a3f5f;
                    margin: 8px 0;
                }
                .kcex-modal-buttons {
                    display: flex;
                    gap: 12px;
                    margin-top: 20px;
                }
                .kcex-modal-btn {
                    flex: 1;
                    padding: 14px;
                    border: none;
                    border-radius: 10px;
                    font-size: 15px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .kcex-modal-btn.cancel {
                    background: #2a3f5f;
                    color: #fff;
                }
                .kcex-modal-btn.cancel:hover {
                    background: #3a5070;
                }
                .kcex-modal-btn.confirm-long {
                    background: linear-gradient(135deg, #00c853, #009624);
                    color: #fff;
                }
                .kcex-modal-btn.confirm-short {
                    background: linear-gradient(135deg, #ff4444, #cc0000);
                    color: #fff;
                }
                .kcex-modal-btn.confirm-long:hover,
                .kcex-modal-btn.confirm-short:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }

                /* Price Ladder Styles */
                .kcex-price-ladder {
                    background: #0a0a1a;
                    border-radius: 8px;
                    padding: 8px;
                    margin-bottom: 12px;
                }
                .kcex-price-ladder .price-row {
                    padding: 6px 8px;
                    border-radius: 4px;
                    margin-bottom: 2px;
                }
                .kcex-price-ladder .price-row:last-child { margin-bottom: 0; }
                .kcex-price-ladder .price-row.warning {
                    background: rgba(255, 170, 0, 0.15);
                    border: 1px solid rgba(255, 170, 0, 0.3);
                }
                .kcex-price-ladder .price-row.danger {
                    background: rgba(255, 68, 68, 0.15);
                    border: 1px solid rgba(255, 68, 68, 0.3);
                }
                .kcex-modal-value.tp { color: #00c853; font-weight: 700; font-size: 15px; }
                .kcex-modal-value.entry { color: #ffffff; font-weight: 700; font-size: 15px; }
                .kcex-modal-value.sl { color: #ff4444; font-weight: 700; font-size: 15px; }
                .kcex-modal-value.liq { color: #ff9800; font-weight: 700; font-size: 15px; }

                /* Liquidation Distance */
                .kcex-modal-row.liq-distance {
                    padding: 8px;
                    border-radius: 6px;
                    margin-bottom: 8px;
                }
                .kcex-modal-row.liq-distance.warning {
                    background: rgba(255, 170, 0, 0.1);
                    border: 1px solid #ffaa00;
                }
                .kcex-modal-row.liq-distance.danger {
                    background: rgba(255, 68, 68, 0.1);
                    border: 1px solid #ff4444;
                }
                .kcex-modal-row.liq-distance.warning .kcex-modal-value { color: #ffaa00; }
                .kcex-modal-row.liq-distance.danger .kcex-modal-value { color: #ff4444; }

                /* Modal Warnings */
                .kcex-modal-warning {
                    padding: 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    margin-bottom: 8px;
                }
                .kcex-modal-warning.warning {
                    background: rgba(255, 170, 0, 0.15);
                    border: 1px solid #ffaa00;
                    color: #ffaa00;
                }
                .kcex-modal-warning.danger {
                    background: rgba(255, 68, 68, 0.15);
                    border: 1px solid #ff4444;
                    color: #ff4444;
                }

                /* Danger Confirm Checkbox */
                .kcex-danger-confirm {
                    background: rgba(255, 68, 68, 0.1);
                    border: 1px solid #ff4444;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 16px;
                }
                .kcex-danger-confirm label {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    cursor: pointer;
                    color: #ff6666;
                    font-size: 12px;
                }
                .kcex-danger-confirm input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    margin-top: 2px;
                    cursor: pointer;
                    accent-color: #ff4444;
                }

                /* Entry Update Option Checkbox */
                .kcex-entry-update-option {
                    background: rgba(0, 212, 255, 0.1);
                    border: 1px solid rgba(0, 212, 255, 0.3);
                    border-radius: 8px;
                    padding: 10px 12px;
                    margin-bottom: 12px;
                }
                .kcex-entry-update-option label {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    color: #aaa;
                    font-size: 11px;
                }
                .kcex-entry-update-option input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                    accent-color: #00d4ff;
                }
                .kcex-entry-update-option:has(input:checked) {
                    background: rgba(0, 212, 255, 0.2);
                    border-color: #00d4ff;
                }
                .kcex-entry-update-option:has(input:checked) label {
                    color: #00d4ff;
                }

                /* Retry Modal Styles */
                .kcex-modal-title.warning {
                    background: linear-gradient(135deg, #ff9500, #ff6600);
                }
                .kcex-retry-section {
                    margin: 8px 0;
                }
                .kcex-retry-header {
                    font-size: 14px;
                    font-weight: 600;
                    color: #00d4ff;
                    margin-bottom: 8px;
                }
                .kcex-retry-note {
                    margin-top: 10px;
                    text-align: center;
                    color: #666;
                    font-size: 11px;
                }

                /* Price Ladder Wrapper with Arrow */
                .kcex-price-ladder-wrapper {
                    display: flex;
                    align-items: stretch;
                    margin-bottom: 12px;
                    position: relative;
                }
                .kcex-price-ladder {
                    flex: 1;
                    background: #0a0a1a;
                    border-radius: 8px;
                    padding: 8px;
                }
                .kcex-price-ladder .price-row {
                    padding: 6px 8px;
                    border-radius: 4px;
                    margin-bottom: 2px;
                }
                .kcex-price-ladder .price-row:last-child { margin-bottom: 0; }
                .kcex-price-ladder .price-row.warning {
                    background: rgba(255, 170, 0, 0.15);
                    border: 1px solid rgba(255, 170, 0, 0.3);
                }
                .kcex-price-ladder .price-row.danger {
                    background: rgba(255, 68, 68, 0.15);
                    border: 1px solid rgba(255, 68, 68, 0.3);
                }

                /* Direction Arrow - tall on right side */
                .kcex-direction-arrow {
                    width: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: 8px;
                    border-radius: 8px;
                    position: relative;
                }
                .kcex-direction-arrow::before {
                    content: '';
                    position: absolute;
                    top: 10%;
                    bottom: 10%;
                    left: 50%;
                    width: 3px;
                    transform: translateX(-50%);
                    border-radius: 2px;
                }
                .kcex-direction-arrow.short::before {
                    background: linear-gradient(to bottom, #ff4444 0%, #ff4444 100%);
                }
                .kcex-direction-arrow.long::before {
                    background: linear-gradient(to top, #00c853 0%, #00c853 100%);
                }
                .kcex-direction-arrow span {
                    font-size: 32px;
                    font-weight: bold;
                    z-index: 1;
                }
                .kcex-direction-arrow.short span { color: #ff4444; }
                .kcex-direction-arrow.long span { color: #00c853; }

                /* Price Diff inline with row */
                .kcex-modal-row .kcex-price-diff {
                    font-size: 10px;
                    font-weight: 600;
                    color: #888;
                    min-width: 50px;
                    text-align: right;
                }
                .kcex-modal-row .kcex-price-diff.empty {
                    visibility: hidden;
                }

                /* Danger Options Container */
                .kcex-danger-options {
                    background: rgba(255, 68, 68, 0.08);
                    border: 1px solid rgba(255, 68, 68, 0.3);
                    border-radius: 10px;
                    padding: 16px;
                    margin-bottom: 16px;
                }
                .kcex-danger-option {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                }
                .kcex-danger-option .option-desc {
                    font-size: 11px;
                    color: #888;
                }
                .kcex-danger-divider {
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                    font-weight: 600;
                    margin: 12px 0;
                    position: relative;
                }
                .kcex-danger-divider::before,
                .kcex-danger-divider::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    width: 40%;
                    height: 1px;
                    background: #444;
                }
                .kcex-danger-divider::before { left: 0; }
                .kcex-danger-divider::after { right: 0; }

                /* Adjust Leverage Button */
                .kcex-modal-btn.adjust-leverage {
                    background: linear-gradient(135deg, #ff9800, #f57c00);
                    color: #fff;
                    padding: 10px 20px;
                    font-size: 14px;
                }
                .kcex-modal-btn.adjust-leverage:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.4);
                }

                /* Disabled Confirm Button */
                .kcex-modal-btn.confirm-long:disabled,
                .kcex-modal-btn.confirm-short:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                    transform: none !important;
                    box-shadow: none !important;
                }
            </style>

            <div class="kcex-header" id="kcex-header">
                <div class="kcex-header-left">
                    <span class="kcex-header-title">Trade Assistant</span>
                </div>
                <div class="kcex-header-right">
                    <button class="kcex-header-btn" id="kcex-settings-btn" title="Settings">&#9881;</button>
                    <span class="kcex-toggle" id="kcex-toggle-icon" title="Collapse">−</span>
                </div>
            </div>

            <div class="kcex-settings" id="kcex-settings">
                <div class="kcex-settings-title">Default Settings</div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Default Risk ($)</span>
                    <input type="number" class="kcex-settings-input" id="kcex-set-risk" value="${CONFIG.riskAmount}" step="0.1" min="0.1">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Default Leverage</span>
                    <input type="number" class="kcex-settings-input" id="kcex-set-leverage" value="${CONFIG.leverage}" step="1" min="1" max="125">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Auto-update Entry</span>
                    <input type="checkbox" class="kcex-settings-checkbox" id="kcex-set-auto-entry" ${CONFIG.autoUpdateEntry ? 'checked' : ''}>
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Live Entry on Confirm</span>
                    <input type="checkbox" class="kcex-settings-checkbox" id="kcex-set-update-on-confirm" ${CONFIG.updateEntryOnConfirm ? 'checked' : ''} title="Continuously update entry price while confirmation modal is open">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Auto-Retry Unfilled</span>
                    <input type="checkbox" class="kcex-settings-checkbox" id="kcex-set-auto-retry" ${CONFIG.autoRetryUnfilled ? 'checked' : ''} title="Automatically retry unfilled orders with new entry price">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Auto-Adjust Leverage</span>
                    <input type="checkbox" class="kcex-settings-checkbox" id="kcex-set-auto-leverage" ${CONFIG.autoAdjustLeverage ? 'checked' : ''} title="Auto-increase leverage if balance is insufficient (when liquidation-safe)">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Debug Logging</span>
                    <input type="checkbox" class="kcex-settings-checkbox" id="kcex-set-debug" ${CONFIG.debugLogging ? 'checked' : ''} title="Enable console logging (disable for better performance)">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Liq. Warning ($)</span>
                    <input type="number" class="kcex-settings-input" id="kcex-set-liq-warn" value="${CONFIG.liqWarningDistance}" step="10" min="0">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Liq. Danger ($)</span>
                    <input type="number" class="kcex-settings-input" id="kcex-set-liq-danger" value="${CONFIG.liqDangerDistance}" step="1" min="0">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Maint. Margin %</span>
                    <input type="number" class="kcex-settings-input" id="kcex-set-mmr" value="${(CONFIG.maintenanceMarginRate * 100).toFixed(2)}" step="0.01" min="0" max="5">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Max PNL Deviation %</span>
                    <input type="number" class="kcex-settings-input" id="kcex-set-pnl-tolerance" value="${(CONFIG.pnlTolerance * 100).toFixed(0)}" step="1" min="1" max="50" title="Maximum allowed deviation from target risk">
                </div>
                <div class="kcex-settings-title" style="margin-top: 15px;">Google Sheets</div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Webhook URL</span>
                    <input type="text" class="kcex-settings-input" id="kcex-set-sheets-url" value="${CONFIG.googleSheetsUrl || ''}" placeholder="https://script.google.com/..." style="width: 140px; font-size: 9px;">
                </div>
                <div class="kcex-settings-title" style="margin-top: 15px;">Clipboard Copy</div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Copy Sheet Row</span>
                    <input type="checkbox" class="kcex-settings-checkbox" id="kcex-set-clipboard" ${CONFIG.copyTradeToClipboard ? 'checked' : ''} title="Copy trade data as tab-separated values for pasting into spreadsheets">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Copy Report</span>
                    <input type="checkbox" class="kcex-settings-checkbox" id="kcex-set-clipboard-report" ${CONFIG.copyReportToClipboard ? 'checked' : ''} title="Copy human-readable trade report to clipboard">
                </div>
                <div class="kcex-settings-row">
                    <span class="kcex-settings-label">Screenshot on Fill</span>
                    <input type="checkbox" class="kcex-settings-checkbox" id="kcex-set-screenshot" ${CONFIG.chartScreenshotOnEntry ? 'checked' : ''} title="Capture KCEX page screenshot when position fills">
                </div>
                <button class="kcex-settings-save" id="kcex-settings-save">Save Settings</button>
            </div>

            <div class="kcex-body">
                <div class="kcex-price-box">
                    <div class="kcex-price-label">LIVE PRICE</div>
                    <div class="kcex-price" id="kcex-live-price">--</div>
                </div>

                <div class="kcex-config">
                    <div class="kcex-config-item">
                        <span class="kcex-config-label">PNL Risk $</span>
                        <input type="number" class="kcex-config-input" id="kcex-risk" value="${CONFIG.riskAmount}" step="0.1" min="0.1">
                    </div>
                    <div class="kcex-config-item">
                        <span class="kcex-config-label">Leverage</span>
                        <input type="number" class="kcex-config-input" id="kcex-leverage" value="${CONFIG.leverage}" step="1" min="1" max="125">
                    </div>
                </div>

                <div class="kcex-input-group">
                    <label>
                        <span>Entry Price</span>
                        <span class="kcex-auto-toggle">
                            <input type="checkbox" id="kcex-auto-entry" checked>
                            <span>Auto</span>
                        </span>
                    </label>
                    <input type="number" id="kcex-entry" placeholder="Auto-updating...">
                </div>

                <div class="kcex-input-group">
                    <label>Stop Loss</label>
                    <input type="number" id="kcex-sl" placeholder="Required">
                </div>

                <div class="kcex-input-group">
                    <label>Take Profit (optional)</label>
                    <input type="number" id="kcex-tp" placeholder="Optional">
                </div>

                <div class="kcex-calc">
                    <div class="kcex-calc-row">
                        <span class="kcex-calc-label">Direction</span>
                        <span class="kcex-calc-value" id="kcex-calc-dir">--</span>
                    </div>
                    <div class="kcex-calc-row">
                        <span class="kcex-calc-label">Quantity</span>
                        <span class="kcex-calc-value" id="kcex-calc-qty">--</span>
                    </div>
                    <div class="kcex-calc-row">
                        <span class="kcex-calc-label">Risk (PNL at SL)</span>
                        <span class="kcex-calc-value danger" id="kcex-calc-pnl">--</span>
                    </div>
                    <div class="kcex-calc-row">
                        <span class="kcex-calc-label">Margin</span>
                        <span class="kcex-calc-value" id="kcex-calc-margin">--</span>
                    </div>
                    <div class="kcex-calc-row">
                        <span class="kcex-calc-label">Est. Liquidation</span>
                        <span class="kcex-calc-value" id="kcex-calc-liq">--</span>
                    </div>
                </div>

                <div class="kcex-warning" id="kcex-warning"></div>

                <div class="kcex-buttons">
                    <button class="kcex-btn long" id="kcex-btn-long" disabled>LONG</button>
                    <button class="kcex-btn short" id="kcex-btn-short" disabled>SHORT</button>
                </div>

                <div class="kcex-status" id="kcex-status-text"></div>

                <div class="kcex-history">
                    <div class="kcex-history-header" id="kcex-history-header">
                        <div>
                            <span class="kcex-history-title">Trade History</span>
                            <span class="kcex-history-count" id="kcex-history-count">0</span>
                        </div>
                        <span class="kcex-history-toggle" id="kcex-history-toggle">▼</span>
                    </div>
                    <div class="kcex-history-list" id="kcex-history-list"></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        applyPanelPosition();
        setupEventListeners();
        startPriceUpdates();
        renderHistory();
    }

    function setupEventListeners() {
        const panel = document.getElementById('kcex-assistant');
        const header = document.getElementById('kcex-header');

        // Dragging functionality
        header.addEventListener('mousedown', (e) => {
            // Don't start drag if clicking on buttons
            if (e.target.closest('.kcex-header-btn') || e.target.closest('.kcex-toggle')) return;

            state.isDragging = true;
            const rect = panel.getBoundingClientRect();
            state.dragOffset.x = e.clientX - rect.left;
            state.dragOffset.y = e.clientY - rect.top;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!state.isDragging) return;

            const newX = e.clientX - state.dragOffset.x;
            const newY = e.clientY - state.dragOffset.y;

            // Keep panel within viewport
            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;

            panel.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
            panel.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
            panel.style.right = 'auto'; // Remove right positioning when dragging

            state.panelPosition.x = panel.style.left;
            state.panelPosition.y = panel.style.top;
        });

        document.addEventListener('mouseup', () => {
            if (state.isDragging) {
                state.isDragging = false;
                header.style.cursor = 'grab';
                savePanelPosition();
            }
        });

        // Toggle collapse function
        function toggleCollapse() {
            const icon = document.getElementById('kcex-toggle-icon');
            const settingsBtn = document.getElementById('kcex-settings-btn');
            panel.classList.toggle('collapsed');
            const isCollapsed = panel.classList.contains('collapsed');
            icon.textContent = isCollapsed ? '+' : '−';
            // Hide settings gear when collapsed
            settingsBtn.style.display = isCollapsed ? 'none' : 'flex';
            // Also close settings panel if open
            if (isCollapsed) {
                document.getElementById('kcex-settings').classList.remove('visible');
            }
        }

        // Toggle collapse on clicking the toggle icon
        document.getElementById('kcex-toggle-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCollapse();
        });

        // Also toggle on double-click anywhere on header
        header.addEventListener('dblclick', (e) => {
            if (!e.target.closest('.kcex-header-btn')) {
                toggleCollapse();
            }
        });

        // Settings toggle
        document.getElementById('kcex-settings-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const settings = document.getElementById('kcex-settings');
            settings.classList.toggle('visible');
        });

        // Save settings
        document.getElementById('kcex-settings-save').addEventListener('click', () => {
            CONFIG.riskAmount = parseFloat(document.getElementById('kcex-set-risk').value) || DEFAULT_CONFIG.riskAmount;
            CONFIG.leverage = parseInt(document.getElementById('kcex-set-leverage').value) || DEFAULT_CONFIG.leverage;
            CONFIG.autoUpdateEntry = document.getElementById('kcex-set-auto-entry').checked;
            CONFIG.updateEntryOnConfirm = document.getElementById('kcex-set-update-on-confirm').checked;
            CONFIG.autoRetryUnfilled = document.getElementById('kcex-set-auto-retry').checked;
            CONFIG.autoAdjustLeverage = document.getElementById('kcex-set-auto-leverage').checked;
            CONFIG.debugLogging = document.getElementById('kcex-set-debug').checked;
            CONFIG.liqWarningDistance = parseFloat(document.getElementById('kcex-set-liq-warn').value) || DEFAULT_CONFIG.liqWarningDistance;
            CONFIG.liqDangerDistance = parseFloat(document.getElementById('kcex-set-liq-danger').value) || DEFAULT_CONFIG.liqDangerDistance;
            // MMR is entered as percentage (e.g., 0.4) but stored as decimal (e.g., 0.004)
            const mmrPercent = parseFloat(document.getElementById('kcex-set-mmr').value) || 0.4;
            CONFIG.maintenanceMarginRate = mmrPercent / 100;

            // PNL tolerance is entered as percentage (e.g., 10) but stored as decimal (e.g., 0.10)
            const pnlTolerancePercent = parseFloat(document.getElementById('kcex-set-pnl-tolerance').value) || 10;
            CONFIG.pnlTolerance = pnlTolerancePercent / 100;

            // Google Sheets settings
            CONFIG.googleSheetsUrl = document.getElementById('kcex-set-sheets-url').value.trim();
            CONFIG.copyTradeToClipboard = document.getElementById('kcex-set-clipboard').checked;
            CONFIG.copyReportToClipboard = document.getElementById('kcex-set-clipboard-report').checked;
            CONFIG.chartScreenshotOnEntry = document.getElementById('kcex-set-screenshot').checked;

            saveSettings(CONFIG);

            // Update current state with new defaults
            state.riskAmount = CONFIG.riskAmount;
            state.leverage = CONFIG.leverage;
            document.getElementById('kcex-risk').value = CONFIG.riskAmount;
            document.getElementById('kcex-leverage').value = CONFIG.leverage;

            // Update auto-entry checkbox
            state.autoUpdateEntry = CONFIG.autoUpdateEntry;
            document.getElementById('kcex-auto-entry').checked = CONFIG.autoUpdateEntry;
            document.getElementById('kcex-entry').disabled = CONFIG.autoUpdateEntry;

            recalculate();

            // Close settings panel
            document.getElementById('kcex-settings').classList.remove('visible');
            showNotification('Settings saved!', 'success');
        });

        // Risk input
        document.getElementById('kcex-risk').addEventListener('change', (e) => {
            state.riskAmount = parseFloat(e.target.value) || CONFIG.riskAmount;
            recalculate();
        });

        // Leverage input
        document.getElementById('kcex-leverage').addEventListener('change', (e) => {
            state.leverage = parseInt(e.target.value) || CONFIG.leverage;
            recalculate();
        });

        // Auto entry toggle
        document.getElementById('kcex-auto-entry').addEventListener('change', (e) => {
            state.autoUpdateEntry = e.target.checked;
            document.getElementById('kcex-entry').disabled = e.target.checked;
            if (e.target.checked) {
                state.entryPrice = state.currentPrice;
                document.getElementById('kcex-entry').value = state.currentPrice || '';
            }
            recalculate();
        });

        // Entry input (manual)
        document.getElementById('kcex-entry').addEventListener('input', (e) => {
            if (!state.autoUpdateEntry) {
                state.entryPrice = parseFloat(e.target.value) || 0;
                recalculate();
            }
        });

        // Stop loss input
        document.getElementById('kcex-sl').addEventListener('input', (e) => {
            state.stopLoss = parseFloat(e.target.value) || 0;
            recalculate();
        });

        // Take profit input
        document.getElementById('kcex-tp').addEventListener('input', (e) => {
            state.takeProfit = parseFloat(e.target.value) || 0;
        });

        // Trade buttons
        document.getElementById('kcex-btn-long').addEventListener('click', () => {
            if (state.direction === 'long') {
                showConfirmation('long');
            }
        });

        document.getElementById('kcex-btn-short').addEventListener('click', () => {
            if (state.direction === 'short') {
                showConfirmation('short');
            }
        });

        // Initial state
        document.getElementById('kcex-entry').disabled = true;

        // History toggle
        document.getElementById('kcex-history-header').addEventListener('click', () => {
            const list = document.getElementById('kcex-history-list');
            const toggle = document.getElementById('kcex-history-toggle');
            list.classList.toggle('collapsed');
            toggle.textContent = list.classList.contains('collapsed') ? '▶' : '▼';
        });
    }

    function startPriceUpdates() {
        updatePrice();
        state.priceUpdateInterval = setInterval(updatePrice, CONFIG.updateInterval);
    }

    function updatePrice() {
        const price = getLastPrice();
        if (price > 0) {
            state.currentPrice = price;
            document.getElementById('kcex-live-price').textContent = formatPrice(price);

            if (state.autoUpdateEntry) {
                state.entryPrice = price;
                document.getElementById('kcex-entry').value = price;
                recalculate();
            }
        }
    }

    function recalculate() {
        const { entryPrice, stopLoss, riskAmount, leverage } = state;

        // Auto-detect direction
        const direction = detectDirection(entryPrice, stopLoss);
        state.direction = direction;

        // Calculate quantity
        const quantity = calculateQuantity(entryPrice, stopLoss, riskAmount);
        state.quantity = quantity;

        // Calculate PNL
        const pnl = calculatePNL(entryPrice, stopLoss, quantity);
        state.estimatedPNL = pnl;

        // Calculate margin
        const margin = quantity / leverage;

        // Calculate liquidation price ourselves (more accurate, works before filling KCEX form)
        const calculatedLiq = calculateLiquidationPrice(entryPrice, leverage, direction);
        state.liquidationPrice = calculatedLiq;

        // Validate
        const liqCheck = validateLiquidation(direction, stopLoss, calculatedLiq);

        // Update UI
        const dirEl = document.getElementById('kcex-calc-dir');
        dirEl.textContent = direction ? direction.toUpperCase() : '--';
        dirEl.className = `kcex-calc-value ${direction || ''}`;

        document.getElementById('kcex-calc-qty').textContent = quantity > 0 ? `${quantity} USDT` : '--';
        document.getElementById('kcex-calc-pnl').textContent = pnl > 0 ? `-$${formatUSDT(pnl)}` : '--';
        document.getElementById('kcex-calc-margin').textContent = margin > 0 ? `$${formatUSDT(margin)}` : '--';
        document.getElementById('kcex-calc-liq').textContent = calculatedLiq > 0 ? formatPrice(calculatedLiq) : '--';

        // Check minimum order size
        const minOrderSize = getMinOrderSize();
        const belowMinimum = quantity > 0 && quantity < minOrderSize;

        // Calculate safe leverage for display
        const safeLev = calculateSafeLeverage(entryPrice, stopLoss);

        // Warning (liquidation takes priority, then minimum order)
        const warningEl = document.getElementById('kcex-warning');
        if (!liqCheck.valid) {
            warningEl.textContent = `${liqCheck.warning} (Will auto-adjust to ${safeLev}x)`;
            warningEl.classList.add('visible');
        } else if (belowMinimum) {
            warningEl.textContent = `Qty ${quantity} below min ${minOrderSize} USDT! Increase risk or lower leverage.`;
            warningEl.classList.add('visible');
        } else {
            warningEl.classList.remove('visible');
        }

        // Enable/disable buttons
        // Allow trade even if liqCheck fails - we'll auto-adjust leverage
        // Only block if no direction or no quantity
        const canTrade = quantity > 0 && direction && !state.isExecuting;
        document.getElementById('kcex-btn-long').disabled = !canTrade || direction !== 'long';
        document.getElementById('kcex-btn-short').disabled = !canTrade || direction !== 'short';
    }

    // Helper to format price differences in shorthand (3K instead of $3000)
    function formatPriceDiff(diff, showSign = false) {
        const absDiff = Math.abs(diff);
        let result;
        if (absDiff >= 1000) {
            const k = absDiff / 1000;
            // Round to 1 decimal if needed, otherwise show whole number
            result = k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
        } else if (absDiff >= 100) {
            result = `${Math.round(absDiff / 10) * 10}`;
        } else {
            result = `${Math.round(absDiff)}`;
        }
        if (showSign && diff !== 0) {
            return diff < 0 ? `-${result}` : `+${result}`;
        }
        return result;
    }

    function showConfirmation(dir) {
        const { entryPrice, stopLoss, takeProfit, quantity, estimatedPNL, leverage, liquidationPrice } = state;

        // Remove any existing modal
        const existingModal = document.getElementById('kcex-confirm-modal');
        if (existingModal) existingModal.remove();

        // Calculate liquidation safety with NEW thresholds
        const liqDistance = Math.abs(liquidationPrice - stopLoss);
        const isLiqDanger = liqDistance < CONFIG.liqDangerDistance; // < $100 = DANGER
        const isLiqWarning = liqDistance >= CONFIG.liqDangerDistance && liqDistance < CONFIG.liqWarningDistance; // $100-$300 = WARNING
        const isLiqSafe = liqDistance >= CONFIG.liqWarningDistance; // >= $300 = SAFE

        // Check if SL would be hit AFTER liquidation (very bad!)
        const slPastLiq = (dir === 'long' && stopLoss <= liquidationPrice) ||
                         (dir === 'short' && stopLoss >= liquidationPrice);

        // Calculate safe leverage for the "Adjust Leverage" button
        const safeLeverage = calculateSafeLeverage(entryPrice, stopLoss);

        // Calculate Target R (Risk:Reward ratio) - how many R you get if TP is hit
        const slDistance = Math.abs(entryPrice - stopLoss);
        const tpDistance = takeProfit > 0 ? Math.abs(takeProfit - entryPrice) : 0;
        const targetR = slDistance > 0 && takeProfit > 0 ? (tpDistance / slDistance) : 0;

        // Build price list sorted by value (highest to lowest)
        const priceItems = [
            { label: 'Entry', price: entryPrice, type: 'entry' },
            { label: 'Stop Loss', price: stopLoss, type: 'sl' },
            { label: 'Liquidation', price: liquidationPrice, type: 'liq' }
        ];
        if (takeProfit > 0) {
            priceItems.push({ label: 'Take Profit', price: takeProfit, type: 'tp' });
        }

        // Sort by price descending (highest first)
        priceItems.sort((a, b) => b.price - a.price);

        // Check if order is correct for direction
        let priceOrderError = null;
        if (dir === 'long') {
            if (takeProfit > 0 && takeProfit <= entryPrice) priceOrderError = 'TP should be ABOVE Entry for LONG!';
            if (stopLoss >= entryPrice) priceOrderError = 'SL should be BELOW Entry for LONG!';
        } else {
            if (takeProfit > 0 && takeProfit >= entryPrice) priceOrderError = 'TP should be BELOW Entry for SHORT!';
            if (stopLoss <= entryPrice) priceOrderError = 'SL should be ABOVE Entry for SHORT!';
        }

        // Calculate differences between consecutive prices
        const diffs = [];
        for (let i = 0; i < priceItems.length - 1; i++) {
            diffs.push(priceItems[i].price - priceItems[i + 1].price);
        }

        // Arrow direction: SHORT = going down (↓), LONG = going up (↑)
        const arrowDir = dir === 'short' ? '↓' : '↑';

        // Liq row class
        const liqRowClass = slPastLiq ? 'danger' : isLiqDanger ? 'danger' : isLiqWarning ? 'warning' : '';

        // Build price rows HTML with diffs on the right side
        let priceRowsHTML = '';
        for (let i = 0; i < priceItems.length; i++) {
            const item = priceItems[i];
            const isLiqRow = item.type === 'liq';
            const rowClass = isLiqRow && liqRowClass ? `price-row ${liqRowClass}` : 'price-row';

            // Format diff for this row (diff to next price)
            let diffText = '';
            if (i < diffs.length) {
                const diffVal = dir === 'short' ? -diffs[i] : diffs[i];
                diffText = formatPriceDiff(diffVal, true);
            }

            priceRowsHTML += `
                <div class="kcex-modal-row ${rowClass}">
                    <span class="kcex-modal-label">${item.label}</span>
                    <span class="kcex-modal-value ${item.type}">${formatPrice(item.price)}</span>
                    <span class="kcex-price-diff ${diffText ? '' : 'empty'}">${diffText}</span>
                </div>
            `;
        }

        // Create custom modal
        const overlay = document.createElement('div');
        overlay.id = 'kcex-confirm-modal';
        overlay.className = 'kcex-modal-overlay';
        overlay.innerHTML = `
            <div class="kcex-modal">
                <div class="kcex-modal-title ${dir}">
                    CONFIRM ${dir.toUpperCase()}
                </div>

                <div class="kcex-modal-main">
                    ${priceOrderError ? `
                    <div class="kcex-modal-warning danger" style="margin-bottom: 10px;">
                        <strong>⚠️ WRONG ORDER:</strong> ${priceOrderError}
                    </div>
                    ` : ''}

                    <!-- Price Ladder with arrow on right side -->
                    <div class="kcex-price-ladder-wrapper">
                        <div class="kcex-price-ladder">
                            ${priceRowsHTML}
                        </div>
                        <div class="kcex-direction-arrow ${dir}">
                            <span>${arrowDir}</span>
                        </div>
                    </div>

                    <!-- Liquidation Distance -->
                    <div class="kcex-modal-row liq-distance ${liqRowClass}">
                        <span class="kcex-modal-label">SL to Liq Distance</span>
                        <span class="kcex-modal-value">${formatPriceDiff(liqDistance)} ${isLiqSafe ? '✓' : isLiqWarning ? '⚠' : '❌'}</span>
                    </div>

                    ${slPastLiq ? `
                    <div class="kcex-modal-warning danger">
                        <strong>❌ DANGER:</strong> Liquidation BEFORE SL!
                    </div>
                    ` : ''}

                    ${!slPastLiq && isLiqDanger ? `
                    <div class="kcex-modal-warning danger">
                        <strong>⚠️ DANGER:</strong> Only ${formatPriceDiff(liqDistance)} to liquidation!
                    </div>
                    ` : ''}

                    ${isLiqWarning ? `
                    <div class="kcex-modal-warning warning">
                        <strong>Warning:</strong> ${formatPriceDiff(liqDistance)} to liquidation
                    </div>
                    ` : ''}

                    <div class="kcex-modal-divider"></div>

                    <!-- Secondary info -->
                    <div class="kcex-modal-row secondary">
                        <span class="kcex-modal-label">Quantity</span>
                        <span class="kcex-modal-value">${quantity} USDT</span>
                    </div>
                    <div class="kcex-modal-row secondary">
                        <span class="kcex-modal-label">Margin</span>
                        <span class="kcex-modal-value">$${formatUSDT(quantity / leverage)}</span>
                    </div>
                    <div class="kcex-modal-row secondary">
                        <span class="kcex-modal-label">Leverage</span>
                        <span class="kcex-modal-value">${leverage}x</span>
                    </div>
                    <div class="kcex-modal-row secondary">
                        <span class="kcex-modal-label">Est. Risk</span>
                        <span class="kcex-modal-value">-$${estimatedPNL.toFixed(2)}</span>
                    </div>
                    ${targetR > 0 ? `
                    <div class="kcex-modal-row secondary target-r">
                        <span class="kcex-modal-label">Target R</span>
                        <span class="kcex-modal-value highlight">${targetR.toFixed(2)}R</span>
                    </div>
                    ` : ''}
                </div>

                ${(slPastLiq || isLiqDanger) ? `
                <div class="kcex-danger-options">
                    <div class="kcex-danger-option">
                        <button class="kcex-modal-btn adjust-leverage" id="kcex-adjust-leverage">
                            Auto-Adjust to ${safeLeverage}x
                        </button>
                        <span class="option-desc">Safer leverage for this SL</span>
                    </div>
                    <div class="kcex-danger-divider">OR</div>
                    <div class="kcex-danger-confirm">
                        <label>
                            <input type="checkbox" id="kcex-danger-checkbox">
                            <span>I understand the risk and want to proceed anyway</span>
                        </label>
                    </div>
                </div>
                ` : ''}

                <div class="kcex-entry-update-option">
                    <label>
                        <input type="checkbox" id="kcex-update-entry-checkbox" ${CONFIG.updateEntryOnConfirm ? 'checked' : ''}>
                        <span>Update entry to latest price on confirm</span>
                    </label>
                </div>

                <div class="kcex-modal-buttons">
                    <button class="kcex-modal-btn cancel" id="kcex-modal-cancel">Cancel</button>
                    <button class="kcex-modal-btn confirm-${dir}" id="kcex-modal-confirm" ${(slPastLiq || isLiqDanger) ? 'disabled' : ''}>${dir.toUpperCase()}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // If danger zone, set up the options
        if (slPastLiq || isLiqDanger) {
            const checkbox = document.getElementById('kcex-danger-checkbox');
            const confirmBtn = document.getElementById('kcex-modal-confirm');
            const adjustLeverageBtn = document.getElementById('kcex-adjust-leverage');

            // Checkbox enables confirm button
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    confirmBtn.disabled = !checkbox.checked;
                });
            }

            // Auto-adjust leverage button
            if (adjustLeverageBtn) {
                adjustLeverageBtn.addEventListener('click', async () => {
                    overlay.remove();
                    // Update leverage in state and UI
                    state.leverage = safeLeverage;
                    document.getElementById('kcex-leverage').value = safeLeverage;
                    // Change leverage on KCEX
                    showNotification(`Adjusting leverage to ${safeLeverage}x...`, 'info');
                    await changeLeverageOnKCEX(safeLeverage);
                    recalculate();
                    showNotification(`Leverage adjusted to ${safeLeverage}x. Please click the trade button again.`, 'success');
                });
            }
        }

        // Continuous price update interval (when checkbox is checked)
        let priceUpdateInterval = null;

        function stopPriceUpdates() {
            if (priceUpdateInterval) {
                clearInterval(priceUpdateInterval);
                priceUpdateInterval = null;
            }
        }

        // Event listeners
        document.getElementById('kcex-modal-cancel').addEventListener('click', () => {
            stopPriceUpdates();
            overlay.remove();
        });

        function startPriceUpdates() {
            if (priceUpdateInterval) return; // Already running

            priceUpdateInterval = setInterval(() => {
                const latestPrice = getLastPrice();
                if (!latestPrice) return;

                // Update state and UI
                state.entryPrice = latestPrice;
                document.getElementById('kcex-entry').value = latestPrice;

                // Update the modal display
                const entryEl = overlay.querySelector('.kcex-modal-value.entry');
                if (entryEl) {
                    entryEl.textContent = formatPrice(latestPrice);
                }

                // Recalculate liquidation with new entry
                const newLiqPrice = calculateLiquidationPrice(latestPrice, state.leverage, dir);
                const liqEl = overlay.querySelector('.kcex-modal-value.liq');
                if (liqEl && newLiqPrice) {
                    liqEl.textContent = formatPrice(newLiqPrice);
                }

                // Update SL to Liq distance
                const slToLiqDistance = Math.abs(stopLoss - newLiqPrice);
                const liqDistEl = overlay.querySelector('.kcex-modal-row.liq-distance .kcex-modal-value');
                if (liqDistEl) {
                    const isLiqSafe = slToLiqDistance >= CONFIG.liqWarningDistance;
                    const isLiqWarning = slToLiqDistance >= CONFIG.liqDangerDistance && slToLiqDistance < CONFIG.liqWarningDistance;
                    liqDistEl.textContent = formatPriceDiff(slToLiqDistance) + ' ' + (isLiqSafe ? '✓' : isLiqWarning ? '⚠' : '❌');
                }
            }, 200); // Update every 200ms
        }

        // Handle checkbox change - start/stop continuous updates
        const updateEntryCheckbox = document.getElementById('kcex-update-entry-checkbox');
        if (updateEntryCheckbox) {
            updateEntryCheckbox.addEventListener('change', () => {
                CONFIG.updateEntryOnConfirm = updateEntryCheckbox.checked;
                saveSettings(CONFIG);

                if (updateEntryCheckbox.checked) {
                    startPriceUpdates();
                } else {
                    stopPriceUpdates();
                }
            });

            // Start updates if already checked
            if (updateEntryCheckbox.checked) {
                startPriceUpdates();
            }
        }

        document.getElementById('kcex-modal-confirm').addEventListener('click', () => {
            stopPriceUpdates(); // Stop the interval

            // Get final latest price if option is enabled
            if (CONFIG.updateEntryOnConfirm) {
                const latestPrice = getLastPrice();
                if (latestPrice) {
                    state.entryPrice = latestPrice;
                    document.getElementById('kcex-entry').value = latestPrice;
                    log('[Confirm] Final entry price: ' + latestPrice);
                }
            }

            overlay.remove();
            executeTrade(dir);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                stopPriceUpdates();
                overlay.remove();
            }
        });

        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                stopPriceUpdates();
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function showNotification(message, type = 'info') {
        const colors = { success: '#00c853', error: '#ff4444', info: '#00d4ff', warning: '#ff9500' };
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[type]};
            color: #fff;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 100000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        notif.textContent = message;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    // ============================================
    // RETRY UNFILLED ORDER MODAL
    // ============================================
    // Shows when a limit order doesn't fill within the timeout period
    // Offers to cancel old order and place new one with current price

    function showRetryUnfilledModal(dir, originalEntry, stopLoss, takeProfit, quantity, leverage) {
        return new Promise((resolve) => {
            // Get current price
            const currentPrice = getLastPrice();
            if (!currentPrice) {
                resolve({ retry: false, cancelled: false });
                return;
            }

            // Calculate new target R with current price
            const slDistance = Math.abs(currentPrice - stopLoss);
            const tpDistance = takeProfit > 0 ? Math.abs(takeProfit - currentPrice) : 0;
            const targetR = slDistance > 0 && takeProfit > 0 ? (tpDistance / slDistance) : 0;

            // Calculate new liquidation price
            const newLiqPrice = calculateLiquidationPrice(currentPrice, leverage, dir);
            const liqDistance = Math.abs(newLiqPrice - stopLoss);

            // Remove any existing modal
            const existingModal = document.getElementById('kcex-retry-modal');
            if (existingModal) existingModal.remove();

            const overlay = document.createElement('div');
            overlay.id = 'kcex-retry-modal';
            overlay.className = 'kcex-modal-overlay';
            overlay.innerHTML = `
                <div class="kcex-modal" style="max-width: 380px;">
                    <div class="kcex-modal-title warning">
                        ORDER NOT FILLED
                    </div>

                    <div class="kcex-modal-main">
                        <div class="kcex-modal-warning warning" style="margin-bottom: 12px;">
                            Your limit order at <strong>${formatPrice(originalEntry)}</strong> did not fill within 30 seconds.
                        </div>

                        <div class="kcex-modal-divider"></div>

                        <div class="kcex-retry-section">
                            <div class="kcex-retry-header">Edit order with new entry?</div>
                            <div class="kcex-modal-row">
                                <span class="kcex-modal-label">New Entry</span>
                                <span class="kcex-modal-value entry">${formatPrice(currentPrice)}</span>
                            </div>
                            <div class="kcex-modal-row">
                                <span class="kcex-modal-label">Stop Loss</span>
                                <span class="kcex-modal-value sl">${formatPrice(stopLoss)}</span>
                            </div>
                            ${takeProfit > 0 ? `
                            <div class="kcex-modal-row">
                                <span class="kcex-modal-label">Take Profit</span>
                                <span class="kcex-modal-value tp">${formatPrice(takeProfit)}</span>
                            </div>
                            ` : ''}
                            <div class="kcex-modal-row">
                                <span class="kcex-modal-label">Liquidation</span>
                                <span class="kcex-modal-value liq">${formatPrice(newLiqPrice)}</span>
                            </div>

                            <div class="kcex-modal-divider"></div>

                            <div class="kcex-modal-row secondary">
                                <span class="kcex-modal-label">Quantity</span>
                                <span class="kcex-modal-value">${quantity} USDT</span>
                            </div>
                            <div class="kcex-modal-row secondary">
                                <span class="kcex-modal-label">SL to Liq</span>
                                <span class="kcex-modal-value">${formatPriceDiff(liqDistance)}</span>
                            </div>
                            ${targetR > 0 ? `
                            <div class="kcex-modal-row secondary target-r">
                                <span class="kcex-modal-label">Target R</span>
                                <span class="kcex-modal-value highlight">${targetR.toFixed(2)}R</span>
                            </div>
                            ` : ''}
                        </div>

                        <div class="kcex-retry-note">
                            <small>This will edit the pending order's entry price to the current price.</small>
                        </div>

                        <div class="kcex-entry-update-option">
                            <label>
                                <input type="checkbox" id="kcex-auto-retry-checkbox" ${CONFIG.autoRetryUnfilled ? 'checked' : ''}>
                                <span>Auto-retry unfilled orders (don't ask again)</span>
                            </label>
                        </div>
                    </div>

                    <div class="kcex-modal-buttons">
                        <button class="kcex-modal-btn cancel" id="kcex-retry-cancel">Cancel</button>
                        <button class="kcex-modal-btn confirm-${dir}" id="kcex-retry-confirm">Edit ${dir.toUpperCase()}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Live price update interval
            let priceUpdateInterval = setInterval(() => {
                const latestPrice = getLastPrice();
                if (!latestPrice) return;

                // Update entry display
                const entryEl = overlay.querySelector('.kcex-modal-value.entry');
                if (entryEl) entryEl.textContent = formatPrice(latestPrice);

                // Recalculate liq
                const newLiq = calculateLiquidationPrice(latestPrice, leverage, dir);
                const liqEl = overlay.querySelector('.kcex-modal-value.liq');
                if (liqEl) liqEl.textContent = formatPrice(newLiq);

                // Update target R
                const newSlDist = Math.abs(latestPrice - stopLoss);
                const newTpDist = takeProfit > 0 ? Math.abs(takeProfit - latestPrice) : 0;
                const newTargetR = newSlDist > 0 && takeProfit > 0 ? (newTpDist / newSlDist) : 0;
                const targetREl = overlay.querySelector('.kcex-modal-row.target-r .kcex-modal-value');
                if (targetREl && newTargetR > 0) {
                    targetREl.textContent = newTargetR.toFixed(2) + 'R';
                }
            }, 200);

            function cleanup() {
                clearInterval(priceUpdateInterval);
                overlay.remove();
            }

            // Handle auto-retry checkbox
            const autoRetryCheckbox = document.getElementById('kcex-auto-retry-checkbox');
            if (autoRetryCheckbox) {
                autoRetryCheckbox.addEventListener('change', () => {
                    CONFIG.autoRetryUnfilled = autoRetryCheckbox.checked;
                    saveSettings(CONFIG);
                });
            }

            // Cancel button
            document.getElementById('kcex-retry-cancel').addEventListener('click', () => {
                cleanup();
                resolve({ retry: false, cancelled: false });
            });

            // Retry button
            document.getElementById('kcex-retry-confirm').addEventListener('click', () => {
                const latestPrice = getLastPrice();
                cleanup();
                resolve({ retry: true, newEntry: latestPrice });
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve({ retry: false, cancelled: false });
                }
            });

            // Close on Escape
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', escHandler);
                    resolve({ retry: false, cancelled: false });
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    // Edit an unfilled order to update entry price AND quantity to maintain risk
    // Returns: 'edited' | 'partially_filled' | 'filled' | 'not_found' | 'cancelled'
    // newEntryPrice: the new entry price to set
    // originalEntry: original entry price (for risk calculation)
    // stopLoss: stop loss price (for risk calculation)
    // riskAmount: target risk in USDT (for recalculating quantity)
    async function editUnfilledOrder(newEntryPrice, originalEntry = null, stopLoss = null, riskAmount = null) {
        log('>>> Editing unfilled order to new entry: ' + newEntryPrice);

        // Calculate new quantity if we have the necessary data
        let newQuantity = null;
        if (originalEntry && stopLoss && riskAmount) {
            const newSLDistance = Math.abs(newEntryPrice - stopLoss);
            if (newSLDistance > 0) {
                // Recalculate quantity with 90% safety factor (aim 10% under target)
                const safetyFactor = 0.90;
                const adjustedRisk = riskAmount * safetyFactor;
                newQuantity = Math.round((adjustedRisk * newEntryPrice) / newSLDistance);
                log('    Recalculating quantity to maintain $' + riskAmount + ' risk (aiming for $' + adjustedRisk.toFixed(2) + '):');
                log('    New SL distance: $' + newSLDistance.toFixed(2));
                log('    New quantity: ' + newQuantity + ' USDT');
            }
        }

        // Step 0: Aggressively scroll to the bottom of the page to ensure Open Orders section renders
        // This is critical - the DOM won't render elements that aren't in the viewport
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(400);
        log('    Scrolled to bottom of page');

        // Step 0b: Try to find and scroll to the Open Orders section specifically
        const openOrdersSection = document.querySelector('#kcex-web-inspection-futures-exchange-current-entrust, [class*="recordWrapper"], [class*="nowEntrustTabBox"], [class*="currentEntrust"]');
        if (openOrdersSection) {
            openOrdersSection.scrollIntoView({ behavior: 'instant', block: 'center' });
            await sleep(400);
            log('    Scrolled to Open Orders section');
        } else {
            // Fallback: scroll by a large amount from top
            window.scrollTo(0, 800);
            await sleep(400);
            log('    Scrolled down 800px (Open Orders section not found by selector)');
        }

        // Step 1: Click on Open Order tab first (the main tab)
        // The actual KCEX HTML uses ant-tabs structure:
        // <div class="ant-tabs-tab"><div class="ant-tabs-tab-btn"><span>Open Order (2)</span></div></div>
        let openOrderTabClicked = false;
        const mainTabSelectors = [
            '.ant-tabs-tab-btn',           // Primary: Ant Design tab buttons
            '.ant-tabs-tab span',          // Span inside tab
            '[role="tab"]',                // ARIA role
            '.ListNav_tabs__wFKi8 span',   // Legacy selector
            '[class*="ListNav"] span',     // Legacy selector
            '[class*="tabBox"] span'       // Legacy selector
        ];

        for (const selector of mainTabSelectors) {
            if (openOrderTabClicked) break;
            const tabs = document.querySelectorAll(selector);
            for (const tab of tabs) {
                const text = tab.textContent.trim();
                // Match "Open Order" or "Open Order (2)" with count
                if (text.match(/Open Order/i) || text.match(/Current Order/i)) {
                    tab.click();
                    await sleep(400);
                    log('    Clicked Open Order main tab: "' + text + '" (selector: ' + selector + ')');
                    openOrderTabClicked = true;
                    break;
                }
            }
        }

        if (!openOrderTabClicked) {
            log('    ⚠ Could not find Open Order main tab - trying to continue anyway');
        }

        // Scroll again after clicking tab to ensure content renders
        await sleep(200);
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(300);

        // Step 1b: Click on Limit Order inner tab (if it exists)
        // Note: In some KCEX versions, clicking "Open Order" tab goes directly to orders without a sub-tab
        let limitOrderTabClicked = false;
        const innerTabs = document.querySelectorAll('.ant-tabs-tab-btn, [class*="ant-tabs"] [role="tab"]');
        for (const tab of innerTabs) {
            if (tab.textContent.match(/Limit Order\s*\(/i) || tab.textContent.match(/Limit\s*\(/i)) {
                tab.click();
                await sleep(500);
                log('    Clicked Limit Order inner tab');
                limitOrderTabClicked = true;
                break;
            }
        }

        if (!limitOrderTabClicked) {
            log('    Note: No Limit Order inner tab found - Open Order may go directly to orders list');
        }

        // Final scroll and wait for table to render
        await sleep(400);

        // Step 1c: Make sure we're looking at the active Open Order panel content
        // The panel ID follows pattern: rc-tabs-X-panel-Y where Y matches the tab number
        // Try to find the active order panel
        const openOrderPanel = document.querySelector('[id*="panel"][aria-labelledby*="tab"]:not([aria-hidden="true"]), .ant-tabs-tabpane-active');
        if (openOrderPanel) {
            log('    Found active panel: ' + (openOrderPanel.id || openOrderPanel.className));
        }

        // Step 2: Find the first order row (most recent) and check its status
        // Look in the current active panel first, then fallback to all rows
        let orderRows;
        if (openOrderPanel) {
            orderRows = openOrderPanel.querySelectorAll('.ant-table-row');
            log('    Looking for order rows in active panel: found ' + orderRows.length);
        }
        if (!orderRows || orderRows.length === 0) {
            orderRows = document.querySelectorAll('.ant-table-row');
            log('    Looking for order rows globally: found ' + orderRows.length);
        }
        if (!orderRows || orderRows.length === 0) {
            log('    ⚠ No order rows found');
            return 'not_found';
        }

        // Find the first actual order row (skip measure rows)
        let targetRow = null;
        for (const row of orderRows) {
            if (!row.classList.contains('ant-table-measure-row')) {
                targetRow = row;
                break;
            }
        }

        if (!targetRow) {
            log('    ⚠ No valid order row found');
            return 'not_found';
        }

        // Check the status of this order
        const statusCell = targetRow.querySelector('td:nth-child(8) span, .ant-table-cell span');
        const statusText = statusCell ? statusCell.textContent.trim() : '';
        log('    Order status: ' + statusText);

        if (statusText === 'Partially filled') {
            log('    Order is partially filled - waiting for full fill');
            return 'partially_filled';
        }

        if (statusText === 'Filled' || statusText === 'Completed') {
            log('    Order is already filled!');
            return 'filled';
        }

        // Step 3: Find and click the Edit button
        const editBtn = targetRow.querySelector('.position_operateBtn__JLoWz, button.ant-btn-link');
        let editBtnFound = null;
        const buttons = targetRow.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent.includes('Edit')) {
                editBtnFound = btn;
                break;
            }
        }

        if (!editBtnFound) {
            log('    ⚠ Edit button not found on order row');
            return 'not_found';
        }

        editBtnFound.click();
        log('    Clicked Edit button');
        await sleep(400);

        // Step 4: Wait for edit modal to appear
        const editModal = await waitForCondition(() => {
            return document.querySelector('.ant-modal:not([style*="display: none"]), [class*="EditOrder"], [class*="editOrder"]');
        }, 3000);

        if (!editModal) {
            log('    ⚠ Edit modal did not appear');
            return 'not_found';
        }

        log('    Edit modal appeared');

        // Step 5: Find and update inputs
        // The edit modal has: Price input (first), Qty input (second)
        const allInputs = editModal.querySelectorAll('.InputNumberExtend_wrapper__qxkpD input.ant-input, input.ant-input');
        log('    Found ' + allInputs.length + ' input fields in edit modal');

        // Price input - either click Latest or set manually
        let latestBtnFound = null;
        const allClickables = editModal.querySelectorAll('button, span.ant-btn, [class*="latest"], [class*="Latest"], [class*="refreshText"]');
        for (const el of allClickables) {
            if (el.textContent.trim() === 'Latest' || el.textContent.includes('Latest')) {
                latestBtnFound = el;
                break;
            }
        }

        if (latestBtnFound) {
            latestBtnFound.click();
            log('    Clicked Latest button for price');
            await sleep(200);
        } else if (allInputs.length > 0) {
            // Manually set the price input (first input)
            const priceInput = allInputs[0];
            await setInputValueAggressive(priceInput, newEntryPrice);
            log('    Set price input to: ' + newEntryPrice);
            await sleep(200);
        }

        // Step 5b: Update quantity if recalculated
        if (newQuantity && allInputs.length > 1) {
            const qtyInput = allInputs[1];
            const oldQty = qtyInput.value;
            await setInputValueAggressive(qtyInput, newQuantity);
            log('    Updated quantity: ' + oldQty + ' → ' + newQuantity + ' USDT');
            await sleep(200);
        } else if (newQuantity) {
            log('    ⚠ Could not find quantity input to update');
        }

        // Step 6: Click Confirm button in the modal
        const confirmBtn = editModal.querySelector('.ant-btn-primary, button[type="submit"]');
        if (confirmBtn) {
            confirmBtn.click();
            log('    Clicked Confirm in edit modal');
            await sleep(300);
        } else {
            // Try finding by text
            const allBtns = editModal.querySelectorAll('button');
            for (const btn of allBtns) {
                if (btn.textContent.includes('Confirm') || btn.textContent.includes('OK')) {
                    btn.click();
                    log('    Clicked Confirm button');
                    await sleep(300);
                    break;
                }
            }
        }

        // Handle any confirmation popups (like Risk Reminder)
        await sleep(200);
        const riskConfirm = document.querySelector('.ant-modal .ant-btn-primary');
        if (riskConfirm && document.querySelector('.ant-modal-title')?.textContent.includes('Risk')) {
            riskConfirm.click();
            log('    Confirmed Risk reminder');
            await sleep(200);
        }

        log('    ✓ Order entry edited to: ' + newEntryPrice);
        return 'edited';
    }

    // Cancel an open order (fallback if edit doesn't work)
    async function cancelPendingOrder() {
        log('>>> Cancelling pending order...');

        // Click on Limit Order tab
        const innerTabs = document.querySelectorAll('.ant-tabs-tab-btn');
        for (const tab of innerTabs) {
            if (tab.textContent.match(/Limit Order\s*\(/i)) {
                tab.click();
                await sleep(300);
                break;
            }
        }

        // Find Cancel Order button on first row
        const orderRows = document.querySelectorAll('.ant-table-row:not(.ant-table-measure-row)');
        if (orderRows.length > 0) {
            const firstRow = orderRows[0];
            const buttons = firstRow.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent.includes('Cancel')) {
                    btn.click();
                    await sleep(200);

                    // Confirm if needed
                    const confirmBtn = document.querySelector('.ant-modal .ant-btn-primary, .ant-popconfirm .ant-btn-primary');
                    if (confirmBtn) {
                        confirmBtn.click();
                        await sleep(200);
                    }

                    log('    ✓ Pending order cancelled');
                    return true;
                }
            }
        }

        log('    ⚠ Could not find cancel button');
        return false;
    }

    // ============================================
    // AUTO-CONFIRM RISK REMINDER
    // ============================================
    // This modal blocks the trade flow and MUST be closed immediately
    // Uses MutationObserver (always active) + polling (only during trade execution)

    let lastRiskReminderClick = 0;
    let riskReminderInterval = null;
    let riskReminderEnabled = true; // Global flag to enable/disable auto-confirm

    // Find and close Risk reminder modal
    function closeRiskReminderIfPresent() {
        if (!riskReminderEnabled) return false; // Disabled after order placed

        const now = Date.now();
        if (now - lastRiskReminderClick < 300) return false;

        // Check all modals and dialogs
        const candidates = [
            ...document.querySelectorAll('.ant-modal'),
            ...document.querySelectorAll('[role="dialog"]')
        ];

        for (const modal of candidates) {
            const title = modal.querySelector('.ant-modal-title');
            if (title && title.textContent.includes('Risk reminder')) {
                const confirmBtn = modal.querySelector('.ant-btn-primary');
                if (confirmBtn) {
                    lastRiskReminderClick = now;
                    log('🚨 Risk reminder AUTO-CONFIRMED');
                    confirmBtn.click();
                    return true;
                }
            }
        }
        return false;
    }

    // Start polling - ONLY called during trade execution
    function startRiskReminderPolling() {
        if (riskReminderInterval) return;
        riskReminderInterval = setInterval(closeRiskReminderIfPresent, 100);
        log('Risk reminder polling STARTED');
    }

    // Stop polling - called when trade execution ends
    function stopRiskReminderPolling() {
        if (riskReminderInterval) {
            clearInterval(riskReminderInterval);
            riskReminderInterval = null;
            log('Risk reminder polling STOPPED');
        }
    }

    // Wait for Risk reminder modal to appear and be handled (or timeout if none)
    // This is called RIGHT AFTER clicking the order button to ensure the modal is handled
    async function waitForRiskReminderHandled(timeout = 2000) {
        const startTime = Date.now();
        let riskReminderSeen = false;
        let riskReminderConfirmed = false;

        while (Date.now() - startTime < timeout) {
            // Check if Risk reminder modal is present
            const modals = document.querySelectorAll('.ant-modal');
            for (const modal of modals) {
                if (modal.offsetParent === null) continue; // Skip hidden
                const title = modal.querySelector('.ant-modal-title');
                if (title && title.textContent.includes('Risk reminder')) {
                    riskReminderSeen = true;
                    log('    ⚠️ Risk reminder modal detected');

                    // Click confirm button
                    const confirmBtn = modal.querySelector('.ant-btn-primary');
                    if (confirmBtn) {
                        confirmBtn.click();
                        log('    🚨 Risk reminder CONFIRMED (waitForRiskReminderHandled)');
                        riskReminderConfirmed = true;

                        // Wait for modal to close
                        await sleep(200);
                        return { seen: true, confirmed: true };
                    }
                }
            }

            // If we've seen and confirmed, we're done
            if (riskReminderConfirmed) {
                return { seen: true, confirmed: true };
            }

            // Small delay before next check
            await sleep(50);

            // After 800ms without seeing a modal, exit early - it's not coming
            // Risk reminder typically appears within 200-500ms if it's going to appear
            const elapsed = Date.now() - startTime;
            if (elapsed > 800 && !riskReminderSeen) {
                log('    (no Risk reminder modal after 800ms - not needed for this trade)');
                return { seen: false, confirmed: false };
            }
        }

        if (riskReminderSeen && !riskReminderConfirmed) {
            log('    ⚠️ Risk reminder was seen but NOT confirmed (timeout)');
            return { seen: true, confirmed: false };
        }

        return { seen: false, confirmed: false };
    }

    // MutationObserver - always active, catches most cases
    function setupRiskReminderObserver() {
        const observer = new MutationObserver((mutations) => {
            if (!riskReminderEnabled) return; // Disabled after order placed

            const now = Date.now();
            if (now - lastRiskReminderClick < 300) return;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    // Check node itself and children for Risk reminder
                    const checkModal = (el) => {
                        const title = el.querySelector?.('.ant-modal-title');
                        if (title && title.textContent.includes('Risk reminder')) {
                            const confirmBtn = el.querySelector('.ant-btn-primary');
                            if (confirmBtn) {
                                lastRiskReminderClick = now;
                                log('🚨 Risk reminder AUTO-CONFIRMED (observer)');
                                confirmBtn.click();
                                return true;
                            }
                        }
                        return false;
                    };

                    if (checkModal(node)) return;

                    const modals = node.querySelectorAll?.('.ant-modal, [role="dialog"]');
                    if (modals) {
                        for (const modal of modals) {
                            if (checkModal(modal)) return;
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        log('Risk reminder observer active');
    }

    // ============================================
    // POSITION CLOSE DETECTION
    // ============================================
    // Monitors for when a position closes and copies exit report to clipboard

    let positionMonitorActive = false;
    let lastKnownPositionState = null; // Track position state (open/closed)
    let activeTradeData = null; // Store current trade data for close detection

    // Get current position data from the position table
    function getCurrentPositionData() {
        const positionCheck = checkPositionFilled();
        if (!positionCheck.filled) {
            return null;
        }

        const positionTable = document.querySelector('#kcex-web-inspection-futures-exchange-current-position');
        if (!positionTable) return null;

        const positionRows = positionTable.querySelectorAll('.ant-table-row:not(.ant-table-measure-row)');
        if (positionRows.length === 0) return null;

        const firstRow = positionRows[0];
        const cells = firstRow.querySelectorAll('.ant-table-cell');

        if (cells.length < 6) return null;

        // Parse position data from table columns
        // Typical column order: Perpetual, Open Interest, Avg Entry Price, Mark Price, Liq Price, Unrealized PNL
        const data = {
            pair: cells[0]?.textContent.trim() || '',
            openInterest: cells[1]?.textContent.trim() || '',
            entryPrice: parsePrice(cells[2]?.textContent || ''),
            markPrice: parsePrice(cells[3]?.textContent || ''),
            unrealizedPNL: parsePrice(cells[5]?.textContent || '')
        };

        // Detect direction from Open Interest text (contains "Short" or "Long")
        data.direction = data.openInterest.toLowerCase().includes('short') ? 'short' : 'long';

        return data;
    }

    // Calculate R value (risk multiple) for a closed trade
    function calculateRValue(entryPrice, exitPrice, stopLoss, direction) {
        const riskDistance = Math.abs(entryPrice - stopLoss);
        const profitDistance = direction === 'long'
            ? exitPrice - entryPrice
            : entryPrice - exitPrice;

        if (riskDistance === 0) return 0;

        return profitDistance / riskDistance;
    }

    // Generate close report text
    function generateCloseReport(trade, exitPrice, rValue) {
        const won = rValue > 0;
        const rFormatted = (rValue >= 0 ? '+' : '') + rValue.toFixed(2) + 'R';
        const result = won ? 'Won' : 'Lost';

        return `${result} -> ${rFormatted}`;
    }

    // Pending close data for retry (when window not focused)
    let pendingCloseData = null;

    // Copy close report to clipboard (with retry on focus)
    async function copyCloseReportToClipboard(report) {
        try {
            await navigator.clipboard.writeText(report);
            log('📋 Close report copied: ' + report);
            showNotification('Copied: ' + report, 'success');
            pendingClipboardText = null;
            return true;
        } catch (err) {
            log('⚠️ Failed to copy close report (window not focused): ' + err.message);
            // Store for retry when window gets focus
            pendingClipboardText = report;
            log('📋 Will copy to clipboard when window is focused');
            showNotification('Close: ' + report + ' (pending - focus window)', 'info');
            return false;
        }
    }

    // Send close data to Google Sheets
    async function sendCloseDataToSheets(closeData) {
        log('[DEBUG sendCloseDataToSheets] Called with: ' + JSON.stringify(closeData));
        if (!CONFIG.googleSheetsUrl) {
            log('[DEBUG sendCloseDataToSheets] No googleSheetsUrl configured');
            return false;
        }

        try {
            // Update the trade entry with close data
            const updateData = {
                action: 'update_close',
                entry: closeData.entry,
                exitPrice: closeData.exitPrice,
                rValue: closeData.rValue,
                result: closeData.rValue > 0 ? 'won' : 'lost',
                closeTime: new Date().toISOString()
            };

            log('[Sheets] Sending close data...');
            log('[DEBUG sendCloseDataToSheets] Payload: ' + JSON.stringify(updateData));

            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: CONFIG.googleSheetsUrl,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(updateData),
                    onload: (response) => {
                        if (response.status === 200) {
                            log('[Sheets] ✓ Close data sent successfully');
                            resolve(true);
                        } else {
                            log('[Sheets] ⚠️ Close data failed: ' + response.status);
                            resolve(false);
                        }
                    },
                    onerror: (err) => {
                        log('[Sheets] ⚠️ Close data error: ' + err);
                        resolve(false);
                    }
                });
            });
        } catch (err) {
            log('[Sheets] ⚠️ Close data exception: ' + err.message);
            return false;
        }
    }

    // Retry all pending operations when window gets focus
    function setupClipboardRetryOnFocus() {
        window.addEventListener('focus', async () => {
            log('📋 Window focused - checking for pending operations...');

            // Retry pending close operations
            if (pendingCloseData) {
                log('📋 Retrying pending close operations...');

                // Retry clipboard
                try {
                    const report = pendingCloseData.report;
                    await navigator.clipboard.writeText(report);
                    log('📋 ✓ Close report copied: ' + report);
                    showNotification('Copied: ' + report, 'success');
                } catch (err) {
                    log('⚠️ Clipboard still failed: ' + err.message);
                }

                // Retry sheets update
                if (CONFIG.googleSheetsUrl && !pendingCloseData.sheetsSent) {
                    const success = await sendCloseDataToSheets(pendingCloseData);
                    if (success) {
                        pendingCloseData.sheetsSent = true;
                    }
                }

                // Update local history if not done
                if (!pendingCloseData.historyUpdated && state.tradeHistory.length > 0) {
                    const lastTrade = state.tradeHistory[0];
                    if (Math.abs(lastTrade.entry - pendingCloseData.entry) < 1) {
                        lastTrade.exitPrice = pendingCloseData.exitPrice;
                        lastTrade.rValue = pendingCloseData.rValue;
                        lastTrade.result = pendingCloseData.rValue > 0 ? 'won' : 'lost';
                        lastTrade.closeTime = new Date().toLocaleString();
                        saveHistory();
                        renderHistory();
                        pendingCloseData.historyUpdated = true;
                        log('📋 ✓ Trade history updated');
                    }
                }

                // Clear pending if everything done
                if (pendingCloseData.sheetsSent || !CONFIG.googleSheetsUrl) {
                    pendingCloseData = null;
                    log('📋 ✓ All pending close operations completed');
                }
            }

            // Retry pending text (for other clipboard operations)
            if (pendingClipboardText) {
                try {
                    await navigator.clipboard.writeText(pendingClipboardText);
                    log('📋 Pending text copied: ' + pendingClipboardText);
                    showNotification('Copied: ' + pendingClipboardText, 'success');
                    pendingClipboardText = null;
                } catch (err) {
                    log('⚠️ Still failed to copy text: ' + err.message);
                }
            }

            // Retry pending PNL image
            if (pendingPnlImageBlob) {
                try {
                    const item = new ClipboardItem({ 'image/png': pendingPnlImageBlob });
                    await navigator.clipboard.write([item]);
                    log('📋 Pending PNL image copied to clipboard!');
                    showNotification('PNL image copied to clipboard!', 'success');
                    pendingPnlImageBlob = null;
                } catch (err) {
                    log('⚠️ Still failed to copy PNL image: ' + err.message);
                }
            }

            // Retry pending screenshot
            if (pendingScreenshotBlob) {
                try {
                    const item = new ClipboardItem({ 'image/png': pendingScreenshotBlob });
                    await navigator.clipboard.write([item]);
                    log('📋 Pending screenshot copied to clipboard!');
                    showNotification('Screenshot copied to clipboard!', 'success');
                    pendingScreenshotBlob = null;
                } catch (err) {
                    log('⚠️ Still failed to copy screenshot: ' + err.message);
                }
            }
        });
    }

    // Handle position close event
    async function handlePositionClose() {
        if (!activeTradeData) {
            log('Position closed but no active trade data - cannot generate report');
            return;
        }

        log('');
        log('┌─── POSITION CLOSED ─────────────────────────────────────────┐');
        log('│ Detecting close price...');

        // Try to get actual close price from KCEX order history FIRST
        // This is more accurate than lastMarkPrice
        let exitPrice = 0;
        const closeData = await getLastClosePrice();
        if (closeData && closeData.price > 0) {
            exitPrice = closeData.price;
            log('│ Exit price from order history: ' + exitPrice);
        } else {
            // Fallback to last mark price (but this may be stale!)
            exitPrice = activeTradeData.lastMarkPrice || activeTradeData.entry;
            log('│ Using last mark price as exit: ' + exitPrice + ' (may be stale)');
        }

        // Check if we have valid SL data
        const hasSL = activeTradeData.sl && activeTradeData.sl > 0;

        // Calculate R value only if we have valid SL
        let rValue = 0;
        let report = '';

        if (hasSL) {
            rValue = calculateRValue(
                activeTradeData.entry,
                exitPrice,
                activeTradeData.sl,
                activeTradeData.direction
            );
            report = generateCloseReport(activeTradeData, exitPrice, rValue);
        } else {
            // No SL data - can't calculate R-value
            // Just report the PNL direction
            const pnlDirection = activeTradeData.direction === 'long'
                ? (exitPrice > activeTradeData.entry ? 'Won' : 'Lost')
                : (exitPrice < activeTradeData.entry ? 'Won' : 'Lost');
            report = `${pnlDirection} (R unknown - no SL data)`;
            log('│ ⚠️ Cannot calculate R-value: SL is unknown');
        }

        log('│');
        log('│ Entry: ' + activeTradeData.entry);
        log('│ Exit:  ' + exitPrice);
        log('│ SL:    ' + activeTradeData.sl);
        log('│ Direction: ' + activeTradeData.direction.toUpperCase());
        log('│');
        log('│ R-Value: ' + rValue.toFixed(2) + 'R');
        log('│ Result: ' + report);
        log('└─────────────────────────────────────────────────────────────┘');

        // Store close data for potential retry
        const closeDataForRetry = {
            entry: activeTradeData.entry,
            exitPrice: exitPrice,
            sl: activeTradeData.sl,
            direction: activeTradeData.direction,
            rValue: rValue,
            report: report,
            sheetsSent: false,
            historyUpdated: false
        };

        // Try to copy to clipboard
        const clipboardSuccess = await copyCloseReportToClipboard(report);

        // Try to send to Google Sheets
        let sheetsSuccess = false;
        if (CONFIG.googleSheetsUrl) {
            sheetsSuccess = await sendCloseDataToSheets(closeDataForRetry);
            closeDataForRetry.sheetsSent = sheetsSuccess;
        }

        // Update trade history with close data
        let historySuccess = false;
        if (state.tradeHistory.length > 0) {
            const lastTrade = state.tradeHistory[0];
            if (Math.abs(lastTrade.entry - activeTradeData.entry) < 1) {
                lastTrade.exitPrice = exitPrice;
                lastTrade.rValue = rValue;
                lastTrade.result = rValue > 0 ? 'won' : 'lost';
                lastTrade.closeTime = new Date().toLocaleString();
                saveHistory();
                renderHistory();
                historySuccess = true;
                closeDataForRetry.historyUpdated = true;
            }
        }

        // If any operation failed, store for retry on focus
        if (!clipboardSuccess || (!sheetsSuccess && CONFIG.googleSheetsUrl)) {
            pendingCloseData = closeDataForRetry;
            log('📋 Some operations pending - will retry when window focused');
        }

        // Try to auto-open the Share PNL modal to capture the image
        if (CONFIG.pnlShareAutoCapture !== false) {
            log('│ Attempting to auto-open Share PNL modal...');
            await tryOpenSharePnlModal();
        }

        // Clear active trade
        activeTradeData = null;
    }

    // Try to find and click the Share button to open PNL modal
    async function tryOpenSharePnlModal() {
        try {
            // Wait a moment for KCEX to show the profit/loss notification
            await sleep(1000);

            // Look for the share button in the position closed notification or result area
            // KCEX usually shows a "Share" button after position closes
            const shareSelectors = [
                '.ant-notification button:contains("Share")',
                '.ant-notification [class*="share"]',
                'button[class*="Share"]',
                '[class*="share"][class*="btn"]',
                '.ant-btn:contains("Share")'
            ];

            for (const selector of shareSelectors) {
                try {
                    const btn = document.querySelector(selector);
                    if (btn) {
                        log('│ Found Share button: ' + selector);
                        btn.click();
                        log('│ Clicked Share button');
                        return true;
                    }
                } catch (e) {}
            }

            // Fallback: look for any element with share-related text
            const allButtons = document.querySelectorAll('button, .ant-btn, [role="button"]');
            for (const btn of allButtons) {
                const text = (btn.textContent || '').toLowerCase();
                if (text.includes('share') && !text.includes('unshare')) {
                    log('│ Found Share button by text');
                    btn.click();
                    return true;
                }
            }

            log('│ ⚠️ Could not find Share button');
            return false;
        } catch (e) {
            log('│ ⚠️ Error opening Share modal: ' + e.message);
            return false;
        }
    }

    // Try to get SL price from position display on page
    function getSLFromPositionDisplay() {
        log('[DEBUG getSLFromPositionDisplay] Starting...');

        // KCEX shows SL/TP in the position row
        // Look for the Open Position table
        const positionTable = document.querySelector('#kcex-web-inspection-futures-exchange-position');
        if (!positionTable) {
            log('[DEBUG getSLFromPositionDisplay] No position table found (#kcex-web-inspection-futures-exchange-position)');
            return 0;
        }

        const rows = positionTable.querySelectorAll('.ant-table-row:not(.ant-table-measure-row)');
        log('[DEBUG getSLFromPositionDisplay] Found ' + rows.length + ' position rows');
        if (rows.length === 0) return 0;

        // Look through cells for SL value - typically labeled or in a specific column
        const firstRow = rows[0];
        const cells = firstRow.querySelectorAll('.ant-table-cell');
        log('[DEBUG getSLFromPositionDisplay] Row has ' + cells.length + ' cells');

        // Log all cell contents for debugging
        cells.forEach((cell, i) => {
            const text = (cell.textContent || '').trim().substring(0, 50);
            log('[DEBUG getSLFromPositionDisplay] Cell ' + i + ': "' + text + '"');
        });

        // SL is usually in one of the later columns - look for text containing "SL" or a price near entry
        for (const cell of cells) {
            const text = cell.textContent || '';
            // Look for SL: pattern or standalone price
            const slMatch = text.match(/SL[:\s]*([0-9,]+\.?\d*)/i);
            if (slMatch) {
                const price = parsePrice(slMatch[1]);
                log('[DEBUG getSLFromPositionDisplay] Found SL pattern: ' + price);
                if (price > 10000) return price;
            }
        }

        // Fallback: look for TP/SL column that might have both values
        for (const cell of cells) {
            const text = cell.textContent || '';
            // Pattern like "89000.0 / 91000.0" (SL / TP) or "--/--"
            const slTpMatch = text.match(/([0-9,]+\.?\d*)\s*\/\s*([0-9,]+\.?\d*)/);
            if (slTpMatch) {
                const price1 = parsePrice(slTpMatch[1]);
                const price2 = parsePrice(slTpMatch[2]);
                log('[DEBUG getSLFromPositionDisplay] Found TP/SL pattern: ' + price1 + ' / ' + price2);
                // SL is typically the lower price for long, higher for short
                // For now return the first one (SL is usually first)
                if (price1 > 10000) return price1;
            }
        }

        log('[DEBUG getSLFromPositionDisplay] No SL found in any cell');
        return 0;
    }

    // Try to get the last close price from order history
    async function getLastClosePrice() {
        log('[DEBUG getLastClosePrice] Starting...');

        // Look for completed orders in the order history section
        const orderHistoryTable = document.querySelector('#kcex-web-inspection-futures-exchange-history-record');
        if (!orderHistoryTable) {
            log('[DEBUG getLastClosePrice] No order history table found (#kcex-web-inspection-futures-exchange-history-record)');
            return null;
        }

        const rows = orderHistoryTable.querySelectorAll('.ant-table-row:not(.ant-table-measure-row)');
        log('[DEBUG getLastClosePrice] Found ' + rows.length + ' history rows');
        if (rows.length === 0) return null;

        // Get the most recent row
        const firstRow = rows[0];
        const cells = firstRow.querySelectorAll('.ant-table-cell');
        log('[DEBUG getLastClosePrice] First row has ' + cells.length + ' cells');

        // Log all cell contents for debugging
        cells.forEach((cell, i) => {
            const text = (cell.textContent || '').trim().substring(0, 40);
            log('[DEBUG getLastClosePrice] Cell ' + i + ': "' + text + '"');
        });

        // Look for price in cells - typically the 4th or 5th column has execution price
        for (let i = 3; i < Math.min(cells.length, 7); i++) {
            const price = parsePrice(cells[i]?.textContent || '');
            if (price > 10000) { // Sanity check for BTC prices
                log('[DEBUG getLastClosePrice] Found exit price in cell ' + i + ': ' + price);
                return { price };
            }
        }

        log('[DEBUG getLastClosePrice] No valid exit price found');
        return null;
    }

    // Position monitoring loop
    let lastPositionLogTime = 0;
    function checkPositionState() {
        if (!positionMonitorActive) return;

        const currentPosition = getCurrentPositionData();
        const hadPosition = lastKnownPositionState !== null;
        const hasPosition = currentPosition !== null;

        // Log position state periodically (every 10 seconds) or on change
        const now = Date.now();
        const positionChanged = hadPosition !== hasPosition;
        if (positionChanged || now - lastPositionLogTime > 10000) {
            log('[DEBUG checkPositionState] hadPosition=' + hadPosition + ', hasPosition=' + hasPosition + ', activeTradeData=' + (activeTradeData ? 'YES' : 'null'));
            if (currentPosition) {
                log('[DEBUG checkPositionState] Current: ' + currentPosition.direction + ' @ entry=' + currentPosition.entryPrice + ', mark=' + currentPosition.markPrice);
            }
            if (activeTradeData) {
                log('[DEBUG checkPositionState] ActiveTrade: entry=' + activeTradeData.entry + ', sl=' + activeTradeData.sl + ', dir=' + activeTradeData.direction + ', lastMark=' + activeTradeData.lastMarkPrice);
            }
            lastPositionLogTime = now;
        }

        // Update last known mark price if we have a position
        if (hasPosition && activeTradeData && currentPosition.markPrice > 0) {
            activeTradeData.lastMarkPrice = currentPosition.markPrice;
        }

        // Detect position close (had position, now don't)
        // IMPORTANT: Verify close by re-checking after a delay to avoid false triggers from DOM glitches
        if (hadPosition && !hasPosition) {
            log('[DEBUG checkPositionState] Position appears closed - verifying...');

            // Re-check after 500ms to confirm it's actually closed (not a DOM glitch)
            setTimeout(() => {
                const verifyPosition = getCurrentPositionData();
                if (verifyPosition !== null) {
                    log('[DEBUG checkPositionState] FALSE ALARM - position still exists after re-check');
                    lastKnownPositionState = verifyPosition; // Reset state
                    return;
                }

                // Double-check by looking at the tab count directly
                const tabText = document.querySelector('.ant-tabs-tab-btn span, [role="tab"] span');
                const hasPositionInTab = tabText && tabText.textContent && tabText.textContent.match(/Position\s*\(([1-9])/);
                if (hasPositionInTab) {
                    log('[DEBUG checkPositionState] FALSE ALARM - tab still shows position: ' + tabText.textContent);
                    lastKnownPositionState = getCurrentPositionData();
                    return;
                }

                // Confirmed closed
                log('📊 Position close detected! (verified)');
                log('[DEBUG checkPositionState] CLOSE TRIGGER: hadPosition=' + hadPosition + ', hasPosition=' + hasPosition);
                log('[DEBUG checkPositionState] activeTradeData at close: ' + JSON.stringify(activeTradeData));
                handlePositionClose();
            }, 500);
        }

        // Detect position open (didn't have, now do)
        if (!hadPosition && hasPosition && !activeTradeData) {
            log('📊 New position detected: ' + currentPosition.direction.toUpperCase() + ' @ ' + currentPosition.entryPrice);
            // If we don't have active trade data (position opened outside of script),
            // try to get SL from KCEX's position display
            const slFromPage = getSLFromPositionDisplay();
            if (slFromPage > 0) {
                activeTradeData = {
                    entry: currentPosition.entryPrice,
                    direction: currentPosition.direction,
                    sl: slFromPage,
                    lastMarkPrice: currentPosition.markPrice
                };
                log('📊 Found SL from page: ' + slFromPage);
                log('[DEBUG checkPositionState] Created activeTradeData: ' + JSON.stringify(activeTradeData));
            } else {
                // Don't create activeTradeData if we can't determine SL
                // This prevents wrong R-value calculations
                log('📊 Position detected but SL unknown - close report will not include R-value');
                log('[DEBUG checkPositionState] NOT creating activeTradeData because SL=0');
            }
        }

        lastKnownPositionState = currentPosition;
    }

    // Start position monitoring
    let positionMonitorInterval = null;

    function startPositionMonitoring() {
        if (positionMonitorInterval) return;

        positionMonitorActive = true;
        lastKnownPositionState = getCurrentPositionData();

        // Check every 2 seconds
        positionMonitorInterval = setInterval(checkPositionState, 2000);
        log('📊 Position close monitoring started');
    }

    function stopPositionMonitoring() {
        positionMonitorActive = false;
        if (positionMonitorInterval) {
            clearInterval(positionMonitorInterval);
            positionMonitorInterval = null;
        }
        log('📊 Position close monitoring stopped');
    }

    // Called when a new trade is placed - store the trade data for close detection
    function setActiveTradeForMonitoring(trade) {
        activeTradeData = {
            entry: trade.entry,
            sl: trade.sl,
            tp: trade.tp,
            direction: trade.direction,
            qty: trade.qty,
            risk: trade.risk,
            lastMarkPrice: trade.entry
        };
        log('📊 Active trade set for close monitoring');
        log('[DEBUG setActiveTradeForMonitoring] Trade data: ' + JSON.stringify(activeTradeData));

        // Ensure monitoring is running
        if (!positionMonitorInterval) {
            startPositionMonitoring();
        }
    }

    // ============================================
    // PNL SHARE MODAL AUTO-COPY TO CLIPBOARD
    // ============================================
    // Detects when the KCEX "Share My PNL" modal appears and copies image to clipboard

    let pnlModalObserverActive = false;
    let currentPnlModalId = null; // Track which modal we've handled
    let pendingPnlImageBlob = null; // Store blob for retry when window focused

    // Check if PNL share modal is visible
    let lastPnlModalCheckLog = 0;
    function checkPnlShareModal() {
        // Look for modal with "Share My PNL" title
        const modals = document.querySelectorAll('.ant-modal');

        // Log periodically (every 30 seconds) when checking for modals
        const now = Date.now();
        if (now - lastPnlModalCheckLog > 30000) {
            log('[DEBUG checkPnlShareModal] Checking ' + modals.length + ' modals on page');
            lastPnlModalCheckLog = now;
        }

        for (const modal of modals) {
            if (modal.offsetParent === null) continue; // Skip hidden

            // Check modal title
            const title = modal.querySelector('.ant-modal-title');
            const titleText = title ? title.textContent.trim() : '';

            if (titleText.includes('Share My PNL') || titleText.includes('Share PNL')) {
                log('[DEBUG checkPnlShareModal] Found PNL modal by title: "' + titleText + '"');
                return modal;
            }

            // Also check for modal content that looks like PNL share
            const content = modal.textContent || '';
            if (content.includes('Download Image') && (content.includes('USDT') || content.includes('%'))) {
                log('[DEBUG checkPnlShareModal] Found PNL modal by content pattern');
                return modal;
            }
        }

        return null;
    }

    // Generate unique ID for a modal based on its content
    function getPnlModalId(modal) {
        // Use PNL value and timestamp from modal as unique ID
        const pnlEl = modal.querySelector('[class*="pnl"], [class*="profit"]');
        const pnlText = pnlEl ? pnlEl.textContent : '';
        const timeEl = modal.querySelector('[class*="time"], [class*="date"]');
        const timeText = timeEl ? timeEl.textContent : '';
        return `${pnlText}-${timeText}-${modal.className}`;
    }

    // Handle PNL share modal - copy canvas image to clipboard
    async function handlePnlShareModal(modal) {
        // Generate unique ID for this modal instance
        const modalId = getPnlModalId(modal);

        // Skip if we already handled this exact modal
        if (modalId === currentPnlModalId) {
            return;
        }
        currentPnlModalId = modalId;

        log('');
        log('┌─── PNL SHARE MODAL DETECTED ────────────────────────────────┐');
        log('│ Looking for PNL canvas...');

        // Wait for the canvas to fully render
        // The canvas takes a moment to draw the PNL poster
        let canvas = null;
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds max (canvas may take time to render)

        while (!canvas && attempts < maxAttempts) {
            // Look specifically for the PNL poster canvas
            const foundCanvas = modal.querySelector('canvas[class*="canvas"], canvas.PnlSharePoster_canvas__o34HK, canvas');

            if (foundCanvas) {
                // Check if canvas has content (width/height > 0)
                if (foundCanvas.width > 0 && foundCanvas.height > 0) {
                    // Also check if canvas has actual drawn content (not just blank)
                    try {
                        const ctx = foundCanvas.getContext('2d');
                        if (ctx) {
                            // Sample some pixels to check if canvas has content
                            const imageData = ctx.getImageData(
                                Math.floor(foundCanvas.width / 2),
                                Math.floor(foundCanvas.height / 2),
                                10, 10
                            );
                            // Check if any pixels are non-white/non-transparent
                            let hasContent = false;
                            for (let i = 0; i < imageData.data.length; i += 4) {
                                const r = imageData.data[i];
                                const g = imageData.data[i + 1];
                                const b = imageData.data[i + 2];
                                const a = imageData.data[i + 3];
                                // If pixel is not white/transparent, canvas has content
                                if (a > 0 && (r < 250 || g < 250 || b < 250)) {
                                    hasContent = true;
                                    break;
                                }
                            }
                            if (hasContent) {
                                canvas = foundCanvas;
                                log('│ Canvas has rendered content');
                                break;
                            } else {
                                log('│ Canvas exists but appears blank - waiting...');
                            }
                        }
                    } catch (e) {
                        // getImageData might fail for cross-origin, accept the canvas anyway
                        log('│ Cannot check canvas content (CORS?) - accepting canvas');
                        canvas = foundCanvas;
                        break;
                    }
                }
            }

            await sleep(500);
            attempts++;
        }

        if (canvas) {
            log('│ Found PNL canvas (' + canvas.width + 'x' + canvas.height + ')');

            try {
                // Convert canvas to blob
                const blob = await new Promise((resolve, reject) => {
                    canvas.toBlob((b) => {
                        if (b) resolve(b);
                        else reject(new Error('Canvas toBlob returned null'));
                    }, 'image/png');
                });

                if (blob) {
                    log('│ Canvas converted to blob (' + (blob.size / 1024).toFixed(1) + ' KB)');

                    // Try to copy to clipboard
                    try {
                        const item = new ClipboardItem({ 'image/png': blob });
                        await navigator.clipboard.write([item]);
                        log('│ ✓ PNL image copied to clipboard!');
                        showNotification('PNL image copied to clipboard!', 'success');
                        pendingPnlImageBlob = null; // Clear any pending
                    } catch (clipErr) {
                        log('│ ⚠️ Clipboard failed (window not focused): ' + clipErr.message);
                        // Store blob for retry when window gets focus
                        pendingPnlImageBlob = blob;
                        log('│ 📋 Image saved - will copy when window focused');
                        showNotification('PNL image ready - focus window to copy', 'info');
                    }
                    log('└─────────────────────────────────────────────────────────────┘');
                    return;
                }
            } catch (e) {
                log('│ ⚠️ Failed to process canvas: ' + e.message);
            }
        } else {
            log('│ ⚠️ Canvas not found or still blank after ' + (maxAttempts * 0.5) + 's');
        }

        log('└─────────────────────────────────────────────────────────────┘');
    }

    // Setup observer to watch for PNL share modal
    function setupPnlModalObserver() {
        if (pnlModalObserverActive) return;

        const observer = new MutationObserver((mutations) => {
            const modal = checkPnlShareModal();
            if (modal) {
                handlePnlShareModal(modal);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        pnlModalObserverActive = true;
        log('PNL share modal observer active');
    }

    // Reset modal tracking when modal closes
    function resetPnlModalTracking() {
        currentPnlModalId = null;
    }

    // ============================================
    // KCEX PAGE SCREENSHOT
    // ============================================
    // Captures a screenshot of the KCEX trading page and copies to clipboard
    // Uses the "Original" KCEX chart (not TradingView) which is capturable

    let pendingScreenshotBlob = null; // Store for retry when window focused

    async function captureChartScreenshot() {
        log('📸 Capturing KCEX page screenshot...');

        try {
            // Check if html2canvas is loaded
            if (typeof html2canvas === 'undefined') {
                log('📸 html2canvas not loaded, cannot capture screenshot');
                showNotification('Screenshot library not loaded', 'error');
                return false;
            }

            // Hide our own UI panel temporarily so it doesn't appear in screenshot
            const ourPanel = document.getElementById('kcex-trading-assistant');
            const panelWasVisible = ourPanel && ourPanel.style.display !== 'none';
            const originalDisplay = ourPanel ? ourPanel.style.display : '';
            if (ourPanel && panelWasVisible) {
                ourPanel.style.display = 'none'; // Use display:none to fully hide
            }

            // Switch to "Original" chart (capturable) instead of TradingView (iframe)
            let wasOnTradingView = false;
            const chartTypeRadios = document.querySelectorAll('.chart_chartTypeRadio__B8Apr label');
            log('📸 Found ' + chartTypeRadios.length + ' chart type options');

            for (const label of chartTypeRadios) {
                const text = label.textContent || '';
                const isChecked = label.classList.contains('ant-radio-button-wrapper-checked');
                log('📸 Chart option: "' + text.trim() + '" checked=' + isChecked);

                if (text.includes('TradingView') && isChecked) {
                    wasOnTradingView = true;
                    log('📸 Currently on TradingView - will switch to Original');
                }
            }

            if (wasOnTradingView) {
                for (const label of chartTypeRadios) {
                    const text = label.textContent || '';
                    if (text.includes('Original')) {
                        label.click();
                        log('📸 Clicked Original chart button');
                        await new Promise(r => setTimeout(r, 500)); // Wait for chart to render
                        break;
                    }
                }
            }

            // Check if Original chart canvas exists
            const chartCanvases = document.querySelectorAll('.originalKline_chartContainer__xrcSJ canvas');
            log('📸 Found ' + chartCanvases.length + ' canvas elements in Original chart area');
            if (chartCanvases.length > 0) {
                const firstCanvas = chartCanvases[0];
                log('📸 First canvas size: ' + firstCanvas.width + 'x' + firstCanvas.height);
            }

            // Ensure we're on the Open Position tab to show position data
            const openPosTab = Array.from(document.querySelectorAll('.ant-tabs-tab-btn')).find(
                el => el.textContent && el.textContent.includes('Open Position')
            );
            if (openPosTab) {
                openPosTab.click();
                await new Promise(r => setTimeout(r, 200)); // Wait for tab to switch
            }

            // Small delay to ensure UI is updated
            await new Promise(r => setTimeout(r, 150));

            // Capture the page - try to find main content area for faster capture
            log('📸 Starting html2canvas capture...');

            // Try to find a smaller target element (main content) for faster capture
            let targetElement = document.querySelector('.gridBg') || // Main chart/trading grid
                               document.querySelector('[class*="ClientPage"]') || // Client page container
                               document.body;

            // Limit capture to viewport size for speed
            const captureWidth = Math.min(window.innerWidth, 1920);
            const captureHeight = Math.min(window.innerHeight, 1200);

            const canvas = await html2canvas(targetElement, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#1a1a2e',
                scale: 1, // 1x scale for reasonable file size
                logging: false,
                width: captureWidth,
                height: captureHeight,
                windowWidth: captureWidth,
                windowHeight: captureHeight,
                // Ignore elements that cause issues or slow down capture
                ignoreElements: (element) => {
                    // Skip iframes
                    if (element.tagName === 'IFRAME') return true;
                    const className = element.className || '';
                    if (typeof className === 'string') {
                        // Skip order book (lots of DOM nodes)
                        if (className.includes('OrderBook')) return true;
                        // Skip market trades (lots of DOM nodes)
                        if (className.includes('MarketTrade')) return true;
                        // Skip news ticker
                        if (className.includes('notice_marquee')) return true;
                    }
                    return false;
                },
                onclone: (clonedDoc) => {
                    // Hide Trade Assistant in clone
                    const clonedPanel = clonedDoc.getElementById('kcex-trading-assistant');
                    if (clonedPanel) clonedPanel.style.display = 'none';
                }
            });

            log('📸 html2canvas complete! Canvas size: ' + canvas.width + 'x' + canvas.height);

            // Switch back to TradingView if that's what user was using
            if (wasOnTradingView) {
                for (const label of chartTypeRadios) {
                    const text = label.textContent || '';
                    if (text.includes('TradingView')) {
                        label.click();
                        log('📸 Switched back to TradingView chart');
                        break;
                    }
                }
            }

            // Restore our panel immediately
            if (ourPanel && panelWasVisible) {
                ourPanel.style.display = originalDisplay || 'block';
            }

            // Convert canvas to blob
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            log('📸 Blob created, size: ' + (blob ? (blob.size / 1024).toFixed(1) + ' KB' : 'null'));

            if (!blob) {
                log('📸 Failed to create image blob');
                showNotification('Screenshot failed', 'error');
                return false;
            }

            // Try to copy to clipboard
            try {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                log('📸 Screenshot copied to clipboard!');
                showNotification('Screenshot copied to clipboard!', 'success');
                pendingScreenshotBlob = null; // Clear pending
                return true;
            } catch (clipboardError) {
                log('📸 Clipboard copy failed: ' + clipboardError.message);

                // Store for retry when window focused
                pendingScreenshotBlob = blob;
                log('📸 Screenshot stored - will retry copy when window is focused');
                showNotification('Screenshot pending - focus window to copy', 'info');
                return true; // Still successful, just pending clipboard
            }
        } catch (error) {
            log('📸 Screenshot error: ' + error.message);
            showNotification('Screenshot failed: ' + error.message, 'error');

            // Restore panel visibility in case of error
            const ourPanel = document.getElementById('kcex-trading-assistant');
            if (ourPanel) {
                ourPanel.style.display = 'block';
            }
            return false;
        }
    }

    // Retry copying pending screenshot when window is focused
    async function retryPendingScreenshot() {
        if (!pendingScreenshotBlob) return;

        try {
            const item = new ClipboardItem({ 'image/png': pendingScreenshotBlob });
            await navigator.clipboard.write([item]);
            log('📸 Pending screenshot copied to clipboard!');
            showNotification('Screenshot copied to clipboard!', 'success');
            pendingScreenshotBlob = null;
        } catch (err) {
            log('📸 Retry screenshot copy failed: ' + err.message);
        }
    }

    // ============================================
    // INIT
    // ============================================
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(createUI, 1500);
                setupRiskReminderObserver();
                setupPnlModalObserver(); // Watch for PNL share modal
                setupClipboardRetryOnFocus(); // Retry clipboard when window focused
                startRiskReminderPolling(); // Always-on polling
                setTimeout(startPositionMonitoring, 2000); // Start position monitoring
            });
        } else {
            setTimeout(createUI, 1500);
            setupRiskReminderObserver();
            setupPnlModalObserver(); // Watch for PNL share modal
            setupClipboardRetryOnFocus(); // Retry clipboard when window focused
            startRiskReminderPolling(); // Always-on polling
            setTimeout(startPositionMonitoring, 2000); // Start position monitoring
        }
    }

    init();
})();
