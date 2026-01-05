export default {
  async fetch(request) {
    const VERSION = '0.2.17';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hyperliquid Trader - Download</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            color: #f4f4f5;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container { text-align: center; max-width: 700px; }
        .logo { font-size: 48px; margin-bottom: 16px; }
        h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
        .subtitle { color: #a1a1aa; font-size: 16px; margin-bottom: 40px; }
        .download-btn {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            padding: 16px 32px;
            font-size: 18px;
            font-weight: 600;
            color: white;
            background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
            border: none;
            border-radius: 12px;
            cursor: pointer;
            text-decoration: none;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
        }
        .download-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 30px rgba(59, 130, 246, 0.5);
        }
        .os-badge {
            display: inline-block;
            padding: 4px 12px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            font-size: 13px;
            margin-left: 8px;
        }
        .other-platforms { margin-top: 32px; color: #71717a; font-size: 14px; }
        .platform-links {
            margin-top: 12px;
            display: flex;
            gap: 16px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .platform-link {
            color: #a1a1aa;
            text-decoration: none;
            font-size: 13px;
            padding: 8px 16px;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            transition: all 0.2s;
        }
        .platform-link:hover {
            border-color: #3B82F6;
            color: #3B82F6;
        }
        .platform-link.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .version { margin-top: 40px; color: #52525b; font-size: 12px; }
        .features {
            margin-top: 48px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            text-align: center;
        }
        .feature { padding: 16px; }
        .feature-icon { font-size: 24px; margin-bottom: 8px; }
        .feature-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .feature-desc { font-size: 12px; color: #71717a; }
        .new-badge {
            display: inline-block;
            background: #22c55e;
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 6px;
            font-weight: 600;
        }
        .changelog {
            margin-top: 32px;
            padding: 16px;
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            text-align: left;
        }
        .changelog h3 {
            font-size: 14px;
            margin-bottom: 8px;
            color: #a1a1aa;
        }
        .changelog ul {
            font-size: 13px;
            color: #71717a;
            padding-left: 20px;
        }
        .changelog li { margin-bottom: 4px; }

        /* Platform Setup Sections */
        .setup-section {
            margin-top: 24px;
            padding: 20px;
            border-radius: 12px;
            text-align: left;
        }
        .setup-section.mac {
            background: rgba(168, 168, 168, 0.1);
            border: 1px solid rgba(168, 168, 168, 0.3);
        }
        .setup-section.windows {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .setup-section.linux {
            background: rgba(251, 146, 60, 0.1);
            border: 1px solid rgba(251, 146, 60, 0.3);
        }
        .setup-section h3 {
            font-size: 16px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .setup-section.mac h3 { color: #a8a8a8; }
        .setup-section.windows h3 { color: #3B82F6; }
        .setup-section.linux h3 { color: #fb923c; }
        .setup-section p {
            font-size: 13px;
            color: #a1a1aa;
            margin-bottom: 12px;
        }
        .setup-section ol {
            font-size: 13px;
            color: #a1a1aa;
            padding-left: 20px;
            margin-bottom: 16px;
        }
        .setup-section li {
            margin-bottom: 8px;
        }
        .code-block {
            background: #0a0a0f;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 12px 16px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 11px;
            color: #22c55e;
            overflow-x: auto;
            white-space: nowrap;
            position: relative;
        }
        .copy-btn {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: #3B82F6;
            color: white;
            border: none;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
        }
        .copy-btn:hover { background: #2563EB; }

        @media (max-width: 600px) {
            .features { grid-template-columns: 1fr; }
            .code-block { font-size: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">📈</div>
        <h1>Hyperliquid Trader</h1>
        <p class="subtitle">Professional risk-based trading for Hyperliquid</p>

        <a href="#" id="downloadBtn" class="download-btn">
            <span id="btnText">Download</span>
        </a>

        <div class="other-platforms">
            Other platforms:
            <div class="platform-links">
                <a href="https://github.com/DobriVasilev/hyperliquid-trader/releases/download/v${VERSION}/Hyperliquid.Trader_${VERSION}_aarch64.dmg" class="platform-link">Mac (M1/M2/M3)</a>
                <a href="https://github.com/DobriVasilev/hyperliquid-trader/releases/download/v${VERSION}/Hyperliquid.Trader_${VERSION}_amd64.AppImage" class="platform-link">Linux / Chromebook</a>
                <a href="https://github.com/DobriVasilev/hyperliquid-trader/releases/download/v${VERSION}/Hyperliquid.Trader_${VERSION}_x64-setup.exe" class="platform-link">Windows</a>
            </div>
        </div>

        <div class="features">
            <div class="feature">
                <div class="feature-icon">🎯</div>
                <div class="feature-title">Risk-Based Sizing</div>
                <div class="feature-desc">Set your risk, get exact position size</div>
            </div>
            <div class="feature">
                <div class="feature-icon">📊</div>
                <div class="feature-title">TradingView Integration</div>
                <div class="feature-desc">Draw on charts, execute instantly</div>
            </div>
            <div class="feature">
                <div class="feature-icon">🚨</div>
                <div class="feature-title">Emergency Withdraw<span class="new-badge">NEW</span></div>
                <div class="feature-desc">Withdraw funds even if UI blocked</div>
            </div>
        </div>

        <div class="changelog">
            <h3>What's New in v${VERSION}</h3>
            <ul>
                <li>Fixed Touch ID authentication on macOS</li>
                <li>Added Windows Hello biometric support</li>
                <li>Added Linux password authentication</li>
                <li>Auto-update now working!</li>
            </ul>
        </div>

        <!-- Mac Instructions -->
        <div class="setup-section mac">
            <h3> Mac Setup</h3>
            <p>macOS may show <strong>"App is damaged"</strong> warning for unsigned apps. To fix:</p>
            <ol>
                <li>Download and open the <strong>.dmg</strong> file</li>
                <li>Drag the app to <strong>Applications</strong></li>
                <li>Open <strong>Terminal</strong> and run this command:</li>
            </ol>
            <div class="code-block" id="macCmd">
xattr -cr /Applications/Hyperliquid\\ Trader.app
                <button class="copy-btn" onclick="copyCommand('macCmd')">Copy</button>
            </div>
            <p style="margin-top: 12px; font-size: 12px; color: #71717a;">
                Then open the app normally. You only need to do this once.
            </p>
        </div>

        <!-- Windows Instructions -->
        <div class="setup-section windows">
            <h3> Windows Setup</h3>
            <p>Windows SmartScreen may block the installer. To proceed:</p>
            <ol>
                <li>Download and run the <strong>.exe</strong> installer</li>
                <li>When SmartScreen appears, click <strong>"More info"</strong></li>
                <li>Click <strong>"Run anyway"</strong> to install</li>
            </ol>
            <p style="font-size: 12px; color: #71717a;">
                This is normal for apps not signed with an expensive certificate. The app is safe.
            </p>
        </div>

        <!-- Chromebook/Linux Instructions -->
        <div class="setup-section linux">
            <h3>💻 Chromebook / Linux Setup</h3>
            <p>Chromebooks require Linux (Crostini) to be enabled. Here's a one-command setup:</p>
            <ol>
                <li>Enable Linux in Chrome OS Settings → Advanced → Developers → Linux</li>
                <li>Download the <strong>.AppImage</strong> file and move it to your <strong>Linux files</strong> folder</li>
                <li>Open the <strong>Terminal</strong> app and paste this command:</li>
            </ol>
            <div class="code-block" id="linuxCmd">
cd ~ && chmod +x Hyperliquid*.AppImage && sudo apt update && sudo apt install -y libgles2-mesa libegl1-mesa libgtk-3-0 libwebkit2gtk-4.1-0 && ./Hyperliquid*.AppImage
                <button class="copy-btn" onclick="copyCommand('linuxCmd')">Copy</button>
            </div>
            <p style="margin-top: 12px; font-size: 12px; color: #71717a;">
                This installs required dependencies and launches the app. You only need to do this once.
            </p>
        </div>

        <div class="version">v${VERSION} • macOS, Windows & Linux • Requires Chrome extension for TradingView</div>
    </div>

    <script>
        const REPO = 'DobriVasilev/hyperliquid-trader';
        const VERSION = '${VERSION}';
        const downloads = {
            'mac-arm': 'https://github.com/' + REPO + '/releases/download/v' + VERSION + '/Hyperliquid.Trader_' + VERSION + '_aarch64.dmg',
            'windows': 'https://github.com/' + REPO + '/releases/download/v' + VERSION + '/Hyperliquid.Trader_' + VERSION + '_x64-setup.exe',
            'linux': 'https://github.com/' + REPO + '/releases/download/v' + VERSION + '/Hyperliquid.Trader_' + VERSION + '_amd64.AppImage',
            'chromeos': 'https://github.com/' + REPO + '/releases/download/v' + VERSION + '/Hyperliquid.Trader_' + VERSION + '_amd64.AppImage',
        };

        function detectOS() {
            const ua = navigator.userAgent;
            if (ua.includes('CrOS')) return 'chromeos';
            if (ua.includes('Win')) return 'windows';
            if (ua.includes('Linux')) return 'linux';
            if (ua.includes('Mac')) return 'mac-arm';
            return 'mac-arm';
        }

        function getOSName(os) {
            const names = {
                'mac-arm': 'Mac (Apple Silicon)',
                'windows': 'Windows',
                'linux': 'Linux',
                'chromeos': 'Chromebook'
            };
            return names[os] || 'Mac';
        }

        function getExt(os) {
            if (os === 'mac-arm') return 'dmg';
            if (os === 'windows') return 'exe';
            return 'AppImage';
        }

        const os = detectOS();
        const btn = document.getElementById('downloadBtn');
        const btnText = document.getElementById('btnText');
        btn.href = downloads[os] || downloads['mac-arm'];
        btnText.innerHTML = 'Download for ' + getOSName(os) + ' <span class="os-badge">.' + getExt(os) + '</span>';

        function copyCommand(elementId) {
            const el = document.getElementById(elementId);
            const cmd = el.innerText.replace('Copy', '').trim();
            navigator.clipboard.writeText(cmd);
            const copyBtn = el.querySelector('.copy-btn');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = 'Copy', 2000);
        }
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    });
  },
};
