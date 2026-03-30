# Claudia Coach Ontologica - Landing Page

Landing page profesional para Claudia, Coach Ontologica certificada.

## Estructura del Proyecto

```
/
├── index.html              # Landing page principal
├── assets/
│   ├── css/
│   │   ├── variables.css   # Variables CSS personalizadas
│   │   ├── input.css       # Archivo fuente de Tailwind
│   │   └── output.css      # CSS compilado (generado con npm run build)
│   └── js/
│       └── main.js         # JavaScript principal
├── tailwind.config.js      # Configuracion de Tailwind
├── package.json            # Dependencias del proyecto
├── SPECS.md                # Especificaciones del proyecto
└── README.md               # Este archivo
```

## Secciones de la Landing Page

1. **Header/Navegacion** - Menu sticky con logo y CTA principal
2. **Hero Section** - Propuesta de valor con CTAs duales
3. **Que es Coaching Ontologico** - Explicacion y beneficios
4. **Servicios** - 5 cards con los servicios ofrecidos
5. **Sobre Claudia** - Biografia y credenciales
6. **Testimonios** - Carousel con testimonios de clientes
7. **Lead Magnet** - Descarga de guia gratuita con formulario
8. **Agenda tu Sesion** - CTA principal con placeholder para calendario
9. **Formulario de Contacto** - Formulario completo
10. **Footer** - Links, redes sociales y copyright
11. **Boton WhatsApp** - Flotante en esquina inferior derecha

## Tecnologias Utilizadas

- **HTML5** - Estructura semantica
- **Tailwind CSS** - Framework de estilos utility-first
- **CSS Variables** - Sistema de temas personalizable
- **Vanilla JavaScript** - Interactividad sin dependencias

## Inicio Rapido

### Opcion 1: Solo abrir el archivo (Recomendado para preview)

Simplemente abre `index.html` en tu navegador. La pagina usa Tailwind CSS via CDN, por lo que funciona sin necesidad de compilacion.

### Opcion 2: Desarrollo con compilacion local

Si deseas compilar el CSS localmente para produccion:

```bash
# Instalar dependencias
npm install

# Compilar CSS (una vez)
npm run build

# Compilar CSS con watch (desarrollo)
npm run watch

# Compilar CSS minificado (produccion)
npm run build:prod
```

## Personalizacion

### Colores

Edita las variables en `assets/css/variables.css`:

```css
:root {
    --color-primary: #1e3a8a;      /* Azul navy */
    --color-accent: #f59e0b;       /* Dorado/Coral */
    --color-text: #1e293b;         /* Texto principal */
    --color-background: #ffffff;   /* Fondo */
}
```

### Contenido

Reemplaza los placeholders en `index.html`:

1. **Logo**: Reemplaza la imagen del logo
2. **Fotos**: Actualiza las URLs de imagenes de Unsplash
3. **Textos**: Modifica los textos segun las necesidades del cliente
4. **Testimonios**: Agrega testimonios reales
5. **Contacto**: Actualiza email, telefono y redes sociales

### WhatsApp

Actualiza el numero de WhatsApp en:
- Boton flotante (linea ~920)
- Seccion de contacto (linea ~750)
- Seccion de agenda (linea ~600)

```html
href="https://wa.me/TU_NUMERO_AQUI"
```

### Calendario de Citas

En la seccion "Agenda tu Sesion" hay un placeholder para integrar:
- [Calendly](https://calendly.com)
- [Cal.com](https://cal.com)
- Cualquier otro sistema de agendamiento

## Integraciones Pendientes

- [ ] Integrar calendario de citas (Calendly/Cal.com)
- [ ] Conectar formulario de contacto (Formspree/Netlify Forms)
- [ ] Conectar formulario de lead magnet (Mailchimp/ConvertKit)
- [ ] Agregar Google Analytics
- [ ] Configurar Open Graph meta tags

## Responsive Design

La pagina es completamente responsive con breakpoints:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Navegadores Soportados

- Chrome (ultimas 2 versiones)
- Firefox (ultimas 2 versiones)
- Safari (ultimas 2 versiones)
- Edge (ultimas 2 versiones)

## Licencia

Proyecto privado para uso del cliente.

---

Desarrollado con amor para ayudar a Claudia a transformar vidas a traves del coaching ontologico.
