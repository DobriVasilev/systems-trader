"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface FeedbackContextData {
  pageUrl: string;
  pagePath: string;
  clickX?: number;
  clickY?: number;
  selectedElement?: string;
  element?: {
    tag: string;
    id: string;
    classes: string[];
    selector: string;
  };
  consoleLogs?: any[];
  screenshot?: string | null;
}

interface FeedbackContextType {
  isOpen: boolean;
  isMinimized: boolean;
  contextData: FeedbackContextData | null;
  openFeedback: (data?: Partial<FeedbackContextData>) => void;
  closeFeedback: () => void;
  minimizeFeedback: () => void;
  restoreFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return context;
}

interface FeedbackProviderProps {
  children: React.ReactNode;
}

export function FeedbackProvider({ children }: FeedbackProviderProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [contextData, setContextData] = useState<FeedbackContextData | null>(null);

  const captureContext = useCallback((event?: MouseEvent): FeedbackContextData => {
    const data: FeedbackContextData = {
      pageUrl: window.location.href,
      pagePath: window.location.pathname,
    };

    if (event) {
      data.clickX = event.clientX;
      data.clickY = event.clientY;

      // Try to identify the clicked element
      const target = event.target as HTMLElement;
      if (target) {
        const elementInfo: string[] = [];

        if (target.id) {
          elementInfo.push(`#${target.id}`);
        }

        if (target.className && typeof target.className === 'string') {
          const classes = target.className.split(' ').filter(c => c.length > 0);
          if (classes.length > 0) {
            elementInfo.push(`.${classes.join('.')}`);
          }
        }

        if (target.tagName) {
          elementInfo.push(target.tagName.toLowerCase());
        }

        const text = target.textContent?.trim().substring(0, 50);
        if (text) {
          elementInfo.push(`"${text}${text.length >= 50 ? '...' : ''}"`);
        }

        data.selectedElement = elementInfo.join(' ');
      }
    }

    return data;
  }, []);

  const openFeedback = useCallback((data?: Partial<FeedbackContextData>) => {
    const defaultData = captureContext();
    setContextData({
      ...defaultData,
      ...data,
    });
    setIsOpen(true);
    setIsMinimized(false);
  }, [captureContext]);

  const closeFeedback = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setContextData(null);
  }, []);

  const minimizeFeedback = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restoreFeedback = useCallback(() => {
    setIsMinimized(false);
  }, []);

  // Global right-click handler (disabled - ElementInspector handles Alt+Right-click now)
  // useEffect(() => {
  //   if (!session?.user) return;

  //   const handleContextMenu = (event: MouseEvent) => {
  //     // Don't override right-click on text inputs, textareas, or contenteditable
  //     const target = event.target as HTMLElement;
  //     if (
  //       target.tagName === "INPUT" ||
  //       target.tagName === "TEXTAREA" ||
  //       target.isContentEditable
  //     ) {
  //       return;
  //     }

  //     // Check if Alt/Option key is pressed for feedback
  //     if (event.altKey) {
  //       event.preventDefault();
  //       event.stopPropagation();

  //       const data = captureContext(event);
  //       openFeedback(data);
  //     }
  //   };

  //   document.addEventListener("contextmenu", handleContextMenu, true);

  //   return () => {
  //     document.removeEventListener("contextmenu", handleContextMenu, true);
  //   };
  // }, [session, captureContext, openFeedback]);

  // Keyboard shortcut: Alt + F to open feedback
  useEffect(() => {
    if (!session?.user) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openFeedback();
      }

      // Escape to close
      if (event.key === "Escape" && isOpen && !isMinimized) {
        closeFeedback();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [session, isOpen, isMinimized, openFeedback, closeFeedback]);

  const value: FeedbackContextType = {
    isOpen,
    isMinimized,
    contextData,
    openFeedback,
    closeFeedback,
    minimizeFeedback,
    restoreFeedback,
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
    </FeedbackContext.Provider>
  );
}
