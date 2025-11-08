"use client";

import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface DetectedObject {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [status, setStatus] = useState("Waiting for camera permission...");
  const [isStarted, setIsStarted] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [lastSpoken, setLastSpoken] = useState("");
  const [stableLabel, setStableLabel] = useState("");
  const [currentDistance, setCurrentDistance] = useState(0);
  const detectingRef = useRef(false);
  const recentLabels = useRef<string[]>([]);
  const lastAnnouncementTime = useRef(0);
  const MIN_ANNOUNCEMENT_INTERVAL = 3000; // 3 seconds between announcements to prevent chatter
  const frameSkipCounter = useRef(0); // To skip frames for better performance and small object focus

  // Simple distance estimation based on bounding box size (approximation)
  const calculateDistance = (bbox: [number, number, number, number], videoHeight: number): number => {
    const heightRatio = bbox[3] / videoHeight;
    // Arbitrary scaling: larger bbox = closer (assume 0.8 ratio ~1m, 0.1 ratio ~5m)
    return Math.max(0.5, 5 - heightRatio * 6);
  };

  // === CAMERA SETUP WITH HIGHER RESOLUTION ===
  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 }, // Higher resolution for better small object detection
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStarted(true);
        setStatus("Camera started. Detecting objects...");
        // Initial announcement after camera starts
        speak("Camera activated. I will announce objects and people I detect near you with estimated distances.");
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

  // === LOAD COCO-SSD MODEL FOR BETTER ACCURACY ===
  useEffect(() => {
    (async () => {
      try {
        setStatus("Initializing TensorFlow...");
        await tf.setBackend("webgl");
        await tf.ready();
        console.log("✅ Backend ready:", tf.getBackend());

        setStatus("Loading COCO-SSD model (accurate detection)...");
        // Use mobilenet_v2 base for higher accuracy
        const loadedModel = await cocoSsd.load({ base: 'mobilenet_v2' });
        console.log("✅ COCO-SSD model loaded!");
        setModel(loadedModel);
        setStatus("Model ready. Tap 'Start Camera' to begin detection.");
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("Failed to load model.");
      }
    })();
  }, []);

  // === DETECTION LOOP (SMOOTH + STABLE, WITH FRAME SKIPPING) ===
  useEffect(() => {
    if (!model || !isStarted) return;

    const detect = async () => {
      if (!videoRef.current || detectingRef.current || videoRef.current.readyState < 2) {
        requestAnimationFrame(detect);
        return;
      }

      // Skip every other frame for better performance and focus on quality detection
      frameSkipCounter.current++;
      if (frameSkipCounter.current % 2 !== 0) {
        requestAnimationFrame(detect);
        return;
      }

      detectingRef.current = true;
      const predictions: DetectedObject[] = await model.detect(videoRef.current);
      detectingRef.current = false;

      let label = "nothing";
      let currentPred: DetectedObject | null = null;
      // Lowered threshold to 0.4 for better sensitivity to small objects and humans
      if (predictions.length > 0) {
        // Sort by score descending and take the highest
        const sortedPreds = predictions.sort((a, b) => b.score - a.score);
        const topPred = sortedPreds.find(p => p.score > 0.4);
        if (topPred) {
          currentPred = topPred;
          label = topPred.class;
          // Special handling for humans
          if (label === "person") {
            label = "person";
          }
        }
      }

      // Keep last 8 detections for improved stability (balanced for responsiveness)
      recentLabels.current.push(label);
      if (recentLabels.current.length > 8) {
        recentLabels.current.shift();
      }

      const stable = getStableLabel(recentLabels.current);
      if (stable !== stableLabel) {
        setStableLabel(stable);
        if (stable !== "nothing" && currentPred) {
          // Simple distance estimation
          const avgDepth = calculateDistance(
            currentPred.bbox,
            videoRef.current.videoHeight
          );
          setCurrentDistance(avgDepth);
          let msg = `A ${stable} is approximately ${Math.round(avgDepth * 10) / 10} meters near you.`;
          if (stable === "person") {
            msg = `A person is approximately ${Math.round(avgDepth * 10) / 10} meters near you.`;
          }
          setStatus(msg);
          speak(msg);
        } else if (stable !== "nothing") {
          // Fallback if no bbox
          let msg = `Near you is a ${stable}.`;
          if (stable === "person") {
            msg = `A person is near you.`;
          }
          setStatus(msg);
          speak(msg);
        } else {
          setStatus("Nothing detected");
          setCurrentDistance(0);
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
        if (stableLabel && stableLabel !== "nothing") {
          let msg = `Near you is a ${stableLabel}.`;
          if (stableLabel === "person") {
            msg = `A person is near you.`;
          }
          if (currentDistance > 0) {
            msg = `A ${stableLabel} is approximately ${Math.round(currentDistance * 10) / 10} meters near you.`;
            if (stableLabel === "person") {
              msg = `A person is approximately ${Math.round(currentDistance * 10) / 10} meters near you.`;
            }
          }
          speak(msg);
        } else {
          speak("I don't see anything near you right now.");
        }
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
  }, [stableLabel, voice, currentDistance]);

  // === IMPROVED STABILITY HELPER ===
  const getStableLabel = (arr: string[]) => {
    const counts: Record<string, number> = {};
    for (const val of arr) counts[val] = (counts[val] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    const majorityThreshold = arr.length * 0.5; // Lowered to 50% for more responsiveness to changes
    if (maxCount < majorityThreshold) {
      return "nothing"; // Not stable enough, default to nothing
    }
    return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
  };

  // === UI ===
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-black text-green-400 p-4">
      <h1 className="text-3xl font-bold mb-4">👁️ Blind Vision Assistant (With Distance)</h1>

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
      <p className="mt-1 text-xs text-gray-500 text-center">
        💡 Distance is estimated based on object size (approximation).
      </p>
    </main>
  );
}