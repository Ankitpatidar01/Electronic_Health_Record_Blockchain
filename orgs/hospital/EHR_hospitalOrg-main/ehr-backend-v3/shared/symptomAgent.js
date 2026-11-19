'use strict';

/**
 * symptomAgent.js — symptom analysis agent.
 *
 * Trigger : patient registration and visit opening (peer0-api).
 * Input   : the symptoms as entered, age and sex. No name, ID or contact
 *           details are sent to the model.
 * Output  : probable conditions with confidence, suggested ICD-10 codes taken
 *           from the published template, urgency, suggested tests.
 * Shown   : to the assigned doctor as "AI cross-reference, not a diagnosis".
 *
 * The agent never decides anything. If the model cannot be reached the result
 * says so (status UNAVAILABLE) and carries no clinical content.
 */

const MODEL    = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = Number(process.env.SYMPTOM_AGENT_TIMEOUT_MS || 25000);
const URGENCY = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));
const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function unavailable(reason, startedAt) {
  return {
    status: 'UNAVAILABLE', reason, model: MODEL,
    conditions: [], suggestedCodes: [], urgency: '', suggestedTests: [], summary: '',
    durationMs: Date.now() - startedAt, generatedAt: new Date().toISOString(),
  };
}

function buildPrompt({ symptoms, age, gender }, templateDoc) {
  const codes = templateDoc.codes.map(c => `${c.code} ${c.name}`).join('\n');
  return [
    'You are a clinical triage assistant supporting a hospital reception desk in India.',
    'A licensed doctor will examine the patient; your output is a cross-reference for that doctor, not a diagnosis.',
    'Use only the information given. Do not invent findings. If the symptoms are too vague, say so in "summary" and return few or no conditions.',
    '',
    `Patient: age ${age ?? 'unknown'}, sex ${gender || 'unknown'}.`,
    `Reported symptoms: """${symptoms}"""`,
    '',
    'Choose suggested codes ONLY from this list (code and title):',
    codes,
    '',
    'Reply with a single JSON object and nothing else:',
    '{',
    '  "conditions": [{"name": string, "confidence": number between 0 and 1}],   // at most 5, most likely first',
    '  "suggestedCodes": [{"code": string, "confidence": number between 0 and 1}], // at most 3, from the list above',
    '  "urgency": "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY",',
    '  "suggestedTests": [string],   // at most 6 common investigations',
    '  "summary": string             // one or two sentences for the doctor',
    '}',
  ].join('\n');
}

function parseModelJson(raw) {
  const trimmed = String(raw || '').trim();
  try { return JSON.parse(trimmed); } catch (_) { /* try a fenced block */ }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return JSON.parse(fenced[1]);
  const brace = trimmed.match(/\{[\s\S]*\}/);
  if (brace) return JSON.parse(brace[0]);
  throw new Error('model reply was not JSON');
}

function sanitise(data, templateDoc) {
  const known = new Map(templateDoc.codes.map(c => [c.code, c.name]));
  const conditions = (Array.isArray(data.conditions) ? data.conditions : [])
    .map(c => ({ name: text(c?.name, 120), confidence: clamp01(c?.confidence) }))
    .filter(c => c.name).slice(0, 5);
  const seen = new Set();
  const suggestedCodes = (Array.isArray(data.suggestedCodes) ? data.suggestedCodes : [])
    .map(c => ({ code: text(c?.code, 10).toUpperCase(), confidence: clamp01(c?.confidence) }))
    .filter(c => known.has(c.code) && !seen.has(c.code) && seen.add(c.code))
    .map(c => ({ ...c, name: known.get(c.code) })).slice(0, 3);
  const urgency = URGENCY.includes(String(data.urgency || '').toUpperCase()) ? String(data.urgency).toUpperCase() : '';
  const suggestedTests = (Array.isArray(data.suggestedTests) ? data.suggestedTests : [])
    .map(t => text(t, 80)).filter(Boolean).slice(0, 6);
  return { conditions, suggestedCodes, urgency, suggestedTests, summary: text(data.summary, 500) };
}

/**
 * @returns {Promise<object>} status OK with the analysis, or status UNAVAILABLE with a reason.
 */
async function analyseSymptoms(input, templateDoc) {
  const startedAt = Date.now();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return unavailable('GEMINI_API_KEY is not configured', startedAt);
  if (!input.symptoms || !String(input.symptoms).trim()) return unavailable('No symptoms were entered', startedAt);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(input, templateDoc) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    });
    const bodyText = await response.text();
    if (!response.ok) {
      let message = `model API answered ${response.status}`;
      try { message += `: ${text(JSON.parse(bodyText).error?.message, 200)}`; } catch (_) { /* keep status only */ }
      return unavailable(message, startedAt);
    }
    const payload = JSON.parse(bodyText);
    const raw = payload?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!raw) return unavailable(`model returned no content (${payload?.candidates?.[0]?.finishReason || 'no candidate'})`, startedAt);
    const clean = sanitise(parseModelJson(raw), templateDoc);
    return {
      status: 'OK', model: MODEL, ...clean,
      disclaimer: 'AI cross-reference, not a diagnosis',
      durationMs: Date.now() - startedAt, generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const reason = err.name === 'AbortError'
      ? `model did not answer within ${TIMEOUT_MS / 1000}s`
      : text([err.message, err.cause && (err.cause.code || err.cause.message)].filter(Boolean).join(' — '), 200);
    return unavailable(reason, startedAt);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { analyseSymptoms, sanitise, parseModelJson };
