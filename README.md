# Mog — galería de frases

App móvil (PWA) para subir fotos y ponerles frases con el estilo de los videos de autocuidado:

- **Barra blanca**: franja clara arriba con texto negro grueso (“¿Tomas suficiente agua?”).
- **Rojo B/N**: foto en blanco y negro con texto rojo en mayúsculas al centro (“¿TE AMAS MÁS QUE AYER?”).
- **Texto blanco**: texto blanco con borde negro abajo.

## Funciones
- Galería: subir varias fotos, editar, guardar, descargar y compartir.
- ✨ Sugerir frase: banco de frases integrado por temas, o frases nuevas con IA (Claude) si pones tu clave en Ajustes.
- Firma tipo marca de agua (`@tu_usuario`).
- Audio: sube canciones o notas de voz, asígnalas a una foto (suena al abrirla) o úsalas como sonido de alarma.
- Recordatorios / alarmas con notificación, vibración, sonido y pantalla de alarma con una de tus fotos. Botón “Posponer 5 min”.
- Funciona sin internet y todo se guarda solo en tu teléfono.

## Cómo usarla en el celular
Necesita estar publicada en HTTPS. La forma más fácil es GitHub Pages:
1. En GitHub: **Settings → Pages → Branch** → elige la rama y la carpeta `/ (root)` → Save.
2. Abre el enlace que te da GitHub en el celular.
3. Android (Chrome): menú ⋮ → **Instalar app**. iPhone (Safari): Compartir → **Agregar a inicio**.

Para probar en la computadora: `python3 -m http.server` y abre `http://localhost:8000`.

## Limitaciones
- Las alarmas suenan mientras la app está abierta o en segundo plano; si el sistema la cierra, no sonará.
  Para alarmas 100% confiables con la app cerrada hay que empaquetarla como app nativa (p. ej. con Capacitor).
- En iPhone las notificaciones web solo funcionan si la app está agregada a la pantalla de inicio (iOS 16.4+).
