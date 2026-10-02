# Landing de Claudia Viviana Samudio, Coach Ontológica

Sitio estático de una sola página (más `privacidad` y `404`) para captar consultas, agendar sesiones y presentar el programa Bienestar Consciente 360. HTML + Tailwind compilado + JavaScript sin dependencias, sin servidor. Los formularios se envían a Web3Forms y el sitio se publica en Vercel (plan gratuito).

**Lo que más se toca:** `public/assets/js/config.js` (datos de contacto, claves, agenda).

## Estructura

```
public/                  # Lo único que se publica (outputDirectory de Vercel)
├── index.html           # Landing
├── privacidad.html      # Política de privacidad
├── 404.html
├── assets/
│   ├── css/output.css   # Generado por `npm run build` (no se versiona a mano)
│   ├── js/              # config.js (datos), main.js, forms.js
│   └── images/          # logos y placeholders
├── robots.txt, sitemap.xml, site.webmanifest, favicons, og-image.jpg
src/css/                 # Fuentes de Tailwind (input.css, variables.css)
scripts/build-images.py  # Regenera logo, favicons y og-image desde assets-src/
assets-src/              # Logo original (no se publica)
tests/                   # node --test: contenido, SEO, formularios, assets, vercel.json
vercel.json              # Build, carpeta de salida, cabeceras y URLs limpias
```

El PDF y el docx de la raíz son material de trabajo: no se publican.

## Desarrollo local

```bash
npm install          # una vez
npm run dev          # compila el CSS en modo watch
npx serve public     # en otra terminal: http://localhost:3000
npm test             # compila el CSS y corre todos los tests
```

`npm run build` genera el CSS minificado en `public/assets/css/output.css`.

## Configurar datos de contacto

Todo se edita en `public/assets/js/config.js`. **Un valor vacío oculta los enlaces relacionados** (o los deja apuntando a `#contacto`), así que el sitio nunca muestra datos falsos.

| Campo | Qué controla | Formato |
|-------|--------------|---------|
| `whatsappNumber` | Botón flotante, CTAs de servicios, agenda de respaldo | Solo dígitos con código de país, sin `+` (Argentina móvil: `549` + área + número) |
| `email` | Enlace de correo en contacto, footer y privacidad | `hola@dominio.com` |
| `instagramUrl` | Ícono y texto `@usuario` | URL completa del perfil |
| `facebookUrl` | Ícono de Facebook | URL completa |
| `linkedinUrl` | Ícono de LinkedIn | URL completa |
| `web3formsKey` | Envío de los dos formularios | Clave de Web3Forms (ver abajo) |
| `bookingUrl` | Botones "Reservá tu sesión gratuita" | URL de Calendly o Cal.com |
| `siteUrl` | Dominio público del sitio | `https://tu-dominio.com` (ver [Dominio final](#dominio-final)) |
| `showTestimonials` | Muestra la sección de testimonios | `true` / `false` |

## Formularios (Web3Forms)

1. Entra en [web3forms.com](https://web3forms.com) y crea una clave gratuita con el email de Claudia (ahí llegarán las consultas).
2. Pega la clave en `web3formsKey`.
3. La clave es pública por diseño: va en el navegador y solo permite enviar mensajes a ese email. No es un secreto.
4. Límite del plan gratuito: **250 envíos por mes**.

Mientras la clave esté vacía, los formularios muestran un aviso de "todavía no habilitado" con WhatsApp/email como alternativa.

**Probar un envío:** con la clave cargada, ejecuta `npx serve public`, completa el formulario de contacto (nombre, email, mensaje de 10+ caracteres, aceptar privacidad) y envía. Debe aparecer el mensaje de éxito y el correo debe llegar a la casilla de Claudia (revisa spam la primera vez). Repite con el formulario de la guía gratuita: el asunto es "Pedido de guía gratuita".

## Agenda

Pega el enlace de Calendly o Cal.com en `bookingUrl`. Todos los botones de reserva (header, hero, sobre mí y sección agenda) lo usan. Si está vacío, caen a WhatsApp con un mensaje prearmado; si tampoco hay WhatsApp, apuntan a `#contacto`.

## Testimonios

La sección viene oculta y vacía. Para activarla:

1. En `public/index.html`, busca `testimonials-track`: justo encima hay una plantilla comentada de testimonio.
2. Cópiala dentro del `<div id="testimonials-track">`, sin los marcadores de comentario, y reemplaza nombre, rol y texto por los reales (con autorización de cada persona).
3. En `config.js` pon `showTestimonials: true`.

La sección solo se muestra si el flag es `true` **y** hay al menos un testimonio cargado.

## Imágenes

Reemplaza estos archivos de `public/assets/images/placeholders/` manteniendo el nombre:

| Archivo | Uso | Tamaño actual |
|---------|-----|---------------|
| `hero-claudia.webp` | Foto principal | 800 × 933 |
| `about-claudia.webp` | Sección "Sobre mí" | 800 × 933 |
| `lead-magnet-guide.webp` | Portada de la guía | 450 × 600 |

Mantén la misma proporción, o actualiza los atributos `width` y `height` del `<img>` en `index.html`: un test compara esos atributos con el tamaño real del archivo y falla si no coinciden.

**Regenerar logo e íconos** (si cambia el logo original en `assets-src/logo-source.jpeg`):

```bash
pip install Pillow                  # requiere una fuente TTF (p. ej. DejaVu Sans)
python3 scripts/build-images.py
```

El script falla con un mensaje claro si no encuentra una fuente.

## Dominio final

La URL base `https://claudia-samudio.vercel.app` es provisoria. Al definir el dominio, reemplázala en:

- `public/index.html` (canonical, `og:url`, `og:image`, `twitter:image` y JSON-LD)
- `public/privacidad.html` (canonical)
- `public/robots.txt` (línea `Sitemap`)
- `public/sitemap.xml` (las dos `<loc>`)
- `public/assets/js/config.js` (`siteUrl`)

`npm test` falla si alguno de estos archivos queda con otro dominio.

## Deploy en Vercel (plan Hobby)

1. Sube el repositorio a GitHub.
2. En [vercel.com/new](https://vercel.com/new), importa el repo.
3. En **Framework Preset** elige **Other**. `vercel.json` ya define el comando de build (`npm run build`) y la carpeta de salida (`public`), no hace falta cambiar nada más.
4. Deploy. Desde ahí, cada push a `main` publica en producción y cada Pull Request genera una vista previa.
5. En **Settings → Domains** agrega el dominio propio y sigue las instrucciones de DNS. Después actualiza la URL base (sección anterior).

Notas:

- **Git LFS:** el PDF de la raíz está en LFS, pero nunca se sirve, así que Vercel no lo necesita. Para hacer `git push` desde el equipo local sí debe estar `git-lfs` instalado.
- Los términos del plan Hobby lo limitan a uso personal y no comercial. Como este sitio promociona un servicio profesional, conviene revisar los términos vigentes de Vercel antes de salir a producción.

## Checklist antes de publicar

**Datos pendientes de Claudia**

- [ ] Número de WhatsApp
- [ ] Email público
- [ ] Redes sociales (Instagram, Facebook, LinkedIn)
- [ ] Dominio definitivo
- [ ] Clave de Web3Forms (con el email de Claudia)
- [ ] Enlace de agenda (Calendly / Cal.com)
- [ ] Foto profesional, biografía y credenciales
- [ ] Testimonios reales (con autorización)
- [ ] Guía gratuita en PDF (y ajustar sus tres viñetas en `index.html`)
- [ ] Confirmar el nombre del programa: el documento fuente alterna entre "Bienestar Consciente 360" y "Vida Consciente 360"

**Antes del lanzamiento**

- [ ] Revisión legal de `privacidad.html` por un profesional (Ley 25.326), incluido el plazo de conservación de **24 meses**, que es un valor provisorio a confirmar con Claudia
- [ ] Envío de prueba de ambos formularios con la clave real
- [ ] `npm test` en verde
- [ ] Dominio final cargado en los cinco lugares de la sección anterior
