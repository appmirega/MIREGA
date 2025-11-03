# 📋 Guía de Despliegue - Sistema MIREGA

## ✅ Cambios Realizados

### Eliminaciones
- ❌ Menú "Historial de Actividad" removido de todos los perfiles
- ❌ Menú "Partes y Piezas" como vista separada removido
- ❌ Imports innecesarios eliminados de App.tsx

### Integración
- ✅ Gestión de Partes y Piezas integrada en "Gestión de Ascensores"
- ✅ Sistema de solicitudes de repuestos implementado
- ✅ Sistema de permisos granulares configurado

---

## 🚀 Requisitos para Subir al Servidor

### 1. Variables de Entorno Requeridas

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

**IMPORTANTE:** Reemplaza estos valores con tus credenciales reales de Supabase.

#### Dónde obtener las credenciales:
1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Click en "Settings" → "API"
3. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

---

### 2. Base de Datos Supabase

#### Migraciones Aplicadas
Todas las migraciones ya están aplicadas en tu base de datos:

✅ Schema completo de ascensores, clientes, usuarios
✅ Sistema de mantenimientos y emergencias
✅ Sistema de cotizaciones
✅ Sistema de partes y piezas (nuevas tablas)
✅ Sistema de permisos granulares
✅ Row Level Security (RLS) configurado

#### Verificar Migraciones
En Supabase Dashboard:
1. Ve a "Database" → "Migrations"
2. Verifica que todas las migraciones estén aplicadas (✓ verde)

---

### 3. Storage Buckets Requeridos

Asegúrate de tener estos buckets creados en Supabase Storage:

#### Buckets Necesarios:
- **`maintenance-photos`** - Fotos de mantenimientos, emergencias y partes
- **`technical-manuals`** - Manuales técnicos PDF

#### Políticas de Storage:
Todos los buckets deben tener:
- **SELECT**: Authenticated users can read
- **INSERT**: Authenticated users can upload
- **DELETE**: Authenticated users can delete own files

#### Crear Buckets (si no existen):
```sql
-- En Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('maintenance-photos', 'maintenance-photos', false),
  ('technical-manuals', 'technical-manuals', false)
ON CONFLICT (id) DO NOTHING;
```

---

### 4. Edge Functions Desplegadas

Las siguientes Edge Functions deben estar desplegadas:

1. **`create-user`** - Crear usuarios en el sistema
2. **`update-user-password`** - Actualizar contraseñas
3. **`check-certifications-alerts`** - Alertas de certificaciones

#### Desplegar Edge Functions:
Ya están en `supabase/functions/`. Si necesitas redesplegarlas, usa:
```bash
supabase functions deploy create-user
supabase functions deploy update-user-password
supabase functions deploy check-certifications-alerts
```

---

### 5. Configuración de Autenticación

En Supabase Dashboard → Authentication → Settings:

#### Email Templates:
- ✅ Confirma que los templates de email estén configurados
- ✅ Email confirmation puede estar **deshabilitado** (el sistema no lo usa)

#### Providers:
- ✅ Email/Password debe estar **habilitado**

#### URL Configuration:
- Site URL: `https://tu-dominio.com`
- Redirect URLs: Agregar tu dominio de producción

---

### 6. Opciones de Despliegue

#### Opción A: Vercel (Recomendado)

**Ya está configurado con `vercel.json`**

1. Instala Vercel CLI:
```bash
npm install -g vercel
```

2. Login en Vercel:
```bash
vercel login
```

3. Despliega:
```bash
vercel --prod
```

4. Configura variables de entorno en Vercel Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

#### Opción B: Netlify

1. Crea un archivo `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

2. Despliega desde Netlify Dashboard
3. Configura las variables de entorno

#### Opción C: Servidor Propio (VPS/Apache/Nginx)

**Requisitos:**
- Node.js 18+ (solo para build)
- Apache o Nginx

**Pasos:**

1. Compila el proyecto:
```bash
npm install
npm run build
```

2. Sube la carpeta `dist/` al servidor

3. Configuración de Nginx:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    root /var/www/mirega/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Headers de seguridad
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "DENY";
    add_header X-XSS-Protection "1; mode=block";
}
```

4. Configuración de Apache (.htaccess):
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Headers de seguridad
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "DENY"
  Header set X-XSS-Protection "1; mode=block"
</IfModule>
```

---

### 7. Variables de Entorno en Producción

**IMPORTANTE:** Las variables DEBEN tener el prefijo `VITE_` para que Vite las incluya en el build.

En tu plataforma de hosting (Vercel, Netlify, etc.):

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 8. Checklist Pre-Despliegue

Antes de subir al servidor, verifica:

- [ ] Variables de entorno configuradas
- [ ] Base de datos Supabase activa
- [ ] Todas las migraciones aplicadas
- [ ] Storage buckets creados
- [ ] Edge Functions desplegadas
- [ ] RLS policies habilitadas
- [ ] Authentication configurada
- [ ] Build local exitoso (`npm run build`)
- [ ] No hay errores en consola

---

### 9. Verificación Post-Despliegue

Después de desplegar:

1. **Login**
   - [ ] Puedes iniciar sesión con credenciales válidas

2. **Funcionalidades Críticas**
   - [ ] Dashboard carga correctamente
   - [ ] Gestión de Ascensores funciona
   - [ ] Gestión de Partes y Piezas accesible
   - [ ] Subida de fotos funciona
   - [ ] Mantenimientos y emergencias funcionan

3. **Permisos**
   - [ ] Developer ve todas las vistas
   - [ ] Admin ve vistas correctas
   - [ ] Técnico ve vistas limitadas
   - [ ] Cliente ve solo sus datos

---

### 10. Comandos Útiles

```bash
# Instalar dependencias
npm install

# Compilar para producción
npm run build

# Vista previa local del build
npm run preview

# Verificar tipos TypeScript
npm run typecheck

# Linter
npm run lint
```

---

### 11. Estructura de Archivos

```
dist/                    # Build de producción (subir esto al servidor)
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
supabase/
├── functions/           # Edge Functions
└── migrations/          # Migraciones SQL
src/                     # Código fuente
```

---

### 12. Troubleshooting

#### Error: "Invalid API Key"
- Verifica que las variables de entorno estén correctas
- Asegúrate que tengan el prefijo `VITE_`
- Reconstruye el proyecto después de cambiar variables

#### Error: "Database connection failed"
- Verifica que la URL de Supabase sea correcta
- Confirma que el proyecto de Supabase esté activo

#### Error 404 en rutas
- Verifica configuración de rewrites (vercel.json o netlify.toml)
- Para Apache/Nginx, revisa configuración de try_files

#### Fotos no se suben
- Verifica que los buckets de Storage existan
- Confirma que las políticas de RLS permitan uploads

---

### 13. Seguridad

**Ya implementado:**
- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Headers de seguridad (X-Frame-Options, etc.)
- ✅ Autenticación obligatoria
- ✅ Validaciones de permisos por rol

**Recomendaciones adicionales:**
- Habilita SSL/HTTPS en tu servidor
- Configura firewall si usas VPS
- Monitorea logs de Supabase

---

### 14. Soporte y Contacto

**Documentación oficial:**
- Supabase: https://supabase.com/docs
- Vite: https://vitejs.dev/
- React: https://react.dev/

**Logs y Debugging:**
- Supabase Dashboard → Logs
- Browser DevTools → Console
- Vercel/Netlify Dashboard → Functions Logs

---

## ✅ Sistema Listo para Producción

El sistema ha sido optimizado y está listo para despliegue. Todos los archivos innecesarios han sido removidos y las funcionalidades están completamente integradas.

**Tamaño del Build:**
- CSS: ~40 KB (gzipped: 7 KB)
- JS: ~2.1 MB (gzipped: 563 KB)
- Total: Optimizado para producción

**Navegadores Soportados:**
- Chrome/Edge (últimas 2 versiones)
- Firefox (últimas 2 versiones)
- Safari (últimas 2 versiones)

---

**Fecha de última actualización:** 31 de Octubre 2025
**Versión del sistema:** 2.0.0 (Integración de Partes y Piezas)
