import React, { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  VIDEO ASSETS
//  Replace v2-mobile.mp4 with your compressed mobile video.
//  If you haven't created it yet, run this command:
//
//  ffmpeg -i src/assets/v2.mp4 \
//    -vcodec libx264 -crf 32 -preset slow \
//    -vf "scale=720:-2,fps=24" \
//    -movflags faststart -t 8 -an \
//    src/assets/v2-mobile.mp4
//
//  Until then, both point to the same file — that's okay, it won't crash.
// ─────────────────────────────────────────────────────────────────────────────
import desktopVideo from "../../assets/v2.mp4";
import mobileVideo  from "../../assets/v2-mobile.mp4"; // create with ffmpeg above

// Uncomment after generating poster images (see ffmpeg commands at bottom):
// import desktopPoster from "../../assets/hero-poster.jpg";
// import mobilePoster  from "../../assets/hero-poster-mobile.jpg";

// ─── Connection decision ──────────────────────────────────────────────────────
const MOBILE_BP = 768;

function getVideoStrategy() {
  const isMobile = window.innerWidth < MOBILE_BP;
  const conn     = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const ect      = conn?.effectiveType ?? "4g"; // "slow-2g" | "2g" | "3g" | "4g"
  const save     = conn?.saveData ?? false;

  // Never load video on these conditions
  if (save || ect === "slow-2g" || ect === "2g") {
    return { play: false };
  }

  // Mobile 3G → skip video (too slow, shimmer stays)
  if (isMobile && ect === "3g") {
    return { play: false };
  }

  // Mobile 4G/WiFi → small mobile video ✓
  // Desktop 3G     → small mobile video (acceptable)
  // Desktop 4G     → full desktop video ✓
  const src = isMobile
    ? mobileVideo
    : ect === "3g"
      ? mobileVideo
      : desktopVideo;

  return { play: true, src, isMobile };
}

// ─── Shimmer skeleton shown while video loads ─────────────────────────────────
// A looping shimmer sweeps across the dark background — like a skeleton loader
// but for a full-screen video hero. Fades out the moment video is ready.
const ShimmerLoader = ({ visible }) => (
  <>
    <style>{`
      @keyframes shimmerSweep {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }
      @keyframes shimmerPulse {
        0%, 100% { opacity: 0.06; }
        50%       { opacity: 0.13; }
      }
      .shimmer-base   { animation: shimmerPulse 2s ease-in-out infinite; }
      .shimmer-sweep  {
        animation: shimmerSweep 2.2s ease-in-out infinite;
        background: linear-gradient(
          105deg,
          transparent 30%,
          rgba(200,166,120,0.12) 50%,
          transparent 70%
        );
      }
    `}</style>

    {/* Dark pulsing base */}
    <div
      className="shimmer-base absolute inset-0"
      style={{
        background: "linear-gradient(160deg, #0d2340 0%, #0b1f3a 55%, #07101a 100%)",
        opacity: visible ? undefined : 0,
        transition: "opacity 0.8s ease",
        pointerEvents: "none",
      }}
    />

    {/* Gold shimmer sweep */}
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.8s ease",
        pointerEvents: "none",
      }}
    >
      <div className="shimmer-sweep absolute inset-0 w-full h-full" />
    </div>

    {/* Skeleton content hints — subtle blocks hinting at the text below */}
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10"
      style={{
        opacity: visible ? 0.18 : 0,
        transition: "opacity 0.6s ease",
        pointerEvents: "none",
      }}
    >
      {/* Badge skeleton */}
      <div style={{ width: 180, height: 22, borderRadius: 999, background: "#C8A678", opacity: 0.35 }} />
      {/* Heading skeleton — 3 lines */}
      <div style={{ width: 320, height: 18, borderRadius: 6, background: "#fff", opacity: 0.2 }} />
      <div style={{ width: 260, height: 18, borderRadius: 6, background: "#fff", opacity: 0.15 }} />
      <div style={{ width: 200, height: 18, borderRadius: 6, background: "#fff", opacity: 0.1 }} />
      {/* Button skeleton */}
      <div style={{ width: 160, height: 44, borderRadius: 12, background: "#C8A678", opacity: 0.25, marginTop: 8 }} />
    </div>
  </>
);

// ─── Hero component ───────────────────────────────────────────────────────────
const Hero = () => {
  const videoRef                        = useRef(null);
  const [videoReady,  setVideoReady ]   = useState(false); // first frame decoded
  const [willPlay,    setWillPlay   ]   = useState(false); // strategy: play video?
  const [isLoading,   setIsLoading  ]   = useState(true);  // shimmer visible?
  const srcRef                          = useRef(null);

  // ── 1. Decide strategy on mount ──────────────────────────────────────────
  useEffect(() => {
    const strategy = getVideoStrategy();

    if (!strategy.play) {
      // No video on this connection — hide shimmer after a short delay
      // so the static bg fades in naturally instead of a hard cut
      const t = setTimeout(() => setIsLoading(false), 600);
      return () => clearTimeout(t);
    }

    srcRef.current = strategy.src;
    setWillPlay(true);
  }, []);

  // ── 2. When willPlay=true, wait for section to enter viewport ────────────
  useEffect(() => {
    if (!willPlay) return;

    let injected = false;

    const inject = () => {
      if (injected || !videoRef.current) return;
      injected = true;

      const vid = videoRef.current;
      vid.querySelectorAll("source").forEach(s => s.remove());

      const source = document.createElement("source");
      source.src  = srcRef.current;
      source.type = "video/mp4";
      vid.appendChild(source);
      vid.load();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        if ("requestIdleCallback" in window) {
          requestIdleCallback(inject, { timeout: 800 });
        } else {
          setTimeout(inject, 80);
        }
      },
      { threshold: 0.01 }
    );

    const el = document.getElementById("hero-section");
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [willPlay]);

  // ── 3. When video has enough data to play, fade it in ────────────────────
  const handleCanPlay = () => {
    setVideoReady(true);
    setIsLoading(false);
  };

  // Safety: if video hasn't started after 4s, drop shimmer anyway
  useEffect(() => {
    if (!willPlay) return;
    const t = setTimeout(() => setIsLoading(false), 4000);
    return () => clearTimeout(t);
  }, [willPlay]);

  return (
    <section
      id="hero-section"
      className="relative min-h-screen w-full overflow-hidden text-white flex items-center justify-center"
    >
      {/* ── Shimmer lazy loader — visible until video ready ── */}
      <ShimmerLoader visible={isLoading} />

      {/* ── Background video — mounted only when connection is good ── */}
      {willPlay && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          // poster={window.innerWidth < MOBILE_BP ? mobilePoster : desktopPoster}
          onCanPlay={handleCanPlay}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity:    videoReady ? 1 : 0,
            transition: "opacity 0.9s ease",
            willChange: "opacity",
          }}
        />
      )}

      {/* ── Dark overlay — always present so text is readable ── */}
      <div className="absolute inset-0 bg-[#0b1f3a]/70 pointer-events-none" />

      {/* ── Bottom vignette ── */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#07101a]/70 to-transparent pointer-events-none" />

      {/* ── Content ── */}
      <div className="relative z-10 w-full px-5 sm:px-10 pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-5xl mx-auto text-center">

          {/* Badge */}
          <div
            className="mb-5 inline-flex items-center gap-2 px-4 py-1.5
                       bg-[#C8A678]/20 border border-[#C8A678]/25
                       text-[#C8A678] text-xs font-semibold rounded-full"
            style={{ animation: "fadeUp 0.5s ease both" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#C8A678] animate-pulse inline-block" />
            Sri Lanka · Live Market Intelligence
          </div>

          {/* Heading */}
          <h1
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight"
            style={{ animation: "fadeUp 0.5s ease 0.1s both" }}
          >
            Global Commodity Sourcing &{" "}
            <span className="text-[#C8A678]">Distribution Network</span>
          </h1>

          {/* Description */}
          <p
            className="mt-4 text-white/80 text-sm sm:text-[15px] leading-relaxed max-w-2xl mx-auto"
            style={{ animation: "fadeUp 0.5s ease 0.2s both" }}
          >
            We source high-demand commodities from global markets and deliver
            them across Sri Lanka through a reliable, end-to-end supply chain.
          </p>

          {/* Buttons */}
          <div
            className="mt-7 flex flex-col sm:flex-row justify-center gap-3"
            style={{ animation: "fadeUp 0.5s ease 0.3s both" }}
          >
            <button
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                         bg-[#C8A678] px-6 py-3 rounded-xl text-sm font-bold
                         hover:bg-[#D4B69C] transition shadow-lg shadow-[#C8A678]/25"
            >
              Explore Our Operations
              <i className="fa-solid fa-arrow-right text-xs" />
            </button>

            <a
              href="#contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                         border border-white/25 bg-white/10 px-6 py-3 rounded-xl text-sm font-bold
                         hover:bg-white/20 transition backdrop-blur-sm"
            >
              Contact Procurement
              <i className="fa-solid fa-up-right-from-square text-xs" />
            </a>
          </div>

          {/* Stats */}
          <div
            className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-10 border-t border-white/15 pt-7"
            style={{ animation: "fadeUp 0.5s ease 0.4s both" }}
          >
            {[
              { value: "20+",  label: "Countries Sourced"   },
              { value: "150+", label: "Global Partners"     },
              { value: "200+", label: "Distribution Routes" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-xl sm:text-2xl font-extrabold text-[#C8A678]">
                  {s.value}
                </div>
                <div className="text-xs text-white/55 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
};

export default React.memo(Hero);

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CONNECTION STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Mobile  + 4G / WiFi  →  v2-mobile.mp4   (~700 KB)  + shimmer
  Mobile  + 3G         →  shimmer → static gradient (no video)
  Mobile  + 2G / save  →  shimmer → static gradient (no video)
  Desktop + 4G / WiFi  →  v2.mp4          (~2–4 MB)  + shimmer
  Desktop + 3G         →  v2-mobile.mp4   (~700 KB)  + shimmer
  Desktop + 2G / save  →  shimmer → static gradient (no video)

  Shimmer is always shown first — content feels instant, video loads
  in the background and fades in when ready. On slow connections the
  shimmer fades to the static dark background after 4 seconds max.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ONE-TIME FFMPEG SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

① Mobile video  (~600–900 KB)
  ffmpeg -i src/assets/v2.mp4 \
    -vcodec libx264 -crf 32 -preset slow \
    -vf "scale=720:-2,fps=24" \
    -movflags faststart -t 8 -an \
    src/assets/v2-mobile.mp4

② Poster images (shown instantly as placeholder)
  ffmpeg -i src/assets/v2.mp4        -vframes 1 -vf scale=1280:-1 -q:v 3 src/assets/hero-poster.jpg
  ffmpeg -i src/assets/v2-mobile.mp4 -vframes 1 -vf scale=640:-1  -q:v 4 src/assets/hero-poster-mobile.jpg

  Then uncomment the poster imports at the top of this file and
  uncomment the poster= prop on the <video> element.

③ CDN (biggest single win — cut TTFB from ~800ms to ~40ms)
  Replace the imports at the top with CDN URLs:
    const desktopVideo = "https://cdn.yourdomain.com/hero/v2-desktop.mp4";
    const mobileVideo  = "https://cdn.yourdomain.com/hero/v2-mobile.mp4";
  Bunny.net (~$1/mo) and Cloudflare R2 both have Asian edge nodes.
*/