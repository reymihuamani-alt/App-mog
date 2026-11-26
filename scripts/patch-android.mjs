// Ajustes al proyecto Android generado por Capacitor: íconos y permisos de alarma.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const RES = "android/app/src/main/res";

// Íconos de la app (PNG simples) y el ícono blanco de la barra de notificaciones.
cpSync("android-res", RES, { recursive: true });
rmSync(`${RES}/mipmap-anydpi-v26`, { recursive: true, force: true });

const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = readFileSync(manifestPath, "utf8");
const perms = [
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />',
  '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />',
  '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
];
for (const p of perms) {
  const name = p.match(/android:name="([^"]+)"/)[1];
  if (!manifest.includes(`"${name}"`)) manifest = manifest.replace("</manifest>", `    ${p}\n</manifest>`);
}
// Mostrar la alarma sobre la pantalla de bloqueo al abrir la app desde la notificación.
if (!manifest.includes("android:showWhenLocked")) {
  manifest = manifest.replace(/<activity\b/, '<activity\n            android:showWhenLocked="true"\n            android:turnScreenOn="true"');
}
writeFileSync(manifestPath, manifest);
// Firma fija (ci/debug.keystore): cada APK nuevo se instala encima del anterior sin borrar datos.
const gradlePath = "android/app/build.gradle";
let gradle = readFileSync(gradlePath, "utf8");
if (!gradle.includes("ci/debug.keystore")) {
  gradle = gradle.replace(/android\s*\{/, `android {
    signingConfigs {
        debug {
            storeFile file("../../ci/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }`);
  if (!gradle.includes("ci/debug.keystore")) throw new Error("no se pudo configurar la firma");
  writeFileSync(gradlePath, gradle);
}

if (!existsSync(`${RES}/drawable/ic_stat_mog.png`)) throw new Error("falta ic_stat_mog.png");
console.log("Proyecto Android ajustado");
