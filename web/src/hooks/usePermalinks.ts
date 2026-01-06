"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type PermalinkType = "comment" | "correction" | "detection";

export interface PermalinkState {
  type: PermalinkType | null;
  id: string | null;
  context?: number; // For threaded comments, how much parent context to show
}

/**
 * Hook for managing permalinks (deep links) to specific items
 * Supports: ?comment=id, ?correction=id, ?detection=id, ?context=N
 */
export function usePermalinks() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse current permalink from URL
  const currentPermalink: PermalinkState = {
    type: searchParams.get("comment")
      ? "comment"
      : searchParams.get("correction")
      ? "correction"
      : searchParams.get("detection")
      ? "detection"
      : null,
    id:
      searchParams.get("comment") ||
      searchParams.get("correction") ||
      searchParams.get("detection") ||
      null,
    context: searchParams.get("context")
      ? parseInt(searchParams.get("context")!, 10)
      : undefined,
  };

  // Track if we've scrolled to the permalink target
  const [hasScrolled, setHasScrolled] = useState(false);

  // Scroll to element when permalink is set
  useEffect(() => {
    if (!currentPermalink.id || hasScrolled) return;

    const elementId = `${currentPermalink.type}-${currentPermalink.id}`;
    const element = document.getElementById(elementId);

    if (element) {
      // Small delay to ensure rendering is complete
      setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHasScrolled(true);
      }, 100);
    }
  }, [currentPermalink.id, currentPermalink.type, hasScrolled]);

  // Reset scroll tracking when permalink changes
  useEffect(() => {
    setHasScrolled(false);
  }, [currentPermalink.id]);

  // Create a permalink URL
  const createPermalinkUrl = useCallback(
    (type: PermalinkType, id: string, context?: number) => {
      const url = new URL(window.location.href);
      // Clear other permalink types
      url.searchParams.delete("comment");
      url.searchParams.delete("correction");
      url.searchParams.delete("detection");
      // Set the new one
      url.searchParams.set(type, id);
      if (context !== undefined) {
        url.searchParams.set("context", context.toString());
      }
      return url.toString();
    },
    []
  );

  // Navigate to a permalink
  const navigateToPermalink = useCallback(
    (type: PermalinkType, id: string, context?: number) => {
      const params = new URLSearchParams();
      params.set(type, id);
      if (context !== undefined) {
        params.set("context", context.toString());
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname]
  );

  // Copy permalink to clipboard
  const copyPermalink = useCallback(
    (type: PermalinkType, id: string, context?: number) => {
      const url = createPermalinkUrl(type, id, context);
      navigator.clipboard.writeText(url);
      return url;
    },
    [createPermalinkUrl]
  );

  // Clear permalink from URL
  const clearPermalink = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  return {
    // Current permalink state
    currentPermalink,
    highlightedCommentId:
      currentPermalink.type === "comment" ? currentPermalink.id : null,
    highlightedCorrectionId:
      currentPermalink.type === "correction" ? currentPermalink.id : null,
    highlightedDetectionId:
      currentPermalink.type === "detection" ? currentPermalink.id : null,

    // Actions
    createPermalinkUrl,
    navigateToPermalink,
    copyPermalink,
    clearPermalink,
  };
}
