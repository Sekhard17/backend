// src/models/actividad.model.ts
// Este modelo maneja la interacción con la tabla de actividades en la base de datos

import supabase from '../config/supabase'
import { Actividad as ActividadType, ActividadCrear, ActividadActualizar } from '../types/actividades.types'

// Obtener una actividad por ID
export const obtenerActividadPorId = async (id: string) => {
  const { data, error } = await supabase
    .from('actividades')
    .select('*, proyectos(nombre), usuarios(id, nombres, appaterno, apmaterno, nombre_usuario)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Obtener actividades de un usuario
export const obtenerActividadesPorUsuario = async (usuarioId: string, fecha?: Date, estado?: string) => {
  let query = supabase
    .from('actividades')
    .select('*, proyectos(nombre), usuarios(id, nombres, appaterno, apmaterno, nombre_usuario)')
    .eq('id_usuario', usuarioId)
    .order('fecha', { ascending: false })
    .order('hora_inicio', { ascending: true })

  if (fecha) {
    const fechaStr = fecha.toISOString().split('T')[0]
    query = query.eq('fecha', fechaStr)
  }

  if (estado) {
    query = query.eq('estado', estado)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

// Obtener actividades en un rango de fechas
export const obtenerActividadesPorRango = async (usuarioId: string, fechaInicio: Date, fechaFin: Date, estados: string[] = ['enviado', 'enviada']) => {
  // Ajustar por zona horaria para evitar problemas con fechas
  const fechaInicioStr = formatearFechaParaDB(fechaInicio);
  const fechaFinStr = formatearFechaParaDB(fechaFin);

  console.log('Consultando actividades con parámetros:', {
    usuarioId,
    fechaInicio: fechaInicioStr,
    fechaFin: fechaFinStr,
    estados
  });

  // Verificar que las fechas son válidas
  if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
    console.error('Fechas inválidas:', { fechaInicio, fechaFin });
    throw new Error('Fechas inválidas');
  }

  // Asegurar que todas las fechas estén en formato YYYY-MM-DD para la base de datos
  const fechaInicioDB = fechaInicioStr;
  const fechaFinDB = fechaFinStr;

  console.log('Fechas formateadas para la consulta:', {
    fechaInicioDB,
    fechaFinDB
  });

  const { data, error } = await supabase
    .from('actividades')
    .select(`
      *,
      proyectos (
        id,
        nombre,
        activo
      ),
      tipos_actividad (
        id,
        nombre
      ),
      usuarios (
        id,
        nombres,
        appaterno,
        apmaterno,
        nombre_usuario
      )
    `)
    .eq('id_usuario', usuarioId)
    .in('estado', estados)
    .gte('fecha', fechaInicioDB)
    .lte('fecha', fechaFinDB)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) {
    console.error('Error al obtener actividades:', error);
    throw error;
  }

  console.log(`Se encontraron ${data?.length || 0} actividades`);
  
  // Depuración detallada
  if (data && data.length > 0) {
    console.log('Primera actividad:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No se encontraron actividades, revisando query con datos ampliados...');
    
    // Hacer una consulta más amplia para depuración
    const { data: debugData, error: debugError } = await supabase
      .from('actividades')
      .select('id, fecha, estado, id_usuario')
      .eq('id_usuario', usuarioId)
      .order('fecha', { ascending: true });
      
    if (debugError) {
      console.error('Error en consulta de depuración:', debugError);
    } else {
      console.log(`Se encontraron ${debugData?.length || 0} actividades totales para el usuario`);
      if (debugData && debugData.length > 0) {
        console.log('Muestra de actividades disponibles:', debugData.slice(0, 5));
      }
    }
  }
  
  return data;
}

// Crear una nueva actividad
export const crearActividad = async (actividad: ActividadCrear) => {
  const { data, error } = await supabase
    .from('actividades')
    .insert([actividad])
    .select()
    .single()

  if (error) throw error
  return data
}

// Actualizar una actividad
export const actualizarActividad = async (id: string, actividad: ActividadActualizar) => {
  const { data, error } = await supabase
    .from('actividades')
    .update({
      ...actividad,
      fecha_actualizacion: new Date()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Eliminar una actividad
export const eliminarActividad = async (id: string) => {
  const { error } = await supabase
    .from('actividades')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

// Enviar actividades (cambiar estado a 'enviado')
export const enviarActividades = async (ids: string[]) => {
  const { data, error } = await supabase
    .from('actividades')
    .update({
      estado: 'enviado',
      fecha_actualizacion: new Date()
    })
    .in('id', ids)
    .select()

  if (error) throw error
  return data
}

// Verificar superposición de horarios
export const verificarSuperposicionHorarios = async (
  usuarioId: string,
  fecha: Date,
  horaInicio: string,
  horaFin: string,
  actividadId?: string
) => {
  const fechaStr = fecha.toISOString().split('T')[0]
  
  // Convertir las horas a formato de 24 horas para comparación
  const formatearHora = (hora: string): string => {
    // Si ya está en formato de 24 horas (HH:MM), devolverlo tal cual
    if (/^\d{1,2}:\d{2}$/.test(hora)) {
      return hora.padStart(5, '0'); // Asegurar formato HH:MM
    }
    
    // Si está en formato de 12 horas (HH:MM AM/PM), convertirlo
    const [timePart, modifier] = hora.split(' ');
    let [hours, minutes] = timePart.split(':');
    
    if (hours === '12') {
      hours = modifier === 'AM' ? '00' : '12';
    } else if (modifier === 'PM') {
      hours = String(parseInt(hours, 10) + 12);
    }
    
    return `${hours.padStart(2, '0')}:${minutes}`;
  };
  
  const horaInicioFormateada = formatearHora(horaInicio);
  const horaFinFormateada = formatearHora(horaFin);
  
  // Consulta para verificar superposición
  // Una actividad se superpone si:
  // 1. La hora de inicio está entre la hora de inicio y fin de otra actividad, o
  // 2. La hora de fin está entre la hora de inicio y fin de otra actividad, o
  // 3. La actividad abarca completamente a otra actividad
  let query = supabase
    .from('actividades')
    .select('id, hora_inicio, hora_fin, estado')
    .eq('id_usuario', usuarioId)
    .eq('fecha', fechaStr)
    .neq('estado', 'enviado') // Excluir actividades con estado 'enviado'
    .or(
      `and(hora_inicio.lte.${horaInicioFormateada},hora_fin.gt.${horaInicioFormateada}),` +
      `and(hora_inicio.lt.${horaFinFormateada},hora_fin.gte.${horaFinFormateada}),` +
      `and(hora_inicio.gte.${horaInicioFormateada},hora_fin.lte.${horaFinFormateada})`
    )

  if (actividadId) {
    query = query.neq('id', actividadId)
  }

  const { data, error } = await query

  if (error) throw error
  
  // Para depuración, imprimir las actividades que causan superposición
  if (data && data.length > 0) {
    console.log('Superposición detectada con las siguientes actividades:');
    data.forEach(act => {
      console.log(`ID: ${act.id}, Hora inicio: ${act.hora_inicio}, Hora fin: ${act.hora_fin}, Estado: ${act.estado || 'proceso'}`);
    });
    console.log(`Nueva actividad: Hora inicio: ${horaInicio}, Hora fin: ${horaFin}`);
  } else {
    console.log('No se detectaron superposiciones con actividades en proceso.');
  }
  
  return data && data.length > 0
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
  console.log('Buscando actividades supervisadas para el supervisor:', supervisorId);
  console.log('Filtros aplicados:', { 
    fechaInicio: fechaInicio ? formatearFechaParaDB(fechaInicio) : undefined, 
    fechaFin: fechaFin ? formatearFechaParaDB(fechaFin) : undefined, 
    usuarioId, 
    proyectoId, 
    estado 
  });
  
  // Primero verificar si el supervisor tiene usuarios asignados
  const { data: usuariosSupervisados, error: errorUsuarios } = await supabase
    .from('usuarios')
    .select('id, nombres, appaterno')
    .eq('id_supervisor', supervisorId);
    
  if (errorUsuarios) {
    console.error('Error al buscar usuarios supervisados:', errorUsuarios);
    throw errorUsuarios;
  }
  
  console.log(`El supervisor ${supervisorId} tiene ${usuariosSupervisados?.length || 0} usuarios asignados:`, usuariosSupervisados);
  
  if (!usuariosSupervisados || usuariosSupervisados.length === 0) {
    console.log('El supervisor no tiene usuarios asignados, retornando array vacío');
    return [];
  }
  
  // Obtener IDs de los usuarios supervisados
  const idsUsuariosSupervisados = usuariosSupervisados.map(u => u.id);
  console.log('IDs de usuarios supervisados:', idsUsuariosSupervisados);
  
  // Construir la consulta para obtener todas las actividades de los usuarios supervisados
  let query = supabase
    .from('actividades')
    .select(`
      *,
      proyectos(id, nombre, activo),
      tipos_actividad(id, nombre),
      usuarios(id, nombres, appaterno, apmaterno, nombre_usuario)
    `)
    .in('id_usuario', idsUsuariosSupervisados); // Filtrar por los IDs de usuarios supervisados
  
  console.log('Iniciando construcción de la consulta...');

  // Verificamos las fechas y la restricción sobre las fechas de la tabla
  if (fechaInicio && fechaFin) {
    const fechaInicioStr = formatearFechaParaDB(fechaInicio);
    const fechaFinStr = formatearFechaParaDB(fechaFin);
    
    // IMPORTANTE: Esta línea es crítica debido a la restricción de la tabla
    // La tabla tiene una restricción que solo permite fechas >= CURRENT_DATE
    // Para verificar si hay datos históricos, necesitamos hacer una consulta sin filtrar por fecha
    
    // Primero, obtener algunas actividades para verificar si hay datos históricos
    const { data: actividadesHistoricas, error: errorHistoricas } = await supabase
      .from('actividades')
      .select('id, fecha, estado')
      .in('id_usuario', idsUsuariosSupervisados)
      .eq('estado', estado || 'enviado')
      .limit(5);
      
    if (errorHistoricas) {
      console.error('Error en consulta histórica:', errorHistoricas);
    } else {
      console.log('Muestra de actividades disponibles:', actividadesHistoricas);
      if (actividadesHistoricas && actividadesHistoricas.length > 0) {
        console.log('¡Hay actividades! Verificando si hay fechas en el rango seleccionado');
        // Mostrar las fechas disponibles para depuración
        const fechasDisponibles = actividadesHistoricas.map(a => a.fecha);
        console.log('Fechas disponibles en la muestra:', fechasDisponibles);
      } else {
        console.log('No hay actividades históricas disponibles, posible problema con la restricción de fecha');
      }
    }
    
    // Agregar filtro de fecha, pero con precaución debido a la restricción
    query = query.gte('fecha', fechaInicioStr).lte('fecha', fechaFinStr);
    console.log(`Filtrando por fecha: ${fechaInicioStr} a ${fechaFinStr}`);
  } else {
    console.log('No se aplicó filtro de fechas, usando todas las fechas disponibles');
  }

  if (usuarioId) {
    query = query.eq('id_usuario', usuarioId);
    console.log(`Filtrando por usuario específico: ${usuarioId}`);
  }

  if (proyectoId) {
    query = query.eq('id_proyecto', proyectoId);
    console.log(`Filtrando por proyecto: ${proyectoId}`);
  }
  
  // Filtrar por estado
  if (estado) {
    // Si se proporciona un estado específico, filtrar por ese estado
    query = query.eq('estado', estado);
    console.log(`Filtrando por estado especificado: ${estado}`);
  } else {
    // Por defecto, mostrar solo actividades con estado "enviado"
    query = query.eq('estado', 'enviado');
    console.log('Filtrando por estado predeterminado: enviado');
  }
  
  // Ordenar los resultados
  query = query.order('fecha', { ascending: false }).order('hora_inicio', { ascending: true });

  console.log('Consulta SQL completa construida, ejecutando...');
  const { data, error } = await query;

  if (error) {
    console.error('Error al obtener actividades supervisadas:', error);
    throw error;
  }
  
  console.log(`Se encontraron ${data?.length || 0} actividades supervisadas`);
  
  // Procesar resultados para mejor visualización
  if (data && data.length > 0) {
    // Transformar los resultados para que sean más fáciles de usar
    const actividadesProcesadas = data.map(actividad => {
      // Extraer datos de las relaciones
      return {
        ...actividad,
        nombre_proyecto: actividad.proyectos?.nombre || 'Sin proyecto',
        nombre_tipo_actividad: actividad.tipos_actividad?.nombre || 'Sin tipo',
        horas: calcularHoras(actividad.hora_inicio, actividad.hora_fin)
      };
    });
    
    console.log('Primera actividad procesada:', JSON.stringify(actividadesProcesadas[0], null, 2));
    return actividadesProcesadas;
  } else {
    // Si no hay resultados, verificar por qué revisando las actividades de cada supervisado
    console.log('No hay resultados, verificando actividades por cada supervisado...');
    
    for (const usuarioId of idsUsuariosSupervisados) {
      const { data: actividadesUsuario, error: errorUsuario } = await supabase
        .from('actividades')
        .select('id, fecha, estado')
        .eq('id_usuario', usuarioId)
        .limit(3);
        
      if (errorUsuario) {
        console.error(`Error al verificar actividades del usuario ${usuarioId}:`, errorUsuario);
      } else {
        console.log(`Usuario ${usuarioId} tiene ${actividadesUsuario?.length || 0} actividades`);
      }
    }
    
    return [];
  }
}

// Función auxiliar para calcular horas
function calcularHoras(horaInicio: string, horaFin: string): number {
  try {
    if (!horaInicio || !horaFin) return 0;
    
    // Convertir a minutos desde el inicio del día
    const [inicioHoras, inicioMinutos] = horaInicio.split(':').map(Number);
    const [finHoras, finMinutos] = horaFin.split(':').map(Number);
    
    const inicioTotalMinutos = inicioHoras * 60 + inicioMinutos;
    const finTotalMinutos = finHoras * 60 + finMinutos;
    
    // Calcular diferencia en horas
    const diferenciaMinutos = finTotalMinutos - inicioTotalMinutos;
    return Math.round((diferenciaMinutos / 60) * 100) / 100; // Redondear a 2 decimales
  } catch (error) {
    console.error('Error al calcular horas:', error);
    return 0;
  }
}

// Interfaz para actividades
export interface IActividad {
  id: string;
  id_usuario: string;
  fecha: Date;
  hora_inicio: string;
  hora_fin: string;
  descripcion: string;
  id_proyecto?: string;
  estado: 'borrador' | 'enviado';
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

// Obtener actividades por proyecto
export const obtenerActividadesPorProyecto = async (proyectoId: string): Promise<IActividad[]> => {
  try {
    console.log(`Obteniendo actividades para el proyecto: ${proyectoId}`);
    
    if (!proyectoId) {
      console.error('ID de proyecto no proporcionado');
      return [];
    }
    
    const { data, error } = await supabase
      .from('actividades')
      .select(`
        *,
        usuarios (
          nombres,
          appaterno
        )
      `)
      .eq('id_proyecto', proyectoId)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error al obtener actividades por proyecto:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`No se encontraron actividades para el proyecto ${proyectoId}`);
      return [];
    }
    
    console.log(`Se encontraron ${data.length} actividades para el proyecto ${proyectoId}`);
    
    return data.map(actividad => ({
      ...actividad,
      usuario: actividad.usuarios ? `${actividad.usuarios.nombres} ${actividad.usuarios.appaterno}` : 'Usuario no encontrado'
    }));
  } catch (error) {
    console.error('Error al obtener actividades por proyecto:', error);
    throw error;
  }
};

/**
 * Formatea una fecha para DB ajustando específicamente para la zona horaria de Chile
 * Devuelve una fecha en formato YYYY-MM-DD
 */
function formatearFechaParaDB(fecha: Date): string {
  // Para Chile (zona horaria UTC-3/UTC-4), necesitamos compensar específicamente
  // Clone la fecha para no modificar la original
  const fechaClone = new Date(fecha);
  
  // Sumar 1 día para compensar la diferencia de zona horaria
  // Esto es específico para Chile donde una fecha seleccionada como '2023-05-18'
  // a menudo se convierte en '2023-05-17' por problema de zona horaria
  fechaClone.setDate(fechaClone.getDate() + 1);
  
  // Extraer año, mes y día usando los métodos locales
  const año = fechaClone.getFullYear();
  const mes = String(fechaClone.getMonth() + 1).padStart(2, '0');
  const dia = String(fechaClone.getDate()).padStart(2, '0');
  
  // Formato YYYY-MM-DD para la BD
  return `${año}-${mes}-${dia}`;
}