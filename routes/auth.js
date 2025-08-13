const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Registro de usuario
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('fullName').trim().isLength({ min: 2 }).withMessage('El nombre debe tener al menos 2 caracteres'),
  body('userType').isIn(['technician']).withMessage('Tipo de usuario inválido'),
  body('phone').optional().trim(),
  body('dni').optional().isLength({ min: 8, max: 8 }).withMessage('El DNI debe tener 8 dígitos'),
  body('ruc').optional().isLength({ min: 11, max: 11 }).withMessage('El RUC debe tener 11 dígitos')
], async (req, res) => {
  try {
    // Log para debugging
    console.log('Datos recibidos en registro:', req.body);
    
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Errores de validación:', errors.array());
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { email, password, fullName, userType, phone, dni, ruc } = req.body;

    // Debug: Log de los datos recibidos
    console.log('Datos recibidos en registro:', {
      email,
      password: password ? '[HIDDEN]' : 'undefined',
      fullName,
      userType,
      phone,
      dni,
      ruc
    });

    // Verificar si el email ya existe
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        error: 'Email ya registrado',
        message: 'Ya existe una cuenta con este email'
      });
    }

    // Verificar DNI si es técnico
    if (userType === 'technician') {
      if (!dni) {
        return res.status(400).json({
          error: 'DNI requerido',
          message: 'El DNI es obligatorio para técnicos'
        });
      }
      
      const existingDNI = await query(
        'SELECT id FROM technician_profiles WHERE dni = ?',
        [dni]
      );
      
      if (existingDNI.length > 0) {
        return res.status(400).json({
          error: 'DNI ya registrado',
          message: 'Ya existe un técnico con este DNI'
        });
      }
    }



    // Encriptar contraseña
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear usuario
    const result = await query(
      'INSERT INTO users (email, password_hash, full_name, user_type, phone) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, fullName, userType, phone]
    );

    const userId = result.insertId;

    // Crear perfil de técnico
    await query(
      'INSERT INTO technician_profiles (user_id, dni) VALUES (?, ?)',
      [userId, dni]
    );

    // Generar token JWT
    const token = jwt.sign(
      { userId, email, userType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Obtener usuario creado
    const newUsers = await query(
      'SELECT id, email, full_name, user_type, is_verified, created_at FROM users WHERE id = ?',
      [userId]
    );

    const newUser = newUsers[0];

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: newUser,
      token
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al registrar el usuario'
    });
  }
});

// Inicio de sesión
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida')
], async (req, res) => {
  try {
    // Debug: Log de los datos recibidos
    console.log('Datos recibidos en login:', {
      email: req.body.email,
      password: req.body.password ? '[HIDDEN]' : 'undefined'
    });

    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Errores de validación en login:', errors.array());
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Buscar usuario
    const users = await query(
      'SELECT id, email, password_hash, full_name, user_type, is_verified, is_active FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Cuenta desactivada',
        message: 'Tu cuenta ha sido desactivada'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos'
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Obtener información adicional del perfil
    let profile = null;
    if (user.user_type === 'technician') {
      const technicianProfiles = await query(
        'SELECT * FROM technician_profiles WHERE user_id = ?',
        [user.id]
      );
      profile = technicianProfiles[0] || null;
    } else if (user.user_type === 'company') {
      const companyProfiles = await query(
        'SELECT * FROM company_profiles WHERE user_id = ?',
        [user.id]
      );
      profile = companyProfiles[0] || null;
    }

    const responseData = {
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        userType: user.user_type,
        isVerified: user.is_verified
      },
      profile,
      token
    };

    console.log('Respuesta de login enviada:', {
      message: responseData.message,
      userId: responseData.user.id,
      userEmail: responseData.user.email,
      userType: responseData.user.userType,
      hasToken: !!responseData.token
    });

    res.json(responseData);

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al iniciar sesión'
    });
  }
});

// Verificar token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    message: 'Token válido',
    user: req.user
  });
});

// Cerrar sesión (opcional, ya que JWT es stateless)
router.post('/logout', authenticateToken, (req, res) => {
  // En una implementación más avanzada, podrías agregar el token a una lista negra
  res.json({
    message: 'Sesión cerrada exitosamente'
  });
});

// Cambiar contraseña
router.put('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Contraseña actual requerida'),
  body('newPassword').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Obtener contraseña actual
    const users = await query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'No se encontró el usuario'
      });
    }

    const user = users[0];

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Contraseña incorrecta',
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Encriptar nueva contraseña
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar contraseña
    await query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedNewPassword, req.user.id]
    );

    res.json({
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al cambiar la contraseña'
    });
  }
});

// Solicitar restablecimiento de contraseña
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const { email } = req.body;

    // Verificar si el usuario existe
    const users = await query(
      'SELECT id, email, full_name FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (users.length === 0) {
      // Por seguridad, no revelar si el email existe o no
      return res.json({
        message: 'Si el email existe en nuestra base de datos, recibirás un enlace para restablecer tu contraseña'
      });
    }

    const user = users[0];

    // Generar token temporal para restablecimiento
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Aquí podrías enviar el email con el enlace de restablecimiento
    // Por ahora, solo devolvemos el token (en producción, enviarías un email)
    
    res.json({
      message: 'Se ha enviado un enlace de restablecimiento a tu email',
      resetToken // En producción, esto no se devolvería
    });

  } catch (error) {
    console.error('Error en forgot password:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al procesar la solicitud'
    });
  }
});



// Obtener perfil del usuario
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Obteniendo perfil para usuario:', {
      userId: req.user?.userId,
      userType: req.user?.userType,
      email: req.user?.email
    });
    
    const userId = req.user.userId;
    
    // Obtener información básica del usuario
    console.log('🔍 Buscando usuario con ID:', userId);
    const users = await query(
      'SELECT id, email, full_name, user_type, phone, is_verified, created_at FROM users WHERE id = ?',
      [userId]
    );

    console.log('🔍 Resultado de búsqueda de usuario:', {
      encontrado: users.length > 0,
      usuario: users[0] ? {
        id: users[0].id,
        email: users[0].email,
        user_type: users[0].user_type
      } : null
    });

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    const user = users[0];
    let profile = null;

    // Obtener perfil específico según el tipo de usuario
    console.log('🔍 Buscando perfil para tipo de usuario:', user.user_type);
    
    if (user.user_type === 'technician') {
      const technicianProfiles = await query(
        'SELECT * FROM technician_profiles WHERE user_id = ?',
        [userId]
      );
      profile = technicianProfiles[0] || null;
      console.log('🔍 Perfil de técnico encontrado:', !!profile);
    } else if (user.user_type === 'company') {
      const companyProfiles = await query(
        'SELECT * FROM company_profiles WHERE user_id = ?',
        [userId]
      );
      profile = companyProfiles[0] || null;
      console.log('🔍 Perfil de empresa encontrado:', !!profile);
    }

    const responseData = {
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
    };

    console.log('✅ Respuesta de perfil enviada:', {
      userId: responseData.user.id,
      userType: responseData.user.userType,
      hasProfile: !!responseData.profile
    });

    res.json(responseData);

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener el perfil'
    });
  }
});

// Actualizar perfil del usuario
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Actualizando perfil para usuario:', {
      userId: req.user?.userId,
      userType: req.user?.userType
    });
    
    const userId = req.user.userId;
    const updateData = req.body;
    
    // Obtener información del usuario
    const users = await query(
      'SELECT user_type FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    const user = users[0];
    let updatedProfile = null;

    // Actualizar perfil según el tipo de usuario
    if (user.user_type === 'technician') {
      const result = await query(
        `UPDATE technician_profiles SET 
         location = ?, 
         skills = ?, 
         experience_years = ?, 
         hourly_rate = ?, 
         availability = ?, 
         bio = ?
         WHERE user_id = ?`,
        [
          updateData.location || null,
          updateData.skills || null,
          updateData.experience_years || 0,
          updateData.hourly_rate || 0,
          updateData.availability || null,
          updateData.bio || null,
          userId
        ]
      );

      // Obtener perfil actualizado
      const updatedProfiles = await query(
        'SELECT * FROM technician_profiles WHERE user_id = ?',
        [userId]
      );
      updatedProfile = updatedProfiles[0] || null;

    } else if (user.user_type === 'company') {
      const result = await query(
        `UPDATE company_profiles SET 
         company_name = ?, 
         industry = ?, 
         company_size = ?, 
         website = ?, 
         description = ?, 
         founded_year = ?, 
         location = ?, 
         contact_person = ?, 
         contact_phone = ?
         WHERE user_id = ?`,
        [
          updateData.company_name || null,
          updateData.industry || null,
          updateData.company_size || null,
          updateData.website || null,
          updateData.description || null,
          updateData.founded_year || null,
          updateData.location || null,
          updateData.contact_person || null,
          updateData.contact_phone || null,
          userId
        ]
      );

      // Obtener perfil actualizado
      const updatedProfiles = await query(
        'SELECT * FROM company_profiles WHERE user_id = ?',
        [userId]
      );
      updatedProfile = updatedProfiles[0] || null;
    }

    console.log('✅ Perfil actualizado exitosamente');

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: {
        id: userId,
        userType: user.user_type
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

module.exports = router; 