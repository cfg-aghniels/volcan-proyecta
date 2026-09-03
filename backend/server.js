const http = require('http');
const { validateArchitecturalModel } = require('./sketchSchema');

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const ALLOWED_IMAGE_PREFIXES = ['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,'];

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'source', 'analysisMode', 'scale', 'perimeter', 'walls', 'doors', 'windows', 'rooms', 'labels', 'dimensions', 'furnitureEvidence', 'warnings', 'confidence'],
  properties: {
    version: { type: 'string', enum: ['1.0'] },
    source: { type: 'object', additionalProperties: false, required: ['type', 'filename', 'width', 'height'], properties: { type: { type: 'string', enum: ['sketch'] }, filename: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' } } },
    analysisMode: { type: 'string', enum: ['multimodal'] },
    scale: { type: 'object', additionalProperties: false, required: ['status', 'metersPerUnit', 'referenceDimensionId'], properties: { status: { type: 'string', enum: ['unknown', 'estimated', 'calibrated'] }, metersPerUnit: { type: ['number', 'null'] }, referenceDimensionId: { type: ['string', 'null'] } } },
    perimeter: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } } } },
    walls: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'type', 'wallType', 'start', 'end', 'thickness', 'height', 'confidence', 'evidence'], properties: { id: { type: 'string' }, type: { type: 'string', enum: ['wall'] }, wallType: { type: 'string', enum: ['exterior', 'interior', 'unknown'] }, start: { $ref: '#/$defs/point' }, end: { $ref: '#/$defs/point' }, thickness: { type: ['number', 'null'] }, height: { type: ['number', 'null'] }, confidence: { type: 'number', minimum: 0, maximum: 1 }, evidence: { type: 'string' } } } },
    doors: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'type', 'wallId', 'position', 'width', 'swing', 'confidence'], properties: { id: { type: 'string' }, type: { type: 'string', enum: ['door'] }, wallId: { type: ['string', 'null'] }, position: { type: 'number', minimum: 0, maximum: 1 }, width: { type: ['number', 'null'] }, swing: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
    windows: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'type', 'wallId', 'position', 'width', 'confidence'], properties: { id: { type: 'string' }, type: { type: 'string', enum: ['window'] }, wallId: { type: ['string', 'null'] }, position: { type: 'number', minimum: 0, maximum: 1 }, width: { type: ['number', 'null'] }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
    rooms: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'type', 'name', 'polygon', 'wallIds', 'doors', 'windows', 'confidence', 'textEvidence'], properties: { id: { type: 'string' }, type: { type: 'string' }, name: { type: 'string' }, polygon: { type: 'array', items: { $ref: '#/$defs/point' } }, wallIds: { type: 'array', items: { type: 'string' } }, doors: { type: 'array', items: { type: 'string' } }, windows: { type: 'array', items: { type: 'string' } }, confidence: { type: 'number', minimum: 0, maximum: 1 }, textEvidence: { type: ['string', 'null'] } } } },
    labels: { type: 'array' },
    dimensions: { type: 'array' },
    furnitureEvidence: { type: 'array' },
    warnings: { type: 'array' },
    confidence: { type: 'object', additionalProperties: false, required: ['overall', 'geometry', 'rooms', 'openings', 'text'], properties: { overall: { type: 'number', minimum: 0, maximum: 1 }, geometry: { type: 'number', minimum: 0, maximum: 1 }, rooms: { type: 'number', minimum: 0, maximum: 1 }, openings: { type: 'number', minimum: 0, maximum: 1 }, text: { type: 'number', minimum: 0, maximum: 1 } } }
  },
  $defs: { point: { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } } } }
};

const systemPrompt = `Actúa como intérprete de croquis arquitectónicos. Analiza la imagen como un posible plano de planta residencial. No rediseñes la vivienda ni inventes elementos sin evidencia. Conserva distribución, proporciones, perímetro, divisiones, puertas, ventanas, textos y relaciones espaciales. Usa unknown, null o confidence baja ante incertidumbre. Intenta leer textos y cotas visibles. No reconstruyas mobiliario; úsalo solo como evidencia. Devuelve únicamente JSON según el schema solicitado, sin markdown ni prosa.`;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; if (Buffer.byteLength(body) > MAX_BODY_BYTES) reject(new Error('Payload demasiado grande.')); });
    request.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON de entrada inválido.')); } });
    request.on('error', reject);
  });
}

function validRequest(input) {
  return input && typeof input.image === 'string' && ALLOWED_IMAGE_PREFIXES.some((prefix) => input.image.startsWith(prefix)) && Number.isFinite(input.imageWidth) && Number.isFinite(input.imageHeight);
}

async function requestModel(input, repair = false) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      input: [{ role: 'user', content: [{ type: 'input_text', text: repair ? 'Corrige el JSON anterior para que cumpla estrictamente el schema. Devuelve solo el objeto JSON.' : `${systemPrompt}\nImagen: ${input.imageWidth}x${input.imageHeight}px.` }, { type: 'input_image', image_url: input.image }] }],
      text: { format: { type: 'json_schema', name: 'architectural_model', strict: true, schema: responseSchema } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI respondió ${response.status}.`);
  const payload = await response.json();
  const text = payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
  if (!text) throw new Error('La respuesta multimodal no contiene JSON.');
  return JSON.parse(text);
}

async function interpret(input) {
  let model = await requestModel(input);
  let validation = validateArchitecturalModel(model);
  if (!validation.valid) {
    model = await requestModel(input, true);
    validation = validateArchitecturalModel(model);
  }
  if (!validation.valid) throw new Error(`JSON multimodal inválido: ${validation.errors.join(' ')}`);
  return model;
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return sendJson(response, 204, {});
  if (request.method === 'GET' && request.url === '/api/health') return sendJson(response, 200, { aiMode: process.env.OPENAI_API_KEY ? 'available' : 'local_fallback' });
  if (request.method !== 'POST' || request.url !== '/api/sketch/interpret') return sendJson(response, 404, { error: 'Ruta no encontrada.' });
  if (!process.env.OPENAI_API_KEY) return sendJson(response, 503, { error: 'Servicio multimodal no configurado.' });
  try {
    const input = await readJson(request);
    if (!validRequest(input)) return sendJson(response, 400, { error: 'Entrada inválida.' });
    const model = await interpret(input);
    return sendJson(response, 200, { model });
  } catch (error) {
    return sendJson(response, 502, { error: error.message || 'No fue posible interpretar el boceto.' });
  }
});

server.listen(PORT, () => console.log(`Volcán Proyecta backend escuchando en http://localhost:${PORT}`));
