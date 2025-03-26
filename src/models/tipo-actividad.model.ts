// src/models/tipo-actividad.model.ts
// Este modelo maneja la interacción con la tabla de tipos de actividad en la base de datos

import supabase from '../config/supabase'
import { TipoActividad } from '../types/actividades.types'

// Obtener todos los tipos de actividad activos
export const obtenerTiposActividad = async (incluirInactivos: boolean = false) => {
  let query = supabase
    .from('tipos_actividad')
    .select('*')
    .order('nombre', { ascending: true })

  if (!incluirInactivos) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

// Obtener un tipo de actividad por ID
export const obtenerTipoActividadPorId = async (id: string) => {
  const { data, error } = await supabase
    .from('tipos_actividad')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Crear un nuevo tipo de actividad
export const crearTipoActividad = async (tipo: Omit<TipoActividad, 'id' | 'fecha_creacion' | 'fecha_actualizacion'>) => {
  const { data, error } = await supabase
    .from('tipos_actividad')
    .insert([{
      ...tipo,
      activo: true
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// Actualizar un tipo de actividad
export const actualizarTipoActividad = async (id: string, tipo: Partial<TipoActividad>) => {
  const { data, error } = await supabase
    .from('tipos_actividad')
    .update({
      ...tipo,
      fecha_actualizacion: new Date()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Desactivar un tipo de actividad
export const desactivarTipoActividad = async (id: string) => {
  const { data, error } = await supabase
    .from('tipos_actividad')
    .update({
      activo: false,
      fecha_actualizacion: new Date()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Verificar si un tipo de actividad tiene actividades asociadas
export const tieneActividadesAsociadas = async (id: string) => {
  const { count, error } = await supabase
    .from('actividades')
    .select('id', { count: 'exact', head: true })
    .eq('id_tipo_actividad', id)

  if (error) throw error
  return count && count > 0
} 