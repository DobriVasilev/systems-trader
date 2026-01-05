"use client";

import { use, useMemo, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession as useAuthSession } from "next-auth/react";
import { useSession, PatternDetection } from "@/hooks/useSession";
import { useCandles } from "@/hooks/useCandles";
import { useRealtime } from "@/hooks/useRealtime";
import { CandlestickChart, ChartCandle, ChartMarker } from "@/components/chart/CandlestickChart";
import { CorrectionModal, CorrectionData } from "@/components/corrections";
import { CommentInput, CommentThread } from "@/components/comments";
import { OnlineUsers, CursorOverlay } from "@/components/realtime";

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

  // Add mode toggle - must be enabled to click-to-add detections
  const [isAddMode, setIsAddMode] = useState(false);

  // Keyboard shortcut for Add Mode (press 'A' to toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "a" || e.key === "A") {
        setIsAddMode((prev) => !prev);
      }
      // Escape to turn off add mode
      if (e.key === "Escape" && isAddMode) {
        setIsAddMode(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAddMode]);

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
        color = d.detectionType.includes("bos") ? "#ff9800" : d.detectionType.includes("msb") ? "#9c27b0" : "#ef5350";
        position = "aboveBar";
        shape = d.detectionType.includes("bos") || d.detectionType.includes("msb") ? "arrowUp" : "circle";
      } else if (d.detectionType.includes("low") || d.detectionType.includes("bearish")) {
        color = d.detectionType.includes("bos") ? "#ff9800" : d.detectionType.includes("msb") ? "#9c27b0" : "#26a69a";
        position = "belowBar";
        shape = d.detectionType.includes("bos") || d.detectionType.includes("msb") ? "arrowDown" : "circle";
      }

      return {
        id: d.id,
        time: Math.floor(new Date(d.candleTime).getTime() / 1000),
        position,
        color,
        shape,
        text: d.structure || d.detectionType.replace("swing_", "").replace("_", " ").toUpperCase(),
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

  const handleCandleClick = (candle: ChartCandle, index: number) => {
    // Only open add modal if Add Mode is enabled
    if (!isAddMode) return;

    setAddData({ time: candle.time, price: candle.close, candleIndex: index });
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
      // Default to showing options - user can choose action
      setCorrectionMode("delete"); // Will show detection info, user picks action
      setCorrectionModalOpen(true);
    }
  };

  const handleChartClick = (time: number, price: number) => {
    // Only open add modal if Add Mode is enabled
    if (!isAddMode) return;

    // Find the candle index for this time
    const candleIndex = candles.findIndex((c) => c.time === time);
    if (candleIndex !== -1) {
      setAddData({ time, price, candleIndex });
      setCorrectionMode("add");
      setSelectedDetection(null);
      setCorrectionModalOpen(true);
    }
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
    setCorrectionMode(mode);
    setSelectedDetection(detection || null);
    setAddData(null);
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
    <main className="min-h-screen bg-gray-950 text-gray-100">
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
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    {
                      draft: "bg-gray-600",
                      active: "bg-green-600",
                      completed: "bg-blue-600",
                      archived: "bg-gray-500",
                    }[session.status]
                  } text-white`}
                >
                  {session.status}
                </span>
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
            <div className="ml-auto flex items-center gap-2">
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
      )}

      {/* Main Content */}
      <div className="flex">
        {/* Chart Area */}
        <div className="flex-1 p-4">
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
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Swing High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Swing Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>BOS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span>MSB</span>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <span className="text-gray-500 text-sm">Click markers to edit</span>
              <button
                onClick={() => setIsAddMode(!isAddMode)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${isAddMode
                    ? "bg-green-600 text-white shadow-lg shadow-green-600/30"
                    : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                  }
                `}
                title="Toggle Add Mode (A)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {isAddMode ? "Adding Mode ON" : "Add Detection"}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-800 bg-gray-900/30">
          <div className="p-4 border-b border-gray-800">
            <h2 className="font-semibold text-lg">Activity</h2>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {/* Detections Summary */}
            {session?.detections && session.detections.length > 0 && (
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  Detections ({session.detections.length})
                </h3>
                <div className="space-y-2">
                  {session.detections.slice(0, 10).map((d) => (
                    <div
                      key={d.id}
                      className="text-sm p-2 rounded-lg hover:bg-gray-800/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              d.status === "rejected"
                                ? "bg-gray-500"
                                : d.status === "confirmed"
                                ? "bg-blue-500"
                                : d.detectionType.includes("high")
                                ? "bg-red-500"
                                : "bg-green-500"
                            }`}
                          />
                          <span
                            className={`capitalize ${
                              d.status === "rejected"
                                ? "text-gray-500 line-through"
                                : "text-gray-300"
                            }`}
                          >
                            {d.detectionType.replace("_", " ")}
                          </span>
                          {d.structure && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-800 rounded">
                              {d.structure}
                            </span>
                          )}
                          {d.status === "confirmed" && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-900 text-blue-300 rounded">
                              confirmed
                            </span>
                          )}
                          {d.status === "rejected" && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-900 text-red-300 rounded">
                              deleted
                            </span>
                          )}
                        </div>
                        <span className="text-gray-500 text-xs">
                          ${d.price.toFixed(2)}
                        </span>
                      </div>
                      {/* Action buttons - show on hover */}
                      {d.status === "pending" && (
                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openCorrectionModal("confirm", d)}
                            className="flex-1 px-2 py-1 text-xs bg-blue-600/20 text-blue-400
                                     hover:bg-blue-600/30 rounded transition-colors"
                            title="Confirm detection"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => openCorrectionModal("move", d)}
                            className="flex-1 px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400
                                     hover:bg-yellow-600/30 rounded transition-colors"
                            title="Modify detection"
                          >
                            Modify
                          </button>
                          <button
                            onClick={() => openCorrectionModal("delete", d)}
                            className="flex-1 px-2 py-1 text-xs bg-red-600/20 text-red-400
                                     hover:bg-red-600/30 rounded transition-colors"
                            title="Delete detection"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {session.detections.length > 10 && (
                    <div className="text-xs text-gray-500 mt-2">
                      + {session.detections.length - 10} more detections
                    </div>
                  )}
                </div>
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

            {/* Comments */}
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
        <div className="border-t border-gray-800 bg-gray-900/30">
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
      <CorrectionModal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        onSubmit={handleCorrectionSubmit}
        detection={selectedDetection}
        mode={correctionMode}
        addData={addData || undefined}
      />
    </main>
  );
}
