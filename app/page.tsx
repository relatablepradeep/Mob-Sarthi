"use client";

import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

// 👇 Custom interface for speech recognition typing (fixes TS error)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [status, setStatus] = useState("Waiting for camera permission...");
  const [lastSpoken, setLastSpoken] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [lastDetected, setLastDetected] = useState("");

  // === CAMERA SETUP ===
  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStarted(true);
        setStatus("Camera started. Loading model...");
      }
    } catch (err) {
      setStatus("Camera permission denied or unavailable.");
      console.error(err);
    }
  };

  // === SPEAK FUNCTION ===
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); // stop previous speech
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.1;
    window.speechSynthesis.speak(utter);
    setLastSpoken(text);
  };

  // === LOAD MODEL ===
  useEffect(() => {
    cocoSsd.load().then((loadedModel) => {
      setModel(loadedModel);
      setStatus("Model loaded. Tap 'Start Camera' to begin detection.");
    });
  }, []);

  // === DETECTION LOOP ===
  useEffect(() => {
    if (!model || !isStarted) return;

    const detect = async () => {
      if (!videoRef.current) return;
      const predictions = await model.detect(videoRef.current);

      if (predictions.length > 0) {
        const top = predictions[0];
        const message = `I see a ${top.class}`;
        setStatus(message);
        setLastDetected(top.class);

        // Speak only if new object is detected
        if (top.class !== lastSpoken) {
          speak(message);
        }
      } else {
        setStatus("Nothing detected");
      }

      requestAnimationFrame(detect);
    };

    detect();
  }, [model, isStarted]);

  // === VOICE COMMANDS ===
  useEffect(() => {
    if (
      !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    ) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.results.length - 1][0].transcript
        .trim()
        .toLowerCase();
      console.log("Voice command:", transcript);

      if (transcript.includes("what do you see")) {
        if (lastDetected) speak(`I see a ${lastDetected}`);
        else speak("I don't see anything right now.");
      } else if (transcript.includes("stop speaking")) {
        window.speechSynthesis.cancel();
        speak("Okay, I stopped speaking.");
      } else if (transcript.includes("start camera")) {
        setupCamera();
      }
    };

    recognition.onerror = (err: any) => {
      console.error("Speech recognition error:", err);
    };

    recognition.onend = () => {
      // Restart automatically to keep listening
      recognition.start();
    };

    recognition.start();
    return () => recognition.stop();
  }, [lastDetected]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-black text-green-400 p-4">
      <h1 className="text-3xl font-bold mb-4">👁️ Blind Vision Assistant</h1>

      {!isStarted && (
        <button
          onClick={setupCamera}
          className="bg-green-500 hover:bg-green-600 text-black px-6 py-3 rounded-xl font-semibold mb-4"
        >
          🎥 Start Camera
        </button>
      )}

      <video
        ref={videoRef}
        className="w-11/12 max-w-lg rounded-2xl border-2 border-green-400"
        autoPlay
        playsInline
        muted
      />

      <p className="mt-4 text-lg text-white text-center">{status}</p>

      <p className="mt-2 text-sm text-gray-400 text-center">
        🎤 Try saying: “What do you see?”, “Stop speaking”, or “Start camera”
      </p>
    </main>
  );
}
