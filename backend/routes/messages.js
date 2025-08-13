const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Enviar mensaje
router.post('/', [
  authenticateToken,
  body('receiverId').isInt().withMessage('ID de destinatario inválido'),
  body('subject').trim().isLength({ min: 5, max: 100 }).withMessage('El asunto debe tener entre 5 y 100 caracteres'),
  body('message').trim().isLength({ min: 10, max: 2000 }).withMessage('El mensaje debe tener entre 10 y 2000 caracteres'),
  body('projectId').optional().isInt().withMessage('ID de proyecto inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { receiverId, subject, message, projectId } = req.body;
    const senderId = req.user.id;

    // Verificar que el destinatario existe
    const [receiver] = await query(
      'SELECT id, full_name FROM users WHERE id = ? AND is_active = TRUE',
      [receiverId]
    );

    if (!receiver) {
      return res.status(404).json({
        error: 'Destinatario no encontrado',
        message: 'El usuario destinatario no existe'
      });
    }

    // Verificar que no se está enviando un mensaje a sí mismo
    if (senderId === receiverId) {
      return res.status(400).json({
        error: 'No puedes enviarte un mensaje a ti mismo',
        message: 'Selecciona otro destinatario'
      });
    }

    // Crear mensaje
    const [result] = await query(`
      INSERT INTO messages (sender_id, receiver_id, project_id, subject, message)
      VALUES (?, ?, ?, ?, ?)
    `, [senderId, receiverId, projectId, subject, message]);

    const messageId = result.insertId;

    // Obtener mensaje creado
    const [newMessage] = await query(`
      SELECT 
        m.*,
        s.full_name as sender_name,
        r.full_name as receiver_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE m.id = ?
    `, [messageId]);

    // Crear notificación para el destinatario
    await query(`
      INSERT INTO notifications (
        user_id, type, title, message, related_id
      ) VALUES (?, 'message', 'Nuevo mensaje recibido', ?, ?)
    `, [receiverId, `Has recibido un nuevo mensaje de ${req.user.full_name}`, messageId]);

    res.status(201).json({
      message: 'Mensaje enviado exitosamente',
      data: {
        id: newMessage.id,
        senderId: newMessage.sender_id,
        senderName: newMessage.sender_name,
        receiverId: newMessage.receiver_id,
        receiverName: newMessage.receiver_name,
        projectId: newMessage.project_id,
        subject: newMessage.subject,
        message: newMessage.message,
        isRead: Boolean(newMessage.is_read),
        createdAt: newMessage.created_at
      }
    });

  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al enviar el mensaje'
    });
  }
});

// Obtener conversaciones del usuario
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener conversaciones (mensajes enviados y recibidos)
    const conversations = await query(`
      SELECT 
        CASE 
          WHEN m.sender_id = ? THEN m.receiver_id
          ELSE m.sender_id
        END as other_user_id,
        CASE 
          WHEN m.sender_id = ? THEN u.full_name
          ELSE s.full_name
        END as other_user_name,
        CASE 
          WHEN m.sender_id = ? THEN u.user_type
          ELSE s.user_type
        END as other_user_type,
        m.subject,
        m.message,
        m.created_at,
        m.is_read,
        m.sender_id = ? as is_sent_by_me
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      JOIN users u ON (
        CASE 
          WHEN m.sender_id = ? THEN m.receiver_id
          ELSE m.sender_id
        END = u.id
      )
      WHERE m.sender_id = ? OR m.receiver_id = ?
      AND m.id IN (
        SELECT MAX(id) 
        FROM messages 
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY 
          CASE 
            WHEN sender_id = ? THEN receiver_id
            ELSE sender_id
          END
      )
      ORDER BY m.created_at DESC
    `, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]);

    const formattedConversations = conversations.map(conv => ({
      otherUserId: conv.other_user_id,
      otherUserName: conv.other_user_name,
      otherUserType: conv.other_user_type,
      subject: conv.subject,
      lastMessage: conv.message,
      lastMessageTime: conv.created_at,
      isRead: Boolean(conv.is_read),
      isSentByMe: Boolean(conv.is_sent_by_me)
    }));

    res.json({
      conversations: formattedConversations,
      total: conversations.length
    });

  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las conversaciones'
    });
  }
});

// Obtener mensajes de una conversación específica
router.get('/conversation/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.user.id;

    // Verificar que el otro usuario existe
    const [otherUser] = await query(
      'SELECT id, full_name, user_type FROM users WHERE id = ? AND is_active = TRUE',
      [otherUserId]
    );

    if (!otherUser) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    // Obtener mensajes de la conversación
    const messages = await query(`
      SELECT 
        m.*,
        s.full_name as sender_name,
        r.full_name as receiver_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE (m.sender_id = ? AND m.receiver_id = ?) 
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `, [userId, otherUserId, otherUserId, userId]);

    // Marcar mensajes como leídos
    await query(`
      UPDATE messages 
      SET is_read = TRUE 
      WHERE receiver_id = ? AND sender_id = ? AND is_read = FALSE
    `, [userId, otherUserId]);

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      senderId: msg.sender_id,
      senderName: msg.sender_name,
      receiverId: msg.receiver_id,
      receiverName: msg.receiver_name,
      projectId: msg.project_id,
      subject: msg.subject,
      message: msg.message,
      isRead: Boolean(msg.is_read),
      createdAt: msg.created_at
    }));

    res.json({
      otherUser: {
        id: otherUser.id,
        fullName: otherUser.full_name,
        userType: otherUser.user_type
      },
      messages: formattedMessages,
      total: messages.length
    });

  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener los mensajes'
    });
  }
});

// Marcar mensaje como leído
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar que el mensaje existe y pertenece al usuario
    const [message] = await query(
      'SELECT * FROM messages WHERE id = ? AND receiver_id = ?',
      [id, userId]
    );

    if (!message) {
      return res.status(404).json({
        error: 'Mensaje no encontrado',
        message: 'El mensaje no existe o no tienes permisos para modificarlo'
      });
    }

    // Marcar como leído
    await query(
      'UPDATE messages SET is_read = TRUE WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Mensaje marcado como leído'
    });

  } catch (error) {
    console.error('Error al marcar mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al marcar el mensaje'
    });
  }
});

// Obtener mensajes no leídos
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await query(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      unreadCount: result.count
    });

  } catch (error) {
    console.error('Error al obtener mensajes no leídos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener el conteo de mensajes'
    });
  }
});

// Eliminar mensaje (solo el remitente)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar que el mensaje existe y pertenece al usuario
    const [message] = await query(
      'SELECT * FROM messages WHERE id = ? AND sender_id = ?',
      [id, userId]
    );

    if (!message) {
      return res.status(404).json({
        error: 'Mensaje no encontrado',
        message: 'El mensaje no existe o no tienes permisos para eliminarlo'
      });
    }

    // Eliminar mensaje
    await query('DELETE FROM messages WHERE id = ?', [id]);

    res.json({
      message: 'Mensaje eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al eliminar el mensaje'
    });
  }
});

module.exports = router; 