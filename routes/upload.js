const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    console.log('📁 Directorio de destino:', uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.round(Math.random() * 1E9));
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + ext;
    console.log('📄 Nombre del archivo generado:', filename);
    cb(null, filename);
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  console.log('🔍 Verificando archivo:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });
  
  // Permitir imágenes y documentos de CV
  if (file.mimetype.startsWith('image/') || 
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'), false);
  }
};

// Configurar multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB por defecto
  }
});

// Subir imagen de perfil
router.post('/profile-image', [
  authenticateToken,
  upload.single('image')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Archivo requerido',
        message: 'Debes seleccionar una imagen para subir'
      });
    }

    // Verificar que el archivo es una imagen
    if (!req.file.mimetype.startsWith('image/')) {
      // Eliminar archivo si no es imagen
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Tipo de archivo inválido',
        message: 'Solo se permiten archivos de imagen'
      });
    }

    // Generar URL del archivo
    const fileUrl = `${process.env.API_URL || 'http://localhost:3001'}/uploads/${req.file.filename}`;

    res.json({
      message: 'Imagen subida exitosamente',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl
      }
    });

  } catch (error) {
    console.error('Error al subir imagen:', error);
    
    // Eliminar archivo si se subió pero hubo error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al subir la imagen'
    });
  }
});

// Subir imagen de proyecto
router.post('/project-image', [
  authenticateToken,
  upload.single('image')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Archivo requerido',
        message: 'Debes seleccionar una imagen para subir'
      });
    }

    // Verificar que el archivo es una imagen
    if (!req.file.mimetype.startsWith('image/')) {
      // Eliminar archivo si no es imagen
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Tipo de archivo inválido',
        message: 'Solo se permiten archivos de imagen'
      });
    }

    // Generar URL del archivo
    const fileUrl = `${process.env.API_URL || 'http://localhost:3001'}/uploads/${req.file.filename}`;

    res.json({
      message: 'Imagen de proyecto subida exitosamente',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl
      }
    });

  } catch (error) {
    console.error('Error al subir imagen de proyecto:', error);
    
    // Eliminar archivo si se subió pero hubo error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al subir la imagen del proyecto'
    });
  }
});

// Subir CV para técnicos
router.post('/cv', [
  authenticateToken,
  // Middleware de debugging
  (req, res, next) => {
    console.log('🔍 Request recibida en /upload/cv:');
    console.log('📋 Headers:', req.headers);
    console.log('📋 Body:', req.body);
    console.log('📋 Files:', req.files);
    console.log('📋 User:', req.user);
    next();
  },
  upload.single('cv')
], async (req, res) => {
  try {
    console.log('🚀 Iniciando upload de CV para usuario:', req.user.userId);
    
    // Verificar que el usuario sea técnico
    if (req.user.userType !== 'technician') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los técnicos pueden subir CV'
      });
    }

    if (!req.file) {
      console.log('❌ No se recibió archivo en la request');
      return res.status(400).json({
        error: 'Archivo requerido',
        message: 'Debes seleccionar un archivo CV para subir'
      });
    }

    console.log('📁 Archivo recibido:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Verificar que el archivo es un documento válido
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      console.log('❌ Tipo de archivo no permitido:', req.file.mimetype);
      // Eliminar archivo si no es válido
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Tipo de archivo inválido',
        message: 'Solo se permiten archivos PDF, DOC y DOCX'
      });
    }

    // Verificar que el archivo existe físicamente
    if (!fs.existsSync(req.file.path)) {
      console.log('❌ El archivo no existe en el sistema de archivos:', req.file.path);
      return res.status(500).json({
        error: 'Error del servidor',
        message: 'El archivo no se guardó correctamente'
      });
    }

    // Generar URL del archivo
    const fileUrl = `${process.env.API_URL || 'http://localhost:3001'}/uploads/${req.file.filename}`;
    console.log('🔗 URL del archivo generada:', fileUrl);

    // Actualizar el perfil del técnico con la información del CV
    const { query } = require('../config/database');
    const updateResult = await query(
      'UPDATE technician_profiles SET cv_file = ?, cv_uploaded = TRUE WHERE user_id = ?',
      [fileUrl, req.user.userId]
    );
    
    console.log('✅ CV actualizado en la base de datos:', updateResult);

    res.json({
      message: 'CV subido exitosamente',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
        cvUploaded: true
      }
    });

  } catch (error) {
    console.error('❌ Error al subir CV:', error);
    
    // Eliminar archivo si se subió pero hubo error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Archivo eliminado debido al error');
      } catch (unlinkError) {
        console.error('Error al eliminar archivo:', unlinkError);
      }
    }
    
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al subir el CV',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Servir archivos estáticos
router.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(process.env.UPLOAD_PATH || './uploads', filename);
  
  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: 'Archivo no encontrado',
      message: 'El archivo solicitado no existe'
    });
  }
  
  // Servir el archivo
  res.sendFile(filePath);
});

// Eliminar archivo
router.delete('/:filename', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(process.env.UPLOAD_PATH || './uploads', filename);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Archivo no encontrado',
        message: 'El archivo solicitado no existe'
      });
    }
    
    // Eliminar archivo
    fs.unlinkSync(filePath);
    
    res.json({
      message: 'Archivo eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al eliminar el archivo'
    });
  }
});

// Middleware de manejo de errores para multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Archivo demasiado grande',
        message: `El archivo excede el tamaño máximo permitido (${process.env.MAX_FILE_SIZE || '5MB'})`
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Campo inesperado',
        message: 'El campo de archivo no es válido'
      });
    }
    
    return res.status(400).json({
      error: 'Error en la subida',
      message: error.message
    });
  }
  
  if (error.message === 'Tipo de archivo no permitido') {
    return res.status(400).json({
      error: 'Tipo de archivo inválido',
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router; 