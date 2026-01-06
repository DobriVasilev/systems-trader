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

  // Track markers being dragged (to hide original while dragging)
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const dragApiCallInProgressRef = useRef(false);

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

  // Keyboard shortcuts for tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
  }, []);

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

  // Handle drag-and-drop for markers
  const handleMarkerDrag = useCallback(async (marker: ChartMarker, newTime: number, newPrice: number) => {
    console.log('[Session] handleMarkerDrag called', { markerId: marker.id, newTime, newPrice });

    const detection = session?.detections.find((d) => d.id === marker.id);
    if (!detection) {
      console.log('[Session] Detection not found for marker', marker.id);
      return;
    }

    // Find the candle index for the new position
    const candleIndex = candles.findIndex((c) => c.time === newTime);
    if (candleIndex === -1) {
      console.log('[Session] Candle not found for time', newTime);
      return;
    }

    console.log('[Session] Submitting move correction', { candleIndex, newPrice });

    // Mark that API call is in progress (so handleMarkerDragEnd doesn't clear draggingMarkerId)
    dragApiCallInProgressRef.current = true;

    // Submit the move correction directly (without modal for drag)
    try {
      const correctionData: CorrectionData = {
        correctionType: "move",
        reason: "Dragged to new position",
        detectionId: detection.id,
        originalIndex: detection.candleIndex,
        originalTime: new Date(detection.candleTime).getTime(),
        originalPrice: detection.price,
        originalType: detection.detectionType,
        correctedIndex: candleIndex,
        correctedTime: newTime * 1000,
        correctedPrice: newPrice,
        correctedType: detection.detectionType,
      };

      await handleCorrectionSubmit(correctionData);
      console.log('[Session] Move correction submitted successfully');
    } catch (err) {
      console.error("[Session] Error moving detection:", err);
    } finally {
      // Clear dragging state after API call completes (or fails)
      console.log('[Session] Clearing drag state');
      dragApiCallInProgressRef.current = false;
      setDraggingMarkerId(null);
    }
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
            {/* Comments - Now at top */}
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                Comments {session?.comments?.length ? `(${session.comments.length})` : ""}
              </h3>

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

            {/* Detections List with Search/Filter */}
            {session?.detections && session.detections.length > 0 && (
              <div className="flex-1 min-h-0 border-b border-gray-800">
                <DetectionList
                  detections={session.detections}
                  onConfirm={(d) => openCorrectionModal("confirm", d)}
                  onModify={(d) => openCorrectionModal("move", d)}
                  onDelete={(d) => openCorrectionModal("delete", d)}
                />
              </div>
            )}

            {/* Corrections */}
            {session?.corrections && session.corrections.length > 0 && (
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  Corrections ({session.corrections.length})
                </h3>
                <div className="space-y-3">
                  {session.corrections.map((correction) => (
                    <div key={correction.id} className="text-sm">
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
                      </div>
                      <div className="ml-6">
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded ${
                            {
                              move: "bg-yellow-900 text-yellow-300",
                              delete: "bg-red-900 text-red-300",
                              add: "bg-green-900 text-green-300",
                              modify: "bg-blue-900 text-blue-300",
                            }[correction.correctionType] || "bg-gray-800 text-gray-300"
                          }`}
                        >
                          {correction.correctionType}
                        </span>
                        {correction.reason && (
                          <p className="text-gray-400 mt-1">{correction.reason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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

        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={[
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
    </main>
  );
}
