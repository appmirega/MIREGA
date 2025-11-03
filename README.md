# MIREGA - Sistema de Gestión de Ascensores

Sistema integral para la gestión de mantenimiento, emergencias y operaciones de ascensores.

## Características Principales

- **Gestión de Usuarios**: Administradores, Técnicos, Clientes y Desarrolladores
- **Checklist de Mantenimiento**: Sistema completo con códigos QR y capturas fotográficas
- **Gestión de Emergencias**: Registro y seguimiento de emergencias con múltiples ascensores
- **Órdenes de Trabajo**: Sistema de cierre con fotos y firmas digitales
- **Notificaciones y Recordatorios**: Centro de notificaciones unificado
- **Cotizaciones**: Gestión de cotizaciones internas y externas
- **Carpeta Cero**: Documentación completa de clientes
- **Manuales Técnicos**: Repositorio de documentación técnica

## Tecnologías

- **Frontend**: React + TypeScript + Vite
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Storage**: Supabase Storage
- **Estilos**: Tailwind CSS

## Instalación

```bash
npm install
```

## Configuración

1. Crear archivo `.env` basado en `.env.example`
2. Configurar credenciales de Supabase:
   - `VITE_BOLT_DATABASE_URL`: URL de tu proyecto Supabase
   - `VITE_BOLT_DATABASE_ANON_KEY`: Anon key de Supabase

**Nota para Vercel:** Las variables de entorno deben configurarse en Settings → Environment Variables del proyecto en Vercel. Después de agregar las variables, hacer un nuevo deployment sin usar cache.

## Desarrollo

```bash
npm run dev
```

## Construcción

```bash
npm run build
```

## Estructura del Proyecto

```
src/
├── components/         # Componentes React
│   ├── dashboards/    # Dashboards por rol
│   ├── forms/         # Formularios
│   ├── views/         # Vistas principales
│   └── ...
├── contexts/          # Contextos React
├── hooks/             # Custom hooks
├── lib/               # Librerías y configuración
├── services/          # Servicios
└── utils/             # Utilidades

supabase/
└── migrations/        # Migraciones de base de datos
```

## Roles de Usuario

- **Developer**: Acceso completo al sistema
- **Admin**: Gestión administrativa y operativa
- **Technician**: Operaciones de mantenimiento y emergencias
- **Client**: Visualización de información y servicios
