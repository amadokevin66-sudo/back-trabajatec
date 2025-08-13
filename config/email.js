require('dotenv').config();

const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: process.env.EMAIL_USER || 'hola.trabajatecnico@gmail.com',
    pass: process.env.EMAIL_PASS || '',
  },
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'hola.trabajatecnico@gmail.com',
  adminEmail: 'hola.trabajatecnico@gmail.com'
};

// Validar configuración
const validateEmailConfig = () => {
  const requiredFields = ['EMAIL_USER', 'EMAIL_PASS'];
  const missingFields = requiredFields.filter(field => !process.env[field]);
  
  if (missingFields.length > 0) {
    console.warn('⚠️  Configuración de email incompleta. Los siguientes campos son requeridos:');
    missingFields.forEach(field => console.warn(`   - ${field}`));
    console.warn('   Los emails no se enviarán hasta que se configuren estos campos.');
    return false;
  }
  
  return true;
};

module.exports = {
  emailConfig,
  validateEmailConfig
}; 