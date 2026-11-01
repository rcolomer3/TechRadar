# TechRadar

PWA personal React/Vite + Firebase + GitHub Pages. Conserva Google Authentication, apariencia, Updates, Eventos y el historial. No modifica MiBanda ni WebFinanzas.

## Noticias: criterio editorial

Referencia de estilo: tarea «Programar novedades tecnológicas». Prioriza novedades útiles de Apple, inteligencia artificial, tecnología, lanzamientos confirmados y seguridad. Cada noticia se lee completa en su tarjeta: categoría, titular propio, 4–5 frases en español y fuente; el enlace original es secundario.

1. Recopila 12 RSS de medios y fuentes oficiales (`scripts/sources.json`), acepta solo HTTPS y hosts permitidos y mide errores/cobertura por fuente.
2. Extrae el contenido del RSS o del artículo público con Readability, sin ejecutar scripts ni saltar muros de pago. No resume solo titulares. Excluye documentos sin contenido suficiente y noticias de más de 48 horas.
3. Crea una lista por relevancia y diversidad. El modelo selecciona acontecimientos importantes, considerando las últimas 14 ediciones para evitar repetir noticias, además de URL canónica, titular original y tema.
4. Un modelo abierto local redacta en español y respalda el resumen con evidencias del documento. Una segunda revisión del modelo comprueba respaldo, idioma y ausencia de relleno. Hay controles independientes de extensión, idioma, números, citas y duplicados. Estos controles reducen errores, pero no garantizan exactitud total ni equivalencia con ChatGPT.
5. Solo una edición de **5–8 noticias completas y al menos tres fuentes** pasa a `drafts/AAAA-MM-DD`. Nunca se publica un titular en inglés o una edición de una noticia como resumen completo. Si no hay cobertura suficiente, el trabajo falla, registra el motivo y conserva el historial; no inventa contenido ni avisa de una edición inexistente.

Las ediciones antiguas se conservan y se identifican en la interfaz como extractos del formato anterior.

## Horario y avisos

Workflow `.github/workflows/daily.yml`, zona `Europe/Madrid`, con cambios de horario automáticos:

- 18:00: recopilar, redactar y validar un borrador privado. Se adelanta la preparación porque el modelo usa CPU.
- 19:00: validar otra vez y publicar atómicamente en `digests/AAAA-MM-DD`, después enviar el aviso.
- GitHub puede retrasar ejecuciones; no hay garantía del minuto exacto. Si el borrador no está listo, no se envía un aviso falso.

Un registro por fecha/dispositivo se reserva **antes** de enviar a FCM y se comparte entre ejecuciones manuales y programadas. Reintentos no envían un segundo aviso. Ante un error de red ambiguo se registra `uncertain` y no se reintenta automáticamente: se prioriza evitar duplicados, con el riesgo de perder ese aviso. FCM aceptado no demuestra recepción física. El service worker abre `?edition=AAAA-MM-DD`; una notificación antigua abre directamente esa edición en Anteriores.

El historial se conserva en Firestore. La interfaz carga las 60 últimas ediciones; aún no hay paginación para fechas más antiguas.

## Coste y credenciales

No se necesita una API de IA de pago ni una clave adicional para el modo configurado. GitHub Actions ejecuta Ollama y `qwen2.5:7b` en el propio runner estándar Linux del repositorio público; se descarga el modelo en cada preparación, sin cache de pago. No se usa Ollama Cloud. Es más lento y de menor capacidad que ChatGPT: revisar el resultado real antes de dar por buena su calidad. No se promete generar suficiente contenido todos los días.

Requisitos existentes:

- Repositorio **público** y runner **estándar** `ubuntu-latest` para mantener la gratuidad de Actions y Pages. No convertirlo en privado sin revisar cuotas.
- Firebase plan Spark sin facturación: Firestore, Google Authentication y FCM. Agotar una cuota gratuita puede detener el servicio.
- Secreto cifrado de Actions `FIREBASE_SERVICE_ACCOUNT`, ya configurado en el repositorio. Nunca poner el JSON de la cuenta de servicio en Git, en `.env` del frontend ni en un artefacto.
- La configuración pública de Firebase y VAPID está en `src/firebase-config.ts`; los valores `VITE_*` pueden sobrescribirla. Estas claves públicas no sustituyen las reglas de seguridad.

Para una calidad comparable a ChatGPT sería necesario evaluar un modelo más potente. Una API comercial exige una clave privada del proveedor en Actions y autorización expresa de presupuesto; la suscripción de ChatGPT no se utiliza como API. No hay activado ningún servicio de pago.

Referencias: https://docs.github.com/en/actions/reference/runners/github-hosted-runners , https://ollama.com/library/qwen2.5:7b , https://docs.ollama.com/capabilities/structured-outputs , https://firebase.google.com/pricing .

## Ejecutar y validar

```sh
npm ci
npm run dev
npm test
npm run build
```

Firebase está configurado para el proyecto `techradar-4f238`. Para ver ejemplos de interfaz sin iniciar sesión: `VITE_DEMO=true` en `.env.local`. Las tarjetas de demostración se identifican y no contienen noticias ficticias.

Generación local opcional con Ollama instalado y el modelo descargado:

```sh
ollama pull qwen2.5:7b
node scripts/daily.mjs --dry-run
```

`--dry-run` no publica ni envía avisos; si existe la credencial de servidor en el entorno, lee el historial para deduplicar. Sin ella, la prueba no puede comprobar repeticiones remotas. `work/digest-preview.json` contiene la edición y `work/editorial-report.json` el diagnóstico, ignorados por Git.

En GitHub → Actions → Daily radar → Run workflow:

- `preview`: prueba real de fuentes y modelo, sin publicar ni notificar.
- `prepare`: guarda el borrador validado en Firebase.
- `publish`: publica el borrador del día y avisa una vez; no genera ni altera ediciones ya publicadas.

El artefacto editorial-review conserva durante tres días únicamente el resumen procesado y el informe de cobertura; nunca claves, tokens o artículos originales completos. Un fallo de cobertura/calidad es visible como ejecución fallida, no como una edición vacía exitosa.

## Firebase, PWA y seguridad

`firestore.rules` y `firestore.indexes.json` definen el acceso. Clientes no escriben noticias. Solo el propietario autenticado administra sus tokens. `drafts`, `publicationRuns` y `deliveries` quedan privados por denegación por defecto; solo Admin SDK accede. El Admin SDK omite las reglas: proteger el secreto y los permisos de edición del repositorio.

Google Authentication requiere el dominio de Pages autorizado (`rcolomer3.github.io`). HTTPS para web push. En iOS/iPadOS 16.4 o posterior: Safari → Compartir → Añadir a pantalla de inicio → abrir la PWA instalada → iniciar sesión y activar avisos desde Ajustes. Se requiere interacción del usuario para el permiso. Concentración, batería, red y ajustes del sistema pueden impedir la recepción. Cerrar sesión no revoca por sí solo una suscripción del dispositivo.

Updates y Eventos conservan la revisión editorial de `scripts/curated.json`: solo versiones y lanzamientos respaldados por anuncios oficiales; no se inventan. El modo sin conexión almacena la interfaz, no garantiza disponibilidad de noticias remotas.
