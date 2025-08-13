const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Obtener perfil del usuario autenticado
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener información básica del usuario
    const [user] = await query(
      'SELECT id, email, full_name, user_type, phone, is_verified, created_at FROM users WHERE id = ?',
      [userId]
    );

    // Obtener perfil específico según el tipo de usuario
    let profile = null;
    if (req.user.user_type === 'technician') {
      [profile] = await query(
        'SELECT * FROM technician_profiles WHERE user_id = ?',
        [userId]
      );
    } else if (req.user.user_type === 'company') {
      [profile] = await query(
        'SELECT * FROM company_profiles WHERE user_id = ?',
        [userId]
      );
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        userType: user.user_type,
        phone: user.phone,
        isVerified: user.is_verified,
        createdAt: user.created_at
      },
      profile
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener el perfil'
    });
  }
});

// Actualizar perfil del usuario
router.put('/profile', [
  authenticateToken,
  body('fullName').optional().trim().isLength({ min: 2 }).withMessage('El nombre debe tener al menos 2 caracteres'),
  body('phone').optional().isMobilePhone('es-PE').withMessage('Número de teléfono inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { fullName, phone } = req.body;
    const userId = req.user.id;

    // Actualizar información básica del usuario
    const updateFields = [];
    const updateParams = [];

    if (fullName) {
      updateFields.push('full_name = ?');
      updateParams.push(fullName);
    }

    if (phone) {
      updateFields.push('phone = ?');
      updateParams.push(phone);
    }

    if (updateFields.length > 0) {
      updateParams.push(userId);
      await query(
        `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateParams
      );
    }

    // Actualizar perfil específico según el tipo de usuario
    if (req.user.user_type === 'technician') {
      const { bio, experienceYears, skills, hourlyRate, location } = req.body;
      
      const techUpdateFields = [];
      const techUpdateParams = [];

      if (bio !== undefined) {
        techUpdateFields.push('bio = ?');
        techUpdateParams.push(bio);
      }

      if (experienceYears !== undefined) {
        techUpdateFields.push('experience_years = ?');
        techUpdateParams.push(experienceYears);
      }

      if (skills !== undefined) {
        techUpdateFields.push('skills = ?');
        techUpdateParams.push(JSON.stringify(skills));
      }

      if (hourlyRate !== undefined) {
        techUpdateFields.push('hourly_rate = ?');
        techUpdateParams.push(hourlyRate);
      }

      if (location !== undefined) {
        techUpdateFields.push('location = ?');
        techUpdateParams.push(location);
      }

      if (techUpdateFields.length > 0) {
        techUpdateParams.push(userId);
        await query(
          `UPDATE technician_profiles SET ${techUpdateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          techUpdateParams
        );
      }
    } else if (req.user.user_type === 'company') {
      const { companyName, companyDescription, industry, website, address } = req.body;
      
      const compUpdateFields = [];
      const compUpdateParams = [];

      if (companyName) {
        compUpdateFields.push('company_name = ?');
        compUpdateParams.push(companyName);
      }

      if (companyDescription !== undefined) {
        compUpdateFields.push('company_description = ?');
        compUpdateParams.push(companyDescription);
      }

      if (industry) {
        compUpdateFields.push('industry = ?');
        compUpdateParams.push(industry);
      }

      if (website) {
        compUpdateFields.push('website = ?');
        compUpdateParams.push(website);
      }

      if (address) {
        compUpdateFields.push('address = ?');
        compUpdateParams.push(address);
      }

      if (compUpdateFields.length > 0) {
        compUpdateParams.push(userId);
        await query(
          `UPDATE company_profiles SET ${compUpdateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          compUpdateParams
        );
      }
    }

    // Obtener usuario actualizado
    const [updatedUser] = await query(
      'SELECT id, email, full_name, user_type, phone, is_verified, updated_at FROM users WHERE id = ?',
      [userId]
    );

    // Obtener perfil actualizado
    let updatedProfile = null;
    if (req.user.user_type === 'technician') {
      [updatedProfile] = await query(
        'SELECT * FROM technician_profiles WHERE user_id = ?',
        [userId]
      );
    } else if (req.user.user_type === 'company') {
      [updatedProfile] = await query(
        'SELECT * FROM company_profiles WHERE user_id = ?',
        [userId]
      );
    }

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        userType: updatedUser.user_type,
        phone: updatedUser.phone,
        isVerified: updatedUser.is_verified,
        updatedAt: updatedUser.updated_at
      },
      profile: updatedProfile
    });

  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al actualizar el perfil'
    });
  }
});

// Obtener usuario público por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [user] = await query(
      'SELECT id, full_name, user_type, is_verified, created_at FROM users WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    // Obtener perfil público según el tipo de usuario
    let profile = null;
    if (user.user_type === 'technician') {
      [profile] = await query(
        'SELECT bio, experience_years, skills, hourly_rate, location, rating, total_reviews, completed_projects FROM technician_profiles WHERE user_id = ?',
        [id]
      );
    } else if (user.user_type === 'company') {
      [profile] = await query(
        'SELECT company_name, company_description, industry, website, rating, total_reviews, completed_projects FROM company_profiles WHERE user_id = ?',
        [id]
      );
    }

    res.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        userType: user.user_type,
        isVerified: user.is_verified,
        createdAt: user.created_at
      },
      profile
    });

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener el usuario'
    });
  }
});

// Obtener estadísticas del usuario
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.user_type;

    let stats = {};

    if (userType === 'technician') {
      // Estadísticas para técnicos
      const [applications] = await query(
        'SELECT COUNT(*) as total FROM project_applications WHERE technician_id = ?',
        [userId]
      );

      const [acceptedApplications] = await query(
        'SELECT COUNT(*) as total FROM project_applications WHERE technician_id = ? AND status = "accepted"',
        [userId]
      );

      const [reviews] = await query(
        'SELECT COUNT(*) as total FROM reviews WHERE reviewed_id = ?',
        [userId]
      );

      const [avgRating] = await query(
        'SELECT AVG(rating) as average FROM reviews WHERE reviewed_id = ?',
        [userId]
      );

      stats = {
        totalApplications: applications.total,
        acceptedApplications: acceptedApplications.total,
        totalReviews: reviews.total,
        averageRating: parseFloat(avgRating.average || 0)
      };
    } else if (userType === 'company') {
      // Estadísticas para empresas
      const [projects] = await query(
        'SELECT COUNT(*) as total FROM projects WHERE company_id = ?',
        [userId]
      );

      const [activeProjects] = await query(
        'SELECT COUNT(*) as total FROM projects WHERE company_id = ? AND status = "open"',
        [userId]
      );

      const [applications] = await query(
        'SELECT COUNT(*) as total FROM project_applications pa JOIN projects p ON pa.project_id = p.id WHERE p.company_id = ?',
        [userId]
      );

      const [reviews] = await query(
        'SELECT COUNT(*) as total FROM reviews WHERE reviewed_id = ?',
        [userId]
      );

      const [avgRating] = await query(
        'SELECT AVG(rating) as average FROM reviews WHERE reviewed_id = ?',
        [userId]
      );

      stats = {
        totalProjects: projects.total,
        activeProjects: activeProjects.total,
        totalApplications: applications.total,
        totalReviews: reviews.total,
        averageRating: parseFloat(avgRating.average || 0)
      };
    }

    res.json(stats);

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las estadísticas'
    });
  }
});

// Subir imagen de perfil
router.post('/profile/avatar', [
  authenticateToken,
  body('imageUrl').isURL().withMessage('URL de imagen inválida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { imageUrl } = req.body;
    const userId = req.user.id;

    // Actualizar imagen de perfil según el tipo de usuario
    if (req.user.user_type === 'technician') {
      await query(
        'UPDATE technician_profiles SET profile_image = ? WHERE user_id = ?',
        [imageUrl, userId]
      );
    } else if (req.user.user_type === 'company') {
      await query(
        'UPDATE company_profiles SET logo_url = ? WHERE user_id = ?',
        [imageUrl, userId]
      );
    }

    res.json({
      message: 'Imagen de perfil actualizada exitosamente',
      imageUrl
    });

  } catch (error) {
    console.error('Error al actualizar imagen de perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al actualizar la imagen de perfil'
    });
  }
});

module.exports = router; 