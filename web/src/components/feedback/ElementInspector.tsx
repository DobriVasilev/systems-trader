"use client";

import { useEffect, useState, useCallback } from "react";
import { useFeedback } from "@/contexts/FeedbackContext";
import { TELEGRAM_COLORS } from "@/lib/telegram-theme";

interface ElementInfo {
  tagName: string;
  id: string;
  classes: string[];
  path: string;
  rect: DOMRect;
  element: HTMLElement;
}

export function ElementInspector() {
  const [inspectedElement, setInspectedElement] = useState<ElementInfo | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const { openFeedback } = useFeedback();

  // Generate a CSS selector path for the element
  const getElementPath = useCallback((element: HTMLElement): string => {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      } else if (current.className) {
        const classes = Array.from(current.classList).filter(c => c.trim()).slice(0, 3);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }

      // Add nth-child if multiple siblings of same type
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }, []);

  const handleAltRightClick = useCallback(
    (e: MouseEvent) => {
      // Check for Alt + Right Click
      if (e.altKey && e.button === 2) {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const elementInfo: ElementInfo = {
          tagName: target.tagName,
          id: target.id || '(no id)',
          classes: Array.from(target.classList),
          path: getElementPath(target),
          rect,
          element: target,
        };

        setInspectedElement(elementInfo);
        setIsInspecting(true);
      }
    },
    [getElementPath]
  );

  const handleContextMenu = useCallback((e: MouseEvent) => {
    // Prevent default context menu when Alt is pressed
    if (e.altKey) {
      e.preventDefault();
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Close inspector on Escape
    if (e.key === 'Escape' && isInspecting) {
      setIsInspecting(false);
      setInspectedElement(null);
    }
  }, [isInspecting]);

  useEffect(() => {
    document.addEventListener('mousedown', handleAltRightClick, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleAltRightClick, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleAltRightClick, handleContextMenu, handleKeyDown]);

  const handleGiveFeedback = () => {
    if (!inspectedElement) return;

    // Capture console logs from the last few seconds
    const consoleLogs = (window as any).__consoleLogs || [];

    openFeedback({
      element: {
        tag: inspectedElement.tagName,
        id: inspectedElement.id,
        classes: inspectedElement.classes,
        selector: inspectedElement.path,
      },
      consoleLogs: consoleLogs.slice(-50), // Last 50 console logs
      screenshot: null, // Will be captured when user submits feedback
    });

    setIsInspecting(false);
    setInspectedElement(null);
  };

  const handleClose = () => {
    setIsInspecting(false);
    setInspectedElement(null);
  };

  if (!isInspecting || !inspectedElement) return null;

  return (
    <>
      {/* Highlighted overlay on the inspected element */}
      <div
        style={{
          position: 'fixed',
          left: inspectedElement.rect.left + window.scrollX,
          top: inspectedElement.rect.top + window.scrollY,
          width: inspectedElement.rect.width,
          height: inspectedElement.rect.height,
          border: `2px solid ${TELEGRAM_COLORS.primary}`,
          backgroundColor: `${TELEGRAM_COLORS.primary}20`,
          pointerEvents: 'none',
          zIndex: 9998,
        }}
      />

      {/* Info panel */}
      <div
        style={{
          position: 'fixed',
          left: Math.min(inspectedElement.rect.left, window.innerWidth - 350),
          top: Math.min(inspectedElement.rect.bottom + 10, window.innerHeight - 250),
          width: '320px',
          maxHeight: '400px',
          backgroundColor: TELEGRAM_COLORS.bgColor,
          border: `1px solid ${TELEGRAM_COLORS.border}`,
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: TELEGRAM_COLORS.headerBg,
            borderBottom: `1px solid ${TELEGRAM_COLORS.border}`,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ color: TELEGRAM_COLORS.text, fontSize: '16px', fontWeight: 600, margin: 0 }}>
            Element Inspector
          </h3>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: TELEGRAM_COLORS.hint,
              cursor: 'pointer',
              fontSize: '20px',
              padding: 0,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px', maxHeight: '300px', overflowY: 'auto' }}>
          {/* Tag name */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: TELEGRAM_COLORS.hint, fontSize: '12px', marginBottom: '4px' }}>
              Tag
            </div>
            <code
              style={{
                color: TELEGRAM_COLORS.text,
                backgroundColor: TELEGRAM_COLORS.secondaryBg,
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '14px',
                display: 'inline-block',
              }}
            >
              {inspectedElement.tagName.toLowerCase()}
            </code>
          </div>

          {/* ID */}
          {inspectedElement.id !== '(no id)' && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: TELEGRAM_COLORS.hint, fontSize: '12px', marginBottom: '4px' }}>
                ID
              </div>
              <code
                style={{
                  color: TELEGRAM_COLORS.text,
                  backgroundColor: TELEGRAM_COLORS.secondaryBg,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  display: 'inline-block',
                }}
              >
                #{inspectedElement.id}
              </code>
            </div>
          )}

          {/* Classes */}
          {inspectedElement.classes.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: TELEGRAM_COLORS.hint, fontSize: '12px', marginBottom: '4px' }}>
                Classes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {inspectedElement.classes.map((cls, idx) => (
                  <code
                    key={idx}
                    style={{
                      color: TELEGRAM_COLORS.text,
                      backgroundColor: TELEGRAM_COLORS.secondaryBg,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  >
                    .{cls}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Selector path */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: TELEGRAM_COLORS.hint, fontSize: '12px', marginBottom: '4px' }}>
              Selector Path
            </div>
            <div
              style={{
                color: TELEGRAM_COLORS.text,
                backgroundColor: TELEGRAM_COLORS.secondaryBg,
                padding: '8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
                maxHeight: '100px',
                overflowY: 'auto',
              }}
            >
              {inspectedElement.path}
            </div>
          </div>

          {/* Give Feedback button */}
          <button
            onClick={handleGiveFeedback}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: TELEGRAM_COLORS.primary,
              color: TELEGRAM_COLORS.buttonText,
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Give Feedback on this Element
          </button>
        </div>

        {/* Helper text */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: TELEGRAM_COLORS.secondaryBg,
            borderTop: `1px solid ${TELEGRAM_COLORS.border}`,
            fontSize: '11px',
            color: TELEGRAM_COLORS.hint,
            textAlign: 'center',
          }}
        >
          Press ESC to close • Alt+Right-click to inspect
        </div>
      </div>
    </>
  );
}
