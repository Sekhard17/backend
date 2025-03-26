import * as comentarioModel from '../models/comentario.model';
import * as actividadModel from '../models/actividad.model';
import { IComentarioCrear } from '../models/comentario.model';

// Obtener comentarios de una actividad
export const obtenerComentarios = async (idActividad: string, idUsuario: string, esSupervisor: boolean) => {
  // Verificar que el usuario tenga acceso a la actividad
  const actividad = await actividadModel.obtenerActividadPorId(idActividad);
  
  if (!actividad) {
    throw new Error('Actividad no encontrada');
  }

  // Verificar permisos
  if (actividad.id_usuario !== idUsuario && !esSupervisor) {
    throw new Error('No tiene permisos para ver los comentarios de esta actividad');
  }

  return await comentarioModel.obtenerComentariosActividad(idActividad);
};

// Crear un nuevo comentario
export const crearComentario = async (
  comentario: IComentarioCrear,
  idUsuario: string,
  esSupervisor: boolean
) => {
  // Verificar que el usuario tenga acceso a la actividad
  const actividad = await actividadModel.obtenerActividadPorId(comentario.id_actividad);
  
  if (!actividad) {
    throw new Error('Actividad no encontrada');
  }

  // Verificar permisos
  if (actividad.id_usuario !== idUsuario && !esSupervisor) {
    throw new Error('No tiene permisos para comentar en esta actividad');
  }

  // Si es una respuesta, verificar que el comentario padre exista
  if (comentario.padre_id) {
    const comentarioPadre = await comentarioModel.puedeModificarComentario(
      comentario.padre_id,
      idUsuario
    );
    if (!comentarioPadre) {
      throw new Error('Comentario padre no encontrado');
    }
  }

  return await comentarioModel.crearComentario({
    ...comentario,
    id_usuario: idUsuario
  });
};

// Actualizar un comentario
export const actualizarComentario = async (
  id: string,
  contenido: string,
  idUsuario: string
) => {
  // Verificar que el usuario sea el autor del comentario
  const puedeModificar = await comentarioModel.puedeModificarComentario(id, idUsuario);
  
  if (!puedeModificar) {
    throw new Error('No tiene permisos para editar este comentario');
  }

  return await comentarioModel.actualizarComentario(id, contenido);
};

// Eliminar un comentario
export const eliminarComentario = async (id: string, idUsuario: string) => {
  // Verificar que el usuario sea el autor del comentario
  const puedeModificar = await comentarioModel.puedeModificarComentario(id, idUsuario);
  
  if (!puedeModificar) {
    throw new Error('No tiene permisos para eliminar este comentario');
  }

  return await comentarioModel.eliminarComentario(id);
}; 