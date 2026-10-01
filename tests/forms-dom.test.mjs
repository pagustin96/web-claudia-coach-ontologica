import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initForms, MESSAGES } from '../public/assets/js/forms.js';
import { createDocument, buildForm } from './helpers/fake-dom.mjs';

const CONFIG = { web3formsKey: 'k', whatsappNumber: '5491123456789', email: 'hola@example.com' };

const okFetch = async () => ({ ok: true, json: async () => ({ success: true }) });

const validContact = {
  name: 'Ana Pérez',
  email: 'ana@example.com',
  message: 'Quiero saber más sobre las sesiones.',
  privacy: true,
};

function submitEvent() {
  const event = { prevented: 0, preventDefault: () => event.prevented++ };
  return event;
}

function setup(kind, { config = CONFIG, options = { fetchImpl: okFetch }, values } = {}) {
  const doc = createDocument();
  const form = buildForm(doc, kind);
  doc.body.append(form);
  if (values) form.fill(values);
  initForms(doc, config, options);
  const region = () => doc.body.children[doc.body.children.indexOf(form) + 1];
  return { doc, form, region };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

test('submit always calls preventDefault (no native navigation)', async () => {
  const { form } = setup('contact');
  const event = submitEvent();
  await form.dispatch('submit', event);
  assert.equal(event.prevented, 1);
});

test('invalid input sets aria-invalid, shows an error and does not send', async () => {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return okFetch();
  };
  const { form } = setup('contact', { options: { fetchImpl }, values: { name: 'A', email: 'nope' } });

  await form.dispatch('submit', submitEvent());

  for (const name of ['name', 'email', 'message', 'privacy']) {
    const field = form.elements[name];
    assert.equal(field.getAttribute('aria-invalid'), 'true', name);
    const errorId = field.getAttribute('aria-describedby');
    const error = form.querySelectorAll('[data-error-for]').find((p) => p.id === errorId);
    assert.ok(error?.textContent, `${name} has a visible error message`);
  }
  assert.equal(form.elements.name.focusCount, 1, 'focus moves to the first invalid field');
  assert.equal(calls.length, 0);
  assert.equal(form.button.disabled, false);
});

test('a corrected resubmission clears the previous errors', async () => {
  const { form } = setup('lead', { values: { name: 'A', email: 'nope' } });
  await form.dispatch('submit', submitEvent());
  assert.equal(form.querySelectorAll('[data-error-for]').length, 2);

  form.fill({ name: 'Ana', email: 'ana@example.com' });
  await form.dispatch('submit', submitEvent());
  assert.equal(form.querySelectorAll('[data-error-for]').length, 0);
  assert.equal(form.querySelectorAll('[aria-invalid]').length, 0);
});

test('the button is busy while sending and restored after a failure', async () => {
  const gate = deferred();
  const fetchImpl = () => gate.promise;
  const { form, region } = setup('contact', { options: { fetchImpl }, values: validContact });
  const idleHtml = form.button.innerHTML;

  const pending = form.dispatch('submit', submitEvent());
  assert.equal(form.button.disabled, true);
  assert.equal(form.button.getAttribute('aria-busy'), 'true');
  assert.equal(form.button.textContent, MESSAGES.sending);

  gate.resolve({ ok: false, status: 400, json: async () => ({ success: false, message: 'Invalid key' }) });
  await pending;

  assert.equal(form.button.disabled, false);
  assert.equal(form.button.hasAttribute('aria-busy'), false);
  assert.equal(form.button.innerHTML, idleHtml);
  assert.equal(form.hidden, false, 'the form stays visible so the user can retry');
  assert.match(region().children[0].textContent, /Invalid key/);
});

test('success hides the form and shows the success message', async () => {
  const { form, region } = setup('contact', { values: validContact });
  await form.dispatch('submit', submitEvent());
  assert.equal(form.hidden, true);
  assert.equal(region().children[0].textContent, MESSAGES.success.contact);
  assert.equal(region().getAttribute('aria-live'), 'polite');
});

test('the lead form shows its own success message', async () => {
  const { form, region } = setup('lead', { values: { name: 'Ana', email: 'ana@example.com' } });
  await form.dispatch('submit', submitEvent());
  assert.equal(form.hidden, true);
  assert.equal(region().children[0].textContent, MESSAGES.success.lead);
});

test('not_configured shows the fallback message with WhatsApp and email links', async () => {
  let called = 0;
  const fetchImpl = async () => {
    called++;
    return okFetch();
  };
  const { form, region } = setup('contact', {
    config: { ...CONFIG, web3formsKey: '' },
    options: { fetchImpl },
    values: validContact,
  });
  await form.dispatch('submit', submitEvent());

  assert.equal(called, 0);
  assert.equal(form.hidden, false);
  assert.equal(region().children[0].textContent, MESSAGES.notConfigured);
  const links = region().children[1].children;
  assert.equal(links.length, 2);
  assert.match(links[0].href, /^https:\/\/wa\.me\/5491123456789\?text=/);
  assert.equal(links[1].href, 'mailto:hola@example.com');
  assert.equal(form.button.disabled, false);
});

test('not_configured without any contact data shows the message and no links', async () => {
  const { form, region } = setup('lead', {
    config: { web3formsKey: '' },
    values: { name: 'Ana', email: 'ana@example.com' },
  });
  await form.dispatch('submit', submitEvent());
  assert.equal(region().children[0].textContent, MESSAGES.notConfigured);
  assert.equal(region().children.length, 1);
});

test('a network error and a timeout both say the message may have been delivered', async () => {
  const failing = async () => {
    throw new TypeError('Failed to fetch');
  };
  const hanging = () => new Promise(() => {});

  for (const options of [{ fetchImpl: failing }, { fetchImpl: hanging, timeoutMs: 10 }]) {
    const { form, region } = setup('contact', { options, values: validContact });
    await form.dispatch('submit', submitEvent());
    assert.equal(region().children[0].textContent, MESSAGES.maybeDelivered);
    assert.equal(form.button.disabled, false);
    assert.equal(region().children[1].children.length, 2, 'fallback links are offered');
  }
});
