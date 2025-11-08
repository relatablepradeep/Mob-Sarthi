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
  const [objectModel, setObjectModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [status, setStatus] = useState("Waiting for camera permission...");
  const [isStarted, setIsStarted] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [lastSpoken, setLastSpoken] = useState("");
  const [stableLabel, setStableLabel] = useState("");
  const [currentDistance, setCurrentDistance] = useState(0);
  const [surroundings, setSurroundings] = useState<{ left: string[]; center: string[]; right: string[] }>({
    left: [],
    center: [],
    right: [],
  });
  const detectingRef = useRef(false);
  const recentLabels = useRef<string[]>([]);
  const lastAnnouncementTime = useRef(0);
  const MIN_ANNOUNCEMENT_INTERVAL = 2500; // Reduced for faster responses while walking
  const frameSkipCounter = useRef(0); // Skip every 3rd frame for optimization

  // Simple distance estimation based on bounding box size (approximation)
  const calculateDistance = (bbox: [number, number, number, number], videoHeight: number): number => {
    const heightRatio = bbox[3] / videoHeight;
    // Adjusted scaling: larger bbox = closer (assume 0.8 ratio ~0.5m, 0.1 ratio ~5m)
    return Math.max(0.5, 5 - heightRatio * 6);
  };

  // Determine position: left, center, right based on bbox x-position
  const getPosition = (bbox: [number, number, number, number], videoWidth: number): "left" | "center" | "right" => {
    const xCenter = bbox[0] + bbox[2] / 2;
    const third = videoWidth / 3;
    if (xCenter < third) return "left";
    if (xCenter > 2 * third) return "right";
    return "center";
  };

  // === CAMERA SETUP WITH HIGHER RESOLUTION ===
  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 }, // Reduced for faster processing
          height: { ideal: 480 },
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStarted(true);
        setStatus("Camera started. Detecting surroundings...");
        // Initial announcement
        speak("Camera activated. I will describe your surroundings as you walk, including people, objects, and estimated distances.");
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
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.2; // Slightly faster for dynamic walking
    utter.pitch = 1.0;
    utter.volume = 1.0;
    if (voice) utter.voice = voice;
    setLastSpoken(text);
    lastAnnouncementTime.current = now;
    window.speechSynthesis.speak(utter);
  };

  // Generate surroundings announcement
  const generateSurroundingsAnnouncement = () => {
    const { left, center, right } = surroundings;
    let msg = "";
    if (left.length > 0 || right.length > 0 || center.length > 0) {
      msg += "Surroundings: ";
      if (left.length > 0) msg += `${left.join(", ")} on your left. `;
      if (center.length > 0) msg += `${center.join(", ")} in front. `;
      if (right.length > 0) msg += `${right.join(", ")} on your right. `;
      // Add distances if available
      if (currentDistance > 0) {
        msg += `Closest object about ${Math.round(currentDistance * 10) / 10} meters away.`;
      }
    } else {
      msg = "Clear surroundings ahead.";
    }
    return msg;
  };

  // === LOAD MODELS (Lightweight for speed) ===
  useEffect(() => {
    (async () => {
      try {
        setStatus("Initializing TensorFlow...");
        await tf.setBackend("webgl");
        await tf.ready();
        console.log("✅ Backend ready:", tf.getBackend());

        // Load lightweight object detection
        setStatus("Loading object detection model...");
        const objectLoadedModel = await cocoSsd.load({ base: "lite_mobilenet_v2" }); // Lighter model
        setObjectModel(objectLoadedModel);

        setStatus("Models ready. Tap 'Start Camera' to begin.");
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("Failed to load models.");
      }
    })();
  }, []);

  // === DETECTION LOOP (Optimized with frame skipping) ===
  useEffect(() => {
    if (!objectModel || !isStarted) return;

    const detect = async () => {
      if (!videoRef.current || detectingRef.current || videoRef.current.readyState < 2) {
        requestAnimationFrame(detect);
        return;
      }

      // Skip every 3rd frame for optimization
      frameSkipCounter.current++;
      if (frameSkipCounter.current % 3 !== 0) {
        requestAnimationFrame(detect);
        return;
      }

      detectingRef.current = true;

      // Object detection
      const predictions: DetectedObject[] = await objectModel.detect(videoRef.current);

      detectingRef.current = false;

      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;

      // Process objects
      let newSurroundings: { left: string[]; center: string[]; right: string[] } = {
        left: [],
        center: [],
        right: [],
      };
      let closestDistance = Infinity;
      let currentPred: DetectedObject | null = null;

      predictions
        .filter((p) => p.score > 0.4) // Threshold
        .sort((a, b) => b.score - a.score)
        .forEach((pred) => {
          const pos = getPosition(pred.bbox, videoWidth);
          const dist = calculateDistance(pred.bbox, videoHeight);
          if (dist < closestDistance) {
            closestDistance = dist;
            currentPred = pred;
          }
          const label = pred.class === "person" ? "person" : pred.class;
          if (!newSurroundings[pos].includes(label)) {
            newSurroundings[pos].push(label);
          }
        });

      setSurroundings(newSurroundings);
      setCurrentDistance(closestDistance < Infinity ? closestDistance : 0);

      // Stable label for single focus (TypeScript fix here)
      const label = currentPred ? (currentPred as DetectedObject).class : "nothing";
      recentLabels.current.push(label);
      if (recentLabels.current.length > 6) {
        recentLabels.current.shift();
      }
      const stable = getStableLabel(recentLabels.current);
      if (stable !== stableLabel) {
        setStableLabel(stable);
        if (stable !== "nothing") {
          let msg = `Detected ${stable} at ${Math.round(closestDistance * 10) / 10} meters.`;
          if (stable === "person") msg = `Person at ${Math.round(closestDistance * 10) / 10} meters.`;
          speak(msg);
        }
      }

      // Announce surroundings changes
      const prevSur = JSON.stringify(surroundings);
      const currSur = JSON.stringify(newSurroundings);
      if (prevSur !== currSur) {
        setSurroundings(newSurroundings);
        const ann = generateSurroundingsAnnouncement();
        speak(ann);
      }

      // For potholes: COCO doesn't detect them well; suggest obstacle in center low
      const lowCenterObstacles = predictions
        .filter((p) => p.class.includes("car") || p.class === "bicycle")
        .filter(
          (p) => getPosition(p.bbox, videoWidth) === "center" && p.bbox[1] + p.bbox[3] > videoHeight * 0.7
        );
      if (lowCenterObstacles.length > 0) {
        speak("Caution: Potential road hazard ahead in the center.");
      }

      requestAnimationFrame(detect);
    };

    detect();
  }, [objectModel, isStarted, voice, stableLabel]);

  // === VOICE COMMANDS ===
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
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
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();

      console.log("🎙️ Voice command:", transcript);

      if (transcript.includes("what do you see") || transcript.includes("surroundings")) {
        const msg = generateSurroundingsAnnouncement();
        speak(msg);
      } else if (transcript.includes("stop speaking")) {
        window.speechSynthesis.cancel();
        lastAnnouncementTime.current = Date.now();
        speak("Okay, I stopped speaking.");
      } else if (transcript.includes("start camera")) {
        setupCamera();
      }
    };

    recognition.onerror = (err: any) => console.error("Speech recognition error:", err);
    recognition.onend = () => recognition.start();
    recognition.start();

    return () => recognition.stop();
  }, [surroundings, currentDistance, voice]);

  // === IMPROVED STABILITY HELPER ===
  const getStableLabel = (arr: string[]) => {
    const counts: Record<string, number> = {};
    for (const val of arr) counts[val] = (counts[val] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    const majorityThreshold = arr.length * 0.4; // Further reduced for dynamic scenes
    if (maxCount < majorityThreshold) {
      return "nothing";
    }
    return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
  };

  // === UI ===
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-black text-green-400 p-4">
      <h1 className="text-3xl font-bold mb-4">👁️ Blind Vision Assistant (Walking Mode)</h1>

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
      <p className="mt-2 text-sm text-white text-center">
        Left: {surroundings.left.join(", ")} | Front: {surroundings.center.join(", ")} | Right:{" "}
        {surroundings.right.join(", ")}
      </p>
      <p className="mt-2 text-sm text-gray-400 text-center">
        🎤 Say: “What do you see?”, “Surroundings”, “Stop speaking”, or “Start camera”
      </p>
      <p className="mt-1 text-xs text-gray-500 text-center">
        💡 Optimized for walking: Detects directions and hazards. Distances estimated.
      </p>
    </main>
  );
}
