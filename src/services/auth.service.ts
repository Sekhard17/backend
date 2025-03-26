// src/services/auth.service.ts
// Este servicio maneja la lógica de autenticación

import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import config from '../config/config'
import { UsuarioLogin, UsuarioRegistro } from '../types/usuario.types'
import * as usuarioModel from '../models/usuario.model'

// Iniciar sesión
export const login = async (credenciales: UsuarioLogin) => {
  try {
    const { nombre_usuario, password } = credenciales
    console.log('Iniciando sesión para usuario:', nombre_usuario)

    // Buscar usuario por nombre de usuario
    const usuario = await usuarioModel.obtenerUsuarioPorNombreUsuario(nombre_usuario)
    if (!usuario) {
      console.log('Usuario no encontrado:', nombre_usuario)
      throw new Error('Credenciales inválidas')
    }

    // Verificar la contraseña usando bcrypt
    const passwordValida = await bcrypt.compare(password, usuario.password)
    if (!passwordValida) {
      console.log('Contraseña inválida para usuario:', nombre_usuario)
      throw new Error('Credenciales inválidas')
    }

    console.log('Inicio de sesión exitoso para:', nombre_usuario)

    // Generar token JWT
    const payload = {
      id: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      rol: usuario.rol,
      id_supervisor: usuario.id_supervisor
    }
    
    const token = jwt.sign(payload, config.jwt_secret, { expiresIn: config.jwt_expires_in })

    return {
      token,
      usuario: {
        id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        nombres: usuario.nombres,
        appaterno: usuario.appaterno,
        apmaterno: usuario.apmaterno,
        email: usuario.email,
        rol: usuario.rol
      }
    }
  } catch (error) {
    console.error('Error en login:', error)
    throw error
  }
}

// Registrar un nuevo usuario
export const registro = async (userData: UsuarioRegistro) => {
  try {
    console.log('Iniciando registro de usuario:', { ...userData, password: '***REDACTED***' })
    
    // Verificar si el nombre de usuario ya existe
    const usuarioExistente = await usuarioModel.obtenerUsuarioPorNombreUsuario(userData.nombre_usuario)
    if (usuarioExistente) {
      throw new Error('El nombre de usuario ya está en uso')
    }

    // Verificar si el email ya existe
    const emailExistente = await usuarioModel.obtenerUsuarioPorEmail(userData.email)
    if (emailExistente) {
      throw new Error('El email ya está en uso')
    }

    // Hashear la contraseña
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(userData.password, salt)

    // Crear usuario con la contraseña hasheada
    const nuevoUsuario = await usuarioModel.crearUsuario({
      ...userData,
      password: hashedPassword
    })

    return {
      usuario: {
        id: nuevoUsuario.id,
        nombre_usuario: nuevoUsuario.nombre_usuario,
        nombres: nuevoUsuario.nombres,
        appaterno: nuevoUsuario.appaterno,
        apmaterno: nuevoUsuario.apmaterno,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol
      }
    }
  } catch (error) {
    console.error('Error en registro de usuario:', error)
    throw error
  }
}

// Obtener usuario actual
export const getUsuarioActual = async (usuarioId: string) => {
  const usuario = await usuarioModel.obtenerUsuarioPorId(usuarioId)
  if (!usuario) {
    throw new Error('Usuario no encontrado')
  }

  return {
    id: usuario.id,
    nombre_usuario: usuario.nombre_usuario,
    nombres: usuario.nombres,
    appaterno: usuario.appaterno,
    apmaterno: usuario.apmaterno,
    email: usuario.email,
    rol: usuario.rol,
    id_supervisor: usuario.id_supervisor
  }
}