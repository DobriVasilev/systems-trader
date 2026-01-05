"use client";

import { useState, useEffect } from "react";
import { PatternDetection } from "@/hooks/useSession";

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (correction: CorrectionData) => Promise<void>;
  detection?: PatternDetection | null;
  mode: "delete" | "move" | "add" | "confirm";
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
  correctionType: "move" | "delete" | "add" | "confirm";
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
    }
  }, [isOpen, detection, autoDetectionType, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      const correctionData: CorrectionData = {
        correctionType: mode,
        reason: reason.trim(),
      };

      if (mode === "delete" || mode === "confirm" || mode === "move") {
        if (detection) {
          correctionData.detectionId = detection.id;
          correctionData.originalIndex = detection.candleIndex;
          correctionData.originalTime = new Date(detection.candleTime).getTime();
          correctionData.originalPrice = detection.price;
          correctionData.originalType = detection.detectionType;
        }
      }

      if (mode === "add" && addData) {
        correctionData.correctedIndex = addData.candleIndex;
        correctionData.correctedTime = addData.time * 1000; // Convert to ms
        correctionData.correctedPrice = addData.price;
        correctionData.correctedType = detectionType;
        correctionData.correctedStructure = structure || undefined;
      }

      if (mode === "move" && detection && moveTargetData) {
        // For move, use the new position data
        correctionData.correctedIndex = moveTargetData.candleIndex;
        correctionData.correctedTime = moveTargetData.time * 1000; // Convert to ms
        correctionData.correctedPrice = moveTargetData.price;
        correctionData.correctedType = detectionType;
        correctionData.correctedStructure = structure || undefined;
      }

      await onSubmit(correctionData);
      onClose();
    } catch (err) {
      console.error("Error submitting correction:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModeTitle = () => {
    switch (mode) {
      case "delete":
        return "Delete Detection";
      case "move":
        return "Modify Detection";
      case "add":
        return "Add Detection";
      case "confirm":
        return "Confirm Detection";
      default:
        return "Correction";
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case "delete":
        return "Mark this detection as incorrect and remove it from the analysis.";
      case "move":
        return "Modify the type or structure of this detection.";
      case "add":
        return "Add a new detection that the algorithm missed.";
      case "confirm":
        return "Confirm this detection is correct.";
      default:
        return "";
    }
  };

  const getModeColor = () => {
    switch (mode) {
      case "delete":
        return "bg-red-600 hover:bg-red-700";
      case "move":
        return "bg-yellow-600 hover:bg-yellow-700";
      case "add":
        return "bg-green-600 hover:bg-green-700";
      case "confirm":
        return "bg-blue-600 hover:bg-blue-700";
      default:
        return "bg-gray-600 hover:bg-gray-700";
    }
  };

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
            {/* Detection info for delete/confirm/move */}
            {detection && (mode === "delete" || mode === "confirm" || mode === "move") && (
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
              </div>
            )}

            {/* Add position info */}
            {mode === "add" && addData && (
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
            {mode === "move" && moveTargetData && (
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
            {(mode === "add" || mode === "move") && (
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

{/* Structure selector removed - user feedback: HH/HL/LH/LL labels are unnecessary */}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  mode === "delete"
                    ? "Why is this detection incorrect?"
                    : mode === "add"
                    ? "Why should this detection exist?"
                    : mode === "confirm"
                    ? "Any notes about this confirmation?"
                    : "Why are you modifying this?"
                }
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                         text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                         resize-none"
                rows={3}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                This helps improve the detection algorithm.
              </p>
            </div>
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
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
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
                  {mode === "delete" && "Delete"}
                  {mode === "move" && "Modify"}
                  {mode === "add" && "Add Detection"}
                  {mode === "confirm" && "Confirm"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
