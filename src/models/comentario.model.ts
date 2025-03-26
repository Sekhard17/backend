import supabase from '../config/supabase';

export interface IComentario {
  id: string;
  id_actividad: string;
  id_usuario: string;
  contenido: string;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
  padre_id?: string;
  estado: 'activo' | 'eliminado';
  usuario?: {
    nombres: string;
    appaterno: string;
    apmaterno: string | null;
    rol: string;
  };
}

export interface IComentarioCrear {
  id_actividad: string;
  id_usuario: string;
  contenido: string;
  padre_id?: string;
}

// Obtener comentarios de una actividad
export const obtenerComentariosActividad = async (idActividad: string) => {
  const { data, error } = await supabase
    .from('comentarios')
    .select(`
      *,
      usuario:id_usuario (
        nombres,
        appaterno,
        apmaterno,
        rol
      )
    `)
    .eq('id_actividad', idActividad)
    .eq('estado', 'activo')
    .order('fecha_creacion', { ascending: true });

  if (error) throw error;
  return data;
};

// Crear un nuevo comentario
export const crearComentario = async (comentario: IComentarioCrear) => {
  const { data, error } = await supabase
    .from('comentarios')
    .insert([comentario])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Actualizar un comentario
export const actualizarComentario = async (id: string, contenido: string) => {
  const { data, error } = await supabase
    .from('comentarios')
    .update({
      contenido,
      fecha_actualizacion: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Eliminar un comentario (soft delete)
export const eliminarComentario = async (id: string) => {
  const { data, error } = await supabase
    .from('comentarios')
    .update({ estado: 'eliminado' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Verificar si un usuario puede modificar un comentario
export const puedeModificarComentario = async (idComentario: string, idUsuario: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('comentarios')
    .select('id_usuario')
    .eq('id', idComentario)
    .single();

  if (error) throw error;
  return data.id_usuario === idUsuario;
}; 