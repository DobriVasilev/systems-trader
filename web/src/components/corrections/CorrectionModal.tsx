"use client";

import { useState, useEffect } from "react";
import { PatternDetection } from "@/hooks/useSession";

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (correction: CorrectionData) => Promise<void>;
  onStartMove?: (detection: PatternDetection) => void; // Callback to start move mode
  detection?: PatternDetection | null;
  mode: "delete" | "move" | "add" | "confirm" | "unconfirm" | "options"; // Added "options" and "unconfirm" modes
  // For add mode
  addData?: {
    time: number;
    price: number;
    candleIndex: number;
  };
  // For move mode - new position
  moveTargetData?: {
    time: number;
    price: number;
    candleIndex: number;
  };
  // Auto-set detection type from toolbar tool
  autoDetectionType?: string | null;
}

export interface CorrectionData {
  detectionId?: string;
  correctionType: "move" | "delete" | "add" | "confirm" | "unconfirm";
  reason: string;
  originalIndex?: number;
  originalTime?: number;
  originalPrice?: number;
  originalType?: string;
  correctedIndex?: number;
  correctedTime?: number;
  correctedPrice?: number;
  correctedType?: string;
  correctedStructure?: string;
}

const DETECTION_TYPES = [
  { value: "swing_high", label: "Swing High" },
  { value: "swing_low", label: "Swing Low" },
];

const STRUCTURES = [
  { value: "HH", label: "Higher High" },
  { value: "HL", label: "Higher Low" },
  { value: "LH", label: "Lower High" },
  { value: "LL", label: "Lower Low" },
];

export function CorrectionModal({
  isOpen,
  onClose,
  onSubmit,
  onStartMove,
  detection,
  mode,
  addData,
  moveTargetData,
  autoDetectionType,
}: CorrectionModalProps) {
  const [reason, setReason] = useState("");
  const [detectionType, setDetectionType] = useState("swing_low");
  const [structure, setStructure] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalMode, setInternalMode] = useState<"delete" | "move" | "add" | "confirm" | "unconfirm">("delete");

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason("");
      // Use autoDetectionType from toolbar if available, otherwise fall back to detection type
      if (autoDetectionType && mode === "add") {
        setDetectionType(autoDetectionType);
      } else {
        setDetectionType(detection?.detectionType || "swing_low");
      }
      setStructure(detection?.structure || "");
      // Set internal mode from prop mode (unless it's "options")
      if (mode !== "options") {
        setInternalMode(mode);
      }
    }
  }, [isOpen, detection, autoDetectionType, mode]);

  if (!isOpen) return null;

  // Get the effective mode (use internalMode for options, otherwise use mode)
  const effectiveMode = mode === "options" ? internalMode : mode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Reason is now optional

    console.log('[Modal] handleSubmit called', { effectiveMode, mode });
    setIsSubmitting(true);
    try {
      const correctionData: CorrectionData = {
        correctionType: effectiveMode,
        reason: reason.trim(),
      };

      if (effectiveMode === "delete" || effectiveMode === "confirm" || effectiveMode === "unconfirm" || effectiveMode === "move") {
        if (detection) {
          correctionData.detectionId = detection.id;
          correctionData.originalIndex = detection.candleIndex;
          correctionData.originalTime = new Date(detection.candleTime).getTime();
          correctionData.originalPrice = detection.price;
          correctionData.originalType = detection.detectionType;
        }
      }

      if (effectiveMode === "add" && addData) {
        correctionData.correctedIndex = addData.candleIndex;
        correctionData.correctedTime = addData.time * 1000; // Convert to ms
        correctionData.correctedPrice = addData.price;
        correctionData.correctedType = detectionType;
        correctionData.correctedStructure = structure || undefined;
      }

      if (effectiveMode === "move" && detection && moveTargetData) {
        // For move, use the new position data
        correctionData.correctedIndex = moveTargetData.candleIndex;
        correctionData.correctedTime = moveTargetData.time * 1000; // Convert to ms
        correctionData.correctedPrice = moveTargetData.price;
        correctionData.correctedType = detectionType;
        correctionData.correctedStructure = structure || undefined;
      }

      console.log('[Modal] Calling onSubmit with data', correctionData);
      await onSubmit(correctionData);
      console.log('[Modal] onSubmit completed, calling onClose');
      onClose();
    } catch (err) {
      console.error("[Modal] Error submitting correction:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle starting move mode
  const handleStartMove = () => {
    if (detection && onStartMove) {
      onClose();
      onStartMove(detection);
    }
  };

  const getModeTitle = () => {
    if (mode === "options") return "Detection Options";
    switch (effectiveMode) {
      case "delete":
        return "Delete Detection";
      case "move":
        return "Move Detection";
      case "add":
        return "Add Detection";
      case "confirm":
        return "Confirm Detection";
      case "unconfirm":
        return "Unconfirm Detection";
      default:
        return "Correction";
    }
  };

  const getModeDescription = () => {
    if (mode === "options") return "What would you like to do with this detection?";
    switch (effectiveMode) {
      case "delete":
        return "Mark this detection as incorrect and remove it from the analysis.";
      case "move":
        return "Move this detection to a new position on the chart.";
      case "add":
        return "Add a new detection that the algorithm missed.";
      case "confirm":
        return "Confirm this detection is correct.";
      case "unconfirm":
        return "Revert this detection back to pending status.";
      default:
        return "";
    }
  };

  const getModeColor = () => {
    switch (effectiveMode) {
      case "delete":
        return "bg-red-600 hover:bg-red-700";
      case "move":
        return "bg-yellow-600 hover:bg-yellow-700";
      case "add":
        return "bg-green-600 hover:bg-green-700";
      case "confirm":
        return "bg-blue-600 hover:bg-blue-700";
      case "unconfirm":
        return "bg-gray-600 hover:bg-gray-700";
      default:
        return "bg-gray-600 hover:bg-gray-700";
    }
  };

  // Show options UI when in options mode and no specific action selected yet
  const showOptionsUI = mode === "options" && !moveTargetData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-md mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">{getModeTitle()}</h2>
            <p className="text-sm text-gray-400 mt-1">{getModeDescription()}</p>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Detection info for all modes with detection */}
            {detection && (
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Detection</div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      detection.detectionType.includes("high") ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="font-medium capitalize">
                    {detection.detectionType.replace("_", " ")}
                  </span>
                  {detection.structure && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded">
                      {detection.structure}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Price: ${detection.price.toFixed(2)}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {new Date(detection.candleTime).toLocaleString()}
                </div>
              </div>
            )}

            {/* Options mode - show action buttons */}
            {showOptionsUI && detection && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setInternalMode("confirm")}
                  className={`w-full p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                    internalMode === "confirm"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-700 hover:border-gray-600 hover:bg-gray-800"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">Confirm</div>
                    <div className="text-xs text-gray-500">Mark as correct</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleStartMove}
                  className="w-full p-3 rounded-lg border border-gray-700 hover:border-gray-600 hover:bg-gray-800 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-yellow-600/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">Move</div>
                    <div className="text-xs text-gray-500">Click chart to set new position</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInternalMode("delete")}
                  className={`w-full p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                    internalMode === "delete"
                      ? "border-red-500 bg-red-500/10"
                      : "border-gray-700 hover:border-gray-600 hover:bg-gray-800"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">Delete</div>
                    <div className="text-xs text-gray-500">Remove from analysis</div>
                  </div>
                </button>
              </div>
            )}

            {/* Add position info */}
            {effectiveMode === "add" && addData && (
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Position</div>
                <div className="text-sm text-gray-300">
                  Price: ${addData.price.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">
                  Time: {new Date(addData.time * 1000).toLocaleString()}
                </div>
              </div>
            )}

            {/* Move target info */}
            {effectiveMode === "move" && moveTargetData && (
              <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3">
                <div className="text-sm text-yellow-400 mb-1">Move to</div>
                <div className="text-sm text-gray-300">
                  Price: ${moveTargetData.price.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">
                  Time: {new Date(moveTargetData.time * 1000).toLocaleString()}
                </div>
              </div>
            )}

            {/* Detection type selector for add/move */}
            {(effectiveMode === "add" || (effectiveMode === "move" && moveTargetData)) && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Detection Type
                </label>
                <select
                  value={detectionType}
                  onChange={(e) => setDetectionType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                           text-white focus:outline-none focus:border-blue-500"
                >
                  {DETECTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reason - optional, show when action selected */}
            {(!showOptionsUI || internalMode === "confirm" || internalMode === "unconfirm" || internalMode === "delete") && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    effectiveMode === "delete"
                      ? "Why is this detection incorrect?"
                      : effectiveMode === "add"
                      ? "Why should this detection exist?"
                      : effectiveMode === "confirm"
                      ? "Any notes about this confirmation?"
                      : effectiveMode === "unconfirm"
                      ? "Why are you reverting this confirmation?"
                      : "Why are you modifying this?"
                  }
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                           text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                           resize-none"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional - helps improve the detection algorithm.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            {/* Only show submit button when action is selected */}
            {(!showOptionsUI || internalMode === "confirm" || internalMode === "unconfirm" || internalMode === "delete") && (
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors
                         disabled:opacity-50 flex items-center gap-2 ${getModeColor()}`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    {effectiveMode === "delete" && "Delete"}
                    {effectiveMode === "move" && "Move"}
                    {effectiveMode === "add" && "Add Detection"}
                    {effectiveMode === "confirm" && "Confirm"}
                    {effectiveMode === "unconfirm" && "Unconfirm"}
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
