/**
 * Site configuration. This is the only file that needs editing to replace
 * the placeholder data with Claudia's real contact details.
 *
 * Loaded as a classic script (before main.js) and exposed as window.SITE_CONFIG.
 * An empty value means "not configured yet": links keep their fallback
 * (#contacto) and elements marked data-hide-if-empty are hidden.
 *
 * Fields:
 *   whatsappNumber    Digits only, international format, no "+" or spaces
 *                     (for example Argentina mobile: 549 + area code + number).
 *   email             Public contact email address.
 *   instagramUrl      Full URL of the Instagram profile.
 *   facebookUrl       Full URL of the Facebook page.
 *   linkedinUrl       Full URL of the LinkedIn profile.
 *   web3formsKey      Public access key from https://web3forms.com (free, tied
 *                     to the receiving email). Without it the forms show a
 *                     "not enabled yet" message with WhatsApp/email fallbacks.
 *   bookingUrl        Calendly / Cal.com link for the free session. If empty,
 *                     booking buttons fall back to WhatsApp, then to #contacto.
 *   siteUrl           Public site URL, used for canonical/OG (T6).
 *   showTestimonials  Show the testimonials section. Keep false until Claudia
 *                     provides real testimonials.
 */
window.SITE_CONFIG = {
  // TODO: get the number from Claudia (digits only, e.g. 5491112345678).
  whatsappNumber: '',
  // TODO: get the public email from Claudia.
  email: '',
  // TODO: social profile URLs from Claudia.
  instagramUrl: '',
  facebookUrl: '',
  linkedinUrl: '',
  // TODO: create a free Web3Forms access key with Claudia's email.
  web3formsKey: '',
  // TODO: optional Calendly / Cal.com booking link.
  bookingUrl: '',
  // TODO: replace with the final domain once it is registered.
  siteUrl: 'https://claudia-samudio.vercel.app',
  // TODO: switch to true once real testimonials replace the placeholders.
  showTestimonials: false,
};
