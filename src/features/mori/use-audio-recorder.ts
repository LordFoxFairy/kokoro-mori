"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type AudioRecordingStatus = "idle" | "recording" | "stopping"

export type AudioRecording = {
  blob: Blob
  contentType: string
  fileName: string
  byteSize: number
}

type UseAudioRecorderOptions = {
  onComplete: (recording: AudioRecording) => void | Promise<void>
  onError: (message: string) => void
  maxDurationSeconds?: number
}

export function useAudioRecorder({ onComplete, onError, maxDurationSeconds = 300 }: UseAudioRecorderOptions) {
  const [status, setStatus] = useState<AudioRecordingStatus>("idle")
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const statusRef = useRef<AudioRecordingStatus>("idle")
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recorderFailedRef = useRef(false)
  const mountedRef = useRef(true)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onComplete, onError])

  const updateStatus = useCallback((nextStatus: AudioRecordingStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const reset = useCallback((preserveFailure = false) => {
    recorderRef.current = null
    chunksRef.current = []
    if (!preserveFailure) recorderFailedRef.current = false
    stopStream()
    updateStatus("idle")
    setElapsedSeconds(0)
  }, [stopStream, updateStatus])

  const reportError = useCallback((message: string) => {
    if (!mountedRef.current) return
    reset(true)
    onErrorRef.current(message)
  }, [reset])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (statusRef.current !== "recording" || recorder === null || recorder.state === "inactive") return
    updateStatus("stopping")
    try {
      recorder.stop()
    } catch {
      reportError("Mori could not stop the microphone recording. Try again.")
    }
  }, [reportError, updateStatus])

  const start = useCallback(async () => {
    if (statusRef.current !== "idle") return
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
      reportError("Microphone recording is not available in this browser.")
      return
    }
    if (typeof MediaRecorder === "undefined") {
      reportError("Microphone recording is not available in this browser.")
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") reportError("Microphone access is needed to record a reference.")
      else reportError("Mori could not start the microphone recording. Try again.")
      return
    }
    if (!mountedRef.current || statusRef.current !== "idle") {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    const preferredMimeType = supportedMimeType()
    let recorder: MediaRecorder
    try {
      recorder = preferredMimeType === null ? new MediaRecorder(stream) : new MediaRecorder(stream, { mimeType: preferredMimeType })
    } catch {
      try {
        recorder = new MediaRecorder(stream)
      } catch {
        stream.getTracks().forEach((track) => track.stop())
        reportError("This browser could not prepare an audio recording.")
        return
      }
    }

    streamRef.current = stream
    chunksRef.current = []
    recorderFailedRef.current = false
    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onerror = () => {
      recorderFailedRef.current = true
      recorder.ondataavailable = null
      recorder.onstop = null
      reportError("The microphone recording stopped unexpectedly. Try again.")
    }
    recorder.onstop = () => {
      const contentType = recorder.mimeType || preferredMimeType || chunksRef.current[0]?.type || "audio/webm"
      const blob = new Blob(chunksRef.current, { type: contentType })
      const fileExtension = contentType.includes("mp4") ? "m4a" : "webm"
      const recording = {
        blob,
        contentType: blob.type || contentType,
        fileName: `mori-recording-${Date.now()}.${fileExtension}`,
        byteSize: blob.size,
      }
      const failed = recorderFailedRef.current
      reset()
      if (failed || !mountedRef.current) return
      if (recording.byteSize === 0) {
        onErrorRef.current("The microphone recording was empty. Try again.")
        return
      }
      void onCompleteRef.current(recording)
    }

    try {
      recorder.start()
      updateStatus("recording")
    } catch {
      reportError("Mori could not start the microphone recording. Try again.")
    }
  }, [reportError, reset, updateStatus])

  useEffect(() => {
    if (status !== "recording") return
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => {
        const next = current + 1
        if (next >= maxDurationSeconds) window.queueMicrotask(stop)
        return next
      })
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [maxDurationSeconds, status, stop])

  useEffect(() => () => {
    mountedRef.current = false
    const recorder = recorderRef.current
    if (recorder !== null && recorder.state !== "inactive") {
      recorder.ondataavailable = null
      recorder.onstop = null
      try { recorder.stop() } catch { /* stream cleanup below is sufficient */ }
    }
    stopStream()
  }, [stopStream])

  return { status, elapsedSeconds, isRecording: status !== "idle", start, stop }
}

function supportedMimeType(): string | null {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
  if (typeof MediaRecorder.isTypeSupported !== "function") return candidates[0] ?? null
  return candidates.find((candidate) => {
    try { return MediaRecorder.isTypeSupported(candidate) } catch { return false }
  }) ?? null
}
