Web: **https://rcolomer3.github.io/TechRadar/** · Acceso con Google mediante Firebase `techradar-4f238`.

# TechRadar

MVP PWA personal independiente. React + Vite + TypeScript; Firestore, Google Authentication y FCM. No depende de WebFinanzas ni BandApp. Repositorio independiente: https://github.com/rcolomer3/TechRadar . Firebase independiente: `techradar-4f238`. El cliente incluye su configuración pública; la cuenta de servicio del resumen diario sigue pendiente.

## Arranque

Node 22.12 o posterior (22 LTS recomendado).

```sh
npm install
npm run dev
```

Abre la URL local indicada por Vite. El cliente se conecta al proyecto TechRadar por defecto. Con `VITE_DEMO=true` en `.env.local` se inicia una demo claramente rotulada: seis tarjetas de interfaz por fecha, sin titulares o eventos ficticios. `npm test` comprueba selección, enlaces, fechas y validación; `npm run build` comprueba TypeScript y genera `dist/`. `npm run preview` sirve esa compilación. PWA necesita HTTPS en producción; localhost es válido para desarrollo.

## Interfaz y alcance

- Hoy: edición correspondiente al día de Madrid, hasta ocho noticias y filtros por categoría. Nunca se presenta ayer como hoy en modo real.
- Anteriores: selector de fecha (las 60 ediciones más recientes).
- Updates: iOS, macOS, Windows y Synology. Datos verificados mediante revisión de fuentes oficiales.
- Eventos: solo fechas confirmadas por la organización. Rumores excluidos.
- Estados de carga, vacío, error con reintento y aviso sin conexión. Navegación móvil inferior y escritorio lateral.
- Google es necesario para suscribir dispositivos; los resúmenes publicados son públicos. Firestore no se usa como almacén de información privada.

## Firebase: configuración explícita

1. Crea un proyecto independiente en Firebase con plan **Spark**. No habilites facturación ni Cloud Functions. Firestore, Authentication con Google y FCM bastan para este MVP. Verifica las cuotas actuales en https://firebase.google.com/pricing . Spark evita cargos de uso; al alcanzar cuotas puede interrumpirse el servicio. GitHub Actions tiene cuotas propias, especialmente en repositorios privados.
2. Registra una app web, crea Firestore (elige región europea antes de crearlo), activa proveedor Google en Authentication y configura dominios autorizados: localhost y tu dominio HTTPS final.
3. Copia `.env.example` a `.env.local` y completa las cinco propiedades públicas del SDK. La clave VAPID pública de TechRadar ya está incluida en `src/firebase-config.ts`. La clave privada permanece en Firebase. `VITE_FIREBASE_VAPID_KEY` permite sobrescribir la pública para otro proyecto; no regeneres el par existente sin planificar la renovación de suscripciones.
4. Estos identificadores web y VAPID pública se distribuyen al navegador por diseño. **Nunca** pongas una cuenta de servicio, clave privada VAPID, token de GitHub o credencial Admin en ninguna variable `VITE_*`, `public/` o archivo versionado. La protección real depende de reglas y permisos, no de ocultar la configuración web.
5. Con Firebase CLI instalada y tu sesión autorizada, desde este repositorio ejecuta:

```sh
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
npm run build
firebase deploy --only hosting
```

Selecciona únicamente el proyecto TechRadar. Espera a que los índices estén listos. Recompila después de cambiar variables. Hosting es opcional: cualquier alojamiento estático HTTPS puede servir `dist/`, conservando `/sw.js`, el manifiesto y fallback a `index.html`.

## Publicación diaria y secretos de servidor

Sube este repositorio a un **repositorio GitHub independiente**. El remoto origin apunta a https://github.com/rcolomer3/TechRadar.git. En Settings → Secrets and variables → Actions crea `FIREBASE_SERVICE_ACCOUNT` con el JSON de una cuenta de servicio del proyecto TechRadar. Se pasa solo al proceso Node de Actions y no se copia al frontend. Limita sus permisos a acceso Firestore y envío FCM (por ejemplo `roles/datastore.user` y `roles/firebasecloudmessaging.admin`); no concedas Owner. Rota y revoca la clave si se expone. Como mejora posterior, sustituir la clave por Workload Identity Federation.

`.github/workflows/daily.yml` usa `0 19 * * *` con `timezone: Europe/Madrid`: ajusta verano/invierno. GitHub ejecuta schedules en la rama por defecto; puede retrasarlos o desactivarlos por inactividad, por lo que **19:00 es la hora objetivo, no una garantía de entrega exacta**. Existe lanzamiento manual desde Actions. Documentación actual: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule .

El proceso descarga RSS de Apple Newsroom, Windows Blog, Firebase y Mozilla. Los hosts permitidos se declaran en `scripts/sources.json`. No sigue instrucciones del contenido. Solo acepta enlaces HTTPS a los hosts de cada fuente, títulos y fecha válida de las últimas 48 horas. Usa extractos de hasta 230 caracteres, limpiando HTML; conserva el idioma original y enlaza la fuente. **No usa una API de IA de pago ni traduce o inventa contenido.** No pretende resumir exhaustivamente un artículo: muestra un extracto atribuido.

Deduplica URL canónica (sin tracking) y título normalizado, incluyendo siete ediciones anteriores. No hace deduplicación semántica entre titulares diferentes. Selecciona hasta ocho por actualidad. Con menos de cinco publica solo las disponibles y marca `belowTarget`; con cero no publica. Si fallan todas las fuentes, falla el job sin publicar. Los errores parciales quedan registrados. Las fuentes RSS pueden cambiar: revisa los fallos de Actions.

Prueba la recopilación sin credenciales ni escritura remota:

```sh
node scripts/daily.mjs --dry-run
```

Resultado en `work/digest-preview.json`, ignorado por Git. La primera ejecución real escribe `digests/YYYY-MM-DD` antes de enviar avisos. Usa creación exclusiva y grupo de concurrencia; los reintentos conservan la edición y consultan un registro de entregas por dispositivo. Una caída después de que FCM acepte un mensaje puede producir un reenvío; el tag de notificación colapsa duplicados visibles. Límite deliberado de 500 dispositivos por ejecución, apropiado para uso personal. Borra tokens rechazados permanentemente. No se envían notificaciones si no existe resumen nuevo.

## Updates y eventos: revisión editorial

`scripts/curated.json` empieza vacío intencionadamente. Las versiones concretas y fechas de evento no se infieren de titulares RSS. Añade entradas únicamente tras consultar el anuncio oficial; el siguiente job las sincroniza con Firestore. Se sincronizan aunque no haya noticias nuevas para el resumen. Esta primera versión no tiene un panel editorial ni scraping automático de versiones.

Ejemplo de **estructura**, sin datos de noticias:

```ts
type Update = {
  platform: 'iOS' | 'macOS' | 'Windows' | 'Synology';
  title: string; summary: string; url: string; publishedAt: string; // ISO UTC
};
type Event = {
  title: string; summary: string; date: string; // YYYY-MM-DD de la fecha anunciada
  url: string; officialHost: string; confirmed: true;
};
```

Hosts de updates validados en `scripts/core.mjs`; eventos requieren hostname oficial explícito revisado. Fuentes sugeridas para revisar: https://support.apple.com/en-us/100100 , https://learn.microsoft.com/en-us/windows/release-health/ , https://www.synology.com/releaseNote/DSM . Actualizar una URL reemplaza su documento; eliminar una entrada del JSON no elimina documentos publicados, que deben retirarse con acceso Admin. No borres evidencia de anuncios históricos por accidente.

## Push e instalación en iPhone

FCM utiliza el service worker propio `/sw.js` y mensajes `data` (sin payload `notification`, para evitar doble aviso). El token se guarda por usuario/dispositivo, con identificador SHA-256. Activa desde el botón después de entrar con Google; Desactivar elimina token local y registro remoto. Reactivar renueva el registro. Cierra sesión después de desactivar avisos si el dispositivo es compartido: cerrar sesión por sí solo no revoca la suscripción del navegador.

En iOS/iPadOS **16.4 o posterior**, abre en Safari → Compartir → Añadir a pantalla de inicio → abre TechRadar desde su icono → entra y pulsa Activar avisos. Debe ser una PWA instalada con `display: standalone`, HTTPS y permiso solicitado mediante interacción directa. Un iPad con identidad de escritorio también se detecta. En otros navegadores se comprueba soporte; permisos denegados se cambian en ajustes del sistema/navegador. Concentración, batería, red o ajustes del sistema pueden impedir o retrasar avisos. La app no promete entrega exacta.

Referencias: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ y https://firebase.google.com/docs/cloud-messaging/web/get-started . Prueba real pendiente con proyecto Firebase, dominio HTTPS y dispositivo compatible. Sin esas credenciales, login y push no se simulan como si funcionaran.

## Modelo y seguridad

`src/models.ts`: `Digest` incluye `date`, `publishedAt`, `status` y array de artículos con título, extracto, fuente, URL y fecha original. Colecciones:

| Ruta | Cliente | Escritura |
| --- | --- | --- |
| `digests/{fecha}` | Lee solo publicados | Admin de Actions |
| `updates/{hashURL}` | Lectura pública | Admin de Actions |
| `events/{hashURL}` | Lee solo confirmados | Admin de Actions |
| `users/{uid}/tokens/{hash}` | Solo propietario autenticado | Propietario, campos limitados y timestamp servidor |
| `deliveries/{fecha-dispositivo}` | Ninguno | Admin de Actions |

Las consultas incluyen filtros de publicación/confirmación para coincidir con reglas. Índices compuestos incluidos. Denegación por defecto de cualquier otra ruta. Admin SDK omite las reglas: proteger la cuenta de servicio es esencial. Tokens privados, nunca retornados como parte del resumen ni impresos por el script. Uso personal; antes de abrir registros al público, añadir control de abuso/App Check, límites por usuario y política de retención. Limpia periódicamente registros de entregas y tokens antiguos con Admin para mantener cuotas.

La PWA almacena shell y assets visitados para abrirse sin conexión; los datos Firestore no tienen persistencia offline activada y requieren red al recargar. No cachea respuestas de autenticación. El acceso al archivo se limita a 60 días en cada carga (sin paginación en este MVP).

## Validación y pendientes para producción

Pruebas unitarias locales no requieren Firebase. La compilación valida tipos. Antes del primer despliegue real, comprobar con Emulator Suite las reglas de dos usuarios (nadie escribe resúmenes, solo el propietario gestiona sus tokens), login en dominio autorizado, indexación, ejecución manual de Actions y recepción push en iOS instalado y escritorio. Sin credenciales estas integraciones no pueden certificarse desde la demo.

Firebase: proyecto independiente `techradar-4f238`, Google Authentication habilitado y Firestore Standard en Madrid (`europe-southwest1`), plan Spark sin facturación. La publicación del resumen diario requiere la credencial de servidor indicada. El código se publica en el repositorio público rcolomer3/TechRadar. Nada de WebFinanzas o BandApp se lee o modifica.

## Publicación web automática

GitHub Pages se publica desde `.github/workflows/pages.yml` al actualizar `main`, con la base `/TechRadar/`. Código público autorizado por el propietario; claves privadas y cuentas de servicio siguen excluidas. El proyecto Firebase usa Google Authentication y Firestore en Madrid. Dominio autorizado: `rcolomer3.github.io`. La sesión de Google se conserva en el navegador hasta cerrar sesión. Para ver la demo local, define `VITE_DEMO=true`. La clave pública VAPID ya está configurada para registrar dispositivos. El envío automático del resumen diario todavía requiere la cuenta de servicio; registrar un dispositivo no activa por sí solo ese envío.
