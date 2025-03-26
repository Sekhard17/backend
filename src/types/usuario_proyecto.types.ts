// src/types/usuario_proyecto.types.ts
// Este archivo define los tipos de datos para las asignaciones de proyectos a usuarios

export interface UsuarioProyecto {
    id: string;
    id_usuario: string;
    id_proyecto: string;
    fecha_asignacion: Date;
    fecha_creacion: Date;
    fecha_actualizacion: Date;
}

export interface UsuarioProyectoCrear {
    id_usuario: string;
    id_proyecto: string;
}
