"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import Link from "next/link";

const INDICATORS = [
  { value: "BOS", label: "BOS (Break of Structure)" },
  { value: "Swings", label: "Swings (Highs/Lows)" },
  { value: "MSB", label: "MSB (Market Structure Break)" },
  { value: "CHoCH", label: "CHoCH (Change of Character)" },
  { value: "FVG", label: "FVG (Fair Value Gap)" },
  { value: "Liquidity", label: "Liquidity Zones" },
  { value: "POI", label: "POI (Point of Interest)" },
  { value: "Trend", label: "Trend Detection" },
  { value: "MTF", label: "MTF (Multi-Timeframe)" },
  { value: "Structure", label: "Market Structure" },
  { value: "Other", label: "Other Indicator" },
];

export default function FeedbackPage() {
  const { data: session, status } = useSession();

  const [indicator, setIndicator] = useState("");
  const [customIndicator, setCustomIndicator] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    redirect("/auth/login");
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!indicator) {
      setError("Please select an indicator");
      return;
    }

    if (indicator === "Other" && !customIndicator.trim()) {
      setError("Please specify the custom indicator name");
      return;
    }

    if (!title.trim()) {
      setError("Please provide a title");
      return;
    }

    if (title.length > 200) {
      setError("Title must be 200 characters or less");
      return;
    }

    if (!description.trim()) {
      setError("Please provide a description");
      return;
    }

    if (description.length < 20) {
      setError("Description must be at least 20 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload attachments first (if any)
      const attachmentIds: string[] = [];
      for (const file of attachments) {
        // TODO: Implement file upload to R2
        // For now, skip attachment upload
        console.log("Attachment:", file.name);
      }

      // Submit feedback
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "OTHER", // Using OTHER type for indicator feedback
          indicator: indicator,
          customIndicator: indicator === "Other" ? customIndicator : undefined,
          title,
          textContent: description,
          stepsToReproduce: stepsToReproduce || undefined,
          expectedBehavior: expectedBehavior || undefined,
          actualBehavior: actualBehavior || undefined,
          attachmentIds,
          pageUrl: window.location.href,
          pagePath: "/feedback",
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      // Success!
      setSuccess(true);
      // Reset form
      setIndicator("");
      setCustomIndicator("");
      setTitle("");
      setDescription("");
      setStepsToReproduce("");
      setExpectedBehavior("");
      setActualBehavior("");
      setAttachments([]);

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Hide success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader title="Indicator Feedback" />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Trading Indicator Feedback</h1>
          <p className="text-gray-400">
            Help us improve our trading indicators by reporting issues or suggesting enhancements.
            Your feedback goes directly to our development team.
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Feedback submitted successfully!</span>
            </div>
            <p className="text-sm text-green-300 mt-1">
              Thank you for your feedback. You'll receive an email notification when it's implemented.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Indicator Selection */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Which indicator is this feedback about? <span className="text-red-400">*</span>
            </label>
            <select
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select an indicator...</option>
              {INDICATORS.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>

            {/* Custom Indicator Field */}
            {indicator === "Other" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Specify the indicator <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={customIndicator}
                  onChange={(e) => setCustomIndicator(e.target.value)}
                  placeholder="e.g., Order Blocks, Supply/Demand Zones"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={indicator === "Other"}
                />
              </div>
            )}
          </div>

          {/* Title */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue or suggestion"
              maxLength={200}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="mt-1 text-xs text-gray-500 text-right">
              {title.length}/200 characters
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed information about the issue or your suggestion..."
              rows={6}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
            <div className="mt-1 text-xs text-gray-500">
              {description.length < 20 && description.length > 0
                ? `${20 - description.length} more characters required (minimum 20)`
                : `${description.length} characters`}
            </div>
          </div>

          {/* Optional Fields */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-300 mb-4">
              Additional Details (Optional)
            </h3>

            {/* Steps to Reproduce */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Steps to Reproduce
              </label>
              <textarea
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                placeholder="1. Go to Trading page&#10;2. Select BTC/USDT&#10;3. Notice that..."
                rows={4}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Expected Behavior */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Expected Behavior
              </label>
              <textarea
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder="What you expected to happen..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Actual Behavior */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Actual Behavior
              </label>
              <textarea
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                placeholder="What actually happened..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Screenshots / Attachments (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
              <input
                type="file"
                onChange={handleFileChange}
                multiple
                accept="image/*,video/*,.pdf"
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <svg
                  className="w-12 h-12 mx-auto text-gray-500 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-gray-400">
                  Click to upload or drag and drop
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, PDF, or video up to 10MB
                </p>
              </label>
            </div>

            {/* Attachment List */}
            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                      <span className="text-sm text-gray-300">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between">
            <Link
              href="/feedback/my-feedback"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              View my feedback →
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
