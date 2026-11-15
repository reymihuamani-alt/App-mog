"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const FONT = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';
const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

/* ---------------- Almacenamiento ---------------- */

const DB = (() => {
  let dbp;
  const open = () =>
    (dbp ||= new Promise((res, rej) => {
      const r = indexedDB.open("mog", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("photos", { keyPath: "id" });
        r.result.createObjectStore("audios", { keyPath: "id" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  const run = async (store, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    all: (s) => run(s, "readonly", (o) => o.getAll()),
    get: (s, id) => run(s, "readonly", (o) => o.get(id)),
    put: (s, v) => run(s, "readwrite", (o) => o.put(v)),
    del: (s, id) => run(s, "readwrite", (o) => o.delete(id)),
  };
})();

const store = {
  get(k, d) { try { const v = localStorage.getItem("mog." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("mog." + k, JSON.stringify(v)); } catch {} },
};

const settings = { sig: store.get("sig", ""), apiKey: store.get("apiKey", "") };

/* ---------------- Utilidades ---------------- */

function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

function loadImage(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

const urls = new Set();
function blobUrl(blob) { const u = URL.createObjectURL(blob); urls.add(u); return u; }
function freeUrls() { urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); }

function openSheet(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function closeSheet(el) { el.hidden = true; document.body.style.overflow = ""; }
$$("[data-close]").forEach((b) => b.addEventListener("click", () => {
  const sheet = b.closest(".sheet");
  closeSheet(sheet);
  if (sheet.id === "viewer") player.stop();
}));

/* ---------------- Navegación ---------------- */

const TITLES = { gallery: "Galería", audio: "Audio", alarms: "Alarmas", settings: "Ajustes" };
$$(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    const v = b.dataset.view;
    $$(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
    $$(".view").forEach((x) => x.classList.toggle("active", x.id === "view-" + v));
    $("#title").textContent = TITLES[v];
    $("#fab").hidden = v !== "gallery";
  })
);

/* ---------------- Render de frases (estilo de las imágenes) ---------------- */

function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

function grayscale(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    g = Math.max(0, Math.min(255, (g - 128) * 1.12 + 128));
    p[i] = p[i + 1] = p[i + 2] = g;
  }
  ctx.putImageData(d, 0, 0);
}

/**
 * Dibuja la imagen con la frase.
 * o = { text, style: bar|red|white|none, size (% del ancho), sig, sigOn }
 */
function renderTo(canvas, img, o) {
  const scale = Math.min(1, 1080 / img.naturalWidth);
  const W = Math.round(img.naturalWidth * scale);
  const IH = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  const fs = Math.round((W * o.size) / 100);
  const font = `800 ${fs}px ${FONT}`;
  let text = o.style === "none" ? "" : (o.text || "").trim();
  if (o.style === "red") text = text.toUpperCase();
  ctx.font = font;
  const lines = text ? wrapText(ctx, text, W * 0.86) : [];
  const lh = fs * 1.18;

  if (o.style === "bar") {
    const pad = fs * 0.95;
    const barH = lines.length ? Math.round(lines.length * lh + pad * 2) : 0;
    canvas.width = W;
    canvas.height = IH + barH;
    ctx.fillStyle = "#f3f8f1";
    ctx.fillRect(0, 0, W, barH);
    ctx.drawImage(img, 0, barH, W, IH);
    ctx.font = font;
    ctx.fillStyle = "#0b0b0b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((l, i) => ctx.fillText(l, W / 2, pad + lh * i + lh / 2));
  } else {
    canvas.width = W;
    canvas.height = IH;
    ctx.drawImage(img, 0, 0, W, IH);
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (o.style === "red") {
      grayscale(ctx, W, IH);
      const top = IH * 0.46 - (lines.length * lh) / 2;
      ctx.shadowColor = "rgba(0,0,0,.25)";
      ctx.shadowBlur = fs * 0.15;
      ctx.fillStyle = "#ef3b2d";
      lines.forEach((l, i) => ctx.fillText(l, W / 2, top + lh * i + lh / 2));
      ctx.shadowBlur = 0;
    } else if (o.style === "white") {
      const top = IH - fs * 2.4 - lines.length * lh;
      ctx.lineJoin = "round";
      ctx.lineWidth = fs * 0.16;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#fff";
      lines.forEach((l, i) => {
        const y = top + lh * i + lh / 2;
        ctx.strokeText(l, W / 2, y);
        ctx.fillText(l, W / 2, y);
      });
    }
  }

  if (o.sigOn && o.sig) {
    const sfs = Math.round(W * 0.045);
    ctx.font = `500 ${sfs}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = sfs * 0.3;
    ctx.fillStyle = "#fff";
    ctx.fillText(o.sig, canvas.width - sfs * 0.8, canvas.height - sfs * 0.9);
    ctx.shadowBlur = 0;
  }
}

const canvasBlob = (c) => new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));

/* ---------------- Galería ---------------- */

let photos = [];
let audios = [];

async function refreshGallery() {
  freeUrls();
  photos = (await DB.all("photos")).sort((a, b) => b.created - a.created);
  const grid = $("#grid");
  grid.innerHTML = "";
  for (const p of photos) {
    const b = document.createElement("button");
    b.innerHTML = `<img loading="lazy" alt="">${p.audioId ? '<span class="badge">♫</span>' : ""}`;
    b.querySelector("img").src = blobUrl(p.rendered || p.blob);
    b.addEventListener("click", () => openViewer(p.id));
    grid.append(b);
  }
  $("#galleryEmpty").hidden = photos.length > 0;
}

$("#photoInput").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  let firstId;
  for (const f of files) {
    const id = uid();
    firstId ||= id;
    await DB.put("photos", {
      id, blob: f, rendered: null, text: "", style: "bar", size: 7,
      sigOn: true, audioId: null, created: Date.now() + Math.random(),
    });
  }
  await refreshGallery();
  toast(files.length === 1 ? "Foto subida" : `${files.length} fotos subidas`);
  if (files.length === 1) openEditor(firstId);
});

/* ---------------- Reproductor ---------------- */

const player = {
  el: new Audio(),
  url: null,
  async play(audioId, loop = false) {
    this.stop();
    const a = await DB.get("audios", audioId);
    if (!a) return false;
    this.url = URL.createObjectURL(a.blob);
    this.el.src = this.url;
    this.el.loop = loop;
    try { await this.el.play(); return true; } catch { return false; }
  },
  stop() {
    this.el.pause();
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
  },
};

/* ---------------- Visor ---------------- */

let viewing = null;

async function openViewer(id) {
  viewing = photos.find((p) => p.id === id);
  if (!viewing) return;
  $("#vImg").src = blobUrl(viewing.rendered || viewing.blob);
  $("#vAudio").hidden = !viewing.audioId;
  $("#vAudio").textContent = "▶ Audio";
  openSheet("#viewer");
  if (viewing.audioId) {
    const ok = await player.play(viewing.audioId);
    if (ok) $("#vAudio").textContent = "❚❚ Pausar";
  }
}

$("#vAudio").addEventListener("click", async () => {
  if (!player.el.paused) { player.stop(); $("#vAudio").textContent = "▶ Audio"; }
  else if (await player.play(viewing.audioId)) $("#vAudio").textContent = "❚❚ Pausar";
});
player.el.addEventListener("ended", () => ($("#vAudio").textContent = "▶ Audio"));

$("#vEdit").addEventListener("click", () => {
  player.stop();
  closeSheet($("#viewer"));
  openEditor(viewing.id);
});
$("#vDelete").addEventListener("click", async () => {
  if (!confirm("¿Borrar esta foto?")) return;
  player.stop();
  await DB.del("photos", viewing.id);
  closeSheet($("#viewer"));
  refreshGallery();
});
$("#vShare").addEventListener("click", () => shareBlob(viewing.rendered || viewing.blob, viewing.id));

/* ---------------- Editor ---------------- */

const ed = { rec: null, img: null, opts: null, raf: 0 };

async function openEditor(id) {
  const rec = await DB.get("photos", id);
  if (!rec) return;
  ed.rec = rec;
  ed.img = await loadImage(rec.blob);
  ed.opts = { text: rec.text, style: rec.style, size: rec.size, sigOn: rec.sigOn, sig: settings.sig };
  $("#eText").value = rec.text;
  $("#eSize").value = rec.size;
  $("#eSigOn").checked = rec.sigOn;
  $$("#styleBtns button").forEach((b) => b.classList.toggle("on", b.dataset.style === rec.style));
  fillAudioSelect($("#eAudio"), rec.audioId, "Sin audio");
  $("#aiChips").hidden = true;
  openSheet("#editor");
  draw();
}

function draw() {
  cancelAnimationFrame(ed.raf);
  ed.raf = requestAnimationFrame(() => renderTo($("#canvas"), ed.img, ed.opts));
}

$("#eText").addEventListener("input", (e) => { ed.opts.text = e.target.value; draw(); });
$("#eSize").addEventListener("input", (e) => { ed.opts.size = +e.target.value; draw(); });
$("#eSigOn").addEventListener("change", (e) => {
  ed.opts.sigOn = e.target.checked;
  if (e.target.checked && !settings.sig) toast("Pon tu firma en Ajustes");
  draw();
});
$$("#styleBtns button").forEach((b) =>
  b.addEventListener("click", () => {
    $$("#styleBtns button").forEach((x) => x.classList.toggle("on", x === b));
    ed.opts.style = b.dataset.style;
    draw();
  })
);

$("#eSave").addEventListener("click", async () => {
  renderTo($("#canvas"), ed.img, ed.opts);
  const rendered = await canvasBlob($("#canvas"));
  Object.assign(ed.rec, {
    text: ed.opts.text, style: ed.opts.style, size: ed.opts.size, sigOn: ed.opts.sigOn,
    audioId: $("#eAudio").value || null, rendered,
  });
  await DB.put("photos", ed.rec);
  closeSheet($("#editor"));
  URL.revokeObjectURL(ed.img.src);
  await refreshGallery();
  toast("Guardado ✓");
});

async function currentBlob() {
  renderTo($("#canvas"), ed.img, ed.opts);
  return canvasBlob($("#canvas"));
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mog-${name}.jpg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function shareBlob(blob, name) {
  const file = new File([blob], `mog-${name}.jpg`, { type: "image/jpeg" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch {}
  } else {
    downloadBlob(blob, name);
    toast("Tu navegador no permite compartir: se descargó");
  }
}

$("#eDownload").addEventListener("click", async () => downloadBlob(await currentBlob(), ed.rec.id));
$("#eShare").addEventListener("click", async () => shareBlob(await currentBlob(), ed.rec.id));

/* ---------------- Frases con IA ---------------- */

let topic = Object.keys(PHRASES)[0];

function renderTopics() {
  const box = $("#topics");
  box.innerHTML = "";
  for (const t of Object.keys(PHRASES)) {
    const b = document.createElement("button");
    b.textContent = t;
    b.classList.toggle("on", t === topic);
    b.addEventListener("click", () => { topic = t; renderTopics(); suggest(); });
    box.append(b);
  }
}

function localPhrases(t) {
  const list = [...PHRASES[t]];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, 6);
}

// Llamada directa a la API de Claude desde el navegador, con la clave del propio usuario.
async function claudePhrases(t) {
  const examples = Object.values(PHRASES).flat().slice(0, 12).join(" | ");
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
        "Escribes frases cortas en español para poner sobre fotos, al estilo de TikTok de autocuidado y amor propio: " +
        "directas, de 2 a 10 palabras, muchas veces en forma de pregunta al lector. Ejemplos: " + examples +
        ". Responde solo con 6 frases, una por línea, sin numerar ni comillas.",
      messages: [{ role: "user", content: `Tema: ${t}` }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("La IA no quiso responder a ese tema");
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .split("\n")
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["“]|["”]$/g, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

async function suggest() {
  const out = $("#aiResults");
  out.innerHTML = '<div class="loading">Pensando frases…</div>';
  let list;
  try {
    list = settings.apiKey ? await claudePhrases(topic) : localPhrases(topic);
  } catch (e) {
    toast("IA: " + e.message + " — uso frases integradas", 3500);
    list = localPhrases(topic);
  }
  out.innerHTML = "";
  for (const p of list) {
    const b = document.createElement("button");
    b.textContent = p;
    b.addEventListener("click", () => {
      $("#eText").value = p;
      ed.opts.text = p;
      draw();
    });
    out.append(b);
  }
  const more = document.createElement("button");
  more.className = "btn small";
  more.textContent = "↻ Otras";
  more.style.cssText = "background:var(--surface-2);color:var(--text)";
  more.addEventListener("click", suggest);
  out.append(more);
}

$("#eAi").addEventListener("click", () => {
  const box = $("#aiChips");
  box.hidden = !box.hidden;
  if (!box.hidden) { renderTopics(); suggest(); }
});

/* ---------------- Audio ---------------- */

async function refreshAudios() {
  audios = (await DB.all("audios")).sort((a, b) => b.created - a.created);
  const list = $("#audioList");
  list.innerHTML = "";
  for (const a of audios) {
    const li = document.createElement("li");
    li.innerHTML = `<button class="icon play">▶</button>
      <div class="grow"><div class="name"></div><div class="sub"></div></div>
      <button class="icon del">🗑</button>`;
    li.querySelector(".name").textContent = a.name;
    li.querySelector(".sub").textContent = (a.blob.size / 1048576).toFixed(1) + " MB";
    const playBtn = li.querySelector(".play");
    playBtn.addEventListener("click", async () => {
      const playingThis = !player.el.paused && player.current === a.id;
      $$("#audioList .play").forEach((x) => (x.textContent = "▶"));
      if (playingThis) { player.stop(); return; }
      if (await player.play(a.id)) { player.current = a.id; playBtn.textContent = "❚❚"; }
    });
    li.querySelector(".del").addEventListener("click", async () => {
      if (!confirm(`¿Borrar "${a.name}"?`)) return;
      player.stop();
      await DB.del("audios", a.id);
      refreshAudios();
    });
    list.append(li);
  }
  $("#audioEmpty").hidden = audios.length > 0;
}
player.el.addEventListener("ended", () => $$("#audioList .play").forEach((x) => (x.textContent = "▶")));

$("#audioInput").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  for (const f of files) {
    await DB.put("audios", { id: uid(), name: f.name.replace(/\.[^.]+$/, ""), blob: f, created: Date.now() });
  }
  if (files.length) { await refreshAudios(); toast("Audio subido"); }
});

function fillAudioSelect(sel, value, emptyLabel) {
  sel.innerHTML = "";
  sel.append(new Option(emptyLabel, ""));
  for (const a of audios) sel.append(new Option("♫ " + a.name, a.id));
  sel.value = value || "";
}

/* ---------------- Notificaciones ---------------- */

const notifSupported = "Notification" in window;

function updatePermBox() {
  $("#permBox").hidden = !notifSupported || Notification.permission === "granted";
}

$("#permBtn").addEventListener("click", async () => {
  if (!notifSupported) return toast("Tu navegador no soporta notificaciones");
  const r = await Notification.requestPermission();
  updatePermBox();
  toast(r === "granted" ? "Notificaciones activadas ✓" : "Permiso denegado");
});

async function notify(body) {
  if (!notifSupported || Notification.permission !== "granted") return;
  const opts = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "mog-" + Date.now(), vibrate: [300, 150, 300], requireInteraction: true };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification("Mog", opts);
    new Notification("Mog", opts);
  } catch (e) { console.warn(e); }
}

$("#testNotif").addEventListener("click", async () => {
  if (!notifSupported) return toast("Tu navegador no soporta notificaciones");
  if (Notification.permission !== "granted") await Notification.requestPermission();
  updatePermBox();
  if (Notification.permission === "granted") { notify("¿Tomas suficiente agua?"); toast("Notificación enviada"); }
  else toast("Primero permite las notificaciones");
});

/* ---------------- Alarmas ---------------- */

let alarms = store.get("alarms", []);
let snoozes = store.get("snoozes", []);
const saveAlarms = () => { store.set("alarms", alarms); store.set("snoozes", snoozes); };

function daysText(days) {
  if (days.length === 7) return "Todos los días";
  if (days.join() === "1,2,3,4,5") return "Lunes a viernes";
  if (days.join() === "0,6") return "Fines de semana";
  return days.map((d) => DAY_LABELS[d]).join(" ");
}

function refreshAlarms() {
  const list = $("#alarmList");
  list.innerHTML = "";
  for (const a of [...alarms].sort((x, y) => x.time.localeCompare(y.time))) {
    const li = document.createElement("li");
    li.classList.toggle("off", !a.on);
    li.innerHTML = `<div class="grow"><div class="time"></div><div class="name"></div><div class="sub"></div></div>
      <label class="toggle"><input type="checkbox"><i></i></label>
      <button class="icon del">🗑</button>`;
    li.querySelector(".time").textContent = a.time;
    li.querySelector(".name").textContent = a.text;
    li.querySelector(".sub").textContent = daysText(a.days);
    const tg = li.querySelector("input");
    tg.checked = a.on;
    tg.addEventListener("change", () => { a.on = tg.checked; saveAlarms(); refreshAlarms(); });
    li.querySelector(".grow").addEventListener("click", () => openAlarmSheet(a));
    li.querySelector(".del").addEventListener("click", () => {
      alarms = alarms.filter((x) => x !== a);
      saveAlarms();
      refreshAlarms();
    });
    list.append(li);
  }
  $("#alarmEmpty").hidden = alarms.length > 0;
}

let editingAlarm = null;
let draftDays = [];

function renderDays() {
  const box = $("#aDays");
  box.innerHTML = "";
  [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
    const b = document.createElement("button");
    b.textContent = DAY_LABELS[d];
    b.classList.toggle("on", draftDays.includes(d));
    b.addEventListener("click", () => {
      draftDays = draftDays.includes(d) ? draftDays.filter((x) => x !== d) : [...draftDays, d];
      renderDays();
    });
    box.append(b);
  });
}

function openAlarmSheet(a = null) {
  editingAlarm = a;
  $("#aTime").value = a?.time || "08:00";
  $("#aText").value = a?.text || ALARM_PRESETS[0];
  draftDays = a ? [...a.days] : [0, 1, 2, 3, 4, 5, 6];
  renderDays();
  fillAudioSelect($("#aSound"), a?.audioId, "Bip (predeterminado)");
  const pre = $("#aPresets");
  pre.innerHTML = "";
  for (const p of ALARM_PRESETS) {
    const b = document.createElement("button");
    b.textContent = p;
    b.addEventListener("click", () => ($("#aText").value = p));
    pre.append(b);
  }
  openSheet("#alarmSheet");
}

$("#newAlarmBtn").addEventListener("click", () => openAlarmSheet());

$("#aSave").addEventListener("click", () => {
  if (!draftDays.length) return toast("Elige al menos un día");
  const data = {
    time: $("#aTime").value || "08:00",
    text: $("#aText").value.trim() || ALARM_PRESETS[0],
    days: draftDays.sort(),
    audioId: $("#aSound").value || null,
  };
  if (editingAlarm) Object.assign(editingAlarm, data, { last: null });
  else alarms.push({ id: uid(), on: true, last: null, ...data });
  saveAlarms();
  refreshAlarms();
  closeSheet($("#alarmSheet"));
  toast(`Recordatorio a las ${data.time} ✓`);
  if (notifSupported && Notification.permission === "default") Notification.requestPermission().then(updatePermBox);
});

/* Sonido de alarma */
const beeper = {
  ctx: null, timer: 0,
  start() {
    try {
      this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      this.ctx.resume();
      const beep = () => {
        [0, 0.25].forEach((off) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.25, this.ctx.currentTime + off);
          g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + off + 0.2);
          o.connect(g).connect(this.ctx.destination);
          o.start(this.ctx.currentTime + off);
          o.stop(this.ctx.currentTime + off + 0.2);
        });
      };
      beep();
      this.timer = setInterval(beep, 1200);
    } catch {}
  },
  stop() { clearInterval(this.timer); },
};
// Desbloquea el audio en móviles con el primer toque.
document.addEventListener("pointerdown", () => {
  try { beeper.ctx ||= new (window.AudioContext || window.webkitAudioContext)(); beeper.ctx.resume(); } catch {}
}, { once: true });

let ringing = null;

async function fire(a) {
  notify(a.text);
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  if (ringing) return;
  ringing = a;
  const pick = photos.length ? photos[Math.floor(Math.random() * photos.length)] : null;
  $("#ringImg").hidden = !pick;
  if (pick) $("#ringImg").src = blobUrl(pick.rendered || pick.blob);
  $("#ringTime").textContent = new Date().toTimeString().slice(0, 5);
  $("#ringText").textContent = a.text;
  $("#ring").hidden = false;
  const ok = a.audioId && (await player.play(a.audioId, true));
  if (!ok) beeper.start();
}

function stopRing() {
  beeper.stop();
  player.stop();
  $("#ring").hidden = true;
  ringing = null;
}

$("#ringDone").addEventListener("click", stopRing);
$("#ringSnooze").addEventListener("click", () => {
  const a = ringing;
  snoozes.push({ at: Date.now() + 5 * 60000, text: a.text, audioId: a.audioId });
  saveAlarms();
  stopRing();
  toast("Te aviso en 5 minutos");
});

function tick() {
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  const today = now.toDateString();
  for (const a of alarms) {
    if (a.on && a.time === hhmm && a.days.includes(now.getDay()) && a.last !== today + hhmm) {
      a.last = today + hhmm;
      saveAlarms();
      fire(a);
    }
  }
  const due = snoozes.filter((s) => s.at <= Date.now());
  if (due.length) {
    snoozes = snoozes.filter((s) => s.at > Date.now());
    saveAlarms();
    due.forEach((s) => fire(s));
  }
}
setInterval(tick, 10000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

/* ---------------- Ajustes ---------------- */

function renderSig() { $("#topSig").textContent = settings.sig; }
$("#sigInput").value = settings.sig;
$("#keyInput").value = settings.apiKey;
$("#sigInput").addEventListener("input", (e) => {
  let v = e.target.value.trim();
  if (v && !v.startsWith("@")) v = "@" + v;
  settings.sig = v;
  store.set("sig", v);
  renderSig();
});
$("#keyInput").addEventListener("change", (e) => {
  settings.apiKey = e.target.value.trim();
  store.set("apiKey", settings.apiKey);
  toast(settings.apiKey ? "Clave guardada: frases con IA activadas" : "Clave borrada");
});

/* ---------------- Inicio ---------------- */

(async function init() {
  renderSig();
  updatePermBox();
  await refreshAudios();
  await refreshGallery();
  refreshAlarms();
  tick();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
