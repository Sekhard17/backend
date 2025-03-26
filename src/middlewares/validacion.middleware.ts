// src/middlewares/validacion.middleware.ts
// Este middleware maneja la validación de datos de entrada

import { Request, Response, NextFunction } from 'express'
import { validationResult, body, ValidationChain } from 'express-validator'
import { RequestHandler } from 'express'

// Middleware para validar los resultados de express-validator
export const validarResultados: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const errores = validationResult(req)
  if (!errores.isEmpty()) {
    res.status(400).json({ errores: errores.array() })
    return
  }
  next()
}

// Middleware para validar que no haya superposición de horarios
export const validarSuperposicionHorarios: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Esta validación se hará en el controlador o servicio
  // ya que requiere consultar la base de datos
  next()
}

// Middleware para validar que no se editen actividades de días anteriores
export const validarFechaActividad: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  // Durante el desarrollo, permitimos crear actividades en fechas pasadas para facilitar las pruebas
  // En producción, descomentar esta validación
  /*
  const fecha = new Date(req.body.fecha)
  const hoy = new Date()
  
  // Resetear las horas para comparar solo fechas
  fecha.setHours(0, 0, 0, 0)
  hoy.setHours(0, 0, 0, 0)
  
  if (fecha < hoy) {
    res.status(400).json({ message: 'No se pueden crear o editar actividades de días anteriores' })
    return
  }
  */
  
  next()
}

// Función para crear un middleware que ejecute validaciones de express-validator
const validar = (validaciones: ValidationChain[]): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await Promise.all(validaciones.map(validacion => validacion.run(req)));
      
      const errores = validationResult(req);
      if (errores.isEmpty()) {
        next();
        return;
      }
      
      res.status(400).json({ errores: errores.array() });
    } catch (error) {
      res.status(500).json({ message: 'Error en la validación', error });
    }
  };
};

// Validaciones para el registro de usuarios
const validacionesRegistro = [
  body('rut').notEmpty().withMessage('El RUT es obligatorio'),
  body('nombres').notEmpty().withMessage('Los nombres son obligatorios'),
  body('appaterno').notEmpty().withMessage('El apellido paterno es obligatorio'),
  body('email').isEmail().withMessage('El email debe tener un formato válido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('rol').isIn(['funcionario', 'supervisor']).withMessage('El rol debe ser funcionario o supervisor'),
  body('nombre_usuario').notEmpty().withMessage('El nombre de usuario es obligatorio')
];

// Validaciones para el login
const validacionesLogin = [
  body('nombre_usuario').notEmpty().withMessage('El nombre de usuario es obligatorio'),
  body('password').notEmpty().withMessage('La contraseña es obligatoria')
];

// Exportar middlewares de validación como RequestHandler
export const validarRegistro: RequestHandler = validar(validacionesRegistro);
export const validarLogin: RequestHandler = validar(validacionesLogin);