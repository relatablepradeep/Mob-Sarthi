'use client'

import React, { useEffect, useState } from 'react';

const languages = {
  en: "English", as: "Assamese", bn: "Bengali", brx: "Bodo", doi: "Dogri",
  gom: "Goan Konkani", gu: "Gujarati", hi: "Hindi", kn: "Kannada", ks: "Kashmiri",
  mai: "Maithili", ml: "Malayalam", mni: "Manipuri", mr: "Marathi", ne: "Nepali",
  or: "Oriya", pa: "Punjabi", sa: "Sanskrit", sat: "Santali", sd: "Sindhi",
  ta: "Tamil", te: "Telugu", ur: "Urdu"
};

const Lang = () => {
  const [originalTexts, setOriginalTexts] = useState(new WeakMap());
  const [currentLang, setCurrentLang] = useState('en');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const getVisibleTextNodes = () => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (node.parentNode.closest('script, style, noscript')) return NodeFilter.FILTER_REJECT;
          const style = window.getComputedStyle(node.parentNode);
          if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );
    const nodes = [];
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      nodes.push(currentNode);
    }
    return nodes;
  };

  useEffect(() => {
    const nodes = getVisibleTextNodes();
    const map = new WeakMap();
    nodes.forEach((node) => map.set(node, node.nodeValue));
    setOriginalTexts(map);
  }, []);

  const restoreOriginalText = () => {
    const nodes = getVisibleTextNodes();
    nodes.forEach((node) => {
      const original = originalTexts.get(node);
      if (original) node.nodeValue = original;
    });
  };

  const translateText = async (lang) => {
    setIsTranslating(true);

    if (lang === 'en') {
      restoreOriginalText();
      setCurrentLang('en');
      setIsTranslating(false);
      setShowDropdown(false);
      return;
    }

    const nodes = getVisibleTextNodes();
    const uniqueTexts = [...new Set(nodes.map((n) => n.nodeValue.trim()))];

    const translations = {};
    const promises = uniqueTexts.map((text) =>
      fetch('/scaler/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_language: 'en',
          target_language: lang,
          content: text,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          translations[text] = data?.translated_content || text;
        })
        .catch(() => {
          translations[text] = text;
        })
    );

    await Promise.all(promises);

    nodes.forEach((node) => {
      const original = node.nodeValue.trim();
      if (translations[original]) {
        node.nodeValue = node.nodeValue.replace(original, translations[original]);
      }
    });

    setCurrentLang(lang);
    setIsTranslating(false);
    setShowDropdown(false);
  };

  return (
    <>
      {/* Floating Language Button at Bottom-Left */}
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setShowDropdown((prev) => !prev)}
          className="w-16 h-16 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-lg hover:bg-indigo-700 transition-transform"
        >
          {languages[currentLang]}
        </button>

        {/* Dropdown Menu with Scroll */}
        {showDropdown && (
          <div className="mt-2 bg-white rounded shadow-lg absolute bottom-20 left-0 w-48 border border-gray-200 z-50 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-transparent">
            {Object.entries(languages).map(([code, label]) => (
              <button
                key={code}
                onClick={() => translateText(code)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Loading Spinner Overlay */}
        {isTranslating && (
          <div className="fixed inset-0 bg-black bg-opacity-30 z-40 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </>
  );
};

export default Lang;
