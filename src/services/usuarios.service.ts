// src/services/usuarios.service.ts
// Este servicio maneja la lógica de negocio para usuarios

import bcrypt from 'bcrypt'
import * as usuarioModel from '../models/usuario.model'
import { UsuarioActualizar } from '../types/usuario.types'

// Obtener un usuario por ID
export const obtenerUsuario = async (id: string, usuarioId: string, esSupervisor: boolean) => {
  // Verificar permisos
  if (id !== usuarioId) {
    if (!esSupervisor) {
      throw new Error('No tiene permisos para ver este usuario')
    }
    
    // Verificar si el usuario es supervisado por el supervisor
    const esSupervisado = await usuarioModel.esSupervisadoPor(id, usuarioId)
    if (!esSupervisado) {
      throw new Error('No tiene permisos para ver este usuario')
    }
  }
  
  return await usuarioModel.obtenerUsuarioPorId(id)
}

// Actualizar un usuario
export const actualizarUsuario = async (id: string, usuario: UsuarioActualizar, usuarioId: string, esAdmin: boolean) => {
  // Verificar permisos
  if (id !== usuarioId && !esAdmin) {
    throw new Error('No tiene permisos para actualizar este usuario')
  }
  
  // Si se está actualizando la contraseña, hashearla
  if (usuario.password) {
    const salt = await bcrypt.genSalt(10)
    usuario.password = await bcrypt.hash(usuario.password, salt)
  }
  
  return await usuarioModel.actualizarUsuario(id, usuario)
}

// Obtener supervisados
export const obtenerSupervisados = async (supervisorId: string) => {
  return await usuarioModel.obtenerSupervisados(supervisorId)
}

// Verificar si un usuario es supervisado por otro
export const esSupervisado = async (usuarioId: string, supervisorId: string): Promise<boolean> => {
  return await usuarioModel.esSupervisadoPor(usuarioId, supervisorId)
}