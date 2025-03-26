// src/models/proyecto.model.ts
// Este modelo maneja la interacción con la tabla de proyectos en la base de datos

import supabase from '../config/supabase'
import { Proyecto, ProyectoCrear, ProyectoActualizar } from '../types/proyecto.types'

// Interfaces
export interface IProyecto {
  id: string;
  nombre: string;
  descripcion?: string;
  id_supervisor: string;
  activo: boolean;
  estado: 'planificado' | 'en_progreso' | 'completado' | 'cancelado';
  fecha_inicio?: Date | null;
  fecha_fin?: Date | null;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

export interface IAsignacionProyecto {
  id: string;
  proyecto_id: string;
  usuario_id: string;
  fecha_asignacion: Date;
}

// Obtener un proyecto por ID
export const obtenerProyectoPorId = async (id: string) => {
  const { data, error } = await supabase
    .from('proyectos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Obtener todos los proyectos
export const obtenerProyectos = async (activo?: boolean) => {
  let query = supabase
    .from('proyectos')
    .select('*')
    .order('nombre', { ascending: true })

  if (activo !== undefined) {
    query = query.eq('activo', activo)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

// Obtener proyectos por supervisor
export const obtenerProyectosPorSupervisor = async (supervisorId: string, activo?: boolean) => {
  console.log(`Buscando proyectos para el supervisor: ${supervisorId}`)
  
  let query = supabase
    .from('proyectos')
    .select('*')
    .eq('id_supervisor', supervisorId)
    .order('nombre', { ascending: true })

  if (activo !== undefined) {
    query = query.eq('activo', activo)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error al obtener proyectos por supervisor:', error)
    throw error
  }
  
  console.log(`Se encontraron ${data?.length || 0} proyectos para el supervisor ${supervisorId}`)
  return data
}

// Crear un nuevo proyecto
export const crearProyecto = async (proyecto: ProyectoCrear) => {
  const { data, error } = await supabase
    .from('proyectos')
    .insert([{
      ...proyecto,
      activo: true
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// Actualizar un proyecto
export const actualizarProyecto = async (id: string, proyecto: ProyectoActualizar) => {
  const { data, error } = await supabase
    .from('proyectos')
    .update({
      ...proyecto,
      fecha_actualizacion: new Date()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Desactivar un proyecto
export const desactivarProyecto = async (id: string) => {
  const { data, error } = await supabase
    .from('proyectos')
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

// Activar un proyecto
export const activarProyecto = async (id: string) => {
  const { data, error } = await supabase
    .from('proyectos')
    .update({
      activo: true,
      fecha_actualizacion: new Date()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Verificar si un proyecto tiene actividades asociadas
export const tieneActividadesAsociadas = async (id: string) => {
  const { count, error } = await supabase
    .from('actividades')
    .select('id', { count: 'exact', head: true })
    .eq('id_proyecto', id)

  if (error) throw error
  return count && count > 0
}

// Obtener proyectos con estadísticas de uso
export const obtenerProyectosConEstadisticas = async (fechaInicio?: Date, fechaFin?: Date) => {
  let query = `
    id,
    nombre,
    descripcion,
    activo,
    fecha_creacion,
    fecha_actualizacion,
    actividades:actividades(count)
  `

  if (fechaInicio && fechaFin) {
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0]
    const fechaFinStr = fechaFin.toISOString().split('T')[0]
    
    query = `
      id,
      nombre,
      descripcion,
      activo,
      fecha_creacion,
      fecha_actualizacion,
      actividades:actividades!inner(count).gte(fecha,${fechaInicioStr}).lte(fecha,${fechaFinStr})
    `
  }

  const { data, error } = await supabase
    .from('proyectos')
    .select(query)
    .order('nombre', { ascending: true })

  if (error) throw error
  return data
}

// Obtener proyectos asignados a un usuario
export const obtenerProyectosDeUsuario = async (usuarioId: string) => {
  // Primero obtenemos los IDs de los proyectos asignados al usuario
  const { data: asignaciones, error: errorAsignaciones } = await supabase
    .from('asignaciones_tareas')
    .select('id_proyecto')
    .eq('id_funcionario', usuarioId)

  if (errorAsignaciones) throw errorAsignaciones
  
  // Si no hay asignaciones, devolvemos un array vacío
  if (!asignaciones || asignaciones.length === 0) {
    return []
  }
  
  // Extraemos los IDs de proyectos
  const proyectoIds = asignaciones.map(a => a.id_proyecto).filter(Boolean)
  
  // Si no hay IDs de proyectos (todas las asignaciones tienen id_proyecto null), devolvemos un array vacío
  if (proyectoIds.length === 0) {
    return []
  }
  
  // Ahora obtenemos los detalles de los proyectos
  const { data: proyectos, error: errorProyectos } = await supabase
    .from('proyectos')
    .select('*')
    .in('id', proyectoIds)
  
  if (errorProyectos) throw errorProyectos
  
  return proyectos || []
}

// Verificar si un proyecto ya está asignado a un usuario
export const verificarAsignacionProyecto = async (usuarioId: string, proyectoId: string) => {
  const { data, error } = await supabase
    .from('asignaciones_tareas')
    .select('*')
    .eq('id_funcionario', usuarioId)
    .eq('id_proyecto', proyectoId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 es el código de error cuando no se encuentra un registro
    throw error
  }
  
  return !!data
}

// Asignar un proyecto a un usuario
export const asignarProyectoAUsuario = async (usuarioId: string, proyectoId: string, supervisorId: string) => {
  // Verificar que el proyecto esté activo
  const { data: proyecto, error: proyectoError } = await supabase
    .from('proyectos')
    .select('activo')
    .eq('id', proyectoId)
    .single()

  if (proyectoError) throw proyectoError
  
  if (!proyecto.activo) {
    throw new Error('No se puede asignar un proyecto inactivo')
  }
  
  // Realizar la asignación
  const { data, error } = await supabase
    .from('asignaciones_tareas')
    .insert([{
      id_funcionario: usuarioId,
      id_proyecto: proyectoId,
      id_supervisor: supervisorId,
      descripcion: 'Asignación de proyecto',
      fecha_asignacion: new Date(),
      estado: 'pendiente'
    }])
    .select()

  if (error) throw error
  return data
}

// Desasignar un proyecto de un usuario
export const desasignarProyectoDeUsuario = async (usuarioId: string, proyectoId: string) => {
  const { data, error } = await supabase
    .from('asignaciones_tareas')
    .delete()
    .eq('id_funcionario', usuarioId)
    .eq('id_proyecto', proyectoId)
    .select()

  if (error) throw error
  return data
}

// Obtener asignaciones de un proyecto
export const obtenerAsignacionesProyecto = async (proyectoId: string): Promise<IAsignacionProyecto[]> => {
  try {
    // Modifico para usar asignaciones_tareas que es la tabla que existe según el esquema
    const { data, error } = await supabase
      .from('asignaciones_tareas')
      .select('id, id_proyecto, id_funcionario, fecha_asignacion')
      .eq('id_proyecto', proyectoId);

    if (error) throw error;
    
    // Transformar los datos al formato esperado
    return (data || []).map(item => ({
      id: item.id,
      proyecto_id: item.id_proyecto,
      usuario_id: item.id_funcionario,
      fecha_asignacion: item.fecha_asignacion
    }));
  } catch (error) {
    console.error('Error al obtener asignaciones del proyecto:', error);
    return [];
  }
};

// Obtener usuarios asignados a un proyecto
export const obtenerUsuariosDeProyecto = async (proyectoId: string) => {
  try {
    console.log(`Buscando usuarios asignados al proyecto: ${proyectoId}`);
    
    // Primero obtenemos las asignaciones
    const { data: asignaciones, error: errorAsignaciones } = await supabase
      .from('asignaciones_tareas')
      .select('id_funcionario')
      .eq('id_proyecto', proyectoId);
    
    if (errorAsignaciones) {
      console.error('Error al obtener las asignaciones:', errorAsignaciones);
      throw errorAsignaciones;
    }
    
    // Si no hay asignaciones, devolvemos un array vacío
    if (!asignaciones || asignaciones.length === 0) {
      console.log(`No se encontraron asignaciones para el proyecto ${proyectoId}`);
      return [];
    }
    
    // Extraemos los IDs de usuarios
    const usuarioIds = asignaciones.map(a => a.id_funcionario).filter(Boolean);
    
    // Si no hay IDs de usuarios, devolvemos un array vacío
    if (usuarioIds.length === 0) {
      console.log(`No se encontraron usuarios asignados al proyecto ${proyectoId}`);
      return [];
    }
    
    console.log(`IDs de usuarios encontrados: ${usuarioIds.join(', ')}`);
    
    // Ahora obtenemos los detalles de los usuarios
    const { data: usuarios, error: errorUsuarios } = await supabase
      .from('usuarios')
      .select('*')
      .in('id', usuarioIds);
    
    if (errorUsuarios) {
      console.error('Error al obtener los usuarios:', errorUsuarios);
      throw errorUsuarios;
    }
    
    console.log(`Se encontraron ${usuarios?.length || 0} usuarios asignados al proyecto ${proyectoId}`);
    return usuarios || [];
  } catch (error) {
    console.error('Error al obtener usuarios de proyecto:', error);
    throw error;
  }
};