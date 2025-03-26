// src/services/actividades.service.ts
// Este servicio maneja la lógica de negocio para actividades

import * as actividadModel from '../models/actividad.model'
import * as usuarioModel from '../models/usuario.model'
import { ActividadCrear, ActividadActualizar } from '../types/actividades.types'

// Obtener una actividad por ID
export const obtenerActividad = async (id: string, usuarioId: string, esSupervisor: boolean) => {
  const actividad = await actividadModel.obtenerActividadPorId(id)
  
  // Verificar permisos
  if (actividad.id_usuario !== usuarioId) {
    if (!esSupervisor) {
      throw new Error('No tiene permisos para ver esta actividad')
    }
    
    // Si es supervisor, verificar que el usuario sea su supervisado
    const esSupervisado = await usuarioModel.esSupervisadoPor(actividad.id_usuario, usuarioId)
    if (!esSupervisado) {
      throw new Error('No tiene permisos para ver esta actividad')
    }
  }
  
  return actividad
}

// Obtener actividades de un usuario
export const obtenerActividadesUsuario = async (usuarioId: string, fecha?: Date, estado?: string) => {
  return await actividadModel.obtenerActividadesPorUsuario(usuarioId, fecha, estado)
}

// Obtener actividades en un rango de fechas
export const obtenerActividadesPorRango = async (
  usuarioId: string,
  fechaInicio: Date,
  fechaFin: Date,
  estado: string = 'enviado'
) => {
  return await actividadModel.obtenerActividadesPorRango(usuarioId, fechaInicio, fechaFin, estado)
}

// Crear una nueva actividad
export const crearActividad = async (actividad: ActividadCrear) => {
  // Verificar que la fecha no sea anterior a hoy
  console.log('Fecha de actividad recibida:', actividad.fecha);
  
  // Obtener la fecha actual en la zona horaria local
  const ahora = new Date();
  console.log('Fecha y hora actual del sistema:', ahora.toISOString());
  
  // Crear la fecha de la actividad como objeto Date
  const fechaActividad = new Date(actividad.fecha);
  console.log('Fecha de actividad parseada:', fechaActividad.toISOString());
  
  // Obtener solo la fecha (sin hora) para la fecha actual
  const hoyString = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
  const hoy = new Date(hoyString + 'T00:00:00.000Z');
  console.log('Fecha de hoy (sin hora):', hoyString, '- objeto Date:', hoy.toISOString());
  
  // Obtener solo la fecha (sin hora) para la fecha de la actividad
  const fechaActividadString = fechaActividad.toISOString().split('T')[0]; // YYYY-MM-DD
  const fechaActividadSinHora = new Date(fechaActividadString + 'T00:00:00.000Z');
  console.log('Fecha de actividad (sin hora):', fechaActividadString, '- objeto Date:', fechaActividadSinHora.toISOString());
  
  // Comparar las fechas como strings (YYYY-MM-DD)
  if (fechaActividadString < hoyString) {
    console.log('ERROR: La fecha de la actividad es anterior a hoy');
    console.log('Comparación de strings: ', fechaActividadString, ' < ', hoyString);
    throw new Error('No se pueden crear actividades para fechas pasadas');
  }
  
  console.log('Validación de fecha pasada: OK');
  
  // ALTERNATIVA: Desactivar temporalmente esta validación para pruebas
  // Descomentar para desactivar la validación
  /*
  console.log('AVISO: Validación de fechas pasadas DESACTIVADA para pruebas');
  */
  
  // Verificar superposición de horarios
  const haySuperposicion = await actividadModel.verificarSuperposicionHorarios(
    actividad.id_usuario,
    fechaActividad,
    actividad.hora_inicio,
    actividad.hora_fin
  )
  
  if (haySuperposicion) {
    throw new Error('La actividad se superpone con otra actividad existente')
  }
  
  return await actividadModel.crearActividad(actividad)
}

// Actualizar una actividad
export const actualizarActividad = async (
  id: string,
  actividad: ActividadActualizar,
  usuarioId: string
) => {
  // Obtener la actividad actual
  const actividadActual = await actividadModel.obtenerActividadPorId(id)
  
  // Verificar permisos
  if (actividadActual.id_usuario !== usuarioId) {
    throw new Error('No tiene permisos para editar esta actividad')
  }
  
  // Si solo se está actualizando el estado, permitir la actualización
  if (Object.keys(actividad).length === 1 && actividad.estado !== undefined) {
    return await actividadModel.actualizarActividad(id, actividad)
  }
  
  // Para otras actualizaciones, verificar que la actividad esté en estado 'borrador'
  if (actividadActual.estado !== 'borrador') {
    throw new Error('No se puede editar una actividad que ya ha sido enviada')
  }
  
  // Verificar que la fecha de la actividad sea hoy o futura
  const fechaActividad = new Date(actividadActual.fecha)
  const hoy = new Date()
  
  // Resetear las horas para comparar solo fechas
  fechaActividad.setHours(0, 0, 0, 0)
  hoy.setHours(0, 0, 0, 0)
  
  if (fechaActividad < hoy) {
    throw new Error('No se pueden editar actividades de fechas pasadas')
  }
  
  // Si se están actualizando las horas, verificar superposición
  if (actividad.hora_inicio || actividad.hora_fin) {
    const horaInicio = actividad.hora_inicio || actividadActual.hora_inicio
    const horaFin = actividad.hora_fin || actividadActual.hora_fin
    
    const haySuperposicion = await actividadModel.verificarSuperposicionHorarios(
      usuarioId,
      fechaActividad,
      horaInicio,
      horaFin,
      id
    )
    
    if (haySuperposicion) {
      throw new Error('La actividad se superpone con otra actividad existente')
    }
  }
  
  return await actividadModel.actualizarActividad(id, actividad)
}

// Eliminar una actividad
export const eliminarActividad = async (id: string, usuarioId: string) => {
  // Obtener la actividad actual
  const actividad = await actividadModel.obtenerActividadPorId(id)
  
  // Verificar permisos
  if (actividad.id_usuario !== usuarioId) {
    throw new Error('No tiene permisos para eliminar esta actividad')
  }
  
  // Verificar que la actividad esté en estado 'borrador'
  if (actividad.estado !== 'borrador') {
    throw new Error('No se puede eliminar una actividad que ya ha sido enviada')
  }
  
  // Eliminar la actividad sin verificar la fecha
  return await actividadModel.eliminarActividad(id)
}

// Enviar actividades
export const enviarActividades = async (ids: string[], usuarioId: string) => {
  // Verificar que todas las actividades pertenezcan al usuario
  for (const id of ids) {
    const actividad = await actividadModel.obtenerActividadPorId(id)
    
    if (actividad.id_usuario !== usuarioId) {
      throw new Error('No tiene permisos para enviar esta actividad')
    }
    
    if (actividad.estado === 'enviado') {
      throw new Error('Una o más actividades ya han sido enviadas')
    }
  }
  
  return await actividadModel.enviarActividades(ids)
}

// Obtener actividades de supervisados
export const obtenerActividadesSupervisados = async (
  supervisorId: string,
  fechaInicio?: Date,
  fechaFin?: Date,
  usuarioId?: string,
  proyectoId?: string,
  estado?: string
) => {
  return await actividadModel.obtenerActividadesSupervisados(
    supervisorId,
    fechaInicio,
    fechaFin,
    usuarioId,
    proyectoId,
    estado
  )
}