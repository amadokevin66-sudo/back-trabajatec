# 🛠️ TrabajaTecnico - Plataforma de Conexión entre Técnicos y Empresas

Plataforma web completa para conectar técnicos especializados con empresas que necesitan servicios técnicos en Perú.

## 🚀 Características Principales

### 👥 **Usuarios**
- **Técnicos**: Registro de perfiles, búsqueda de proyectos, aplicaciones
- **Empresas**: Publicación de proyectos, gestión de aplicaciones
- **Sistema de autenticación** seguro con JWT

### 📋 **Proyectos**
- **Publicación de proyectos** con detalles completos
- **Filtros avanzados** por ubicación, tipo, pago, duración
- **Sistema de aplicaciones** para técnicos
- **Fechas de cierre** automáticas
- **Proyectos destacados** y similares

### 💬 **Comunicación**
- **Sistema de mensajes** entre usuarios
- **Notificaciones** en tiempo real
- **Reseñas y calificaciones**

### 🎨 **Frontend**
- **Next.js 15** con App Router
- **TypeScript** para type safety
- **Tailwind CSS** para estilos
- **Framer Motion** para animaciones
- **Lucide React** para iconos
- **Diseño responsive** y moderno

### 🔧 **Backend**
- **Node.js** con Express
- **MySQL** como base de datos
- **JWT** para autenticación
- **Validación** de datos con express-validator
- **Rate limiting** y seguridad
- **API RESTful** completa

## 📋 Requisitos Previos

- **Node.js** 18+ 
- **MySQL** 8.0+
- **npm** o **yarn**

## 🛠️ Instalación

### 1. Clonar el Repositorio
```bash
git clone <tu-repositorio>
cd ltc
```

### 2. Configurar la Base de Datos

#### Opción A: Usar phpMyAdmin
1. Abre phpMyAdmin
2. Crea una nueva base de datos llamada `milloper_trabajatecnico_db`
3. Importa el archivo `database.sql` desde la raíz del proyecto

#### Opción B: Usar MySQL CLI
```bash
mysql -u root -p
CREATE DATABASE milloper_trabajatecnico_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE milloper_trabajatecnico_db;
SOURCE database.sql;
```

### 3. Configurar Variables de Entorno

#### Frontend (Next.js)
```bash
cd ltc
cp .env.example .env.local
```

Edita `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

#### Backend (Node.js)
```bash
cd backend
cp env.example .env
```

Edita `.env`:
```env
# Configuración de la Base de Datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=milloper_trabajatecnico_db
DB_PORT=3306

# Configuración del Servidor
PORT=3001
NODE_ENV=development

# JWT Secret (cambia por uno seguro)
JWT_SECRET=tu_jwt_secret_super_seguro_aqui
JWT_EXPIRES_IN=7d

# Configuración de Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=hola.trabajatecnico@gmail.com
EMAIL_PASS=tu_app_password_de_gmail

# Configuración de la Aplicación
SITE_URL=http://localhost:3000
API_URL=http://localhost:3001
SITE_NAME=TrabajaTecnico
CONTACT_PHONE=+51 938837676
CONTACT_EMAIL=hola.trabajatecnico@gmail.com
```

### 4. Instalar Dependencias

#### Frontend
```bash
cd ltc
npm install
```

#### Backend
```bash
cd backend
npm install
```

### 5. Ejecutar la Aplicación

#### Desarrollo
```bash
# Terminal 1 - Frontend
cd ltc
npm run dev

# Terminal 2 - Backend
cd backend
npm run dev
```

#### Producción
```bash
# Frontend
cd ltc
npm run build
npm start

# Backend
cd backend
npm start
```

## 🌐 URLs de Acceso

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Health Check**: http://localhost:3001/api/health

## 📊 Estructura de la Base de Datos

### Tablas Principales
- `users` - Usuarios del sistema
- `technician_profiles` - Perfiles de técnicos
- `company_profiles` - Perfiles de empresas
- `projects` - Proyectos publicados
- `project_applications` - Aplicaciones a proyectos
- `messages` - Mensajes entre usuarios
- `reviews` - Reseñas y calificaciones
- `notifications` - Notificaciones del sistema

### Datos Iniciales
- **8 proyectos** de ejemplo con ubicaciones peruanas
- **8 empresas** con perfiles completos
- **10 tipos de proyectos** (Aire acondicionado, Electricidad, etc.)
- **8 ubicaciones** de Perú (Lima, Arequipa, Trujillo, etc.)

## 🔧 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Inicio de sesión
- `GET /api/auth/verify` - Verificar token
- `POST /api/auth/logout` - Cerrar sesión

### Proyectos
- `GET /api/projects` - Listar proyectos con filtros
- `GET /api/projects/:id` - Obtener proyecto específico
- `POST /api/projects` - Crear proyecto (empresas)
- `PUT /api/projects/:id` - Actualizar proyecto
- `DELETE /api/projects/:id` - Eliminar proyecto

### Usuarios
- `GET /api/users/profile` - Obtener perfil
- `PUT /api/users/profile` - Actualizar perfil
- `GET /api/users/:id` - Obtener usuario público

### Aplicaciones
- `POST /api/applications` - Aplicar a proyecto
- `GET /api/applications/my` - Mis aplicaciones
- `PUT /api/applications/:id` - Actualizar aplicación

## 🎨 Características del Frontend

### Páginas Principales
- **Home** - Página principal con estadísticas y proyectos destacados
- **Proyectos** - Lista de proyectos con filtros avanzados
- **Detalle de Proyecto** - Información completa del proyecto
- **Login/Registro** - Autenticación de usuarios
- **About** - Información sobre la plataforma

### Componentes Reutilizables
- `Header` - Navegación principal
- `Footer` - Pie de página con información de contacto
- `ProjectCard` - Tarjeta de proyecto
- `SearchBar` - Búsqueda y filtros
- `AnimatedCounter` - Contador animado

### Funcionalidades
- **Filtros dinámicos** por ubicación, tipo, pago, duración
- **Búsqueda en tiempo real**
- **Animaciones suaves** con Framer Motion
- **Diseño responsive** para móviles y desktop
- **Moneda en Soles** peruanos
- **Fechas de cierre** con estados visuales

## 🔒 Seguridad

### Backend
- **JWT** para autenticación
- **bcrypt** para encriptación de contraseñas
- **Rate limiting** para prevenir spam
- **Helmet** para headers de seguridad
- **Validación** de datos en todas las rutas
- **CORS** configurado correctamente

### Frontend
- **Validación** de formularios
- **Sanitización** de datos
- **Protección** de rutas privadas
- **Manejo** seguro de tokens

## 📱 Responsive Design

La aplicación está completamente optimizada para:
- **Desktop** (1200px+)
- **Tablet** (768px - 1199px)
- **Mobile** (320px - 767px)

## 🚀 Despliegue

### Opción 1: Hosting Compartido
1. Sube los archivos del frontend a tu hosting
2. Configura el backend en un servidor Node.js
3. Configura la base de datos MySQL
4. Actualiza las variables de entorno

### Opción 2: VPS/Dedicado
1. Instala Node.js y MySQL en tu servidor
2. Clona el repositorio
3. Configura PM2 para el backend
4. Configura Nginx como proxy reverso
5. Configura SSL con Let's Encrypt

### Opción 3: Plataformas Cloud
- **Vercel** para el frontend
- **Railway/Render** para el backend
- **PlanetScale** para la base de datos

## 📞 Contacto

- **Email**: hola.trabajatecnico@gmail.com
- **Teléfono**: +51 938837676
- **Ubicación**: Lima, Perú

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

---

## 🎯 Próximas Características

- [ ] **Sistema de pagos** integrado
- [ ] **Chat en tiempo real** con WebSockets
- [ ] **Notificaciones push** móviles
- [ ] **App móvil** nativa
- [ ] **Sistema de verificación** de documentos
- [ ] **Dashboard** administrativo
- [ ] **Reportes** y estadísticas avanzadas
- [ ] **Integración** con redes sociales

---

**¡Conectando talento técnico con oportunidades en Perú! 🇵🇪**
