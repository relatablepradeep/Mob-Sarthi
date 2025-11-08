"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

function NavItem({ name, href }: { name: string; href?: string }) {
  const [open, setOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const handleMouseMove = (event: React.MouseEvent) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - bounds.left;
    const mouseY = event.clientY - bounds.top;
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    setMousePosition({ 
      x: (mouseX - centerX) / 8,
      y: (mouseY - centerY) / 8
    });
  };

  const navAnimationVariants = {
    Features: {
      initial: { scale: 1 },
      hover: {
        scale: [1, 1.2, 1],
        rotate: [0, -10, 10, 0],
        textShadow: "0 0 8px rgba(255,255,255,0.8)",
        transition: { duration: 0.5 }
      }
    },
    Documentation: {
      initial: { scale: 1 },
      hover: {
        scale: 1.15,
        y: [0, -5, 0],
        color: "#60A5FA",
        textShadow: "0 0 15px rgba(96,165,250,0.5)",
        transition: { duration: 0.3 }
      }
    },
    Pricing: {
      initial: { scale: 1 },
      hover: {
        scale: 1.1,
        x: [-2, 2, -2],
        color: "#A78BFA",
        textShadow: "0 0 15px rgba(167,139,250,0.5)",
        transition: { repeat: Infinity, duration: 0.8 }
      }
    },
    Support: {
      initial: { scale: 1 },
      hover: {
        scale: [1, 1.3, 1.1],
        color: "#34D399",
        textShadow: "0 0 15px rgba(52,211,153,0.5)",
        transition: { duration: 0.4, type: "spring", stiffness: 300 }
      }
    }
  };

  // Get tooltip content based on nav item
  const getTooltipContent = (name: string) => {
    switch(name) {
      case "Documentation":
        return "Explore our comprehensive guides and API docs";
      case "Pricing":
        return "View our pricing plans and packages";
      case "Support":
        return "Get help from our team";
      default:
        return "";
    }
  };

  // simple non-Features link
  if (name !== "Features") {
    return (
      <motion.li
        onMouseMove={handleMouseMove}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => {
          setIsHovered(false);
          setMousePosition({ x: 0, y: 0 });
        }}
        variants={navAnimationVariants[name as keyof typeof navAnimationVariants]}
        initial="initial"
        animate={isHovered ? "hover" : "initial"}
        style={{
          x: mousePosition.x,
          y: mousePosition.y,
        }}
        whileHover={{ 
          color: "#fff",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          boxShadow: "0 0 20px rgba(255, 255, 255, 0.2)",
          scale: 1.05
        }}
        transition={{ type: "spring", stiffness: 350, damping: 12 }}
        className="cursor-pointer relative group px-4 py-2 rounded-lg"
      >
        <span className="relative z-10">
          {name}
          <motion.div
            className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white"
            initial={{ width: "0%" }}
            animate={{ width: isHovered ? "100%" : "0%" }}
            transition={{ duration: 0.2 }}
          />
        </span>
        <motion.div
          className="absolute inset-0 bg-white/5 rounded-lg -z-10"
          initial={{ scale: 0.8, opacity: 0, boxShadow: "0 0 0 rgba(255, 255, 255, 0)" }}
          animate={{ 
            scale: isHovered ? 1 : 0.8, 
            opacity: isHovered ? 1 : 0,
            boxShadow: isHovered ? "0 0 30px rgba(255, 255, 255, 0.15)" : "0 0 0 rgba(255, 255, 255, 0)"
          }}
          transition={{ duration: 0.2 }}
        />
        <AnimatePresence>
          {isHovered && getTooltipContent(name) && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-4 py-2 bg-neutral-800/90 backdrop-blur-sm rounded-lg text-sm text-white whitespace-nowrap border border-white/10 shadow-xl"
            >
              {getTooltipContent(name)}
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-neutral-800/90 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.li>
    );
  }

  // Features dropdown
  return (
    <li
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <motion.div
        whileHover={{ 
          scale: 1.08, 
          y: -3,
          textShadow: "0 0 20px rgba(255, 255, 255, 0.5)",
          boxShadow: "0 0 30px rgba(255, 255, 255, 0.15)"
        }}
        transition={{ type: "spring", stiffness: 350, damping: 12 }}
        onClick={() => setOpen((s) => !s)}
        className="cursor-pointer px-4 py-2 rounded-lg relative"
      >
        {name}
        <motion.div
          className="absolute inset-0 bg-white/5 rounded-lg -z-10"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 200 }}
            className="absolute left-1/2 transform -translate-x-1/2 mt-4 w-[1000px] bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 z-50 overflow-hidden"
          >
            {/* Hero Section */}
            <div className="p-8 border-b border-white/10">
              <h2 className="text-3xl font-bold mb-4">Sarthi: AI-Powered Indian Language Platform</h2>
              <p className="text-gray-400 text-lg">
                A comprehensive solution for multilingual document processing, real-time translation, and intelligent content analysis across Indian languages.
              </p>
            </div>

            {/* Main Features Grid */}
            <div className="p-8">
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-8">
                  <div className="bg-white/5 rounded-xl p-6">
                    <h3 className="text-xl font-semibold mb-4">Multilingual Excellence</h3>
                    <ul className="space-y-3 text-gray-300">
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Support for 22+ Indian languages with real-time translation</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Advanced NLP for regional language understanding</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Context-aware translations maintaining cultural nuances</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white/5 rounded-xl p-6">
                    <h3 className="text-xl font-semibold mb-4">Document Intelligence</h3>
                    <ul className="space-y-3 text-gray-300">
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Smart PDF parsing with layout understanding</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Automated form field extraction and validation</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Multi-format document support with high accuracy</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                  <div className="bg-white/5 rounded-xl p-6">
                    <h3 className="text-xl font-semibold mb-4">Real-time Processing</h3>
                    <ul className="space-y-3 text-gray-300">
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Live translation and document collaboration</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>WebSocket-powered instant updates</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Scalable architecture for enterprise workloads</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white/5 rounded-xl p-6">
                    <h3 className="text-xl font-semibold mb-4">Enterprise Ready</h3>
                    <ul className="space-y-3 text-gray-300">
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Role-based access control and audit logs</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>End-to-end encryption for sensitive data</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-1 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Compliance with data protection standards</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Section */}
            <div className="border-t border-white/10 bg-white/5 p-8">
              <div className="grid grid-cols-4 gap-8 text-center">
                <div>
                  <div className="text-3xl font-bold text-blue-400 mb-2">22+</div>
                  <div className="text-sm text-gray-400">Indian Languages</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-400 mb-2">99.9%</div>
                  <div className="text-sm text-gray-400">Accuracy Rate</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-400 mb-2">50ms</div>
                  <div className="text-sm text-gray-400">Response Time</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-cyan-400 mb-2">24/7</div>
                  <div className="text-sm text-gray-400">Support</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );


}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#020617] text-white font-sans overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-radial from-blue-900/20 via-transparent to-transparent opacity-80" />
        <div className="absolute inset-0 bg-linear-to-br from-blue-950/50 via-cyan-900/30 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-soft-light" />
      </div>

      {/* NAVBAR */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 flex justify-between items-center px-10 py-6"
      >
        <motion.div
          className="flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3Z" 
              stroke="currentColor" 
              strokeWidth="2"
              className="text-white"
            />
            <path 
              d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8"
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round"
              className="text-blue-400"
            />
            <path 
              d="M12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16"
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round"
              className="text-purple-400"
            />
            <circle cx="12" cy="12" r="2" fill="currentColor" className="text-white" />
          </svg>
          <motion.h1 
            className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-400"
          >
            सार्थी
          </motion.h1>
        </motion.div>
        <ul className="hidden md:flex gap-10 text-gray-300 text-sm">
            {/* Navbar links with Features dropdown */}
            {[
              { name: "Features", href: "#features" },
              { name: "Documentation", href: "#docs" },
              { name: "Pricing", href: "#pricing" },
              { name: "Support", href: "#support" }
            ].map((item) => (
              <NavItem key={item.name} name={item.name} href={item.href} />
            ))}
        </ul>
        <motion.button 
          whileHover={{ 
            scale: 1.05,
            backgroundColor: "#ffffff",
            boxShadow: "0 0 20px rgba(255,255,255,0.3)"
          }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          Profile
        </motion.button>
      </motion.nav>

      {/* HERO SECTION */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center h-[500px] -mt-20">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="flex items-center gap-4">

           
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="text-7xl md:text-8xl font-extrabold leading-[1.1] bg-linear-to-b from-white to-gray-400 bg-clip-text text-transparent"
        >
          Sarthi
        </motion.h1>

        {/* removed descriptive paragraph as requested; keep small animated spacer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 1 }}
          className="mt-4"
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="mt-6 text-gray-400 text-lg"
        >
          Using NLP, PDF parsing, translation APIs, and WebSocket for real-time, 
          multilingual support across platforms
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 150 }}
          className="mt-10 border border-gray-500 px-6 py-2 rounded-full hover:bg-white hover:text-black transition-all"
        >
          Learn More
        </motion.button>
      </section>

      {/* INFO BAR */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="relative z-10 flex flex-wrap justify-center bg-neutral-900/60 backdrop-blur-xl mx-10 rounded-2xl py-6 text-center mb-24 border border-white/10"
      >
        {[
          { title: "Languages", desc: "22+ Indian Languages" },
          { title: "Processing", desc: "NLP & PDF Parsing" },
          { title: "Integration", desc: "WebSocket Live Chat" },
          { title: "Security", desc: "Role-based Access" },
        ].map((item, i) => (
          <div key={i} className="w-1/2 md:w-1/4 py-4">
            <h4 className="text-gray-400 uppercase text-xs mb-1">
              {item.title}
            </h4>
            <p className="text-lg font-semibold">{item.desc}</p>
          </div>
        ))}
      </motion.section>

      {/* WHAT’S IN IT FOR YOU */}
      <section className="relative z-10 text-center px-8 md:px-20 pb-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="text-sm text-gray-400 mb-4"
        >
          <button className="px-4 py-1 border border-gray-500 rounded-full hover:border-white transition-all">
            Learn more about us
          </button>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-4xl md:text-5xl font-semibold mb-8"
        >
          Key Features
        </motion.h2>

        <p className="text-gray-400 mb-16 max-w-2xl mx-auto">
          A comprehensive platform combining NLP, multilingual support, and real-time collaboration
          to revolutionize educational communication and support.
        </p>

        <motion.div 
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-4 gap-8"
      >
          {[
            {
              title: "Smart FAQ Generation",
              desc: "NLP and PDF parsers (Apache Tika, spaCy) automatically extract key details from circulars and notices, ensuring accurate, staff-approved responses.",
              icon: <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            },
            {
              title: "Multilingual Support",
              desc: "Pre-stored Hindi/English/Rajasthani FAQs with Bhashini API for 22+ languages. WebSocket-based live chat fallback connects students with staff.",
              icon: <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            },
            {
              title: "Admin Dashboard",
              desc: "Built with Next.js, PostgreSQL, and Redis. Upload files, manage FAQs, view analytics, and monitor queries - easy for non-technical users.",
              icon: <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            },
            {
              title: "Smart Analytics",
              desc: "Automatic FAQ generation from repeated queries and responses. Reduces staff dependency over time while preventing FAQ stagnation.",
              icon: <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -10 }}
              transition={{ type: "spring", stiffness: 150 }}
              variants={fadeInUp}
              className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-left hover:bg-white/10 transition-all"
            >
              <span className="block text-4xl font-bold text-gray-500 mb-6">{card.icon}</span>
              <h3 className="text-lg font-semibold mb-3">{card.title}</h3>
              <p className="text-gray-400 text-sm">{card.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>
    


     
    </main>
  );
}