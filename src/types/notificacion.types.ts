//backend/src/types/notificacion.types.ts
//Este archivo define los tipos de datos para las notificaciones

export interface Notificacion {
    id: string
    id_usuario: string
    mensaje: string
    leida: boolean
    tipo: 'asignacion' | 'recordatorio' | 'sistema'
    fecha_creacion: Date
  }
  
  export interface NotificacionCrear {
    id_usuario: string
    mensaje: string
    tipo: 'asignacion' | 'recordatorio' | 'sistema'
  }