// src/services/proyectos.service.ts
// Este servicio maneja la lógica de negocio para proyectos

import * as proyectoModel from '../models/proyecto.model'
import * as usuarioModel from '../models/usuario.model'
import { ProyectoCrear, ProyectoActualizar } from '../types/proyecto.types'

// Obtener un proyecto por ID
export const obtenerProyecto = async (id: string) => {
  return await proyectoModel.obtenerProyectoPorId(id)
}

// Obtener todos los proyectos
export const obtenerProyectos = async (activo?: boolean) => {
  return await proyectoModel.obtenerProyectos(activo)
}

// Obtener proyectos por supervisor
export const obtenerProyectosPorSupervisor = async (supervisorId: string, activo?: boolean) => {
  return await proyectoModel.obtenerProyectosPorSupervisor(supervisorId, activo)
}

// Crear un nuevo proyecto
export const crearProyecto = async (proyecto: ProyectoCrear) => {
  return await proyectoModel.crearProyecto(proyecto)
}

// Actualizar un proyecto
export const actualizarProyecto = async (id: string, proyecto: ProyectoActualizar) => {
  return await proyectoModel.actualizarProyecto(id, proyecto)
}

// Desactivar un proyecto
export const desactivarProyecto = async (id: string) => {
  // Verificar si el proyecto tiene actividades asociadas
  const tieneActividades = await proyectoModel.tieneActividadesAsociadas(id)
  
  if (tieneActividades) {
    throw new Error('No se puede desactivar un proyecto que tiene actividades asociadas')
  }
  
  return await proyectoModel.desactivarProyecto(id)
}

// Activar un proyecto
export const activarProyecto = async (id: string) => {
  return await proyectoModel.activarProyecto(id)
}

// Obtener proyectos con estadísticas
export const obtenerProyectosConEstadisticas = async (fechaInicio?: Date, fechaFin?: Date) => {
  return await proyectoModel.obtenerProyectosConEstadisticas(fechaInicio, fechaFin)
}

// Obtener proyectos asignados a un usuario
export const obtenerProyectosDeUsuario = async (usuarioId: string) => {
  return await proyectoModel.obtenerProyectosDeUsuario(usuarioId)
}

// Asignar proyecto a usuario
export const asignarProyectoAUsuario = async (usuarioId: string, proyectoId: string, supervisorId: string) => {
  // Verificar si el proyecto ya está asignado al usuario
  const yaAsignado = await proyectoModel.verificarAsignacionProyecto(usuarioId, proyectoId)
  if (yaAsignado) {
    throw new Error('El proyecto ya está asignado a este usuario')
  }
  
  return await proyectoModel.asignarProyectoAUsuario(usuarioId, proyectoId, supervisorId)
}

// Desasignar proyecto de usuario
export const desasignarProyectoDeUsuario = async (usuarioId: string, proyectoId: string) => {
  // Verificar si el proyecto está asignado al usuario
  const asignado = await proyectoModel.verificarAsignacionProyecto(usuarioId, proyectoId)
  if (!asignado) {
    throw new Error('El proyecto no está asignado a este usuario')
  }
  
  return await proyectoModel.desasignarProyectoDeUsuario(usuarioId, proyectoId)
}

// Obtener usuarios asignados a un proyecto
export const obtenerUsuariosDeProyecto = async (proyectoId: string) => {
  return await proyectoModel.obtenerUsuariosDeProyecto(proyectoId);
}