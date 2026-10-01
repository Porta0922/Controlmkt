# Guardar una sesión del navegador abierto

Esta extensión local exporta únicamente cookies de la red seleccionada. No envía datos a servicios externos, no solicita contraseñas y no lee cookies de otras redes. Pide acceso a cada red cuando pulsas Guardar. Requiere Chrome o Edge con soporte de extensiones Manifest V3.

1. Abre `chrome://extensions` (Chrome) o `edge://extensions` (Edge).
2. Activa **Modo de desarrollador** y pulsa **Cargar descomprimida**.
3. Selecciona la carpeta `browser-extension` de ControlMKT.
4. En tu pestaña habitual, abre X, Instagram, TikTok o Facebook e inicia sesión normalmente.
5. Pulsa la extensión **ControlMKT — Guardar sesión** y luego **Guardar sesión**. Concede permiso para esa red.
6. Guarda el archivo `x.json`, `instagram.json`, `tiktok.json` o `facebook.json` en `.local/sessions` del proyecto. Puedes crear esa carpeta desde el diálogo Guardar. Si configuraste `SOCIAL_SESSION_DIR`, usa esa carpeta.
7. Vuelve al dashboard y ejecuta el control. No necesitas reiniciar la aplicación para cargar una sesión nueva.

Los archivos permiten acceder a tu cuenta y deben permanecer privados. `.local/` está excluida de Git. No guardes el archivo en la raíz del repositorio. El JSON es compatible con `storageState` de Playwright; no exporta contraseñas, localStorage ni IndexedDB y omite cookies particionadas. Reutilizar cookies puede no bastar si la red requiere otro almacenamiento, una confirmación de acceso o bloquea la extracción. En ventanas de incógnito debes permitir explícitamente la extensión para esa ventana.

El navegador abierto no necesita depuración remota. No se copia ni se descifra la base de datos del perfil. Si la extensión no reconoce la cookie de sesión, no exporta una falsa sesión autenticada.

Referencias: [Cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies) y [permisos opcionales](https://developer.chrome.com/docs/extensions/reference/api/permissions).
