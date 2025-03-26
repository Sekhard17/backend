export interface EmpleadoRex {
    rut: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno?: string;
    email?: string;
    fecha_nacimiento?: Date;
    situacion?: string;
    supervisa: boolean;
    empresa_id?: string;
    direccion?: string;
    ciudad?: string;
    telefono?: string;
}

export interface ContratoRex {
    rut_empleado: string;
    numero_contrato: string;
    rut_supervisor?: string;
    cargo_codigo?: string;
    centro_costo_codigo?: string;
    fecha_inicio: Date;
    fecha_termino?: Date;
    estado: string;
    tipo_contrato?: string;
    sueldo_base?: number;
    empresa_id?: string;
    sede?: string;
    activo: boolean;
}

export interface CargoRex {
    id: string;
    codigo: string;
    nombre: string;
    fecha_creacion: Date;
    fecha_modificacion: Date;
    activo: boolean;
}

export interface SupervisorConEmpleados {
    supervisor: EmpleadoRex;
    empleados: EmpleadoRex[];
    contratos: ContratoRex[];
}

export interface SincronizacionRex {
    id: string;
    fecha_sincronizacion: Date;
    tipo: 'empleados' | 'contratos' | 'cargos' | 'centros_costo';
    registros_procesados: number;
    registros_actualizados: number;
    estado: 'en_proceso' | 'completado' | 'error';
    mensaje_error?: string;
    duracion_segundos?: number;
} 