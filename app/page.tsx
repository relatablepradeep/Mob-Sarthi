"use client";

import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [status, setStatus] = useState("Waiting for camera permission...");
  const [lastSpoken, setLastSpoken] = useState("");
  const [isStarted, setIsStarted] = useState(false);

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

  const speak = (text: string) => {
    if (text !== lastSpoken && "speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.1;
      window.speechSynthesis.speak(utter);
      setLastSpoken(text);
    }
  };

  useEffect(() => {
    cocoSsd.load().then((loadedModel) => {
      setModel(loadedModel);
      setStatus("Model loaded. Tap 'Start Camera' to begin detection.");
    });
  }, []);

  useEffect(() => {
    if (!model || !isStarted) return;
    const detect = async () => {
      if (!videoRef.current) return;
      const predictions = await model.detect(videoRef.current);
      if (predictions.length > 0) {
        const top = predictions[0];
        const message = `I see a ${top.class}`;
        setStatus(message);
        speak(message);
      } else {
        setStatus("Nothing detected");
      }
      requestAnimationFrame(detect);
    };
    detect();
  }, [model, isStarted]);

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
    </main>
  );
}
