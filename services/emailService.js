const nodemailer = require('nodemailer');
const { emailConfig, validateEmailConfig } = require('../config/email');

// Configuración del transportador de email
const transporter = nodemailer.createTransport(emailConfig);

// Verificar configuración al inicializar
const isEmailConfigured = validateEmailConfig();

// Función para enviar email de aplicación de trabajo
const sendJobApplicationEmail = async (applicationData) => {
  // Verificar si el email está configurado
  if (!isEmailConfigured) {
    console.warn('⚠️  Email no configurado. No se enviará el email de aplicación.');
    return { success: false, error: 'Email no configurado' };
  }

  try {
    const {
      technicianName,
      technicianEmail,
      projectTitle,
      companyName,
      coverLetter,
      proposedRate,
      cvFilePath
    } = applicationData;

    // Configurar el email
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: 'hola.trabajatecnico@gmail.com',
      subject: `Nueva Aplicación de Trabajo - ${projectTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Nueva Aplicación de Trabajo</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; margin-bottom: 20px;">Detalles de la Aplicación</h2>
            
            <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <h3 style="color: #2563eb; margin-top: 0;">Proyecto</h3>
              <p style="margin: 5px 0;"><strong>Título:</strong> ${projectTitle}</p>
              <p style="margin: 5px 0;"><strong>Empresa:</strong> ${companyName}</p>
            </div>
            
            <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <h3 style="color: #2563eb; margin-top: 0;">Técnico</h3>
              <p style="margin: 5px 0;"><strong>Nombre:</strong> ${technicianName}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${technicianEmail}</p>
              ${proposedRate ? `<p style="margin: 5px 0;"><strong>Tarifa Propuesta:</strong> S/ ${proposedRate}</p>` : ''}
            </div>
            
            <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <h3 style="color: #2563eb; margin-top: 0;">Carta de Presentación</h3>
              <p style="margin: 0; line-height: 1.6;">${coverLetter}</p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <p style="color: #64748b; font-size: 14px;">
                Esta aplicación fue enviada automáticamente desde la plataforma TrabajaTecnico.
              </p>
            </div>
          </div>
        </div>
      `,
      attachments: cvFilePath ? [
        {
          filename: `CV_${technicianName.replace(/\s+/g, '_')}.pdf`,
          path: cvFilePath
        }
      ] : []
    };

    // Enviar el email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email de aplicación enviado:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error enviando email de aplicación:', error);
    return { success: false, error: error.message };
  }
};

// Función para enviar email de confirmación al técnico
const sendApplicationConfirmationEmail = async (technicianEmail, technicianName, projectTitle) => {
  // Verificar si el email está configurado
  if (!isEmailConfigured) {
    console.warn('⚠️  Email no configurado. No se enviará el email de confirmación.');
    return { success: false, error: 'Email no configurado' };
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: technicianEmail,
      subject: `Confirmación de Aplicación - ${projectTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">¡Aplicación Enviada!</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
            <p style="color: #1e293b; font-size: 16px; line-height: 1.6;">
              Hola <strong>${technicianName}</strong>,
            </p>
            
            <p style="color: #1e293b; font-size: 16px; line-height: 1.6;">
              Tu aplicación para el proyecto <strong>"${projectTitle}"</strong> ha sido enviada exitosamente.
            </p>
            
            <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #065f46; margin-top: 0;">Próximos Pasos</h3>
              <ul style="color: #065f46; margin: 0; padding-left: 20px;">
                <li>La empresa revisará tu aplicación</li>
                <li>Recibirás una notificación cuando haya una respuesta</li>
                <li>Puedes revisar el estado de tu aplicación en tu dashboard</li>
              </ul>
            </div>
            
            <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 20px;">
              ¡Gracias por usar TrabajaTecnico!
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de confirmación enviado:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error enviando email de confirmación:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendJobApplicationEmail,
  sendApplicationConfirmationEmail
}; 