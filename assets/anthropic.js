// Direct-from-browser Anthropic adapter for neurodigineration training mode.
//
// Anthropic's API blocks browser calls by default to protect API keys
// from being leaked through public web apps. The opt-in escape hatch is
// the header `anthropic-dangerous-direct-browser-access: true`, which
// the SDK exposes as `dangerouslyAllowBrowser: true`. We use the raw
// fetch here so the page stays zero-dependency.
//
// The key the SME pastes is stored in localStorage on their own browser
// and is sent ONLY to api.anthropic.com. It is never relayed to any
// other origin (including the host of neurodigineration itself, since the
// page has no backend). The key field in the UI advertises this so the
// user knows the trust boundary.
//
// Streaming: this adapter speaks Anthropic's `stream: true` Server-Sent
// Events format. The `onToken` callback fires per text delta so the
// brief renders progressively in the GUI. The returned Promise resolves
// to the assembled full text once the stream completes.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Models that think by default (adaptive thinking). Their thinking tokens
// count against max_tokens, so a 2k cap that was fine for Sonnet 4.6 can
// leave a brief cut off mid-sentence. We stream, so a generous floor costs
// nothing unless the model actually uses it.
const THINKS_BY_DEFAULT = /^claude-(opus-5|sonnet-5|fable-5|mythos-5)/;
const THINKING_MAX_TOKENS_FLOOR = 16000;

// Server-side refusal fallback: if a safety classifier declines the request
// (stop_reason "refusal"), the API re-runs it on a fallback model instead
// of returning nothing. Enabled on the models that support it.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const SUPPORTS_FALLBACKS = /^claude-(opus-5|fable-5-1)/;

/** Pulls API key out of localStorage. Returns null if absent. */
export function loadApiKey() {
  try {
    let k = localStorage.getItem('nd-anthropic-key');
    if (!k) {
      // Backward-compat: pull from old bioscope-anthropic-key on first load
      const legacy = localStorage.getItem('bioscope-anthropic-key');
      if (legacy) {
        k = legacy;
        try { localStorage.setItem('nd-anthropic-key', legacy); } catch { /* noop */ }
      }
    }
    return k || null;
  } catch {
    return null;
  }
}

/** Persists API key to localStorage. Pass null to forget. */
export function saveApiKey(key) {
  try {
    if (!key) localStorage.removeItem('nd-anthropic-key');
    else localStorage.setItem('nd-anthropic-key', key.trim());
  } catch (e) {
    console.error('Could not persist API key:', e);
  }
}

/** Lightweight format check — does this LOOK like an Anthropic API key? */
export function looksLikeAnthropicKey(s) {
  return typeof s === 'string' && /^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(s.trim());
}

/**
 * Stream a single message exchange from Claude.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.model  e.g. "claude-opus-5", "claude-haiku-4-5"
 * @param {string} opts.system Top-level system prompt.
 * @param {Array<{role:'user'|'assistant', content: string}>} opts.messages
 * @param {number} [opts.maxTokens] default 2048
 * @param {(delta: string, full: string) => void} [opts.onToken] streamed delta callback
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{text: string, stopReason: string, usage: object}>}
 */
export async function streamClaude({
  apiKey,
  model,
  system,
  messages,
  maxTokens = 2048,
  onToken,
  signal,
}) {
  if (!apiKey) throw new Error('No Anthropic API key set');
  if (!looksLikeAnthropicKey(apiKey)) {
    throw new Error("Key doesn't look like an Anthropic API key (sk-ant-…)");
  }

  const body = {
    model,
    max_tokens: THINKS_BY_DEFAULT.test(model) ? Math.max(maxTokens, THINKING_MAX_TOKENS_FLOOR) : maxTokens,
    system,
    messages,
    stream: true,
  };
  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  const send = (withFallbacks) => fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: withFallbacks ? { ...headers, 'anthropic-beta': FALLBACK_BETA } : headers,
    body: JSON.stringify(withFallbacks ? { ...body, fallbacks: 'default' } : body),
    signal,
  });
  const readError = async (r) => {
    const errText = await r.text().catch(() => '');
    let parsed;
    try { parsed = JSON.parse(errText); } catch { /* not json */ }
    return parsed?.error?.message || errText || `HTTP ${r.status}`;
  };

  const tryFallbacks = SUPPORTS_FALLBACKS.test(model);
  let res = await send(tryFallbacks);
  if (tryFallbacks && res.status === 400) {
    // If the fallback beta is not enabled for this key, retry plain rather
    // than failing the whole request over an optional safety net.
    const msg = await readError(res);
    if (!/fallback|beta/i.test(msg)) throw new Error(`Anthropic API: ${msg}`);
    res = await send(false);
  }
  if (!res.ok || !res.body) {
    throw new Error(`Anthropic API: ${await readError(res)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  let stopReason = 'end_turn';
  let usage = { input_tokens: 0, output_tokens: 0 };

  try {
    // Parse SSE
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // SSE messages are separated by blank lines
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);

        // Each block has lines like "event: foo" and "data: {...}"
        const lines = block.split('\n');
        let event = 'message';
        let dataLine = '';
        for (const ln of lines) {
          if (ln.startsWith('event: ')) event = ln.slice('event: '.length).trim();
          else if (ln.startsWith('data: ')) dataLine = ln.slice('data: '.length);
        }
        if (!dataLine) continue;

        let payload;
        try { payload = JSON.parse(dataLine); } catch { continue; }

        if (event === 'content_block_delta' && payload.delta?.type === 'text_delta') {
          const delta = payload.delta.text || '';
          full += delta;
          onToken?.(delta, full);
        } else if (event === 'message_delta') {
          if (payload.delta?.stop_reason) stopReason = payload.delta.stop_reason;
          if (payload.usage) usage = { ...usage, ...payload.usage };
        } else if (event === 'message_start') {
          if (payload.message?.usage) usage = { ...usage, ...payload.message.usage };
        } else if (event === 'error') {
          throw new Error(`Anthropic stream error: ${payload.error?.message || 'unknown'}`);
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }

  if (stopReason === 'refusal' && !full.trim()) {
    throw new Error('Claude declined this request (stop_reason: refusal). Rephrase it or pick a different model.');
  }
  return { text: full, stopReason, usage };
}

/** Common model identifiers shown in the picker. Order = display order. */
export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 · highest quality (default)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 · balanced, cheaper' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 · fastest, cheapest' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 · previous generation' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 · previous generation' },
];
