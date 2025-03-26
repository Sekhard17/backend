//backend/src/types/documentos.types.ts
//Este archivo define los tipos de datos para los documentos

export interface Documento {
    id: string
    id_actividad: string
    nombre_archivo: string
    ruta_archivo: string
    tipo_archivo?: string
    tamaño_bytes?: number
    fecha_creacion: Date
  }
  
  export interface DocumentoCrear {
    id_actividad: string
    nombre_archivo: string
    ruta_archivo: string
    tipo_archivo?: string
    tamaño_bytes?: number
  }