"use client";

import { use, useMemo, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession as useAuthSession } from "next-auth/react";
import { useSession, PatternDetection } from "@/hooks/useSession";
import { useCandles } from "@/hooks/useCandles";
import { useRealtime } from "@/hooks/useRealtime";
import { CandlestickChart, ChartCandle, ChartMarker } from "@/components/chart/CandlestickChart";
import { ChartToolbar, ChartTool } from "@/components/chart/ChartToolbar";
import { ContextMenu } from "@/components/chart/ContextMenu";
import { CorrectionModal, CorrectionData } from "@/components/corrections";
import { CommentInput, CommentThread } from "@/components/comments";
import { OnlineUsers, CursorOverlay } from "@/components/realtime";
import { DetectionList } from "@/components/detections/DetectionList";
import { ShareModal } from "@/components/sharing/ShareModal";
import { usePermalinks } from "@/hooks/usePermalinks";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: authSession } = useAuthSession();
  const { session, isLoading: sessionLoading, error: sessionError, refetch } = useSession(id);
  const [isRunningDetection, setIsRunningDetection] = useState(false);

  // Chart container ref for cursor overlay
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Real-time collaboration
  const handleRealtimeChange = useCallback(() => {
    refetch();
  }, [refetch]);

  const { isConnected, onlineUsers, cursors, broadcastCursor } = useRealtime({
    sessionId: id,
    onDetectionChange: handleRealtimeChange,
    onCorrectionChange: handleRealtimeChange,
    onCommentChange: handleRealtimeChange,
    onSessionChange: handleRealtimeChange,
    enabled: true,
  });

  // Handle mouse move for cursor broadcasting
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!chartContainerRef.current || !authSession?.user) return;

      const rect = chartContainerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Throttle cursor updates (only send every 50ms)
      broadcastCursor(x, y, authSession.user.name || "Anonymous", authSession.user.image || undefined);
    },
    [authSession?.user, broadcastCursor]
  );

  // Correction modal state
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionMode, setCorrectionMode] = useState<"delete" | "move" | "add" | "confirm" | "unconfirm" | "options">("delete");
  const [selectedDetection, setSelectedDetection] = useState<PatternDetection | null>(null);
  const [addData, setAddData] = useState<{ time: number; price: number; candleIndex: number } | null>(null);

  // Move mode state - for moving detections to new locations
  const [movingDetection, setMovingDetection] = useState<PatternDetection | null>(null);
  const [moveTargetData, setMoveTargetData] = useState<{ time: number; price: number; candleIndex: number } | null>(null);

  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const isOwner = authSession?.user?.id === session?.createdBy?.id;

  // Pattern reasoning modal state
  const [isPatternReasoningOpen, setIsPatternReasoningOpen] = useState(false);

  // Permalink support (deep links to comments/corrections/detections)
  const {
    highlightedCommentId,
    highlightedCorrectionId,
    highlightedDetectionId,
    copyPermalink,
  } = usePermalinks();

  // Chart navigation/highlight state
  const [highlightMarkerId, setHighlightMarkerId] = useState<string | null>(null);
  const [navigateToTime, setNavigateToTime] = useState<number | null>(null);

  // Handle detection permalink - navigate to chart when detection permalink is set
  useEffect(() => {
    if (highlightedDetectionId && session?.detections) {
      const detection = session.detections.find((d) => d.id === highlightedDetectionId);
      if (detection) {
        const candleTime = new Date(detection.candleTime).getTime() / 1000;
        setNavigateToTime(candleTime);
        setHighlightMarkerId(highlightedDetectionId);
        // Clear highlight after 3 seconds
        const timeout = setTimeout(() => setHighlightMarkerId(null), 3000);
        return () => clearTimeout(timeout);
      }
    }
  }, [highlightedDetectionId, session?.detections]);

  // Collapsible section states
  const [sectionsCollapsed, setSectionsCollapsed] = useState({
    comments: false,
    changeLog: false,
    detections: false,
  });

  // Track markers being dragged (to hide original while dragging)
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const dragApiCallInProgressRef = useRef(false);

  // Undo history - stores correction info for optimistic undo
  interface UndoEntry {
    correctionId: string;
    correctionType: string;
    detectionId?: string;
    originalStatus?: string;
    movedDetectionId?: string; // For move: the new detection that was created
  }
  const [undoHistory, setUndoHistory] = useState<UndoEntry[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  // Chart tool state - like TradingView drawing tools
  const [activeTool, setActiveTool] = useState<ChartTool>("select");

  // Magnet mode - snaps to candle levels (high/low/open/close)
  const [magnetMode, setMagnetMode] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    marker: ChartMarker;
  } | null>(null);

  // Undo the last correction (optimistic update for instant feel)
  const handleUndo = useCallback(async () => {
    if (undoHistory.length === 0 || isUndoing) return;

    const lastEntry = undoHistory[undoHistory.length - 1];
    console.log('[Session] Undoing correction:', lastEntry.correctionId, lastEntry.correctionType);

    // Remove from history immediately (optimistic)
    setUndoHistory(prev => prev.slice(0, -1));
    setIsUndoing(true);

    // Make API call in background (don't await for UI)
    fetch(`/api/sessions/${id}/corrections/${lastEntry.correctionId}`, {
      method: "DELETE",
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          console.error("Undo API failed:", data.error);
          // Re-add to history on failure
          setUndoHistory(prev => [...prev, lastEntry]);
        }
        // Refetch in background to sync state
        refetch();
      })
      .catch(error => {
        console.error("Undo error:", error);
        // Re-add to history on failure
        setUndoHistory(prev => [...prev, lastEntry]);
      })
      .finally(() => {
        setIsUndoing(false);
      });
  }, [id, undoHistory, isUndoing, refetch]);

  // Keyboard shortcuts for tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Ctrl+Z / Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      const key = e.key;
      switch (key) {
        case "v":
        case "V":
          setActiveTool("select");
          setMovingDetection(null); // Cancel move mode
          break;
        case "1":
          setActiveTool("swing_high");
          setMovingDetection(null);
          break;
        case "2":
          setActiveTool("swing_low");
          setMovingDetection(null);
          break;
        case "m":
        case "M":
          setMagnetMode((prev) => !prev); // Toggle magnet mode
          break;
        case "Escape":
          setActiveTool("select");
          setMovingDetection(null); // Cancel move mode
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

  // Fetch fresh candles if session doesn't have them stored
  const { candles: fetchedCandles, isLoading: candlesLoading } = useCandles({
    symbol: session?.symbol || "BTC",
    timeframe: session?.timeframe || "4h",
    days: 30,
  });

  // Use stored candles if available, otherwise use fetched
  const candles: ChartCandle[] = useMemo(() => {
    if (session?.candleData?.candles && Array.isArray(session.candleData.candles)) {
      return session.candleData.candles;
    }
    return fetchedCandles;
  }, [session?.candleData, fetchedCandles]);

  // Convert detections to chart markers
  const markers: ChartMarker[] = useMemo(() => {
    if (!session?.detections) return [];

    // Filter out rejected (deleted) and moved detections
    const visibleDetections = session.detections.filter(
      (d) => d.status !== "rejected" && d.status !== "moved"
    );

    return visibleDetections.map((d) => {
      // Determine marker appearance based on detection type and status
      let color = "#4a90d9";
      let position: "aboveBar" | "belowBar" = "aboveBar";
      let shape: "circle" | "square" | "arrowUp" | "arrowDown" = "circle";

      // Check if this is a "closes" detection (vs "wicks")
      const isCloseDetection = d.metadata?.detection_mode === "closes";

      if (d.detectionType.includes("high") || d.detectionType.includes("bullish")) {
        color = d.detectionType.includes("bos") ? "#ff9800" : d.detectionType.includes("msb") ? "#9c27b0" : "#26a69a"; // Green for highs
        position = "aboveBar";
        // Use arrows for bos/msb, squares for close swings, circles for wick swings
        shape = d.detectionType.includes("bos") || d.detectionType.includes("msb")
          ? "arrowUp"
          : isCloseDetection ? "square" : "circle";
      } else if (d.detectionType.includes("low") || d.detectionType.includes("bearish")) {
        color = d.detectionType.includes("bos") ? "#ff9800" : d.detectionType.includes("msb") ? "#9c27b0" : "#ef5350"; // Red for lows
        position = "belowBar";
        // Use arrows for bos/msb, squares for close swings, circles for wick swings
        shape = d.detectionType.includes("bos") || d.detectionType.includes("msb")
          ? "arrowDown"
          : isCloseDetection ? "square" : "circle";
      }

      // Confirmed detections show in blue
      if (d.status === "confirmed") {
        color = "#2196f3"; // Blue for confirmed
      }

      // Build the text label - add (C) suffix for close detections
      let text = d.detectionType.replace("swing_", "").replace("_", " ").toUpperCase();
      if (isCloseDetection) {
        text += " (C)";
      }

      return {
        id: d.id,
        time: Math.floor(new Date(d.candleTime).getTime() / 1000),
        position,
        color,
        shape,
        text,
        size: 1,
      };
    });
  }, [session?.detections]);

  // Compute hidden marker IDs (markers being moved or dragged)
  const hiddenMarkerIds = useMemo(() => {
    const ids: string[] = [];
    if (movingDetection) ids.push(movingDetection.id);
    if (draggingMarkerId) ids.push(draggingMarkerId);
    return ids;
  }, [movingDetection, draggingMarkerId]);

  const isLoading = sessionLoading || (!session?.candleData?.candles && candlesLoading);

  const runDetection = async () => {
    if (!session) return;

    setIsRunningDetection(true);
    try {
      const response = await fetch(`/api/sessions/${id}/detections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_detection" }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to run detection");
      }

      // Refetch session to get updated detections
      await refetch();
    } catch (err) {
      console.error("Error running detection:", err);
      alert(err instanceof Error ? err.message : "Failed to run detection");
    } finally {
      setIsRunningDetection(false);
    }
  };

  // State for auto-setting detection type from toolbar
  const [autoDetectionType, setAutoDetectionType] = useState<string | null>(null);

  const handleCandleClick = (candle: ChartCandle, index: number) => {
    // Use snapped price if available (from click detection), otherwise fall back to close
    const snappedPrice = (candle as { _snappedPrice?: number })._snappedPrice ?? candle.close;

    console.log('[Session] handleCandleClick', {
      time: candle.time,
      index,
      snappedPrice,
      movingDetection: movingDetection?.id,
      activeTool
    });

    // If in move mode, handle as chart click to place the moving detection
    if (movingDetection) {
      console.log('[Session] In move mode, placing detection');
      setMoveTargetData({ time: candle.time, price: snappedPrice, candleIndex: index });
      setSelectedDetection(movingDetection);
      setCorrectionMode("move");
      setCorrectionModalOpen(true);
      return;
    }

    // Only trigger if a drawing tool is selected (not "select" mode)
    if (activeTool === "select") {
      console.log('[Session] activeTool is select, ignoring');
      return;
    }

    setAddData({ time: candle.time, price: snappedPrice, candleIndex: index });
    setAutoDetectionType(activeTool); // Pass the tool type to the modal
    setCorrectionMode("add");
    setSelectedDetection(null);
    setCorrectionModalOpen(true);
  };

  const handleMarkerClick = (marker: ChartMarker) => {
    // Find the detection that corresponds to this marker
    const detection = session?.detections.find((d) => d.id === marker.id);
    if (detection) {
      setSelectedDetection(detection);
      setAddData(null);
      setAutoDetectionType(null);
      // Show options mode - user can choose Confirm/Move/Delete
      setCorrectionMode("options");
      setCorrectionModalOpen(true);
    }
  };

  const handleChartClick = (time: number, price: number) => {
    // Find the candle index for this time
    const candleIndex = candles.findIndex((c) => c.time === time);
    if (candleIndex === -1) return;

    // Handle move mode - clicking sets the new position
    if (movingDetection) {
      setMoveTargetData({ time, price, candleIndex });
      setSelectedDetection(movingDetection);
      setCorrectionMode("move");
      setCorrectionModalOpen(true);
      return;
    }

    // Only trigger add if a drawing tool is selected (not "select" mode)
    if (activeTool === "select") return;

    setAddData({ time, price, candleIndex });
    setAutoDetectionType(activeTool); // Pass the tool type to the modal
    setCorrectionMode("add");
    setSelectedDetection(null);
    setCorrectionModalOpen(true);
  };

  const handleCorrectionSubmit = async (correctionData: CorrectionData) => {
    console.log('[Session] handleCorrectionSubmit called', { correctionType: correctionData.correctionType });
    try {
      const response = await fetch(`/api/sessions/${id}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(correctionData),
      });

      const data = await response.json();
      console.log('[Session] API response', { success: data.success, error: data.error });

      if (!data.success) {
        throw new Error(data.error || "Failed to submit correction");
      }

      // Add correction to undo history with full info for optimistic undo
      if (data.data?.id) {
        const undoEntry: UndoEntry = {
          correctionId: data.data.id,
          correctionType: correctionData.correctionType,
          detectionId: correctionData.detectionId,
          originalStatus: selectedDetection?.status,
        };
        setUndoHistory(prev => [...prev, undoEntry]);
        console.log('[Session] Added to undo history:', undoEntry);
      }

      // Refetch session to get updated data
      console.log('[Session] About to refetch session data');
      await refetch();
      console.log('[Session] Refetch completed');
    } catch (err) {
      console.error("[Session] Error submitting correction:", err);
      throw err;
    }
  };

  // Handle drag start (hide original marker while dragging)
  const handleMarkerDragStart = useCallback((marker: ChartMarker) => {
    setDraggingMarkerId(marker.id);
  }, []);

  // Handle drag end (clear dragging state only if drag was cancelled, not if API call is pending)
  const handleMarkerDragEnd = useCallback(() => {
    // Only clear if no API call is in progress
    // handleMarkerDrag will clear it after the API call completes
    if (!dragApiCallInProgressRef.current) {
      setDraggingMarkerId(null);
    }
  }, []);

  // Handle drag-and-drop for markers - opens modal for confirmation/comment
  const handleMarkerDrag = useCallback((marker: ChartMarker, newTime: number, newPrice: number) => {
    console.log('[Session] handleMarkerDrag called', { markerId: marker.id, newTime, newPrice });

    const detection = session?.detections.find((d) => d.id === marker.id);
    if (!detection) {
      console.log('[Session] Detection not found for marker', marker.id);
      setDraggingMarkerId(null);
      return;
    }

    // Find the candle index for the new position
    const candleIndex = candles.findIndex((c) => c.time === newTime);
    if (candleIndex === -1) {
      console.log('[Session] Candle not found for time', newTime);
      setDraggingMarkerId(null);
      return;
    }

    console.log('[Session] Opening move modal for drag', { candleIndex, newPrice });

    // Clear dragging state
    setDraggingMarkerId(null);

    // Open modal with move data pre-filled (user can add comment)
    setSelectedDetection(detection);
    setMoveTargetData({ time: newTime, price: newPrice, candleIndex });
    setCorrectionMode("move");
    setCorrectionModalOpen(true);
  }, [session?.detections, candles]);

  // Handle right-click context menu on markers
  const handleMarkerContextMenu = useCallback((marker: ChartMarker, x: number, y: number) => {
    setContextMenu({ x, y, marker });
  }, []);

  const openCorrectionModal = (mode: "delete" | "move" | "add" | "confirm" | "unconfirm", detection?: PatternDetection) => {
    console.log('[Session] openCorrectionModal', { mode, detectionId: detection?.id });

    // Move mode: don't open modal yet - wait for user to click new position
    if (mode === "move" && detection) {
      console.log('[Session] Entering move mode for detection', detection.id);
      setMovingDetection(detection);
      setMoveTargetData(null);
      return;
    }

    setCorrectionMode(mode);
    setSelectedDetection(detection || null);
    setAddData(null);
    setMoveTargetData(null);
    setCorrectionModalOpen(true);
  };

  // Comment handlers
  const handleAddComment = async (content: string, detectionId?: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          detectionId: detectionId || null,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to add comment");
      }

      await refetch();
    } catch (err) {
      console.error("Error adding comment:", err);
      throw err;
    }
  };

  const handleReplyComment = async (content: string, parentId: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          parentId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to add reply");
      }

      await refetch();
    } catch (err) {
      console.error("Error adding reply:", err);
      throw err;
    }
  };

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    try {
      const response = await fetch(`/api/sessions/${id}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          resolved,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to update comment");
      }

      await refetch();
    } catch (err) {
      console.error("Error resolving comment:", err);
      throw err;
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}/comments?commentId=${commentId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to delete comment");
      }

      await refetch();
    } catch (err) {
      console.error("Error deleting comment:", err);
      throw err;
    }
  };

  // Handle navigation to detection from comment/changelog - scroll to chart and highlight
  const handleNavigateToDetection = useCallback((detectionId: string) => {
    const detection = session?.detections.find((d) => d.id === detectionId);
    if (detection) {
      // Navigate chart to the detection's time and highlight it
      const candleTime = new Date(detection.candleTime).getTime() / 1000;
      setNavigateToTime(candleTime);
      setHighlightMarkerId(detectionId);

      // Clear highlight after 2 seconds
      setTimeout(() => {
        setHighlightMarkerId(null);
      }, 2000);
    }
  }, [session?.detections]);

  // Clear navigation after it completes
  const handleNavigationComplete = useCallback(() => {
    setNavigateToTime(null);
  }, []);

  // Export algorithm feedback for debugging/improvement
  const handleExportFeedback = useCallback(() => {
    if (!session) return;

    // Get context candles around each correction
    const getCandleContext = (candleIndex: number, windowSize = 10) => {
      const start = Math.max(0, candleIndex - windowSize);
      const end = Math.min(candles.length, candleIndex + windowSize + 1);
      return candles.slice(start, end).map((c, i) => ({
        index: start + i,
        ...c,
        isTarget: start + i === candleIndex,
      }));
    };

    const exportData = {
      exportedAt: new Date().toISOString(),
      session: {
        id: session.id,
        name: session.name,
        symbol: session.symbol,
        timeframe: session.timeframe,
        patternType: session.patternType,
        patternSettings: session.patternSettings,
        createdAt: session.createdAt,
        candleCount: candles.length,
        dateRange: candles.length > 0 ? {
          start: new Date(candles[0].time * 1000).toISOString(),
          end: new Date(candles[candles.length - 1].time * 1000).toISOString(),
        } : null,
      },
      summary: {
        totalDetections: session.detections.length,
        totalCorrections: session.corrections.length,
        correctionsByType: session.corrections.reduce((acc, c) => {
          acc[c.correctionType] = (acc[c.correctionType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      corrections: session.corrections.map((correction) => {
        const detection = correction.detectionId
          ? session.detections.find((d) => d.id === correction.detectionId)
          : null;

        return {
          id: correction.id,
          type: correction.correctionType,
          reason: correction.reason,
          createdAt: correction.createdAt,
          user: correction.user.name,
          original: detection ? {
            id: detection.id,
            candleIndex: detection.candleIndex,
            price: detection.price,
            type: detection.detectionType,
            structure: detection.structure,
            reasoning: (detection.metadata as { fullReasoning?: string })?.fullReasoning || null,
          } : null,
          corrected: {
            index: correction.correctedIndex,
            price: correction.correctedPrice,
            type: correction.correctedType,
          },
          // Include surrounding candles for context
          candleContext: detection ? getCandleContext(detection.candleIndex) : null,
        };
      }),
      // Include all detections for reference
      detections: session.detections.map((d) => ({
        id: d.id,
        candleIndex: d.candleIndex,
        candleTime: d.candleTime,
        price: d.price,
        type: d.detectionType,
        structure: d.structure,
        status: d.status,
        confidence: d.confidence,
        reasoning: (d.metadata as { fullReasoning?: string })?.fullReasoning || null,
      })),
      // Full candle data for replay
      candles: candles,
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-${session.symbol}-${session.timeframe}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [session, candles]);

  if (sessionError) {
    return (
      <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-2">Error loading session</div>
          <div className="text-gray-500 mb-4">{sessionError}</div>
          <Link
            href="/sessions"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to sessions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between relative">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="font-semibold text-white hover:opacity-80 transition-opacity">
              Systems Trader
            </Link>
            <span className="text-gray-600">/</span>
            <Link href="/sessions" className="text-gray-400 hover:text-gray-200 transition-colors">
              Sessions
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-300">
              {isLoading ? "Loading..." : session?.name || "Session"}
            </span>
          </nav>
          <div className="flex items-center gap-3">
            {/* Online Users */}
            <OnlineUsers users={onlineUsers} isConnected={isConnected} />

            {session && (
              <>
                <div className="h-4 w-px bg-gray-700" />
                <button
                  onClick={runDetection}
                  disabled={isLoading || isRunningDetection || candles.length === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium
                           hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isRunningDetection ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Run Detection
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Session Info Bar */}
      {session && (
        <div className="border-b border-gray-800 bg-gray-900/30">
          <div className="container mx-auto px-4 py-3 flex items-center gap-6 flex-wrap text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Symbol:</span>
              <span className="font-mono font-medium">{session.symbol}/USD</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Timeframe:</span>
              <span className="font-medium">{session.timeframe.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Pattern:</span>
              <span className="font-medium capitalize">
                {session.patternType.replace("_", " ")}
              </span>
            </div>
            <div className="h-4 w-px bg-gray-700" />
            <div className="flex items-center gap-4 text-gray-400">
              <span>{session._count.detections} detections</span>
              <span>{session._count.corrections} corrections</span>
              <span>{session._count.comments} comments</span>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <button
                onClick={() => setIsPatternReasoningOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 rounded-lg transition-colors"
                title="View algorithm documentation and detection reasoning"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Algorithm
              </button>
              {session.corrections.length > 0 && (
                <button
                  onClick={handleExportFeedback}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 rounded-lg transition-colors"
                  title="Export corrections feedback as JSON for algorithm improvement"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Feedback
                </button>
              )}
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <div className="flex items-center gap-2">
                {session.createdBy.image ? (
                  <img
                    src={session.createdBy.image}
                    alt={session.createdBy.name || ""}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-700" />
                )}
                <span className="text-gray-400">
                  {session.createdBy.name || session.createdBy.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 p-4 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-[600px] bg-gray-900 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-400">Loading chart data...</span>
              </div>
            </div>
          ) : candles.length === 0 ? (
            <div className="flex items-center justify-center h-[600px] bg-gray-900 rounded-lg">
              <div className="text-gray-500">No candle data available</div>
            </div>
          ) : (
            <div
              ref={chartContainerRef}
              className="bg-gray-900 rounded-lg overflow-hidden relative"
              onMouseMove={handleMouseMove}
            >
              {/* TradingView-style toolbar */}
              <ChartToolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                magnetMode={magnetMode}
                onMagnetModeChange={setMagnetMode}
                disabled={isLoading}
              />
              <CandlestickChart
                candles={candles}
                markers={markers}
                hiddenMarkerIds={hiddenMarkerIds}
                highlightMarkerId={highlightMarkerId}
                navigateToTime={navigateToTime}
                isInMoveMode={!!movingDetection}
                movingMarkerColor={movingDetection?.detectionType.includes("high") ? "#26a69a" : "#ef5350"}
                magnetMode={magnetMode}
                onCandleClick={handleCandleClick}
                onMarkerClick={handleMarkerClick}
                onChartClick={handleChartClick}
                onMarkerDragStart={handleMarkerDragStart}
                onMarkerDrag={handleMarkerDrag}
                onMarkerDragEnd={handleMarkerDragEnd}
                onMarkerContextMenu={handleMarkerContextMenu}
                onNavigationComplete={handleNavigationComplete}
                sessionId={id}
                height={600}
              />
              {/* Cursor overlay for collaborative editing */}
              <CursorOverlay cursors={cursors} containerRef={chartContainerRef} currentUserId={authSession?.user?.id} />
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Swing High (1)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Swing Low (2)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-500" />
              <span>Close Swing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Confirmed</span>
            </div>
            <div className="ml-auto text-gray-500 text-sm">
              Click markers to edit • Press 1/2 to add • M for magnet
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-800 bg-gray-900/30 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex-shrink-0">
            <h2 className="font-semibold text-lg">Activity</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Comments - Collapsible */}
            <div className="border-b border-gray-800">
              <button
                onClick={() => setSectionsCollapsed(s => ({ ...s, comments: !s.comments }))}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-400">
                  Comments {session?.comments?.length ? `(${session.comments.length})` : ""}
                </h3>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${sectionsCollapsed.comments ? '' : 'rotate-180'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!sectionsCollapsed.comments && (
                <div className="px-4 pb-4">
                  {/* Comment Input */}
                  <div className="mb-4">
                    <CommentInput
                      onSubmit={(content) => handleAddComment(content)}
                      placeholder="Add a comment about this session..."
                    />
                  </div>

                  {/* Comments List */}
                  {session?.comments && session.comments.length > 0 ? (
                    <div className="space-y-4">
                      {session.comments.map((comment) => (
                        <CommentThread
                          key={comment.id}
                          comment={comment}
                          onReply={handleReplyComment}
                          onResolve={handleResolveComment}
                          onDelete={handleDeleteComment}
                          onNavigateToDetection={handleNavigateToDetection}
                          currentUserId={authSession?.user?.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-2">
                      No comments yet
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Change Log / Corrections - Collapsible */}
            <div className="border-b border-gray-800">
              <button
                onClick={() => setSectionsCollapsed(s => ({ ...s, changeLog: !s.changeLog }))}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
              >
                <h3 className="text-sm font-medium text-gray-400">
                  Change Log {session?.corrections?.length ? `(${session.corrections.length})` : ""}
                </h3>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${sectionsCollapsed.changeLog ? '' : 'rotate-180'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!sectionsCollapsed.changeLog && (
                <div className="px-4 pb-4">
                  {session?.corrections && session.corrections.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {session.corrections.map((correction) => {
                        const detection = correction.detectionId
                          ? session.detections.find(d => d.id === correction.detectionId)
                          : null;
                        return (
                          <div
                            key={correction.id}
                            className="text-sm bg-gray-800/50 rounded-lg p-2 hover:bg-gray-700/50 cursor-pointer transition-colors"
                            onClick={() => {
                              if (detection) {
                                setSelectedDetection(detection);
                                setCorrectionMode("options");
                                setCorrectionModalOpen(true);
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {correction.user.image ? (
                                <img
                                  src={correction.user.image}
                                  alt={correction.user.name || ""}
                                  className="w-4 h-4 rounded-full"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-gray-700" />
                              )}
                              <span className="text-gray-300">{correction.user.name}</span>
                              <span className="text-gray-600 text-xs">
                                {formatDate(correction.createdAt)}
                              </span>
                              {correction.detectionId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNavigateToDetection(correction.detectionId!);
                                  }}
                                  className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800/50 transition-colors flex items-center gap-1 ml-auto"
                                  title="Go to detection on chart"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  Go to
                                </button>
                              )}
                            </div>
                            <div className="ml-6">
                              <span
                                className={`px-1.5 py-0.5 text-xs rounded ${
                                  {
                                    move: "bg-yellow-900 text-yellow-300",
                                    delete: "bg-red-900 text-red-300",
                                    add: "bg-green-900 text-green-300",
                                    modify: "bg-blue-900 text-blue-300",
                                    confirm: "bg-green-900 text-green-300",
                                    unconfirm: "bg-orange-900 text-orange-300",
                                  }[correction.correctionType] || "bg-gray-800 text-gray-300"
                                }`}
                              >
                                {correction.correctionType}
                              </span>
                              {correction.reason && (
                                <p className="text-gray-400 mt-1">{correction.reason}</p>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(correction.id);
                                }}
                                className="text-xs text-gray-600 hover:text-gray-400 mt-1 flex items-center gap-1"
                                title="Copy correction ID"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                {correction.id.slice(0, 8)}...
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-2">
                      No changes logged yet
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Detections List - Collapsible */}
            {session?.detections && session.detections.length > 0 && (
              <div className="border-b border-gray-800">
                <button
                  onClick={() => setSectionsCollapsed(s => ({ ...s, detections: !s.detections }))}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
                >
                  <h3 className="text-sm font-medium text-gray-400">
                    Detections ({session.detections.length})
                  </h3>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${sectionsCollapsed.detections ? '' : 'rotate-180'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!sectionsCollapsed.detections && (
                  <div className="flex-1 min-h-0">
                    <DetectionList
                      detections={session.detections}
                      onConfirm={(d) => openCorrectionModal("confirm", d)}
                      onModify={(d) => openCorrectionModal("move", d)}
                      onDelete={(d) => openCorrectionModal("delete", d)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {(!session?.detections?.length && !session?.corrections?.length && !session?.comments?.length) && (
              <div className="p-4 text-center text-gray-500 text-sm">
                <p>No activity yet</p>
                <p className="mt-2">Click "Run Detection" to analyze the chart</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      {session && (
        <div className="border-t border-gray-800 bg-gray-900/30 flex-shrink-0">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>ID: {session.id}</span>
              <span>Created: {formatDate(session.createdAt)}</span>
              <span>Updated: {formatDate(session.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              {session.shares.length > 0 && (
                <span>Shared with {session.shares.length} user(s)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Correction Modal */}
      {/* Move Mode Indicator */}
      {movingDetection && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-yellow-900/90 border border-yellow-700 rounded-lg shadow-xl">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-200 text-sm font-medium">
              Click where you want to move "{movingDetection.detectionType.replace("_", " ")}"
            </span>
            <button
              onClick={() => setMovingDetection(null)}
              className="ml-2 text-yellow-400 hover:text-yellow-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <CorrectionModal
        isOpen={correctionModalOpen}
        onClose={() => {
          setCorrectionModalOpen(false);
          setMovingDetection(null); // Clear move mode on close
          // Don't reset tool on cancel - keep it selected
        }}
        onSubmit={async (data) => {
          await handleCorrectionSubmit(data);
          setMovingDetection(null); // Clear move mode after submit
          // Reset to select only after successful submission
          setActiveTool("select");
        }}
        onStartMove={(detection) => {
          // Close modal and start move mode
          setCorrectionModalOpen(false);
          setMovingDetection(detection);
          setMoveTargetData(null);
        }}
        detection={selectedDetection}
        mode={correctionMode}
        addData={addData || undefined}
        moveTargetData={moveTargetData || undefined}
        autoDetectionType={autoDetectionType}
      />

      {/* Right-click context menu */}
      {contextMenu && (() => {
        const detection = session?.detections.find((d) => d.id === contextMenu.marker.id);
        const isConfirmed = detection?.status === "confirmed";
        const hasReasoning = typeof detection?.metadata?.fullReasoning === "string";

        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={[
              // View reasoning (if available)
              ...(hasReasoning
                ? [
                    {
                      label: "View Reasoning",
                      icon: (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                      onClick: () => {
                        if (detection) {
                          // Open modal in options mode which shows reasoning
                          setSelectedDetection(detection);
                          setCorrectionMode("options");
                          setCorrectionModalOpen(true);
                        }
                      },
                    },
                  ]
                : []),
              // Copy ID
              {
                label: `Copy ID (${contextMenu.marker.id.slice(-6)})`,
                icon: (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                ),
                onClick: () => {
                  navigator.clipboard.writeText(contextMenu.marker.id);
                },
              },
              // Confirm/Unconfirm based on current status
              isConfirmed
                ? {
                    label: "Unconfirm",
                    icon: (
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ),
                    onClick: () => {
                      if (detection) {
                        openCorrectionModal("unconfirm", detection);
                      }
                    },
                  }
                : {
                    label: "Confirm",
                    variant: "success" as const,
                    icon: (
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ),
                    onClick: () => {
                      if (detection) {
                        openCorrectionModal("confirm", detection);
                      }
                    },
                  },
              {
                label: "Move",
                icon: (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                ),
                onClick: () => {
                  if (detection) {
                    openCorrectionModal("move", detection);
                  }
                },
              },
              {
                label: "Delete",
                variant: "danger" as const,
                icon: (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ),
                onClick: () => {
                  if (detection) {
                    openCorrectionModal("delete", detection);
                  }
                },
              },
            ]}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}

      {/* Share Modal */}
      {session && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          sessionId={id}
          isOwner={isOwner}
          isPublic={session.isPublic}
        />
      )}

      {/* Pattern Reasoning Modal */}
      {isPatternReasoningOpen && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <div>
                  <h2 className="text-lg font-semibold">Pattern Detection Algorithm</h2>
                  <p className="text-sm text-gray-400">
                    {session.patternType.replace("_", " ").toUpperCase()} detection • {session.patternSettings?.detection_mode || "wicks"} mode
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPatternReasoningOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Algorithm Overview */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Algorithm Overview
                </h3>
                <div className="bg-gray-800/50 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap text-gray-300 max-h-64 overflow-y-auto">
{`SWING DETECTION ALGORITHM v1.0
═══════════════════════════════

OVERVIEW:
This algorithm detects swing highs and swing lows using a two-phase approach:
1. PIVOT DETECTION: Find potential swing points by comparing with surrounding candles
2. CONFIRMATION: Confirm swings only when price "breaks" a significant level

CURRENT SETTINGS:
• Detection Mode: ${session.patternSettings?.detection_mode === 'closes' ? 'CLOSES (using Close prices only)' : 'WICKS (using High/Low prices)'}
• Lookback Period: 3 candles before and after

PIVOT DETECTION:
• SWING HIGH: A candle's ${session.patternSettings?.detection_mode === 'closes' ? 'CLOSE' : 'HIGH'} is HIGHER than all 3 candles before AND after
• SWING LOW: A candle's ${session.patternSettings?.detection_mode === 'closes' ? 'CLOSE' : 'LOW'} is LOWER than all 3 candles before AND after

CONFIRMATION (Break Logic):
• Swing LOW confirmed: When price breaks ABOVE previous swing high
• Swing HIGH confirmed: When price breaks BELOW previous swing low

STRUCTURE LABELS:
• HH (Higher High): Current high > Previous high → Bullish
• LH (Lower High): Current high < Previous high → Bearish
• HL (Higher Low): Current low > Previous low → Bullish
• LL (Lower Low): Current low < Previous low → Bearish`}
                </div>
              </div>

              {/* Detection Summary */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Detection Summary ({session.detections.length} total)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(() => {
                    const counts: Record<string, number> = {};
                    session.detections.forEach(d => {
                      const key = `${d.structure || 'N/A'} (${d.detectionType.replace('swing_', '').toUpperCase()})`;
                      counts[key] = (counts[key] || 0) + 1;
                    });
                    return Object.entries(counts).map(([label, count]) => (
                      <div key={label} className="bg-gray-800/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-blue-400">{count}</div>
                        <div className="text-xs text-gray-400">{label}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Individual Detections */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  Individual Detection Reasoning
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {session.detections.map((detection, index) => (
                    <details key={detection.id} className="bg-gray-800/50 rounded-lg">
                      <summary className="px-4 py-2 cursor-pointer hover:bg-gray-700/50 transition-colors flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${detection.detectionType.includes('high') ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="font-medium">
                          #{index + 1} {detection.structure || 'N/A'} ({detection.detectionType.replace('swing_', '').toUpperCase()})
                        </span>
                        <span className="text-gray-500 text-sm">
                          @ ${detection.price.toFixed(2)} • Candle #{detection.candleIndex}
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleNavigateToDetection(detection.id);
                            setIsPatternReasoningOpen(false);
                          }}
                          className="ml-auto text-xs px-2 py-1 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800/50"
                        >
                          Go to
                        </button>
                      </summary>
                      <div className="px-4 pb-4">
                        <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap overflow-x-auto bg-gray-900/50 rounded p-3 mt-2 max-h-48 overflow-y-auto">
                          {(detection.metadata as { fullReasoning?: string })?.fullReasoning ||
                           (detection.metadata as { pivotReasoning?: string })?.pivotReasoning ||
                           'No detailed reasoning available for this detection.'}
                        </pre>
                      </div>
                    </details>
                  ))}
                  {session.detections.length === 0 && (
                    <p className="text-gray-500 text-center py-4">
                      No detections yet. Run detection to analyze the chart.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
              <button
                onClick={() => setIsPatternReasoningOpen(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
