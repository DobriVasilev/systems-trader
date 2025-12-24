// TradingView Bridge v1.6.0 - Works on both TradingView.com and app.hyperliquid.xyz
console.log('[TV Bridge] Script starting...');

const BRIDGE_PORT = 3456;
const BRIDGE_URL = `http://localhost:${BRIDGE_PORT}`;
const IS_HYPERLIQUID = window.location.hostname === 'app.hyperliquid.xyz';
const IS_IN_IFRAME = window !== window.top;

console.log('[TV Bridge] Site:', IS_HYPERLIQUID ? 'Hyperliquid' : 'TradingView', '| In iframe:', IS_IN_IFRAME);

let currentOverlay = null;
let currentPositionData = null;
let debounceTimer = null;
let closeTimer = null;
let dialogObserver = null;
let isUpdatingOverlay = false;
let priceUpdateInterval = null;
let lastDialogState = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let isMinimized = false;
let isPinned = false;
let lastOverlayPosition = null; // Remember position for minimize/maximize

// Settings (fetched from app, with fallback defaults)
let settings = { risk: 1.00, leverage: 25, useMarketPrice: true, asset: 'BTC', price: 0 };

// =====================================================
// IFRAME COMMUNICATION (for Hyperliquid)
// =====================================================

if (IS_HYPERLIQUID && !IS_IN_IFRAME) {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const { type, data } = event.data || {};

    if (type === 'TV_BRIDGE_SHOW_OVERLAY') {
      showOverlay(data);
    } else if (type === 'TV_BRIDGE_HIDE_OVERLAY') {
      // Only hide if not pinned
      if (!isPinned) {
        removeOverlay();
      }
    } else if (type === 'TV_BRIDGE_UPDATE_OVERLAY') {
      if (currentOverlay && data) {
        currentPositionData = data;
        updateOverlayData(data);
      }
    }
  });
}

function sendToParent(type, data) {
  if (IS_IN_IFRAME && window.parent) {
    window.parent.postMessage({ type, data }, '*');
  }
}

// =====================================================
// SETTINGS
// =====================================================

async function fetchSettings() {
  try {
    const response = await fetch(`${BRIDGE_URL}/settings`);
    if (response.ok) {
      const data = await response.json();
      settings.risk = data.risk || 1;
      settings.leverage = data.leverage || 25;
      settings.asset = data.asset || 'BTC';
      settings.price = data.price || 0;
    }
  } catch (e) {}
}

async function fetchCurrentPrice() {
  try {
    const response = await fetch(`${BRIDGE_URL}/settings`);
    if (response.ok) {
      const data = await response.json();
      if (data.price > 0) {
        settings.price = data.price;
        return data.price;
      }
    }
  } catch (e) {}
  return null;
}

// =====================================================
// STYLES
// =====================================================

function injectStyles() {
  if (document.getElementById('tv-bridge-styles')) return;

  const style = document.createElement('style');
  style.id = 'tv-bridge-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    #tv-bridge-overlay {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: rgba(10, 10, 15, 0.98);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 16px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.15);
      animation: tv-bridge-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
      transition: width 0.2s, border-radius 0.2s;
    }

    #tv-bridge-overlay.minimized {
      width: 56px;
      border-radius: 12px;
      min-width: 56px;
    }

    #tv-bridge-overlay.minimized .tv-bridge-content,
    #tv-bridge-overlay.minimized .tv-bridge-footer,
    #tv-bridge-overlay.minimized .tv-bridge-title,
    #tv-bridge-overlay.minimized .tv-bridge-header-buttons {
      display: none;
    }

    #tv-bridge-overlay.minimized .tv-bridge-header {
      padding: 10px;
      justify-content: center;
      cursor: grab;
    }

    #tv-bridge-overlay.minimized .tv-bridge-header:active {
      cursor: grabbing;
    }

    @keyframes tv-bridge-slide-in {
      from { opacity: 0; transform: translateX(20px) scale(0.95); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }

    #tv-bridge-overlay * {
      box-sizing: border-box;
    }

    .tv-bridge-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: linear-gradient(180deg, rgba(22, 22, 32, 0.8) 0%, rgba(15, 15, 20, 0.6) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      cursor: grab;
      user-select: none;
    }

    .tv-bridge-header:active {
      cursor: grabbing;
    }

    .tv-bridge-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      min-width: 28px;
      min-height: 32px;
      flex-shrink: 0;
    }

    .tv-bridge-logo svg {
      filter: drop-shadow(0 2px 4px rgba(165, 180, 252, 0.3));
      width: 24px;
      height: 30px;
    }

    .tv-bridge-title {
      font-size: 14px;
      font-weight: 600;
      color: #f4f4f5;
      flex: 1;
      letter-spacing: -0.01em;
    }

    .tv-bridge-header-buttons {
      display: flex;
      gap: 6px;
    }

    .tv-bridge-btn-icon {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .tv-bridge-btn-icon:hover {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.3);
      color: #3B82F6;
    }

    .tv-bridge-btn-icon.active {
      background: rgba(59, 130, 246, 0.2);
      border-color: rgba(59, 130, 246, 0.5);
      color: #3B82F6;
    }

    .tv-bridge-content {
      padding: 16px;
    }

    .tv-bridge-direction {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 14px;
    }

    .tv-bridge-direction.long {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .tv-bridge-direction.short {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .tv-bridge-ladder {
      position: relative;
      background: rgba(22, 22, 32, 0.5);
      border-radius: 10px;
      padding: 12px;
      padding-left: 28px;
      margin-bottom: 14px;
    }

    .tv-bridge-ladder-arrow {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px;
      opacity: 0.7;
      animation: tv-bridge-arrow-pulse 2s ease-in-out infinite;
    }

    .tv-bridge-ladder-arrow.long { color: #22c55e; }
    .tv-bridge-ladder-arrow.short { color: #ef4444; }

    @keyframes tv-bridge-arrow-pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    .tv-bridge-price-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 4px;
    }

    .tv-bridge-price-row:last-child { margin-bottom: 0; }

    .tv-bridge-price-row.entry {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
    }

    .tv-bridge-price-label {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .tv-bridge-price-value {
      font-size: 14px;
      font-weight: 600;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    }

    .tv-bridge-price-value.tp { color: #22c55e; }
    .tv-bridge-price-value.entry { color: #f4f4f5; }
    .tv-bridge-price-value.sl { color: #ef4444; }

    .tv-bridge-checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
      padding: 10px 12px;
      background: rgba(22, 22, 32, 0.5);
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .tv-bridge-checkbox-row:hover { background: rgba(22, 22, 32, 0.8); }

    .tv-bridge-checkbox-row input {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: #3B82F6;
    }

    .tv-bridge-checkbox-row label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      flex: 1;
    }

    .tv-bridge-settings {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }

    .tv-bridge-setting {
      background: rgba(22, 22, 32, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 10px 12px;
      transition: border-color 0.2s;
    }

    .tv-bridge-setting:focus-within {
      border-color: rgba(59, 130, 246, 0.4);
    }

    .tv-bridge-setting-label {
      font-size: 10px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .tv-bridge-setting-input {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .tv-bridge-setting-prefix,
    .tv-bridge-setting-suffix {
      font-size: 14px;
      font-weight: 600;
      color: #f4f4f5;
    }

    .tv-bridge-setting input {
      width: 50px;
      background: transparent;
      border: none;
      font-size: 14px;
      font-weight: 600;
      color: #f4f4f5;
      text-align: center;
      outline: none;
      padding: 0;
      font-family: inherit;
    }

    .tv-bridge-setting input::-webkit-outer-spin-button,
    .tv-bridge-setting input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .tv-bridge-setting input[type=number] {
      -moz-appearance: textfield;
    }

    .tv-bridge-enter-btn {
      width: 100%;
      padding: 14px 16px;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .tv-bridge-enter-btn.long {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
    }

    .tv-bridge-enter-btn.short {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
    }

    .tv-bridge-enter-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      filter: brightness(1.1);
    }

    .tv-bridge-enter-btn:active:not(:disabled) { transform: translateY(0); }
    .tv-bridge-enter-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .tv-bridge-enter-btn.loading { pointer-events: none; }
    .tv-bridge-enter-btn.success { background: #22c55e !important; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3); }
    .tv-bridge-enter-btn.success.short { background: #ef4444 !important; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3); }
    .tv-bridge-enter-btn.error { background: #71717a !important; }

    .tv-bridge-footer {
      padding: 10px 16px;
      background: rgba(0, 0, 0, 0.2);
      border-top: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 10px;
      color: rgba(255, 255, 255, 0.3);
      text-align: center;
    }

    .tv-bridge-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: tv-bridge-spin 0.8s linear infinite;
    }

    @keyframes tv-bridge-spin {
      to { transform: rotate(360deg); }
    }

    /* Pin indicator */
    .tv-bridge-pinned-indicator {
      font-size: 9px;
      color: #3B82F6;
      margin-top: 2px;
    }

    /* Success notification banner */
    .tv-bridge-success-banner {
      position: absolute;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      z-index: 100;
      animation: tv-bridge-banner-in 0.3s ease-out;
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }

    .tv-bridge-success-banner.long {
      background: rgba(34, 197, 94, 0.95);
      color: white;
      box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4);
    }

    .tv-bridge-success-banner.short {
      background: rgba(239, 68, 68, 0.95);
      color: white;
      box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
    }

    @keyframes tv-bridge-banner-in {
      from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// =====================================================
// TIMEFRAME DETECTION
// =====================================================

function getChartTimeframe() {
  try {
    // For Hyperliquid embedded TradingView chart
    const intervalsContainer = document.getElementById('header-toolbar-intervals');
    if (intervalsContainer) {
      const activeBtn = intervalsContainer.querySelector('[aria-checked="true"]');
      if (activeBtn) {
        // Try data-value first, then aria-label
        const value = activeBtn.getAttribute('data-value');
        if (value) return value;
        const label = activeBtn.getAttribute('aria-label');
        if (label) return label.replace(' minutes', 'm').replace(' hours', 'h').replace(' days', 'D').replace(' weeks', 'W').replace(' months', 'M');
      }
    }
    // Fallback: look for any active interval button in iframes
    const activeInterval = document.querySelector('[data-role="button"][aria-checked="true"][data-value]');
    if (activeInterval) {
      return activeInterval.getAttribute('data-value');
    }
  } catch (e) {
    console.log('[TV Bridge] Timeframe detection error:', e);
  }
  return null;
}

// =====================================================
// PRICE FORMATTING
// =====================================================

function formatPrice(price) {
  if (!price) return '-';
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =====================================================
// OVERLAY CREATION
// =====================================================

function createOverlay(data) {
  const overlay = document.createElement('div');
  overlay.id = 'tv-bridge-overlay';

  const isLong = data.direction === 'long';
  const priceRows = isLong ? [
    { label: 'Take Profit', value: data.takeProfit, class: 'tp' },
    { label: 'Entry', value: data.entry, class: 'entry', id: 'entry-value' },
    { label: 'Stop Loss', value: data.stopLoss, class: 'sl' },
  ] : [
    { label: 'Stop Loss', value: data.stopLoss, class: 'sl' },
    { label: 'Entry', value: data.entry, class: 'entry', id: 'entry-value' },
    { label: 'Take Profit', value: data.takeProfit, class: 'tp' },
  ];

  const arrowSymbol = isLong ? '&#x2191;' : '&#x2193;';

  overlay.innerHTML = `
    <div class="tv-bridge-header">
      <div class="tv-bridge-logo" title="Click to minimize/expand">
        <svg viewBox="0 0 32 40" width="24" height="30">
          <defs>
            <linearGradient id="tvBridgeLuxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#e0e7ff" />
              <stop offset="100%" stop-color="#a5b4fc" />
            </linearGradient>
          </defs>
          <text x="16" y="32" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
            font-size="38" font-style="italic" font-weight="400" fill="url(#tvBridgeLuxGrad)" letter-spacing="-1">H</text>
        </svg>
      </div>
      <span class="tv-bridge-title">Hyperliquid Trader</span>
      <div class="tv-bridge-header-buttons">
        <button class="tv-bridge-btn-icon tv-bridge-pin ${isPinned ? 'active' : ''}" title="Pin overlay (keep visible when dialog closes)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v8m0 0l4-4m-4 4L8 6m4 10v6m-4-6h8"/>
            <circle cx="12" cy="14" r="2"/>
          </svg>
        </button>
        <button class="tv-bridge-btn-icon tv-bridge-minimize" title="Minimize">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="tv-bridge-content">
      <div class="tv-bridge-direction ${data.direction}">
        ${arrowSymbol} ${data.direction}
      </div>

      <div class="tv-bridge-ladder">
        <div class="tv-bridge-ladder-arrow ${data.direction}">${arrowSymbol}</div>
        ${priceRows.map(row => `
          <div class="tv-bridge-price-row ${row.class}">
            <span class="tv-bridge-price-label">${row.label}</span>
            <span class="tv-bridge-price-value ${row.class}" ${row.id ? `id="${row.id}"` : ''}>${formatPrice(row.value)}</span>
          </div>
        `).join('')}
      </div>

      <div class="tv-bridge-checkbox-row">
        <input type="checkbox" id="tv-bridge-use-market" ${settings.useMarketPrice ? 'checked' : ''}>
        <label for="tv-bridge-use-market">Use market price (auto-update)</label>
      </div>

      <div class="tv-bridge-settings">
        <div class="tv-bridge-setting">
          <div class="tv-bridge-setting-label">Risk (P&L)</div>
          <div class="tv-bridge-setting-input">
            <span class="tv-bridge-setting-prefix">$</span>
            <input type="number" id="tv-bridge-risk" value="${settings.risk}" step="0.1" min="0.1">
          </div>
        </div>
        <div class="tv-bridge-setting">
          <div class="tv-bridge-setting-label">Leverage</div>
          <div class="tv-bridge-setting-input">
            <input type="number" id="tv-bridge-leverage" value="${settings.leverage}" step="1" min="1" max="100">
            <span class="tv-bridge-setting-suffix">x</span>
          </div>
        </div>
      </div>

      <button class="tv-bridge-enter-btn ${data.direction}">
        Enter ${data.direction}
      </button>
    </div>

    <div class="tv-bridge-footer">
      ${isPinned ? '<div class="tv-bridge-pinned-indicator">PINNED</div>' : ''}
      ${IS_HYPERLIQUID ? 'Using Hyperliquid chart - exact price match!' : 'Tip: Use BYBIT:BTCUSDT.P or Hyperliquid chart'}<br>
      TradingView Bridge v1.6.0
    </div>
  `;

  // =====================================================
  // DRAG FUNCTIONALITY
  // =====================================================
  const header = overlay.querySelector('.tv-bridge-header');
  const logo = overlay.querySelector('.tv-bridge-logo');

  header.addEventListener('mousedown', (e) => {
    // When minimized, allow dragging from anywhere in header (including logo)
    // When expanded, exclude buttons and logo (logo is for expand)
    if (!isMinimized) {
      if (e.target.closest('.tv-bridge-btn-icon') || e.target.closest('.tv-bridge-logo')) return;
    } else {
      if (e.target.closest('.tv-bridge-btn-icon')) return;
    }
    isDragging = true;
    const rect = overlay.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentOverlay) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    const maxX = window.innerWidth - currentOverlay.offsetWidth;
    const maxY = window.innerHeight - currentOverlay.offsetHeight;
    currentOverlay.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    currentOverlay.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    currentOverlay.style.right = 'auto';
  });

  let justDragged = false;
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 100);
    }
    isDragging = false;
  });

  // =====================================================
  // MINIMIZE/EXPAND
  // =====================================================
  const minimizeBtn = overlay.querySelector('.tv-bridge-minimize');

  const toggleMinimize = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      overlay.classList.add('minimized');
    } else {
      overlay.classList.remove('minimized');
    }
  };

  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMinimize();
  });

  // Click on logo to expand when minimized (but not if we just dragged)
  logo.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isMinimized && !justDragged) {
      toggleMinimize();
    }
  });

  // =====================================================
  // PIN BUTTON
  // =====================================================
  const pinBtn = overlay.querySelector('.tv-bridge-pin');
  pinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isPinned = !isPinned;
    pinBtn.classList.toggle('active', isPinned);
    const footer = overlay.querySelector('.tv-bridge-footer');
    if (isPinned) {
      if (!footer.querySelector('.tv-bridge-pinned-indicator')) {
        const indicator = document.createElement('div');
        indicator.className = 'tv-bridge-pinned-indicator';
        indicator.textContent = 'PINNED';
        footer.insertBefore(indicator, footer.firstChild);
      }
    } else {
      const indicator = footer.querySelector('.tv-bridge-pinned-indicator');
      if (indicator) indicator.remove();
    }
  });

  // =====================================================
  // MARKET PRICE CHECKBOX
  // =====================================================
  const marketCheckbox = overlay.querySelector('#tv-bridge-use-market');
  marketCheckbox.addEventListener('change', () => {
    settings.useMarketPrice = marketCheckbox.checked;
    if (settings.useMarketPrice) {
      startPriceUpdates();
    } else {
      stopPriceUpdates();
      if (currentPositionData) {
        const entryEl = overlay.querySelector('#entry-value');
        if (entryEl) entryEl.textContent = formatPrice(currentPositionData.entry);
      }
    }
  });

  // =====================================================
  // INPUT HANDLERS
  // =====================================================
  const riskInput = overlay.querySelector('#tv-bridge-risk');
  const leverageInput = overlay.querySelector('#tv-bridge-leverage');

  riskInput.addEventListener('change', () => {
    settings.risk = parseFloat(riskInput.value) || 1;
  });

  leverageInput.addEventListener('change', () => {
    settings.leverage = parseInt(leverageInput.value) || 25;
  });

  // =====================================================
  // ENTER BUTTON
  // =====================================================
  const enterBtn = overlay.querySelector('.tv-bridge-enter-btn');
  enterBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!currentPositionData) return;

    const risk = parseFloat(riskInput.value) || settings.risk;
    const leverage = parseInt(leverageInput.value) || settings.leverage;

    let entryPrice = currentPositionData.entry;
    if (settings.useMarketPrice) {
      const entryEl = overlay.querySelector('#entry-value');
      if (entryEl) {
        const parsed = parseFloat(entryEl.textContent.replace(/,/g, ''));
        if (!isNaN(parsed)) entryPrice = parsed;
      }
    }

    enterBtn.disabled = true;
    enterBtn.classList.add('loading');
    enterBtn.innerHTML = `<div class="tv-bridge-spinner"></div> Executing...`;

    // Detect timeframe from chart
    const timeframe = getChartTimeframe();

    try {
      const response = await fetch(`${BRIDGE_URL}/execute-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: currentPositionData.direction,
          entry: entryPrice,
          stopLoss: currentPositionData.stopLoss,
          takeProfit: currentPositionData.takeProfit,
          risk: risk,
          leverage: leverage,
          timeframe: timeframe
        })
      });

      const result = await response.json();

      if (result.success) {
        enterBtn.classList.remove('loading');
        enterBtn.classList.add('success');
        enterBtn.innerHTML = `&#x2713; Trade Sent!`;

        // Show success banner notification
        const banner = document.createElement('div');
        banner.className = `tv-bridge-success-banner ${currentPositionData.direction}`;
        const tfLabel = timeframe ? ` (${timeframe})` : '';
        banner.innerHTML = `&#x2713; ${currentPositionData.direction.toUpperCase()}${tfLabel} Trade Entered!`;
        document.body.appendChild(banner);

        // Remove banner after 3 seconds
        setTimeout(() => {
          if (banner && document.body.contains(banner)) {
            banner.style.opacity = '0';
            banner.style.transition = 'opacity 0.3s';
            setTimeout(() => banner.remove(), 300);
          }
        }, 3000);

        setTimeout(() => {
          // Auto-minimize after successful trade
          if (!isMinimized) {
            isMinimized = true;
            currentOverlay.classList.add('minimized');
          }
          // Reset button after animation
          setTimeout(() => {
            if (enterBtn && document.contains(enterBtn)) {
              enterBtn.classList.remove('success');
              enterBtn.disabled = false;
              enterBtn.innerHTML = `Enter ${currentPositionData?.direction || 'long'}`;
            }
          }, 500);
        }, 1500);
      } else {
        throw new Error(result.error || 'Trade failed');
      }
    } catch (e) {
      enterBtn.classList.remove('loading');
      enterBtn.classList.add('error');
      enterBtn.innerHTML = `App not running`;

      setTimeout(() => {
        if (enterBtn && document.contains(enterBtn)) {
          enterBtn.classList.remove('error');
          enterBtn.disabled = false;
          enterBtn.innerHTML = `Enter ${currentPositionData?.direction || 'long'}`;
        }
      }, 3000);
    }
  });

  if (settings.useMarketPrice) {
    startPriceUpdates();
  }

  return overlay;
}

// =====================================================
// PRICE UPDATES
// =====================================================

function startPriceUpdates() {
  stopPriceUpdates();
  priceUpdateInterval = setInterval(async () => {
    if (!currentOverlay || !settings.useMarketPrice) return;
    const price = await fetchCurrentPrice();
    if (price && price > 0) {
      const entryEl = currentOverlay.querySelector('#entry-value');
      if (entryEl) {
        entryEl.textContent = formatPrice(price);
      }
    }
  }, 500);
}

function stopPriceUpdates() {
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    priceUpdateInterval = null;
  }
}

// =====================================================
// OVERLAY MANAGEMENT
// =====================================================

async function showOverlay(data) {
  isUpdatingOverlay = true;
  try {
    injectStyles();
    currentPositionData = data;

    // Clean up any orphaned overlays (fix duplicate window bug)
    const existingOverlay = document.getElementById('tv-bridge-overlay');
    if (existingOverlay && existingOverlay !== currentOverlay) {
      existingOverlay.remove();
    }

    // Check if currentOverlay is still in DOM
    if (currentOverlay && !document.body.contains(currentOverlay)) {
      currentOverlay = null;
    }

    if (!currentOverlay) {
      await fetchSettings();
      currentOverlay = createOverlay(data);
      document.body.appendChild(currentOverlay);
      // If was minimized before, restore that state
      if (isMinimized) {
        currentOverlay.classList.add('minimized');
      }
    } else {
      updateOverlayData(data);
    }
  } finally {
    setTimeout(() => { isUpdatingOverlay = false; }, 50);
  }
}

function updateOverlayData(data) {
  if (!currentOverlay) return;

  const isLong = data.direction === 'long';
  const arrowSymbol = isLong ? '&#x2191;' : '&#x2193;';

  const directionEl = currentOverlay.querySelector('.tv-bridge-direction');
  if (directionEl) {
    directionEl.className = `tv-bridge-direction ${data.direction}`;
    directionEl.innerHTML = `${arrowSymbol} ${data.direction}`;
  }

  const arrowEl = currentOverlay.querySelector('.tv-bridge-ladder-arrow');
  if (arrowEl) {
    arrowEl.className = `tv-bridge-ladder-arrow ${data.direction}`;
    arrowEl.innerHTML = arrowSymbol;
  }

  const priceRows = isLong ? [
    { label: 'Take Profit', value: data.takeProfit, class: 'tp' },
    { label: 'Entry', value: settings.useMarketPrice ? null : data.entry, class: 'entry' },
    { label: 'Stop Loss', value: data.stopLoss, class: 'sl' },
  ] : [
    { label: 'Stop Loss', value: data.stopLoss, class: 'sl' },
    { label: 'Entry', value: settings.useMarketPrice ? null : data.entry, class: 'entry' },
    { label: 'Take Profit', value: data.takeProfit, class: 'tp' },
  ];

  const existingRows = currentOverlay.querySelectorAll('.tv-bridge-price-row');
  existingRows.forEach((row, i) => {
    if (priceRows[i]) {
      row.className = `tv-bridge-price-row ${priceRows[i].class}`;
      const labelEl = row.querySelector('.tv-bridge-price-label');
      if (labelEl) labelEl.textContent = priceRows[i].label;
      const valueEl = row.querySelector('.tv-bridge-price-value');
      if (valueEl) {
        valueEl.className = `tv-bridge-price-value ${priceRows[i].class}`;
        if (priceRows[i].value !== null) {
          valueEl.textContent = formatPrice(priceRows[i].value);
        }
      }
    }
  });

  const enterBtn = currentOverlay.querySelector('.tv-bridge-enter-btn');
  if (enterBtn && !enterBtn.classList.contains('loading') && !enterBtn.classList.contains('success') && !enterBtn.classList.contains('error')) {
    enterBtn.className = `tv-bridge-enter-btn ${data.direction}`;
    enterBtn.innerHTML = `Enter ${data.direction}`;
  }
}

function removeOverlay() {
  stopPriceUpdates();
  if (currentOverlay) {
    isUpdatingOverlay = true;
    currentOverlay.remove();
    currentOverlay = null;
    // Don't clear position data if pinned - keep it for next time
    if (!isPinned) {
      currentPositionData = null;
    }
    lastDialogState = null;
    setTimeout(() => { isUpdatingOverlay = false; }, 50);
  }
}

// =====================================================
// POSITION DATA EXTRACTION
// =====================================================

function extractPositionData(dialog) {
  try {
    const dialogName = dialog.getAttribute('data-dialog-name');
    if (!dialogName) return null;

    const isLong = dialogName.toLowerCase().includes('long');
    const isShort = dialogName.toLowerCase().includes('short');
    if (!isLong && !isShort) return null;

    const prefix = isLong ? 'long' : 'short';

    const getValue = (propId) => {
      const selector = `input[data-property-id="Risk/Reward${prefix}${propId}"]`;
      const input = dialog.querySelector(selector);
      if (!input) return null;
      return parseFloat(input.value.replace(/,/g, ''));
    };

    const entry = getValue('EntryPrice');
    const tp = getValue('ProfitLevelPrice');
    const sl = getValue('StopLevelPrice');

    if (!entry || !sl) return null;

    return {
      direction: isLong ? 'long' : 'short',
      entry,
      stopLoss: sl,
      takeProfit: tp,
      timestamp: Date.now()
    };
  } catch (e) {
    return null;
  }
}

// =====================================================
// DIALOG DETECTION
// =====================================================

function checkForDialog() {
  if (isUpdatingOverlay) return;

  try {
    const dialog = document.querySelector('[data-dialog-name="Long Position"], [data-dialog-name="Short Position"]');
    const dialogName = dialog ? dialog.getAttribute('data-dialog-name') : null;

    // Only log when state changes
    if (dialogName !== lastDialogState) {
      if (dialogName) {
        console.log('[TV Bridge] Dialog:', dialogName);
      }
      lastDialogState = dialogName;
    }

    if (dialog) {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }

      const data = extractPositionData(dialog);
      if (data) {
        if (IS_HYPERLIQUID && IS_IN_IFRAME) {
          sendToParent('TV_BRIDGE_SHOW_OVERLAY', data);
        } else {
          showOverlay(data);
        }
        observeDialog(dialog);
      }
    } else if ((currentOverlay || (IS_HYPERLIQUID && IS_IN_IFRAME)) && !closeTimer && !isPinned) {
      // Don't hide if pinned
      closeTimer = setTimeout(() => {
        const stillExists = document.querySelector('[data-dialog-name="Long Position"], [data-dialog-name="Short Position"]');
        if (!stillExists && !isPinned) {
          if (IS_HYPERLIQUID && IS_IN_IFRAME) {
            sendToParent('TV_BRIDGE_HIDE_OVERLAY', null);
          } else {
            removeOverlay();
          }
        }
        closeTimer = null;
      }, 500);
    }
  } catch (e) {}
}

function observeDialog(dialog) {
  if (dialogObserver) dialogObserver.disconnect();

  dialog.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const data = extractPositionData(dialog);
        if (data) {
          if (IS_HYPERLIQUID && IS_IN_IFRAME) {
            sendToParent('TV_BRIDGE_UPDATE_OVERLAY', data);
          } else {
            showOverlay(data);
          }
        }
      }, 100);
    });
  });

  dialogObserver = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const data = extractPositionData(dialog);
      if (data) {
        if (IS_HYPERLIQUID && IS_IN_IFRAME) {
          sendToParent('TV_BRIDGE_UPDATE_OVERLAY', data);
        } else {
          showOverlay(data);
        }
      }
    }, 100);
  });

  dialogObserver.observe(dialog, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });
}

// =====================================================
// INITIALIZATION
// =====================================================

function startWatching() {
  if (IS_HYPERLIQUID && !IS_IN_IFRAME) {
    console.log('[TV Bridge] Main page mode - waiting for iframe');
    return;
  }

  checkForDialog();
  const observer = new MutationObserver(checkForDialog);
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(checkForDialog, 500);
}

try {
  if (document.body) {
    startWatching();
  } else {
    document.addEventListener('DOMContentLoaded', startWatching);
  }
} catch (e) {}

// =====================================================
// HYPERLIQUID FULLSCREEN CHART (Shift+G)
// Makes chart fullscreen while keeping drawing tools
// =====================================================

if (IS_HYPERLIQUID && !IS_IN_IFRAME) {
  console.log('[TV Bridge] Initializing fullscreen chart feature...');

  let hlFullscreen = false;
  let hlChartGrid = null;
  let hlOriginalStyle = '';
  let hlFsBtn = null;

  function hlGetChartGrid() {
    const tv = document.getElementById('tv_chart_container');
    if (!tv) return null;
    let el = tv;
    while (el && !el.classList.contains('react-grid-item')) {
      el = el.parentElement;
    }
    return el;
  }

  function hlEnableFullscreen() {
    hlChartGrid = hlGetChartGrid();
    if (!hlChartGrid) {
      console.log('[TV Bridge] Chart grid not found for fullscreen');
      return;
    }

    hlOriginalStyle = hlChartGrid.getAttribute('style') || '';

    hlChartGrid.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 99999 !important;
      transform: none !important;
    `;

    document.body.style.overflow = 'hidden';
    hlFullscreen = true;
    hlUpdateFsBtn();
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    console.log('[TV Bridge] Fullscreen enabled');
  }

  function hlDisableFullscreen() {
    if (hlChartGrid) {
      hlChartGrid.setAttribute('style', hlOriginalStyle);
    }
    document.body.style.overflow = '';
    hlFullscreen = false;
    hlUpdateFsBtn();
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    console.log('[TV Bridge] Fullscreen disabled');
  }

  function hlToggleFullscreen() {
    hlFullscreen ? hlDisableFullscreen() : hlEnableFullscreen();
  }

  function hlCreateFsBtn() {
    if (document.getElementById('hl-fullscreen-btn')) {
      hlFsBtn = document.getElementById('hl-fullscreen-btn');
      return;
    }
    if (!document.getElementById('tv_chart_container')) return;

    hlFsBtn = document.createElement('button');
    hlFsBtn.id = 'hl-fullscreen-btn';
    hlFsBtn.onclick = hlToggleFullscreen;
    document.body.appendChild(hlFsBtn);
    hlUpdateFsBtn();
    console.log('[TV Bridge] Fullscreen button created');
  }

  function hlUpdateFsBtn() {
    if (!hlFsBtn) return;

    hlFsBtn.style.cssText = `
      position: fixed;
      top: ${hlFullscreen ? '50px' : '8px'};
      right: 8px;
      z-index: 9999999;
      background: rgba(26, 46, 56, 0.9);
      border: 1px solid #5EEAD4;
      border-radius: 4px;
      padding: 6px;
      color: #5EEAD4;
      font: 11px system-ui;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      overflow: hidden;
      max-width: 28px;
    `;

    hlFsBtn.onmouseenter = () => { hlFsBtn.style.maxWidth = '200px'; hlFsBtn.style.padding = '6px 10px'; };
    hlFsBtn.onmouseleave = () => { hlFsBtn.style.maxWidth = '28px'; hlFsBtn.style.padding = '6px'; };

    hlFsBtn.innerHTML = hlFullscreen
      ? `<span style="margin-right:4px">✕</span><span>Exit (Esc)</span>`
      : `<span style="margin-right:4px">⛶</span><span>Fullscreen (⇧G)</span>`;
  }

  // Keyboard: Shift+G to toggle, Esc to exit
  document.addEventListener('keydown', e => {
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'G') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      e.stopPropagation();
      hlToggleFullscreen();
    }
    if (e.key === 'Escape' && hlFullscreen) {
      e.preventDefault();
      hlDisableFullscreen();
    }
  }, true);

  // Wait for chart and create button
  function hlWaitForChart() {
    const check = () => {
      if (document.getElementById('tv_chart_container')) {
        hlCreateFsBtn();
      } else {
        setTimeout(check, 1000);
      }
    };
    check();
  }

  // Watch for SPA navigation
  new MutationObserver(() => {
    if (!document.getElementById('hl-fullscreen-btn') && document.getElementById('tv_chart_container')) {
      hlCreateFsBtn();
    }
  }).observe(document.body, { childList: true, subtree: true });

  hlWaitForChart();
}

console.log('[TV Bridge] Ready');
