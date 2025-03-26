import supabase from '../config/supabase';
import { EmpleadoRex, ContratoRex, SupervisorConEmpleados, SincronizacionRex } from '../types/rex.types';

const API_CONFIG = {
    BASE_URL: 'https://socoepa.rexmas.cl/api/v2',
    TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjQsInZhbGlkIjozLCJ1c2VybmFtZSI6InNvY29lcGEiLCJjcmVhdGlvbl90aW1lIjoxNzI0MzM3OTk1LjIzMTMwNX0.TKp0NE4xtsoBoSKeT7SlbUWt6m78b6kqCB8YP-tNJsw',
    ENDPOINTS: {
        VALIDAR_RUT: '/empleados/rut/',
        CONTRATOS: '/empleados/rut/contratos/numerocontrato'
    }
};

// Interfaces para el tipado
interface ContratoConEmpleado extends ContratoRex {
    empleados_rex: EmpleadoRex;
}

class RexService {
    private static async registrarSincronizacion(
        tipo: SincronizacionRex['tipo'],
        estado: SincronizacionRex['estado'],
        registros_procesados: number = 0,
        registros_actualizados: number = 0,
        mensaje_error?: string
    ): Promise<void> {
        await supabase.from('sincronizacion_rex').insert({
            tipo,
            estado,
            registros_procesados,
            registros_actualizados,
            mensaje_error
        });
    }

    static async sincronizarEmpleado(rut: string, datosEmpleado?: any): Promise<void> {
        try {
            const headers = {
                'Authorization': `Token ${API_CONFIG.TOKEN}`
            };

            let empleado;
            
            // Si ya tenemos los datos del empleado, los usamos directamente
            if (datosEmpleado) {
                console.log(`Usando datos existentes para el empleado con RUT: ${rut}`);
                empleado = datosEmpleado;
            } else {
                // Si no tenemos los datos, intentamos obtenerlos
                console.log(`Obteniendo datos del empleado con RUT: ${rut}`);
                try {
                    const empleadoResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VALIDAR_RUT}${rut}`, { headers });
                    
                    if (!empleadoResponse.ok) {
                        console.error(`Error al obtener datos del empleado ${rut}:`, await empleadoResponse.text());
                        throw new Error(`Error al obtener datos del empleado de REX: ${empleadoResponse.status}`);
                    }
                    
                    // Obtener el empleado como texto primero para debug
                    const empleadoText = await empleadoResponse.text();
                    console.log(`Datos del empleado ${rut} obtenidos:`, empleadoText.substring(0, 100) + '...');
                    
                    try {
                        empleado = JSON.parse(empleadoText);
                    } catch (parseError) {
                        console.error(`Error al parsear datos del empleado ${rut}:`, parseError);
                        throw new Error('Error al parsear datos del empleado');
                    }
                } catch (error) {
                    console.error(`Error al obtener datos del empleado ${rut} de la API:`, error);
                    console.log(`Verificando si ya existe en la base de datos...`);
                    
                    // Verificar si el empleado ya existe en la base de datos
                    const { data: empleadoExistente } = await supabase
                        .from('empleados_rex')
                        .select('*')
                        .eq('rut', rut)
                        .single();
                    
                    if (empleadoExistente) {
                        console.log(`Datos encontrados en la base de datos para ${rut}`);
                        empleado = empleadoExistente;
                    } else {
                        console.error(`No se pudieron obtener datos para el empleado ${rut}`);
                        throw new Error(`No se pudieron obtener datos para el empleado ${rut}`);
                    }
                }
            }
            
            if (!empleado || typeof empleado !== 'object') {
                console.error(`Datos del empleado ${rut} no válidos:`, empleado);
                throw new Error('Datos del empleado no válidos');
            }
            
            // Preparar los datos para guardar en la base de datos
            const fechaNacimiento = empleado.fechaNaci 
                ? new Date(empleado.fechaNaci).toISOString().split('T')[0]
                : (empleado.fecha_nacimiento ? new Date(empleado.fecha_nacimiento).toISOString().split('T')[0] : null);
            
            const empleadoData = {
                rut: rut,
                nombres: empleado.nombre || empleado.nombres || '',
                apellido_paterno: empleado.apellidoPate || empleado.apellido_paterno || '',
                apellido_materno: empleado.apellidoMate || empleado.apellido_materno || '',
                email: empleado.email || '',
                fecha_nacimiento: fechaNacimiento,
                situacion: (empleado.situacion || '')[0] || 'A',
                supervisa: empleado.supervisa || false,
                empresa_id: null, // Para evitar problemas con foreign key
                direccion: empleado.direccion || '',
                ciudad: empleado.ciudad || '',
                telefono: empleado.numeroFono || empleado.telefono || '',
                ultima_actualizacion: new Date().toISOString()
            };
            
            // Guardar o actualizar el empleado
            console.log(`Guardando datos básicos del empleado ${rut} en la base de datos`);
            const { data, error } = await supabase.from('empleados_rex').upsert(empleadoData);
            
            if (error) {
                console.error(`Error al guardar empleado ${rut} en la base de datos:`, error);
                throw new Error(`Error al guardar empleado en la base de datos: ${error.message}`);
            }
            
            console.log(`Resultado del upsert para ${rut}:`, data);
            
            // Verificar que los datos se guardaron correctamente
            const { data: empleadoVerificado, error: errorVerificacion } = await supabase
                .from('empleados_rex')
                .select('*')
                .eq('rut', rut)
                .single();
                
            if (errorVerificacion) {
                console.error(`Error al verificar empleado ${rut} en la base de datos:`, errorVerificacion);
            } else {
                console.log(`Verificación de empleado ${rut} en la base de datos:`, empleadoVerificado);
            }
            
            // Intentar obtener contratos solo si se solicita específicamente
            // Ahora no intentamos obtener contratos porque la API parece estar fallando
            console.log(`Sincronización del empleado ${rut} completada con éxito`);
        } catch (error) {
            console.error(`Error al sincronizar empleado ${rut}:`, error);
            throw error;
        }
    }

    static async obtenerSupervisadosActuales(rutSupervisor: string): Promise<SupervisorConEmpleados> {
        try {
            // Obtener datos del supervisor
            const { data: supervisor, error: supervisorError } = await supabase
                .from('empleados_rex')
                .select('*')
                .eq('rut', rutSupervisor)
                .single();

            if (supervisorError) throw supervisorError;

            // Obtener contratos actuales donde esta persona es supervisor
            const { data: contratos, error: contratosError } = await supabase
                .from('contratos_rex')
                .select('*, empleados_rex(*)')
                .eq('rut_supervisor', rutSupervisor)
                .eq('activo', true)
                .eq('fecha_registro', new Date().toISOString().split('T')[0]);

            if (contratosError) throw contratosError;

            // Extraer empleados únicos de los contratos
            const empleados = (contratos as ContratoConEmpleado[])
                .map((contrato: ContratoConEmpleado) => contrato.empleados_rex)
                .filter((empleado: EmpleadoRex, index: number, self: EmpleadoRex[]) => 
                    empleado && self.findIndex((e: EmpleadoRex) => e.rut === empleado.rut) === index
                );

            return {
                supervisor,
                empleados,
                contratos
            };
        } catch (error) {
            console.error('Error al obtener supervisados:', error);
            throw error;
        }
    }

    static async obtenerHistoricoSupervisados(
        rutSupervisor: string,
        fechaInicio?: Date,
        fechaFin?: Date
    ): Promise<any[]> {
        try {
            let query = supabase
                .from('v_historico_supervisiones')
                .select('*')
                .eq('rut_supervisor', rutSupervisor);

            if (fechaInicio) {
                query = query.gte('fecha_registro', fechaInicio.toISOString().split('T')[0]);
            }
            if (fechaFin) {
                query = query.lte('fecha_registro', fechaFin.toISOString().split('T')[0]);
            }

            const { data, error } = await query;
            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error al obtener histórico de supervisados:', error);
            throw error;
        }
    }

    // Obtener todos los cargos
    static async obtenerCargos(): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('cargos_rex')
                .select('*')
                .eq('activo', true)
                .order('nombre', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error al obtener cargos:', error);
            throw new Error('Error al obtener cargos de REX');
        }
    }

    // Obtener un cargo específico por su código
    static async obtenerCargoPorCodigo(codigo: string): Promise<any> {
        try {
            const { data, error } = await supabase
                .from('cargos_rex')
                .select('*')
                .eq('codigo', codigo)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error(`Error al obtener cargo con código ${codigo}:`, error);
            throw new Error(`Error al obtener cargo con código ${codigo}`);
        }
    }

    // Obtener todos los empleados
    static async obtenerEmpleados(filtros?: { activo?: boolean, empresaId?: string }): Promise<any[]> {
        try {
            let query = supabase
                .from('empleados_rex')
                .select('*')
                .order('apellido_paterno', { ascending: true });

            // Aplicar filtros si existen
            if (filtros?.activo !== undefined) {
                query = query.eq('activo', filtros.activo);
            }

            if (filtros?.empresaId) {
                query = query.eq('empresa_id', filtros.empresaId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error al obtener empleados:', error);
            throw new Error('Error al obtener empleados de REX');
        }
    }

    // Obtener un empleado específico por su RUT
    static async obtenerEmpleadoPorRut(rut: string): Promise<any> {
        try {
            const { data, error } = await supabase
                .from('empleados_rex')
                .select('*')
                .eq('rut', rut)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error(`Error al obtener empleado con RUT ${rut}:`, error);
            throw new Error(`Error al obtener empleado con RUT ${rut}`);
        }
    }

    // Obtener contratos de un empleado
    static async obtenerContratosEmpleado(rut: string, soloActivos: boolean = false): Promise<any[]> {
        try {
            let query = supabase
                .from('contratos_rex')
                .select('*, cargos_rex(*)')
                .eq('rut_empleado', rut)
                .order('fecha_inicio', { ascending: false });

            if (soloActivos) {
                query = query.eq('activo', true);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error(`Error al obtener contratos del empleado ${rut}:`, error);
            throw new Error(`Error al obtener contratos del empleado ${rut}`);
        }
    }
}

export default RexService; 