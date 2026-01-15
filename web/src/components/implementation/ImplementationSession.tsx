"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
  ChevronDown,
  ChevronRight,
  Clock,
  Code,
  FileCode,
  GitCommit,
  Lightbulb,
  Play,
  TestTube,
  Wrench,
  ExternalLink,
  Copy,
} from "lucide-react";

interface Checkpoint {
  id: string;
  phase: string;
  title: string;
  status: "completed" | "in_progress" | "pending" | "failed";
  startedAt?: string;
  completedAt?: string;
  details?: string;
  tools?: string[];
}

interface Phase {
  id: string;
  name: string;
  icon: any;
  status: "completed" | "in_progress" | "pending" | "failed";
  startedAt?: string;
  completedAt?: string;
  checkpoints: Checkpoint[];
}

interface ImplementationSessionProps {
  sessionId: string;
  title: string;
  description?: string;
  type: string;
}

const PHASE_ICONS: Record<string, any> = {
  planning: Lightbulb,
  implementing: Code,
  testing: TestTube,
  refining: Wrench,
  completed: CheckCircle2,
};

const STATUS_COLORS = {
  completed: "text-green-400 border-green-500/30 bg-green-500/10",
  "in_progress": "text-blue-400 border-blue-500/30 bg-blue-500/10 animate-pulse",
  pending: "text-gray-400 border-gray-500/30 bg-gray-500/10",
  failed: "text-red-400 border-red-500/30 bg-red-500/10",
};

export function ImplementationSession({
  sessionId,
  title,
  description,
  type,
}: ImplementationSessionProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(["planning"]));
  const [currentTask, setCurrentTask] = useState<string>("");
  const [logs, setLogs] = useState<Array<{ timestamp: string; message: string; level: string }>>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [copiedCheckpoint, setCopiedCheckpoint] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  // Fetch implementation progress
  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [sessionId]);

  async function fetchProgress() {
    try {
      const response = await fetch(`/api/implementation/${sessionId}/progress`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.success) {
        setPhases(data.phases || []);
        setCurrentTask(data.currentTask || "");
        setLogs(data.log || []);

        // Auto-expand current phase
        const currentPhase = data.phases?.find((p: Phase) => p.status === "in_progress");
        if (currentPhase) {
          setExpandedPhases(prev => new Set([...prev, currentPhase.id]));
        }
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error);
    }
  }

  function togglePhase(phaseId: string) {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhases(newExpanded);
  }

  async function copyCheckpointDetails(checkpoint: Checkpoint) {
    const details = `# ${checkpoint.title}\n\nPhase: ${checkpoint.phase}\nStatus: ${checkpoint.status}\n\n${checkpoint.details || "No details available"}`;
    await navigator.clipboard.writeText(details);
    setCopiedCheckpoint(checkpoint.id);
    setTimeout(() => setCopiedCheckpoint(null), 2000);
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Session Info Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              {description && (
                <p className="text-sm text-gray-400 mt-1">{description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-purple-600/20 text-purple-400 text-xs font-medium rounded-full border border-purple-500/30">
                {type.replace(/_/g, " ").toUpperCase()}
              </span>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors border border-white/10"
              >
                {showLogs ? "Hide Logs" : "View Logs"}
              </button>
            </div>
          </div>

          {/* Current Task Indicator */}
          {currentTask && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg flex items-center gap-3"
            >
              <CircleDotDashed className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-sm text-blue-300">{currentTask}</span>
            </motion.div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Phases */}
          <div className="lg:col-span-2 space-y-4">
            {phases.map((phase, index) => {
              const Icon = PHASE_ICONS[phase.id] || Circle;
              const isExpanded = expandedPhases.has(phase.id);
              const statusColor = STATUS_COLORS[phase.status];

              return (
                <motion.div
                  key={phase.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
                >
                  {/* Phase Header */}
                  <button
                    onClick={() => togglePhase(phase.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg border ${statusColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white flex items-center gap-2">
                          {phase.name}
                          {phase.status === "in_progress" && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                              In Progress
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          {phase.checkpoints.length} checkpoints
                          {phase.startedAt && ` • Started ${new Date(phase.startedAt).toLocaleTimeString()}`}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* Phase Checkpoints */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-800"
                      >
                        <div className="p-4 space-y-3 bg-gray-800/30">
                          {phase.checkpoints.map((checkpoint) => (
                            <CheckpointItem
                              key={checkpoint.id}
                              checkpoint={checkpoint}
                              onCopy={() => copyCheckpointDetails(checkpoint)}
                              isCopied={copiedCheckpoint === checkpoint.id}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Sidebar - Progress & Info */}
          <div className="space-y-4">
            {/* Progress Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Play className="w-4 h-4" />
                Progress
              </h3>
              <div className="space-y-3">
                {phases.map((phase) => (
                  <div key={phase.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{phase.name}</span>
                    <span className={STATUS_COLORS[phase.status].split(" ")[0]}>
                      {phase.status === "completed" && "✓"}
                      {phase.status === "in_progress" && "⟳"}
                      {phase.status === "pending" && "○"}
                      {phase.status === "failed" && "✗"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Actions</h3>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                  <FileCode className="w-4 h-4" />
                  View Changes
                </button>
                <button className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                  <GitCommit className="w-4 h-4" />
                  View Commit
                </button>
                <button className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View Deployment
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Logs Panel */}
        <AnimatePresence>
          {showLogs && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
            >
              <div className="p-4 border-b border-gray-800">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Implementation Log
                </h3>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto space-y-1 font-mono text-xs">
                {logs.map((log, index) => (
                  <div key={index} className={`p-2 rounded ${
                    log.level === "error" ? "bg-red-500/10 text-red-400" :
                    log.level === "warning" ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-gray-800/50 text-gray-300"
                  }`}>
                    <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CheckpointItem({
  checkpoint,
  onCopy,
  isCopied,
}: {
  checkpoint: Checkpoint;
  onCopy: () => void;
  isCopied: boolean;
}) {
  const statusIcon = {
    completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    "in_progress": <CircleDotDashed className="w-4 h-4 text-blue-500 animate-spin" />,
    pending: <Circle className="w-4 h-4 text-gray-500" />,
    failed: <CircleX className="w-4 h-4 text-red-500" />,
  }[checkpoint.status];

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
      <div className="mt-0.5">{statusIcon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-white">{checkpoint.title}</span>
          <button
            onClick={onCopy}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            {isCopied ? (
              <CheckCircle2 className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-gray-400" />
            )}
          </button>
        </div>
        {checkpoint.details && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{checkpoint.details}</p>
        )}
        {checkpoint.tools && checkpoint.tools.length > 0 && (
          <div className="flex gap-1 mt-2">
            {checkpoint.tools.map((tool, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[10px] bg-purple-500/20 text-purple-300 rounded border border-purple-500/30"
              >
                {tool}
              </span>
            ))}
          </div>
        )}
        {checkpoint.completedAt && (
          <span className="text-[10px] text-gray-500 mt-1 block">
            Completed at {new Date(checkpoint.completedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
