# ControlMKT

Next.js App Router, TypeScript, Tailwind y Supabase. Monitoreo de webs estáticas y dinámicas, X/Twitter, Instagram, TikTok y Facebook mediante código local. No usa Apify, APIs de pago ni un LLM externo. Las recomendaciones se calculan con reglas locales.

## Inicio

1. Usa Node.js 22 o posterior y ejecuta `npm install`.
2. Ejecuta `npm run browser:install` para instalar Chromium gratuito. En Linux también necesitas las dependencias del sistema de Playwright (`npx playwright install --with-deps chromium`).
3. Copia `.env.example` a `.env.local` y configura Supabase y un `SESSION_SECRET` aleatorio de al menos 32 caracteres.
4. En el SQL Editor ejecuta, en orden, `supabase/migrations/001_initial.sql` y `supabase/migrations/002_free_social_monitoring.sql`. Si ya ejecutaste la primera, ejecuta solamente la segunda.
5. Ejecuta `npm run dev` y abre http://localhost:3000. Acceso inicial: `admin` / `admin`.

La persistencia conserva Supabase. Puedes usar tu instancia existente o una instalación local con Docker y la CLI de Supabase para evitar depender de un servicio hospedado. No necesitas claves de proveedores de scraping o IA. El equipo donde corre Chromium debe estar encendido durante los controles. Esta versión no instala ni configura Supabase automáticamente.

## Sesiones de redes sociales

Es preferible guardar una sesión del navegador en vez de guardar usuario y contraseña en variables de entorno. Para cada red ejecuta en tu equipo:

Si Chromium no permite iniciar sesión, puedes exportar la sesión que ya tienes abierta en Chrome o Edge con la extensión local incluida en `browser-extension`. Sigue `browser-extension/README.md`: cargar descomprimida, abrir la pestaña de la red, pulsar Guardar y elegir `.local/sessions`. No requiere abrir otro navegador ni habilitar depuración remota. Los archivos privados de sesión no forman parte de los commits.

```powershell
npm run social:login -- instagram
npm run social:login -- x
npm run social:login -- tiktok
npm run social:login -- facebook
```

Cada comando abre Chromium con interfaz. Inicia sesión tú mismo, completa 2FA, vuelve a la terminal y pulsa Enter. El comando guarda cookies y almacenamiento del navegador; no lee ni guarda la contraseña. No ejecutes estos comandos en un servidor sin interfaz.

Los archivos se guardan en `.local/sessions/<red>.json`. La aplicación los carga automáticamente solo para esa red. Sin un archivo intenta consultar la página pública. Si la sesión caduca, repite el comando. No se garantiza que cada red acepte reutilizar una sesión desde otra máquina o dirección IP.

`SOCIAL_SESSION_DIR` configura exclusivamente la carpeta privada donde están los archivos. Estos archivos equivalen a credenciales de acceso: no los compartas ni los subas a Git. `.local/` y `.env.local` están excluidos de Git; si cambias la carpeta, usa una ubicación privada fuera del repositorio. Para un servidor, copia los archivos por un canal seguro y configura esa ruta en el entorno. El navegador utiliza contextos separados por control y no conserva sesiones entre redes.

## Qué se controla

- La plataforma se detecta automáticamente por el dominio de la URL.
- Las webs usan HTTP por defecto. Selecciona “Navegador / JavaScript” para páginas que renderizan su contenido con JavaScript.
- Las redes usan Chromium y extractores propios de HTML renderizado, datos JSON públicos y JSON-LD. X también usa los elementos de publicaciones del DOM.
- Cuando están disponibles se extraen seguidores, seguidos, publicaciones, likes, comentarios, vistas, compartidos y reacciones. Una métrica no encontrada permanece ausente; nunca se convierte en cero.
- Se guarda una muestra de hasta 20 publicaciones cargadas. El primer control crea la referencia. Los siguientes comparan textos y contadores de las mismas publicaciones y del perfil.
- Las publicaciones que salen de la muestra no se clasifican automáticamente como eliminadas. Las muestras vacías y bloqueos tampoco se consideran una cuenta saludable.
- Las recomendaciones indican, según los datos, cambios de seguidores, textos modificados, revisión de publicaciones fuera de muestra o formatos con mayor proporción de likes + comentarios por vista. No infieren horarios óptimos, sentimiento o causalidad sin datos para respaldarlos.
- El informe muestra estadísticas, variaciones, recomendaciones e historial. El CSV exporta el listado y seguidores disponibles.

## Ranking de repercusión

El dashboard reúne la última muestra de cada enlace y permite elegir una red. Si la misma publicación aparece en un perfil y también en una URL directa, se conserva su lectura más reciente y se cuenta una sola vez. Puedes ordenar por interacciones, vistas o tasa por vista y filtrar videos, posts o contenido sin clasificar. Los registros anteriores se pueden usar sin una nueva migración.

Interacciones observadas = likes (o reacciones cuando están disponibles) + comentarios + compartidos. Reacciones reemplaza likes, porque puede incluirlos. Si falta un contador, la suma y la tasa llevan un asterisco de lectura parcial. No es una medida de todas las acciones posibles ni de usuarios únicos. Tasa por vista = interacciones observadas / vistas × 100. Puede superar 100% y solo debe interpretarse según la disponibilidad de datos y dentro de la misma red.

En el informe de un enlace puedes ordenar por crecimiento entre controles y abrir “Ver evolución” para seguir una publicación en el historial disponible. El crecimiento solo compara la misma publicación y los mismos contadores; publicaciones nuevas o métricas que aparecen/desaparecen no generan una variación ficticia. Los valores negativos se conservan como correcciones de contadores. El ranking se exporta a CSV.

Para X, un HTTP 403 ahora se conserva como 403 en el historial y se indica si se cargó una sesión. Ejecuta `npm run social:login -- x` si hace falta iniciar sesión o renovarla. El extractor espera publicaciones, toma una muestra tras desplazarse y observa los datos de las respuestas que la propia página solicita. No fuerza acceso cuando X responde 403. La cobertura real continúa dependiendo de la sesión y de lo que X permita leer.

## Límites de la extracción

La extracción de redes es de mejor esfuerzo: puede fallar por cambios de interfaz, perfiles privados, desafíos de acceso o datos que la red no expone. Una sesión puede ayudar, pero no garantiza todos los contadores. Facebook se apoya en datos JSON públicos y JSON-LD cuando existen; su cobertura será variable. No se usan proxies comerciales, soluciones CAPTCHA ni evasión de restricciones. Los contadores abreviados son aproximados y los cambios pequeños pueden no verse. Esta versión no descarga imágenes ni analiza el contenido de audio/video.

Las frecuencias se guardan como configuración, pero todavía no hay cron o worker que ejecute controles periódicos. No incluye edición de URLs. El historial muestra hasta 100 controles. Las recomendaciones son reglas locales, no respuestas de un modelo generativo.

## Estructura

- `src/lib/browser.ts`: Chromium, sesiones y proxy de salida con validación de IP pública.
- `src/lib/public-url.ts`: validación de destinos y resolución DNS.
- `src/lib/platform.ts`: detección de redes.
- `src/lib/social.ts`: estadísticas, comparación y recomendaciones.
- `src/lib/scan.ts`: selección de HTTP o navegador y extracción.
- `src/lib/analysis.ts`: resultado de controles y estados.
- `scripts/login-social.mjs`: login manual y guardado de sesión.
- `src/app/dashboard.tsx`: formulario, listado, informes y CSV.
- `src/app/api/links/[id]/check`: control y persistencia transaccional; reserva para evitar controles duplicados.
- `supabase/migrations`: esquema, RLS y funciones de persistencia.

## Validación y ejecución

`npm run test` verifica los extractores con muestras controladas, variaciones, recomendaciones y destinos privados. `npm run typecheck` valida TypeScript y `npm run build` compila producción. Las muestras no sustituyen una prueba real con tus cuentas ni confirman compatibilidad permanente con cada red.

El modo completo con navegador está pensado para tu PC o un servidor Node que permita ejecutar Chromium y persistir archivos de sesión. Para ejecutarlo en producción usa `npm run build` y `npm run start`. Un contenedor Linux necesita dependencias de Chromium. El despliegue convencional en Vercel no incluye el binario ni los archivos de sesión; esta versión no configura un despliegue de Chromium en funciones serverless.

El login administrativo es una sesión firmada de ocho horas; no utiliza Supabase Auth. Antes de exponer la aplicación configura una contraseña propia con `ADMIN_PASSWORD`. `SUPABASE_SERVICE_ROLE_KEY` se usa solo en servidor y RLS bloquea el acceso directo de clientes a las tablas.

Referencias: [Playwright: navegadores](https://playwright.dev/docs/browsers), [Supabase local](https://supabase.com/docs/guides/local-development) y [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation).
