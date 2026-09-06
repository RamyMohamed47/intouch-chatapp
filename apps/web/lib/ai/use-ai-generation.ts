"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiResponseRequest, AiWorkspaceSource } from "@intouch/shared/ai";

import { streamAiResponse } from "@/lib/api/ai";

export interface AiGenerationResult {
  text: string;
  sources: AiWorkspaceSource[];
}

export function useAiGeneration(organizationId: string) {
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const [text, setText] = useState("");
  const [sources, setSources] = useState<AiWorkspaceSource[]>([]);
  const [status, setStatus] = useState<
    "idle" | "streaming" | "completed" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus((current) => (current === "streaming" ? "idle" : current));
  }, []);

  const reset = useCallback(() => {
    stop();
    setText("");
    setSources([]);
    setError(null);
    setStatus("idle");
  }, [stop]);

  const start = useCallback(
    async (request: AiResponseRequest): Promise<AiGenerationResult> => {
      stop();
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      const controller = new AbortController();
      controllerRef.current = controller;
      setText("");
      setSources([]);
      setError(null);
      setStatus("streaming");
      let collected = "";
      let collectedSources: AiWorkspaceSource[] = [];
      let streamErrorMessage: string | null = null;
      try {
        await streamAiResponse(
          organizationId,
          request,
          controller.signal,
          (event) => {
            if (generationRef.current !== generation) return;
            if (event.type === "delta") {
              collected += event.text;
              setText(collected);
            } else if (event.type === "sources") {
              collectedSources = event.sources;
              setSources(event.sources);
            } else if (event.type === "error") {
              streamErrorMessage = event.message;
            } else if (event.type === "completed") {
              setStatus("completed");
            }
          },
        );
        if (streamErrorMessage) throw new Error(streamErrorMessage);
        if (
          !controller.signal.aborted &&
          generationRef.current === generation
        ) {
          setStatus("completed");
        }
        return { text: collected, sources: collectedSources };
      } catch (requestError) {
        if (controller.signal.aborted) {
          throw requestError instanceof Error
            ? requestError
            : new Error("AI generation was stopped");
        }
        const message =
          requestError instanceof Error
            ? requestError.message
            : "The AI response could not be completed";
        setError(message);
        setStatus("error");
        throw requestError;
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [organizationId, stop],
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { error, reset, sources, start, status, stop, text };
}
