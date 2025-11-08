"use client";

import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [status, setStatus] = useState("Waiting for camera permission...");
  const [isStarted, setIsStarted] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [lastSpoken, setLastSpoken] = useState("");
  const [stableLabel, setStableLabel] = useState("");
  const detectingRef = useRef(false);
  const recentDetections = useRef<string[]>([]);

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

  // === SMOOTH SPEECH OUTPUT ===
  const speak = (text: string) => {
    if (!("speechSynthesis" in window) || !text) return;
    if (text === lastSpoken) return;

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    if (voice) utter.voice = voice;
    setLastSpoken(text);
    window.speechSynthesis.speak(utter);
  };

  // === LOAD MODEL ===
  useEffect(() => {
    (async () => {
      try {
        console.log("⚙️ Setting up TensorFlow backend...");
        await tf.setBackend("webgl");
        await tf.ready();
        console.log("✅ Backend ready:", tf.getBackend());

        console.log("📦 Loading coco-ssd model...");
        const loadedModel = await cocoSsd.load();
        console.log("✅ Model loaded successfully!");

        // Warm up model for instant inference
        const dummy = tf.zeros([300, 300, 3]) as tf.Tensor3D;
        await loadedModel.detect(dummy);
        dummy.dispose();

        setModel(loadedModel);
        setStatus("Model loaded successfully! Ready for detection.");
      } catch (err) {
        console.error("❌ Model load error:", err);
        setStatus("Failed to load detection model.");
      }
    })();
  }, []);

  // === DETECTION LOOP WITH STABILITY FILTER ===
  useEffect(() => {
    if (!model || !isStarted) return;

    const detect = async () => {
      if (!videoRef.current || detectingRef.current) {
        requestAnimationFrame(detect);
        return;
      }

      detectingRef.current = true;
      const predictions = await model.detect(videoRef.current);
      detectingRef.current = false;

      let label = "nothing";
      if (predictions.length > 0) {
        label = predictions[0].class;
      }

      // Smooth detection: store last 5 results
      recentDetections.current.push(label);
      if (recentDetections.current.length > 5) {
        recentDetections.current.shift();
      }

      const stable = getStableLabel(recentDetections.current);
      if (stable !== stableLabel) {
        setStableLabel(stable);
        if (stable !== "nothing") {
          const msg = `I see a ${stable}`;
          setStatus(msg);
          speak(msg);
        } else {
          setStatus("Nothing detected");
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
          speak(`I see a ${stableLabel}`);
        else speak("I don't see anything right now.");
      } else if (transcript.includes("stop speaking")) {
        window.speechSynthesis.cancel();
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
        🎤 Try: “What do you see?”, “Stop speaking”, or “Start camera”
      </p>
    </main>
  );
}
