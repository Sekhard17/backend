//backend/src/types/proyecto.types.ts
//Este archivo define los tipos de datos para los proyectos

export interface Proyecto {
    id: string
    nombre: string
    descripcion?: string
    id_supervisor: string
    id_externo_rex?: string
    activo: boolean
    estado: 'planificado' | 'en_progreso' | 'completado' | 'cancelado'
    fecha_inicio?: Date
    fecha_fin?: Date
    responsable_id?: string
    presupuesto?: number
    fecha_creacion: Date
    fecha_actualizacion: Date
  }
  
  export interface ProyectoCrear {
    nombre: string
    descripcion?: string
    id_supervisor: string
    id_externo_rex?: string
    estado?: 'planificado' | 'en_progreso' | 'completado' | 'cancelado'
    fecha_inicio?: Date
    fecha_fin?: Date
    responsable_id?: string
    presupuesto?: number
  }
  
  export interface ProyectoActualizar {
    nombre?: string
    descripcion?: string
    id_supervisor?: string
    id_externo_rex?: string
    activo?: boolean
    estado?: 'planificado' | 'en_progreso' | 'completado' | 'cancelado'
    fecha_inicio?: Date
    fecha_fin?: Date
    responsable_id?: string
    presupuesto?: number
  }