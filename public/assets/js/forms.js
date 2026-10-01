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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+\-\s]{6,20}$/;
const FROM_NAME = 'Web Claudia Samudio';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// --- Validation --------------------------------------------------------------

function validateCommon(data, errors) {
  if (text(data.name).length < 2) errors.name = 'Ingresa tu nombre (al menos 2 caracteres).';
  if (!EMAIL_RE.test(text(data.email))) errors.email = 'Ingresa un email válido, por ejemplo nombre@email.com.';
  const phone = text(data.phone);
  if (phone && !PHONE_RE.test(phone)) {
    errors.phone = 'Ingresa un teléfono válido (6 a 20 caracteres: números, espacios, + o -).';
  }
}

const result = (errors) => ({ valid: Object.keys(errors).length === 0, errors });

export function validateContact(data = {}) {
  const errors = {};
  validateCommon(data, errors);
  if (text(data.message).length < 10) errors.message = 'Cuéntame un poco más (al menos 10 caracteres).';
  if (!data.privacy) errors.privacy = 'Debes aceptar la política de privacidad para continuar.';
  const type = text(data.consultType) || 'personal';
  if (!Object.hasOwn(CONSULT_TYPES, type)) errors.consultType = 'Elige un tipo de consulta válido.';
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

export async function submitForm(kind, data, config, fetchImpl = fetch) {
  // Bots fill the hidden honeypot: pretend it worked and send nothing.
  if (data?.botcheck) return { ok: true, skipped: true };

  if (!config?.web3formsKey) {
    return { ok: false, reason: 'not_configured', message: 'El formulario todavía no está habilitado.' };
  }

  let response;
  try {
    response = await fetchImpl(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildPayload(kind, data, config)),
    });
  } catch {
    return { ok: false, reason: 'network', message: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.' };
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON answers (proxy errors, HTML pages) are treated as rejections below.
  }
  if (response.ok && body?.success) return { ok: true };

  const detail = body?.message ? ` (${body.message})` : '';
  return { ok: false, reason: 'rejected', message: `No se pudo enviar el formulario${detail}.` };
}

// --- Links -------------------------------------------------------------------

export function whatsappLink(number, message) {
  const digits = String(number ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

// --- Browser wiring ----------------------------------------------------------

const SUCCESS_MESSAGE = {
  contact: '¡Gracias! Te responderé a la brevedad.',
  lead: '¡Listo! Te enviaré la guía a tu email en las próximas horas.',
};
const NOT_CONFIGURED_MESSAGE = 'El formulario todavía no está habilitado. Escribime por WhatsApp o email.';

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

export function initForms(root, config = {}) {
  const doc = root.ownerDocument ?? root;

  for (const form of root.querySelectorAll('form[data-form]')) {
    const kind = form.dataset.form;
    if (kind !== 'contact' && kind !== 'lead') continue;

    const keyInput = form.elements.access_key;
    if (keyInput) keyInput.value = config.web3formsKey ?? '';

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
        button.textContent = 'Enviando…';
      }

      const outcome = await submitForm(kind, data, config);

      if (outcome.ok) {
        form.hidden = true;
        renderStatus(region, 'rounded-xl bg-primary-50 p-6 text-center font-medium text-primary-900', SUCCESS_MESSAGE[kind]);
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

      const message = outcome.reason === 'not_configured' ? NOT_CONFIGURED_MESSAGE : outcome.message;
      renderStatus(region, 'mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-900', message, links);
    });
  }
}
