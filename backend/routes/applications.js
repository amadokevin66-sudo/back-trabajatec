const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sendJobApplicationEmail, sendApplicationConfirmationEmail } = require('../services/emailService');
const { createJobApplicationNotification, createNewApplicationNotification } = require('../services/notificationService');
const path = require('path');

const router = express.Router();

// Actualizar estado de una aplicación
router.put('/:id/status', authenticateToken, [
  body('status').isIn(['pending', 'accepted', 'rejected', 'withdrawn']).withMessage('Estado inválido'),
  body('message').optional().isString().withMessage('Mensaje inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { status, message } = req.body;

    // Verificar que la aplicación existe
    const [application] = await query(
      `SELECT pa.*, p.title, p.company_id, u.full_name as technician_name, u.email as technician_email
       FROM project_applications pa
       JOIN projects p ON pa.project_id = p.id
       JOIN users u ON pa.technician_id = u.id
       WHERE pa.id = ?`,
      [id]
    );

    if (!application) {
      return res.status(404).json({
        error: 'Aplicación no encontrada',
        message: 'La aplicación no existe'
      });
    }

    // Verificar permisos (solo la empresa propietaria del proyecto puede cambiar el estado)
    if (req.user.userType !== 'company' || application.company_id !== req.user.userId) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tienes permisos para cambiar el estado de esta aplicación'
      });
    }

    // Actualizar el estado
    await query(
      'UPDATE project_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    // Crear notificación para el técnico
    const { createApplicationStatusNotification } = require('../services/notificationService');
    await createApplicationStatusNotification(
      application.technician_id,
      application.project_id,
      application.title,
      status
    );

    res.json({
      message: 'Estado de aplicación actualizado exitosamente',
      status
    });

  } catch (error) {
    console.error('Error actualizando estado de aplicación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al actualizar el estado de la aplicación'
    });
  }
});

// Retirar aplicación (solo el técnico puede retirar su propia aplicación)
router.put('/:id/withdraw', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la aplicación existe y pertenece al técnico
    const [application] = await query(
      `SELECT pa.*, p.title FROM project_applications pa
       JOIN projects p ON pa.project_id = p.id
       WHERE pa.id = ? AND pa.technician_id = ?`,
      [id, req.user.userId]
    );

    if (!application) {
      return res.status(404).json({
        error: 'Aplicación no encontrada',
        message: 'La aplicación no existe o no tienes permisos para modificarla'
      });
    }

    // Verificar que el usuario sea técnico
    if (req.user.userType !== 'technician') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los técnicos pueden retirar aplicaciones'
      });
    }

    // Verificar que la aplicación esté en estado pendiente
    if (application.status !== 'pending') {
      return res.status(400).json({
        error: 'Estado inválido',
        message: 'Solo se pueden retirar aplicaciones pendientes'
      });
    }

    // Actualizar el estado a retirado
    await query(
      'UPDATE project_applications SET status = "withdrawn", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    // Crear notificación para el técnico
    await createApplicationStatusNotification(
      req.user.userId,
      application.project_id,
      application.title,
      'withdrawn'
    );

    res.json({
      message: 'Aplicación retirada exitosamente'
    });

  } catch (error) {
    console.error('Error retirando aplicación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al retirar la aplicación'
    });
  }
});

// Obtener aplicaciones del técnico
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const applications = await query(
      `SELECT 
        pa.id,
        pa.project_id,
        pa.status,
        pa.cover_letter,
        pa.proposed_rate,
        pa.created_at,
        p.title as project_title,
        p.daily_pay,
        p.min_duration,
        p.max_duration,
        p.project_image,
        pt.name as project_type,
        l.city,
        l.region,
        cp.company_name,
        cp.logo_url as company_logo
      FROM project_applications pa
      JOIN projects p ON pa.project_id = p.id
      JOIN project_types pt ON p.project_type_id = pt.id
      JOIN locations l ON p.location_id = l.id
      JOIN company_profiles cp ON p.company_id = cp.user_id
      WHERE pa.technician_id = ?
      ORDER BY pa.created_at DESC`,
      [req.user.userId]
    );

    res.json({
      applications,
      total: applications.length
    });
  } catch (error) {
    console.error('Error obteniendo aplicaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las aplicaciones'
    });
  }
});

// Obtener estadísticas de aplicaciones del técnico
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await query(
      `SELECT 
        COUNT(*) as total_applications,
        SUM(CASE WHEN pa.status = 'accepted' THEN 1 ELSE 0 END) as accepted_applications,
        SUM(CASE WHEN pa.status = 'rejected' THEN 1 ELSE 0 END) as rejected_applications,
        SUM(CASE WHEN pa.status = 'pending' THEN 1 ELSE 0 END) as pending_applications,
        AVG(CASE WHEN pa.status = 'accepted' THEN p.daily_pay * p.min_duration ELSE NULL END) as avg_earnings
      FROM project_applications pa
      JOIN projects p ON pa.project_id = p.id
      WHERE pa.technician_id = ?`,
      [req.user.userId]
    );

    // Obtener calificación promedio
    const ratingResult = await query(
      `SELECT AVG(rating) as avg_rating
       FROM reviews 
       WHERE reviewed_id = ?`,
      [req.user.userId]
    );

    const result = {
      applications: stats[0].total_applications || 0,
      completed: stats[0].accepted_applications || 0,
      rating: ratingResult[0].avg_rating || 0,
      earnings: stats[0].avg_earnings || 0
    };

    res.json(result);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las estadísticas'
    });
  }
});

// Aplicar a un proyecto
router.post('/', authenticateToken, [
  body('projectId').isInt().withMessage('ID de proyecto inválido'),
  body('coverLetter').notEmpty().withMessage('Carta de presentación requerida'),
  body('proposedRate').optional().isFloat().withMessage('Tarifa propuesta inválida'),
  body('availabilityStart').optional().isDate().withMessage('Fecha de inicio inválida'),
  body('availabilityEnd').optional().isDate().withMessage('Fecha de fin inválida')
], async (req, res) => {
  try {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { projectId, coverLetter, proposedRate, availabilityStart, availabilityEnd } = req.body;

    // Verificar que el usuario sea técnico
    if (req.user.userType !== 'technician') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los técnicos pueden aplicar a proyectos'
      });
    }

    // Verificar que el técnico tenga CV subido
    const technicianProfile = await query(
      'SELECT cv_uploaded FROM technician_profiles WHERE user_id = ?',
      [req.user.userId]
    );

    if (technicianProfile.length === 0 || !technicianProfile[0].cv_uploaded) {
      return res.status(400).json({
        error: 'CV requerido',
        message: 'Debes subir tu CV antes de poder aplicar a proyectos'
      });
    }

    // Verificar que el proyecto existe y está abierto
    const project = await query(
      'SELECT * FROM projects WHERE id = ? AND status = "open"',
      [projectId]
    );

    if (project.length === 0) {
      return res.status(404).json({
        error: 'Proyecto no encontrado',
        message: 'El proyecto no existe o no está disponible'
      });
    }

    // Verificar que no haya aplicado antes
    const existingApplication = await query(
      'SELECT id FROM project_applications WHERE project_id = ? AND technician_id = ?',
      [projectId, req.user.userId]
    );

    if (existingApplication.length > 0) {
      return res.status(400).json({
        error: 'Ya aplicaste',
        message: 'Ya has aplicado a este proyecto'
      });
    }

    // Crear la aplicación
    const result = await query(
      `INSERT INTO project_applications 
       (project_id, technician_id, cover_letter, proposed_rate, availability_start, availability_end) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, req.user.userId, coverLetter, proposedRate, availabilityStart, availabilityEnd]
    );

    // Obtener información adicional para notificaciones y emails
    const [projectInfo] = await query(
      `SELECT p.title, p.company_id, cp.company_name 
       FROM projects p 
       JOIN company_profiles cp ON p.company_id = cp.user_id 
       WHERE p.id = ?`,
      [projectId]
    );

    const [technicianInfo] = await query(
      `SELECT u.full_name, u.email, tp.cv_file 
       FROM users u 
       LEFT JOIN technician_profiles tp ON u.id = tp.user_id 
       WHERE u.id = ?`,
      [req.user.userId]
    );

    // Crear notificación para el técnico
    await createJobApplicationNotification(
      req.user.userId,
      projectId,
      projectInfo.title
    );

    // Crear notificación para la empresa
    await createNewApplicationNotification(
      projectInfo.company_id,
      projectId,
      projectInfo.title,
      technicianInfo.full_name
    );

    // Enviar email al técnico (confirmación)
    await sendApplicationConfirmationEmail(
      technicianInfo.email,
      technicianInfo.full_name,
      projectInfo.title
    );

    // Enviar email a hola.trabajatecnico@gmail.com con el CV adjunto
    const cvFilePath = technicianInfo.cv_file ? path.join(process.env.UPLOAD_PATH || './uploads', technicianInfo.cv_file) : null;
    
    await sendJobApplicationEmail({
      technicianName: technicianInfo.full_name,
      technicianEmail: technicianInfo.email,
      projectTitle: projectInfo.title,
      companyName: projectInfo.company_name,
      coverLetter,
      proposedRate,
      cvFilePath
    });

    res.status(201).json({
      message: 'Aplicación enviada exitosamente',
      applicationId: result.insertId
    });

  } catch (error) {
    console.error('Error aplicando a proyecto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al aplicar al proyecto'
    });
  }
});

module.exports = router; 