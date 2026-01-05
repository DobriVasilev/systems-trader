"use client";

import { useEffect, useCallback } from "react";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return shortcuts;
}

// Default shortcuts for pattern tool
export function usePatternToolShortcuts(handlers: {
  onRunDetection?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onToggleSidebar?: () => void;
  onEscape?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: "d",
      ctrl: true,
      action: handlers.onRunDetection || (() => {}),
      description: "Run pattern detection",
    },
    {
      key: "e",
      ctrl: true,
      action: handlers.onExport || (() => {}),
      description: "Export session",
    },
    {
      key: "s",
      ctrl: true,
      shift: true,
      action: handlers.onShare || (() => {}),
      description: "Share session",
    },
    {
      key: "b",
      ctrl: true,
      action: handlers.onToggleSidebar || (() => {}),
      description: "Toggle sidebar",
    },
    {
      key: "Escape",
      action: handlers.onEscape || (() => {}),
      description: "Close modal/cancel",
    },
  ];

  useKeyboardShortcuts({ shortcuts });

  return shortcuts;
}
