const { query } = require('../config/database');

// Función para crear una notificación
const createNotification = async (userId, type, title, message, relatedId = null) => {
  try {
    const result = await query(
      'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
      [userId, type, title, message, relatedId]
    );

    return {
      success: true,
      notificationId: result.insertId
    };
  } catch (error) {
    console.error('Error creando notificación:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Función para crear notificación de aplicación de trabajo
const createJobApplicationNotification = async (technicianId, projectId, projectTitle) => {
  const title = 'Aplicación Enviada';
  const message = `Tu aplicación para el proyecto "${projectTitle}" ha sido enviada exitosamente.`;
  
  return await createNotification(
    technicianId,
    'job_application',
    title,
    message,
    projectId
  );
};

// Función para crear notificación de nueva aplicación recibida (para la empresa)
const createNewApplicationNotification = async (companyId, projectId, projectTitle, technicianName) => {
  const title = 'Nueva Aplicación Recibida';
  const message = `Has recibido una nueva aplicación de ${technicianName} para el proyecto "${projectTitle}".`;
  
  return await createNotification(
    companyId,
    'new_application',
    title,
    message,
    projectId
  );
};

// Función para crear notificación de cambio de estado de aplicación
const createApplicationStatusNotification = async (technicianId, projectId, projectTitle, status) => {
  let title, message;
  
  switch (status) {
    case 'accepted':
      title = '¡Aplicación Aceptada!';
      message = `Tu aplicación para el proyecto "${projectTitle}" ha sido aceptada. ¡Felicidades!`;
      break;
    case 'rejected':
      title = 'Aplicación Rechazada';
      message = `Tu aplicación para el proyecto "${projectTitle}" no ha sido seleccionada en esta ocasión.`;
      break;
    case 'withdrawn':
      title = 'Aplicación Retirada';
      message = `Has retirado tu aplicación para el proyecto "${projectTitle}".`;
      break;
    default:
      title = 'Estado de Aplicación Actualizado';
      message = `El estado de tu aplicación para el proyecto "${projectTitle}" ha sido actualizado.`;
  }
  
  return await createNotification(
    technicianId,
    'application_status',
    title,
    message,
    projectId
  );
};

module.exports = {
  createNotification,
  createJobApplicationNotification,
  createNewApplicationNotification,
  createApplicationStatusNotification
}; 