"use client";

export type ChartTool =
  | "select"       // Default - for selecting/viewing
  | "swing_high"   // Add swing high
  | "swing_low";   // Add swing low

interface ToolConfig {
  id: ChartTool;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  color: string;
  shortcut?: string;
}

const TOOLS: ToolConfig[] = [
  {
    id: "select",
    label: "Select / Pan",
    shortLabel: "Select",
    color: "#6b7280",
    shortcut: "V",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
  },
  {
    id: "swing_high",
    label: "Add Swing High",
    shortLabel: "High",
    color: "#26a69a",  // Green - bullish/upward
    shortcut: "1",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="8" r="4" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M12 12v8" />
      </svg>
    ),
  },
  {
    id: "swing_low",
    label: "Add Swing Low",
    shortLabel: "Low",
    color: "#ef5350",  // Red - bearish/downward
    shortcut: "2",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="16" r="4" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M12 4v8" />
      </svg>
    ),
  },
];

interface ChartToolbarProps {
  activeTool: ChartTool;
  onToolChange: (tool: ChartTool) => void;
  magnetMode?: boolean;
  onMagnetModeChange?: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ChartToolbar({ activeTool, onToolChange, magnetMode = false, onMagnetModeChange, disabled }: ChartToolbarProps) {
  const activeToolConfig = TOOLS.find((t) => t.id === activeTool);

  return (
    <div className="absolute left-4 top-4 z-20 flex flex-col gap-1">
      {/* Tools */}
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-800 p-1 shadow-xl">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            disabled={disabled}
            title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
            className={`
              w-10 h-10 flex items-center justify-center rounded-md transition-all
              ${activeTool === tool.id
                ? "bg-gray-700 text-white shadow-lg"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
            style={activeTool === tool.id ? { color: tool.color } : {}}
          >
            {tool.icon}
          </button>
        ))}

        {/* Divider */}
        <div className="h-px bg-gray-700 my-1" />

        {/* Magnet Mode Toggle */}
        <button
          onClick={() => onMagnetModeChange?.(!magnetMode)}
          disabled={disabled}
          title={`Magnet Mode (M) - Snap to candle levels`}
          className={`
            w-10 h-10 flex items-center justify-center rounded-md transition-all
            ${magnetMode
              ? "bg-blue-600 text-white shadow-lg"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h4v6a4 4 0 008 0V4h4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4V2M16 4V2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 14l-2 6M18 14l2 6" />
          </svg>
        </button>
      </div>

      {/* Active tool indicator */}
      {activeTool !== "select" && (
        <div
          className="mt-2 px-3 py-2 rounded-lg text-xs font-medium shadow-lg"
          style={{ backgroundColor: activeToolConfig?.color + "20", color: activeToolConfig?.color }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activeToolConfig?.color }} />
            {activeToolConfig?.label}
            <button
              onClick={() => onToolChange("select")}
              className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
              title="Cancel (ESC)"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="text-[10px] opacity-70 mt-1">
            Hold {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"} to snap to candle levels
          </div>
        </div>
      )}
    </div>
  );
}

// Export tool types and configs for use in parent components
export { TOOLS };
export type { ToolConfig };
