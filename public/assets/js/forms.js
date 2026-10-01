/**
 * Forms: validation, Web3Forms payload/submission and browser wiring.
 *
 * ES module usable both in the browser and from Node tests, so nothing here
 * touches DOM globals at import time. Only initForms() needs a DOM, and it
 * receives its root explicitly.
 */

export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

export const CONSULT_TYPES = Object.freeze({
  personal: 'Sesión personal',
  empresa: 'Empresas, clubes o gimnasios',
  charla: 'Charlas y talleres',
});

export const DEFAULT_TIMEOUT_MS = 15000;

// Every user-facing submission text lives here (voseo, Argentine register).
export const MESSAGES = Object.freeze({
  sending: 'Enviando…',
  notConfigured: 'El formulario todavía no está habilitado. Escribime por WhatsApp o email.',
  maybeDelivered: 'Puede que tu mensaje se haya enviado. Si no recibís respuesta, escribime por WhatsApp.',
  rejected: (detail) => `No se pudo enviar el formulario${detail ? ` (${detail})` : ''}. Probá de nuevo en unos minutos.`,
  success: Object.freeze({
    contact: '¡Gracias! Te responderé a la brevedad.',
    lead: '¡Listo! Te enviaré la guía a tu email en las próximas horas.',
  }),
  validation: Object.freeze({
    name: 'Ingresá tu nombre (al menos 2 caracteres).',
    email: 'Ingresá un email válido, por ejemplo nombre@email.com.',
    phone: 'Ingresá un teléfono válido (6 a 20 caracteres: números, espacios, + o -).',
    message: 'Contame un poco más (al menos 10 caracteres).',
    privacy: 'Tenés que aceptar la política de privacidad para continuar.',
    consultType: 'Elegí un tipo de consulta válido.',
  }),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+\-\s]{6,20}$/;
const FROM_NAME = 'Web Claudia Samudio';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// --- Validation --------------------------------------------------------------

function validateCommon(data, errors) {
  if (text(data.name).length < 2) errors.name = MESSAGES.validation.name;
  if (!EMAIL_RE.test(text(data.email))) errors.email = MESSAGES.validation.email;
  const phone = text(data.phone);
  if (phone && !PHONE_RE.test(phone)) {
    errors.phone = MESSAGES.validation.phone;
  }
}

const result = (errors) => ({ valid: Object.keys(errors).length === 0, errors });

export function validateContact(data = {}) {
  const errors = {};
  validateCommon(data, errors);
  if (text(data.message).length < 10) errors.message = MESSAGES.validation.message;
  if (!data.privacy) errors.privacy = MESSAGES.validation.privacy;
  const type = text(data.consultType) || 'personal';
  if (!Object.hasOwn(CONSULT_TYPES, type)) errors.consultType = MESSAGES.validation.consultType;
  return result(errors);
}

export function validateLead(data = {}) {
  const errors = {};
  validateCommon(data, errors);
  return result(errors);
}

// --- Payload and submission --------------------------------------------------

export function buildPayload(kind, data = {}, config = {}) {
  if (kind !== 'contact' && kind !== 'lead') {
    throw new Error(`buildPayload: unknown form kind "${kind}" (expected "contact" or "lead")`);
  }
  if (!config.web3formsKey) {
    throw new Error('buildPayload: config.web3formsKey is empty; set it in assets/js/config.js');
  }

  const payload = {
    access_key: config.web3formsKey,
    from_name: FROM_NAME,
    botcheck: false,
    name: text(data.name),
    email: text(data.email),
  };
  const phone = text(data.phone);
  if (phone) payload.phone = phone;

  if (kind === 'contact') {
    const type = text(data.consultType) || 'personal';
    payload.subject = `Nueva consulta web: ${CONSULT_TYPES[type] ?? type}`;
    payload.consultType = type;
    payload.message = text(data.message);
  } else {
    payload.subject = 'Pedido de guía gratuita';
  }
  return payload;
}

const TIMEOUT = Symbol('timeout');

/**
 * Sends the form to Web3Forms. `options.timeoutMs` is injectable for tests.
 * Network errors and timeouts are ambiguous (the request may have reached the
 * server), so both answer with MESSAGES.maybeDelivered.
 */
export async function submitForm(kind, data, config, fetchImpl = fetch, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  // Bots fill the hidden honeypot: pretend it worked and send nothing.
  if (data?.botcheck) return { ok: true, skipped: true };

  if (!config?.web3formsKey) {
    return { ok: false, reason: 'not_configured', message: MESSAGES.notConfigured };
  }

  // Built outside the try block so a programming error (bad kind) is not
  // reported to the user as a network problem.
  const body = JSON.stringify(buildPayload(kind, data, config));
  const timedOut = { ok: false, reason: 'timeout', message: MESSAGES.maybeDelivered };

  const controller = new AbortController();
  let timer;
  let expired = false;
  // Raced against fetch so even an implementation that ignores the signal cannot hang the UI.
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      controller.abort();
      resolve(TIMEOUT);
    }, timeoutMs);
  });

  try {
    let response;
    try {
      response = await Promise.race([
        fetchImpl(WEB3FORMS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body,
          signal: controller.signal,
        }),
        timeout,
      ]);
    } catch {
      // Aborting rejects fetch: that is the timeout, not a network failure.
      return expired ? timedOut : { ok: false, reason: 'network', message: MESSAGES.maybeDelivered };
    }
    if (response === TIMEOUT) return timedOut;

    let json = null;
    try {
      json = await Promise.race([response.json(), timeout]);
    } catch {
      // Non-JSON answers (proxy errors, HTML pages) are treated as rejections below.
    }
    if (json === TIMEOUT) return timedOut;

    if (response.ok && json?.success) return { ok: true };
    return { ok: false, reason: 'rejected', message: MESSAGES.rejected(json?.message) };
  } finally {
    clearTimeout(timer);
  }
}

// --- Links -------------------------------------------------------------------

export const normalizePhone = (value) => String(value ?? '').replace(/\D/g, '');

export function whatsappLink(number, message) {
  const digits = normalizePhone(number);
  if (!digits) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

// --- Browser wiring ----------------------------------------------------------

function readForm(form) {
  const get = (name) => form.elements[name];
  const value = (name) => get(name)?.value ?? '';
  const checked = (name) => Boolean(get(name)?.checked);
  return {
    name: value('name'),
    email: value('email'),
    phone: value('phone'),
    message: value('message'),
    consultType: value('consultType'),
    privacy: checked('privacy'),
    botcheck: checked('botcheck'),
  };
}

function fallbackMessage(kind, data) {
  if (kind === 'lead') return `Hola Claudia, quiero recibir la guía gratuita. Mi email es ${text(data.email)}.`;
  const body = text(data.message);
  return `Hola Claudia, soy ${text(data.name)}. ${body}`.trim();
}

function clearErrors(form) {
  for (const p of form.querySelectorAll('[data-error-for]')) p.remove();
  for (const field of form.querySelectorAll('[aria-invalid]')) {
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.classList.remove('input-error');
  }
}

function showErrors(form, errors) {
  const doc = form.ownerDocument;
  let first = null;
  for (const [name, message] of Object.entries(errors)) {
    const field = form.elements[name];
    if (!field) continue;
    const id = `${form.id || form.dataset.form}-${name}-error`;
    const p = doc.createElement('p');
    p.id = id;
    p.dataset.errorFor = name;
    p.className = 'mt-1 text-sm text-red-700';
    p.textContent = message;
    // A checkbox sits in a flex row: put its message after the row, not inside it.
    (field.type === 'checkbox' ? field.parentElement : field).after(p);
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', id);
    field.classList.add('input-error');
    first ??= field;
  }
  first?.focus();
}

function linkEl(doc, href, label) {
  const a = doc.createElement('a');
  a.href = href;
  a.textContent = label;
  a.className = 'font-medium text-primary-700 underline hover:text-primary-900';
  if (/^https?:/.test(href)) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return a;
}

function renderStatus(region, className, message, links = []) {
  const doc = region.ownerDocument;
  region.replaceChildren();
  region.className = className;
  const p = doc.createElement('p');
  p.textContent = message;
  region.append(p);
  if (links.length) {
    const wrap = doc.createElement('p');
    wrap.className = 'mt-2 flex flex-wrap gap-4';
    wrap.append(...links);
    region.append(wrap);
  }
}

/**
 * @param options.fetchImpl / options.timeoutMs forwarded to submitForm (injectable for tests)
 */
export function initForms(root, config = {}, { fetchImpl, timeoutMs } = {}) {
  const doc = root.ownerDocument ?? root;

  for (const form of root.querySelectorAll('form[data-form]')) {
    const kind = form.dataset.form;
    if (kind !== 'contact' && kind !== 'lead') continue;

    // The live region must exist before its content changes to be announced.
    const region = doc.createElement('div');
    region.setAttribute('aria-live', 'polite');
    form.after(region);

    const button = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(form);
      region.replaceChildren();

      const data = readForm(form);
      const { valid, errors } = kind === 'contact' ? validateContact(data) : validateLead(data);
      if (!valid) {
        showErrors(form, errors);
        return;
      }

      const idleLabel = button?.innerHTML;
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = MESSAGES.sending;
      }

      const outcome = await submitForm(kind, data, config, fetchImpl, { timeoutMs });

      if (outcome.ok) {
        form.hidden = true;
        renderStatus(region, 'rounded-xl bg-primary-50 p-6 text-center font-medium text-primary-900', MESSAGES.success[kind]);
        return;
      }

      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.innerHTML = idleLabel;
      }

      const links = [];
      const wa = whatsappLink(config.whatsappNumber, fallbackMessage(kind, data));
      if (wa) links.push(linkEl(doc, wa, 'Escribir por WhatsApp'));
      if (config.email) links.push(linkEl(doc, `mailto:${config.email}`, 'Enviar un email'));

      renderStatus(region, 'mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-900', outcome.message, links);
    });
  }
}
