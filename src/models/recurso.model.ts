// src/models/recurso.model.ts
// Este modelo maneja la interacción con la tabla de recursos de proyectos en la base de datos

import supabase from '../config/supabase'
import { Recurso, RecursoCrear, RecursoActualizar, UrlFirmada } from '../types/recursos.types'
import { ErrorPersonalizado } from '../utils/errorHandler'
import path from 'path'

const BUCKET_NAME = 'recursos'
const TABLE_NAME = 'recursos_proyecto'

// Obtener un recurso por ID
export const obtenerRecursoPorId = async (id: string): Promise<Recurso | null> => {
  const { data: recurso, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new ErrorPersonalizado(500, 'Error al obtener el recurso')
  return recurso
}

// Obtener recursos de un proyecto
export const obtenerRecursosProyecto = async (id_proyecto: string, estado: string = 'activo'): Promise<Recurso[]> => {
  const { data: recursos, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id_proyecto', id_proyecto)
    .eq('estado', estado)

  if (error) throw new ErrorPersonalizado(500, 'Error al obtener los recursos del proyecto')
  return recursos || []
}

// Crear un nuevo recurso
export const crearRecurso = async (recursoData: RecursoCrear): Promise<Recurso> => {
  const { id_proyecto, id_usuario, nombre, descripcion, archivo } = recursoData

  // Generar un nombre único para el archivo
  const extension = path.extname(archivo.originalname)
  const timestamp = Date.now()
  const nombreArchivo = `${timestamp}${extension}`
  const rutaArchivo = `${id_proyecto}/${nombreArchivo}`

  try {
    // Subir el archivo a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(rutaArchivo, archivo.buffer, {
        contentType: archivo.mimetype,
        cacheControl: '3600'
      })

    if (uploadError) {
      throw new ErrorPersonalizado(500, 'Error al subir el archivo')
    }

    // Crear el registro en la base de datos
    const { data: recurso, error: dbError } = await supabase
      .from(TABLE_NAME)
      .insert({
        id_proyecto,
        id_usuario,
        nombre,
        descripcion,
        ruta_archivo: rutaArchivo,
        tipo_archivo: archivo.mimetype,
        tamaño_bytes: archivo.size,
        estado: 'activo'
      })
      .select()
      .single()

    if (dbError || !recurso) {
      // Si hay error en la BD, eliminar el archivo subido
      await supabase.storage
        .from(BUCKET_NAME)
        .remove([rutaArchivo])
      
      throw new ErrorPersonalizado(500, 'Error al crear el recurso en la base de datos')
    }

    return recurso
  } catch (error) {
    if (error instanceof ErrorPersonalizado) throw error
    throw new ErrorPersonalizado(500, 'Error al crear el recurso')
  }
}

// Actualizar un recurso
export const actualizarRecurso = async (id: string, cambios: RecursoActualizar): Promise<Recurso> => {
  // Obtener el recurso actual
  const recursoActual = await obtenerRecursoPorId(id)
  if (!recursoActual) throw new ErrorPersonalizado(404, 'Recurso no encontrado')

  let actualizacion: any = {
    nombre: cambios.nombre,
    descripcion: cambios.descripcion,
    fecha_actualizacion: new Date()
  }

  // Si hay un nuevo archivo
  if (cambios.archivo) {
    // Eliminar el archivo anterior
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([recursoActual.ruta_archivo])

    // Subir el nuevo archivo
    const extension = path.extname(cambios.archivo.originalname)
    const timestamp = Date.now()
    const nombreArchivo = `${timestamp}${extension}`
    const rutaArchivo = `${recursoActual.id_proyecto}/${nombreArchivo}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(rutaArchivo, cambios.archivo.buffer, {
        contentType: cambios.archivo.mimetype,
        cacheControl: '3600'
      })

    if (uploadError) {
      throw new ErrorPersonalizado(500, 'Error al subir el nuevo archivo')
    }

    actualizacion = {
      ...actualizacion,
      ruta_archivo: rutaArchivo,
      tipo_archivo: cambios.archivo.mimetype,
      tamaño_bytes: cambios.archivo.size
    }
  }

  // Actualizar el registro en la base de datos
  const { data: recurso, error } = await supabase
    .from(TABLE_NAME)
    .update(actualizacion)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new ErrorPersonalizado(500, 'Error al actualizar el recurso')
  return recurso
}

// Archivar un recurso
export const archivarRecurso = async (id: string): Promise<Recurso> => {
  const { data: recurso, error } = await supabase
    .from(TABLE_NAME)
    .update({ estado: 'archivado', fecha_actualizacion: new Date() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new ErrorPersonalizado(500, 'Error al archivar el recurso')
  return recurso
}

// Restaurar un recurso archivado
export const restaurarRecurso = async (id: string): Promise<Recurso> => {
  const { data: recurso, error } = await supabase
    .from(TABLE_NAME)
    .update({ estado: 'activo', fecha_actualizacion: new Date() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new ErrorPersonalizado(500, 'Error al restaurar el recurso')
  return recurso
}

// Eliminar permanentemente un recurso
export const eliminarRecurso = async (id: string): Promise<void> => {
  const recurso = await obtenerRecursoPorId(id)
  if (!recurso) throw new ErrorPersonalizado(404, 'Recurso no encontrado')

  // Eliminar el archivo de Supabase Storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([recurso.ruta_archivo])

  if (storageError) {
    throw new ErrorPersonalizado(500, 'Error al eliminar el archivo')
  }

  // Eliminar el registro de la base de datos
  const { error: dbError } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)

  if (dbError) throw new ErrorPersonalizado(500, 'Error al eliminar el recurso de la base de datos')
}

// Obtener URL firmada para acceso temporal
export const obtenerUrlFirmada = async (id: string): Promise<{ signedUrl: string; expiresAt: Date }> => {
  const recurso = await obtenerRecursoPorId(id)
  if (!recurso) throw new ErrorPersonalizado(404, 'Recurso no encontrado')

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(recurso.ruta_archivo, 3600) // URL válida por 1 hora

  if (error) throw new ErrorPersonalizado(500, 'Error al generar la URL firmada')

  return {
    signedUrl: data.signedUrl,
    expiresAt: new Date(Date.now() + 3600 * 1000) // 1 hora desde ahora
  }
} 