// Copia los archivos de la app web a www/ para empaquetarlos en el APK.
import { cpSync, mkdirSync, rmSync } from "node:fs";

const FILES = ["index.html", "styles.css", "app.js", "studio.js", "studio.css", "subs-worker.js", "phrases.js", "manifest.webmanifest", "icons"];
rmSync("www", { recursive: true, force: true });
mkdirSync("www");
for (const f of FILES) cpSync(f, `www/${f}`, { recursive: true });
console.log("www/ listo");
