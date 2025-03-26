//backend/src/types/actividades.types.ts
//Este archivo define los tipos de datos para las actividades

export interface TipoActividad {
    id: string
    nombre: string
    descripcion?: string
    icono?: string
    color?: string
    activo: boolean
    fecha_creacion: Date
    fecha_actualizacion: Date
    creado_por: string
}

export interface Actividad {
    id: string
    id_usuario: string
    fecha: Date
    hora_inicio: string //Formato HH:MM
    hora_fin: string //Formato HH:MM
    descripcion: string
    id_proyecto?: string
    id_tipo_actividad: string
    sistema?: string
    estado: 'borrador' | 'enviado'
    fecha_creacion: Date
    fecha_actualizacion: Date
}

export interface ActividadCrear {
    id_usuario: string
    fecha: Date
    hora_inicio: string
    hora_fin: string
    descripcion: string
    id_proyecto?: string
    id_tipo_actividad: string
    sistema?: string
    estado?: 'borrador' | 'enviado'
}

export interface ActividadActualizar {
    hora_inicio?: string
    hora_fin?: string
    descripcion?: string
    id_proyecto?: string
    id_tipo_actividad?: string
    sistema?: string
    estado?: 'borrador' | 'enviado'
}

