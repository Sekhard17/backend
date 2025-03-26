// src/controllers/usuarios.controller.ts
// Este controlador maneja las operaciones para usuarios

import { Request, Response, NextFunction } from 'express'
import * as usuariosService from '../services/usuarios.service'
import { UsuarioActualizar } from '../types/usuario.types'
import { RequestHandler } from 'express'
import RexService from '../services/rex.service'
import supabase from '../config/supabase'

// Obtener un usuario por ID
export const getUsuario: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id
    const esSupervisor = req.usuario?.rol === 'supervisor'
    
    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }
    
    const usuario = await usuariosService.obtenerUsuario(id, usuarioId, esSupervisor)
    res.json({ usuario })
  } catch (error: any) {
    console.error('Error al obtener usuario:', error)
    res.status(404).json({ message: error.message || 'Error al obtener usuario' })
  }
}

// Actualizar un usuario
export const actualizarUsuario: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const usuarioData = req.body as UsuarioActualizar
    const usuarioId = req.usuario?.id
    const esSupervisor = req.usuario?.rol === 'supervisor'
    
    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }
    
    const usuario = await usuariosService.actualizarUsuario(id, usuarioData, usuarioId, esSupervisor)
    res.json({
      message: 'Usuario actualizado exitosamente',
      usuario
    })
  } catch (error: any) {
    console.error('Error al actualizar usuario:', error)
    res.status(400).json({ message: error.message || 'Error al actualizar usuario' })
  }
}

// Obtener supervisados
export const getSupervisados: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const supervisorId = req.usuario?.id
    
    if (!supervisorId || req.usuario?.rol !== 'supervisor') {
      res.status(403).json({ message: 'No tiene permisos para ver supervisados' })
      return
    }
    
    const supervisados = await usuariosService.obtenerSupervisados(supervisorId)
    res.json({ supervisados })
  } catch (error: any) {
    console.error('Error al obtener supervisados:', error)
    res.status(500).json({ message: error.message || 'Error al obtener supervisados' })
  }
}

// Obtener detalles de un usuario
export const getUsuarioDetalle: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id
    const rol = req.usuario?.rol
    
    if (!usuarioId) {
      res.status(401).json({ message: 'No autorizado' })
      return
    }
    
    // Verificar permisos: solo puede ver sus propios detalles o los de sus supervisados si es supervisor
    if (id !== usuarioId && !(rol === 'supervisor' && await usuariosService.esSupervisado(id, usuarioId))) {
      res.status(403).json({ message: 'No tiene permisos para ver los detalles de este usuario' })
      return
    }
    
    const usuario = await usuariosService.obtenerUsuario(id, usuarioId, rol === 'supervisor')
    
    // Obtener información adicional según el rol
    let detalles: any = {
      ...usuario,
      departamento: usuario.departamento || 'No asignado',
      cargo: usuario.cargo || 'No asignado'
    }
    
    // Para supervisores, obtener lista de supervisados
    if (usuario.rol === 'supervisor') {
      const supervisados = await usuariosService.obtenerSupervisados(id)
      detalles.supervisados = supervisados
    }
    
    // Obtener información laboral desde REX usando el RUT
    try {
      if (usuario.rut) {
        // Obtener datos del empleado desde la tabla empleados_rex
        const empleadoRex = await RexService.obtenerEmpleadoPorRut(usuario.rut)
        
        if (empleadoRex) {
          // Obtener contratos activos del empleado
          const contratos = await RexService.obtenerContratosEmpleado(usuario.rut, true)
          
          if (contratos && contratos.length > 0) {
            // Obtener información del contrato activo más reciente
            const contratoActivo = contratos[0]
            
            // Obtener información adicional de la empresa
            const { data: empresa } = await supabase
              .from('empresas_rex')
              .select('nombre')
              .eq('codigo', contratoActivo.empresa_id)
              .single();
            
            // Obtener información adicional del centro de costo
            const { data: centroCosto } = await supabase
              .from('centros_costo_rex')
              .select('nombre')
              .eq('codigo', contratoActivo.centro_costo_codigo)
              .single();
            
            // Añadir información laboral a los detalles
            detalles.informacionLaboral = {
              empresa: {
                codigo: contratoActivo.empresa_id,
                nombre: empresa?.nombre || 'No asignado'
              },
              centroCosto: {
                codigo: contratoActivo.centro_costo_codigo,
                nombre: centroCosto?.nombre || 'No asignado'
              },
              cargo: contratoActivo.cargos_rex?.nombre || 'No asignado',
              supervisor: contratoActivo.rut_supervisor || 'No asignado',
              fechaInicio: contratoActivo.fecha_inicio,
              fechaTermino: contratoActivo.fecha_termino,
              estado: contratoActivo.estado
            }
          }
        }
      }
    } catch (error) {
      console.warn(`No se pudo obtener información laboral para el usuario ${usuario.rut}:`, error)
      // No interrumpimos el flujo principal si hay error en la información laboral
    }
    
    res.json(detalles)
  } catch (error: any) {
    console.error('Error al obtener detalles del usuario:', error)
    res.status(500).json({ message: error.message || 'Error al obtener detalles del usuario' })
  }
}