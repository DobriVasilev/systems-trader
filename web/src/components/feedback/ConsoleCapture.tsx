"use client";

import { useEffect } from "react";
import { setupConsoleCapture } from "@/lib/console-capture";

export function ConsoleCapture() {
  useEffect(() => {
    setupConsoleCapture();
  }, []);

  return null;
}
