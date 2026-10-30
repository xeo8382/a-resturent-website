"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";

const id = "restaurant-hero-video";
const poster = "/videos/restaurant-hero-poster.jpg";
const mobilePoster = "/videos/restaurant-hero-mobile-poster.jpg";
type DataConnection = EventTarget & { saveData?: boolean };

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & { connection?: DataConnection }
    ).connection;
    // Select once, avoiding a second video download when a phone rotates/resizes.
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const source = mobile
      ? "/videos/restaurant-hero-mobile.mp4"
      : "/videos/restaurant-hero.mp4";
    let visible = false;
    let failed = false;
    const suppressed = () => reduced.matches || connection?.saveData === true;
    const sync = () => {
      if (suppressed()) {
        video.dataset.allowed = "false";
        video.dataset.ready = "false";
        video.pause();
        if (video.hasAttribute("src")) {
          video.removeAttribute("src");
          video.load();
        }
        return;
      }
      video.dataset.allowed = "true";
      if (document.hidden || !visible || video.dataset.userPaused === "true") {
        video.pause();
        return;
      }
      if (failed) return;
      if (!video.hasAttribute("src")) {
        video.poster = mobile ? mobilePoster : poster;
        video.src = source;
      }
      video.muted = true;
      // Some mobile browsers/power modes still deny muted autoplay. Keep the poster
      // and offer the real play control after metadata loads, without hiding the page.
      void video.play().catch(() => {});
    };
    const playing = () => {
      if (suppressed() || document.hidden || !visible) video.pause();
      else video.dataset.ready = "true";
    };
    const error = () => {
      failed = true;
      video.dataset.ready = "false";
    };
    video.addEventListener("playing", playing);
    video.addEventListener("error", error);
    reduced.addEventListener("change", sync);
    connection?.addEventListener?.("change", sync);
    document.addEventListener("visibilitychange", sync);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.05;
        sync();
      },
      { threshold: 0.05 },
    );
    observer.observe(video.closest(".cinema-hero")!);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", sync);
      connection?.removeEventListener?.("change", sync);
      document.removeEventListener("visibilitychange", sync);
      video.removeEventListener("playing", playing);
      video.removeEventListener("error", error);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);
  return (
    <>
      <picture className="hero-video-poster">
        <source media="(max-width: 760px)" srcSet={mobilePoster} />
        <Image src={poster} alt="" fill priority unoptimized />
      </picture>
      <video
        ref={ref}
        id={id}
        className="hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        disableRemotePlayback
      />
    </>
  );
}

// Kept outside the decorative/parallax layer so the control remains clickable,
// stationary, and available to keyboard and screen-reader users.
export function HeroVideoControl() {
  const [state, setState] = useState({ available: false, playing: false });
  useEffect(() => {
    const video = document.getElementById(id) as HTMLVideoElement;
    const update = () =>
      setState({
        available:
          video.readyState >= 1 &&
          !video.error &&
          video.dataset.allowed === "true",
        playing: !video.paused,
      });
    const events = ["loadedmetadata", "playing", "pause", "error", "emptied"];
    events.forEach((event) => video.addEventListener(event, update));
    return () =>
      events.forEach((event) => video.removeEventListener(event, update));
  }, []);
  return (
    <button
      type="button"
      className="hero-video-control"
      hidden={!state.available}
      aria-controls={id}
      aria-label={
        state.playing ? "Pause background video" : "Play background video"
      }
      onClick={() => {
        const video = document.getElementById(id) as HTMLVideoElement;
        if (video.dataset.allowed !== "true") return;
        if (video.paused) {
          video.dataset.userPaused = "false";
          void video.play().catch(() => {});
        } else {
          video.dataset.userPaused = "true";
          video.pause();
        }
      }}
    >
      {state.playing ? (
        <Pause size={12} aria-hidden="true" />
      ) : (
        <Play size={12} aria-hidden="true" />
      )}
      <span>{state.playing ? "Pause film" : "Play film"}</span>
    </button>
  );
}
