// src/middlewares/upload.middleware.ts
// Este middleware maneja la subida de archivos

import multer from 'multer'
import path from 'path'
import { Request } from 'express'
import { createError } from './error.middleware'

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

// Filtro de archivos
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Tipos de archivo permitidos
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(createError('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG), PDF y documentos Word.', 400))
  }
}

// Límites
const limits = {
  fileSize: 5 * 1024 * 1024 // 5MB
}

// Middleware de multer
export const upload = multer({
  storage,
  fileFilter,
  limits
})