const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Token requerido',
        message: 'Debes proporcionar un token de autenticación'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el usuario existe y está activo
    const [user] = await query(
      'SELECT id, email, full_name, user_type, is_verified, is_active FROM users WHERE id = ? AND is_active = TRUE',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        error: 'Usuario no encontrado',
        message: 'El usuario asociado al token no existe o está inactivo'
      });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      userType: user.user_type,
      fullName: user.full_name,
      isVerified: user.is_verified
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Tu sesión ha expirado, inicia sesión nuevamente'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token proporcionado no es válido'
      });
    }

    console.error('Error en autenticación:', error);
    return res.status(500).json({
      error: 'Error de autenticación',
      message: 'Error interno del servidor'
    });
  }
};

// Middleware para verificar roles específicos
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'No autorizado',
        message: 'Debes iniciar sesión para acceder a este recurso'
      });
    }

    if (!roles.includes(req.user.user_type)) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
  };
};

// Middleware para verificar que el usuario es propietario del recurso
const requireOwnership = (resourceTable, resourceIdField = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id || req.body.id;
      
      if (!resourceId) {
        return res.status(400).json({
          error: 'ID requerido',
          message: 'Se requiere el ID del recurso'
        });
      }

      // Verificar que el usuario es propietario del recurso
      const [resource] = await query(
        `SELECT * FROM ${resourceTable} WHERE ${resourceIdField} = ? AND user_id = ?`,
        [resourceId, req.user.id]
      );

      if (!resource) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tienes permisos para acceder a este recurso'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Error en verificación de propiedad:', error);
      return res.status(500).json({
        error: 'Error interno',
        message: 'Error al verificar permisos'
      });
    }
  };
};

// Middleware para verificar que el proyecto existe y está abierto
const requireOpenProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({
        error: 'ID de proyecto requerido',
        message: 'Se requiere el ID del proyecto'
      });
    }

    const [project] = await query(
      `SELECT p.*, pt.name as project_type, l.city, l.region, l.country,
              CONCAT(l.city, ', ', l.country) as location,
              cp.company_name, cp.logo_url as company_logo
       FROM projects p
       JOIN project_types pt ON p.project_type_id = pt.id
       JOIN locations l ON p.location_id = l.id
       JOIN company_profiles cp ON p.company_id = cp.user_id
       WHERE p.id = ? AND p.status = 'open' AND p.application_deadline >= CURDATE()`,
      [projectId]
    );

    if (!project) {
      return res.status(404).json({
        error: 'Proyecto no encontrado',
        message: 'El proyecto no existe o no está disponible'
      });
    }

    req.project = project;
    next();
  } catch (error) {
    console.error('Error al verificar proyecto:', error);
    return res.status(500).json({
      error: 'Error interno',
      message: 'Error al verificar el proyecto'
    });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnership,
  requireOpenProject
}; 