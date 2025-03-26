// src/middlewares/auth.middleware.ts
// Este middleware verifica que el usuario esté autenticado y tiene los permisos adecuados

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import config from '../config/config'
import { RequestHandler } from 'express'

// Definir una interfaz para el usuario en el token
interface UsuarioToken {
  id: string
  nombre_usuario: string
  rol: 'funcionario' | 'supervisor'
  id_supervisor?: string
}

// Extender la interfaz Request para incluir el usuario
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioToken
    }
  }
}

// Middleware para verificar el token JWT
export const verificarToken: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ message: 'No se proporcionó token de autenticación' });
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwt_secret) as UsuarioToken;
      
      // Verificar que el token no esté expirado
      const tokenExp = (decoded as any).exp;
      if (tokenExp && Date.now() >= tokenExp * 1000) {
        res.status(401).json({ message: 'Token expirado' });
        return;
      }

      req.usuario = decoded;
      next();
    } catch (jwtError) {
      console.error('Error al verificar token:', jwtError);
      res.status(401).json({ message: 'Token inválido o expirado' });
    }
  } catch (error) {
    console.error('Error inesperado en middleware de autenticación:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
}

// Middleware para verificar rol de supervisor
export const esSupervisor: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.usuario?.rol !== 'supervisor') {
    res.status(403).json({ message: 'Acceso denegado: se requiere rol de supervisor' })
    return
  }
  next()
}

// Middleware para verificar que el usuario solo acceda a sus propios recursos o los de sus supervisados
export const verificarAccesoRecurso: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const usuarioId = req.params.id || req.params.userId || req.body.id_usuario
  
  // Si el usuario es el mismo que está solicitando el recurso, permitir
  if (req.usuario?.id === usuarioId) {
    next()
    return
  }
  
  // Si el usuario es supervisor y el recurso pertenece a uno de sus supervisados, permitir
  if (req.usuario?.rol === 'supervisor') {
    // Aquí deberíamos verificar si el usuario es supervisado por el supervisor
    // Esta lógica se implementará en el servicio correspondiente
    next()
    return
  }
  
  res.status(403).json({ message: 'Acceso denegado: no tiene permisos para este recurso' })
}