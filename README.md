# Volcán Proyecta V3 — Interfaz modernizada

Abre `index.html` con Live Server en VS Code.

La V3 incluye:

- Dashboard completamente rediseñado.
- Fotografías arquitectónicas realistas para los proyectos (cargadas desde Unsplash).
- Nueva jerarquía visual, cards, KPIs, estados y accesos rápidos.
- Configuración con preview fotográfico.
- Editor 2D modernizado.
- Soluciones constructivas y exportación renovadas.
- Funciones del piloto: navegación, drag de mobiliario, guardado local, cálculo referencial, descargas y formularios simulados.

Nota: las fotografías arquitectónicas se cargan desde Internet cuando abres el prototipo.

## Interpretación multimodal opcional

El frontend conserva la interpretación local como fallback y, si detecta el backend, intenta primero la interpretación multimodal. El backend no es necesario para usar Live Server.

Backend:

1. Instala Node.js 18 o superior.
2. Copia `.env.example` como `.env` y define `OPENAI_API_KEY` en ese archivo local. Nunca la pongas en el frontend ni la versiones.
3. Ejecuta `node server.js` dentro de `backend/`.
4. Abre `index.html` con Live Server.

El servicio escucha por defecto en `http://localhost:8787`. Si no está disponible o falla la validación de la respuesta, el navegador usa el intérprete local y lo indica en la revisión. El backend procesa la imagen en memoria y no la almacena.

## V3.1 — Subir e interpretar boceto

Esta versión agrega una función real de piloto que:

1. permite subir JPG/PNG;
2. procesa la imagen localmente en el navegador;
3. detecta líneas oscuras horizontales y verticales;
4. genera una interpretación de muros;
5. muestra una previsualización;
6. permite usar la interpretación como base dentro del editor 2D.

No utiliza una API externa ni envía el boceto a terceros. Es un intérprete geométrico básico para validar la experiencia UX. Para una versión productiva con IA se recomienda reemplazar o complementar este módulo con un modelo multimodal/backend y validación técnica.
