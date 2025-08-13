const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Obtener proyectos recientes (público)
router.get('/', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const projects = await query(
      `SELECT 
        p.id,
        p.title,
        p.description,
        p.daily_pay,
        p.min_duration,
        p.max_duration,
        p.required_technicians,
        p.application_deadline,
        p.project_image,
        p.status,
        p.is_featured,
        p.views_count,
        p.applications_count,
        p.created_at,
        pt.name as project_type,
        l.city,
        l.region,
        l.country,
        CONCAT(l.city, ', ', l.country) as location,
        cp.company_name,
        cp.logo_url as company_logo,
        DATEDIFF(p.application_deadline, CURDATE()) as days_remaining
      FROM projects p
      JOIN project_types pt ON p.project_type_id = pt.id
      JOIN locations l ON p.location_id = l.id
      JOIN company_profiles cp ON p.company_id = cp.user_id
      JOIN users u ON p.company_id = u.id
      WHERE p.status = 'open' 
      AND p.application_deadline >= CURDATE()
      AND u.is_active = TRUE
      ORDER BY p.is_featured DESC, p.created_at DESC
      LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    // Obtener total de proyectos
    const totalResult = await query(
      `SELECT COUNT(*) as total
       FROM projects p
       JOIN users u ON p.company_id = u.id
       WHERE p.status = 'open' 
       AND p.application_deadline >= CURDATE()
       AND u.is_active = TRUE`
    );

    const total = totalResult[0].total;

    res.json({
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener los proyectos'
    });
  }
});

// Obtener proyectos de la empresa
router.get('/my-projects', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo las empresas pueden ver sus proyectos'
      });
    }

    const projects = await query(
      `SELECT 
        p.id,
        p.title,
        p.description,
        p.daily_pay,
        p.min_duration,
        p.max_duration,
        p.required_technicians,
        p.application_deadline,
        p.project_image,
        p.status,
        p.is_featured,
        p.views_count,
        p.applications_count,
        p.created_at,
        pt.name as project_type,
        l.city,
        l.region,
        l.country,
        CONCAT(l.city, ', ', l.country) as location
      FROM projects p
      JOIN project_types pt ON p.project_type_id = pt.id
      JOIN locations l ON p.location_id = l.id
      WHERE p.company_id = ?
      ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    res.json({
      projects,
      total: projects.length
    });
  } catch (error) {
    console.error('Error obteniendo proyectos de la empresa:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener los proyectos'
    });
  }
});

// Obtener estadísticas de proyectos de la empresa
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo las empresas pueden ver estadísticas de proyectos'
      });
    }

    const stats = await query(
      `SELECT 
        COUNT(*) as total_projects,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as active_projects,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_projects,
        SUM(views_count) as total_views,
        SUM(applications_count) as total_applications
      FROM projects 
      WHERE company_id = ?`,
      [req.user.userId]
    );

    res.json(stats[0]);
  } catch (error) {
    console.error('Error obteniendo estadísticas de proyectos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las estadísticas'
    });
  }
});

// Obtener aplicaciones recibidas por la empresa
router.get('/applications/received', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo las empresas pueden ver aplicaciones recibidas'
      });
    }

    const applications = await query(
      `SELECT 
        pa.id,
        pa.project_id,
        pa.technician_id,
        pa.status,
        pa.cover_letter,
        pa.proposed_rate,
        pa.created_at,
        p.title as project_title,
        p.daily_pay,
        p.min_duration,
        p.max_duration,
        u.full_name as technician_name,
        u.email as technician_email,
        u.phone as technician_phone,
        tp.experience_years,
        tp.rating,
        tp.skills,
        tp.cv_uploaded
      FROM project_applications pa
      JOIN projects p ON pa.project_id = p.id
      JOIN users u ON pa.technician_id = u.id
      LEFT JOIN technician_profiles tp ON u.id = tp.user_id
      WHERE p.company_id = ?
      ORDER BY pa.created_at DESC`,
      [req.user.userId]
    );

    res.json({
      applications,
      total: applications.length
    });
  } catch (error) {
    console.error('Error obteniendo aplicaciones recibidas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las aplicaciones'
    });
  }
});

// Crear nuevo proyecto
router.post('/', authenticateToken, [
  body('title').notEmpty().withMessage('Título requerido'),
  body('description').notEmpty().withMessage('Descripción requerida'),
  body('projectTypeId').isInt().withMessage('Tipo de proyecto inválido'),
  body('locationId').isInt().withMessage('Ubicación inválida'),
  body('dailyPay').isFloat({ min: 0 }).withMessage('Pago diario inválido'),
  body('minDuration').isInt({ min: 1 }).withMessage('Duración mínima inválida'),
  body('maxDuration').isInt({ min: 1 }).withMessage('Duración máxima inválida'),
  body('requiredTechnicians').isInt({ min: 1 }).withMessage('Número de técnicos inválido'),
  body('applicationDeadline').isDate().withMessage('Fecha de cierre inválida')
], async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo las empresas pueden crear proyectos'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const {
      title,
      description,
      projectTypeId,
      locationId,
      dailyPay,
      minDuration,
      maxDuration,
      requiredTechnicians,
      applicationDeadline,
      projectImage
    } = req.body;

    const result = await query(
      `INSERT INTO projects (
        company_id, title, description, project_type_id, location_id,
        daily_pay, min_duration, max_duration, required_technicians,
        application_deadline, project_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.userId, title, description, projectTypeId, locationId,
        dailyPay, minDuration, maxDuration, requiredTechnicians,
        applicationDeadline, projectImage
      ]
    );

    res.status(201).json({
      message: 'Proyecto creado exitosamente',
      projectId: result.insertId
    });

  } catch (error) {
    console.error('Error creando proyecto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al crear el proyecto'
    });
  }
});

// Obtener tipos de proyectos
router.get('/types', async (req, res) => {
  try {
    const types = await query(
      'SELECT id, name, description, icon FROM project_types WHERE is_active = TRUE ORDER BY name'
    );

    res.json({ types });
  } catch (error) {
    console.error('Error obteniendo tipos de proyectos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener los tipos de proyectos'
    });
  }
});

// Obtener ubicaciones
router.get('/locations', async (req, res) => {
  try {
    const locations = await query(
      'SELECT id, city, region, country FROM locations WHERE is_active = TRUE ORDER BY city'
    );

    res.json({ locations });
  } catch (error) {
    console.error('Error obteniendo ubicaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las ubicaciones'
    });
  }
});

module.exports = router; 