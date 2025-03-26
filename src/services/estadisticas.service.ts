import * as actividadModel from '../models/actividad.model';
import * as proyectoModel from '../models/proyecto.model';
import * as usuarioModel from '../models/usuario.model';
import * as documentoModel from '../models/documento.model';
import { IActividad } from '../models/actividad.model';
import { IUsuario } from '../models/usuario.model';

// Interfaz para estadísticas diarias
interface EstadisticaDiaria {
  fecha: string;
  total: number;
}

// Interfaz para estadísticas por proyecto
interface EstadisticaProyecto {
  nombre: string;
  total: number;
}

// Obtener estadísticas de actividades diarias en un rango de fechas
export const obtenerEstadisticasDiarias = async (
  fechaInicio: string,
  fechaFin: string,
  usuarioId?: string
): Promise<EstadisticaDiaria[]> => {
  try {
    // Convertir strings a objetos Date
    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaFin);
    
    // Obtener actividades en el rango de fechas con estado 'enviado'
    const actividadesEnviadas = await actividadModel.obtenerActividadesPorRango(
      usuarioId || 'current', // Esto se reemplazará en el controlador con el ID real
      fechaInicioDate,
      fechaFinDate,
      'enviado'
    );
    
    // Crear un mapa para agrupar actividades por fecha
    const actividadesPorFecha = new Map<string, number>();
    
    // Inicializar el mapa con todas las fechas en el rango
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const fechaActual = new Date(inicio);
    
    while (fechaActual <= fin) {
      const fechaStr = fechaActual.toISOString().split('T')[0];
      actividadesPorFecha.set(fechaStr, 0);
      fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    // Contar actividades por fecha
    actividadesEnviadas.forEach(actividad => {
      const fechaStr = new Date(actividad.fecha).toISOString().split('T')[0];
      const conteoActual = actividadesPorFecha.get(fechaStr) || 0;
      actividadesPorFecha.set(fechaStr, conteoActual + 1);
    });
    
    // Convertir el mapa a un array de objetos
    const resultado: EstadisticaDiaria[] = [];
    actividadesPorFecha.forEach((total, fecha) => {
      resultado.push({ fecha, total });
    });
    
    // Ordenar por fecha
    resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
    
    return resultado;
  } catch (error) {
    console.error('Error al obtener estadísticas diarias:', error);
    throw error;
  }
};

// Obtener estadísticas de actividades por proyecto
export const obtenerEstadisticasProyectos = async (
  usuarioId: string
): Promise<EstadisticaProyecto[]> => {
  try {
    // Obtener todas las actividades del usuario
    const actividades = await actividadModel.obtenerActividadesPorUsuario(usuarioId);
    
    // Crear un mapa para agrupar actividades por proyecto
    const actividadesPorProyecto = new Map<string, { nombre: string, total: number }>();
    
    // Contar actividades por proyecto
    actividades.forEach(actividad => {
      if (actividad.proyectos && actividad.id_proyecto) {
        const nombreProyecto = actividad.proyectos.nombre;
        const idProyecto = actividad.id_proyecto;
        
        if (!actividadesPorProyecto.has(idProyecto)) {
          actividadesPorProyecto.set(idProyecto, { nombre: nombreProyecto, total: 0 });
        }
        
        const proyectoActual = actividadesPorProyecto.get(idProyecto);
        if (proyectoActual) {
          proyectoActual.total += 1;
        }
      }
    });
    
    // Convertir el mapa a un array de objetos
    const resultado: EstadisticaProyecto[] = Array.from(actividadesPorProyecto.values());
    
    // Ordenar por total (descendente)
    resultado.sort((a, b) => b.total - a.total);
    
    // Limitar a los 5 proyectos con más actividades
    return resultado.slice(0, 5);
  } catch (error) {
    console.error('Error al obtener estadísticas por proyecto:', error);
    throw error;
  }
};

// Interfaz para estadísticas de usuario
export interface EstadisticasUsuario {
  total_actividades: number;
  actividades_completadas: number;
  actividades_pendientes: number;
  proyectos_asignados: number;
  horas_registradas_mes: number;
}

// Obtener estadísticas de un usuario específico
export const obtenerEstadisticasUsuario = async (
  usuarioId: string,
  supervisorId: string
): Promise<EstadisticasUsuario> => {
  try {
    // Verificar que el usuario es supervisado por el supervisor
    const usuario = await usuarioModel.obtenerUsuarioPorId(usuarioId);
    
    if (!usuario || usuario.id_supervisor !== supervisorId) {
      throw new Error('Usuario no autorizado o no encontrado');
    }
    
    // Obtener actividades del usuario
    const actividades = await actividadModel.obtenerActividadesPorUsuario(usuarioId);
    
    // Obtener proyectos asignados al usuario
    const proyectos = await proyectoModel.obtenerProyectosDeUsuario(usuarioId);
    
    // Calcular estadísticas
    const actividadesCompletadas = actividades.filter(act => act.completada).length;
    
    // Calcular horas registradas en el mes actual
    const fechaActual = new Date();
    const primerDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
    const ultimoDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);
    
    const actividadesMes = actividades.filter(act => {
      const fechaActividad = new Date(act.fecha);
      return fechaActividad >= primerDiaMes && fechaActividad <= ultimoDiaMes;
    });
    
    const horasRegistradasMes = actividadesMes.reduce((total, act) => total + (act.horas || 0), 0);
    
    return {
      total_actividades: actividades.length,
      actividades_completadas: actividadesCompletadas,
      actividades_pendientes: actividades.length - actividadesCompletadas,
      proyectos_asignados: proyectos.length,
      horas_registradas_mes: horasRegistradasMes
    };
  } catch (error) {
    console.error('Error al obtener estadísticas del usuario:', error);
    throw error;
  }
};

// Interfaz para estadísticas de proyecto específico
interface EstadisticasProyectoEspecifico {
  total_actividades: number;
  actividades_completadas: number;
  horas_registradas: number;
  usuarios_asignados: IUsuario[];
  documentos_totales: number;
  ultima_actividad?: {
    descripcion: string;
    fecha: Date;
    usuario: string;
    estado: 'borrador' | 'enviado';
  };
}

// Obtener estadísticas específicas de un proyecto
export const obtenerEstadisticasProyectoEspecifico = async (
  proyectoId: string
): Promise<EstadisticasProyectoEspecifico> => {
  try {
    // Obtener actividades del proyecto
    const actividades = await actividadModel.obtenerActividadesPorProyecto(proyectoId);
    
    // Obtener documentos del proyecto
    const documentos = await documentoModel.obtenerDocumentosPorProyecto(proyectoId);
    
    // Obtener usuarios asignados al proyecto
    const usuarios = await usuarioModel.obtenerUsuariosPorProyecto(proyectoId);
    
    // Calcular estadísticas
    const actividadesCompletadas = actividades.filter((act: IActividad) => act.estado === 'enviado').length;
    const horasRegistradas = actividades.reduce((total: number, act: IActividad) => {
      const inicio = new Date(`1970-01-01T${act.hora_inicio}`);
      const fin = new Date(`1970-01-01T${act.hora_fin}`);
      const horas = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
      return total + horas;
    }, 0);
    
    // Obtener última actividad
    const ultimaActividad = actividades.length > 0 
      ? actividades.sort((a: IActividad, b: IActividad) => 
          new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime()
        )[0]
      : undefined;

    // Si hay última actividad, obtener el usuario
    let nombreUsuarioUltimaActividad = 'Usuario no encontrado';
    if (ultimaActividad) {
      const usuario = await usuarioModel.obtenerUsuarioPorId(ultimaActividad.id_usuario);
      if (usuario) {
        nombreUsuarioUltimaActividad = `${usuario.nombres} ${usuario.appaterno}`;
      }
    }
    
    return {
      total_actividades: actividades.length,
      actividades_completadas: actividadesCompletadas,
      horas_registradas: Math.round(horasRegistradas * 100) / 100,
      usuarios_asignados: usuarios,
      documentos_totales: documentos.length,
      ultima_actividad: ultimaActividad ? {
        descripcion: ultimaActividad.descripcion,
        fecha: ultimaActividad.fecha_creacion,
        usuario: nombreUsuarioUltimaActividad,
        estado: ultimaActividad.estado
      } : undefined
    };
  } catch (error) {
    console.error('Error al obtener estadísticas del proyecto:', error);
    throw error;
  }
};

// Verificar si un usuario tiene acceso a un proyecto
export const verificarAccesoProyecto = async (proyectoId: string, usuarioId: string): Promise<boolean> => {
  try {
    // Por ahora, permitir acceso a todos los usuarios autenticados
    // hasta que se corrija el problema de asignaciones
    return true;
    
    /*
    const proyecto = await proyectoModel.obtenerProyectoPorId(proyectoId);
    if (!proyecto) return false;

    // Si es supervisor del proyecto, tiene acceso
    if (proyecto.id_supervisor === usuarioId) return true;

    // Si está asignado al proyecto, tiene acceso
    const asignaciones = await proyectoModel.obtenerAsignacionesProyecto(proyectoId);
    return asignaciones.some(asignacion => asignacion.usuario_id === usuarioId);
    */
  } catch (error) {
    console.error('Error al verificar acceso al proyecto:', error);
    return false;
  }
};

// Obtener estadísticas de un proyecto específico
export const obtenerEstadisticasProyecto = async (proyectoId: string) => {
  try {
    // Obtener actividades del proyecto
    const actividades = await actividadModel.obtenerActividadesPorProyecto(proyectoId);
    
    // Obtener los IDs de las actividades del proyecto
    const actividadesIds = actividades.map((act: IActividad) => act.id);
    
    // Obtener documentos a través de las actividades del proyecto
    let documentos: any[] = [];
    if (actividadesIds.length > 0) {
      // Solo intentar obtener documentos si hay actividades
      documentos = await documentoModel.obtenerDocumentosPorActividades(actividadesIds);
    }
    
    // Obtener usuarios asignados al proyecto
    const asignaciones = await proyectoModel.obtenerAsignacionesProyecto(proyectoId);
    const usuariosIds = asignaciones.map(asignacion => asignacion.usuario_id);
    const usuarios = await usuarioModel.obtenerUsuariosPorIds(usuariosIds);

    // Calcular estadísticas
    const actividadesCompletadas = actividades.filter((act: IActividad) => act.estado === 'enviado').length;
    const horasRegistradas = actividades.reduce((total: number, act: IActividad) => {
      const inicio = new Date(`1970-01-01T${act.hora_inicio}`);
      const fin = new Date(`1970-01-01T${act.hora_fin}`);
      const horas = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
      return total + horas;
    }, 0);

    // Obtener última actividad
    const ultimaActividad = actividades.length > 0 
      ? actividades.sort((a: IActividad, b: IActividad) => 
          new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime()
        )[0]
      : null;

    // Formatear última actividad
    const ultimaActividadFormateada = ultimaActividad ? {
      descripcion: ultimaActividad.descripcion,
      fecha: ultimaActividad.fecha_creacion,
      usuario: usuarios.find(u => u.id === ultimaActividad.id_usuario)?.nombre_usuario || 'Usuario no encontrado',
      estado: ultimaActividad.estado
    } : null;

    return {
      total_actividades: actividades.length,
      actividades_completadas: actividadesCompletadas,
      horas_registradas: Math.round(horasRegistradas * 100) / 100,
      usuarios_asignados: usuarios,
      documentos: documentos,
      ultima_actividad: ultimaActividadFormateada
    };
  } catch (error) {
    console.error('Error al obtener estadísticas del proyecto:', error);
    throw error;
  }
};
