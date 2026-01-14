"use client";

import { useState, useRef } from "react";
import { useFeedback } from "@/contexts/FeedbackContext";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { TELEGRAM_COLORS } from "@/lib/telegram-theme";

type FeedbackType = "BUG_REPORT" | "FEATURE_REQUEST" | "UI_UX_ISSUE" | "PERFORMANCE_ISSUE" | "QUESTION" | "OTHER";

interface FeedbackFormData {
  type: FeedbackType;
  title: string;
  textContent: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
}

export function FeedbackModal() {
  const { isOpen, isMinimized, contextData, closeFeedback, minimizeFeedback } = useFeedback();
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FeedbackFormData>({
    type: "BUG_REPORT",
    title: "",
    textContent: "",
    stepsToReproduce: "",
    expectedBehavior: "",
    actualBehavior: "",
  });

  if (!isOpen) return null;

  const feedbackTypes = [
    { value: "BUG_REPORT", label: "🐛 Bug Report", color: "#ef4444" },
    { value: "FEATURE_REQUEST", label: "✨ Feature Request", color: "#3b82f6" },
    { value: "UI_UX_ISSUE", label: "🎨 UI/UX Issue", color: "#8b5cf6" },
    { value: "PERFORMANCE_ISSUE", label: "⚡ Performance Issue", color: "#f59e0b" },
    { value: "QUESTION", label: "❓ Question", color: "#10b981" },
    { value: "OTHER", label: "💬 Other", color: "#6b7280" },
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setScreenshots((prev) => [...prev, ...files]);
  };

  const removeScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVoiceRecord = (blob: Blob, duration: number) => {
    setVoiceBlob(blob);
    setVoiceDuration(duration);
  };

  const handleSubmit = async () => {
    if (inputMode === "text" && !formData.textContent.trim() && !formData.title.trim()) {
      alert("Please provide at least a title or description");
      return;
    }

    if (inputMode === "voice" && !voiceBlob) {
      alert("Please record a voice message");
      return;
    }

    setIsSubmitting(true);

    try {
      const attachmentIds: string[] = [];

      // Upload voice if present
      if (voiceBlob) {
        const voiceFile = new File([voiceBlob], `feedback-voice-${Date.now()}.webm`, {
          type: voiceBlob.type || "audio/webm",
        });

        const uploadRes = await fetch("/api/feedback/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: voiceFile.name,
            contentType: voiceFile.type,
            fileSize: voiceFile.size,
          }),
        });

        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          await fetch(uploadData.data.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": voiceFile.type },
            body: voiceFile,
          });

          await fetch("/api/feedback/upload", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attachmentId: uploadData.data.attachmentId }),
          });

          attachmentIds.push(uploadData.data.attachmentId);
        }
      }

      // Upload screenshots
      for (const screenshot of screenshots) {
        const uploadRes = await fetch("/api/feedback/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: screenshot.name,
            contentType: screenshot.type,
            fileSize: screenshot.size,
          }),
        });

        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          await fetch(uploadData.data.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": screenshot.type },
            body: screenshot,
          });

          await fetch("/api/feedback/upload", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attachmentId: uploadData.data.attachmentId }),
          });

          attachmentIds.push(uploadData.data.attachmentId);
        }
      }

      // Submit feedback
      const feedbackRes = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          title: formData.title || undefined,
          textContent: inputMode === "text" ? formData.textContent : undefined,
          voiceAttachmentId: inputMode === "voice" && attachmentIds.length > 0 ? attachmentIds[0] : undefined,
          stepsToReproduce: formData.stepsToReproduce || undefined,
          expectedBehavior: formData.expectedBehavior || undefined,
          actualBehavior: formData.actualBehavior || undefined,
          pageUrl: contextData?.pageUrl,
          pagePath: contextData?.pagePath,
          selectedElement: contextData?.selectedElement,
          attachmentIds: screenshots.length > 0 ? attachmentIds.slice(inputMode === "voice" ? 1 : 0) : undefined,
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        }),
      });

      const feedbackData = await feedbackRes.json();

      if (feedbackData.success) {
        alert("✅ Feedback submitted! Thank you for helping us improve.");
        closeFeedback();
        // Reset form
        setFormData({
          type: "BUG_REPORT",
          title: "",
          textContent: "",
          stepsToReproduce: "",
          expectedBehavior: "",
          actualBehavior: "",
        });
        setVoiceBlob(null);
        setScreenshots([]);
        setInputMode("text");
      } else {
        throw new Error(feedbackData.error || "Failed to submit feedback");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Minimized widget
  if (isMinimized) {
    return null; // Will be handled by FloatingFeedbackWidget
  }

  const selectedType = feedbackTypes.find((t) => t.value === formData.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ backgroundColor: TELEGRAM_COLORS.bgColor }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between p-4 border-b"
          style={{
            backgroundColor: TELEGRAM_COLORS.secondaryBg,
            borderColor: TELEGRAM_COLORS.border,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl relative"
              style={{ backgroundColor: selectedType?.color }}
            >
              {selectedType?.label.split(" ")[0]}
              {/* Voice available indicator */}
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md"
                style={{
                  backgroundColor: "#fff",
                  border: `1.5px solid ${selectedType?.color}`,
                }}
              >
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: selectedType?.color }}>
                  <path d="M7 4a3 3 0 016 0v4a3 3 0 01-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: TELEGRAM_COLORS.text }}>
                Send Feedback
              </h2>
              <p className="text-sm" style={{ color: TELEGRAM_COLORS.hint }}>
                Type or record voice • Alt+Right-click to inspect
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={minimizeFeedback}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: TELEGRAM_COLORS.text }}
              title="Minimize"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={closeFeedback}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: TELEGRAM_COLORS.text }}
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Context Info */}
          {contextData && (
            <div
              className="p-3 rounded-lg text-sm space-y-1"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                color: TELEGRAM_COLORS.hint,
              }}
            >
              <p>
                <strong>Page:</strong> {contextData.pagePath}
              </p>
              {contextData.selectedElement && (
                <p>
                  <strong>Element:</strong> {contextData.selectedElement}
                </p>
              )}
            </div>
          )}

          {/* Feedback Type */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: TELEGRAM_COLORS.text }}>
              Feedback Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {feedbackTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFormData({ ...formData, type: type.value as FeedbackType })}
                  className="p-3 rounded-lg border-2 text-left transition-all"
                  style={{
                    borderColor: formData.type === type.value ? type.color : TELEGRAM_COLORS.border,
                    backgroundColor:
                      formData.type === type.value
                        ? `${type.color}20`
                        : TELEGRAM_COLORS.secondaryBg,
                    color: TELEGRAM_COLORS.text,
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Mode Toggle */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: TELEGRAM_COLORS.text }}>
              Input Method
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setInputMode("text")}
                className="flex-1 p-3 rounded-lg border-2 transition-colors"
                style={{
                  borderColor: inputMode === "text" ? TELEGRAM_COLORS.primary : TELEGRAM_COLORS.border,
                  backgroundColor:
                    inputMode === "text" ? `${TELEGRAM_COLORS.primary}20` : TELEGRAM_COLORS.secondaryBg,
                  color: TELEGRAM_COLORS.text,
                }}
              >
                ✍️ Write Text
              </button>
              <button
                onClick={() => setInputMode("voice")}
                className="flex-1 p-3 rounded-lg border-2 transition-colors"
                style={{
                  borderColor: inputMode === "voice" ? TELEGRAM_COLORS.primary : TELEGRAM_COLORS.border,
                  backgroundColor:
                    inputMode === "voice" ? `${TELEGRAM_COLORS.primary}20` : TELEGRAM_COLORS.secondaryBg,
                  color: TELEGRAM_COLORS.text,
                }}
              >
                🎤 Record Voice
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: TELEGRAM_COLORS.text }}>
              Title (Optional)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief summary of your feedback"
              className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: TELEGRAM_COLORS.secondaryBg,
                border: `1px solid ${TELEGRAM_COLORS.border}`,
                color: TELEGRAM_COLORS.text,
              }}
            />
          </div>

          {/* Text Input Mode */}
          {inputMode === "text" && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: TELEGRAM_COLORS.text }}>
                Description *
              </label>
              <textarea
                value={formData.textContent}
                onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                placeholder="Describe your feedback in detail..."
                rows={6}
                className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: TELEGRAM_COLORS.secondaryBg,
                  border: `1px solid ${TELEGRAM_COLORS.border}`,
                  color: TELEGRAM_COLORS.text,
                }}
              />
            </div>
          )}

          {/* Voice Input Mode */}
          {inputMode === "voice" && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: TELEGRAM_COLORS.text }}>
                Voice Message *
              </label>
              <div
                className="p-4 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
              >
                {voiceBlob ? (
                  <div className="flex items-center gap-4 w-full">
                    <div className="flex-1 text-sm" style={{ color: TELEGRAM_COLORS.text }}>
                      ✅ Voice recorded ({voiceDuration.toFixed(1)}s)
                    </div>
                    <button
                      onClick={() => {
                        setVoiceBlob(null);
                        setVoiceDuration(0);
                      }}
                      className="px-4 py-2 rounded-lg"
                      style={{
                        backgroundColor: TELEGRAM_COLORS.destructive,
                        color: "#fff",
                      }}
                    >
                      Re-record
                    </button>
                  </div>
                ) : (
                  <VoiceRecorder
                    onSend={handleVoiceRecord}
                    onCancel={() => {}}
                  />
                )}
              </div>
            </div>
          )}

          {/* Additional Details (for bug reports) - Simplified */}
          {formData.type === "BUG_REPORT" && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: TELEGRAM_COLORS.text }}>
                Additional Details (Optional)
                <span style={{ color: TELEGRAM_COLORS.hint, fontSize: '12px', marginLeft: '8px' }}>
                  You can also record this with voice 🎤
                </span>
              </label>
              <textarea
                value={formData.stepsToReproduce}
                onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })}
                placeholder="Tell us more about what happened:\n• Steps to reproduce\n• What you expected\n• What actually happened"
                rows={4}
                className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none"
                style={{
                  backgroundColor: TELEGRAM_COLORS.secondaryBg,
                  border: `1px solid ${TELEGRAM_COLORS.border}`,
                  color: TELEGRAM_COLORS.text,
                }}
              />
            </div>
          )}

          {/* Screenshots */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: TELEGRAM_COLORS.text }}>
              Screenshots / Attachments (Optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 rounded-lg border-2 border-dashed transition-colors"
              style={{
                borderColor: TELEGRAM_COLORS.border,
                backgroundColor: TELEGRAM_COLORS.secondaryBg,
                color: TELEGRAM_COLORS.text,
              }}
            >
              📎 Click to upload files
            </button>

            {screenshots.length > 0 && (
              <div className="mt-3 space-y-2">
                {screenshots.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
                  >
                    <span className="flex-1 text-sm truncate" style={{ color: TELEGRAM_COLORS.text }}>
                      {file.name}
                    </span>
                    <span className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      onClick={() => removeScreenshot(index)}
                      className="p-1 rounded hover:bg-white/10"
                      style={{ color: TELEGRAM_COLORS.destructive }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 flex items-center justify-between p-4 border-t"
          style={{
            backgroundColor: TELEGRAM_COLORS.secondaryBg,
            borderColor: TELEGRAM_COLORS.border,
          }}
        >
          <p className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
            Tip: Use <kbd className="px-2 py-1 rounded bg-white/10">Alt + Right-click</kbd> anywhere to report
          </p>
          <div className="flex gap-2">
            <button
              onClick={closeFeedback}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
              style={{
                backgroundColor: TELEGRAM_COLORS.secondaryBg,
                border: `1px solid ${TELEGRAM_COLORS.border}`,
                color: TELEGRAM_COLORS.text,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
              style={{
                backgroundColor: TELEGRAM_COLORS.primary,
                color: TELEGRAM_COLORS.buttonText,
              }}
            >
              {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
