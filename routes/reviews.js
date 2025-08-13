const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Crear reseña
router.post('/', [
  authenticateToken,
  body('reviewedId').isInt().withMessage('ID de usuario revisado inválido'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('La calificación debe ser entre 1 y 5'),
  body('comment').trim().isLength({ min: 10, max: 1000 }).withMessage('El comentario debe tener entre 10 y 1000 caracteres'),
  body('projectId').optional().isInt().withMessage('ID de proyecto inválido'),
  body('isPublic').optional().isBoolean().withMessage('isPublic debe ser un booleano')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { reviewedId, rating, comment, projectId, isPublic = true } = req.body;
    const reviewerId = req.user.id;

    // Verificar que el usuario revisado existe
    const [reviewedUser] = await query(
      'SELECT id, full_name FROM users WHERE id = ? AND is_active = TRUE',
      [reviewedId]
    );

    if (!reviewedUser) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario a revisar no existe'
      });
    }

    // Verificar que no se está revisando a sí mismo
    if (reviewerId === reviewedId) {
      return res.status(400).json({
        error: 'No puedes revisarte a ti mismo',
        message: 'Selecciona otro usuario para revisar'
      });
    }

    // Verificar que no haya revisado antes al mismo usuario en el mismo proyecto
    const [existingReview] = await query(
      'SELECT id FROM reviews WHERE reviewer_id = ? AND reviewed_id = ? AND project_id = ?',
      [reviewerId, reviewedId, projectId]
    );

    if (existingReview) {
      return res.status(400).json({
        error: 'Ya has revisado a este usuario',
        message: 'Solo puedes revisar una vez al mismo usuario por proyecto'
      });
    }

    // Crear reseña
    const [result] = await query(`
      INSERT INTO reviews (reviewer_id, reviewed_id, project_id, rating, comment, is_public)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [reviewerId, reviewedId, projectId, rating, comment, isPublic]);

    const reviewId = result.insertId;

    // Obtener reseña creada
    const [newReview] = await query(`
      SELECT 
        r.*,
        reviewer.full_name as reviewer_name,
        reviewed.full_name as reviewed_name
      FROM reviews r
      JOIN users reviewer ON r.reviewer_id = reviewer.id
      JOIN users reviewed ON r.reviewed_id = reviewed.id
      WHERE r.id = ?
    `, [reviewId]);

    // Actualizar estadísticas del usuario revisado
    await query(`
      UPDATE ${newReview.reviewed_id === req.user.user_type === 'technician' ? 'technician_profiles' : 'company_profiles'}
      SET 
        rating = (
          SELECT AVG(rating) 
          FROM reviews 
          WHERE reviewed_id = ? AND is_public = TRUE
        ),
        total_reviews = (
          SELECT COUNT(*) 
          FROM reviews 
          WHERE reviewed_id = ? AND is_public = TRUE
        )
      WHERE user_id = ?
    `, [reviewedId, reviewedId, reviewedId]);

    // Crear notificación para el usuario revisado
    await query(`
      INSERT INTO notifications (
        user_id, type, title, message, related_id
      ) VALUES (?, 'review', 'Nueva reseña recibida', ?, ?)
    `, [reviewedId, `Has recibido una nueva reseña de ${req.user.full_name}`, reviewId]);

    res.status(201).json({
      message: 'Reseña creada exitosamente',
      review: {
        id: newReview.id,
        reviewerId: newReview.reviewer_id,
        reviewerName: newReview.reviewer_name,
        reviewedId: newReview.reviewed_id,
        reviewedName: newReview.reviewed_name,
        projectId: newReview.project_id,
        rating: newReview.rating,
        comment: newReview.comment,
        isPublic: Boolean(newReview.is_public),
        createdAt: newReview.created_at
      }
    });

  } catch (error) {
    console.error('Error al crear reseña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al crear la reseña'
    });
  }
});

// Obtener reseñas de un usuario
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Verificar que el usuario existe
    const [user] = await query(
      'SELECT id, full_name FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    // Obtener reseñas públicas
    const reviews = await query(`
      SELECT 
        r.*,
        reviewer.full_name as reviewer_name,
        reviewer.user_type as reviewer_type,
        p.title as project_title
      FROM reviews r
      JOIN users reviewer ON r.reviewer_id = reviewer.id
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.reviewed_id = ? AND r.is_public = TRUE
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);

    // Contar total de reseñas
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM reviews WHERE reviewed_id = ? AND is_public = TRUE',
      [userId]
    );

    const formattedReviews = reviews.map(review => ({
      id: review.id,
      reviewerId: review.reviewer_id,
      reviewerName: review.reviewer_name,
      reviewerType: review.reviewer_type,
      projectId: review.project_id,
      projectTitle: review.project_title,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at
    }));

    res.json({
      reviews: formattedReviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener reseñas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las reseñas'
    });
  }
});

// Obtener mis reseñas (reseñas que he hecho)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const reviews = await query(`
      SELECT 
        r.*,
        reviewed.full_name as reviewed_name,
        reviewed.user_type as reviewed_type,
        p.title as project_title
      FROM reviews r
      JOIN users reviewed ON r.reviewed_id = reviewed.id
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.reviewer_id = ?
      ORDER BY r.created_at DESC
    `, [userId]);

    const formattedReviews = reviews.map(review => ({
      id: review.id,
      reviewedId: review.reviewed_id,
      reviewedName: review.reviewed_name,
      reviewedType: review.reviewed_type,
      projectId: review.project_id,
      projectTitle: review.project_title,
      rating: review.rating,
      comment: review.comment,
      isPublic: Boolean(review.is_public),
      createdAt: review.created_at
    }));

    res.json({
      reviews: formattedReviews,
      total: reviews.length
    });

  } catch (error) {
    console.error('Error al obtener mis reseñas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las reseñas'
    });
  }
});

// Actualizar reseña
router.put('/:id', [
  authenticateToken,
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('La calificación debe ser entre 1 y 5'),
  body('comment').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('El comentario debe tener entre 10 y 1000 caracteres'),
  body('isPublic').optional().isBoolean().withMessage('isPublic debe ser un booleano')
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
    const { rating, comment, isPublic } = req.body;
    const userId = req.user.id;

    // Verificar que la reseña existe y pertenece al usuario
    const [review] = await query(
      'SELECT * FROM reviews WHERE id = ? AND reviewer_id = ?',
      [id, userId]
    );

    if (!review) {
      return res.status(404).json({
        error: 'Reseña no encontrada',
        message: 'La reseña no existe o no tienes permisos para modificarla'
      });
    }

    // Actualizar reseña
    const updateFields = [];
    const updateParams = [];

    if (rating !== undefined) {
      updateFields.push('rating = ?');
      updateParams.push(rating);
    }

    if (comment !== undefined) {
      updateFields.push('comment = ?');
      updateParams.push(comment);
    }

    if (isPublic !== undefined) {
      updateFields.push('is_public = ?');
      updateParams.push(isPublic);
    }

    if (updateFields.length > 0) {
      updateParams.push(id);
      await query(
        `UPDATE reviews SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateParams
      );
    }

    // Obtener reseña actualizada
    const [updatedReview] = await query(`
      SELECT 
        r.*,
        reviewer.full_name as reviewer_name,
        reviewed.full_name as reviewed_name
      FROM reviews r
      JOIN users reviewer ON r.reviewer_id = reviewer.id
      JOIN users reviewed ON r.reviewed_id = reviewed.id
      WHERE r.id = ?
    `, [id]);

    res.json({
      message: 'Reseña actualizada exitosamente',
      review: {
        id: updatedReview.id,
        reviewerId: updatedReview.reviewer_id,
        reviewerName: updatedReview.reviewer_name,
        reviewedId: updatedReview.reviewed_id,
        reviewedName: updatedReview.reviewed_name,
        projectId: updatedReview.project_id,
        rating: updatedReview.rating,
        comment: updatedReview.comment,
        isPublic: Boolean(updatedReview.is_public),
        createdAt: updatedReview.created_at,
        updatedAt: updatedReview.updated_at
      }
    });

  } catch (error) {
    console.error('Error al actualizar reseña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al actualizar la reseña'
    });
  }
});

// Eliminar reseña
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar que la reseña existe y pertenece al usuario
    const [review] = await query(
      'SELECT * FROM reviews WHERE id = ? AND reviewer_id = ?',
      [id, userId]
    );

    if (!review) {
      return res.status(404).json({
        error: 'Reseña no encontrada',
        message: 'La reseña no existe o no tienes permisos para eliminarla'
      });
    }

    // Eliminar reseña
    await query('DELETE FROM reviews WHERE id = ?', [id]);

    res.json({
      message: 'Reseña eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar reseña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al eliminar la reseña'
    });
  }
});

module.exports = router; 