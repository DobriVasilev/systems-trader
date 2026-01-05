"use client";

import { useState } from "react";

interface ExportButtonProps {
  sessionId: string;
  sessionName: string;
}

export function ExportButton({ sessionId, sessionName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleExport = async (options: {
    includeCandles: boolean;
    includeEvents: boolean;
    format: "json" | "download";
  }) => {
    setIsExporting(true);
    setShowOptions(false);

    try {
      const params = new URLSearchParams({
        includeCandles: options.includeCandles.toString(),
        includeEvents: options.includeEvents.toString(),
        format: options.format,
      });

      const response = await fetch(`/api/sessions/${sessionId}/export?${params}`);

      if (options.format === "download") {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sessionName.replace(/[^a-zA-Z0-9]/g, "-")}-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();

        // Copy to clipboard
        await navigator.clipboard.writeText(JSON.stringify(data.data, null, 2));
        alert("Export copied to clipboard!");
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export session");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={isExporting}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm
                 hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </>
        )}
      </button>

      {showOptions && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowOptions(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50">
            <div className="p-3 border-b border-gray-800">
              <h4 className="font-medium text-sm">Export Options</h4>
              <p className="text-xs text-gray-500 mt-1">
                Export data for Claude analysis
              </p>
            </div>

            <div className="p-2 space-y-1">
              {/* Quick export - Full */}
              <button
                onClick={() => handleExport({
                  includeCandles: true,
                  includeEvents: true,
                  format: "download",
                })}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-900/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium">Full Export</div>
                  <div className="text-xs text-gray-500">All data including candles</div>
                </div>
              </button>

              {/* Quick export - Analysis only */}
              <button
                onClick={() => handleExport({
                  includeCandles: false,
                  includeEvents: true,
                  format: "download",
                })}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-900/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium">Analysis Export</div>
                  <div className="text-xs text-gray-500">Detections & corrections only</div>
                </div>
              </button>

              {/* Copy to clipboard */}
              <button
                onClick={() => handleExport({
                  includeCandles: false,
                  includeEvents: false,
                  format: "json",
                })}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-green-900/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium">Copy to Clipboard</div>
                  <div className="text-xs text-gray-500">For pasting into Claude</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
