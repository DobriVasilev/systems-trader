"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  PatternType,
  PatternConfig,
  PatternSetting,
  PATTERN_CONFIGS,
  PATTERN_CATEGORIES,
} from "@/types/patterns";

interface PatternSelectorProps {
  value: PatternType;
  onChange: (pattern: PatternType) => void;
  settings: Record<string, unknown>;
  onSettingsChange: (settings: Record<string, unknown>) => void;
  disabled?: boolean;
}

type CategoryKey = keyof typeof PATTERN_CATEGORIES;

export function PatternSelector({
  value,
  onChange,
  settings,
  onSettingsChange,
  disabled = false,
}: PatternSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentConfig = PATTERN_CONFIGS[value];

  // Group patterns by category
  const patternsByCategory = useMemo(() => {
    const grouped: Record<CategoryKey, PatternConfig[]> = {} as Record<CategoryKey, PatternConfig[]>;

    Object.values(PATTERN_CONFIGS).forEach((config) => {
      const category = config.category as CategoryKey;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(config);
    });

    return grouped;
  }, []);

  // Filter patterns by search
  const filteredPatterns = useMemo(() => {
    if (!search.trim()) return null;

    const searchLower = search.toLowerCase();
    return Object.values(PATTERN_CONFIGS).filter(
      (config) =>
        config.label.toLowerCase().includes(searchLower) ||
        config.description.toLowerCase().includes(searchLower) ||
        config.value.toLowerCase().includes(searchLower)
    );
  }, [search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Auto-expand current pattern's category
  useEffect(() => {
    if (isOpen && currentConfig) {
      setExpandedCategory(currentConfig.category as CategoryKey);
    }
  }, [isOpen, currentConfig]);

  const handleSelect = (pattern: PatternType) => {
    onChange(pattern);
    setIsOpen(false);
    setSearch("");
  };

  const handleSettingChange = (key: string, value: unknown) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const renderSettingInput = (setting: PatternSetting) => {
    const currentValue = settings[setting.key] ?? setting.default;

    switch (setting.type) {
      case "select":
        return (
          <select
            value={String(currentValue)}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            disabled={disabled}
            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm
                     focus:outline-none focus:border-blue-500 min-w-[120px]"
          >
            {setting.options?.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "number":
        return (
          <input
            type="number"
            value={Number(currentValue)}
            onChange={(e) => handleSettingChange(setting.key, parseFloat(e.target.value) || 0)}
            min={setting.min}
            max={setting.max}
            step={setting.step || 1}
            disabled={disabled}
            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm w-20
                     focus:outline-none focus:border-blue-500"
          />
        );

      case "boolean":
        return (
          <button
            onClick={() => handleSettingChange(setting.key, !currentValue)}
            disabled={disabled}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              currentValue ? "bg-blue-600" : "bg-gray-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                currentValue ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        );

      case "range":
        return (
          <div className="flex items-center gap-2">
            <input
              type="range"
              value={Number(currentValue)}
              onChange={(e) => handleSettingChange(setting.key, parseFloat(e.target.value))}
              min={setting.min}
              max={setting.max}
              step={setting.step || 1}
              disabled={disabled}
              className="w-24"
            />
            <span className="text-xs text-gray-400 w-8">{String(currentValue)}</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Pattern Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                   hover:bg-gray-750 transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: PATTERN_CATEGORIES[currentConfig?.category as CategoryKey]?.color || "#666" }}
          />
          <span className="text-sm font-medium">{currentConfig?.label || value}</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-gray-900 border border-gray-700
                        rounded-lg shadow-xl max-h-[500px] overflow-hidden flex flex-col">
            {/* Search */}
            <div className="p-2 border-b border-gray-700">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patterns..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm
                         placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Pattern List */}
            <div className="overflow-y-auto flex-1">
              {filteredPatterns ? (
                // Search results
                <div className="p-1">
                  {filteredPatterns.length === 0 ? (
                    <div className="py-4 text-center text-gray-500 text-sm">No patterns found</div>
                  ) : (
                    filteredPatterns.map((config) => (
                      <PatternOption
                        key={config.value}
                        config={config}
                        isSelected={config.value === value}
                        onSelect={() => handleSelect(config.value)}
                      />
                    ))
                  )}
                </div>
              ) : (
                // Categorized list
                <div className="p-1">
                  {(Object.keys(PATTERN_CATEGORIES) as CategoryKey[]).map((categoryKey) => {
                    const category = PATTERN_CATEGORIES[categoryKey];
                    const patterns = patternsByCategory[categoryKey] || [];
                    const isExpanded = expandedCategory === categoryKey;
                    const hasSelectedPattern = patterns.some((p) => p.value === value);

                    return (
                      <div key={categoryKey} className="mb-0.5">
                        <button
                          onClick={() => setExpandedCategory(isExpanded ? null : categoryKey)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded
                                   hover:bg-gray-800 transition-colors ${hasSelectedPattern ? "bg-gray-800/50" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="text-sm font-medium">{category.label}</span>
                            <span className="text-xs text-gray-500">({patterns.length})</span>
                          </div>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <div className="ml-4 mt-0.5 border-l border-gray-700 pl-2">
                            {patterns.map((config) => (
                              <PatternOption
                                key={config.value}
                                config={config}
                                isSelected={config.value === value}
                                onSelect={() => handleSelect(config.value)}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pattern count */}
            <div className="px-3 py-2 border-t border-gray-700 bg-gray-800/50">
              <span className="text-xs text-gray-500">
                {Object.keys(PATTERN_CONFIGS).length} patterns available
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Settings Toggle */}
      {currentConfig?.settings && currentConfig.settings.length > 0 && (
        <button
          onClick={() => setShowSettings(!showSettings)}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
            showSettings
              ? "bg-blue-600 text-white"
              : "bg-gray-800 border border-gray-700 hover:bg-gray-750"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm">Settings</span>
        </button>
      )}

      {/* Settings Panel (inline) */}
      {showSettings && currentConfig?.settings && (
        <div className="flex items-center gap-4 pl-3 border-l border-gray-700">
          {currentConfig.settings.map((setting) => (
            <div key={setting.key} className="flex items-center gap-2">
              <label className="text-sm text-gray-400 whitespace-nowrap">{setting.label}:</label>
              {renderSettingInput(setting)}
            </div>
          ))}
        </div>
      )}

      {/* Pattern description */}
      <div className="hidden lg:block ml-auto text-sm text-gray-500 max-w-xs truncate">
        {currentConfig?.description}
      </div>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status?: PatternConfig["status"] }) {
  if (status === "ready") return null; // Don't show badge for ready patterns

  if (status === "beta") {
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-400 rounded">
        BETA
      </span>
    );
  }

  // Default to coming_soon for undefined status
  return (
    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-500/20 text-gray-400 rounded">
      SOON
    </span>
  );
}

// Pattern option component
function PatternOption({
  config,
  isSelected,
  onSelect,
  compact = false,
}: {
  config: PatternConfig;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const category = PATTERN_CATEGORIES[config.category as CategoryKey];
  const isComingSoon = !config.status || config.status === "coming_soon";

  return (
    <button
      onClick={onSelect}
      disabled={isComingSoon}
      className={`w-full flex items-start gap-2 px-2 py-1.5 rounded text-left
               transition-colors ${isSelected ? "bg-blue-600/20 border border-blue-500/30" : ""}
               ${isComingSoon ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-800"}`}
    >
      {!compact && (
        <div
          className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: category?.color || "#666" }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${compact ? "text-xs" : "text-sm"} ${isSelected ? "text-blue-400" : ""}`}>
            {config.label}
          </span>
          <StatusBadge status={config.status} />
          {config.settings && config.settings.length > 0 && !isComingSoon && (
            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </div>
        {!compact && <p className="text-xs text-gray-500 truncate">{config.description}</p>}
      </div>
      {isSelected && (
        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
