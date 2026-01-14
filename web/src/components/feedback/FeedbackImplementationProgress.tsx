"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Type definitions
interface Task {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "pending" | "failed";
  timestamp?: string;
}

interface FeedbackProgress {
  feedbackId: string;
  feedbackTitle: string;
  implementationStatus:
    | "PENDING"
    | "PROCESSING"
    | "ANALYZING"
    | "IMPLEMENTING"
    | "TESTING"
    | "DEPLOYING"
    | "COMPLETED"
    | "FAILED";
  currentTask?: string;
  tasks?: Task[];
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

interface Props {
  feedbackId: string;
}

export default function FeedbackImplementationProgress({ feedbackId }: Props) {
  const [progress, setProgress] = useState<FeedbackProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch progress via SSE
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource(`/api/feedback/${feedbackId}/progress`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setProgress(data);
        setIsLoading(false);
      };

      eventSource.onerror = () => {
        console.error("SSE connection error");
        eventSource?.close();
        setIsLoading(false);

        // Reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [feedbackId]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.2, 0.65, 0.3, 0.9],
      },
    },
  };

  const taskVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 500,
        damping: 25,
      },
    },
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig: Record<
      string,
      { icon: React.ReactNode; color: string; label: string }
    > = {
      PENDING: {
        icon: <Circle className="h-4 w-4" />,
        color: "text-gray-500 bg-gray-100",
        label: "Pending",
      },
      PROCESSING: {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        color: "text-blue-500 bg-blue-100",
        label: "Processing",
      },
      ANALYZING: {
        icon: <CircleDotDashed className="h-4 w-4" />,
        color: "text-blue-500 bg-blue-100",
        label: "Analyzing",
      },
      IMPLEMENTING: {
        icon: <CircleDotDashed className="h-4 w-4" />,
        color: "text-purple-500 bg-purple-100",
        label: "Implementing",
      },
      TESTING: {
        icon: <CircleDotDashed className="h-4 w-4" />,
        color: "text-yellow-500 bg-yellow-100",
        label: "Testing",
      },
      DEPLOYING: {
        icon: <CircleDotDashed className="h-4 w-4" />,
        color: "text-orange-500 bg-orange-100",
        label: "Deploying",
      },
      COMPLETED: {
        icon: <CheckCircle2 className="h-4 w-4" />,
        color: "text-green-500 bg-green-100",
        label: "Completed",
      },
      FAILED: {
        icon: <CircleX className="h-4 w-4" />,
        color: "text-red-500 bg-red-100",
        label: "Failed",
      },
    };

    const config = statusConfig[status] || statusConfig.PENDING;

    return (
      <motion.div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {config.icon}
        {config.label}
      </motion.div>
    );
  };

  // Task icon component
  const TaskIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in-progress":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed":
        return <CircleX className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="text-center p-8 text-gray-500">
        No progress information available
      </div>
    );
  }

  return (
    <motion.div
      className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {progress.feedbackTitle || "Implementing Feedback"}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {progress.startedAt &&
                `Started ${new Date(progress.startedAt).toLocaleString()}`}
            </p>
          </div>
          <StatusBadge status={progress.implementationStatus} />
        </div>
      </div>

      <div className="p-6">
        {/* Current Task */}
        {progress.currentTask && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-900 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              {progress.currentTask}
            </div>
          </div>
        )}

        {/* Error Message */}
        {progress.errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-900 font-medium mb-2">
              <CircleX className="h-4 w-4" />
              Error
            </div>
            <p className="text-sm text-red-700">{progress.errorMessage}</p>
          </div>
        )}

        {/* Task List */}
        {progress.tasks && progress.tasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Progress</h4>
            <AnimatePresence>
              {progress.tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  variants={taskVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <TaskIcon status={task.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {task.title}
                    </p>
                    {task.timestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(task.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Completion Info */}
        {progress.completedAt && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-900 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Completed at {new Date(progress.completedAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
