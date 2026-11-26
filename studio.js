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
    actx: null, master: null, bufs: new Map(), voices: [], impulse: null, justDragged: false, rec: null, hits: [], magnet: store.get("magnet", false),
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
  const total = () => (st.p ? st.p.clips.reduce((a, c) => a + (c.gap || 0) + clipDur(c), 0) : 0);
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
    st.L = st.p.clips.map((c, i) => { t += c.gap || 0; const d = clipDur(c); const o = { c, i, start: t, end: t + d, d }; t += d; return o; });
  }
  function activeIndex(t) {
    const L = st.L;
    for (let i = 0; i < L.length; i++) if (t < L[i].end) return i;
    return L.length - 1;
  }

  const newProject = (format) => ({
    id: uid(), name: "Reel " + new Date().toLocaleDateString("es", { day: "numeric", month: "short" }),
    format, clips: [], texts: [], audios: [], overlays: [], created: Date.now(), updated: Date.now(), duration: 0, thumb: null,
  });
  const photoClip = (photoId, o = {}) => ({ id: uid(), kind: "photo", src: photoId, dur: 3, filter: "none", motion: "in", fit: "contain", trans: "none", ...o });
  const videoClip = (m) => ({
    id: uid(), kind: "video", src: m.id, srcDur: m.duration, trimStart: 0, trimEnd: m.duration,
    speed: 1, volume: 1, muted: false, filter: "none", motion: "none", fit: "cover", trans: "none",
  });
  const newText = (text, start, end, o = {}) => ({ id: uid(), text, start, end, style: "box", anim: "pop", size: 6.5, y: 0.2, ...o });

  /* ---------------- Audio: varias pistas ---------------- */

  const FX = [
    ["none", "Normal"], ["echo", "Eco"], ["reverb", "Sala"], ["phone", "Teléfono"], ["radio", "Radio"],
    ["bass", "Bajos +"], ["bright", "Brillo"], ["lofi", "Lo-fi"], ["under", "Bajo el agua"],
  ];
  const EQ_PRESETS = [["0,0,0", "Plano"], ["-2,3,4", "Voz clara"], ["7,0,-1", "Más bajo"], ["-3,1,6", "Brillante"], ["4,-3,2", "Fiesta"]];
  const newAudioBlock = (src, ref, start, dur, o = {}) => ({
    id: uid(), src, ref, start, offset: 0, dur, volume: 1, fadeIn: 0, fadeOut: 0, loop: false, fx: "none", eq: [0, 0, 0], ...o,
  });
  const bufKey = (a) => a.src + ":" + a.ref;

  function ensureAudio() {
    if (st.actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    st.actx = new AC();
    st.master = st.actx.createGain();
    st.master.connect(st.actx.destination);
  }

  // Los reels guardados antes tenían una sola "música": se convierte en una pista de audio.
  function migrateProject(p) {
    p.audios ||= [];
    p.overlays ||= [];
    if (p.music) {
      const m = p.music;
      const T = p.clips.reduce((a, c) => a + clipDur(c), 0);
      p.audios.push(newAudioBlock("audio", m.audioId, 0, Math.max(1, T), {
        offset: m.offset || 0, volume: m.volume ?? 0.9, fadeIn: m.fadeIn ? 1.5 : 0, fadeOut: m.fadeOut ? 1.5 : 0, loop: true,
      }));
      delete p.music;
    }
    return p;
  }

  async function loadBuf(a) {
    const k = bufKey(a);
    if (st.bufs.has(k)) return st.bufs.get(k);
    let entry = null;
    try {
      if (a.src === "audio") {
        const rec = await DB.get("audios", a.ref);
        if (rec) entry = { buf: await decodeAudioRecord(rec, st.actx), name: rec.name };
      } else {
        const m = await DB.get("media", a.ref);
        if (m) entry = { buf: await st.actx.decodeAudioData(await m.blob.arrayBuffer()), name: "Audio de " + (m.name || "video").replace(/\.[^.]+$/, "") };
      }
    } catch (e) { console.warn(e); }
    if (entry) entry.peaks = computePeaks(entry.buf);
    st.bufs.set(k, entry);
    return entry;
  }
  async function ensureBufs() {
    for (const a of st.p.audios) await loadBuf(a);
    for (const o of st.p.overlays || []) if (o.sound) await loadBuf({ src: "audio", ref: o.sound.audioId });
  }
  const bufOf = (a) => st.bufs.get(bufKey(a));
  const srcDur = (a) => bufOf(a)?.buf.duration || a.offset + a.dur;

  // Forma de onda: el pico de volumen cada 20 ms, normalizado.
  function computePeaks(buf) {
    const perSec = 50;
    const n = Math.max(1, Math.ceil(buf.duration * perSec));
    const ch = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / n));
    const data = new Float32Array(n);
    let max = 1e-4;
    for (let i = 0; i < n; i++) {
      let m = 0;
      const end = Math.min(ch.length, (i + 1) * step);
      for (let j = i * step; j < end; j += 4) { const v = Math.abs(ch[j]); if (v > m) m = v; }
      data[i] = m;
      if (m > max) max = m;
    }
    for (let i = 0; i < n; i++) data[i] /= max;
    return { data, perSec };
  }

  // Ritmo: energía en ventanas de 10 ms, autocorrelación para el tempo (60–200 BPM) y fase con más golpes.
  function detectBeats(entry) {
    if (entry.beats) return entry.beats;
    const buf = entry.buf;
    const sr = buf.sampleRate;
    const ch = buf.getChannelData(0);
    const hop = Math.round(sr * 0.01);
    const env = [];
    for (let i = 0; i + hop <= ch.length; i += hop) {
      let s = 0;
      for (let j = i; j < i + hop; j += 2) s += ch[j] * ch[j];
      env.push(Math.log(1e-4 + Math.sqrt(s / (hop / 2))));
    }
    const on = new Float32Array(env.length);
    for (let i = 1; i < env.length; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
    let lag = 50, bestV = -1;
    for (let L = 30; L <= 100; L++) {
      let v = 0;
      for (let i = L; i < on.length; i++) v += on[i] * on[i - L];
      v *= 1 + 0.15 * Math.exp(-Math.pow((L - 50) / 20, 2)); // preferencia suave por ~120 BPM
      if (v > bestV) { bestV = v; lag = L; }
    }
    let phase = 0, bp = -1;
    for (let ph = 0; ph < lag; ph++) {
      let v = 0;
      for (let i = ph; i < on.length; i += lag) v += on[i];
      if (v > bp) { bp = v; phase = ph; }
    }
    const period = lag * 0.01;
    const times = [];
    for (let t = phase * 0.01; t < buf.duration; t += period) times.push(t);
    entry.beats = { bpm: Math.round(60 / period), period, times };
    return entry.beats;
  }

  const waveCache = new Map();
  function waveURL(a, widthPx, selected) {
    const e = bufOf(a);
    if (!e) return "";
    const w = Math.max(20, Math.min(2400, Math.round(widthPx)));
    const key = [bufKey(a), a.offset.toFixed(2), a.dur.toFixed(2), a.loop, w, !!e.beats, selected].join("|");
    if (waveCache.has(key)) return waveCache.get(key);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = 40;
    const g = c.getContext("2d");
    const { data, perSec } = e.peaks;
    const SD = e.buf.duration;
    g.fillStyle = selected ? "#d9fff0" : "#7fe3bd";
    for (let x = 0; x < w; x += 2) {
      let t = a.offset + (x / w) * a.dur;
      if (a.loop && t >= SD) t = a.offset + ((t - a.offset) % Math.max(0.05, SD - a.offset));
      const v = t < SD ? data[Math.min(data.length - 1, Math.floor(t * perSec))] : 0;
      const h = Math.max(1, v * 34);
      g.fillRect(x, 20 - h / 2, 1.4, h);
    }
    if (e.beats) {
      g.fillStyle = "#ffd60a";
      for (const b of e.beats.times) {
        if (b < a.offset || b > a.offset + a.dur) continue;
        g.fillRect(((b - a.offset) / a.dur) * w - 1, 0, 2, 6);
      }
    }
    const url = c.toDataURL();
    if (waveCache.size > 200) waveCache.clear();
    waveCache.set(key, url);
    return url;
  }

  function impulseFor(ctx) {
    if (st.impulse?.sampleRate === ctx.sampleRate) return st.impulse;
    const len = Math.round(ctx.sampleRate * 1.8);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    st.impulse = b;
    return b;
  }

  // Ecualizador (graves / medios / agudos) + efecto, de input a output.
  function fxChain(ctx, a, input, output) {
    let node = input;
    const filt = (type, freq, gain = 0, Q = 0.8) => {
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.gain.value = gain; f.Q.value = Q;
      node.connect(f);
      node = f;
      return f;
    };
    const [lo, mid, hi] = a.eq || [0, 0, 0];
    if (lo) filt("lowshelf", 200, lo);
    if (mid) filt("peaking", 1200, mid, 0.9);
    if (hi) filt("highshelf", 4000, hi);
    switch (a.fx) {
      case "echo": {
        const d = ctx.createDelay(1);
        d.delayTime.value = 0.28;
        const fb = ctx.createGain(); fb.gain.value = 0.38;
        const wet = ctx.createGain(); wet.gain.value = 0.5;
        node.connect(output);
        node.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(output);
        return;
      }
      case "reverb": {
        const cv = ctx.createConvolver();
        cv.buffer = impulseFor(ctx);
        const wet = ctx.createGain(); wet.gain.value = 0.5;
        node.connect(output);
        node.connect(cv); cv.connect(wet); wet.connect(output);
        return;
      }
      case "phone": filt("highpass", 500, 0, 0.7); filt("lowpass", 3000, 0, 0.7); filt("peaking", 1500, 6, 1); break;
      case "radio": {
        filt("highpass", 300); filt("lowpass", 4500);
        const ws = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(2.2 * x); }
        ws.curve = curve;
        node.connect(ws); node = ws;
        break;
      }
      case "bass": filt("lowshelf", 150, 10); break;
      case "bright": filt("highshelf", 3500, 8); break;
      case "lofi": filt("lowpass", 2800, 0, 0.5); filt("highpass", 120); filt("peaking", 900, 3, 0.7); break;
      case "under": filt("lowpass", 450, 0, 1.2); break;
    }
    node.connect(output);
  }

  function startAudios(t) {
    stopAudios();
    const T = total();
    const now = st.actx.currentTime + 0.02;
    // sonido de los stickers: suena cuando el sticker aparece
    for (const o of st.p.overlays) {
      if (!o.sound || o.start < t - 0.05 || o.start >= T) continue;
      const e = st.bufs.get("audio:" + o.sound.audioId);
      if (!e) continue;
      const src = st.actx.createBufferSource();
      src.buffer = e.buf;
      const g = st.actx.createGain();
      g.gain.value = o.sound.volume ?? 1;
      src.connect(g).connect(st.master);
      const when = now + Math.max(0, o.start - t);
      src.start(when);
      src.stop(when + Math.min(e.buf.duration, Math.max(0.05, T - o.start)));
      st.voices.push(src);
    }
    for (const a of st.p.audios) {
      const e = bufOf(a);
      if (!e) continue;
      const end = Math.min(a.start + a.dur, T);
      if (end <= t) continue;
      const from = Math.max(t, a.start);
      const when = now + (from - t);
      const into = from - a.start;
      const SD = e.buf.duration;
      const src = st.actx.createBufferSource();
      src.buffer = e.buf;
      let offset = a.offset + into;
      if (a.loop) {
        src.loop = true;
        src.loopStart = a.offset;
        src.loopEnd = SD;
        offset = a.offset + (into % Math.max(0.05, SD - a.offset));
      } else if (offset >= SD) continue;
      const g = st.actx.createGain();
      const fi = Math.min(a.fadeIn, a.dur / 2), fo = Math.min(a.fadeOut, a.dur / 2);
      const volAt = (x) => Math.max(0, a.volume * Math.min(1, fi ? x / fi : 1, fo ? (a.dur - x) / fo : 1));
      g.gain.setValueAtTime(volAt(into), when);
      if (fi && into < fi) g.gain.linearRampToValueAtTime(volAt(fi), when + (fi - into));
      if (fo) {
        const s = Math.max(into, a.dur - fo, fi);
        if (s > into) g.gain.setValueAtTime(volAt(s), when + (s - into));
        g.gain.linearRampToValueAtTime(0, when + (a.dur - into));
      }
      src.connect(g);
      fxChain(st.actx, a, g, st.master);
      src.start(when, offset);
      src.stop(when + (end - from));
      st.voices.push(src);
    }
  }
  function stopAudios() {
    for (const s of st.voices) { try { s.stop(); } catch {} }
    st.voices = [];
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
    const ids = new Set([...st.p.clips.map((c) => c.id), ...st.p.overlays.map((o) => o.id)]);
    for (const id of [...st.els.keys()]) if (!ids.has(id)) dropEl(id);
  }

  function syncVideos(t) {
    const ai = activeIndex(t);
    st.L.forEach((o, i) => {
      const e = st.els.get(o.c.id);
      if (!e || e.kind !== "video") return;
      const v = e.el, c = o.c;
      if (i === ai && t < o.start) { // espacio antes del clip: esperar en su primer cuadro
        if (e.gain) e.gain.gain.value = 0;
        if (!v.paused) v.pause();
        if (!v.seeking && Math.abs(v.currentTime - c.trimStart) > 0.05) v.currentTime = c.trimStart;
      } else if (i === ai) {
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
    syncOverlays(t);
  }

  /* ---------------- Dibujo ---------------- */

  function srcSize(e) {
    return e.kind === "photo" ? [e.el.naturalWidth, e.el.naturalHeight] : [e.el.videoWidth, e.el.videoHeight];
  }

  // Cuadro de origen con giro (90°), espejo y recorte (encuadre) aplicados.
  function frameSource(e, c) {
    const [w0, h0] = srcSize(e);
    if (!w0 || !h0) return null;
    let img = e.el, FW = w0, FH = h0;
    const r = (((c.rot90 || 0) % 360) + 360) % 360;
    if (r || c.flip) {
      const k = Math.min(1, 1280 / Math.max(w0, h0));
      const rw = Math.round((r % 180 ? h0 : w0) * k), rh = Math.round((r % 180 ? w0 : h0) * k);
      const key = `${r}|${!!c.flip}|${rw}x${rh}`;
      e.rc ||= document.createElement("canvas");
      if (e.kind === "video" || e.rcKey !== key) {
        if (e.rc.width !== rw || e.rc.height !== rh) { e.rc.width = rw; e.rc.height = rh; }
        const g = e.rc.getContext("2d");
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, rw, rh);
        g.translate(rw / 2, rh / 2);
        if (c.flip) g.scale(-1, 1);
        g.rotate((r * Math.PI) / 180);
        g.drawImage(e.el, (-w0 * k) / 2, (-h0 * k) / 2, w0 * k, h0 * k);
        e.rcKey = key;
      }
      img = e.rc; FW = rw; FH = rh;
    }
    const cr = c.crop || { x: 0, y: 0, w: 1, h: 1 };
    return { img, sx: cr.x * FW, sy: cr.y * FH, sw: Math.max(1, cr.w * FW), sh: Math.max(1, cr.h * FH), FW, FH };
  }

  function drawClip(g, o, lt, W, H, fx = {}) {
    const e = st.els.get(o.c.id);
    if (!e) return;
    const c = o.c;
    const fsrc = frameSource(e, c);
    if (!fsrc) return;
    const { img, sx, sy, sw, sh } = fsrc;
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
      tctx.drawImage(img, sx + (sw - cw) / 2, sy + (sh - ch) / 2, cw, ch, 0, 0, tiny.width, tiny.height);
      g.filter = filter || "none";
      g.drawImage(tiny, 0, 0, W, H);
      g.filter = "none";
      g.fillStyle = "rgba(0,0,0,.42)";
      g.fillRect(0, 0, W, H);
    }
    const k = (c.fit === "contain" ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh)) * z;
    const dw = sw * k, dh = sh * k;
    g.filter = filter || "none";
    g.drawImage(img, sx, sy, sw, sh, (W - dw) / 2 + px * W, (H - dh) / 2, dw, dh);
    g.restore();
  }

  function drawText(g, tx, lt, W, H, ui = false) {
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
    if (ui) {
      const bh = lines.length * lh + fs * 0.5;
      st.hits.push({ tx, x: W / 2, y: cy, w: W * 0.9, h: bh, rot: 0 });
      if (isSel("text", tx.id)) {
        g.save();
        g.setLineDash([W * 0.015, W * 0.01]);
        g.lineWidth = W * 0.004;
        g.strokeStyle = "#fff";
        g.strokeRect(W * 0.04, cy - bh / 2, W * 0.92, bh);
        g.restore();
      }
    }
  }

  /* ---------------- Efectos de sonido creados por Mog (sin derechos de autor) ---------------- */

  const SFX = [["boom", "💥 Boom"], ["whoosh", "💨 Whoosh"], ["ding", "🔔 Ding"], ["pop", "🫧 Pop"]];

  async function synthSfx(kind) {
    const sr = 44100;
    const dur = { boom: 1.6, whoosh: 0.8, ding: 1.4, pop: 0.25 }[kind];
    const ctx = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
    const out = ctx.createGain();
    out.connect(ctx.destination);
    const noise = () => {
      const b = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource();
      s.buffer = b;
      return s;
    };
    if (kind === "boom") {
      // golpe grave con caída de tono, un poco saturado
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(110, 0);
      o.frequency.exponentialRampToValueAtTime(38, 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1, 0);
      g.gain.exponentialRampToValueAtTime(0.001, dur);
      const ws = ctx.createWaveShaper();
      const curve = new Float32Array(512);
      for (let i = 0; i < 512; i++) { const x = i / 256 - 1; curve[i] = Math.tanh(3 * x); }
      ws.curve = curve;
      o.connect(g).connect(ws).connect(out);
      o.start(0);
      const n = noise();
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5, 0);
      ng.gain.exponentialRampToValueAtTime(0.001, 0.08);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 1800;
      n.connect(lp).connect(ng).connect(out);
      n.start(0);
    } else if (kind === "whoosh") {
      const n = noise();
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, 0);
      bp.frequency.exponentialRampToValueAtTime(4000, dur * 0.7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, 0);
      g.gain.exponentialRampToValueAtTime(0.9, dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.001, dur);
      n.connect(bp).connect(g).connect(out);
      n.start(0);
    } else if (kind === "ding") {
      for (const [f, v] of [[1318.5, 0.5], [2637, 0.2], [3955, 0.08]]) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(v, 0);
        g.gain.exponentialRampToValueAtTime(0.0005, dur);
        o.connect(g).connect(out);
        o.start(0);
      }
    } else {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(700, 0);
      o.frequency.exponentialRampToValueAtTime(180, dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.8, 0);
      g.gain.exponentialRampToValueAtTime(0.001, dur);
      o.connect(g).connect(out);
      o.start(0);
    }
    const buf = await ctx.startRendering();
    return encodeWav([buf.getChannelData(0)], sr, false);
  }

  // Devuelve el id del efecto guardado en la pestaña Audio (lo crea la primera vez).
  async function sfxAudioId(kind) {
    const name = "Efecto: " + SFX.find((x) => x[0] === kind)[1].replace(/^\S+\s/, "");
    const existing = audios.find((a) => a.name === name);
    if (existing) return existing.id;
    const id = uid();
    await DB.put("audios", { id, name, blob: await synthSfx(kind), created: Date.now() });
    await refreshAudios();
    return id;
  }

  /* ---------------- Mis stickers (guardados para reusar) ---------------- */

  const STK_KEYS = ["emoji", "badge", "color", "bar", "barStyle", "txt", "tstyle", "scale", "rot", "anim", "opacity", "sound", "y", "x"];
  const myStickers = () => store.get("myStickers", []);
  function saveMySticker(o) {
    const data = {};
    for (const k of STK_KEYS) if (o[k] !== undefined) data[k] = structuredClone(o[k]);
    data.len = +(o.end - o.start).toFixed(2);
    const label = (o.emoji || o.badge || o.bar || o.txt || "Sticker").slice(0, 18) + (o.sound ? " 🔊" : "");
    store.set("myStickers", [{ id: uid(), label, data }, ...myStickers()].slice(0, 30));
    toast("Guardado en Mis stickers ✓");
  }

  // Texto libre dentro de un sticker (se mueve, gira y escala como cualquier sticker)
  function drawStickerText(g, o, W) {
    const fs = W * 0.07;
    g.font = `800 ${fs}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const style = o.tstyle || "box";
    const text = style === "red" ? o.txt.toUpperCase() : o.txt;
    const lines = wrapText(g, text, W * 0.8);
    const lh = fs * 1.22;
    const w = Math.max(...lines.map((l) => g.measureText(l).width)) + fs * 0.8;
    const h = lines.length * lh + fs * 0.3;
    const top = -h / 2 + fs * 0.15;
    if (style === "bar") { g.fillStyle = "#f3f8f1"; g.fillRect(-w / 2, -h / 2, w, h); }
    lines.forEach((l, i) => {
      const y = top + lh * i + lh / 2;
      switch (style) {
        case "box": {
          const lw = g.measureText(l).width + fs * 0.7;
          g.fillStyle = "#fff";
          roundPath(g, -lw / 2, y - lh / 2, lw, lh, fs * 0.25);
          g.fill();
          g.fillStyle = "#0b0b0b";
          g.fillText(l, 0, y + fs * 0.04);
          break;
        }
        case "bar": g.fillStyle = "#0b0b0b"; g.fillText(l, 0, y); break;
        case "red": g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = fs * 0.2; g.fillStyle = "#ef3b2d"; g.fillText(l, 0, y); g.shadowBlur = 0; break;
        case "neon": g.shadowColor = "#ff2bd6"; g.shadowBlur = fs * 0.6; g.fillStyle = "#fff"; g.fillText(l, 0, y); g.fillText(l, 0, y); g.shadowBlur = 0; break;
        case "plain": g.shadowColor = "rgba(0,0,0,.7)"; g.shadowBlur = fs * 0.25; g.fillStyle = "#fff"; g.fillText(l, 0, y); g.shadowBlur = 0; break;
        default: // white / yellow / karaoke
          g.lineJoin = "round"; g.lineWidth = fs * 0.16; g.strokeStyle = "#000";
          g.strokeText(l, 0, y);
          g.fillStyle = style === "yellow" ? "#ffd60a" : "#fff";
          g.fillText(l, 0, y);
      }
    });
    return [w, h];
  }

  /* ---------------- Capas: stickers y video sobre video ---------------- */

  const EMOJIS = ["🔥", "💧", "✨", "❤️", "😍", "😂", "🙌", "💪", "👀", "💯", "⭐", "🌙", "☀️", "🌸", "🥀", "💅", "🧴", "🏋️", "🥤", "⏰", "👉", "👇", "✅", "❌", "🎉", "💸", "📌", "🤯", "😴", "🫶"];
  const BADGES = [
    ["SÍGUEME", "#ef3b2d"], ["SUSCRÍBETE", "#ff0033"], ["❤ LIKE", "#ff2d55"], ["NUEVO", "#ffd60a"], ["POV", "#111111"],
    ["PARTE 2", "#5b2a8c"], ["LINK EN BIO", "#0a84ff"], ["GUÁRDALO 📌", "#12543f"], ["ANTES", "#333333"], ["DESPUÉS", "#ef3b2d"],
  ];
  // Barra de censura estilo "MOGGED": barra negra inclinada con letras rojas
  const BARS = ["MOGGED", "MOGGED!", "AURA +1000", "NPC", "ICONO", "FRAUDE", "LOOKSMAX", "GOD"];
  const BAR_STYLES = [
    ["heavy", "Rojo grueso", "#0b0b0b", "#ef3b2d"],
    ["thin", "Rojo fino", "#0b0b0b", "#ff3b30"],
    ["white", "Blanco", "#0b0b0b", "#ffffff"],
    ["red", "Barra roja", "#e0241b", "#0b0b0b"],
  ];
  const COLORS = ["#ef3b2d", "#ff2d55", "#ffd60a", "#34c759", "#0a84ff", "#5b2a8c", "#111111", "#ffffff"];
  const OANIMS = [["none", "Ninguna"], ["pop", "Pop"], ["bounce", "Rebote"], ["pulse", "Latido"], ["float", "Flotar"], ["spin", "Girar"], ["shake", "Vibrar"], ["slide", "Entrar"]];
  const SHAPES = [["rect", "Rectángulo"], ["round", "Redondeado"], ["circle", "Círculo"]];
  const ovEnd = (o) => (o.kind === "video" ? o.start + (o.trimEnd - o.trimStart) : o.end);
  const isLight = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 160; };
  const newSticker = (o) => ({ id: uid(), kind: "sticker", start: 0, end: 3, x: 0.5, y: 0.42, scale: 1, rot: 0, anim: "pop", opacity: 1, ...o });
  const newOvPhoto = (src, start, end) => ({ id: uid(), kind: "photo", src, start, end, x: 0.5, y: 0.36, scale: 1, rot: 0, shape: "circle", border: true, opacity: 1, anim: "pop" });
  function newOvVideo(m, start) {
    const room = total() - start;
    return {
      id: uid(), kind: "video", src: m.id, srcDur: m.duration, trimStart: 0, trimEnd: room > 1 ? Math.min(m.duration, room) : m.duration,
      start, x: 0.7, y: 0.28, scale: 1, rot: 0, shape: "round", border: true, opacity: 1, volume: 1, muted: false, chroma: false, anim: "pop",
    };
  }

  function syncOverlays(t) {
    for (const o of st.p.overlays) {
      if (o.kind !== "video") continue;
      const e = st.els.get(o.id);
      if (!e) continue;
      const v = e.el;
      if (t >= o.start && t < ovEnd(o)) {
        const target = o.trimStart + (t - o.start);
        if (e.gain) e.gain.gain.value = o.muted ? 0 : o.volume;
        if (st.playing) {
          if (v.paused) { if (Math.abs(v.currentTime - target) > 0.05) v.currentTime = target; v.play().catch(() => {}); }
          else if (Math.abs(v.currentTime - target) > 0.35) v.currentTime = target;
        } else {
          if (!v.paused) v.pause();
          if (Math.abs(v.currentTime - target) > 0.03) v.currentTime = target;
        }
      } else {
        if (e.gain) e.gain.gain.value = 0;
        if (!v.paused) v.pause();
        if (o.start > t && o.start - t < 1.5 && !v.seeking && Math.abs(v.currentTime - o.trimStart) > 0.1) v.currentTime = o.trimStart;
      }
    }
  }

  function roundPath(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  }

  // Pantalla verde: vuelve transparentes los píxeles donde el verde domina.
  const ck = document.createElement("canvas");
  const ckx = ck.getContext("2d", { willReadFrequently: true });
  function chromaKey(src, sx, sy, sw, sh) {
    const cw = Math.max(2, Math.min(480, Math.round(sw)));
    const chh = Math.max(2, Math.round((cw * sh) / sw));
    if (ck.width !== cw || ck.height !== chh) { ck.width = cw; ck.height = chh; }
    ckx.clearRect(0, 0, cw, chh);
    ckx.drawImage(src, sx, sy, sw, sh, 0, 0, cw, chh);
    const d = ckx.getImageData(0, 0, cw, chh);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const k = p[i + 1] - Math.max(p[i], p[i + 2]);
      if (k > 40) p[i + 3] = 0;
      else if (k > 12) { p[i + 3] = Math.round((255 * (40 - k)) / 28); p[i + 1] = Math.max(p[i], p[i + 2]); }
    }
    ckx.putImageData(d, 0, 0);
    return ck;
  }

  function drawOverlay(g, o, lt, W, H, ui) {
    const dur = ovEnd(o) - o.start;
    const live = st.playing || !!st.exp;
    const a = clamp(lt / 0.35, 0, 1);
    const ease = 1 - Math.pow(1 - a, 3);
    let sc = o.scale, rot = (o.rot * Math.PI) / 180, dx = 0, dy = 0, alpha = o.opacity;
    if (live) {
      switch (o.anim) {
        case "pop": sc *= 0.5 + 0.5 * backOut(a); alpha *= Math.min(1, a * 2); break;
        case "bounce": dy = -Math.abs(Math.sin(lt * 4)) * 0.03 * H; break;
        case "pulse": sc *= 1 + 0.08 * Math.sin(lt * 6); break;
        case "float": dy = Math.sin(lt * 2) * 0.015 * H; break;
        case "spin": rot += lt * 2; break;
        case "shake": if (lt % 1.2 < 0.35) dx = Math.sin(lt * 45) * 0.008 * W; break;
        case "slide": dx = (1 - ease) * (o.x > 0.5 ? 1 : -1) * W * 0.6; alpha *= ease; break;
      }
      const rem = dur - lt;
      if (rem < 0.2) alpha *= clamp(rem / 0.2, 0, 1);
    }
    let w = W * 0.3, h = W * 0.3;
    g.save();
    g.globalAlpha = alpha;
    g.translate(o.x * W + dx, o.y * H + dy);
    g.rotate(rot);
    g.scale(sc, sc);
    if (o.kind === "sticker") {
      g.textAlign = "center";
      g.textBaseline = "middle";
      if (o.txt != null) {
        [w, h] = drawStickerText(g, o, W);
      } else if (o.bar) {
        const [, , bg, fg] = BAR_STYLES.find((b) => b[0] === o.barStyle) || BAR_STYLES[0];
        const fs = W * 0.075;
        const heavy = o.barStyle !== "thin";
        g.font = heavy
          ? `900 ${fs}px Impact, Haettenschweiler, "Arial Narrow Bold", "sans-serif-condensed", ${FONT}`
          : `700 ${fs}px ${FONT}`;
        const sx = heavy ? 0.86 : 1; // letras más angostas, como en los videos
        const text = o.bar.toUpperCase();
        w = g.measureText(text).width * sx + fs * 0.9;
        h = fs * 1.28;
        g.shadowColor = "rgba(0,0,0,.35)";
        g.shadowBlur = fs * 0.3;
        g.fillStyle = bg;
        g.fillRect(-w / 2, -h / 2, w, h);
        g.shadowBlur = 0;
        g.fillStyle = fg;
        g.save();
        g.scale(sx, 1);
        g.fillText(text, 0, fs * 0.04);
        g.restore();
      } else if (o.badge) {
        const fs = W * 0.06;
        g.font = `900 ${fs}px ${FONT}`;
        w = g.measureText(o.badge).width + fs * 1.3;
        h = fs * 1.9;
        g.shadowColor = "rgba(0,0,0,.35)";
        g.shadowBlur = fs * 0.4;
        g.fillStyle = o.color || "#ef3b2d";
        roundPath(g, -w / 2, -h / 2, w, h, h * 0.32);
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = isLight(o.color || "#ef3b2d") ? "#0b0b0b" : "#fff";
        g.fillText(o.badge, 0, fs * 0.06);
      } else {
        w = h = W * 0.22;
        g.font = `${w * 0.85}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
        g.fillText(o.emoji, 0, w * 0.06);
      }
    } else {
      const e = st.els.get(o.id);
      const fsrc = e ? frameSource(e, o) : null;
      if (fsrc) {
        let { img: src, sx, sy, sw: sW, sh: sH } = fsrc;
        w = W * 0.42;
        h = (w * sH) / sW;
        if (o.shape === "circle") { const m = Math.min(sW, sH); sx += (sW - m) / 2; sy += (sH - m) / 2; sW = sH = m; h = w; }
        if (o.chroma && o.kind === "video") { src = chromaKey(src, sx, sy, sW, sH); sx = sy = 0; sW = src.width; sH = src.height; }
        const path = () => {
          if (o.shape === "circle") { g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); }
          else roundPath(g, -w / 2, -h / 2, w, h, o.shape === "round" ? w * 0.08 : 0);
        };
        if (!o.chroma) {
          g.save();
          path();
          g.shadowColor = "rgba(0,0,0,.45)";
          g.shadowBlur = W * 0.025;
          g.fillStyle = "#000";
          g.fill();
          g.restore();
        }
        g.save();
        path();
        g.clip();
        g.drawImage(src, sx, sy, sW, sH, -w / 2, -h / 2, w, h);
        g.restore();
        if (o.border && !o.chroma) { path(); g.lineWidth = W * 0.008; g.strokeStyle = "#fff"; g.stroke(); }
      } else {
        g.fillStyle = "rgba(255,255,255,.15)";
        g.fillRect(-w / 2, -h / 2, w, h);
      }
    }
    if (ui && isSel("ov", o.id)) {
      g.setLineDash([W * 0.015, W * 0.01]);
      g.lineWidth = W * 0.004 / Math.max(0.2, sc);
      g.strokeStyle = "#fff";
      g.strokeRect(-w / 2 - W * 0.01, -h / 2 - W * 0.01, w + W * 0.02, h + W * 0.02);
    }
    g.restore();
    if (ui) st.hits.push({ o, x: o.x * W, y: o.y * H, w: w * o.scale, h: h * o.scale, rot: (o.rot * Math.PI) / 180 });
  }

  /* --- Mover con el dedo sobre la vista previa: 1 dedo mueve, 2 dedos agrandan y giran --- */
  const wrapEl = $("#stWrap");
  const ptrs = new Map();
  let gest = null;
  const canvasPoint = (ev) => {
    const r = cv.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) * cv.width) / r.width, y: ((ev.clientY - r.top) * cv.height) / r.height };
  };
  function hitTest(pt) {
    for (let i = st.hits.length - 1; i >= 0; i--) {
      const h = st.hits[i];
      const dx = pt.x - h.x, dy = pt.y - h.y;
      const c = Math.cos(-h.rot), s = Math.sin(-h.rot);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      // margen de toque generoso: al menos 24 px de pantalla
      const pad = Math.max(cv.width * 0.03, (24 * cv.width) / Math.max(1, cv.getBoundingClientRect().width));
      if (Math.abs(lx) <= h.w / 2 + pad && Math.abs(ly) <= h.h / 2 + pad) return h;
    }
    return null;
  }
  wrapEl.addEventListener("pointerdown", (ev) => {
    if (!st.p || st.exp) return;
    const pt = canvasPoint(ev);
    ptrs.set(ev.pointerId, pt);
    try { wrapEl.setPointerCapture(ev.pointerId); } catch {}
    if (st.playing) pause();
    if (ptrs.size === 1) {
      let h = hitTest(pt);
      // si ya hay una capa o texto seleccionado y visible, se puede mover/pellizcar tocando en cualquier parte
      if (!h && st.sel && (st.sel.type === "ov" || st.sel.type === "text")) {
        const cur = findSel();
        const on = cur && (st.sel.type === "ov" ? st.t >= cur.start && st.t < ovEnd(cur) : st.t >= cur.start && st.t < cur.end);
        if (on) h = st.sel.type === "ov" ? { o: cur } : { tx: cur };
      }
      if (!h) { gest = null; return; }
      const target = h.o || h.tx;
      const type = h.o ? "ov" : "text";
      if (!isSel(type, target.id)) select({ type, id: target.id });
      st.hist.push(snapshot());
      st.fut = [];
      gest = { type, target, start: pt, x0: target.x, y0: target.y, moved: false, pinch: null };
    } else if (ptrs.size === 2 && gest) {
      const [a, b] = [...ptrs.values()];
      gest.pinch = { d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x), s0: gest.type === "ov" ? gest.target.scale : gest.target.size, r0: gest.target.rot || 0 };
    }
  });
  wrapEl.addEventListener("pointermove", (ev) => {
    if (!ptrs.has(ev.pointerId) || !gest) return;
    const pt = canvasPoint(ev);
    ptrs.set(ev.pointerId, pt);
    const T = gest.target;
    if (ptrs.size >= 2 && gest.pinch) {
      const [a, b] = [...ptrs.values()];
      const k = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, gest.pinch.d0);
      if (gest.type === "ov") {
        T.scale = clamp(gest.pinch.s0 * k, 0.15, 6);
        T.rot = Math.round(gest.pinch.r0 + ((Math.atan2(b.y - a.y, b.x - a.x) - gest.pinch.a0) * 180) / Math.PI);
      } else T.size = clamp(gest.pinch.s0 * k, 2, 20);
    } else {
      const dx = (pt.x - gest.start.x) / cv.width, dy = (pt.y - gest.start.y) / cv.height;
      if (Math.abs(dx) + Math.abs(dy) > 0.004) gest.moved = true;
      if (gest.type === "ov") {
        T.x = clamp(gest.x0 + dx, 0, 1);
        T.y = clamp(gest.y0 + dy, 0, 1);
        if (Math.abs(T.x - 0.5) < 0.015) T.x = 0.5; // imán al centro
        if (Math.abs(T.y - 0.5) < 0.015) T.y = 0.5;
      } else T.y = clamp(gest.y0 + dy, 0.03, 0.97);
    }
    gest.moved ||= !!gest.pinch;
    requestDraw(false);
  });
  const endGesture = (ev) => {
    ptrs.delete(ev.pointerId);
    if (!gest) return;
    if (ptrs.size === 0) {
      if (!gest.moved) st.hist.pop();
      else { st.lastKey = ""; changed(false); renderPanel(); undoToast(gest.type === "ov" ? "Capa movida" : "Texto movido"); }
      gest = null;
    } else if (ptrs.size === 1) {
      const pt = [...ptrs.values()][0];
      Object.assign(gest, { pinch: null, start: pt, x0: gest.target.x, y0: gest.target.y });
    }
  };
  wrapEl.addEventListener("pointerup", endGesture);
  wrapEl.addEventListener("pointercancel", endGesture);

  function drawFrame(g, t, W, H, ui = false) {
    g.save();
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    const i = activeIndex(t);
    if (i >= 0 && t >= st.L[i].start) { // en un espacio entre clips se ve negro
      const o = st.L[i];
      const lt = t - o.start;
      const tr = o.c.gap ? "none" : o.c.trans || "none";
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
    if (ui) st.hits = [];
    for (const o of st.p.overlays) if (t >= o.start && t < ovEnd(o)) drawOverlay(g, o, t - o.start, W, H, ui);
    for (const tx of st.p.texts) if (t >= tx.start && t < tx.end) drawText(g, tx, t - tx.start, W, H, ui);
    g.restore();
  }

  function requestDraw(seek = true) {
    if (st.playing) return;
    cancelAnimationFrame(st.drawRaf);
    st.drawRaf = requestAnimationFrame(() => {
      if (!st.p) return;
      if (seek) syncVideos(st.t);
      drawFrame(ctx, st.t, cv.width, cv.height, true);
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
    startAudios(st.t);
    $("#stPlay").textContent = "❚❚";
    loop();
  }

  function pause() {
    st.playing = false;
    cancelAnimationFrame(st.raf);
    stopAudios();
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

  function lanesFor(items, startOf, endOf) {
    const lanes = [];
    const map = new Map();
    for (const it of [...items].sort((x, y) => startOf(x) - startOf(y))) {
      let i = lanes.findIndex((end) => end <= startOf(it) + 0.01);
      if (i < 0) { i = lanes.length; lanes.push(0); }
      lanes[i] = endOf(it);
      map.set(it.id, i);
    }
    return { map, n: lanes.length };
  }

  function audioLanes() {
    const lanes = [];
    const map = new Map();
    for (const a of [...st.p.audios].sort((x, y) => x.start - y.start)) {
      let i = lanes.findIndex((end) => end <= a.start + 0.01);
      if (i < 0) { i = lanes.length; lanes.push(0); }
      lanes[i] = a.start + a.dur;
      map.set(a.id, i);
    }
    return { map, n: lanes.length };
  }

  // Puntos donde "imanta" un bloque al arrastrarlo: cabezal, cortes entre clips, bordes de textos/audios y golpes del ritmo.
  function snapPoints(exceptId) {
    const pts = [0, total(), st.t];
    for (const o of st.L) pts.push(o.start, o.end);
    for (const x of st.p.texts) if (x.id !== exceptId) pts.push(x.start, x.end);
    for (const o of st.p.overlays) if (o.id !== exceptId) pts.push(o.start, ovEnd(o));
    for (const a of st.p.audios) {
      if (a.id === exceptId) continue;
      pts.push(a.start, a.start + a.dur);
      const e = bufOf(a);
      if (e?.beats) for (const b of e.beats.times) if (b >= a.offset && b <= a.offset + a.dur) pts.push(a.start + b - a.offset);
    }
    return pts;
  }
  function snap(t, pts) {
    if (!st.magnet) return t; // imán apagado: movimiento totalmente libre
    const lim = 10 / st.pps;
    let best = t, d = lim;
    for (const p of pts) { const k = Math.abs(p - t); if (k < d) { d = k; best = p; } }
    return best;
  }

  // Arrastre con el dedo. onMove(segundos, dyPx) mientras se mueve; onEnd(segundos, movió, dyPx) al soltar.
  function attachDrag(node, onMove, onEnd, onStart) {
    node.addEventListener("pointerdown", (ev) => {
      if (ev.button > 0) return;
      ev.stopPropagation();
      ev.preventDefault();
      if (st.playing) pause();
      try { node.setPointerCapture(ev.pointerId); } catch {}
      const x0 = ev.clientX, y0 = ev.clientY;
      const sl0 = tl.scrollLeft;
      let dx = 0, dy = 0, moved = false, edge = 0;
      const secs = () => (dx + tl.scrollLeft - sl0) / st.pps;
      const timer = setInterval(() => { if (edge && moved) { tl.scrollLeft += edge * 10; onMove(secs(), dy); } }, 30);
      const mv = (e) => {
        dx = e.clientX - x0;
        dy = e.clientY - y0;
        if (!moved && Math.hypot(dx, dy) > 6) { moved = true; onStart?.(); }
        const r = tl.getBoundingClientRect();
        edge = e.clientX < r.left + 36 ? -1 : e.clientX > r.right - 36 ? 1 : 0;
        if (moved) onMove(secs(), dy);
      };
      const up = () => {
        clearInterval(timer);
        node.removeEventListener("pointermove", mv);
        node.removeEventListener("pointerup", up);
        node.removeEventListener("pointercancel", up);
        if (moved) { st.justDragged = true; setTimeout(() => (st.justDragged = false), 60); }
        const n0 = st.changes || 0;
        Promise.resolve(onEnd(secs(), moved, dy)).then(() => { if (moved && (st.changes || 0) > n0) undoToast("Bloque cambiado"); });
      };
      node.addEventListener("pointermove", mv);
      node.addEventListener("pointerup", up);
      node.addEventListener("pointercancel", up);
    });
  }

  function tag(node, text) {
    let t = node.querySelector(".st-tag");
    if (!t) { t = el("span", "st-tag"); node.append(t); }
    t.textContent = text;
  }

  // Asas de recorte del bloque seleccionado. trim(side, ds) devuelve [left, width, etiqueta]; commit(side, ds) guarda.
  function addHandles(node, trim, commit) {
    for (const side of ["l", "r"]) {
      const h = el("i", "st-h " + side);
      node.append(h);
      attachDrag(h, (ds) => {
        const [left, width, label] = trim(side, ds);
        node.style.left = left + "px";
        node.style.width = Math.max(10, width) + "px";
        tag(node, label);
      }, (ds, moved) => { if (moved) commit(side, ds); else renderTimeline(); });
    }
  }

  // Al empezar a arrastrar un bloque no seleccionado, se marca sin redibujar (para no cortar el arrastre).
  const softSelect = (node, sel) => () => {
    st.sel = sel;
    document.querySelectorAll("#stTracks .st-sel").forEach((x) => x !== node && x.classList.remove("st-sel"));
    node.classList.add("st-sel", "dragging");
  };
  const afterDrop = (sel) => { st.sel = sel; st.tool = null; renderTools(); renderPanel(); };

  /* --- Pasar de la pista principal a capa y al revés --- */
  function clipToOverlay(c, start) {
    if (c.kind === "video" && c.speed !== 1) { toast("Pon la velocidad en Normal para pasarlo a capa"); return null; }
    const base = { id: uid(), src: c.src, start, x: 0.5, y: 0.5, scale: 1 / 0.42, rot: 0, shape: "rect", border: false, opacity: 1, anim: "none", crop: c.crop, rot90: c.rot90, flip: c.flip };
    return c.kind === "video"
      ? { ...base, kind: "video", srcDur: c.srcDur, trimStart: c.trimStart, trimEnd: c.trimEnd, volume: c.volume, muted: c.muted, chroma: false }
      : { ...base, kind: "photo", end: start + c.dur };
  }
  function overlayToClip(o) {
    const extra = { crop: o.crop, rot90: o.rot90, flip: o.flip };
    return o.kind === "video"
      ? { id: uid(), kind: "video", src: o.src, srcDur: o.srcDur, trimStart: o.trimStart, trimEnd: o.trimEnd, speed: 1, volume: o.volume, muted: o.muted, filter: "none", motion: "none", fit: "cover", trans: "none", gap: 0, ...extra }
      : photoClip(o.src, { dur: o.end - o.start, fit: "cover", gap: 0, ...extra });
  }
  async function moveToLayer(c, start) {
    const ov = clipToOverlay(c, start);
    if (!ov) return renderTimeline();
    await mutate((p) => { p.clips = p.clips.filter((x) => x !== c); p.overlays.push(ov); }, { rebuild: true });
    select({ type: "ov", id: ov.id });
    toast("Ahora es una capa: muévela y cámbiale el tamaño sobre el video");
  }
  async function moveToMain(o) {
    if (o.kind === "sticker") { toast("Los stickers solo van como capa"); return renderTimeline(); }
    const c = overlayToClip(o);
    const idx = st.L.filter((x) => x.start + x.d / 2 < o.start).length;
    await mutate((p) => { p.overlays = p.overlays.filter((x) => x !== o); p.clips.splice(idx, 0, c); }, { rebuild: true });
    select({ type: "clip", id: c.id });
    toast("Ahora está en la pista principal");
  }

  function renderRuler(pad, pps, width) {
    const r = $("#stRuler");
    r.innerHTML = "";
    r.style.width = width + "px";
    const step = pps >= 60 ? 1 : pps >= 25 ? 2 : pps >= 12 ? 5 : 10;
    const end = Math.ceil((width - pad) / pps);
    for (let s = 0; s <= end; s += step) {
      const m = el("span", "", fmtTime(s));
      m.style.left = pad + s * pps + "px";
      r.append(m);
    }
    r.style.backgroundImage = `repeating-linear-gradient(90deg, #3a3a42 0 1px, transparent 1px ${pps}px)`;
    r.style.backgroundPosition = pad + "px 100%";
  }

  function renderTimeline() {
    const pad = Math.round(tl.clientWidth / 2);
    const pps = st.pps;
    const T = total();
    const lanes = audioLanes();
    const nl = Math.max(1, lanes.n);
    const ovl = lanesFor(st.p.overlays, (o) => o.start, ovEnd);
    // filas: regla · clips · capas (stickers / video sobre video) · textos · audio
    const clipTop = 22, ovTop = 82, textTop = ovTop + Math.max(ovl.n, 1) * 28, audTop = textTop + 30;
    const fullH = audTop + nl * 28 + 6;
    // la línea de tiempo crece hasta ~42% de la pantalla para que se vean todas las pistas; si no caben, se desliza en vertical
    const tlh = Math.min(fullH, Math.max(214, Math.round(innerHeight * 0.42)));
    $("#studio").style.setProperty("--tlh", tlh + "px");
    tl.style.overflowY = fullH > tlh ? "auto" : "hidden";
    $("#stClips").style.top = clipTop + "px";
    $("#stOvs").style.top = ovTop + "px";
    $("#stOvs").style.height = Math.max(ovl.n, 1) * 28 + "px";
    $("#stTexts").style.top = textTop + "px";
    $("#stMusic").style.top = audTop + "px";
    $("#stMusic").style.height = nl * 28 + "px";
    $("#stTracks").style.height = fullH + "px";
    const width = pad * 2 + Math.max(T, ...st.p.audios.map((a) => a.start + a.dur), ...st.p.texts.map((x) => x.end), ...st.p.overlays.map(ovEnd)) * pps + 70;
    $("#stTracks").style.width = width + "px";
    renderRuler(pad, pps, width);
    const X = (t) => pad + t * pps;

    /* --- Clips (pista principal) --- */
    const clips = $("#stClips");
    clips.innerHTML = "";
    st.L.forEach((o, i) => {
      const sel = isSel("clip", o.c.id);
      const b = el("div", "st-clip" + (sel ? " st-sel" : ""));
      b.style.left = X(o.start) + "px";
      b.style.width = Math.max(10, o.d * pps - 2) + "px";
      const e = st.els.get(o.c.id);
      if (e?.thumb) b.style.backgroundImage = `url("${e.thumb}")`;
      b.append(el("span", "", o.d.toFixed(1) + "s"));
      const kind = (o.c.kind === "video" ? "🎬" : "🖼") + (o.c.kind === "video" && o.c.speed !== 1 ? " " + o.c.speed + "x" : "") + (o.c.muted ? " 🔇" : "") + (o.c.crop || o.c.rot90 || o.c.flip ? " ⛶" : "") + (e ? "" : " ⚠");
      b.append(el("span", "st-kind", kind));
      b.addEventListener("click", (ev) => { ev.stopPropagation(); if (!st.justDragged) select({ type: "clip", id: o.c.id }); });
      // mover libremente: horizontal = cambiar de lugar o dejar espacio; hacia abajo = pasar a capa
      let marker = null, plan = null;
      attachDrag(b, (ds, dy) => {
        b.style.transform = `translate(${ds * pps}px, ${dy}px)`;
        b.style.zIndex = 8;
        const ns = Math.max(0, o.start + ds);
        if (dy > 40) { plan = { layer: ns }; marker?.remove(); marker = null; return tag(b, "⇣ Soltar como capa · " + fmt(ns)); }
        const center = ns + o.d / 2;
        const others = st.L.filter((x) => x !== o);
        const target = others.filter((x) => x.start + x.d / 2 < center).length;
        if (target === i) {
          const prevEnd = i > 0 ? st.L[i - 1].end : 0;
          const gap = Math.max(0, snap(ns, snapPoints(o.c.id)) - prevEnd);
          plan = { gap };
          marker?.remove(); marker = null;
          tag(b, gap > 0.05 ? `Espacio ${gap.toFixed(1)} s` : "Pegado al anterior");
        } else {
          plan = { target };
          const at = others.slice(0, target).reduce((sum, x) => sum + (x.c.gap || 0) + x.d, 0);
          marker ||= clips.appendChild(el("div", "st-drop"));
          marker.style.left = X(at) + "px";
          tag(b, `Posición ${target + 1}`);
        }
      }, (ds, moved) => {
        marker?.remove();
        if (!moved || !plan) return;
        const id = o.c.id;
        const done = () => { afterDrop({ type: "clip", id }); const n = st.L.find((x) => x.c.id === id); if (n) { st.t = n.start; requestDraw(); } };
        if (plan.layer != null) return moveToLayer(o.c, plan.layer);
        if (plan.target != null) return mutate((p) => { const [c] = p.clips.splice(i, 1); c.gap = 0; p.clips.splice(plan.target, 0, c); }).then(done);
        mutate(() => { o.c.gap = plan.gap > 0.05 ? +plan.gap.toFixed(3) : 0; }).then(done);
      }, softSelect(b, { type: "clip", id: o.c.id }));
      if (sel) {
        addHandles(b, (side, ds) => {
          const c = o.c;
          let d;
          if (c.kind === "photo") d = clamp(side === "r" ? c.dur + ds : c.dur - ds, 0.1, 600);
          else {
            const ts = side === "l" ? clamp(c.trimStart + ds * c.speed, 0, c.trimEnd - 0.1) : c.trimStart;
            const te = side === "r" ? clamp(c.trimEnd + ds * c.speed, c.trimStart + 0.1, c.srcDur) : c.trimEnd;
            d = (te - ts) / c.speed;
          }
          return [X(o.start), d * pps - 2, d.toFixed(1) + " s"];
        }, (side, ds) => mutate(() => {
          const c = o.c;
          if (c.kind === "photo") c.dur = clamp(side === "r" ? c.dur + ds : c.dur - ds, 0.1, 600);
          else if (side === "l") c.trimStart = clamp(c.trimStart + ds * c.speed, 0, c.trimEnd - 0.1);
          else c.trimEnd = clamp(c.trimEnd + ds * c.speed, c.trimStart + 0.1, c.srcDur);
        }));
      }
      clips.append(b);
      if (i > 0 && !o.c.gap) {
        const has = o.c.trans && o.c.trans !== "none";
        const tb = el("button", "st-trans" + (has ? " has" : ""), has ? "⇄" : "+");
        tb.title = "Transición";
        tb.style.left = X(o.start) + "px";
        tb.addEventListener("click", (ev) => { ev.stopPropagation(); select({ type: "clip", id: o.c.id }, "trans"); });
        clips.append(tb);
      }
    });
    const ghost = el("button", "st-add-ghost", "+");
    ghost.style.left = X(T) + 6 + "px";
    ghost.addEventListener("click", (ev) => { ev.stopPropagation(); openAdd(); });
    clips.append(ghost);

    /* --- Capas: stickers, fotos y video sobre video --- */
    const ovs = $("#stOvs");
    ovs.innerHTML = "";
    for (const o of st.p.overlays) {
      const sel = isSel("ov", o.id);
      const end = ovEnd(o);
      const b = el("div", "st-ov " + o.kind + (sel ? " st-sel" : ""));
      b.style.top = ovl.map.get(o.id) * 28 + "px";
      b.style.left = X(o.start) + "px";
      b.style.width = Math.max(14, (end - o.start) * pps - 2) + "px";
      const e = st.els.get(o.id);
      if (e?.thumb) b.style.backgroundImage = `url("${e.thumb}")`;
      b.append(el("b", "", o.kind === "sticker" ? (o.txt != null ? "T " + o.txt : o.emoji || o.badge || "▬ " + o.bar) + (o.sound ? " 🔊" : "") : (o.kind === "video" ? "▣ Video" : "◉ Foto") + (o.chroma ? " 🟩" : "") + (o.crop || o.rot90 || o.flip ? " ⛶" : "")));
      b.addEventListener("click", (ev) => { ev.stopPropagation(); if (!st.justDragged) select({ type: "ov", id: o.id }); });
      const pts = snapPoints(o.id);
      const len = end - o.start;
      const moveTo = (ds) => {
        const s0 = Math.max(0, o.start + ds);
        const s1 = snap(s0, pts), s2 = snap(s0 + len, pts) - len;
        return Math.max(0, Math.abs(s1 - s0) <= Math.abs(s2 - s0) ? s1 : s2);
      };
      attachDrag(b, (ds, dy) => {
        const s0 = moveTo(ds);
        b.style.left = X(s0) + "px";
        b.style.transform = `translateY(${dy}px)`;
        b.style.zIndex = 8;
        tag(b, dy < -36 && o.kind !== "sticker" ? "⇡ Soltar en la pista principal" : fmt(s0));
      }, (ds, moved, dy) => {
        if (!moved) return;
        if (dy < -36) return moveToMain(o);
        const s0 = moveTo(ds);
        mutate(() => { if (o.kind !== "video") o.end = s0 + len; o.start = s0; }).then(() => afterDrop({ type: "ov", id: o.id }));
      }, softSelect(b, { type: "ov", id: o.id }));
      if (sel) {
        const edges = (side, ds) => {
          if (o.kind === "video") {
            if (side === "l") {
              const d = clamp(snap(o.start + ds, pts) - o.start, Math.max(-o.start, -o.trimStart), o.trimEnd - o.trimStart - 0.1);
              return { start: o.start + d, trimStart: o.trimStart + d, trimEnd: o.trimEnd };
            }
            const ne = clamp(snap(end + ds, pts), o.start + 0.1, o.start + (o.srcDur - o.trimStart));
            return { start: o.start, trimStart: o.trimStart, trimEnd: o.trimStart + (ne - o.start) };
          }
          return side === "l"
            ? { start: Math.max(0, Math.min(snap(o.start + ds, pts), o.end - 0.1)), end: o.end }
            : { start: o.start, end: Math.max(o.start + 0.1, snap(o.end + ds, pts)) };
        };
        const span = (r) => (o.kind === "video" ? [r.start, r.start + r.trimEnd - r.trimStart] : [r.start, r.end]);
        addHandles(b, (side, ds) => { const [s0, e0] = span(edges(side, ds)); return [X(s0), (e0 - s0) * pps - 2, (e0 - s0).toFixed(1) + " s"]; },
          (side, ds) => { const r = edges(side, ds); mutate(() => Object.assign(o, r)); });
      }
      ovs.append(b);
    }
    if (!st.p.overlays.length && T) {
      const h = el("div", "st-hint-row", "▣ Capas: stickers y video sobre video (arrastra un clip hacia aquí)");
      h.style.left = pad + "px";
      ovs.append(h);
    }

    /* --- Textos --- */
    const texts = $("#stTexts");
    texts.innerHTML = "";
    for (const tx of st.p.texts) {
      const sel = isSel("text", tx.id);
      const b = el("div", "st-text" + (tx.sub ? " sub" : "") + (sel ? " st-sel" : ""));
      b.append(el("b", "", (tx.sub ? "CC " : "T ") + tx.text));
      b.style.left = X(tx.start) + "px";
      b.style.width = Math.max(14, (tx.end - tx.start) * pps - 2) + "px";
      b.addEventListener("click", (ev) => { ev.stopPropagation(); if (!st.justDragged) select({ type: "text", id: tx.id }); });
      const pts = snapPoints(tx.id);
      const len = tx.end - tx.start;
      const moveTo = (ds) => {
        const s = Math.max(0, tx.start + ds);
        const s1 = snap(s, pts), s2 = snap(s + len, pts) - len;
        return Math.max(0, Math.abs(s1 - s) <= Math.abs(s2 - s) ? s1 : s2);
      };
      attachDrag(b, (ds) => { const s = moveTo(ds); b.style.left = X(s) + "px"; tag(b, fmt(s)); },
        (ds, moved) => { if (!moved) return; const s = moveTo(ds); mutate(() => { tx.start = s; tx.end = s + len; }).then(() => afterDrop({ type: "text", id: tx.id })); },
        softSelect(b, { type: "text", id: tx.id }));
      if (sel) {
        const edges = (side, ds) => side === "l"
          ? [Math.max(0, Math.min(snap(tx.start + ds, pts), tx.end - 0.1)), tx.end]
          : [tx.start, Math.max(tx.start + 0.1, snap(tx.end + ds, pts))];
        addHandles(b, (side, ds) => { const [s, e] = edges(side, ds); return [X(s), (e - s) * pps - 2, fmt(side === "l" ? s : e)]; },
          (side, ds) => { const [s, e] = edges(side, ds); mutate(() => { tx.start = s; tx.end = e; }); });
      }
      texts.append(b);
    }
    if (!st.p.texts.length && T) {
      const h = el("div", "st-hint-row", "＋ Toca “Texto” para agregar frases");
      h.style.left = pad + "px";
      texts.append(h);
    }

    /* --- Pistas de audio --- */
    const mus = $("#stMusic");
    mus.innerHTML = "";
    for (const a of st.p.audios) {
      const sel = isSel("audio", a.id);
      const e = bufOf(a);
      const b = el("div", "st-mus" + (sel ? " st-sel" : "") + (e ? "" : " missing"));
      b.style.top = lanes.map.get(a.id) * 28 + "px";
      b.style.left = X(a.start) + "px";
      const wpx = Math.max(14, a.dur * pps - 2);
      b.style.width = wpx + "px";
      if (e) b.style.backgroundImage = `url("${waveURL(a, wpx, sel)}")`;
      const label = (a.src === "media" ? "🎬 " : a.rec ? "🎙 " : "♫ ") + (e?.name || "Audio no encontrado") + (a.fx !== "none" ? " · " + FX.find((f) => f[0] === a.fx)?.[1] : "") + (a.loop ? " · 🔁" : "");
      b.append(el("b", "", label));
      b.addEventListener("click", (ev) => { ev.stopPropagation(); if (!st.justDragged) select({ type: "audio", id: a.id }); });
      const pts = snapPoints(a.id);
      const moveTo = (ds) => {
        const s = Math.max(0, a.start + ds);
        const s1 = snap(s, pts), s2 = snap(s + a.dur, pts) - a.dur;
        return Math.max(0, Math.abs(s1 - s) <= Math.abs(s2 - s) ? s1 : s2);
      };
      attachDrag(b, (ds) => { const s = moveTo(ds); b.style.left = X(s) + "px"; tag(b, fmt(s)); },
        (ds, moved) => { if (!moved) return; const s = moveTo(ds); mutate(() => { a.start = s; }).then(() => afterDrop({ type: "audio", id: a.id })); },
        softSelect(b, { type: "audio", id: a.id }));
      if (sel) {
        const SD = srcDur(a);
        const edges = (side, ds) => {
          if (side === "l") {
            // recorta el inicio: se mueve el comienzo y se salta esa parte del audio
            const minDs = a.loop ? -a.start : Math.max(-a.start, -a.offset);
            const d = clamp(snap(a.start + ds, pts) - a.start, minDs, a.dur - 0.1);
            return { start: a.start + d, offset: a.offset + d, dur: a.dur - d };
          }
          const maxDur = a.loop ? 3600 : SD - a.offset;
          return { start: a.start, offset: a.offset, dur: clamp(snap(a.start + a.dur + ds, pts) - a.start, 0.1, maxDur) };
        };
        addHandles(b, (side, ds) => { const r = edges(side, ds); return [X(r.start), r.dur * pps - 2, r.dur.toFixed(1) + " s"]; },
          (side, ds) => { const r = edges(side, ds); mutate(() => Object.assign(a, r)); });
      }
      mus.append(b);
    }
    if (!st.p.audios.length && T) {
      const h = el("div", "st-hint-row", "♫ Toca “Audio” para agregar música o grabar tu voz");
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
    st.changes = (st.changes || 0) + 1;
    fn(st.p);
    return changed(rebuild);
  }

  async function changed(rebuild) {
    if (rebuild) {
      for (const c of st.p.clips) await loadEl(c);
      for (const o of st.p.overlays) if (o.kind !== "sticker") await loadEl(o);
      pruneEls();
      await ensureBufs();
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

  // Aviso con botón "Deshacer" después de mover, recortar o borrar
  let undoTimer = 0;
  function undoToast(msg) {
    let b = $("#undoBar");
    if (!b) {
      b = el("div", "undo-bar");
      b.id = "undoBar";
      const btnU = el("button", "", "↶ Deshacer");
      btnU.addEventListener("click", async () => {
        b.hidden = true;
        await undoRedo(st.hist, st.fut);
        toast("Deshecho: volvió como estaba ↶");
      });
      b.append(el("span"), btnU);
      document.body.append(b);
    }
    b.querySelector("span").textContent = msg;
    b.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (b.hidden = true), 5000);
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
    if (s.type === "audio") return st.p.audios.find((a) => a.id === s.id);
    if (s.type === "ov") return st.p.overlays.find((o) => o.id === s.id);
    return null;
  }

  function select(s, tool = null) {
    st.sel = s;
    st.tool = tool;
    if (s?.type === "text") {
      const tx = findSel();
      if (tx && (st.t < tx.start || st.t >= tx.end)) { st.t = tx.start + 0.01; requestDraw(); }
    }
    if (s?.type === "ov") {
      const o = findSel();
      if (o && (st.t < o.start || st.t >= ovEnd(o))) { st.t = o.start + 0.01; requestDraw(); }
    }
    if (s?.type === "audio") {
      const a = findSel();
      if (a && (st.t < a.start || st.t >= a.start + a.dur)) { st.t = a.start; requestDraw(); }
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
        ...(v ? [["speed", "⏩", "Velocidad"], ["vol", "🔊", "Volumen"], ["sep", "⇣♫", "Separar audio"]] : []),
        ["crop", "⛶", "Encuadre"], ["filter", "◐", "Filtros"], ["motion", "↗", "Movimiento"], ["fit", "⤢", "Ajuste"], ["trans", "⇄", "Transición"],
        ["tolayer", "⇣▣", "A capa"], ["dup", "⧉", "Duplicar"], ["left", "◀", "Mover"], ["right", "▶", "Mover"], ["del", "🗑", "Borrar", "danger"],
      ];
    }
    if (s?.type === "text") {
      return [
        ["back", "‹", "Atrás"], ["edit", "✎", "Editar"], ["tstyle", "Aa", "Estilo"], ["tanim", "✦", "Animación"],
        ["tsize", "A↕", "Tamaño"], ["tpos", "↕", "Posición"], ["ttime", "⏱", "Tiempo"], ["tostk", "😀", "A sticker"], ["tdup", "⧉", "Duplicar"],
        ["tdel", "🗑", "Borrar", "danger"],
      ];
    }
    if (s?.type === "ov") {
      const o = findSel();
      const k = o?.kind;
      return [
        ["back", "‹", "Atrás"], ...(k === "sticker" ? [["ostk", "😀", "Cambiar"]] : []), ["omove", "✥", "Tamaño y giro"], ["oanim", "✦", "Animación"],
        ...(k !== "sticker" ? [["ocrop", "⛶", "Encuadre"], ["oshape", "◯", "Forma"]] : []), ["oopa", "◐", "Opacidad"],
        ...(k !== "sticker" ? [["tomain", "⇡", "A pista principal"]] : []),
        ...(k === "video" ? [["otrim", "⇤⇥", "Recortar"], ["ovol", "🔊", "Volumen"], ["ochroma", "🟩", "Fondo verde"]] : []),
        ...(k === "sticker" && (o.badge || o.bar || o.txt != null) ? [["otext", "✎", "Texto"]] : []),
        ...(k === "sticker" && o.txt != null ? [["otstyle", "Aa", "Estilo"]] : []),
        ...(k === "sticker" ? [["osnd", "🔊", "Sonido"], ["osave", "💾", "Guardar"]] : []),
        ...(k === "sticker" && o.bar ? [["obar", "▬", "Estilo"]] : []),
        ...(k === "sticker" && o.badge ? [["ocolor", "🎨", "Color"]] : []),
        ["ofront", "⬆", "Al frente"], ["oback", "⬇", "Al fondo"], ["odup", "⧉", "Duplicar"], ["odel", "🗑", "Borrar", "danger"],
      ];
    }
    if (s?.type === "audio") {
      return [
        ["back", "‹", "Atrás"], ["avol", "🔊", "Volumen"], ["afade", "◢", "Fundidos"], ["afx", "✺", "Efectos"],
        ["aeq", "🎚", "Ecualizador"], ["abeat", "🥁", "Ritmo"], ["asplit", "✂", "Dividir"], ["adup", "⧉", "Duplicar"],
        ["adel", "🗑", "Borrar", "danger"],
      ];
    }
    return [
      ["add", "＋", "Medios"], ["text", "T", "Texto"], ["sticker", "😀", "Stickers"], ["pip", "▣", "Superponer"], ["subs", "CC", "Subtítulos"], ["aadd", "♫", "Audio"], ["rec", "🎙", "Voz en off"], ["hooks", "🪝", "Ganchos"],
      ["magnet", "🧲", "Imán"], ...(st.p?.clips.some((c) => c.gap) ? [["gaps", "⇥⇤", "Quitar espacios"]] : []),
      ["format", "▭", "Formato"], ["safe", "◰", "Zona segura"], ["transAll", "⇄", "Transiciones"], ["filtersAll", "◐", "Filtros"],
    ];
  }

  function renderTools() {
    const bar = $("#stTools");
    bar.innerHTML = "";
    for (const [id, icon, label, cls] of toolsFor()) {
      const b = el("button", (cls || "") + (st.tool === id || (id === "safe" && showSafe) || (id === "magnet" && st.magnet) ? " on" : ""));
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
      case "magnet":
        st.magnet = !st.magnet;
        store.set("magnet", st.magnet);
        renderTools();
        renderTimeline();
        return toast(st.magnet ? "🧲 Imán activado: los bordes se pegan a cortes, cabezal y ritmo" : "Imán apagado: movimiento totalmente libre");
      case "gaps":
        await mutate((p) => p.clips.forEach((x) => { x.gap = 0; }));
        return toast("Espacios eliminados");
      case "crop": return openCrop(c);
      case "ocrop": return openCrop(findSel());
      case "tolayer": { const o = st.L.find((x) => x.c.id === c.id); return moveToLayer(c, o.start); }
      case "tomain": return moveToMain(findSel());
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
      case "sep": {
        if (c.speed !== 1) return toast("Pon la velocidad en Normal para separar el audio");
        const o = st.L.find((x) => x.c.id === c.id);
        const a = newAudioBlock("media", c.src, o.start, o.d, { offset: c.trimStart, volume: c.volume });
        if (!(await loadBuf(a))) return toast("Este video no tiene audio");
        await mutate((p) => { c.muted = true; p.audios.push(a); }, { rebuild: true });
        select({ type: "audio", id: a.id });
        return toast("Audio separado: ahora puedes moverlo, recortarlo y ponerle efectos");
      }
      case "split": {
        const o = st.L.find((x) => x.c.id === c.id);
        const lt = st.t - o.start;
        if (lt < 0.2 || o.d - lt < 0.2) return toast("Mueve el cabezal blanco dentro del clip para dividirlo");
        const b = { ...c, id: uid(), trans: "none", gap: 0 };
        await mutate((p) => {
          if (c.kind === "photo") { b.dur = c.dur - lt; c.dur = lt; }
          else { const cut = c.trimStart + lt * c.speed; b.trimStart = cut; c.trimEnd = cut; }
          p.clips.splice(o.i + 1, 0, b);
        }, { rebuild: true });
        return toast("Clip dividido ✂");
      }
      case "dup": {
        const i = st.p.clips.indexOf(c);
        const b = { ...c, id: uid(), gap: 0 };
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
        select(null);
        return undoToast("Clip borrado");
      case "tdup": {
        const b = { ...tx, id: uid() };
        await mutate((p) => p.texts.push(b));
        return select({ type: "text", id: b.id });
      }
      case "tostk": {
        const stk = newSticker({ txt: tx.text, tstyle: tx.style === "karaoke" ? "white" : tx.style, start: tx.start, end: tx.end, x: 0.5, y: tx.y, scale: tx.size / 7, anim: tx.anim === "none" ? "none" : "pop" });
        await mutate((p) => { p.texts = p.texts.filter((x) => x !== tx); p.overlays.push(stk); });
        select({ type: "ov", id: stk.id }, "osnd");
        return toast("Ahora es un sticker: muévelo, gíralo y ponle sonido 🔊");
      }
      case "tdel":
        await mutate((p) => { p.texts = p.texts.filter((x) => x !== tx); });
        select(null);
        return undoToast("Texto borrado");
      case "asplit": {
        const a = findSel();
        const cut = st.t - a.start;
        if (cut < 0.2 || a.dur - cut < 0.2) return toast("Mueve el cabezal blanco dentro de la pista para dividirla");
        const b = { ...a, id: uid(), start: st.t, offset: a.offset + cut, dur: a.dur - cut, eq: [...a.eq] };
        await mutate((p) => { a.dur = cut; p.audios.push(b); });
        return toast("Pista dividida ✂");
      }
      case "adup": {
        const a = findSel();
        const b = { ...a, id: uid(), start: a.start + a.dur, eq: [...a.eq] };
        await mutate((p) => p.audios.push(b));
        return select({ type: "audio", id: b.id });
      }
      case "ofront":
      case "oback": {
        const o = findSel();
        await mutate((p) => { p.overlays = p.overlays.filter((x) => x !== o); if (id === "ofront") p.overlays.push(o); else p.overlays.unshift(o); });
        return toast(id === "ofront" ? "Capa al frente" : "Capa al fondo");
      }
      case "odup": {
        const o = findSel();
        const b = { ...o, id: uid(), x: clamp(o.x + 0.05, 0, 1), y: clamp(o.y + 0.05, 0, 1) };
        await mutate((p) => p.overlays.push(b), { rebuild: true });
        return select({ type: "ov", id: b.id });
      }
      case "odel":
        await mutate((p) => { p.overlays = p.overlays.filter((x) => x.id !== st.sel.id); }, { rebuild: true });
        select(null);
        return undoToast("Capa borrada");
      case "adel":
        await mutate((p) => { p.audios = p.audios.filter((x) => x.id !== st.sel.id); });
        select(null);
        return undoToast("Audio borrado");
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
    const a = st.sel?.type === "audio" ? findSel() : null;
    const ov = st.sel?.type === "ov" ? findSel() : null;
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
      case "sticker": {
        const at = clamp(st.t, 0, Math.max(0, T - 0.3));
        const end = Math.min(Math.max(T, at + 1), at + 3);
        const add = (ov) => mutate((p) => p.overlays.push(ov), { rebuild: true }).then(() => select({ type: "ov", id: ov.id }, "omove"));
        const grid = el("div", "st-pickgrid");
        for (const ph of photos.slice(0, 24)) {
          const b = el("button");
          const img = el("img");
          img.src = blobUrl(ph.rendered || ph.blob);
          b.append(img);
          b.addEventListener("click", () => add(newOvPhoto(ph.id, at, end)));
          grid.append(b);
        }
        const mine = myStickers();
        let delMode = false;
        const mineRow = chips(mine.map((m) => [m.id, m.label]), null, (id) => {
          const m = myStickers().find((x) => x.id === id);
          if (!m) return;
          if (delMode) {
            store.set("myStickers", myStickers().filter((x) => x.id !== id));
            return renderPanel();
          }
          const { len, ...d } = m.data;
          const stk = newSticker({ ...structuredClone(d), start: at, end: Math.max(at + 0.3, Math.min(at + (len || 3), Math.max(T, at + 1))) });
          mutate((p) => p.overlays.push(stk), { rebuild: true }).then(() => select({ type: "ov", id: stk.id }, "omove"));
        }, true);
        const ftxt = document.createElement("input");
        ftxt.placeholder = "Escribe un texto para usarlo como sticker";
        ftxt.maxLength = 80;
        const own = document.createElement("input");
        own.placeholder = "Escribe tu texto y toca Agregar";
        own.maxLength = 24;
        return showPanel("Stickers (se agregan en " + fmt(at) + ")",
          ...(mine.length ? [label("💾 Mis stickers"), mineRow,
            btn("Borrar de Mis stickers…", (ev) => { delMode = !delMode; ev.target.textContent = delMode ? "Toca un sticker para borrarlo (toca aquí para terminar)" : "Borrar de Mis stickers…"; }, "btn wide")] : []),
          label("Texto como sticker (muévelo, gíralo y ponle sonido)"),
          ftxt,
          btn("＋ Agregar texto como sticker", () => {
            const t = ftxt.value.trim();
            if (!t) return toast("Escribe el texto");
            add(newSticker({ txt: t, tstyle: "box", start: at, end, y: 0.45, anim: "pop" }));
          }, "btn wide"),
          label("Barra de censura (estilo MOGGED)"),
          chips(BARS.map((t) => [t, "▬ " + t]), null, (t) => add(newSticker({ bar: t, barStyle: "heavy", start: at, end, y: 0.33, rot: -15, anim: "none" })), true),
          own,
          btn("＋ Agregar barra con mi texto", () => {
            const t = own.value.trim();
            if (!t) return toast("Escribe el texto de la barra");
            add(newSticker({ bar: t, barStyle: "heavy", start: at, end, y: 0.33, rot: -15, anim: "none" }));
          }, "btn wide"),
          label("Emojis"),
          chips(EMOJIS.map((e) => [e, e]), null, (e) => add(newSticker({ emoji: e, start: at, end })), true),
          label("Etiquetas"),
          chips(BADGES.map(([t]) => [t, t]), null, (t) => add(newSticker({ badge: t, color: BADGES.find((b) => b[0] === t)[1], start: at, end, y: 0.75, scale: 1 })), true),
          label("Tus fotos como sticker"),
          photos.length ? grid : el("p", "hint", "Sube fotos en la Galería para usarlas como sticker."),
          el("p", "hint", "Mueve el sticker con el dedo sobre el video; con dos dedos lo agrandas y lo giras."));
      }
      case "pip": {
        const at = clamp(st.t, 0, Math.max(0, T - 0.3));
        const add = async (m) => {
          const ov = newOvVideo(m, at);
          await mutate((p) => p.overlays.push(ov), { rebuild: true });
          select({ type: "ov", id: ov.id }, "omove");
          toast("Video superpuesto: muévelo con el dedo sobre la vista previa");
        };
        const lab = el("label", "btn wide primary");
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "video/*";
        inp.hidden = true;
        inp.addEventListener("change", async () => {
          const f = inp.files[0];
          if (!f) return;
          lab.lastChild.textContent = " Importando…";
          try { await add(await importVideo(f)); } catch (err) { toast("No se pudo abrir ese video: " + err.message, 4000); }
        });
        lab.append(inp, document.createTextNode("🎬 Elegir video del teléfono"));
        const list = el("div", "st-pickgrid");
        DB.all("media").then((ms) => {
          for (const m of ms.filter((x) => x.id !== "app-cover" && x.duration).sort((x, y) => y.created - x.created).slice(0, 16)) {
            const b = el("button");
            const img = el("img");
            img.src = m.thumb;
            b.append(img, el("span", "n", fmtTime(m.duration)));
            b.addEventListener("click", () => add(m));
            list.append(b);
          }
        });
        return showPanel("Video sobre video (en " + fmt(at) + ")", lab,
          el("p", "hint", "Ideal para reacciones, tu cara en una esquina mientras explicas, o un video con pantalla verde."),
          label("Videos que ya usaste"), list);
      }
      case "otext": {
        const inp = document.createElement("input");
        inp.maxLength = 24;
        inp.maxLength = ov.txt != null ? 80 : 24;
        inp.value = ov.txt ?? ov.bar ?? ov.badge ?? "";
        inp.addEventListener("input", () => mutate(() => {
          const v = inp.value || " ";
          if (ov.txt != null) ov.txt = v; else if (ov.bar != null) ov.bar = v; else ov.badge = v;
        }, { key: "otx" + ov.id }));
        setTimeout(() => inp.focus(), 50);
        return showPanel("Texto del sticker", inp,
          ov.bar != null ? chips(BARS.map((t) => [t, t]), null, (t) => { inp.value = t; mutate(() => { ov.bar = t; }); }, true) : "");
      }
      case "otstyle":
        return showPanel("Estilo del texto", chips(TSTYLES.filter((x) => x[0] !== "karaoke"), ov.tstyle || "box", (v) => mutate(() => { ov.tstyle = v; }), true));
      case "osnd": {
        const vol = slider("Volumen", 0, 2, 0.05, ov.sound?.volume ?? 1, pct, (v) => { if (ov.sound) mutate(() => { ov.sound.volume = v; }, { key: "osv" + ov.id }); });
        const setSound = async (audioId) => {
          await mutate(() => { ov.sound = audioId ? { audioId, volume: ov.sound?.volume ?? 1 } : undefined; if (!audioId) delete ov.sound; }, { rebuild: true });
          renderPanel();
          if (audioId) { st.t = Math.max(0, ov.start - 0.3); play(); }
        };
        return showPanel("Sonido al aparecer",
          label("Efectos de Mog (libres de derechos)"),
          chips(SFX, null, async (k) => setSound(await sfxAudioId(k)), true),
          audios.length ? label("Tus audios") : "",
          audios.length ? chips(audios.map((a) => [a.id, "♫ " + a.name]), ov.sound?.audioId, setSound, true) : "",
          vol,
          row(btn("▶ Probar", () => { st.t = Math.max(0, ov.start - 0.3); play(); }), btn("Sin sonido", () => setSound(null))),
          el("p", "hint", "El sonido suena justo cuando aparece el sticker. Mueve el sticker en la línea de tiempo y el sonido se mueve con él."));
      }
      case "osave":
        saveMySticker(ov);
        st.tool = null;
        renderTools();
        return showPanel("Guardado en Mis stickers", el("p", "hint", "Encuéntralo en 😀 Stickers → Mis stickers para usarlo en cualquier reel, con su estilo, tamaño, giro y sonido."));
      case "obar":
        return showPanel("Estilo de la barra",
          chips(BAR_STYLES.map(([k, n]) => [k, n]), ov.barStyle || "heavy", (v) => mutate(() => { ov.barStyle = v; }), true),
          el("p", "hint", "Gírala y ponla sobre los ojos arrastrando con un dedo; con dos dedos la agrandas y la inclinas."));
      case "ostk":
        return showPanel("Cambiar sticker",
          chips(EMOJIS.map((e) => [e, e]), ov.emoji, (e) => mutate(() => { ov.emoji = e; delete ov.badge; delete ov.bar; }).then(() => { renderTools(); }), true),
          chips(BADGES.map(([t]) => [t, t]), ov.badge, (t) => mutate(() => { ov.badge = t; ov.color = BADGES.find((b) => b[0] === t)[1]; delete ov.emoji; delete ov.bar; }).then(renderTools), true));
      case "omove": {
        const sl = (lab, min, max, step, key, show) => slider(lab, min, max, step, ov[key], show, (v) => mutate(() => { ov[key] = v; }, { key: key + ov.id }));
        return showPanel("Tamaño, giro y posición",
          sl("Tamaño", 0.15, 6, 0.01, "scale", (v) => Math.round(v * 100) + "%"),
          sl("Giro", -180, 180, 1, "rot", (v) => Math.round(v) + "°"),
          sl("Horizontal", 0, 1, 0.01, "x", pct),
          sl("Vertical", 0, 1, 0.01, "y", pct),
          chips([["0.22,0.2", "↖"], ["0.78,0.2", "↗"], ["0.5,0.5", "Centro"], ["0.22,0.78", "↙"], ["0.78,0.78", "↘"]], null, (v) => {
            const [x, y] = v.split(",").map(Number);
            mutate(() => { ov.x = x; ov.y = y; }).then(renderPanel);
          }),
          el("p", "hint", "También puedes arrastrarlo con un dedo sobre el video y pellizcar con dos para agrandar y girar."));
      }
      case "oanim":
        return showPanel("Animación", chips(OANIMS, ov.anim, (v) => mutate(() => { ov.anim = v; }).then(() => { st.t = ov.start; play(); }), true));
      case "oshape": {
        const l = el("label", "check row");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = ov.border;
        cb.addEventListener("change", () => mutate(() => { ov.border = cb.checked; }));
        l.append(cb, document.createTextNode(" Borde blanco"));
        return showPanel("Forma", chips(SHAPES, ov.shape, (v) => mutate(() => { ov.shape = v; })), l);
      }
      case "oopa":
        return showPanel("Opacidad", slider("Opacidad", 0.1, 1, 0.01, ov.opacity, pct, (v) => mutate(() => { ov.opacity = v; }, { key: "oo" + ov.id })));
      case "otrim":
        return showPanel("Recortar video superpuesto",
          slider("Inicio", 0, Math.max(0.2, ov.srcDur - 0.3), 0.05, ov.trimStart, secs, (v) => mutate(() => { ov.trimStart = Math.min(v, ov.trimEnd - 0.3); }, { key: "ots" + ov.id })),
          slider("Fin", 0.3, ov.srcDur, 0.05, ov.trimEnd, secs, (v) => mutate(() => { ov.trimEnd = Math.max(v, ov.trimStart + 0.3); }, { key: "ote" + ov.id })),
          el("p", "hint", "También puedes arrastrar las asas blancas del bloque en la línea de tiempo."));
      case "ovol": {
        const l = el("label", "check row");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = ov.muted;
        cb.addEventListener("change", () => mutate(() => { ov.muted = cb.checked; }));
        l.append(cb, document.createTextNode(" Silenciar este video"));
        return showPanel("Volumen", slider("Volumen", 0, 2, 0.05, ov.volume, pct, (v) => mutate(() => { ov.volume = v; }, { key: "ov" + ov.id })), l);
      }
      case "ochroma": {
        const l = el("label", "check row");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = ov.chroma;
        cb.addEventListener("change", () => mutate(() => { ov.chroma = cb.checked; if (cb.checked) ov.shape = "rect"; }));
        l.append(cb, document.createTextNode(" Quitar el fondo verde"));
        return showPanel("Pantalla verde", l,
          el("p", "hint", "Graba frente a una pared o tela verde bien iluminada. Mog borra el verde y deja solo a la persona encima de tu reel."));
      }
      case "ocolor":
        return showPanel("Color de la etiqueta",
          chips(COLORS.map((c) => [c, "●"]), ov.color, (v) => mutate(() => { ov.color = v; }), true));
      case "aadd": {
        const at = clamp(st.t, 0, Math.max(0, T - 0.1));
        const add = async (src, ref) => {
          const tmp = newAudioBlock(src, ref, at, 1);
          const e = await loadBuf(tmp);
          if (!e) return toast("No se pudo leer ese audio");
          const room = T - at;
          tmp.dur = Math.max(0.3, room > 0.5 ? Math.min(e.buf.duration, room) : e.buf.duration);
          await mutate((p) => p.audios.push(tmp), { rebuild: true });
          select({ type: "audio", id: tmp.id }, "avol");
          toast("Audio agregado en " + fmt(at));
        };
        return showPanel("Agregar audio en el cabezal (" + fmt(at) + ")",
          audios.length
            ? chips(audios.map((x) => [x.id, "♫ " + x.name]), null, (v) => add("audio", v), true)
            : el("p", "hint", "Aún no tienes audios. Súbelos en la pestaña Audio (canciones, notas de voz o el audio de un video)."),
          btn("🎙 Grabar voz en off", () => { st.tool = "rec"; renderTools(); renderPanel(); }, "btn wide"),
          el("p", "hint", "Puedes poner varias pistas a la vez (música + voz + efectos). Para sacar el audio de un video de la línea de tiempo, tócalo y usa ⇣♫ Separar audio."),
          el("p", "hint", "💡 Para monetizar, usa música propia o libre de derechos. Las canciones de moda agrégalas desde la app (TikTok, Instagram…) al publicar."));
      }
      case "rec": {
        const status = el("p", "hint", "Se reproduce el reel sin sonido mientras grabas, para que hables al ritmo de las imágenes. Usa audífonos si puedes.");
        const go = btn(st.rec ? "■ Detener grabación" : "● Grabar desde " + fmt(st.t), () => (st.rec ? stopRecording() : startRecording(status)), "btn wide primary rec-btn");
        return showPanel("Voz en off", go, status);
      }
      case "avol":
        return showPanel("Volumen",
          slider("Volumen", 0, 2, 0.05, a.volume, pct, (v) => mutate(() => { a.volume = v; }, { key: "av" + a.id })),
          (() => {
            const l = el("label", "check row");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = a.loop;
            cb.addEventListener("change", () => mutate(() => {
              a.loop = cb.checked;
              if (!a.loop) a.dur = Math.min(a.dur, srcDur(a) - a.offset);
              else if (a.dur < T - a.start) a.dur = Math.max(a.dur, T - a.start);
            }));
            l.append(cb, document.createTextNode(" 🔁 Repetir hasta llenar el reel"));
            return l;
          })(),
          (() => {
            const vids = st.p.clips.filter((x) => x.kind === "video");
            return vids.length ? slider("Audio de videos", 0, 2, 0.05, vids[0].volume, pct, (v) => mutate(() => vids.forEach((x) => { x.volume = v; }), { key: "ov" })) : "";
          })(),
          btn("▶ Escuchar desde esta pista", () => { st.t = a.start; play(); }, "btn wide"));
      case "afade":
        return showPanel("Fundidos (entrada y salida suave)",
          slider("Entrada", 0, 5, 0.1, a.fadeIn, secs, (v) => mutate(() => { a.fadeIn = v; }, { key: "afi" + a.id })),
          slider("Salida", 0, 5, 0.1, a.fadeOut, secs, (v) => mutate(() => { a.fadeOut = v; }, { key: "afo" + a.id })),
          btn("▶ Escuchar", () => { st.t = a.start; play(); }, "btn wide"));
      case "afx":
        return showPanel("Efecto de sonido",
          chips(FX, a.fx, (v) => mutate(() => { a.fx = v; }).then(() => { st.t = Math.max(a.start, Math.min(st.t, a.start + a.dur - 1)); play(); }), true),
          el("p", "hint", "Eco y Sala para voces dramáticas, Teléfono y Radio para efectos, Bajo el agua para transiciones, Lo-fi para música relajada."));
      case "aeq": {
        const sl = [];
        const set = (i) => (v) => mutate(() => { a.eq = [...(a.eq || [0, 0, 0])]; a.eq[i] = v; }, { key: "eq" + i + a.id });
        const db = (v) => (v > 0 ? "+" : "") + Math.round(v) + " dB";
        sl.push(slider("Graves", -12, 12, 1, a.eq[0], db, set(0)), slider("Medios", -12, 12, 1, a.eq[1], db, set(1)), slider("Agudos", -12, 12, 1, a.eq[2], db, set(2)));
        return showPanel("Ecualizador",
          chips(EQ_PRESETS, (a.eq || []).join(","), (v) => mutate(() => { a.eq = v.split(",").map(Number); }).then(renderPanel), true),
          ...sl,
          btn("▶ Escuchar", () => { st.t = Math.max(a.start, Math.min(st.t, a.start + a.dur - 1)); play(); }, "btn wide"));
      }
      case "abeat": {
        const e = bufOf(a);
        const info = el("p", "hint", e?.beats ? `Ritmo: ${e.beats.bpm} BPM · golpes marcados en amarillo sobre la pista.` : "Mog busca los golpes de la música para que tus fotos cambien al ritmo.");
        const fit = (k) => {
          const b = detectBeats(e);
          const photos = st.p.clips.filter((c) => c.kind === "photo");
          if (!photos.length) return toast("Este reel no tiene fotos para ajustar");
          const step = b.period * k;
          // la pista empieza justo en un golpe para que los cortes coincidan
          const first = b.times.find((t) => t >= a.offset - 0.001) ?? a.offset;
          mutate((p) => {
            photos.forEach((c) => { c.dur = step; });
            a.offset = first;
            a.start = 0;
            const newT = p.clips.reduce((s, c) => s + clipDur(c), 0);
            if (!a.loop) a.dur = Math.min(srcDur(a) - a.offset, Math.max(a.dur, newT));
            else a.dur = Math.max(a.dur, newT);
          }).then(() => { toast(`Fotos al ritmo: cada ${step.toFixed(2)} s ✓`); st.t = 0; play(); });
        };
        return showPanel("Ritmo (beat sync)",
          btn(e?.beats ? "✓ Ritmo detectado" : "🥁 Detectar ritmo", () => { if (!e) return; detectBeats(e); renderTimeline(); renderPanel(); }, "btn wide"),
          info,
          e?.beats ? label("Cambiar de foto en cada…") : "",
          e?.beats ? chips([[1, "Golpe"], [2, "2 golpes"], [4, "4 golpes (compás)"]], null, fit, true) : "",
          e?.beats ? el("p", "hint", "Al arrastrar bloques, sus bordes se imantan a los golpes amarillos.") : "");
      }
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
      // todas las pistas de audio del reel (canciones, voz en off, audio separado)
      for (const a of st.p.audios) {
        const rec = await DB.get(a.src === "audio" ? "audios" : "media", a.ref);
        if (!rec) continue;
        let buf;
        try { buf = await off.decodeAudioData(await rec.blob.arrayBuffer()); } catch { continue; }
        const src = off.createBufferSource();
        src.buffer = buf;
        src.loop = !!a.loop;
        if (a.loop) { src.loopStart = (rec.start || 0) + a.offset; src.loopEnd = rec.end || buf.duration; }
        src.connect(off.destination);
        src.start(a.start, (rec.start || 0) + a.offset, a.loop ? undefined : a.dur);
        if (a.loop) src.stop(a.start + a.dur);
        any = true;
      }
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
    if (source !== "music") {
      for (const o of st.p.overlays) {
        if (o.kind !== "video" || o.muted || o.volume <= 0) continue;
        let buf = decoded16k.get(o.src);
        if (buf === undefined) {
          const m = await DB.get("media", o.src);
          try { buf = m ? await off.decodeAudioData(await m.blob.arrayBuffer()) : null; } catch { buf = null; }
          decoded16k.set(o.src, buf);
        }
        if (!buf) continue;
        const src = off.createBufferSource();
        src.buffer = buf;
        src.connect(off.destination);
        src.start(o.start, o.trimStart, Math.max(0.05, o.trimEnd - o.trimStart));
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
      if (!audio) return say(subOpts.source === "music" ? "Este reel no tiene pistas de audio." : "Tus clips no tienen voz: agrega un video con audio o elige “Letra de la música”.");
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
    if (!hasVoice && st.p.audios.length) subOpts.source = "music";
    const count = st.p.texts.filter((t) => t.sub).length;
    const status = el("p", "hint", count ? `Este reel tiene ${count} subtítulos.` : "");
    const go = btn(count ? "✨ Volver a generar" : "✨ Generar subtítulos", () => generateSubs((t) => (status.textContent = t), go), "btn wide primary");
    const set = (k, after) => (v) => { subOpts[k] = v; saveSubOpts(); after?.(v); };
    return showPanel("Subtítulos automáticos",
      el("p", "hint", "Mog escucha el audio y escribe los subtítulos con su tiempo. Todo pasa en tu teléfono: la primera vez descarga el modelo de voz y luego funciona sin internet."),
      go, status,
      label("¿Qué transcribir?"),
      chips([["voice", "🎙 Voz de los videos"], ["music", "♫ Pistas de audio (letra o voz en off)"]], subOpts.source, set("source"), true),
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

  /* ---------------- Encuadre: recortar el marco como una imagen ---------------- */

  const cropSt = { target: null, e: null, d: null, ratio: "free", src: null };
  const CROP_RATIOS = [["free", "Libre"], ["orig", "Original"], ["reel", "Pantalla del reel"], ["9:16", "9:16"], ["1:1", "1:1"], ["4:5", "4:5"], ["3:4", "3:4"], ["16:9", "16:9"]];

  async function openCrop(target) {
    if (!target) return;
    const e = st.els.get(target.id);
    if (!e) return toast("Este clip todavía no cargó");
    // ir a un cuadro del clip para verlo
    const o = st.L.find((x) => x.c === target);
    if (o && (st.t < o.start || st.t >= o.end)) st.t = o.start + Math.min(0.5, o.d / 2);
    if (!o && target.start != null && (st.t < target.start || st.t >= ovEnd(target))) st.t = target.start + 0.05;
    syncVideos(st.t);
    await waitSeeks();
    cropSt.target = target;
    cropSt.e = e;
    cropSt.d = { crop: { ...(target.crop || { x: 0, y: 0, w: 1, h: 1 }) }, rot90: target.rot90 || 0, flip: !!target.flip };
    cropSt.ratio = "free";
    renderCropRatios();
    openSheet("#cropSheet");
    requestAnimationFrame(drawCrop);
  }

  function renderCropRatios() {
    const box = $("#cropRatios");
    box.innerHTML = "";
    for (const [k, label] of CROP_RATIOS) {
      const b = el("button", k === cropSt.ratio ? "on" : "", label);
      b.addEventListener("click", () => { cropSt.ratio = k; applyRatio(); renderCropRatios(); });
      box.append(b);
    }
  }

  // relación ancho/alto en unidades normalizadas (0..1) del cuadro girado
  function ratioN() {
    const s = cropSt.src;
    if (!s || cropSt.ratio === "free") return null;
    let R;
    if (cropSt.ratio === "orig") R = s.FW / s.FH;
    else if (cropSt.ratio === "reel") R = F().w / F().h;
    else { const [a, b] = cropSt.ratio.split(":").map(Number); R = a / b; }
    return (R * s.FH) / s.FW;
  }

  function applyRatio() {
    const rn = ratioN();
    const c = cropSt.d.crop;
    if (rn) {
      let w = Math.min(1, rn), h = w / rn;
      if (h > 1) { h = 1; w = rn; }
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      c.w = w; c.h = h;
      c.x = clamp(cx - w / 2, 0, 1 - w);
      c.y = clamp(cy - h / 2, 0, 1 - h);
    }
    placeCropBox();
  }

  function drawCrop() {
    const s = frameSource(cropSt.e, { rot90: cropSt.d.rot90, flip: cropSt.d.flip });
    if (!s) return;
    cropSt.src = s;
    const stage = $("#cropStage").getBoundingClientRect();
    const k = Math.min((stage.width - 32) / s.FW, (stage.height - 32) / s.FH);
    const frame = $("#cropFrame");
    frame.style.width = Math.round(s.FW * k) + "px";
    frame.style.height = Math.round(s.FH * k) + "px";
    const cvs = $("#cropCv");
    const dpr = Math.min(2, devicePixelRatio || 1);
    cvs.width = Math.round(s.FW * k * dpr);
    cvs.height = Math.round(s.FH * k * dpr);
    cvs.getContext("2d").drawImage(s.img, 0, 0, s.FW, s.FH, 0, 0, cvs.width, cvs.height);
    placeCropBox();
  }

  function placeCropBox() {
    const c = cropSt.d.crop;
    Object.assign($("#cropBox").style, { left: c.x * 100 + "%", top: c.y * 100 + "%", width: c.w * 100 + "%", height: c.h * 100 + "%" });
  }

  // mover el recuadro o redimensionarlo desde una esquina
  $("#cropBox").addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    const corner = ev.target.dataset?.c || null;
    const fr = $("#cropFrame").getBoundingClientRect();
    const c0 = { ...cropSt.d.crop };
    const x0 = ev.clientX, y0 = ev.clientY;
    const node = ev.target;
    try { node.setPointerCapture(ev.pointerId); } catch {}
    const MIN = 0.05;
    const mv = (e) => {
      const dx = (e.clientX - x0) / fr.width, dy = (e.clientY - y0) / fr.height;
      const c = cropSt.d.crop;
      if (!corner) {
        c.x = clamp(c0.x + dx, 0, 1 - c0.w);
        c.y = clamp(c0.y + dy, 0, 1 - c0.h);
      } else {
        // esquina fija = la opuesta
        const ax = corner.includes("l") ? c0.x + c0.w : c0.x;
        const ay = corner.includes("t") ? c0.y + c0.h : c0.y;
        let px = clamp((corner.includes("l") ? c0.x : c0.x + c0.w) + dx, 0, 1);
        let py = clamp((corner.includes("t") ? c0.y : c0.y + c0.h) + dy, 0, 1);
        let w = Math.max(MIN, Math.abs(px - ax)), h = Math.max(MIN, Math.abs(py - ay));
        const rn = ratioN();
        if (rn) {
          if (w / h > rn) w = h * rn; else h = w / rn;
          const maxW = corner.includes("l") ? ax : 1 - ax, maxH = corner.includes("t") ? ay : 1 - ay;
          if (w > maxW) { w = maxW; h = w / rn; }
          if (h > maxH) { h = maxH; w = h * rn; }
        }
        c.w = w; c.h = h;
        c.x = corner.includes("l") ? ax - w : ax;
        c.y = corner.includes("t") ? ay - h : ay;
      }
      placeCropBox();
    };
    const up = () => { node.removeEventListener("pointermove", mv); node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", up); };
    node.addEventListener("pointermove", mv);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  });

  $("#cropRot").addEventListener("click", () => {
    cropSt.d.rot90 = (cropSt.d.rot90 + 90) % 360;
    cropSt.d.crop = { x: 0, y: 0, w: 1, h: 1 };
    drawCrop();
    applyRatio();
  });
  $("#cropFlip").addEventListener("click", () => {
    cropSt.d.flip = !cropSt.d.flip;
    const c = cropSt.d.crop;
    c.x = 1 - c.x - c.w;
    drawCrop();
  });
  $("#cropReset").addEventListener("click", () => {
    cropSt.d = { crop: { x: 0, y: 0, w: 1, h: 1 }, rot90: 0, flip: false };
    cropSt.ratio = "free";
    renderCropRatios();
    drawCrop();
  });
  $("#cropOk").addEventListener("click", async () => {
    const t = cropSt.target, d = cropSt.d;
    const full = d.crop.x < 0.001 && d.crop.y < 0.001 && d.crop.w > 0.999 && d.crop.h > 0.999;
    closeSheet($("#cropSheet"));
    $("#studio").hidden = false;
    document.body.style.overflow = "hidden";
    await mutate(() => {
      if (full) delete t.crop; else t.crop = { x: +d.crop.x.toFixed(4), y: +d.crop.y.toFixed(4), w: +d.crop.w.toFixed(4), h: +d.crop.h.toFixed(4) };
      if (d.rot90) t.rot90 = d.rot90; else delete t.rot90;
      if (d.flip) t.flip = true; else delete t.flip;
    });
    // el cuadro girado en caché se recalcula
    if (cropSt.e) cropSt.e.rcKey = null;
    toast(full && !d.rot90 && !d.flip ? "Encuadre original" : "Encuadre aplicado ⛶");
  });

  /* ---------------- Voz en off (micrófono) ---------------- */

  async function startRecording(status) {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast("Este teléfono no permite grabar aquí");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      status.textContent = "Mog necesita permiso para usar el micrófono. Actívalo y vuelve a intentarlo.";
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    ensureAudio();
    st.master.gain.value = 0; // el reel se ve pero no se oye mientras grabas
    st.rec = { rec, stream, chunks, startT: st.t, t0: performance.now() };
    rec.start(200);
    if (st.L.length && st.t < total() - 0.1) play();
    renderPanel();
    st.rec.timer = setInterval(() => {
      const b = document.querySelector(".rec-btn");
      if (b && st.rec) b.textContent = "■ Detener · " + ((performance.now() - st.rec.t0) / 1000).toFixed(1) + " s";
    }, 200);
  }

  function abortRecording() {
    const r = st.rec;
    if (!r) return null;
    st.rec = null;
    clearInterval(r.timer);
    st.master.gain.value = 1;
    return r;
  }

  async function stopRecording() {
    const r = abortRecording();
    if (!r) return;
    const done = new Promise((res) => (r.rec.onstop = res));
    r.rec.stop();
    await done;
    r.stream.getTracks().forEach((t) => t.stop());
    pause();
    const blob = new Blob(r.chunks, { type: r.rec.mimeType || "audio/webm" });
    if (blob.size < 2000) { toast("La grabación quedó vacía"); return renderPanel(); }
    const n = audios.filter((x) => /^Voz en off/.test(x.name)).length + 1;
    const id = uid();
    await DB.put("audios", { id, name: "Voz en off " + n, blob, created: Date.now() });
    await refreshAudios();
    const a = newAudioBlock("audio", id, r.startT, 1, { rec: true });
    const e = await loadBuf(a);
    if (!e) { toast("No se pudo leer la grabación"); return renderPanel(); }
    a.dur = e.buf.duration;
    await mutate((p) => p.audios.push(a), { rebuild: true });
    select({ type: "audio", id: a.id });
    toast("Voz en off agregada 🎙 (también quedó en tu pestaña Audio)");
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
    migrateProject(p);
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
    for (const o of p.overlays) if (o.kind !== "sticker") await loadEl(o);
    await ensureBufs();
    await changed(false);
    st.hist = [];
    $("#stUndo").disabled = $("#stRedo").disabled = true;
  }

  function closeStudio(refresh = true) {
    if (!st.p) return;
    if ($("#undoBar")) $("#undoBar").hidden = true;
    const r = abortRecording();
    if (r) { try { r.rec.stop(); } catch {} r.stream.getTracks().forEach((t) => t.stop()); }
    pause();
    st.bufs.clear();
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
    if (audioId) p.audios.push(newAudioBlock("audio", audioId, 0, T, { volume: 0.9, fadeIn: 1.5, fadeOut: 1.5, loop: true }));
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
    stopAudios();
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
