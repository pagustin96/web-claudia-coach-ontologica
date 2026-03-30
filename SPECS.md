# Especificaciones Web - Claudia Coach Ontológica

## 1. Información del Proyecto

**Cliente:** Claudia - Coach Ontológica
**Tipo de Proyecto:** Landing Page de Conversión
**Objetivo:** Captar clientes potenciales, vender sesiones, dar a conocer servicios y ofrecer contenido de valor

## 2. Objetivos del Sitio

1. **Captar clientes potenciales** - Conseguir leads/contactos interesados en coaching
2. **Vender sesiones directamente** - Que puedan agendar y pagar sesiones online
3. **Dar a conocer sus servicios** - Presencia online y credibilidad profesional
4. **Ofrecer contenido + captación** - Blog/artículos más formularios de contacto

## 3. Servicios Ofrecidos

1. **Sesiones individuales** - Coaching 1-a-1 personalizado
2. **Programas/paquetes** - Programas de coaching de varias sesiones
3. **Talleres grupales** - Talleres o formaciones grupales
4. **Cursos online** - Contenido educativo en formato curso
5. **Conferencias/charlas** - Speaker para eventos corporativos

## 4. Estructura del Sitio

**Landing Page Única** con las siguientes secciones:

### 4.1 Header/Navegación
- Logo de Claudia
- Navegación sticky: Inicio, Servicios, Sobre Mí, Testimonios, Contacto
- Botón CTA: "Agenda tu Sesión Gratuita"

### 4.2 Hero Section
- Título principal: propuesta de valor clara
- Subtítulo: descripción breve de coaching ontológico
- 2 CTAs principales:
  - Primario: "Agenda tu Sesión Gratuita"
  - Secundario: "Descarga Guía Gratuita"
- Imagen/foto profesional de Claudia

### 4.3 Sección "Qué es el Coaching Ontológico"
- Explicación breve y clara (2-3 párrafos)
- Beneficios principales (3-4 puntos destacados)

### 4.4 Servicios (5 Cards)
1. Sesiones Individuales
2. Programas de Transformación
3. Talleres Grupales
4. Cursos Online
5. Conferencias Corporativas

Cada card incluye:
- Ícono representativo
- Título del servicio
- Descripción breve (2-3 líneas)
- Link "Más información"

### 4.5 Sección "Sobre Claudia"
- Foto profesional
- Biografía (placeholder)
- Credenciales y certificaciones
- Años de experiencia
- Enfoque personal

### 4.6 Testimonios
- Carousel con 3-5 testimonios destacados
- Foto del cliente (placeholder)
- Nombre y ocupación
- Testimonio (2-4 líneas)
- Rating de estrellas

### 4.7 Lead Magnet
- Título: "Descarga Gratuita"
- Subtítulo: Guía/eBook relacionado con coaching ontológico
- Formulario simple: Nombre + Email
- Botón CTA: "Descargar Gratis"
- Imagen del recurso

### 4.8 CTA Principal "Agenda tu Sesión"
- Título impactante
- Descripción de la sesión gratuita
- Formulario de contacto/calendario (placeholder)
- Botón destacado

### 4.9 Formulario de Contacto
- Nombre completo
- Email
- Teléfono (opcional)
- Mensaje
- Checkbox de privacidad
- Botón enviar

### 4.10 Footer
- Logo Claudia
- Links rápidos (Servicios, Sobre Mí, Contacto)
- Redes sociales (Instagram, LinkedIn, Facebook)
- Email de contacto
- Copyright

### 4.11 Elementos Flotantes
- **Botón WhatsApp** (esquina inferior derecha)
  - Verde WhatsApp
  - Ícono + tooltip
  - Link directo a chat

## 5. Estilo Visual

**Concepto:** Profesional y Minimalista

### 5.1 Paleta de Colores
- **Primario:** Azul profundo / Navy (#1e3a8a o similar)
- **Secundario:** Gris claro (#f1f5f9)
- **Acento:** Dorado/Coral suave (#f59e0b o #fb923c)
- **Texto:** Gris oscuro (#1e293b)
- **Fondo:** Blanco (#ffffff)

### 5.2 Tipografía
- **Headings:** Inter o Poppins (font-weight: 600-700)
- **Body:** Inter (font-weight: 400)
- **Tamaños:**
  - H1: 3rem (48px)
  - H2: 2.5rem (40px)
  - H3: 2rem (32px)
  - Body: 1rem (16px)

### 5.3 Espaciado
- Secciones: py-20 (5rem)
- Entre elementos: py-8 a py-12
- Contenedores: max-w-7xl mx-auto

### 5.4 Componentes UI
- Bordes redondeados: rounded-lg (8px)
- Sombras suaves: shadow-md
- Botones: rounded-lg con hover transitions
- Cards: bg-white con border o shadow

## 6. Elementos de Conversión

1. ✅ **Formulario de contacto** - Sección dedicada
2. ✅ **Agenda de sesión gratuita** - CTA principal en hero y sección dedicada
3. ✅ **Descarga de lead magnet** - Sección con formulario
4. ✅ **WhatsApp directo** - Botón flotante
5. ✅ **Testimonios destacados** - Carousel de prueba social

## 7. Tecnologías

- **HTML5** - Estructura semántica
- **Tailwind CSS 3.4+** - Estilos utility-first
- **CSS Variables** - Personalización de tema
- **Vanilla JavaScript** - Interacciones mínimas
- **Componentes de repo_components** - Reutilización de biblioteca existente

## 8. Responsive Design

- **Mobile First:** Diseño prioritario para móviles
- **Breakpoints:**
  - sm: 640px
  - md: 768px
  - lg: 1024px
  - xl: 1280px
  - 2xl: 1536px

## 9. Contenido

**Estado:** Placeholders
- Textos de ejemplo profesionales
- Imágenes placeholder (unsplash o similar)
- Testimonios ficticios pero realistas
- Datos de contacto placeholder

## 10. Componentes a Usar de repo_components

### Del directorio components/:
- `navigation/navbar-centered.html` o similar
- `heroes/hero-centered.html` o `hero-split.html`
- `features/features-grid-3col.html` para servicios
- `testimonials/testimonials-carousel.html`
- `cta/cta-split.html` para lead magnet
- `forms/contact-form.html`
- `footers/footer-multicolumn.html`

### Personalizaciones necesarias:
- Adaptar colores al tema profesional/minimalista
- Ajustar textos y contenido placeholder
- Integrar botón WhatsApp flotante
- Configurar formularios (sin backend por ahora)

## 11. Entregables

1. ✅ SPECS.md (este documento)
2. ⏳ Estructura de carpetas inicializada
3. ⏳ Tailwind configurado con tema custom
4. ⏳ index.html - Landing page completa
5. ⏳ assets/css/variables.css - Variables de tema
6. ⏳ assets/css/output.css - CSS compilado
7. ⏳ assets/js/main.js - Funcionalidad básica
8. ⏳ README.md - Instrucciones de uso

## 12. Próximos Pasos

1. Inicializar estructura del proyecto
2. Configurar Tailwind con tema personalizado
3. Construir landing page sección por sección
4. Agregar interactividad con JavaScript
5. Testing responsive
6. Optimización final

---

**Fecha de creación:** 9 de Febrero 2026
**Última actualización:** 9 de Febrero 2026
