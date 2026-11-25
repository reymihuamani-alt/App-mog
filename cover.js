"use strict";
/* Portada de la app: una foto elegida por la persona, editada con el estilo de Mog.
   La foto se guarda solo en este teléfono (IndexedDB), nunca en el repositorio. */
(() => {
  const COVER_ID = "app-cover";
  const STYLES = [["red", "B/N + frase roja"], ["color", "Color"], ["bar", "Barra blanca"]];
  const cfg = Object.assign({ style: "red", title: "MOG", tagline: "¿Te amas más que ayer?", y: 30, splash: true }, store.get("cover", {}));
  const save = () => store.set("cover", cfg);
  let url = null;

  const el = (tag, cls = "", text = "") => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  function compose(box, extraClass = "") {
    box.className = `cover ${extraClass} cover-${cfg.style}`.replace(/\s+/g, " ");
    box.innerHTML = "";
    box.hidden = !url;
    if (!url) return;
    if (cfg.style === "bar" && cfg.tagline) box.append(el("p", "cover-bar-top", cfg.tagline));
    const ph = el("div", "cover-photo");
    const img = el("img");
    img.alt = "";
    img.src = url;
    img.style.objectPosition = `50% ${cfg.y}%`;
    ph.append(img);
    if (cfg.style !== "bar" && cfg.tagline) ph.append(el("p", "cover-tag", cfg.tagline));
    ph.append(el("div", "cover-fade"));
    const t = el("div", "cover-title");
    if (cfg.title) t.append(el("b", "", cfg.title));
    if (settings.sig) t.append(el("span", "", settings.sig));
    ph.append(t);
    box.append(ph);
  }

  function render() {
    compose($("#cover"));
    compose($("#coverPreview"), "cover-mini");
    $("#coverDel").hidden = $("#coverOpts").hidden = !url;
    const box = $("#coverStyles");
    box.innerHTML = "";
    for (const [k, label] of STYLES) {
      const b = el("button", k === cfg.style ? "on" : "", label);
      b.addEventListener("click", () => { cfg.style = k; save(); render(); });
      box.append(b);
    }
  }

  async function load() {
    const rec = await DB.get("media", COVER_ID);
    if (url) URL.revokeObjectURL(url);
    url = rec ? URL.createObjectURL(rec.blob) : null;
    render();
  }

  // Reduce la foto (máx. 1440 px) para que ocupe poco espacio.
  async function shrink(file) {
    const img = await loadImage(file);
    const k = Math.min(1, 1440 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    return new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  }

  $("#coverIn").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      await DB.put("media", { id: COVER_ID, name: "Portada", blob: await shrink(f), created: Date.now() });
      await load();
      toast("Portada lista ✓ Mírala en la Galería");
    } catch {
      toast("No se pudo abrir esa imagen");
    }
  });

  $("#coverDel").addEventListener("click", async () => {
    if (!confirm("¿Quitar la portada?")) return;
    await DB.del("media", COVER_ID);
    await load();
  });

  const bindText = (id, key) => {
    const i = $(id);
    i.value = cfg[key];
    i.addEventListener("input", () => { cfg[key] = i.value.trim(); save(); render(); });
  };
  bindText("#coverTitle", "title");
  bindText("#coverTag", "tagline");
  $("#coverY").value = cfg.y;
  $("#coverY").addEventListener("input", (e) => { cfg.y = +e.target.value; save(); render(); });
  $("#coverSplash").checked = cfg.splash;
  $("#coverSplash").addEventListener("change", (e) => { cfg.splash = e.target.checked; save(); });
  // La firma aparece en la portada: actualizar al cambiarla
  $("#sigInput").addEventListener("input", () => setTimeout(render, 0));

  // Bienvenida al abrir la app
  function splash() {
    if (!url || !cfg.splash) return;
    const s = $("#splash");
    compose($("#splashCover"));
    s.hidden = false;
    const hide = () => {
      s.classList.add("out");
      setTimeout(() => { s.hidden = true; s.classList.remove("out"); }, 450);
    };
    s.addEventListener("click", hide, { once: true });
    setTimeout(hide, 1700);
  }

  load().then(splash);
})();
