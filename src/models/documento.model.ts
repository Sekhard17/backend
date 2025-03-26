// src/models/documento.model.ts
// Este modelo maneja la interacción con la tabla de documentos en la base de datos

import supabase from '../config/supabase'
import { Documento as DocumentoType, DocumentoCrear } from '../types/documentos.types'

// Obtener un documento por ID
export const obtenerDocumentoPorId = async (id: string) => {
  const { data, error } = await supabase
    .from('documentos')
    .select('*, actividades(id, titulo, fecha)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Obtener documentos de una actividad
export const obtenerDocumentosPorActividad = async (actividadId: string) => {
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('id_actividad', actividadId)
    .order('fecha_creacion', { ascending: false })

  if (error) throw error
  return data
}

// Crear un nuevo documento
export const crearDocumento = async (documento: DocumentoCrear) => {
  const { data, error } = await supabase
    .from('documentos')
    .insert([documento])
    .select()
    .single()

  if (error) throw error
  return data
}

// Eliminar un documento
export const eliminarDocumento = async (id: string) => {
  // Primero obtener la ruta del archivo para eliminarlo del storage
  const { data: documento, error: errorConsulta } = await supabase
    .from('documentos')
    .select('ruta_archivo')
    .eq('id', id)
    .single()

  if (errorConsulta) throw errorConsulta

  // Extraer el nombre del archivo de la URL pública
  let rutaArchivo = '';
  
  try {
    // Si es una URL completa (comienza con http o https)
    if (documento.ruta_archivo.startsWith('http')) {
      const url = new URL(documento.ruta_archivo);
      // La ruta en Supabase Storage está en el pathname después del bucket
      const pathname = url.pathname;
      // Encontrar la posición después de "/documentos/"
      const bucketPos = pathname.indexOf('/documentos/');
      if (bucketPos !== -1) {
        rutaArchivo = pathname.substring(bucketPos + 12); // +12 para saltar "/documentos/"
      }
    } else {
      // Si es solo una ruta relativa
      rutaArchivo = documento.ruta_archivo;
    }
  } catch (e) {
    console.error('Error al extraer ruta de archivo:', e);
    // En caso de error, usar la forma anterior como fallback
    rutaArchivo = documento.ruta_archivo.split('/').pop() || '';
  }
  
  // Eliminar el archivo del storage si se pudo extraer la ruta
  if (rutaArchivo) {
    const { error: errorStorage } = await supabase
      .storage
      .from('documentos')
      .remove([rutaArchivo])
    
    if (errorStorage) {
      console.error('Error al eliminar archivo de storage:', errorStorage);
      // No lanzamos error para continuar con la eliminación del registro
    }
  }

  // Eliminar el registro de la base de datos
  const { error } = await supabase
    .from('documentos')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

// Obtener URL firmada para un documento
export const obtenerUrlFirmada = async (id: string) => {
  // Obtener la ruta del archivo
  const { data: documento, error: errorConsulta } = await supabase
    .from('documentos')
    .select('ruta_archivo')
    .eq('id', id)
    .single()

  if (errorConsulta) throw errorConsulta

  // Extraer el nombre del archivo de la URL pública
  let rutaArchivo = '';
  
  try {
    // Si es una URL completa (comienza con http o https)
    if (documento.ruta_archivo.startsWith('http')) {
      const url = new URL(documento.ruta_archivo);
      // La ruta en Supabase Storage está en el pathname después del bucket
      const pathname = url.pathname;
      // Encontrar la posición después de "/documentos/"
      const bucketPos = pathname.indexOf('/documentos/');
      if (bucketPos !== -1) {
        rutaArchivo = pathname.substring(bucketPos + 12); // +12 para saltar "/documentos/"
      }
    } else {
      // Si es solo una ruta relativa
      rutaArchivo = documento.ruta_archivo;
    }
  } catch (e) {
    console.error('Error al extraer ruta de archivo:', e);
    // En caso de error, usar la forma anterior como fallback
    rutaArchivo = documento.ruta_archivo.split('/').pop() || '';
  }
  
  if (!rutaArchivo) throw new Error('Ruta de archivo no válida')

  // Generar URL firmada
  const { data, error } = await supabase
    .storage
    .from('documentos')
    .createSignedUrl(rutaArchivo, 60 * 60) // URL válida por 1 hora

  if (error) throw error
  return data.signedUrl
}

// Interfaz para documentos
export interface IDocumento {
  id: string;
  nombre: string;
  descripcion?: string;
  url: string;
  tipo: string;
  tamano: number;
  id_actividad: string;
  id_usuario?: string;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

// Obtener documentos de múltiples actividades
export const obtenerDocumentosPorActividades = async (actividadesIds: string[]) => {
  if (!actividadesIds.length) return [];
  
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .in('id_actividad', actividadesIds)
    .order('fecha_creacion', { ascending: false })

  if (error) throw error
  return data || []
}

// Obtener documentos por proyecto
export const obtenerDocumentosPorProyecto = async (idProyecto: string): Promise<IDocumento[]> => {
  try {
    // Primero obtenemos todas las actividades del proyecto
    const { data: actividades, error: errorActividades } = await supabase
      .from('actividades')
      .select('id')
      .eq('id_proyecto', idProyecto);

    if (errorActividades) throw errorActividades;
    
    // Si no hay actividades, retornamos array vacío
    if (!actividades || actividades.length === 0) {
      return [];
    }
    
    // Extraemos los IDs de las actividades
    const actividadesIds = actividades.map(act => act.id);
    
    // Ahora buscamos los documentos asociados a esas actividades, incluyendo datos de la actividad
    const { data, error } = await supabase
      .from('documentos')
      .select(`
        *,
        actividades (
          id,
          descripcion,
          fecha,
          usuarios (
            id,
            nombres,
            appaterno
          )
        )
      `)
      .in('id_actividad', actividadesIds)
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error en obtenerDocumentosPorProyecto:', error);
    throw error;
  }
}