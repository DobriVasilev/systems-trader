"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TELEGRAM_COLORS, VOICE_MESSAGE } from "@/lib/telegram-theme";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

type RecordingState = "idle" | "recording" | "locked" | "paused";

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(new Array(VOICE_MESSAGE.waveformBars).fill(0));
  const [slideOffset, setSlideOffset] = useState({ x: 0, y: 0 });
  const [showCancelHint, setShowCancelHint] = useState(false);
  const [showLockHint, setShowLockHint] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startPosRef = useRef({ x: 0, y: 0 });
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Check if browser supports required APIs
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("❌ Voice recording is not supported in this browser. Please use Chrome, Firefox, or Safari.");
        onCancel();
        return;
      }

      if (typeof MediaRecorder === 'undefined') {
        alert("❌ Voice recording is not supported in this browser. Please use Chrome, Firefox, or Safari.");
        onCancel();
        return;
      }

      // Check for HTTPS (required for getUserMedia, except on localhost)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        alert("❌ Voice recording requires a secure connection (HTTPS).");
        onCancel();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis for waveform
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setState("recording");
      setDuration(0);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= VOICE_MESSAGE.maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      // Start waveform animation
      updateWaveform();
    } catch (err) {
      console.error("Error starting recording:", err);

      // Provide user-friendly error messages
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          alert("🎤 Microphone access denied. Please enable microphone permissions in your browser settings and try again.");
        } else if (err.name === 'NotFoundError') {
          alert("🎤 No microphone found. Please connect a microphone and try again.");
        } else if (err.name === 'NotReadableError') {
          alert("🎤 Microphone is already in use by another application. Please close other apps using the microphone and try again.");
        } else if (err.name === 'OverconstrainedError') {
          alert("🎤 Microphone doesn't meet the required constraints. Please try a different microphone.");
        } else if (err.name === 'SecurityError') {
          alert("🎤 Security error: Voice recording may be blocked by your browser settings or requires HTTPS.");
        } else {
          alert(`🎤 Failed to start recording: ${err.message}`);
        }
      } else {
        alert("🎤 Failed to start recording. Please check your microphone permissions.");
      }

      onCancel();
    }
  }, [onCancel]);  // updateWaveform and stopRecording are defined below

  // Update waveform visualization
  const updateWaveform = useCallback(() => {
    if (!analyserRef.current || state === "idle") return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Sample the frequency data to create waveform bars
    const bars: number[] = [];
    const samplesPerBar = Math.floor(dataArray.length / VOICE_MESSAGE.waveformBars);

    for (let i = 0; i < VOICE_MESSAGE.waveformBars; i++) {
      let sum = 0;
      for (let j = 0; j < samplesPerBar; j++) {
        sum += dataArray[i * samplesPerBar + j];
      }
      bars.push((sum / samplesPerBar) / 255);
    }

    setWaveform(bars);
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, [state]);

  // Stop recording and send
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onSend(blob, duration);
        cleanup();
      };
    }
  }, [duration, onSend]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    cleanup();
    onCancel();
  }, [onCancel]);

  // Pause/resume recording
  const togglePause = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (state === "recording" || state === "locked") {
        mediaRecorderRef.current.pause();
        setState("paused");
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
      } else if (state === "paused") {
        mediaRecorderRef.current.resume();
        setState("locked");
        durationIntervalRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      }
    }
  }, [state]);

  // Cleanup resources
  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    mediaRecorderRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setState("idle");
    setDuration(0);
    setWaveform(new Array(VOICE_MESSAGE.waveformBars).fill(0));
    setSlideOffset({ x: 0, y: 0 });
    setShowCancelHint(false);
    setShowLockHint(false);
  }, []);

  // Handle touch/mouse events
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startRecording();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (state !== "recording") return;

    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;

    setSlideOffset({ x: deltaX, y: deltaY });

    // Check for cancel (slide left)
    if (deltaX < -VOICE_MESSAGE.slideToCancel) {
      setShowCancelHint(true);
    } else {
      setShowCancelHint(false);
    }

    // Check for lock (slide up)
    if (deltaY < -VOICE_MESSAGE.slideToLock) {
      setShowLockHint(true);
    } else {
      setShowLockHint(false);
    }
  };

  const handlePointerUp = () => {
    if (state === "recording") {
      if (slideOffset.x < -VOICE_MESSAGE.slideToCancel) {
        // Cancelled
        cancelRecording();
      } else if (slideOffset.y < -VOICE_MESSAGE.slideToLock) {
        // Locked
        setState("locked");
        setSlideOffset({ x: 0, y: 0 });
      } else {
        // Send
        stopRecording();
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Idle state - just show mic button
  if (state === "idle") {
    return (
      <button
        onPointerDown={handlePointerDown}
        className="p-3 rounded-full transition-colors"
        style={{
          backgroundColor: TELEGRAM_COLORS.button,
          color: TELEGRAM_COLORS.buttonText,
        }}
        title="Hold to record voice message"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </button>
    );
  }

  // Recording state
  return (
    <div
      className="fixed inset-x-0 bottom-0 p-4 z-50"
      style={{ backgroundColor: TELEGRAM_COLORS.bgColor }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Lock indicator */}
      {state === "recording" && (
        <div
          className="absolute left-1/2 -translate-x-1/2 transition-all duration-200"
          style={{
            bottom: showLockHint ? "120px" : "100px",
            opacity: showLockHint ? 1 : 0.5,
          }}
        >
          <div
            className="p-2 rounded-full"
            style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
          >
            <svg
              className="w-6 h-6"
              style={{ color: showLockHint ? TELEGRAM_COLORS.primary : TELEGRAM_COLORS.hint }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div
            className="text-xs text-center mt-1"
            style={{ color: TELEGRAM_COLORS.hint }}
          >
            Slide up to lock
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Cancel hint / Delete button */}
        {state === "recording" ? (
          <div
            className="flex items-center gap-2 transition-all duration-200"
            style={{
              opacity: showCancelHint ? 1 : 0.6,
              color: showCancelHint ? TELEGRAM_COLORS.destructive : TELEGRAM_COLORS.hint,
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm">Slide to cancel</span>
          </div>
        ) : (
          <button
            onClick={cancelRecording}
            className="p-2 rounded-full transition-colors"
            style={{ color: TELEGRAM_COLORS.destructive }}
            title="Delete recording"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}

        {/* Waveform visualization */}
        <div className="flex-1 flex items-center gap-0.5 h-10">
          {waveform.map((level, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(4, level * 40)}px`,
                backgroundColor: TELEGRAM_COLORS.primary,
                opacity: state === "paused" ? 0.5 : 1,
              }}
            />
          ))}
        </div>

        {/* Duration */}
        <div
          className="text-sm font-mono min-w-[50px] text-right"
          style={{ color: TELEGRAM_COLORS.text }}
        >
          {formatDuration(duration)}
        </div>

        {/* Controls */}
        {state === "locked" || state === "paused" ? (
          <div className="flex items-center gap-2">
            {/* Pause/Resume */}
            <button
              onClick={togglePause}
              className="p-2 rounded-full transition-colors"
              style={{
                backgroundColor: TELEGRAM_COLORS.secondaryBg,
                color: TELEGRAM_COLORS.text,
              }}
            >
              {state === "paused" ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              )}
            </button>

            {/* Stop/Send */}
            <button
              onClick={stopRecording}
              className="p-3 rounded-full transition-colors"
              style={{
                backgroundColor: TELEGRAM_COLORS.primary,
                color: TELEGRAM_COLORS.buttonText,
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        ) : (
          /* Recording indicator (pulsing red dot) */
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{
              backgroundColor: TELEGRAM_COLORS.destructive,
              transform: `translate(${slideOffset.x}px, ${slideOffset.y}px)`,
            }}
          />
        )}
      </div>
    </div>
  );
}

// Voice message playback component
interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration: number;
  isPlayed?: boolean;
}

export function VoiceMessagePlayer({ audioUrl, duration, isPlayed = false }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeedIndex, setPlaybackSpeedIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speeds = [1, 1.5, 2];
  const playbackSpeed = speeds[playbackSpeedIndex];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.playbackRate = playbackSpeed;

      audioRef.current.ontimeupdate = () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      };

      audioRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const cycleSpeed = () => {
    const nextIndex = (playbackSpeedIndex + 1) % speeds.length;
    setPlaybackSpeedIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = speeds[nextIndex];
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      {/* Play button */}
      <button
        onClick={togglePlay}
        className="p-2 rounded-full transition-colors"
        style={{
          backgroundColor: TELEGRAM_COLORS.primary,
          color: TELEGRAM_COLORS.buttonText,
        }}
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Waveform / Progress */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-6 rounded overflow-hidden relative"
          style={{ backgroundColor: TELEGRAM_COLORS.reactionBg }}
        >
          {/* Static waveform bars */}
          <div className="absolute inset-0 flex items-center gap-0.5 px-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full"
                style={{
                  height: `${Math.random() * 100}%`,
                  backgroundColor:
                    i / 30 * 100 < progress
                      ? TELEGRAM_COLORS.primary
                      : TELEGRAM_COLORS.hint,
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
            {formatTime(isPlaying ? currentTime : 0)}
          </span>
          <span className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Speed toggle */}
      <button
        onClick={cycleSpeed}
        className="text-xs px-2 py-1 rounded"
        style={{
          backgroundColor: TELEGRAM_COLORS.reactionBg,
          color: TELEGRAM_COLORS.text,
        }}
      >
        {playbackSpeed}x
      </button>

      {/* Unplayed indicator */}
      {!isPlayed && (
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: TELEGRAM_COLORS.primary }}
        />
      )}
    </div>
  );
}
