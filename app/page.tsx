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
  const recentDetections = useRef<string[]>([]); // store last few frames
  const lastSpokenTime = useRef<number>(0);

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
      console.error(err);
      setStatus("Camera permission denied or unavailable.");
    }
  };

  // === LOAD BEST VOICE ===
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
      }
    };
    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
  }, []);

  // === CLEAR, SMOOTH SPEECH ===
  const speak = (text: string) => {
    if (!("speechSynthesis" in window) || !text) return;
    if (text === lastSpoken) return; // don’t re-speak same text

    const now = Date.now();
    if (now - lastSpokenTime.current < 800) return; // wait at least 0.8s between speech

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    if (voice) utter.voice = voice;

    setLastSpoken(text);
    lastSpokenTime.current = now;
    window.speechSynthesis.speak(utter);
  };

  // === LOAD MODEL ===
  useEffect(() => {
    (async () => {
      await tf.setBackend("webgl");
      await tf.ready();
      const loadedModel = await cocoSsd.load();
      const dummy = tf.zeros([300, 300, 3]) as tf.Tensor3D;
      await loadedModel.detect(dummy);
      dummy.dispose();
      setModel(loadedModel);
      setStatus("Model ready. Tap 'Start Camera' to begin detection.");
    })();
  }, []);

  // === DETECTION LOOP (SMOOTH) ===
  useEffect(() => {
    if (!model || !isStarted) return;

    const detect = async () => {
      if (!videoRef.current || !model || detectingRef.current) {
        requestAnimationFrame(detect);
        return;
      }

      detectingRef.current = true;
      const predictions = await model.detect(videoRef.current);
      detectingRef.current = false;

      let currentLabel = "nothing";

      if (predictions.length > 0) {
        currentLabel = predictions[0].class;
      }

      // Add to recent detections (limit last 5)
      recentDetections.current.push(currentLabel);
      if (recentDetections.current.length > 5) {
        recentDetections.current.shift();
      }

      // Check if majority of recent detections are the same → stable
      const mostCommon = findMostFrequent(recentDetections.current);
      if (mostCommon !== stableLabel) {
        setStableLabel(mostCommon);
        if (mostCommon !== "nothing") {
          const message = `I see a ${mostCommon}`;
          setStatus(message);
          speak(message);
        } else {
          setStatus("Nothing detected");
        }
      }

      requestAnimationFrame(detect);
    };

    detect();
  }, [model, isStarted, voice, stableLabel]);

  // === HELPER: Find most frequent label in last few frames ===
  const findMostFrequent = (arr: string[]) => {
    const freq: Record<string, number> = {};
    for (const a of arr) freq[a] = (freq[a] || 0) + 1;
    return Object.keys(freq).reduce((a, b) => (freq[a] > freq[b] ? a : b));
  };

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
        🎤 Say: “What do you see?”, “Stop speaking”, “Start camera”
      </p>
    </main>
  );
}
