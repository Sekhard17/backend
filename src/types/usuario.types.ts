//backend/src/types/usuario.types.ts
//Este archivo define los tipos de datos para los usuarios

export interface Usuario {
    id: string
    rut: string
    nombres: string
    appaterno: string
    apmaterno: string
    email: string
    rol: 'funcionario' | 'supervisor'
    id_supervisor?: string
    nombre_usuario: string
    fecha_creacion: Date
    fecha_actualizacion: Date 
}

export interface UsuarioLogin {
    nombre_usuario: string
    password: string
}

export interface UsuarioRegistro {
    rut: string
    nombres: string
    appaterno: string
    apmaterno?: string
    email: string
    password: string
    rol: 'funcionario' | 'supervisor'
    id_supervisor?: string
    nombre_usuario: string
}

export interface UsuarioActualizar {
    nombres?: string
    appaterno?: string
    apmaterno?: string
    email?: string
    password?: string
    rol?: 'funcionario' | 'supervisor'
    id_supervisor?: string
    nombre_usuario?: string
}