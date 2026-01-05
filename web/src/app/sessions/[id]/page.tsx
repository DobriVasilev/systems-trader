"use client";

import { use, useMemo, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession as useAuthSession } from "next-auth/react";
import { useSession, PatternDetection } from "@/hooks/useSession";
import { useCandles } from "@/hooks/useCandles";
import { useRealtime } from "@/hooks/useRealtime";
import { CandlestickChart, ChartCandle, ChartMarker } from "@/components/chart/CandlestickChart";
import { ChartToolbar, ChartTool } from "@/components/chart/ChartToolbar";
import { CorrectionModal, CorrectionData } from "@/components/corrections";
import { CommentInput, CommentThread } from "@/components/comments";
import { OnlineUsers, CursorOverlay } from "@/components/realtime";
import { DetectionList } from "@/components/detections/DetectionList";

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
  const [correctionMode, setCorrectionMode] = useState<"delete" | "move" | "add" | "confirm">("delete");
  const [selectedDetection, setSelectedDetection] = useState<PatternDetection | null>(null);
  const [addData, setAddData] = useState<{ time: number; price: number; candleIndex: number } | null>(null);

  // Move mode state - for moving detections to new locations
  const [movingDetection, setMovingDetection] = useState<PatternDetection | null>(null);
  const [moveTargetData, setMoveTargetData] = useState<{ time: number; price: number; candleIndex: number } | null>(null);

  // Chart tool state - like TradingView drawing tools
  const [activeTool, setActiveTool] = useState<ChartTool>("select");

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

    return session.detections.map((d) => {
      // Determine marker appearance based on detection type
      let color = "#4a90d9";
      let position: "aboveBar" | "belowBar" = "aboveBar";
      let shape: "circle" | "square" | "arrowUp" | "arrowDown" = "circle";

      if (d.detectionType.includes("high") || d.detectionType.includes("bullish")) {
        color = d.detectionType.includes("bos") ? "#ff9800" : d.detectionType.includes("msb") ? "#9c27b0" : "#26a69a"; // Green for highs
        position = "aboveBar";
        shape = d.detectionType.includes("bos") || d.detectionType.includes("msb") ? "arrowUp" : "circle";
      } else if (d.detectionType.includes("low") || d.detectionType.includes("bearish")) {
        color = d.detectionType.includes("bos") ? "#ff9800" : d.detectionType.includes("msb") ? "#9c27b0" : "#ef5350"; // Red for lows
        position = "belowBar";
        shape = d.detectionType.includes("bos") || d.detectionType.includes("msb") ? "arrowDown" : "circle";
      }

      return {
        id: d.id,
        time: Math.floor(new Date(d.candleTime).getTime() / 1000),
        position,
        color,
        shape,
        text: d.detectionType.replace("swing_", "").replace("_", " ").toUpperCase(),
        size: 1,
      };
    });
  }, [session?.detections]);

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
    // Only trigger if a drawing tool is selected (not "select" mode)
    if (activeTool === "select") return;

    // Use snapped price if available (from click detection), otherwise fall back to close
    const snappedPrice = (candle as { _snappedPrice?: number })._snappedPrice ?? candle.close;
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
      // Default to showing options - user can choose action
      setCorrectionMode("delete"); // Will show detection info, user picks action
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
    try {
      const response = await fetch(`/api/sessions/${id}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(correctionData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to submit correction");
      }

      // Refetch session to get updated data
      await refetch();
    } catch (err) {
      console.error("Error submitting correction:", err);
      throw err;
    }
  };

  const openCorrectionModal = (mode: "delete" | "move" | "add" | "confirm", detection?: PatternDetection) => {
    // Move mode: don't open modal yet - wait for user to click new position
    if (mode === "move" && detection) {
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
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Systems Trader
            </Link>
            <span className="text-gray-500">/</span>
            <Link href="/sessions" className="text-gray-400 hover:text-white transition-colors">
              Sessions
            </Link>
            <span className="text-gray-500">/</span>
            <span className="text-white">
              {isLoading ? "Loading..." : session?.name || "Session"}
            </span>
          </div>
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
                onClick={() => {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url).then(() => {
                    // Show toast or feedback
                    const btn = document.activeElement as HTMLButtonElement;
                    const originalText = btn.innerHTML;
                    btn.innerHTML = `<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Copied!</span>`;
                    setTimeout(() => { btn.innerHTML = originalText; }, 2000);
                  });
                }}
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
                disabled={isLoading}
              />
              <CandlestickChart
                candles={candles}
                markers={markers}
                onCandleClick={handleCandleClick}
                onMarkerClick={handleMarkerClick}
                onChartClick={handleChartClick}
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
            <div className="ml-auto text-gray-500 text-sm">
              Click markers to edit • Press 1 or 2 to add
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
        detection={selectedDetection}
        mode={correctionMode}
        addData={addData || undefined}
        moveTargetData={moveTargetData || undefined}
        autoDetectionType={autoDetectionType}
      />
    </main>
  );
}
