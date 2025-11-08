"use client";

import { useEffect, useRef, useState } from "react";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [model, setModel] = useState<mobilenet.MobileNet | null>(null);
  const [status, setStatus] = useState("Waiting for camera permission...");
  const [isStarted, setIsStarted] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [lastSpoken, setLastSpoken] = useState("");
  const [stableLabel, setStableLabel] = useState("");
  const detectingRef = useRef(false);
  const recentLabels = useRef<string[]>([]);
  const lastAnnouncementTime = useRef(0);
  const MIN_ANNOUNCEMENT_INTERVAL = 3000; // 3 seconds between announcements to prevent chatter

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
        setStatus("Camera started. Detecting objects...");
        // Initial announcement after camera starts
        speak("Camera activated. I will announce objects I detect near you.");
      }
    } catch (err) {
      console.error("Camera error:", err);
      setStatus("Camera permission denied or unavailable.");
    }
  };

  // === LOAD ENGLISH VOICE ===
  useEffect(() => {
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const best =
          voices.find((v) => v.name.includes("Google US English")) ||
          voices.find((v) => v.name.includes("Google UK English Female")) ||
          voices.find((v) => v.lang.startsWith("en")) ||
          voices[0];
        setVoice(best);
        console.log("✅ Voice selected:", best?.name);
      }
    };
    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
  }, []);

  // === CLEAR, SMOOTH SPEECH WITH THROTTLING ===
  const speak = (text: string) => {
    if (!("speechSynthesis" in window) || !text) return;
    if (text === lastSpoken) return;

    const now = Date.now();
    if (now - lastAnnouncementTime.current < MIN_ANNOUNCEMENT_INTERVAL) {
      return; // Skip if too soon after last announcement
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    if (voice) utter.voice = voice;
    setLastSpoken(text);
    lastAnnouncementTime.current = now;
    window.speechSynthesis.speak(utter);
  };

  // === LOAD LIGHTWEIGHT MODEL ===
  useEffect(() => {
    (async () => {
      try {
        setStatus("Initializing TensorFlow...");
        await tf.setBackend("webgl");
        await tf.ready();
        console.log("✅ Backend ready:", tf.getBackend());

        setStatus("Loading MobileNet model (fast)...");
        const loadedModel = await mobilenet.load({ version: 2, alpha: 1.0 });
        console.log("✅ MobileNet model loaded!");
        setModel(loadedModel);
        setStatus("Model ready. Tap 'Start Camera' to begin detection.");
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("Failed to load model.");
      }
    })();
  }, []);

  // === DETECTION LOOP (SMOOTH + STABLE) ===
  useEffect(() => {
    if (!model || !isStarted) return;

    const detect = async () => {
      if (!videoRef.current || detectingRef.current) {
        requestAnimationFrame(detect);
        return;
      }

      detectingRef.current = true;
      const predictions = await model.classify(videoRef.current);
      detectingRef.current = false;

      let label = "nothing";
      if (predictions.length > 0 && predictions[0].probability > 0.4) {
        label = predictions[0].className;
      }

      // Keep last 7 detections for better stability (increased from 5)
      recentLabels.current.push(label);
      if (recentLabels.current.length > 7) {
        recentLabels.current.shift();
      }

      const stable = getStableLabel(recentLabels.current);
      if (stable !== stableLabel) {
        setStableLabel(stable);
        if (stable !== "nothing") {
          const msg = `Near you is ${stable}.`;
          setStatus(msg);
          speak(msg);
        } else {
          setStatus("Nothing detected");
          // Optional: Announce when nothing is detected after seeing something
          // speak("I don't see anything near you right now.");
        }
      }

      requestAnimationFrame(detect);
    };

    detect();
  }, [model, isStarted, voice, stableLabel]);

  // === VOICE COMMANDS ===
  useEffect(() => {
    if (
      !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    ) {
      console.warn("Speech recognition not supported.");
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

      console.log("🎙️ Voice command:", transcript);

      if (transcript.includes("what do you see")) {
        if (stableLabel && stableLabel !== "nothing")
          speak(`Near you is ${stableLabel}.`);
        else speak("I don't see anything near you right now.");
      } else if (transcript.includes("stop speaking")) {
        window.speechSynthesis.cancel();
        lastAnnouncementTime.current = Date.now(); // Reset timer after manual stop
        speak("Okay, I stopped speaking.");
      } else if (transcript.includes("start camera")) {
        setupCamera();
      }
    };

    recognition.onerror = (err: any) => console.error("Speech recognition error:", err);
    recognition.onend = () => recognition.start();
    recognition.start();

    return () => recognition.stop();
  }, [stableLabel, voice]);

  // === STABILITY HELPER ===
  const getStableLabel = (arr: string[]) => {
    const counts: Record<string, number> = {};
    for (const val of arr) counts[val] = (counts[val] || 0) + 1;
    return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
  };

  // === UI ===
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-black text-green-400 p-4">
      <h1 className="text-3xl font-bold mb-4">👁️ Blind Vision Assistant (Fast)</h1>

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
        🎤 Say: “What do you see?”, “Stop speaking”, or “Start camera”
      </p>
    </main>
  );
}