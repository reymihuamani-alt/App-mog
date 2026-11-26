# Mog — galería de frases

App móvil (PWA) para subir fotos y ponerles frases con el estilo de los videos de autocuidado:

- **Barra blanca**: franja clara arriba con texto negro grueso (“¿Tomas suficiente agua?”).
- **Rojo B/N**: foto en blanco y negro con texto rojo en mayúsculas al centro (“¿TE AMAS MÁS QUE AYER?”).
- **Texto blanco**: texto blanco con borde negro abajo.

## 🎬 Reels (editor de video)
Pestaña **Reels**: editor tipo CapCut para crear videos para TikTok, Instagram Reels, YouTube Shorts y Facebook Reels.
- Formatos: 9:16 (TikTok, Reels, Shorts, Facebook), 4:5 (feed de Instagram), 1:1 y 16:9 (YouTube).
- Línea de tiempo con cabezal fijo: clips de fotos y videos, capa de textos y pista de música.
- Clips: dividir, recortar, duración, velocidad (0.25x–3x), volumen, filtros, movimiento (zoom / paneo), llenar o encajar con fondo difuminado, duplicar, reordenar.
- Transiciones: fundido, a negro, deslizar, zoom, flash, desenfoque y giro.
- Textos: 7 estilos (caja, barra, rojo, blanco, amarillo, neón, simple), animaciones, tamaño, posición y tiempo.
- **Audio a fondo:** varias pistas a la vez con forma de onda (música, voz en off grabada con el micrófono, audio separado
  de un video), volumen, repetir, fundidos de entrada/salida, efectos (eco, sala, teléfono, radio, bajos, brillo, lo-fi,
  bajo el agua), ecualizador de 3 bandas con preajustes, dividir y duplicar, y ritmo: detecta los golpes (BPM) y
  ajusta las fotos para que cambien al compás.
- **Movimiento libre:** toca un bloque y arrástralo (clips se reordenan; textos y audios cambian de momento); las asas
  blancas recortan o alargan; los bordes se imantan al cabezal, a los cortes y a los golpes del ritmo.
- **Stickers:** emojis, etiquetas (SÍGUEME, LINK EN BIO, PARTE 2…) y tus fotos, con animaciones (pop, rebote, latido, flotar, girar, vibrar).
- **Video sobre video:** reacciones o tu cara en una esquina; forma rectangular, redondeada o círculo, borde, opacidad, volumen,
  recorte y quitar fondo verde (pantalla verde). Las capas se mueven con un dedo sobre la vista previa y se agrandan/giran con dos.
- **Subtítulos automáticos (CC):** Whisper reconoce la voz en el propio teléfono (sin clave ni costo; el modelo de 41–77 MB
  se descarga una sola vez). Español, inglés, portugués o detección automática; estilos karaoke, amarillo, blanco, caja y rojo;
  1, 3 o una frase por subtítulo; también puede transcribir la letra de la música.
- Ganchos y llamados a la acción listos, zona segura de cada app, deshacer / rehacer y guardado automático.
- Reel automático: elige fotos y una canción y Mog arma el reel con transiciones al ritmo de la duración.
- Exportar en 720p o 1080p (MP4 cuando el teléfono lo permite), guardar portada, descripción con hashtags (con IA si hay clave) y checklist para poder monetizar.

## Funciones
- Galería: subir varias fotos, editar, guardar, descargar y compartir.
- ✨ Sugerir frase: banco de frases integrado por temas, o frases nuevas con IA (Claude) si pones tu clave en Ajustes.
- Firma tipo marca de agua (`@tu_usuario`).
- Audio: sube canciones o notas de voz, asígnalas a una foto (suena al abrirla) o úsalas como sonido de alarma.
- Recordatorios / alarmas con notificación, vibración, sonido y pantalla de alarma con una de tus fotos. Botón “Posponer 5 min”.
- Funciona sin internet y todo se guarda solo en tu teléfono.

## App de Android (APK) — recomendada
Con el APK las alarmas suenan **aunque Mog esté cerrada** (usa las alarmas del sistema).

- Descarga: https://github.com/reymihuamani-alt/App-mog/releases/download/apk/mog.apk
- GitHub lo vuelve a compilar solo en cada cambio (`.github/workflows/android.yml`).
  Siempre se firma con la misma clave (`ci/debug.keystore`), así cada versión nueva se instala
  encima de la anterior sin borrar tus fotos ni alarmas.
- Compilar a mano: `npm install && npm run android:prepare && cd android && ./gradlew assembleDebug`
  (requiere Java 21 y el SDK de Android).

## Versión web (PWA)
Necesita estar publicada en HTTPS. La forma más fácil es GitHub Pages:
1. En GitHub: **Settings → Pages → Branch** → elige la rama y la carpeta `/ (root)` → Save.
2. Abre el enlace que te da GitHub en el celular.
3. Android (Chrome): menú ⋮ → **Instalar app**. iPhone (Safari): Compartir → **Agregar a inicio**.

Para probar en la computadora: `python3 -m http.server` y abre `http://localhost:8000`.

## Limitaciones
- En la versión web, las alarmas solo suenan con la app abierta. Usa el APK para alarmas con la app cerrada.
- La versión web y el APK guardan sus datos por separado (fotos, audios y alarmas no se pasan solos).
- En iPhone las notificaciones web solo funcionan si la app está agregada a la pantalla de inicio (iOS 16.4+).
