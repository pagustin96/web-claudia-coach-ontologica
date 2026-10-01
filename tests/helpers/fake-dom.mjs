/**
 * Minimal DOM stand-in for unit tests. It implements only what forms.js and
 * main.js touch: attributes, dataset, classList, tree edits (append/after/remove)
 * and a tiny querySelectorAll (`#id`, `tag`, `[attr]`, `[attr="value"]`, `tag[attr]`).
 */

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export class FakeElement {
  constructor(tagName, ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = {};
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.listeners = {};
    this.classNames = new Set();
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.checked = false;
    this.type = '';
    this.id = '';
    this.name = '';
    this.textContent = '';
    this.innerHTML = '';
    this.focusCount = 0;
    this.style = {};
    this.classList = {
      add: (...names) => names.forEach((n) => this.classNames.add(n)),
      remove: (...names) => names.forEach((n) => this.classNames.delete(n)),
      contains: (name) => this.classNames.has(name),
    };
  }

  get className() {
    return [...this.classNames].join(' ');
  }

  set className(value) {
    this.classNames = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return name in this.attributes ? this.attributes[name] : null;
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener(type, handler) {
    (this.listeners[type] ??= []).push(handler);
  }

  async dispatch(type, event) {
    for (const handler of this.listeners[type] ?? []) await handler(event);
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...nodes);
  }

  after(node) {
    const siblings = this.parentElement.children;
    node.parentElement = this.parentElement;
    siblings.splice(siblings.indexOf(this) + 1, 0, node);
  }

  remove() {
    const siblings = this.parentElement?.children;
    if (siblings) siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }

  focus() {
    this.focusCount++;
  }

  matches(selector) {
    const byId = selector.trim().match(/^#([\w-]+)$/);
    if (byId) return this.id === byId[1];
    const m = selector.trim().match(/^([a-z][a-z0-9]*)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/i);
    if (!m) throw new Error(`fake DOM does not support selector: ${selector}`);
    const [, tag, attr, value] = m;
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    if (!attr) return true;
    const actual = attr.startsWith('data-')
      ? this.dataset[camel(attr.slice(5))]
      : this.attributes[attr] ?? (attr === 'type' && this.type ? this.type : undefined);
    return value === undefined ? actual !== undefined : actual === value;
  }

  querySelectorAll(selector) {
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

export function createDocument() {
  const doc = {
    createElement: (tag) => new FakeElement(tag, doc),
  };
  doc.body = doc.createElement('body');
  doc.querySelectorAll = (selector) => doc.body.querySelectorAll(selector);
  doc.querySelector = (selector) => doc.body.querySelector(selector);
  return doc;
}

/**
 * Builds a form shaped like the ones in index.html. Returns the form element
 * with `elements`, `button` and a `fill(values)` helper.
 */
export function buildForm(doc, kind) {
  const form = doc.createElement('form');
  form.id = `${kind}-form`;
  form.dataset.form = kind;
  form.elements = {};

  const add = (name, type = 'text') => {
    const wrap = doc.createElement('div');
    const field = doc.createElement(type === 'textarea' ? 'textarea' : 'input');
    field.name = name;
    field.type = type;
    form.elements[name] = field;
    wrap.append(field);
    form.append(wrap);
    return field;
  };

  add('name');
  add('email', 'email');
  add('phone', 'tel');
  add('botcheck', 'checkbox');
  if (kind === 'contact') {
    add('message', 'textarea');
    add('privacy', 'checkbox');
    const select = add('consultType', 'select');
    select.value = 'personal';
  }

  form.button = doc.createElement('button');
  form.button.type = 'submit';
  form.button.setAttribute('type', 'submit');
  form.button.innerHTML = '<svg></svg> Enviar';
  form.append(form.button);

  form.fill = (values) => {
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements[name];
      if (typeof value === 'boolean') field.checked = value;
      else field.value = value;
    }
  };
  return form;
}
