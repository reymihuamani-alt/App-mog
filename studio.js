"use strict";
/*
 * Mog Reels — editor de video tipo CapCut.
 * Usa lo que ya define app.js: $, $$, uid, FONT, DB, toast, openSheet, closeSheet, wrapText, fmtTime,
 * decodeAudioRecord, videoMime, settings, photos, audios, refreshGallery, PHRASES, NATIVE, nativeSave, nativeShare.
 */
(() => {
  /* ---------------- Catálogos ---------------- */

  // Zonas seguras aproximadas: partes de la pantalla que tapan los botones y textos de cada app.
  const FORMATS = {
    tiktok: { name: "TikTok", w: 1080, h: 1920, tip: "Vertical 9:16", safe: { top: 0.09, bottom: 0.21, right: 0.15 } },
    reels: { name: "Instagram Reels", w: 1080, h: 1920, tip: "Vertical 9:16", safe: { top: 0.08, bottom: 0.19, right: 0.14 } },
    shorts: { name: "YouTube Shorts", w: 1080, h: 1920, tip: "Vertical 9:16", safe: { top: 0.08, bottom: 0.19, right: 0.16 } },
    fb: { name: "Facebook Reels", w: 1080, h: 1920, tip: "Vertical 9:16", safe: { top: 0.08, bottom: 0.2, right: 0.14 } },
    feed45: { name: "Instagram feed", w: 1080, h: 1350, tip: "Vertical 4:5", safe: null },
    square: { name: "Cuadrado", w: 1080, h: 1080, tip: "1:1", safe: null },
    youtube: { name: "YouTube", w: 1920, h: 1080, tip: "Horizontal 16:9", safe: null },
  };
  const FILTERS = [
    ["none", "Normal", ""],
    ["bn", "B/N", "grayscale(1) contrast(1.1)"],
    ["noir", "Noir", "grayscale(1) contrast(1.6) brightness(.85)"],
    ["vintage", "Vintage", "sepia(.55) contrast(1.05) saturate(.85)"],
    ["calido", "Cálido", "sepia(.25) saturate(1.3) hue-rotate(-8deg)"],
    ["frio", "Frío", "saturate(1.05) hue-rotate(14deg) brightness(1.03)"],
    ["drama", "Drama", "contrast(1.35) saturate(.8) brightness(.92)"],
    ["vivo", "Vivo", "saturate(1.6) contrast(1.08)"],
    ["suave", "Suave", "brightness(1.08) contrast(.9) saturate(.9)"],
  ];
  const FILTER_CSS = Object.fromEntries(FILTERS.map(([k, , css]) => [k, css]));
  const MOTIONS = [["none", "Ninguno"], ["in", "Zoom in"], ["out", "Zoom out"], ["left", "Paneo ←"], ["right", "Paneo →"]];
  const TRANS = [["none", "Corte"], ["fade", "Fundido"], ["black", "A negro"], ["slide", "Deslizar"], ["zoom", "Zoom"], ["flash", "Flash"], ["blur", "Desenfoque"], ["spin", "Giro"]];
  const TSTYLES = [["karaoke", "Karaoke"], ["box", "Caja"], ["bar", "Barra"], ["red", "ROJO"], ["white", "Blanco"], ["yellow", "Amarillo"], ["neon", "Neón"], ["plain", "Simple"]];
  const TANIMS = [["pop", "Pop"], ["fade", "Aparecer"], ["slide", "Subir"], ["type", "Máquina"], ["none", "Ninguna"]];
  const HOOKS = [
    "POV: decidiste cuidarte de verdad", "Nadie te dice esto, pero…", "3 hábitos que cambiaron mi vida",
    "Si ves esto, es tu señal ✨", "Guarda esto para después 📌", "Haz esto cada mañana",
    "El error que todos cometen", "Antes vs. después de 30 días", "Esto es para ti que no te rindes",
  ];
  const CTAS = [
    "Sígueme para más 💫", "Guárdalo para después 📌", "Compártelo con quien lo necesita",
    "Comenta 💧 si ya tomaste agua", "Parte 2 en mi perfil 👀", "¿Cuál es el tuyo? Comenta 👇",
  ];
  const PLAT_TAGS = {
    tiktok: ["#fyp", "#parati"], reels: ["#reels", "#reelsinstagram"], shorts: ["#shorts"],
    fb: ["#reelsfacebook", "#reels"], feed45: ["#instagram"], square: ["#instagram"], youtube: ["#youtube"],
  };
  const TOPIC_TAGS = [
    [/cuidad|skin|agua|bienestar|salud/i, ["#autocuidado", "#selfcare", "#bienestar", "#habitossaludables"]],
    [/amor|autoestima|espejo/i, ["#amorpropio", "#selflove", "#autoestima"]],
    [/motiv|disciplin|éxito|exito|mentalidad/i, ["#motivacion", "#disciplina", "#mentalidad"]],
    [/gym|cardio|fit|entren|ejercicio/i, ["#gym", "#fitness", "#cardio", "#entrenamiento"]],
    [/glow|cambio|antes|despu/i, ["#glowup", "#transformacion"]],
    [/sad|triste|amor roto|soltar/i, ["#frases", "#sad", "#reflexion"]],
  ];
  const TD = 0.5; // segundos de transición

  /* ---------------- Estado ---------------- */

  const st = {
    p: null, L: [], els: new Map(), urls: [],
    actx: null, master: null, musicGain: null, musicBuf: null, musicSrc: null, musicKey: null, musicName: "",
    t: 0, playing: false, a0: 0, t0: 0, raf: 0, drawRaf: 0,
    sel: null, tool: null, pps: 40, hist: [], fut: [], lastKey: "", lastAt: 0, saveT: 0, expectScroll: -1, exp: null,
  };
  const cv = $("#stCanvas");
  const ctx = cv.getContext("2d");
  const tl = $("#stTimeline");
  const tiny = document.createElement("canvas");
  const tctx = tiny.getContext("2d");

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const even = (n) => Math.round(n / 2) * 2;
  const fmt = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(1).padStart(4, "0")}`; };
  const F = () => FORMATS[st.p?.format] || FORMATS.tiktok;
  const clipDur = (c) => (c.kind === "photo" ? c.dur : Math.max(0.1, (c.trimEnd - c.trimStart) / (c.speed || 1)));
  const total = () => (st.p ? st.p.clips.reduce((a, c) => a + clipDur(c), 0) : 0);
  const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const backOut = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
  function el(tag, cls = "", text = "") {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function relayout() {
    let t = 0;
    st.L = st.p.clips.map((c, i) => { const d = clipDur(c); const o = { c, i, start: t, end: t + d, d }; t += d; return o; });
  }
  function activeIndex(t) {
    const L = st.L;
    for (let i = 0; i < L.length; i++) if (t < L[i].end) return i;
    return L.length - 1;
  }

  const newProject = (format) => ({
    id: uid(), name: "Reel " + new Date().toLocaleDateString("es", { day: "numeric", month: "short" }),
    format, clips: [], texts: [], music: null, created: Date.now(), updated: Date.now(), duration: 0, thumb: null,
  });
  const photoClip = (photoId, o = {}) => ({ id: uid(), kind: "photo", src: photoId, dur: 3, filter: "none", motion: "in", fit: "contain", trans: "none", ...o });
  const videoClip = (m) => ({
    id: uid(), kind: "video", src: m.id, srcDur: m.duration, trimStart: 0, trimEnd: m.duration,
    speed: 1, volume: 1, muted: false, filter: "none", motion: "none", fit: "cover", trans: "none",
  });
  const newText = (text, start, end, o = {}) => ({ id: uid(), text, start, end, style: "box", anim: "pop", size: 6.5, y: 0.2, ...o });

  /* ---------------- Audio ---------------- */

  function ensureAudio() {
    if (st.actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    st.actx = new AC();
    st.master = st.actx.createGain();
    st.master.connect(st.actx.destination);
    st.musicGain = st.actx.createGain();
    st.musicGain.connect(st.master);
  }

  async function ensureMusic() {
    const m = st.p.music;
    const key = m ? m.audioId : null;
    if (key === st.musicKey && (st.musicBuf || !m)) return;
    stopMusic();
    st.musicBuf = null;
    st.musicKey = key;
    if (!m) return;
    const rec = await DB.get("audios", m.audioId);
    if (!rec) { st.p.music = null; st.musicKey = null; return; }
    try {
      st.musicBuf = await decodeAudioRecord(rec, st.actx);
      st.musicName = rec.name;
    } catch {
      toast("No se pudo leer ese audio");
      st.p.music = null;
      st.musicKey = null;
    }
  }

  function startMusic(t) {
    stopMusic();
    const m = st.p.music;
    const buf = st.musicBuf;
    const T = total();
    if (!m || !buf || t >= T) return;
    const off = clamp(m.offset || 0, 0, Math.max(0, buf.duration - 0.2));
    const loopLen = Math.max(0.2, buf.duration - off);
    const src = st.actx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = off;
    src.loopEnd = buf.duration;
    const g = st.musicGain.gain;
    const now = st.actx.currentTime;
    const V = m.volume;
    const fi = m.fadeIn ? Math.min(1.5, T / 3) : 0;
    const fo = m.fadeOut ? Math.min(1.5, T / 3) : 0;
    const volAt = (x) => Math.max(0, V * Math.min(1, fi ? x / fi : 1, fo ? (T - x) / fo : 1));
    g.cancelScheduledValues(now);
    g.setValueAtTime(volAt(t), now);
    if (fi && t < fi) g.linearRampToValueAtTime(volAt(fi), now + (fi - t));
    if (fo) {
      const s = Math.max(t, T - fo, fi);
      if (s > t) g.setValueAtTime(volAt(s), now + (s - t));
      g.linearRampToValueAtTime(0, now + (T - t));
    }
    src.connect(st.musicGain);
    src.start(now, off + (t % loopLen));
    st.musicSrc = src;
  }
  function stopMusic() {
    try { st.musicSrc?.stop(); } catch {}
    st.musicSrc = null;
  }

  /* ---------------- Elementos de cada clip ---------------- */

  async function loadEl(c) {
    if (st.els.has(c.id)) return st.els.get(c.id);
    let e = null;
    if (c.kind === "photo") {
      const rec = await DB.get("photos", c.src);
      if (rec) {
        const url = URL.createObjectURL(rec.rendered || rec.blob);
        st.urls.push(url);
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => {});
        e = { kind: "photo", el: img, thumb: url };
      }
    } else {
      const m = await DB.get("media", c.src);
      if (m) {
        const url = URL.createObjectURL(m.blob);
        st.urls.push(url);
        const v = document.createElement("video");
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.preload = "auto";
        v.src = url;
        await new Promise((r) => {
          v.addEventListener("loadeddata", r, { once: true });
          v.addEventListener("error", r, { once: true });
          setTimeout(r, 8000);
        });
        v.addEventListener("seeked", () => { if (!st.playing) requestDraw(false); });
        let gain = null;
        try {
          const s = st.actx.createMediaElementSource(v);
          gain = st.actx.createGain();
          gain.gain.value = 0;
          s.connect(gain).connect(st.master);
        } catch (err) { console.warn(err); }
        e = { kind: "video", el: v, gain, thumb: m.thumb };
      }
    }
    if (e) st.els.set(c.id, e);
    return e;
  }

  function dropEl(id) {
    const e = st.els.get(id);
    if (!e) return;
    if (e.kind === "video") { e.el.pause(); try { e.gain?.disconnect(); } catch {} }
    st.els.delete(id);
  }
  function pruneEls() {
    const ids = new Set(st.p.clips.map((c) => c.id));
    for (const id of [...st.els.keys()]) if (!ids.has(id)) dropEl(id);
  }

  function syncVideos(t) {
    const ai = activeIndex(t);
    st.L.forEach((o, i) => {
      const e = st.els.get(o.c.id);
      if (!e || e.kind !== "video") return;
      const v = e.el, c = o.c;
      if (i === ai) {
        const target = c.trimStart + (t - o.start) * c.speed;
        v.playbackRate = c.speed;
        if (e.gain) e.gain.gain.value = c.muted ? 0 : c.volume;
        if (st.playing) {
          if (v.paused) {
            if (Math.abs(v.currentTime - target) > 0.05) v.currentTime = target;
            v.play().catch(() => {});
          } else if (Math.abs(v.currentTime - target) > 0.35) v.currentTime = target;
        } else {
          if (!v.paused) v.pause();
          if (Math.abs(v.currentTime - target) > 0.03) v.currentTime = target;
        }
      } else {
        if (e.gain) e.gain.gain.value = 0;
        if (!v.paused) v.pause();
        // el clip anterior queda en su último cuadro (para las transiciones) y el siguiente, listo en su inicio
        if (i === ai - 1 || i === ai + 1) {
          const want = i === ai - 1 ? Math.max(c.trimStart, c.trimEnd - 0.05) : c.trimStart;
          if (!v.seeking && Math.abs(v.currentTime - want) > 0.1) v.currentTime = want;
        }
      }
    });
  }

  /* ---------------- Dibujo ---------------- */

  function srcSize(e) {
    return e.kind === "photo" ? [e.el.naturalWidth, e.el.naturalHeight] : [e.el.videoWidth, e.el.videoHeight];
  }

  function drawClip(g, o, lt, W, H, fx = {}) {
    const e = st.els.get(o.c.id);
    if (!e) return;
    const [sw, sh] = srcSize(e);
    if (!sw || !sh) return;
    const c = o.c;
    const p = clamp(lt / o.d, 0, 1);
    let z = 1, px = 0;
    if (c.motion === "in") z = 1 + 0.12 * p;
    else if (c.motion === "out") z = 1.12 - 0.12 * p;
    else if (c.motion === "left") { z = 1.14; px = (0.5 - p) * 0.1; }
    else if (c.motion === "right") { z = 1.14; px = (p - 0.5) * 0.1; }
    z *= fx.scale || 1;

    g.save();
    g.globalAlpha = fx.alpha ?? 1;
    if (fx.dx) g.translate(fx.dx, 0);
    if (fx.rot) { g.translate(W / 2, H / 2); g.rotate(fx.rot); g.translate(-W / 2, -H / 2); }
    const filter = [FILTER_CSS[c.filter] || "", fx.blur ? `blur(${fx.blur.toFixed(1)}px)` : ""].join(" ").trim();

    if (c.fit === "contain") {
      // fondo: la misma imagen en miniatura ampliada (se ve difuminada) y oscurecida
      const k = Math.max(tiny.width / sw, tiny.height / sh);
      const cw = tiny.width / k, ch = tiny.height / k;
      tctx.drawImage(e.el, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, tiny.width, tiny.height);
      g.filter = filter || "none";
      g.drawImage(tiny, 0, 0, W, H);
      g.filter = "none";
      g.fillStyle = "rgba(0,0,0,.42)";
      g.fillRect(0, 0, W, H);
    }
    const k = (c.fit === "contain" ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh)) * z;
    const dw = sw * k, dh = sh * k;
    g.filter = filter || "none";
    g.drawImage(e.el, (W - dw) / 2 + px * W, (H - dh) / 2, dw, dh);
    g.restore();
  }

  function drawText(g, tx, lt, W, H) {
    const fs = Math.round((W * tx.size) / 100);
    const rawLt = lt;
    // En pausa (editando) el texto se ve completo; la animación solo corre al reproducir y exportar
    if (!st.playing) lt = Math.max(lt, 2);
    const ain = clamp(lt / 0.35, 0, 1);
    const ease = 1 - Math.pow(1 - ain, 3);
    let text = tx.style === "red" ? tx.text.toUpperCase() : tx.text;
    if (tx.anim === "type") text = text.slice(0, Math.floor(lt / 0.045) + 1);
    let alpha = 1, sc = 1, dy = 0;
    if (tx.anim === "fade") alpha = ease;
    if (tx.anim === "pop") { sc = 0.6 + 0.4 * backOut(ain); alpha = Math.min(1, ain * 2); }
    if (tx.anim === "slide") { dy = (1 - ease) * fs * 1.5; alpha = ease; }
    const rem = tx.end - tx.start - lt;
    if (rem < 0.2 && st.playing) alpha *= clamp(rem / 0.2, 0, 1);

    g.save();
    g.font = `800 ${fs}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const lines = wrapText(g, text, W * 0.84);
    const lh = fs * 1.22;
    const cy = tx.y * H;
    const top = cy - (lines.length * lh) / 2;
    g.globalAlpha = alpha;
    g.translate(W / 2, cy + dy);
    g.scale(sc, sc);
    g.translate(-W / 2, -cy);
    const yOf = (i) => top + lh * i + lh / 2;

    if (tx.style === "bar") {
      const pad = fs * 0.6;
      g.fillStyle = "#f3f8f1";
      g.fillRect(0, top - pad, W, lines.length * lh + pad * 2);
    }
    // Karaoke: la palabra que se está diciendo se pinta en amarillo
    const nWords = text.split(/\s+/).filter(Boolean).length;
    const curWord = Math.floor(clamp(rawLt / Math.max(0.1, tx.end - tx.start), 0, 0.999) * nWords);
    let wordIdx = 0;
    lines.forEach((l, i) => {
      const y = yOf(i);
      switch (tx.style) {
        case "karaoke": {
          g.textAlign = "left";
          g.lineJoin = "round";
          g.lineWidth = fs * 0.18;
          g.strokeStyle = "#000";
          let x = W / 2 - g.measureText(l).width / 2;
          for (const w of l.split(" ")) {
            g.strokeText(w, x, y);
            g.fillStyle = wordIdx === curWord ? "#ffd60a" : "#fff";
            g.fillText(w, x, y);
            x += g.measureText(w + " ").width;
            if (w) wordIdx++;
          }
          g.textAlign = "center";
          break;
        }
        case "box": {
          const w = g.measureText(l).width + fs * 0.7;
          g.fillStyle = "#fff";
          g.beginPath();
          if (g.roundRect) g.roundRect(W / 2 - w / 2, y - lh / 2, w, lh, fs * 0.25);
          else g.rect(W / 2 - w / 2, y - lh / 2, w, lh);
          g.fill();
          g.fillStyle = "#0b0b0b";
          g.fillText(l, W / 2, y + fs * 0.04);
          break;
        }
        case "bar": g.fillStyle = "#0b0b0b"; g.fillText(l, W / 2, y); break;
        case "red":
          g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = fs * 0.2;
          g.fillStyle = "#ef3b2d"; g.fillText(l, W / 2, y); break;
        case "white":
        case "yellow":
          g.lineJoin = "round"; g.lineWidth = fs * 0.16; g.strokeStyle = "#000";
          g.strokeText(l, W / 2, y);
          g.fillStyle = tx.style === "yellow" ? "#ffd60a" : "#fff";
          g.fillText(l, W / 2, y); break;
        case "neon":
          g.shadowColor = "#ff2bd6"; g.shadowBlur = fs * 0.6;
          g.fillStyle = "#fff"; g.fillText(l, W / 2, y); g.fillText(l, W / 2, y); break;
        default:
          g.shadowColor = "rgba(0,0,0,.7)"; g.shadowBlur = fs * 0.25;
          g.fillStyle = "#fff"; g.fillText(l, W / 2, y);
      }
    });
    g.restore();
  }

  function drawFrame(g, t, W, H) {
    g.save();
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    const i = activeIndex(t);
    if (i >= 0) {
      const o = st.L[i];
      const lt = t - o.start;
      const tr = o.c.trans || "none";
      const td = Math.min(TD, o.d / 2);
      if (i > 0 && tr !== "none" && lt < td) {
        const prev = st.L[i - 1];
        const p = easeInOut(clamp(lt / td, 0, 1));
        const plt = prev.d;
        switch (tr) {
          case "fade": drawClip(g, prev, plt, W, H); drawClip(g, o, lt, W, H, { alpha: p }); break;
          case "black":
            if (p < 0.5) drawClip(g, prev, plt, W, H, { alpha: 1 - p * 2 });
            else drawClip(g, o, lt, W, H, { alpha: (p - 0.5) * 2 });
            break;
          case "slide": drawClip(g, prev, plt, W, H, { dx: -p * W }); drawClip(g, o, lt, W, H, { dx: (1 - p) * W }); break;
          case "zoom": drawClip(g, prev, plt, W, H, { scale: 1 + p * 0.4, alpha: 1 - p }); drawClip(g, o, lt, W, H, { scale: 1.4 - 0.4 * p, alpha: p }); break;
          case "flash": drawClip(g, o, lt, W, H); g.fillStyle = `rgba(255,255,255,${(1 - p).toFixed(3)})`; g.fillRect(0, 0, W, H); break;
          case "blur": drawClip(g, o, lt, W, H, { blur: (1 - p) * (W / 45) }); break;
          case "spin":
            drawClip(g, prev, plt, W, H, { rot: p * 0.6, scale: 1 + p * 0.3, alpha: 1 - p });
            drawClip(g, o, lt, W, H, { rot: -(1 - p) * 0.6, scale: 1.3 - 0.3 * p, alpha: p });
            break;
          default: drawClip(g, o, lt, W, H);
        }
      } else drawClip(g, o, lt, W, H);
    }
    for (const tx of st.p.texts) if (t >= tx.start && t < tx.end) drawText(g, tx, t - tx.start, W, H);
    g.restore();
  }

  function requestDraw(seek = true) {
    if (st.playing) return;
    cancelAnimationFrame(st.drawRaf);
    st.drawRaf = requestAnimationFrame(() => {
      if (!st.p) return;
      if (seek) syncVideos(st.t);
      drawFrame(ctx, st.t, cv.width, cv.height);
      updateTime();
    });
  }

  function updateTime() {
    $("#stTime").textContent = `${fmt(st.t)} / ${fmt(total())}`;
    $("#stEmpty").hidden = st.L.length > 0;
  }

  /* ---------------- Reproducción ---------------- */

  function play() {
    if (!st.L.length) return toast("Agrega fotos o videos primero");
    ensureAudio();
    st.actx.resume();
    if (st.t >= total() - 0.05) st.t = 0;
    st.playing = true;
    st.t0 = st.t;
    st.a0 = st.actx.currentTime;
    startMusic(st.t);
    $("#stPlay").textContent = "❚❚";
    loop();
  }

  function pause() {
    st.playing = false;
    cancelAnimationFrame(st.raf);
    stopMusic();
    for (const e of st.els.values()) if (e.kind === "video") { e.el.pause(); if (e.gain) e.gain.gain.value = 0; }
    $("#stPlay").textContent = "▶";
    requestDraw();
  }

  function loop() {
    if (!st.playing) return;
    const T = total();
    st.t = st.t0 + (st.actx.currentTime - st.a0);
    if (st.t >= T) {
      st.t = T;
      if (st.exp) return finishExport();
      pause();
      setScroll();
      return;
    }
    syncVideos(st.t);
    if (st.exp) {
      drawFrame(st.exp.g, st.t, st.exp.W, st.exp.H);
      st.exp.progress(st.t / T);
    } else {
      drawFrame(ctx, st.t, cv.width, cv.height);
      setScroll();
      updateTime();
    }
    st.raf = requestAnimationFrame(loop);
  }

  $("#stPlay").addEventListener("click", () => (st.playing ? pause() : play()));

  /* ---------------- Lienzo y zona segura ---------------- */

  function fitCanvas() {
    const f = F();
    const stage = $("#stStage").getBoundingClientRect();
    const aw = Math.max(80, stage.width - 24), ah = Math.max(80, stage.height - 8);
    const k = Math.min(aw / f.w, ah / f.h);
    const wrap = $("#stWrap");
    wrap.style.width = Math.round(f.w * k) + "px";
    wrap.style.height = Math.round(f.h * k) + "px";
    const pr = Math.min(1, (f.w * k * Math.min(2, devicePixelRatio || 1)) / f.w, 0.6);
    cv.width = even(f.w * pr);
    cv.height = even(f.h * pr);
    tiny.width = 40;
    tiny.height = Math.max(8, Math.round((40 * f.h) / f.w));
    renderSafe();
    requestDraw();
  }
  // Reajusta la vista previa cuando cambia el espacio (girar el teléfono, abrir o cerrar un panel)
  let lastStage = "";
  new ResizeObserver(() => {
    if (!st.p || $("#studio").hidden) return;
    const r = $("#stStage").getBoundingClientRect();
    const k = Math.round(r.width) + "x" + Math.round(r.height);
    if (k !== lastStage) { lastStage = k; fitCanvas(); renderTimeline(); }
  }).observe($("#stStage"));

  let showSafe = false;
  function renderSafe() {
    const box = $("#stSafe");
    const s = F().safe;
    box.hidden = !showSafe || !s;
    box.innerHTML = "";
    if (!s || !showSafe) return;
    const add = (css) => { const i = el("i"); Object.assign(i.style, css); box.append(i); return i; };
    add({ left: 0, right: 0, top: 0, height: s.top * 100 + "%" });
    add({ left: 0, right: 0, bottom: 0, height: s.bottom * 100 + "%" }).append(el("span", "", "Texto y botones de " + F().name));
    add({ right: 0, top: s.top * 100 + "%", bottom: s.bottom * 100 + "%", width: s.right * 100 + "%" });
  }

  /* ---------------- Línea de tiempo ---------------- */

  const isSel = (type, id) => st.sel?.type === type && st.sel.id === id;

  function renderTimeline() {
    const pad = Math.round(tl.clientWidth / 2);
    const pps = st.pps;
    const T = total();
    $("#stTracks").style.width = pad * 2 + T * pps + 70 + "px";

    const clips = $("#stClips");
    clips.innerHTML = "";
    st.L.forEach((o, i) => {
      const b = el("div", "st-clip" + (isSel("clip", o.c.id) ? " st-sel" : ""));
      b.style.left = pad + o.start * pps + "px";
      b.style.width = Math.max(10, o.d * pps - 2) + "px";
      const e = st.els.get(o.c.id);
      if (e?.thumb) b.style.backgroundImage = `url("${e.thumb}")`;
      b.append(el("span", "", o.d.toFixed(1) + "s"));
      const kind = (o.c.kind === "video" ? "🎬" : "🖼") + (o.c.kind === "video" && o.c.speed !== 1 ? " " + o.c.speed + "x" : "") + (e ? "" : " ⚠");
      b.append(el("span", "st-kind", kind));
      b.addEventListener("click", (ev) => { ev.stopPropagation(); select({ type: "clip", id: o.c.id }); });
      clips.append(b);
      if (i > 0) {
        const has = o.c.trans && o.c.trans !== "none";
        const tb = el("button", "st-trans" + (has ? " has" : ""), has ? "⇄" : "+");
        tb.title = "Transición";
        tb.style.left = pad + o.start * pps + "px";
        tb.addEventListener("click", (ev) => { ev.stopPropagation(); select({ type: "clip", id: o.c.id }, "trans"); });
        clips.append(tb);
      }
    });
    const ghost = el("button", "st-add-ghost", "+");
    ghost.style.left = pad + T * pps + 6 + "px";
    ghost.addEventListener("click", (ev) => { ev.stopPropagation(); openAdd(); });
    clips.append(ghost);

    const texts = $("#stTexts");
    texts.innerHTML = "";
    for (const tx of st.p.texts) {
      const b = el("div", "st-text" + (tx.sub ? " sub" : "") + (isSel("text", tx.id) ? " st-sel" : ""), (tx.sub ? "CC " : "T ") + tx.text);
      b.style.left = pad + tx.start * pps + "px";
      b.style.width = Math.max(14, (tx.end - tx.start) * pps - 2) + "px";
      b.addEventListener("click", (ev) => { ev.stopPropagation(); select({ type: "text", id: tx.id }); });
      texts.append(b);
    }
    if (!st.p.texts.length && T) {
      const h = el("div", "st-hint-row", "＋ Toca “Texto” para agregar frases");
      h.style.left = pad + "px";
      texts.append(h);
    }

    const mus = $("#stMusic");
    mus.innerHTML = "";
    if (st.p.music && st.musicBuf) {
      const b = el("div", "st-mus" + (isSel("music", "music") ? " st-sel" : ""), "♫ " + st.musicName);
      b.style.left = pad + "px";
      b.style.width = Math.max(30, T * pps - 2) + "px";
      b.addEventListener("click", (ev) => { ev.stopPropagation(); select({ type: "music", id: "music" }); });
      mus.append(b);
    } else if (T) {
      const h = el("div", "st-hint-row", "♫ Toca “Música” para agregar una canción");
      h.style.left = pad + "px";
      mus.append(h);
    }
    setScroll();
  }

  function setScroll() {
    const x = Math.round(st.t * st.pps);
    st.expectScroll = x;
    tl.scrollLeft = x;
  }

  tl.addEventListener("scroll", () => {
    if (Math.abs(tl.scrollLeft - st.expectScroll) < 2) return;
    if (st.playing) pause();
    st.expectScroll = -1;
    st.t = clamp(tl.scrollLeft / st.pps, 0, total());
    requestDraw();
  });
  tl.addEventListener("pointerdown", () => { if (st.playing) pause(); });
  $("#stTracks").addEventListener("click", () => { if (st.sel) select(null); });
  $("#stZoomIn").addEventListener("click", () => { st.pps = Math.min(160, st.pps * 1.4); renderTimeline(); });
  $("#stZoomOut").addEventListener("click", () => { st.pps = Math.max(8, st.pps / 1.4); renderTimeline(); });

  /* ---------------- Cambios, deshacer y guardado ---------------- */

  const snapshot = () => JSON.stringify({ ...st.p, thumb: null });

  function mutate(fn, { key = "", rebuild = false } = {}) {
    const now = Date.now();
    if (!(key && key === st.lastKey && now - st.lastAt < 900)) {
      st.hist.push(snapshot());
      if (st.hist.length > 80) st.hist.shift();
      st.fut = [];
    }
    st.lastKey = key;
    st.lastAt = now;
    fn(st.p);
    return changed(rebuild);
  }

  async function changed(rebuild) {
    if (rebuild) {
      for (const c of st.p.clips) await loadEl(c);
      pruneEls();
      await ensureMusic();
    }
    relayout();
    st.t = clamp(st.t, 0, total());
    if (st.sel && !findSel()) { st.sel = null; st.tool = null; renderPanel(); }
    renderTimeline();
    renderTools();
    requestDraw();
    $("#stUndo").disabled = !st.hist.length;
    $("#stRedo").disabled = !st.fut.length;
    scheduleSave();
  }

  async function undoRedo(from, to) {
    if (!from.length) return;
    to.push(snapshot());
    const thumb = st.p.thumb;
    st.p = JSON.parse(from.pop());
    st.p.thumb = thumb;
    st.lastKey = "";
    await changed(true);
    renderPanel();
  }
  $("#stUndo").addEventListener("click", () => undoRedo(st.hist, st.fut));
  $("#stRedo").addEventListener("click", () => undoRedo(st.fut, st.hist));

  function scheduleSave() {
    clearTimeout(st.saveT);
    st.saveT = setTimeout(saveNow, 700);
  }
  async function saveNow() {
    clearTimeout(st.saveT);
    if (!st.p) return;
    st.p.updated = Date.now();
    st.p.duration = total();
    try {
      const th = document.createElement("canvas");
      th.width = 270;
      th.height = Math.round((270 * F().h) / F().w);
      th.getContext("2d").drawImage(cv, 0, 0, th.width, th.height);
      if (st.L.length) st.p.thumb = th.toDataURL("image/jpeg", 0.72);
    } catch {}
    await DB.put("projects", st.p);
  }

  /* ---------------- Selección y herramientas ---------------- */

  function findSel() {
    const s = st.sel;
    if (!s) return null;
    if (s.type === "clip") return st.p.clips.find((c) => c.id === s.id);
    if (s.type === "text") return st.p.texts.find((x) => x.id === s.id);
    if (s.type === "music") return st.p.music;
    return null;
  }

  function select(s, tool = null) {
    st.sel = s;
    st.tool = tool;
    if (s?.type === "text") {
      const tx = findSel();
      if (tx && (st.t < tx.start || st.t >= tx.end)) { st.t = tx.start + 0.01; requestDraw(); }
    }
    if (s?.type === "clip" && tool === "trans") {
      const o = st.L.find((x) => x.c.id === s.id);
      if (o) { st.t = o.start; requestDraw(); }
    }
    renderTimeline();
    renderTools();
    renderPanel();
  }

  function toolsFor() {
    const s = st.sel;
    if (s?.type === "clip") {
      const c = findSel();
      const v = c?.kind === "video";
      return [
        ["back", "‹", "Atrás"], ["split", "✂", "Dividir"],
        v ? ["trim", "⇤⇥", "Recortar"] : ["dur", "⏱", "Duración"],
        ...(v ? [["speed", "⏩", "Velocidad"], ["vol", "🔊", "Volumen"]] : []),
        ["filter", "◐", "Filtros"], ["motion", "↗", "Movimiento"], ["fit", "⤢", "Ajuste"], ["trans", "⇄", "Transición"],
        ["dup", "⧉", "Duplicar"], ["left", "◀", "Mover"], ["right", "▶", "Mover"], ["del", "🗑", "Borrar", "danger"],
      ];
    }
    if (s?.type === "text") {
      return [
        ["back", "‹", "Atrás"], ["edit", "✎", "Editar"], ["tstyle", "Aa", "Estilo"], ["tanim", "✦", "Animación"],
        ["tsize", "A↕", "Tamaño"], ["tpos", "↕", "Posición"], ["ttime", "⏱", "Tiempo"], ["tdup", "⧉", "Duplicar"],
        ["tdel", "🗑", "Borrar", "danger"],
      ];
    }
    if (s?.type === "music") {
      return [
        ["back", "‹", "Atrás"], ["mchange", "♫", "Cambiar"], ["mvol", "🔊", "Volumen"], ["moff", "⇥", "Inicio"],
        ["mfade", "◢", "Fundidos"], ["mdel", "🗑", "Quitar", "danger"],
      ];
    }
    return [
      ["add", "＋", "Medios"], ["text", "T", "Texto"], ["subs", "CC", "Subtítulos"], ["music", "♫", "Música"], ["hooks", "🪝", "Ganchos"],
      ["format", "▭", "Formato"], ["safe", "◰", "Zona segura"], ["transAll", "⇄", "Transiciones"], ["filtersAll", "◐", "Filtros"],
    ];
  }

  function renderTools() {
    const bar = $("#stTools");
    bar.innerHTML = "";
    for (const [id, icon, label, cls] of toolsFor()) {
      const b = el("button", (cls || "") + (st.tool === id || (id === "safe" && showSafe) ? " on" : ""));
      b.append(el("span", "", icon), document.createTextNode(label));
      b.addEventListener("click", () => runTool(id));
      bar.append(b);
    }
  }

  const playheadClipIndex = () => (st.L.length ? activeIndex(st.t) : -1);

  async function runTool(id) {
    const c = st.sel?.type === "clip" ? findSel() : null;
    const tx = st.sel?.type === "text" ? findSel() : null;
    switch (id) {
      case "back": return select(null);
      case "add": return openAdd();
      case "safe":
        showSafe = !showSafe;
        renderSafe();
        renderTools();
        if (showSafe && !F().safe) toast("Este formato no tiene zona segura");
        return;
      case "text": {
        const T = total();
        if (!T) return toast("Agrega un clip primero");
        const start = clamp(st.t, 0, Math.max(0, T - 0.5));
        const t = newText("Escribe tu frase", start, Math.min(T, start + 3));
        await mutate((p) => p.texts.push(t));
        return select({ type: "text", id: t.id }, "edit");
      }
      case "music":
        if (st.p.music) return select({ type: "music", id: "music" }, "mvol");
        st.tool = "mchange";
        renderTools();
        return renderPanel();
      case "split": {
        const o = st.L.find((x) => x.c.id === c.id);
        const lt = st.t - o.start;
        if (lt < 0.2 || o.d - lt < 0.2) return toast("Mueve el cabezal blanco dentro del clip para dividirlo");
        const b = { ...c, id: uid(), trans: "none" };
        await mutate((p) => {
          if (c.kind === "photo") { b.dur = c.dur - lt; c.dur = lt; }
          else { const cut = c.trimStart + lt * c.speed; b.trimStart = cut; c.trimEnd = cut; }
          p.clips.splice(o.i + 1, 0, b);
        }, { rebuild: true });
        return toast("Clip dividido ✂");
      }
      case "dup": {
        const i = st.p.clips.indexOf(c);
        const b = { ...c, id: uid() };
        await mutate((p) => p.clips.splice(i + 1, 0, b), { rebuild: true });
        return select({ type: "clip", id: b.id });
      }
      case "left":
      case "right": {
        const i = st.p.clips.indexOf(c);
        const j = id === "left" ? i - 1 : i + 1;
        if (j < 0 || j >= st.p.clips.length) return;
        await mutate((p) => { [p.clips[i], p.clips[j]] = [p.clips[j], p.clips[i]]; });
        const o = st.L.find((x) => x.c.id === c.id);
        st.t = o.start;
        return requestDraw();
      }
      case "del":
        await mutate((p) => { p.clips = p.clips.filter((x) => x !== c); }, { rebuild: true });
        return select(null);
      case "tdup": {
        const b = { ...tx, id: uid() };
        await mutate((p) => p.texts.push(b));
        return select({ type: "text", id: b.id });
      }
      case "tdel":
        await mutate((p) => { p.texts = p.texts.filter((x) => x !== tx); });
        return select(null);
      case "mdel":
        await mutate((p) => { p.music = null; }, { rebuild: true });
        return select(null);
      default:
        st.tool = st.tool === id ? null : id;
        renderTools();
        renderPanel();
    }
  }

  /* ---------------- Paneles de cada herramienta ---------------- */

  function showPanel(title, ...children) {
    const P = $("#stPanel");
    P.hidden = false;
    P.innerHTML = "";
    const h = el("div", "ph");
    h.append(el("b", "", title));
    const ok = el("button", "", "✓");
    ok.addEventListener("click", () => { st.tool = null; renderPanel(); renderTools(); });
    h.append(ok);
    P.append(h, ...children);
  }

  function chips(options, current, onPick, wrap = false) {
    const row = el("div", wrap ? "wrap-chips" : "chips-row");
    for (const [v, label] of options) {
      const b = el("button", v === current ? "on" : "", label);
      b.addEventListener("click", () => {
        [...row.children].forEach((x) => x.classList.toggle("on", x === b));
        onPick(v);
      });
      row.append(b);
    }
    return row;
  }

  function slider(label, min, max, step, value, show, onInput) {
    const w = el("label", "slider");
    const i = document.createElement("input");
    Object.assign(i, { type: "range", min, max, step, value });
    const o = el("output", "", show(value));
    i.addEventListener("input", () => { o.textContent = show(+i.value); onInput(+i.value); });
    w.append(el("span", "", label), i, o);
    return w;
  }

  const btn = (label, onClick, cls = "btn") => { const b = el("button", cls, label); b.addEventListener("click", onClick); return b; };
  const label = (t) => el("div", "label", t);
  const row = (...kids) => { const r = el("div", "row gap"); r.append(...kids); return r; };
  const forAll = (field, value) => mutate((p) => p.clips.forEach((x, i) => { if (field !== "trans" || i > 0) x[field] = value; }));

  function renderPanel() {
    const P = $("#stPanel");
    const id = st.tool;
    if (!id || !st.p) { P.hidden = true; P.innerHTML = ""; return; }
    const c = st.sel?.type === "clip" ? findSel() : null;
    const tx = st.sel?.type === "text" ? findSel() : null;
    const m = st.p.music;
    const T = total();
    const secs = (v) => v.toFixed(1) + " s";
    const pct = (v) => Math.round(v * 100) + "%";

    switch (id) {
      case "dur":
        return showPanel("Duración de la foto",
          slider("Duración", 0.5, 15, 0.1, c.dur, secs, (v) => mutate(() => { c.dur = v; }, { key: "dur" + c.id })));
      case "trim": {
        const o = () => st.L.find((x) => x.c.id === c.id);
        return showPanel("Recortar video",
          slider("Inicio", 0, Math.max(0.2, c.srcDur - 0.3), 0.05, c.trimStart, secs, (v) =>
            mutate(() => { c.trimStart = Math.min(v, c.trimEnd - 0.3); }, { key: "ts" + c.id }).then(() => { st.t = o().start; requestDraw(); })),
          slider("Fin", 0.3, c.srcDur, 0.05, c.trimEnd, secs, (v) =>
            mutate(() => { c.trimEnd = Math.max(v, c.trimStart + 0.3); }, { key: "te" + c.id }).then(() => { st.t = Math.max(o().start, o().end - 0.05); requestDraw(); })),
          el("p", "hint", `Video original: ${secs(c.srcDur)}. Para cortar en un punto exacto usa ✂ Dividir.`));
      }
      case "speed":
        return showPanel("Velocidad",
          chips([[0.25, "0.25x"], [0.5, "0.5x"], [0.75, "0.75x"], [1, "Normal"], [1.5, "1.5x"], [2, "2x"], [3, "3x"]], c.speed,
            (v) => mutate(() => { c.speed = v; })),
          el("p", "hint", "Cámara lenta para momentos épicos; rápido para resumir procesos (rutinas, recetas, antes/después)."));
      case "vol": {
        const mute = el("label", "check row");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = c.muted;
        cb.addEventListener("change", () => mutate(() => { c.muted = cb.checked; }));
        mute.append(cb, document.createTextNode(" Silenciar el audio de este video"));
        return showPanel("Volumen del video",
          slider("Volumen", 0, 2, 0.05, c.volume, pct, (v) => mutate(() => { c.volume = v; }, { key: "vol" + c.id })), mute);
      }
      case "filter":
      case "filtersAll": {
        const cur = c ? c.filter : st.p.clips[0]?.filter;
        return showPanel(c ? "Filtro" : "Filtro para todo el reel",
          chips(FILTERS.map(([k, n]) => [k, n]), cur, (v) => (c ? mutate(() => { c.filter = v; }) : forAll("filter", v)), true),
          c ? btn("Aplicar a todos los clips", () => forAll("filter", c.filter).then(() => toast("Filtro aplicado a todo"))) : "");
      }
      case "motion":
        return showPanel("Movimiento (efecto Ken Burns)",
          chips(MOTIONS, c.motion, (v) => mutate(() => { c.motion = v; })),
          btn("Aplicar a todos (alternando)", () =>
            mutate((p) => p.clips.forEach((x, i) => { x.motion = c.motion === "none" ? "none" : i % 2 ? (c.motion === "in" ? "out" : "in") : c.motion; }))
              .then(() => toast("Movimiento aplicado"))));
      case "fit":
        return showPanel("Ajuste en pantalla",
          chips([["cover", "Llenar pantalla"], ["contain", "Encajar + fondo difuminado"]], c.fit, (v) => mutate(() => { c.fit = v; })),
          btn("Aplicar a todos los clips", () => forAll("fit", c.fit).then(() => toast("Ajuste aplicado a todo"))));
      case "trans":
      case "transAll": {
        const first = c && st.p.clips[0] === c;
        if (first) return showPanel("Transición", el("p", "hint", "La transición se aplica al ENTRAR un clip. El primer clip no tiene; elige el siguiente."));
        return showPanel(c ? "Transición de entrada" : "Transición entre todos los clips",
          chips(TRANS, c ? c.trans : st.p.clips[1]?.trans || "none", (v) => (c ? mutate(() => { c.trans = v; }) : forAll("trans", v)).then(() => {
            if (c) { const o = st.L.find((x) => x.c.id === c.id); st.t = Math.max(0, o.start - 0.3); play(); }
          }), true),
          c ? btn("Aplicar a todos los clips", () => forAll("trans", c.trans).then(() => toast("Transición aplicada a todo"))) : "");
      }
      case "format":
        return showPanel("Formato y plataforma",
          chips(Object.entries(FORMATS).map(([k, f]) => [k, `${f.name} · ${f.tip}`]), st.p.format, (v) =>
            mutate((p) => { p.format = v; }).then(() => { $("#stFmt").textContent = F().name + " · " + F().tip; fitCanvas(); }), true));
      case "hooks": {
        const T0 = total();
        const addAt = (text, start, end, o) => {
          const t = newText(text, start, end, o);
          return mutate((p) => p.texts.push(t)).then(() => select({ type: "text", id: t.id }));
        };
        const pool = Object.values(PHRASES).flat().sort(() => Math.random() - 0.5).slice(0, 8);
        return showPanel("Ganchos y llamados a la acción",
          el("p", "hint", "Los primeros 2 segundos deciden si la gente se queda. Un gancho fuerte y un cierre con llamado a la acción ayudan a la retención y a ganar seguidores."),
          label("Gancho al inicio"),
          chips(HOOKS.map((h) => [h, h]), null, (h) => addAt(h, 0, Math.min(T0, 2.5), { style: "box", anim: "pop", y: 0.2 }), true),
          label("Cierre (llamado a la acción)"),
          chips(CTAS.map((h) => [h, h]), null, (h) => addAt(h, Math.max(0, T0 - 2.5), T0, { style: "box", anim: "slide", y: 0.78 }), true),
          label("Frases de Mog (en el cabezal)"),
          chips(pool.map((h) => [h, h]), null, (h) => addAt(h, clamp(st.t, 0, Math.max(0, T0 - 0.5)), Math.min(T0, st.t + 3), { style: "bar", anim: "fade", y: 0.5 }), true));
      }
      case "subs": return subsPanel();
      case "edit": {
        const ta = document.createElement("textarea");
        ta.rows = 2;
        ta.value = tx.text;
        ta.addEventListener("input", () => mutate(() => { tx.text = ta.value; }, { key: "txt" + tx.id }));
        setTimeout(() => { ta.focus(); ta.select(); }, 50);
        return showPanel("Texto", ta,
          chips(Object.values(PHRASES).flat().slice(0, 12).map((h) => [h, h]), null, (h) => { ta.value = h; mutate(() => { tx.text = h; }); }));
      }
      case "tstyle":
        return showPanel("Estilo del texto", chips(TSTYLES, tx.style, (v) => mutate(() => { tx.style = v; }), true));
      case "tanim":
        return showPanel("Animación de entrada", chips(TANIMS, tx.anim, (v) => mutate(() => { tx.anim = v; })));
      case "tsize":
        return showPanel("Tamaño", slider("Tamaño", 3, 14, 0.1, tx.size, (v) => v.toFixed(1), (v) => mutate(() => { tx.size = v; }, { key: "ts" + tx.id })));
      case "tpos": {
        let s;
        const set = (v) => mutate(() => { tx.y = v; }, { key: "ty" + tx.id });
        return showPanel("Posición vertical",
          (s = slider("Altura", 0.05, 0.95, 0.01, tx.y, pct, set)),
          chips([[0.15, "Arriba"], [0.5, "Centro"], [0.78, "Abajo"]], null, (v) => { s.querySelector("input").value = v; s.querySelector("output").textContent = pct(v); set(v); }),
          el("p", "hint", "Activa ◰ Zona segura para no quedar debajo de los botones de la app."));
      }
      case "ttime":
        return showPanel("Tiempo en pantalla",
          slider("Aparece", 0, Math.max(0.1, T - 0.2), 0.05, tx.start, secs, (v) => mutate(() => { tx.start = Math.min(v, tx.end - 0.2); }, { key: "tst" + tx.id })),
          slider("Desaparece", 0.2, Math.max(0.3, T), 0.05, tx.end, secs, (v) => mutate(() => { tx.end = Math.max(v, tx.start + 0.2); }, { key: "ten" + tx.id })),
          row(btn("Empieza en el cabezal", () => mutate(() => { tx.start = Math.min(st.t, tx.end - 0.2); }).then(renderPanel)),
              btn("Termina en el cabezal", () => mutate(() => { tx.end = Math.max(st.t, tx.start + 0.2); }).then(renderPanel))),
          btn("Mostrar durante todo el reel", () => mutate(() => { tx.start = 0; tx.end = T; }).then(renderPanel), "btn wide"));
      case "mchange": {
        if (!audios.length) {
          return showPanel("Música", el("p", "hint", "Aún no tienes audios. Súbelos en la pestaña Audio (canciones, notas de voz o el audio de un video)."));
        }
        return showPanel("Elige la música",
          chips(audios.map((a) => [a.id, "♫ " + a.name]), m?.audioId, (v) =>
            mutate((p) => { p.music = { audioId: v, offset: 0, volume: 0.9, fadeIn: true, fadeOut: true, ...(p.music ? { offset: 0, volume: p.music.volume } : {}), audioId: v }; }, { rebuild: true })
              .then(() => select({ type: "music", id: "music" }, "mvol")), true),
          el("p", "hint", "💡 Para monetizar, usa música propia o libre de derechos. Si quieres una canción de moda, agrégala desde la app (TikTok, Instagram…) al publicar."));
      }
      case "mvol": {
        const vids = st.p.clips.filter((x) => x.kind === "video");
        return showPanel("Volumen",
          slider("Música", 0, 1.5, 0.05, m.volume, pct, (v) => mutate(() => { m.volume = v; }, { key: "mv" })),
          vids.length ? slider("Audio videos", 0, 2, 0.05, vids[0].volume, pct, (v) => mutate(() => vids.forEach((x) => { x.volume = v; }), { key: "ov" })) : "",
          el("p", "hint", "Se aplica al reproducir y al exportar."));
      }
      case "moff":
        return showPanel("¿Desde qué parte empieza la canción?",
          slider("Empieza en", 0, Math.max(0.5, (st.musicBuf?.duration || 1) - 1), 0.1, m.offset || 0, (v) => fmtTime(v), (v) =>
            mutate(() => { m.offset = v; }, { key: "moff" })),
          btn("▶ Escuchar desde el inicio del reel", () => { st.t = 0; play(); }, "btn wide"));
      case "mfade":
        return showPanel("Fundidos de la música",
          chips([["in", "Entrada suave " + (m.fadeIn ? "✓" : "")], ["out", "Salida suave " + (m.fadeOut ? "✓" : "")]], null, (v) =>
            mutate(() => { if (v === "in") m.fadeIn = !m.fadeIn; else m.fadeOut = !m.fadeOut; }).then(renderPanel)));
    }
    P.hidden = true;
  }


  /* ---------------- Subtítulos automáticos (Whisper en el teléfono) ---------------- */

  const subOpts = Object.assign(
    { source: "voice", lang: "spanish", model: "onnx-community/whisper-base", style: "karaoke", words: 3, y: 0.72 },
    store.get("subOpts", {})
  );
  const saveSubOpts = () => store.set("subOpts", subOpts);
  const decoded16k = new Map(); // id del video -> audio decodificado a 16 kHz
  let subsWorker = null;
  let subsBusy = false;

  // Mezcla en una sola pista (16 kHz, mono) lo que se escucha en el reel: la voz de los videos o la música.
  async function speechTrack(source) {
    const T = total();
    const SR = 16000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(T * SR)), SR);
    let any = false;
    if (source === "music") {
      const m = st.p.music;
      const rec = m && (await DB.get("audios", m.audioId));
      if (!rec) return null;
      const buf = await off.decodeAudioData(await rec.blob.arrayBuffer());
      const src = off.createBufferSource();
      src.buffer = buf;
      src.connect(off.destination);
      src.start(0, (rec.start || 0) + (m.offset || 0));
      any = true;
    } else {
      for (const o of st.L) {
        const c = o.c;
        if (c.kind !== "video" || c.muted || c.volume <= 0) continue;
        let buf = decoded16k.get(c.src);
        if (buf === undefined) {
          const m = await DB.get("media", c.src);
          try { buf = m ? await off.decodeAudioData(await m.blob.arrayBuffer()) : null; } catch { buf = null; } // video sin audio
          decoded16k.set(c.src, buf);
        }
        if (!buf) continue;
        const src = off.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = c.speed;
        src.connect(off.destination);
        src.start(o.start, c.trimStart, Math.max(0.05, c.trimEnd - c.trimStart));
        any = true;
      }
    }
    if (!any) return null;
    const r = await off.startRendering();
    return r.getChannelData(0).slice();
  }

  const loudness = (a) => { let s = 0; for (let i = 0; i < a.length; i += 8) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length / 8)); };

  // Whisper a veces "inventa" frases en silencios o música (p. ej. créditos de Amara.org); se descartan.
  const HALLUCINATION = /amara\.org|subt[ií]tulos? (realizados|por|hechos)|^[\W_]*$|^\[.*\]$|^\(.*\)$|♪/i;

  function cleanChunks(chunks, T) {
    const out = [];
    let prev = "";
    for (const ch of chunks) {
      let [s, e] = ch.timestamp || [];
      if (s == null) continue;
      if (e == null || e <= s) e = Math.min(T, s + 3);
      s = clamp(s, 0, T);
      e = clamp(e, 0, T);
      const text = (ch.text || "").replace(/\s+/g, " ").trim();
      if (!text || e - s < 0.05 || HALLUCINATION.test(text) || text === prev) continue;
      prev = text;
      out.push({ text, start: s, end: e });
    }
    return out;
  }

  // Parte cada frase en subtítulos de N palabras y reparte el tiempo según el largo de cada parte.
  function groupSubs(raw) {
    const n = subOpts.words;
    const res = [];
    for (const r of raw) {
      const words = r.text.split(" ").filter(Boolean);
      const groups = [];
      for (let i = 0; i < words.length; i += n) groups.push(words.slice(i, i + n).join(" "));
      const chars = groups.reduce((a, g) => a + g.length + 1, 0);
      let t = r.start;
      for (const g of groups) {
        const d = ((r.end - r.start) * (g.length + 1)) / chars;
        res.push(newText(g, t, t + d, { sub: true, style: subOpts.style, anim: n === 1 ? "pop" : "none", size: n === 1 ? 9 : 6, y: subOpts.y }));
        t += d;
      }
    }
    return res;
  }

  function transcribe(audio, say) {
    subsWorker ||= new Worker("subs-worker.js", { type: "module" });
    return new Promise((resolve, reject) => {
      const files = {};
      subsWorker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "download") {
          files[m.file] = [m.loaded || 0, m.total || 0];
          const vals = Object.values(files);
          const l = vals.reduce((a, v) => a + v[0], 0), t = vals.reduce((a, v) => a + v[1], 0);
          say(`Descargando el modelo de voz (solo la primera vez)… ${Math.round(l / 1e6)} de ${Math.max(1, Math.round(t / 1e6))} MB`);
        } else if (m.type === "transcribing") say("Escuchando y escribiendo… ✍️ (puede tardar un poco)");
        else if (m.type === "done") resolve(m);
        else if (m.type === "error") reject(new Error(m.message));
      };
      subsWorker.onerror = (e) => reject(new Error(e.message || "no se pudo iniciar el reconocimiento de voz"));
      subsWorker.postMessage({ audio, model: subOpts.model, language: subOpts.lang }, [audio.buffer]);
    });
  }

  async function generateSubs(say, go) {
    if (subsBusy) return;
    if (!st.L.length) return toast("Agrega clips primero");
    subsBusy = true;
    go.disabled = true;
    try {
      say("Preparando el audio…");
      const audio = await speechTrack(subOpts.source);
      if (!audio) return say(subOpts.source === "music" ? "Este reel no tiene música." : "Tus clips no tienen voz: agrega un video con audio o elige “Letra de la música”.");
      if (loudness(audio) < 0.004) return say("No se escucha nada en el audio elegido.");
      const res = await transcribe(audio, say);
      const raw = cleanChunks(res.chunks, total());
      if (!raw.length) return say("No encontré palabras en el audio. Prueba con otro idioma o con el modelo Preciso.");
      const subs = groupSubs(raw);
      await mutate((p) => { p.subRaw = raw; p.texts = p.texts.filter((t) => !t.sub).concat(subs); });
      say(`✓ Listo: ${subs.length} subtítulos. Toca uno (CC) en la línea de tiempo para corregir una palabra.`);
      st.t = 0;
      requestDraw();
    } catch (e) {
      console.warn(e);
      subsWorker?.terminate();
      subsWorker = null;
      say("No se pudo: " + e.message + (navigator.onLine ? "" : " · La primera vez necesitas internet para descargar el modelo."));
    } finally {
      subsBusy = false;
      go.disabled = false;
    }
  }

  function regroupSubs() {
    if (!st.p.subRaw?.length) return;
    mutate((p) => { p.texts = p.texts.filter((t) => !t.sub).concat(groupSubs(p.subRaw)); });
  }

  function subsPanel() {
    const hasVoice = st.p.clips.some((c) => c.kind === "video" && !c.muted);
    if (!hasVoice && st.p.music) subOpts.source = "music";
    const count = st.p.texts.filter((t) => t.sub).length;
    const status = el("p", "hint", count ? `Este reel tiene ${count} subtítulos.` : "");
    const go = btn(count ? "✨ Volver a generar" : "✨ Generar subtítulos", () => generateSubs((t) => (status.textContent = t), go), "btn wide primary");
    const set = (k, after) => (v) => { subOpts[k] = v; saveSubOpts(); after?.(v); };
    return showPanel("Subtítulos automáticos",
      el("p", "hint", "Mog escucha el audio y escribe los subtítulos con su tiempo. Todo pasa en tu teléfono: la primera vez descarga el modelo de voz y luego funciona sin internet."),
      go, status,
      label("¿Qué transcribir?"),
      chips([["voice", "🎙 Voz de los videos"], ["music", "♫ Letra de la música"]], subOpts.source, set("source"), true),
      label("Idioma"),
      chips([["spanish", "Español"], ["english", "Inglés"], ["portuguese", "Portugués"], ["", "Detectar"]], subOpts.lang, set("lang"), true),
      label("Estilo"),
      chips([["karaoke", "Karaoke"], ["yellow", "Amarillo"], ["white", "Blanco"], ["box", "Caja"], ["red", "ROJO"]], subOpts.style,
        set("style", (v) => count && mutate((p) => p.texts.forEach((t) => { if (t.sub) t.style = v; }))), true),
      label("Palabras por subtítulo"),
      chips([[1, "1 · rápido estilo TikTok"], [3, "3"], [6, "Frase"]], subOpts.words, set("words", () => count && regroupSubs()), true),
      label("Posición"),
      chips([[0.2, "Arriba"], [0.5, "Centro"], [0.72, "Abajo"]], subOpts.y,
        set("y", (v) => count && mutate((p) => p.texts.forEach((t) => { if (t.sub) t.y = v; })))),
      label("Modelo de voz"),
      chips([["onnx-community/whisper-base", "Preciso · 77 MB"], ["onnx-community/whisper-tiny", "Rápido · 41 MB"]], subOpts.model, set("model"), true),
      count ? btn(`Borrar los ${count} subtítulos`, () => mutate((p) => { p.texts = p.texts.filter((t) => !t.sub); p.subRaw = null; }).then(renderPanel), "btn wide danger") : "");
  }

  /* ---------------- Agregar medios ---------------- */

  let pick = [];

  function renderPickGrid(box, list, onChange) {
    box.innerHTML = "";
    const urls = [];
    for (const p of photos) {
      const b = el("button", list.includes(p.id) ? "on" : "");
      const img = el("img");
      const u = URL.createObjectURL(p.rendered || p.blob);
      urls.push(u);
      img.src = u;
      b.append(img);
      const n = list.indexOf(p.id);
      if (n >= 0) b.append(el("span", "n", String(n + 1)));
      b.addEventListener("click", () => {
        const k = list.indexOf(p.id);
        if (k >= 0) list.splice(k, 1); else list.push(p.id);
        urls.forEach((x) => URL.revokeObjectURL(x));
        renderPickGrid(box, list, onChange);
        onChange?.();
      });
      box.append(b);
    }
    if (!photos.length) box.append(el("p", "hint", "Tu galería está vacía. Sube fotos en la pestaña Galería o usa los botones de arriba."));
  }

  function openAdd() {
    pick = [];
    renderPickGrid($("#stPick"), pick, () => { $("#stAddDone").textContent = pick.length ? `Agregar (${pick.length})` : "Agregar"; });
    $("#stAddDone").textContent = "Agregar";
    openSheet("#stAdd");
  }

  const insertIndex = () => { const i = playheadClipIndex(); return i < 0 ? 0 : st.t >= total() - 0.01 ? st.p.clips.length : i + 1; };

  async function addClips(newClips) {
    if (!newClips.length) return;
    const at = insertIndex();
    await mutate((p) => p.clips.splice(at, 0, ...newClips), { rebuild: true });
    const o = st.L.find((x) => x.c.id === newClips[0].id);
    if (o) st.t = o.start;
    closeSheet($("#stAdd"));
    $("#studio").hidden = false;
    document.body.style.overflow = "hidden";
    renderTimeline();
    requestDraw();
    toast(newClips.length === 1 ? "Clip agregado" : `${newClips.length} clips agregados`);
  }

  $("#stAddDone").addEventListener("click", () => {
    if (!pick.length) return toast("Toca las fotos que quieres agregar");
    addClips(pick.map((id, i) => photoClip(id, { motion: i % 2 ? "out" : "in" })));
  });

  async function importVideo(f) {
    const url = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    try {
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("formato no compatible")); setTimeout(() => rej(new Error("tardó demasiado")), 15000); });
      let d = v.duration;
      if (!isFinite(d)) d = 10;
      v.currentTime = Math.min(0.3, d / 2);
      await new Promise((r) => { v.onseeked = r; setTimeout(r, 2000); });
      const c = document.createElement("canvas");
      c.width = 120;
      c.height = Math.round((v.videoHeight || 213) * (120 / (v.videoWidth || 120)));
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      const m = { id: uid(), name: f.name, blob: f, duration: d, w: v.videoWidth, h: v.videoHeight, thumb: c.toDataURL("image/jpeg", 0.7), created: Date.now() };
      await DB.put("media", m);
      return m;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  $("#stVideoIn").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    $("#stAddInfo").textContent = "Importando video…";
    const out = [];
    for (const f of files) {
      try { out.push(videoClip(await importVideo(f))); }
      catch (err) { toast(`No se pudo abrir ${f.name}: ${err.message}`, 4000); }
    }
    $("#stAddInfo").textContent = "O elige fotos de tu galería de Mog (en el orden en que las toques):";
    addClips(out);
  });

  $("#stPhotoIn").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    const out = [];
    for (const f of files) {
      const id = uid();
      await DB.put("photos", { id, blob: f, rendered: null, text: "", style: "bar", size: 7, sigOn: true, audioId: null, created: Date.now() + Math.random() });
      out.push(photoClip(id, { fit: "cover" }));
    }
    await refreshGallery();
    addClips(out);
  });

  /* ---------------- Abrir / cerrar proyecto ---------------- */

  async function openProject(id) {
    const p = await DB.get("projects", id);
    if (!p) return;
    closeStudio(false);
    st.p = p;
    st.hist = [];
    st.fut = [];
    st.sel = null;
    st.tool = null;
    st.t = 0;
    st.musicKey = null;
    ensureAudio();
    st.actx.resume().catch(() => {});
    $("#stName").textContent = p.name;
    $("#stFmt").textContent = F().name + " · " + F().tip;
    openSheet("#studio");
    fitCanvas();
    relayout();
    renderTimeline();
    renderTools();
    renderPanel();
    if (p.clips.length) toast("Cargando…", 1200);
    for (const c of p.clips) await loadEl(c);
    await ensureMusic();
    await changed(false);
    st.hist = [];
    $("#stUndo").disabled = $("#stRedo").disabled = true;
  }

  function closeStudio(refresh = true) {
    if (!st.p) return;
    pause();
    cancelAnimationFrame(st.drawRaf);
    for (const id of [...st.els.keys()]) dropEl(id);
    const done = saveNow();
    st.urls.forEach((u) => URL.revokeObjectURL(u));
    st.urls = [];
    st.p = null;
    st.L = [];
    if (refresh) done.then(refreshProjects);
  }
  $("#stClose").addEventListener("click", () => closeStudio());

  $("#stRename").addEventListener("click", () => {
    const name = prompt("Nombre del reel", st.p.name);
    if (!name?.trim()) return;
    mutate((p) => { p.name = name.trim().slice(0, 60); });
    $("#stName").textContent = st.p.name;
  });

  /* ---------------- Lista de proyectos ---------------- */

  async function refreshProjects() {
    const list = (await DB.all("projects")).sort((a, b) => b.updated - a.updated);
    const box = $("#projects");
    box.innerHTML = "";
    for (const p of list) {
      const card = el("div", "proj");
      const th = el("button", "proj-thumb");
      if (p.thumb) { const img = el("img"); img.src = p.thumb; img.alt = ""; th.append(img); }
      th.append(el("span", "badge", (FORMATS[p.format] || FORMATS.tiktok).name), el("span", "dur", fmtTime(p.duration || 0)));
      th.addEventListener("click", () => openProject(p.id));
      const info = el("div", "proj-info");
      info.append(el("div", "proj-name", p.name), el("div", "proj-sub", `${p.clips.length} clips · ${new Date(p.updated).toLocaleDateString("es")}`));
      const acts = el("div", "proj-actions");
      acts.append(
        btn("✎", async () => {
          const name = prompt("Nombre del reel", p.name);
          if (!name?.trim()) return;
          p.name = name.trim().slice(0, 60);
          await DB.put("projects", p);
          refreshProjects();
        }, ""),
        btn("⧉", async () => {
          await DB.put("projects", { ...structuredClone(p), id: uid(), name: p.name + " (copia)", updated: Date.now() });
          refreshProjects();
          toast("Reel duplicado");
        }, ""),
        btn("🗑", async () => {
          if (!confirm(`¿Borrar "${p.name}"?`)) return;
          await DB.del("projects", p.id);
          // borra los videos importados que ya no use ningún otro reel
          const rest = await DB.all("projects");
          const used = new Set(rest.flatMap((x) => x.clips.filter((c) => c.kind === "video").map((c) => c.src)));
          for (const c of p.clips) if (c.kind === "video" && !used.has(c.src)) await DB.del("media", c.src);
          refreshProjects();
        }, ""));
      acts.lastChild.title = "Borrar";
      card.append(th, info, acts);
      box.append(card);
    }
    $("#projectsEmpty").hidden = list.length > 0;
  }

  $('[data-view="reels"]').addEventListener("click", refreshProjects);

  /* ---------------- Nuevo reel y reel automático ---------------- */

  let fmtMode = "new";
  let autoFmt = "tiktok";
  let autoSel = [];

  function renderFormats() {
    const g = $("#fmtGrid");
    g.innerHTML = "";
    for (const [k, f] of Object.entries(FORMATS)) {
      const b = el("button", fmtMode === "auto" && k === autoFmt ? "on" : "");
      const shape = el("div", "fmt-shape");
      const i = el("i");
      i.style.aspectRatio = `${f.w} / ${f.h}`;
      shape.append(i);
      b.append(shape, el("b", "", f.name), el("small", "", f.tip));
      b.addEventListener("click", async () => {
        if (fmtMode === "auto") { autoFmt = k; return renderFormats(); }
        const p = newProject(k);
        await DB.put("projects", p);
        closeSheet($("#fmtSheet"));
        await openProject(p.id);
        openAdd();
      });
      g.append(b);
    }
  }

  $("#newReel").addEventListener("click", () => {
    fmtMode = "new";
    $("#fmtTitle").textContent = "¿Para dónde es tu reel?";
    $("#autoOpts").hidden = true;
    renderFormats();
    openSheet("#fmtSheet");
  });

  $("#autoReel").addEventListener("click", () => {
    if (!photos.length) return toast("Primero sube fotos en la pestaña Galería", 3000);
    fmtMode = "auto";
    autoSel = [];
    $("#fmtTitle").textContent = "Reel automático";
    $("#autoOpts").hidden = false;
    renderFormats();
    renderPickGrid($("#autoPick"), autoSel);
    const sel = $("#autoAudio");
    sel.innerHTML = "";
    sel.append(new Option("Sin música", ""));
    for (const a of audios) sel.append(new Option("♫ " + a.name, a.id));
    if (audios[0]) sel.value = audios[0].id;
    $("#autoHook").value = "";
    const hk = $("#autoHooks");
    hk.innerHTML = "";
    for (const h of HOOKS.slice(0, 5)) hk.append(btn(h, () => ($("#autoHook").value = h), ""));
    openSheet("#fmtSheet");
  });

  $("#autoGo").addEventListener("click", async () => {
    if (!autoSel.length) return toast("Toca las fotos que quieres en el reel");
    const audioId = $("#autoAudio").value || null;
    let dur = 2.5;
    if (audioId) {
      ensureAudio();
      try {
        const buf = await decodeAudioRecord(await DB.get("audios", audioId), st.actx);
        dur = clamp(buf.duration / autoSel.length, 1.2, 6);
      } catch {}
    }
    const cycle = ["fade", "slide", "zoom", "flash", "blur", "spin"];
    const p = newProject(autoFmt);
    p.name = "Reel automático";
    p.clips = autoSel.map((id, i) => photoClip(id, { dur, motion: i % 2 ? "out" : "in", trans: i ? cycle[(i - 1) % cycle.length] : "none" }));
    const T = dur * autoSel.length;
    const hook = $("#autoHook").value.trim();
    if (hook) p.texts.push(newText(hook, 0, Math.min(2.8, T), { style: "box", anim: "pop", y: 0.14 }));
    if (T > 5) p.texts.push(newText(CTAS[0], T - 2.2, T, { style: "box", anim: "slide", y: 0.86 }));
    if (audioId) p.music = { audioId, offset: 0, volume: 0.9, fadeIn: true, fadeOut: true };
    await DB.put("projects", p);
    closeSheet($("#fmtSheet"));
    await openProject(p.id);
    toast("¡Listo! Dale ▶ para verlo", 2500);
  });

  /* ---------------- Exportar ---------------- */

  let quality = "1080";
  let coverT = 0;
  let pubPlat = "tiktok";
  const out = { blob: null, url: null };

  function openPublish() {
    if (!st.L.length) return toast("Agrega fotos o videos primero");
    coverT = st.t;
    pause();
    pubPlat = ["tiktok", "reels", "shorts", "fb"].includes(st.p.format) ? st.p.format : "reels";
    $("#pubSetup").hidden = false;
    $("#pubProgress").hidden = $("#pubResult").hidden = true;
    const q = $("#pubQuality");
    q.innerHTML = "";
    q.append(chips([["720", "720p · más rápido y liviano"], ["1080", "1080p · mejor calidad"]], quality, (v) => { quality = v; }, true));
    const T = total();
    $("#pubEst").textContent = `Duración: ${fmtTime(T)}. El video se crea en tiempo real (tarda ${Math.ceil(T)} s). Mantén la pantalla encendida y Mog abierta.`;
    const pl = $("#pubPlats");
    pl.innerHTML = "";
    pl.append(chips([["tiktok", "TikTok"], ["reels", "Instagram"], ["shorts", "YouTube Shorts"], ["fb", "Facebook"]], pubPlat, (v) => { pubPlat = v; }, true));
    if (!$("#pubTopic").value) $("#pubTopic").value = guessTopic();
    renderChecklist();
    openSheet("#publish");
  }
  $("#stExport").addEventListener("click", openPublish);

  async function waitSeeks() {
    const vids = [...st.els.values()].filter((e) => e.kind === "video" && e.el.seeking);
    await Promise.all(vids.map((e) => new Promise((r) => { e.el.addEventListener("seeked", r, { once: true }); setTimeout(r, 1500); })));
  }

  async function startExport() {
    const mime = videoMime();
    if (!mime) return toast("Este teléfono no puede crear videos", 3500);
    const f = F();
    const q = quality === "720" ? 720 / Math.min(f.w, f.h) : 1;
    const W = even(f.w * q), H = even(f.h * q);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    ensureAudio();
    await st.actx.resume();
    const dest = st.actx.createMediaStreamDestination();
    st.master.connect(dest);
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: q === 1 ? 8_000_000 : 5_000_000, audioBitsPerSecond: 160_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    $("#pubSetup").hidden = $("#pubResult").hidden = true;
    $("#pubProgress").hidden = false;
    $("#pubBar").style.width = "0";

    st.t = 0;
    syncVideos(0);
    await waitSeeks();
    drawFrame(g, 0, W, H);
    const T = total();
    st.exp = {
      g, W, H, rec, dest, chunks, mime, cancelled: false,
      progress: (r) => {
        $("#pubBar").style.width = Math.min(100, r * 100) + "%";
        $("#pubInfo").textContent = `${fmtTime(r * T)} de ${fmtTime(T)} · no bloquees la pantalla`;
      },
    };
    rec.start(250);
    play();
  }

  function finishExport() {
    const ex = st.exp;
    if (!ex) return;
    drawFrame(ex.g, total(), ex.W, ex.H);
    st.exp = null;
    st.playing = false;
    cancelAnimationFrame(st.raf);
    stopMusic();
    for (const e of st.els.values()) if (e.kind === "video") e.el.pause();
    $("#stPlay").textContent = "▶";
    ex.rec.onstop = () => {
      try { st.master.disconnect(ex.dest); } catch {}
      if (ex.cancelled) { $("#pubProgress").hidden = true; $("#pubSetup").hidden = false; return; }
      const type = ex.mime.split(";")[0];
      if (out.url) URL.revokeObjectURL(out.url);
      out.blob = new Blob(ex.chunks, { type });
      out.url = URL.createObjectURL(out.blob);
      $("#pubVideo").src = out.url;
      $("#pubMeta").textContent = `${fmtTime(total())} · ${(out.blob.size / 1048576).toFixed(1)} MB · ${type === "video/mp4" ? "MP4" : "WEBM"} ${ex.W}×${ex.H}`;
      $("#pubProgress").hidden = true;
      $("#pubResult").hidden = false;
    };
    setTimeout(() => ex.rec.state === "recording" ? ex.rec.stop() : ex.rec.onstop(), 300);
  }

  function cancelExport() {
    if (!st.exp) return;
    st.exp.cancelled = true;
    finishExport();
  }

  $("#pubGo").addEventListener("click", startExport);
  $("#pubCancel").addEventListener("click", cancelExport);
  $("#pubClose").addEventListener("click", () => { cancelExport(); $("#pubVideo").pause(); $("#studio").hidden = false; document.body.style.overflow = "hidden"; requestDraw(); });

  const ext = () => (out.blob.type === "video/mp4" ? "mp4" : "webm");
  const safeName = () => (st.p?.name || "reel").toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, "-").replace(/^-|-$/g, "") || "reel";

  async function saveOrShare(blob, filename, share) {
    if (NATIVE) return share ? nativeShare(blob, filename) : nativeSave(blob, filename);
    if (share) {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch {} return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  $("#pubDownload").addEventListener("click", () => saveOrShare(out.blob, `${safeName()}.${ext()}`, false));
  $("#pubShare").addEventListener("click", () => saveOrShare(out.blob, `${safeName()}.${ext()}`, true));

  $("#pubCover").addEventListener("click", async () => {
    const f = F();
    const c = document.createElement("canvas");
    c.width = f.w;
    c.height = f.h;
    const t = clamp(coverT || Math.min(1, total() / 2), 0, Math.max(0, total() - 0.05));
    syncVideos(t);
    await waitSeeks();
    drawFrame(c.getContext("2d"), t, f.w, f.h);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
    saveOrShare(blob, `${safeName()}-portada.jpg`, false);
    toast("La portada es el cuadro donde estaba el cabezal blanco");
  });

  /* ---------------- Descripción, hashtags y checklist ---------------- */

  function guessTopic() {
    const words = st.p.texts.map((t) => t.text).join(" ");
    for (const [re] of TOPIC_TAGS) { const m = words.match(re); if (m) return m[0].toLowerCase(); }
    return "";
  }

  function hashtagsFor(topic, plat) {
    const tags = new Set(PLAT_TAGS[plat] || []);
    const hay = topic + " " + st.p.texts.map((t) => t.text).join(" ");
    for (const [re, list] of TOPIC_TAGS) if (re.test(hay)) list.forEach((t) => tags.add(t));
    const slug = topic.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
    if (slug) tags.add("#" + slug);
    return [...tags].slice(0, 8).join(" ");
  }

  function localCaption(plat, topic) {
    const texts = [...st.p.texts].sort((a, b) => a.start - b.start).map((t) => t.text.trim()).filter(Boolean);
    const hook = texts[0] || (topic ? `Esto es para ti si te importa ${topic} ✨` : "Guarda esto para después ✨");
    const body = texts.slice(1, 3).filter((t) => !CTAS.includes(t)).join(" · ");
    const cta = {
      tiktok: "Sígueme para más y comenta qué te pareció 👇",
      reels: "Guárdalo 📌 y compártelo con quien lo necesita",
      shorts: "Suscríbete para más videos así 🔔",
      fb: "Compártelo con alguien que lo necesite 💬",
    }[plat];
    return [hook, body, cta, "", hashtagsFor(topic, plat)].filter((x, i) => x || i === 3).join("\n");
  }

  async function claudeCaption(plat, topic) {
    const names = { tiktok: "TikTok", reels: "Instagram Reels", shorts: "YouTube Shorts", fb: "Facebook Reels" };
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2026-10-21",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-opus-5-5",
        max_tokens: 2000,
        output_config: { effort: "low" },
        fallbacks: "default",
        system:
          "Eres experto en contenido corto para redes sociales en español latino. Escribe la descripción de un video corto: " +
          "una primera línea gancho, una o dos líneas que aporten valor, un llamado a la acción natural para la plataforma, " +
          "y al final de 5 a 8 hashtags relevantes (mezcla de populares y de nicho). Máximo 300 caracteres sin contar hashtags. " +
          "Responde solo con la descripción, sin comillas ni explicaciones.",
        messages: [{
          role: "user",
          content: `Plataforma: ${names[plat]}\nTema: ${topic || "(sin tema)"}\nTextos que aparecen en el video: ${st.p.texts.map((t) => t.text).join(" | ") || "(ninguno)"}`,
        }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Error ${res.status}`);
    }
    const data = await res.json();
    if (data.stop_reason === "refusal") throw new Error("la IA no quiso responder");
    return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  }

  $("#pubGen").addEventListener("click", async () => {
    const topic = $("#pubTopic").value.trim();
    const b = $("#pubGen");
    b.disabled = true;
    b.textContent = "Escribiendo…";
    try {
      $("#pubCaption").value = settings.apiKey ? await claudeCaption(pubPlat, topic) : localCaption(pubPlat, topic);
    } catch (e) {
      toast("IA: " + e.message + " — uso la plantilla de Mog", 3500);
      $("#pubCaption").value = localCaption(pubPlat, topic);
    } finally {
      b.disabled = false;
      b.textContent = "✨ Generar descripción";
    }
  });

  $("#pubCopy").addEventListener("click", async () => {
    const t = $("#pubCaption").value;
    if (!t) return toast("Primero genera o escribe una descripción");
    try { await navigator.clipboard.writeText(t); toast("Descripción copiada ✓"); }
    catch { $("#pubCaption").select(); document.execCommand("copy"); toast("Descripción copiada ✓"); }
  });

  function renderChecklist() {
    const T = total();
    const hasHook = st.p.texts.some((t) => t.start < 1);
    const items = [
      ["Contenido original o con permiso", "No reutilices videos ajenos ni con marcas de agua de otras apps: las plataformas los marcan como no originales y no los monetizan."],
      ["Música sin problemas de derechos", "Usa audio propio o libre, o agrega el sonido desde la biblioteca de la app al publicar."],
      ["Gancho en los primeros 2 segundos" + (hasHook ? " ✓" : ""), hasHook ? "Tu reel ya tiene texto al inicio." : "Agrega uno con 🪝 Ganchos."],
      ["Subtítulos" + (st.p.texts.some((t) => t.sub) ? " ✓" : ""), st.p.texts.some((t) => t.sub) ? "Tu reel tiene subtítulos: también lo entienden quienes lo ven sin sonido." : "Mucha gente ve los reels sin sonido. Agrégalos con CC Subtítulos."],
      ["Textos dentro de la zona segura", "Revísalo con ◰ Zona segura para que los botones de la app no los tapen."],
      ["Llamado a la acción al final", "Pide que te sigan, guarden o comenten."],
      [`Duración: ${fmtTime(T)}`, T < 7 ? "Muy corto: suele funcionar mejor de 7 a 60 s." : T > 90 ? "Largo para un reel: asegúrate de que cada segundo aporte." : "Buena duración para reels."],
      ["Publica con constancia", "Varias veces por semana, a la hora en que tu audiencia está activa (lo ves en las estadísticas de la app)."],
    ];
    const ul = $("#pubCheck");
    ul.innerHTML = "";
    for (const [t, d] of items) {
      const li = el("li");
      const lab = el("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      const txt = el("span", "", t);
      txt.append(el("small", "", d));
      lab.append(cb, txt);
      li.append(lab);
      ul.append(li);
    }
  }

  /* ---------------- Inicio ---------------- */

  refreshProjects();
})();
