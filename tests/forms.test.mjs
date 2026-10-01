import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateContact,
  validateLead,
  buildPayload,
  submitForm,
  whatsappLink,
  normalizePhone,
  MESSAGES,
  DEFAULT_TIMEOUT_MS,
} from '../public/assets/js/forms.js';

const CONFIG = { web3formsKey: 'test-key-123' };

const validContact = () => ({
  name: 'Ana Pérez',
  email: 'ana@example.com',
  phone: '+54 9 11 2345-6789',
  message: 'Quiero saber más sobre las sesiones.',
  privacy: true,
  consultType: 'personal',
});

const validLead = () => ({ name: 'Ana', email: 'ana@example.com' });

function mockFetch(response, calls = []) {
  const fn = async (url, init) => {
    calls.push({ url, init });
    return typeof response === 'function' ? response() : response;
  };
  fn.calls = calls;
  return fn;
}

// --- validateContact -------------------------------------------------------

test('validateContact accepts a complete valid submission', () => {
  assert.deepEqual(validateContact(validContact()), { valid: true, errors: {} });
});

test('validateContact requires name with at least 2 characters', () => {
  for (const name of ['', ' ', 'A', undefined]) {
    const r = validateContact({ ...validContact(), name });
    assert.equal(r.valid, false);
    assert.match(r.errors.name, /nombre/i);
  }
});

test('validateContact rejects malformed emails and accepts sane ones', () => {
  for (const email of ['', 'foo', 'foo@', '@bar.com', 'a b@c.com', 'a@b']) {
    assert.ok(validateContact({ ...validContact(), email }).errors.email, `should reject "${email}"`);
  }
  for (const email of ['a@b.co', 'first.last+tag@sub.example.com']) {
    assert.equal(validateContact({ ...validContact(), email }).errors.email, undefined, email);
  }
});

test('validateContact treats phone as optional but constrains its format', () => {
  assert.equal(validateContact({ ...validContact(), phone: '' }).valid, true);
  assert.equal(validateContact({ ...validContact(), phone: undefined }).valid, true);
  for (const phone of ['12345', 'abc12345', '+54 (11) 2345', '1'.repeat(21)]) {
    assert.ok(validateContact({ ...validContact(), phone }).errors.phone, `should reject "${phone}"`);
  }
  for (const phone of ['123456', '+54 9 11 2345-6789', '1'.repeat(20)]) {
    assert.equal(validateContact({ ...validContact(), phone }).errors.phone, undefined, phone);
  }
});

test('validateContact requires a message of at least 10 characters', () => {
  for (const message of ['', 'corto', '         x', undefined]) {
    assert.ok(validateContact({ ...validContact(), message }).errors.message, `should reject "${message}"`);
  }
});

test('validateContact requires the privacy checkbox', () => {
  for (const privacy of [false, undefined, '']) {
    assert.ok(validateContact({ ...validContact(), privacy }).errors.privacy);
  }
});

test('validateContact restricts consultType and defaults to personal', () => {
  for (const consultType of ['personal', 'empresa', 'charla', undefined, '']) {
    assert.equal(validateContact({ ...validContact(), consultType }).errors.consultType, undefined, String(consultType));
  }
  assert.ok(validateContact({ ...validContact(), consultType: 'otro' }).errors.consultType);
});

test('validateContact reports every invalid field at once', () => {
  const r = validateContact({});
  assert.equal(r.valid, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['email', 'message', 'name', 'privacy']);
});

// --- validateLead ----------------------------------------------------------

test('validateLead accepts name and email only', () => {
  assert.deepEqual(validateLead(validLead()), { valid: true, errors: {} });
});

test('validateLead requires name and a valid email, and validates optional phone', () => {
  const r = validateLead({ name: 'A', email: 'nope' });
  assert.deepEqual(Object.keys(r.errors).sort(), ['email', 'name']);
  assert.ok(validateLead({ ...validLead(), phone: 'xx' }).errors.phone);
});

test('validateLead does not require message or privacy', () => {
  const r = validateLead(validLead());
  assert.equal(r.errors.message, undefined);
  assert.equal(r.errors.privacy, undefined);
});

// --- buildPayload ----------------------------------------------------------

test('buildPayload (contact) returns the Web3Forms JSON shape', () => {
  const p = buildPayload('contact', validContact(), CONFIG);
  assert.equal(p.access_key, 'test-key-123');
  assert.equal(p.subject, 'Nueva consulta web: Sesión personal');
  assert.equal(p.from_name, 'Web Claudia Samudio');
  assert.equal(p.botcheck, false);
  assert.equal(p.name, 'Ana Pérez');
  assert.equal(p.email, 'ana@example.com');
  assert.equal(p.phone, '+54 9 11 2345-6789');
  assert.equal(p.message, 'Quiero saber más sobre las sesiones.');
  assert.equal(p.consultType, 'personal');
});

test('buildPayload (contact) puts the consult type in the subject and defaults to personal', () => {
  assert.match(buildPayload('contact', { ...validContact(), consultType: 'empresa' }, CONFIG).subject, /Empresas/);
  assert.match(buildPayload('contact', { ...validContact(), consultType: 'charla' }, CONFIG).subject, /Charlas/);
  assert.equal(buildPayload('contact', { ...validContact(), consultType: undefined }, CONFIG).consultType, 'personal');
});

test('buildPayload (lead) uses the free guide subject', () => {
  const p = buildPayload('lead', validLead(), CONFIG);
  assert.equal(p.subject, 'Pedido de guía gratuita');
  assert.equal(p.name, 'Ana');
  assert.equal(p.email, 'ana@example.com');
  assert.equal(p.botcheck, false);
});

test('buildPayload trims values and omits an empty phone', () => {
  const p = buildPayload('contact', { ...validContact(), name: '  Ana  ', phone: '  ' }, CONFIG);
  assert.equal(p.name, 'Ana');
  assert.ok(!('phone' in p));
});

test('buildPayload throws a clear error when the key is missing', () => {
  assert.throws(() => buildPayload('contact', validContact(), { web3formsKey: '' }), /web3formsKey/);
  assert.throws(() => buildPayload('contact', validContact(), {}), /web3formsKey/);
});

test('buildPayload rejects an unknown form kind', () => {
  assert.throws(() => buildPayload('newsletter', validLead(), CONFIG), /kind/);
});

// --- submitForm ------------------------------------------------------------

test('submitForm POSTs JSON to Web3Forms and reports success', async () => {
  const fetchImpl = mockFetch({ ok: true, json: async () => ({ success: true }) });
  const result = await submitForm('contact', validContact(), CONFIG, fetchImpl);
  assert.deepEqual(result, { ok: true });
  assert.equal(fetchImpl.calls.length, 1);
  const { url, init } = fetchImpl.calls[0];
  assert.equal(url, 'https://api.web3forms.com/submit');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.equal(init.headers.Accept, 'application/json');
  assert.deepEqual(JSON.parse(init.body), buildPayload('contact', validContact(), CONFIG));
});

test('submitForm skips silently when the honeypot is filled', async () => {
  const fetchImpl = mockFetch({ ok: true, json: async () => ({ success: true }) });
  const result = await submitForm('contact', { ...validContact(), botcheck: true }, CONFIG, fetchImpl);
  assert.deepEqual(result, { ok: true, skipped: true });
  assert.equal(fetchImpl.calls.length, 0);
});

test('submitForm returns not_configured without calling fetch when the key is empty', async () => {
  const fetchImpl = mockFetch({ ok: true, json: async () => ({ success: true }) });
  const result = await submitForm('contact', validContact(), { web3formsKey: '' }, fetchImpl);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_configured');
  assert.ok(result.message);
  assert.equal(fetchImpl.calls.length, 0);
});

test('submitForm returns network when fetch throws', async () => {
  const fetchImpl = async () => {
    throw new TypeError('Failed to fetch');
  };
  const result = await submitForm('lead', validLead(), CONFIG, fetchImpl);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'network');
  assert.ok(result.message);
});

test('submitForm returns rejected when the API answers success:false', async () => {
  const fetchImpl = mockFetch({ ok: false, status: 400, json: async () => ({ success: false, message: 'Invalid key' }) });
  const result = await submitForm('lead', validLead(), CONFIG, fetchImpl);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'rejected');
  assert.match(result.message, /Invalid key/);
});

test('submitForm returns rejected when the response is not JSON', async () => {
  const fetchImpl = mockFetch({
    ok: false,
    status: 502,
    json: async () => {
      throw new SyntaxError('Unexpected token <');
    },
  });
  const result = await submitForm('lead', validLead(), CONFIG, fetchImpl);
  assert.equal(result.reason, 'rejected');
});

// --- whatsappLink ----------------------------------------------------------

test('whatsappLink builds a wa.me URL with an encoded message', () => {
  assert.equal(
    whatsappLink('+54 9 11 2345-6789', 'Hola Claudia, ¿podemos hablar? & más'),
    `https://wa.me/5491123456789?text=${encodeURIComponent('Hola Claudia, ¿podemos hablar? & más')}`
  );
});

test('whatsappLink returns null without a usable number', () => {
  for (const n of ['', '   ', undefined, null, '+-']) assert.equal(whatsappLink(n, 'x'), null);
});

test('whatsappLink omits the text parameter when no text is given', () => {
  assert.equal(whatsappLink('5491123456789'), 'https://wa.me/5491123456789');
});

test('normalizePhone keeps digits only', () => {
  assert.equal(normalizePhone('+54 9 11 2345-6789'), '5491123456789');
  assert.equal(normalizePhone('(011) 4555.1234'), '01145551234');
  for (const v of [undefined, null, '', '+-']) assert.equal(normalizePhone(v), '');
});

// --- MESSAGES --------------------------------------------------------------

test('MESSAGES is the single source of user-facing submission texts (voseo)', () => {
  assert.equal(
    MESSAGES.maybeDelivered,
    'Puede que tu mensaje se haya enviado. Si no recibís respuesta, escribime por WhatsApp.'
  );
  assert.ok(MESSAGES.notConfigured && MESSAGES.sending && MESSAGES.success.contact && MESSAGES.success.lead);
  assert.match(MESSAGES.rejected('Invalid key'), /Invalid key/);
  assert.ok(!/Invalid/.test(MESSAGES.rejected()), 'no detail, no parentheses');
  assert.ok(Object.isFrozen(MESSAGES));
});

test('validation messages use voseo, not tuteo', () => {
  const errors = validateContact({}).errors;
  const all = Object.values(errors).join(' ');
  assert.doesNotMatch(all, /\b(Ingresa|Debes|Elige|Cuéntame)\b/);
  assert.match(all, /Ingresá|Tenés|Contame/);
});

// --- submitForm: timeout, network and body parsing ---------------------------

test('submitForm passes an AbortSignal and defaults to a 15 s timeout', async () => {
  assert.equal(DEFAULT_TIMEOUT_MS, 15000);
  const fetchImpl = mockFetch({ ok: true, json: async () => ({ success: true }) });
  await submitForm('lead', validLead(), CONFIG, fetchImpl);
  assert.ok(fetchImpl.calls[0].init.signal instanceof AbortSignal);
});

test('submitForm returns timeout when fetch never resolves and the signal aborts it', async () => {
  let aborted = false;
  const fetchImpl = (url, init) =>
    new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('The operation was aborted', 'AbortError'));
      });
    });
  const result = await submitForm('contact', validContact(), CONFIG, fetchImpl, { timeoutMs: 20 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'timeout');
  assert.equal(result.message, MESSAGES.maybeDelivered);
  assert.equal(aborted, true, 'the request is aborted, not just abandoned');
});

test('submitForm times out even when fetch ignores the signal', async () => {
  const result = await submitForm('lead', validLead(), CONFIG, () => new Promise(() => {}), { timeoutMs: 20 });
  assert.equal(result.reason, 'timeout');
});

test('submitForm times out while the body is still being read', async () => {
  const fetchImpl = async () => ({ ok: true, json: () => new Promise(() => {}) });
  const result = await submitForm('lead', validLead(), CONFIG, fetchImpl, { timeoutMs: 20 });
  assert.equal(result.reason, 'timeout');
});

test('submitForm does not time out a fast response and clears its timer', async () => {
  const fetchImpl = mockFetch({ ok: true, json: async () => ({ success: true }) });
  const result = await submitForm('lead', validLead(), CONFIG, fetchImpl, { timeoutMs: 1000 });
  assert.deepEqual(result, { ok: true });
});

test('submitForm network errors carry the "may have been delivered" message', async () => {
  const fetchImpl = async () => {
    throw new TypeError('Failed to fetch');
  };
  const result = await submitForm('contact', validContact(), CONFIG, fetchImpl);
  assert.equal(result.reason, 'network');
  assert.equal(result.message, MESSAGES.maybeDelivered);
});

test('submitForm treats an unparsable body as rejected even when the status is ok', async () => {
  const fetchImpl = mockFetch({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input');
    },
  });
  const result = await submitForm('lead', validLead(), CONFIG, fetchImpl);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'rejected');
  assert.equal(result.message, MESSAGES.rejected());
});

test('submitForm not_configured uses the shared message', async () => {
  const result = await submitForm('lead', validLead(), {}, mockFetch({}));
  assert.equal(result.message, MESSAGES.notConfigured);
});

test('submitForm throws on an unknown kind instead of reporting a network error', async () => {
  await assert.rejects(() => submitForm('newsletter', validLead(), CONFIG, mockFetch({})), /kind/);
});
