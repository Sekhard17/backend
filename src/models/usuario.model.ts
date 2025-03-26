// src/models/usuario.model.ts
// Este modelo maneja la interacción con la tabla de usuarios en la base de datos

import supabase from '../config/supabase'
import { Usuario, UsuarioRegistro, UsuarioActualizar } from '../types/usuario.types'
import bcrypt from 'bcrypt'

export interface IUsuario {
  id: string;
  nombre_usuario: string;
  email: string;
  rol: 'admin' | 'supervisor' | 'funcionario';
  activo: boolean;
  nombres: string;
  appaterno: string;
  apmaterno?: string;
  rut: string;
  avatar?: string;
  id_supervisor?: string | null;
}

// Función para validar RUT chileno
const validarRut = (rut: string): boolean => {
  // Eliminar puntos y guión
  const rutLimpio = rut.replace(/[.-]/g, '');
  
  // Obtener dígito verificador
  const dv = rutLimpio.slice(-1).toUpperCase();
  
  // Obtener cuerpo del RUT
  const rutNumerico = parseInt(rutLimpio.slice(0, -1), 10);
  
  if (isNaN(rutNumerico)) return false;
  
  // Calcular dígito verificador
  let suma = 0;
  let multiplicador = 2;
  
  // Convertir rutNumerico a string para iterar sobre sus dígitos
  let rutString = rutNumerico.toString();
  
  // Iterar de derecha a izquierda
  for (let i = rutString.length - 1; i >= 0; i--) {
    suma += parseInt(rutString.charAt(i), 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  
  const dvEsperado = 11 - (suma % 11);
  let dvCalculado;
  
  if (dvEsperado === 11) dvCalculado = '0';
  else if (dvEsperado === 10) dvCalculado = 'K';
  else dvCalculado = dvEsperado.toString();
  
  return dv === dvCalculado;
}

// Obtener un usuario por ID
export const obtenerUsuarioPorId = async (id: string) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Obtener un usuario por nombre de usuario
export const obtenerUsuarioPorNombreUsuario = async (nombreUsuario: string) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('nombre_usuario', nombreUsuario)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 es el código para "no se encontraron resultados"
  return data
}

// Obtener un usuario por email
export const obtenerUsuarioPorEmail = async (email: string) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// Crear un nuevo usuario
export const crearUsuario = async (usuario: UsuarioRegistro & { password: string }) => {
  try {
    // Validar RUT antes de continuar
    if (!validarRut(usuario.rut)) {
      throw new Error(`RUT inválido: ${usuario.rut}. Verifique el formato y dígito verificador.`)
    }
    
    // Verificar primero si el usuario ya existe en Auth por email
    // Intentamos obtener el usuario por email usando signInWithPassword
    let existingAuthUser = null
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: usuario.email,
        password: usuario.password
      })
      
      if (!signInError && signInData.user) {
        existingAuthUser = signInData.user
      }
    } catch (signInError) {
      // No hacemos nada, simplemente continuamos con el flujo normal
    }

    let authData: any = null

    // Si el usuario ya existe en Auth
    if (existingAuthUser) {
      authData = { user: existingAuthUser }
    } else {
      // Si no existe, crear el usuario en el sistema de autenticación de Supabase
      const { data: newAuthData, error: authError } = await supabase.auth.signUp({
        email: usuario.email,
        password: usuario.password,
        options: {
          data: {
            nombre_usuario: usuario.nombre_usuario,
            nombres: usuario.nombres,
            appaterno: usuario.appaterno,
            apmaterno: usuario.apmaterno || null,
            rol: usuario.rol
          }
        }
      })

      if (authError) {
        // Si el error es que el usuario ya existe, intentar obtenerlo
        if (authError.code === 'user_already_exists') {
          // Intentar iniciar sesión para obtener el ID
          try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: usuario.email,
              password: usuario.password
            })
            
            if (signInError) {
              throw signInError
            }
            
            authData = { user: signInData.user }
          } catch (signInError) {
            throw new Error('El usuario ya existe pero no se pudo obtener su ID')
          }
        } else {
          throw authError
        }
      } else if (!newAuthData.user) {
        throw new Error('No se pudo crear el usuario en el sistema de autenticación')
      } else {
        authData = newAuthData
      }
    }

    // Esperar un momento para asegurarse de que el usuario se ha creado completamente en auth.users
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Ahora crear el registro en la tabla usuarios con el ID generado
    // Usamos directamente la API de PostgreSQL para insertar el usuario
    // Esto evita problemas con las restricciones de clave foránea
    const usuarioData = {
      id: authData.user.id,
      rut: usuario.rut,
      nombres: usuario.nombres,
      appaterno: usuario.appaterno,
      apmaterno: usuario.apmaterno || null,
      email: usuario.email,
      rol: usuario.rol,
      id_supervisor: usuario.id_supervisor || null,
      nombre_usuario: usuario.nombre_usuario
    }

    // Verificar si el usuario ya existe en la tabla usuarios por ID o por email
    const { data: existingUserById, error: checkErrorById } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', usuarioData.id)
      .single()

    if (existingUserById) {
      return existingUserById
    }
    
    // También verificar por email para evitar duplicados
    const { data: existingUserByEmail, error: checkErrorByEmail } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', usuario.email)
      .single()

    if (existingUserByEmail) {
      // Actualizar el ID del usuario en la tabla usuarios para que coincida con el ID de Auth
      if (existingUserByEmail.id !== authData.user.id) {
        const { data: updatedUser, error: updateError } = await supabase
          .from('usuarios')
          .update({ id: authData.user.id })
          .eq('id', existingUserByEmail.id)
          .select()
          .single()
          
        if (!updateError && updatedUser) {
          return updatedUser
        }
      }
      
      return existingUserByEmail
    }

    // Intentar insertar el usuario
    
    // Intentar primero con insert normal
    const { data, error } = await supabase
      .from('usuarios')
      .insert([usuarioData])
      .select()
      .single()

    if (error) {
      
      // Intentar obtener más información sobre el error
      if (error.code === '23503') { // Violación de clave foránea
        // Intentar insertar con SQL directo (esto es un último recurso)
        try {
          // Intentar iniciar sesión con el usuario para confirmar que existe en auth.users
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: usuario.email,
            password: usuario.password
          })
          
          if (!signInError && signInData.user) {
            // Intentar insertar nuevamente después de confirmar que el usuario existe
            const { data: retryData, error: retryError } = await supabase
              .from('usuarios')
              .insert([usuarioData])
              .select()
              .single()
              
            if (!retryError && retryData) {
              return retryData
            }
          }
        } catch (innerError) {
          // Ignorar errores en la solución alternativa
        }
      }
      
      throw error
    }

    return data
  } catch (error) {
    throw error
  }
}

// Actualizar un usuario
export const actualizarUsuario = async (id: string, usuario: UsuarioActualizar) => {
  const { data, error } = await supabase
    .from('usuarios')
    .update({ ...usuario, fecha_actualizacion: new Date() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Obtener supervisados de un supervisor
export const obtenerSupervisados = async (supervisorId: string) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, rut, nombres, appaterno, apmaterno, email, rol, nombre_usuario')
    .eq('id_supervisor', supervisorId)
    .order('appaterno', { ascending: true })

  if (error) throw error
  return data
}

// Verificar si un usuario es supervisado por otro
export const esSupervisadoPor = async (usuarioId: string, supervisorId: string) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', usuarioId)
    .eq('id_supervisor', supervisorId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return !!data
}

// Obtener usuarios por IDs
export const obtenerUsuariosPorIds = async (ids: string[]): Promise<IUsuario[]> => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .in('id', ids);

  if (error) throw error;
  return data || [];
};

export const obtenerUsuariosPorProyecto = async (proyectoId: string): Promise<IUsuario[]> => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('proyecto_id', proyectoId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error al obtener usuarios por proyecto:', error);
    throw error;
  }
};