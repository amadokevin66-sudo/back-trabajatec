const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Obtener notificaciones del usuario
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    if (unreadOnly === 'true') {
      whereClause += ' AND is_read = FALSE';
    }

    // Obtener notificaciones
    const notifications = await query(`
      SELECT * FROM notifications 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Contar total de notificaciones
    const [countResult] = await query(`
      SELECT COUNT(*) as total FROM notifications 
      ${whereClause}
    `, params);

    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      relatedId: notification.related_id,
      isRead: Boolean(notification.is_read),
      createdAt: notification.created_at
    }));

    res.json({
      notifications: formattedNotifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las notificaciones'
    });
  }
});

// Marcar notificación como leída
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verificar que la notificación existe y pertenece al usuario
    const [notification] = await query(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!notification) {
      return res.status(404).json({
        error: 'Notificación no encontrada',
        message: 'La notificación no existe o no tienes permisos para modificarla'
      });
    }

    // Marcar como leída
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Notificación marcada como leída'
    });

  } catch (error) {
    console.error('Error al marcar notificación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al marcar la notificación'
    });
  }
});

// Marcar todas las notificaciones como leídas
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Marcar todas como leídas
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      message: 'Todas las notificaciones han sido marcadas como leídas'
    });

  } catch (error) {
    console.error('Error al marcar notificaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al marcar las notificaciones'
    });
  }
});

// Obtener conteo de notificaciones no leídas
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [result] = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      unreadCount: result.count
    });

  } catch (error) {
    console.error('Error al obtener conteo de notificaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener el conteo de notificaciones'
    });
  }
});

// Eliminar notificación
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verificar que la notificación existe y pertenece al usuario
    const [notification] = await query(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!notification) {
      return res.status(404).json({
        error: 'Notificación no encontrada',
        message: 'La notificación no existe o no tienes permisos para eliminarla'
      });
    }

    // Eliminar notificación
    await query('DELETE FROM notifications WHERE id = ?', [id]);

    res.json({
      message: 'Notificación eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al eliminar la notificación'
    });
  }
});

// Eliminar todas las notificaciones leídas
router.delete('/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Eliminar notificaciones leídas
    await query(
      'DELETE FROM notifications WHERE user_id = ? AND is_read = TRUE',
      [userId]
    );

    res.json({
      message: 'Notificaciones leídas eliminadas exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar notificaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al eliminar las notificaciones'
    });
  }
});

module.exports = router; 