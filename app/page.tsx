"use client";

import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as tf from "@tensorflow/tfjs"; // explicitly import tf
import "@tensorflow/tfjs-backend-webgl";

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
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const detectingRef = useRef(false);

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

  // === LOAD BEST VOICE ===
  useEffect(() => {
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const preferred =
          voices.find((v) => v.name.includes("Google US English")) ||
          voices.find((v) => v.name.includes("Google UK English Female")) ||
          voices.find((v) => v.lang.startsWith("en")) ||
          voices[0];
        setVoice(preferred);
        console.log("✅ Using voice:", preferred?.name);
      }
    };

    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
  }, []);

  // === FAST, CLEAR SPEAK ===
  const speak = (text: string) => {
    if (!("speechSynthesis" in window) || !text) return;
    if (text === lastSpoken) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    if (voice) utter.voice = voice;

    setLastSpoken(text);
    window.speechSynthesis.speak(utter);
  };

  // === LOAD MODEL + OPTIMIZE BACKEND ===
  useEffect(() => {
    (async () => {
      await tf.setBackend("webgl");
      await tf.ready();

      const loadedModel = await cocoSsd.load();
      // Warm up once with an empty tensor (improves first detection)
      const dummy = tf.zeros([1, 300, 300, 3]);
      await loadedModel.detect(dummy);
      dummy.dispose();

      setModel(loadedModel);
      setStatus("Model ready. Tap 'Start Camera' to begin detection.");
    })();
  }, []);

  // === DETECTION LOOP (FAST) ===
  useEffect(() => {
    if (!model || !isStarted) return;

    let lastTime = 0;

    const detect = async (timestamp: number) => {
      if (!videoRef.current || !model) return;

      // run detection every ~200ms
      if (timestamp - lastTime > 200 && !detectingRef.current) {
        detectingRef.current = true;
        const predictions = await model.detect(videoRef.current);

        if (predictions.length > 0) {
          const top = predictions[0];
          const message = `I see a ${top.class}`;
          setStatus(message);
          setLastDetected(top.class);
          if (top.class !== lastSpoken) speak(message);
        } else {
          setStatus("Nothing detected");
        }

        detectingRef.current = false;
        lastTime = timestamp;
      }

      requestAnimationFrame(detect);
    };

    requestAnimationFrame(detect);
  }, [model, isStarted, voice]);

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
        if (lastDetected) speak(`I see a ${lastDetected}`);
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
  }, [lastDetected, voice]);

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
        🎤 Try: “What do you see?”, “Stop speaking”, “Start camera”
      </p>
    </main>
  );
}
