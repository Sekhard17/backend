import supabase from '../config/supabase';
import RexService from './rex.service';
import cron from 'node-cron';
import { SincronizacionRex } from '../types/rex.types';
import { API_CONFIG } from '../config/api.config';

interface EmpleadoBasico {
    empleado?: string;
    rut?: string;
    nombre?: string;
    [key: string]: any;
}

class SincronizacionService {
    private static async registrarSincronizacion(
        tipo: SincronizacionRex['tipo'],
        estado: SincronizacionRex['estado'] = 'en_proceso',
        registros_procesados: number = 0,
        registros_actualizados: number = 0,
        mensaje_error?: string
    ): Promise<string> {
        const { data, error } = await supabase
            .from('sincronizacion_rex')
            .insert({
                tipo,
                estado,
                registros_procesados,
                registros_actualizados,
                mensaje_error
            })
            .select('id')
            .single();

        if (error) throw error;
        return data.id;
    }

    private static async actualizarSincronizacion(
        id: string,
        estado: SincronizacionRex['estado'],
        registros_procesados: number,
        registros_actualizados: number,
        mensaje_error?: string,
        duracion_segundos?: number
    ): Promise<void> {
        await supabase
            .from('sincronizacion_rex')
            .update({
                estado,
                registros_procesados,
                registros_actualizados,
                mensaje_error,
                duracion_segundos
            })
            .eq('id', id);
    }

    private static async obtenerTodosLosEmpleados(): Promise<Array<any>> {
        const headers = {
            'Authorization': `Token ${API_CONFIG.TOKEN}`
        };

        try {
            console.log('Solicitando empleados a:', 'https://socoepa.rexmas.cl/api/v2/empleados?paginar=0');
            const response = await fetch('https://socoepa.rexmas.cl/api/v2/empleados?paginar=0', { headers });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error al obtener empleados de REX (${response.status}):`, errorText);
                throw new Error(`Error al obtener empleados de REX: ${response.status}`);
            }
            
            const responseText = await response.text();
            console.log('Respuesta de la API (primeros 500 caracteres):', 
                responseText.substring(0, 500) + '...',
                'Longitud total:', responseText.length);
            
            try {
                let data: any;
                try {
                    data = JSON.parse(responseText);
                } catch (parseError: unknown) {
                    console.error('Error al parsear JSON de la respuesta:', parseError);
                    throw new Error('No se pudo parsear la respuesta como JSON');
                }
                
                console.log('Tipo de datos recibidos:', typeof data);
                
                // Según la respuesta detectada, necesitamos buscar en data.objetos
                if (data.objetos && Array.isArray(data.objetos) && data.objetos.length > 0) {
                    console.log('Encontrado data.objetos, verificando contenido...');
                    
                    // La respuesta parece tener este formato: {"objetos":[{empleado1}, {empleado2}, ...]}
                    if (Array.isArray(data.objetos)) {
                        console.log('Total de objetos encontrados:', data.objetos.length);
                        
                        // Verificar si los elementos en objetos parecen ser empleados
                        const muestraEmpleados = data.objetos.filter((item: any) => 
                            item && typeof item === 'object' && 
                            (item.empleado || item.nombre || item.rut)
                        );
                        
                        if (muestraEmpleados.length > 0) {
                            console.log(`Encontrados ${muestraEmpleados.length} registros que parecen ser empleados`);
                            return muestraEmpleados;
                        }
                    }
                    
                    // Si llegamos aquí, objetos existe pero no contiene empleados directamente
                    // Podría ser un objeto en lugar de un array de empleados directamente
                    if (typeof data.objetos[0] === 'object' && data.objetos[0] !== null) {
                        console.log('data.objetos[0] es un objeto, explorando propiedades...');
                        
                        // Imprimir propiedades para diagnóstico
                        for (const key in data.objetos[0]) {
                            if (data.objetos[0].hasOwnProperty(key)) {
                                console.log(`- Propiedad "${key}" de tipo: ${typeof data.objetos[0][key]}`);
                                
                                // Si alguna propiedad es un array, podría contener los empleados
                                if (Array.isArray(data.objetos[0][key])) {
                                    const posiblesEmpleados = data.objetos[0][key];
                                    console.log(`  Es un array con ${posiblesEmpleados.length} elementos`);
                                    
                                    if (posiblesEmpleados.length > 0 && 
                                        typeof posiblesEmpleados[0] === 'object' &&
                                        (posiblesEmpleados[0].empleado || 
                                         posiblesEmpleados[0].rut || 
                                         posiblesEmpleados[0].nombre)) {
                                        console.log('  ¡Encontrados empleados en esta propiedad!');
                                        return posiblesEmpleados;
                                    } else if (posiblesEmpleados.length > 0) {
                                        console.log(`  Primer elemento: ${JSON.stringify(posiblesEmpleados[0]).substring(0, 200)}...`);
                                    }
                                }
                            }
                        }
                        
                        // Si no encontramos arrays con empleados, intentemos usar el objeto mismo
                        // Verificar si el objeto en sí mismo parece un empleado
                        if (data.objetos[0].empleado || data.objetos[0].rut || data.objetos[0].nombre) {
                            console.log('data.objetos[0] parece ser un empleado directamente');
                            return data.objetos; // Devolvemos el array completo que contiene objetos de empleados
                        }
                    }
                    
                    // Si llegamos aquí, no pudimos encontrar empleados en la estructura
                    console.error('No se encontraron empleados en la estructura de datos.objetos');
                    throw new Error('No se encontraron empleados en la estructura de datos');
                } else if (Array.isArray(data)) {
                    console.log('Total de empleados obtenidos (array directo):', data.length);
                    return data;
                } else if (data.results && Array.isArray(data.results)) {
                    console.log('Total de empleados obtenidos (data.results):', data.results.length);
                    return data.results;
                } else if (data.data && Array.isArray(data.data)) {
                    console.log('Total de empleados obtenidos (data.data):', data.data.length);
                    return data.data;
                } else if (data.empleados && Array.isArray(data.empleados)) {
                    console.log('Total de empleados obtenidos (data.empleados):', data.empleados.length);
                    return data.empleados;
                } else {
                    console.error('Estructura de datos no reconocida. Mostrando primeras propiedades:');
                    for (const key in data) {
                        if (data.hasOwnProperty(key)) {
                            console.log(`- Propiedad "${key}" de tipo: ${typeof data[key]}`);
                            if (Array.isArray(data[key])) {
                                console.log(`  Es un array con ${data[key].length} elementos`);
                                if (data[key].length > 0) {
                                    console.log(`  Primer elemento: ${JSON.stringify(data[key][0]).substring(0, 200)}...`);
                                }
                            }
                        }
                    }
                    throw new Error('No se pudo encontrar la lista de empleados en los datos recibidos');
                }
            } catch (parseError: unknown) {
                console.error('Error al procesar la respuesta:', parseError);
                const errorMessage = parseError instanceof Error ? parseError.message : 'Error desconocido';
                throw new Error('Error al procesar la respuesta de la API: ' + errorMessage);
            }
        } catch (error) {
            console.error('Error en obtenerTodosLosEmpleados:', error);
            throw error;
        }
    }

    static async sincronizacionMasiva(): Promise<void> {
        const tiempoInicio = Date.now();
        const idSincronizacion = await this.registrarSincronizacion('empleados');
        let registrosProcesados = 0;
        let registrosActualizados = 0;

        try {
            const empleados = await this.obtenerTodosLosEmpleados();
            console.log(`Procesando ${empleados.length} empleados...`);
            
            for (const empleado of empleados) {
                try {
                    if (!empleado.empleado) {
                        console.log('Empleado sin RUT, saltando:', empleado);
                        continue;
                    }
                    
                    const rut = empleado.empleado;
                    console.log(`Procesando empleado con RUT: ${rut}`);
                    
                    const { data: empleadoExistente } = await supabase
                        .from('empleados_rex')
                        .select('*')
                        .eq('rut', rut)
                        .single();

                    const hashDatosNuevos = JSON.stringify(empleado);
                    const hashDatosExistentes = empleadoExistente ? JSON.stringify(empleadoExistente) : '';

                    if (!empleadoExistente || hashDatosNuevos !== hashDatosExistentes) {
                        const empleadoData = {
                            rut: rut,
                            nombres: empleado.nombre || '',
                            apellido_paterno: empleado.apellidoPate || '',
                            apellido_materno: empleado.apellidoMate || '',
                            email: empleado.email || '',
                            fecha_nacimiento: empleado.fechaNaci ? new Date(empleado.fechaNaci).toISOString().split('T')[0] : null,
                            situacion: (empleado.situacion || '')[0] || 'A',
                            supervisa: empleado.supervisa || false,
                            empresa_id: null,
                            direccion: empleado.direccion || '',
                            ciudad: empleado.ciudad || '',
                            telefono: empleado.numeroFono || ''
                        };
                        
                        // Insertar o actualizar en la base de datos
                        const { data, error } = await supabase.from('empleados_rex').upsert(empleadoData);
                        
                        if (error) {
                            console.error(`Error al guardar empleado ${rut} en la base de datos:`, error);
                            throw new Error(`Error al guardar empleado en la base de datos: ${error.message}`);
                        }
                        
                        console.log(`Empleado ${rut} guardado en la base de datos`);
                        
                        // Pasar los datos del empleado directamente en lugar de volver a consultarlos
                        await RexService.sincronizarEmpleado(rut, empleado);
                        registrosActualizados++;
                    }

                    registrosProcesados++;

                    if (registrosProcesados % 10 === 0) {
                        console.log(`Progreso: ${registrosProcesados}/${empleados.length} (${registrosActualizados} actualizados)`);
                        await this.actualizarSincronizacion(
                            idSincronizacion,
                            'en_proceso',
                            registrosProcesados,
                            registrosActualizados
                        );
                    }
                } catch (error) {
                    console.error(`Error al procesar empleado:`, error);
                }
            }

            const duracionSegundos = Math.floor((Date.now() - tiempoInicio) / 1000);
            await this.actualizarSincronizacion(
                idSincronizacion,
                'completado',
                registrosProcesados,
                registrosActualizados,
                undefined,
                duracionSegundos
            );
            
            console.log(`Sincronización completada. Procesados: ${registrosProcesados}, Actualizados: ${registrosActualizados}, Duración: ${duracionSegundos}s`);

        } catch (error: any) {
            const duracionSegundos = Math.floor((Date.now() - tiempoInicio) / 1000);
            console.error('Error en sincronización masiva:', error);
            await this.actualizarSincronizacion(
                idSincronizacion,
                'error',
                registrosProcesados,
                registrosActualizados,
                error.message,
                duracionSegundos
            );
            throw error;
        }
    }

    static iniciarSincronizacionProgramada(): void {
        cron.schedule('0 12 * * *', async () => {
            console.log('Iniciando sincronización programada:', new Date().toISOString());
            try {
                await this.sincronizacionMasiva();
                console.log('Sincronización completada exitosamente');
            } catch (error) {
                console.error('Error en sincronización programada:', error);
            }
        });
    }

    static async sincronizacionMasivaNueva(): Promise<void> {
        const tiempoInicio = Date.now();
        const idSincronizacion = await this.registrarSincronizacion('empleados', 'en_proceso');
        let registrosProcesados = 0;
        let registrosActualizados = 0;
        const errores: string[] = [];

        try {
            // 1. Obtener la lista de empleados
            console.log('Obteniendo todos los empleados...');
            const empleados = await this.obtenerTodosLosEmpleados();
            console.log(`Se encontraron ${empleados.length} empleados para procesar`);
            
            // 3. Procesar cada empleado individualmente
            for (const empleado of empleados) {
                try {
                    const rut = empleado.empleado;
                    if (!rut) {
                        console.log('Empleado sin RUT, saltando');
                        continue;
                    }

                    console.log(`Procesando empleado con RUT: ${rut}`);
                    
                    // 4. Convertir el formato de la API al formato de la base de datos
                    const fechaNacimiento = empleado.fechaNaci 
                        ? new Date(empleado.fechaNaci).toISOString().split('T')[0] 
                        : null;
                    
                    // Intento 1: Prueba con diferentes restricciones para el campo situacion
                    try {
                        // Versión 1: Con un solo carácter y solo letras/números
                        const situacion = ((empleado.situacion || '')[0] || 'A').replace(/[^a-zA-Z0-9]/g, 'A');
                        
                        const empleadoData = {
                            rut: rut,
                            nombres: empleado.nombre || '',
                            apellido_paterno: empleado.apellidoPate || '',
                            apellido_materno: empleado.apellidoMate || '',
                            email: empleado.email || empleado.emailPersonal || '',
                            fecha_nacimiento: fechaNacimiento,
                            situacion: situacion,
                            supervisa: empleado.supervisa || false,
                            empresa_id: null,
                            direccion: empleado.direccion || '',
                            ciudad: empleado.ciudad || '',
                            telefono: empleado.numeroFono || '',
                            ultima_actualizacion: new Date().toISOString()
                        };
                        
                        // Imprimir datos para debug
                        console.log(`Intentando insertar empleado ${rut} con situacion='${situacion}'`);
                        
                        // Insertar empleado
                        const { data, error } = await supabase.from('empleados_rex').upsert(empleadoData);
                        
                        if (error) {
                            throw error;
                        } else {
                            console.log(`Empleado ${rut} insertado correctamente`);
                            registrosActualizados++;
                        }
                    } catch (error1) {
                        console.error(`Error en el primer intento para ${rut}:`, error1);
                        
                        // Intento 2: Si el primer intento falla, probar con distintos tipos de campos
                        try {
                            const empleadoData = {
                                rut: rut,
                                nombres: empleado.nombre?.substring(0, 100) || '',
                                apellido_paterno: empleado.apellidoPate?.substring(0, 100) || '',
                                apellido_materno: empleado.apellidoMate?.substring(0, 100) || '',
                                email: (empleado.email || empleado.emailPersonal || '')?.substring(0, 100),
                                fecha_nacimiento: fechaNacimiento,
                                situacion: 'A', // Usar solo A como valor seguro
                                supervisa: empleado.supervisa || false,
                                empresa_id: null,
                                direccion: empleado.direccion?.substring(0, 100) || '',
                                ciudad: empleado.ciudad?.substring(0, 100) || '',
                                telefono: empleado.numeroFono?.substring(0, 20) || '',
                                ultima_actualizacion: new Date().toISOString()
                            };
                            
                            console.log(`Segundo intento para ${rut} con situacion='A'`);
                            
                            const { data, error } = await supabase.from('empleados_rex').upsert(empleadoData);
                            
                            if (error) {
                                throw error;
                            } else {
                                console.log(`Empleado ${rut} insertado correctamente en el segundo intento`);
                                registrosActualizados++;
                            }
                        } catch (error2) {
                            console.error(`Error en el segundo intento para ${rut}:`, error2);
                            console.error('Detalles del error:', JSON.stringify(error2));
                            errores.push(`Error con empleado ${rut}: ${error2 instanceof Error ? error2.message : String(error2)}`);
                        }
                    }
                    
                    registrosProcesados++;
                    
                    // Actualizar progreso cada 10 registros
                    if (registrosProcesados % 10 === 0) {
                        console.log(`Progreso: ${registrosProcesados}/${empleados.length} empleados procesados`);
                        // Actualizar registro de sincronización
                        await this.actualizarSincronizacion(
                            idSincronizacion,
                            'en_proceso',
                            registrosProcesados,
                            registrosActualizados
                        );
                    }
                    
                    // Añadir una pequeña pausa para evitar sobrecargar la base de datos
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                } catch (error) {
                    console.error(`Error al procesar empleado:`, error);
                    errores.push(`Error en empleado: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            
            // Calcular tiempo de ejecución
            const tiempoFin = Date.now();
            const duracionSegundos = Math.floor((tiempoFin - tiempoInicio) / 1000);
            
            // 5. Actualizar registro de sincronización
            await this.actualizarSincronizacion(
                idSincronizacion,
                'completado',
                registrosProcesados,
                registrosActualizados,
                errores.length > 0 ? errores.join('\n').substring(0, 1000) : undefined,
                duracionSegundos
            );
            
            console.log(`Sincronización completada. Procesados: ${registrosProcesados}, Actualizados: ${registrosActualizados}, Duración: ${duracionSegundos}s`);
            console.log(`Total de errores: ${errores.length}`);
            
            // 6. Procesar contratos de empleados activos si es necesario
            if (registrosActualizados > 0) {
                console.log('Iniciando sincronización de contratos para empleados activos...');
                await this.sincronizarContratosEmpleadosActivos();
            }
            
        } catch (error) {
            console.error('Error en sincronización masiva nueva:', error);
            
            // Actualizar registro de sincronización con error
            const tiempoFin = Date.now();
            const duracionSegundos = Math.floor((tiempoFin - tiempoInicio) / 1000);
            
            await this.actualizarSincronizacion(
                idSincronizacion,
                'error',
                registrosProcesados,
                registrosActualizados,
                error instanceof Error ? error.message : String(error),
                duracionSegundos
            );
            
            throw error;
        }
    }
    
    static async sincronizarContratosEmpleadosActivos(): Promise<void> {
        try {
            // 1. Obtener empleados activos
            const { data: empleadosActivos, error } = await supabase
                .from('empleados_rex')
                .select('rut')
                .eq('situacion', 'A');
                
            if (error) {
                throw new Error(`Error al obtener empleados activos: ${error.message}`);
            }
            
            if (!empleadosActivos || empleadosActivos.length === 0) {
                console.log('No se encontraron empleados activos para sincronizar contratos');
                return;
            }
            
            console.log(`Procesando contratos para ${empleadosActivos.length} empleados activos`);
            
            // 2. Iniciar registro de sincronización
            const idSincronizacion = await this.registrarSincronizacion('contratos', 'en_proceso');
            let procesados = 0;
            let actualizados = 0;
            const tiempoInicio = Date.now();
            
            // 3. Procesar contratos para cada empleado activo
            for (const empleado of empleadosActivos) {
                try {
                    // Obtener datos de contrato
                    const rut = empleado.rut;
                    console.log(`Obteniendo contrato para empleado activo con RUT: ${rut}`);
                    
                    // Aquí implementaremos después la llamada para obtener contratos
                    // Por ahora, solo actualizamos el contador
                    procesados++;
                    
                    // Actualizar progreso cada 10 empleados
                    if (procesados % 10 === 0) {
                        await this.actualizarSincronizacion(
                            idSincronizacion,
                            'en_proceso',
                            procesados,
                            actualizados
                        );
                    }
                } catch (error) {
                    console.error(`Error al procesar contrato para ${empleado.rut}:`, error);
                }
            }
            
            // 4. Finalizar sincronización
            const tiempoFin = Date.now();
            const duracionSegundos = Math.floor((tiempoFin - tiempoInicio) / 1000);
            
            await this.actualizarSincronizacion(
                idSincronizacion,
                'completado',
                procesados,
                actualizados,
                undefined,
                duracionSegundos
            );
            
            console.log(`Sincronización de contratos completada. Procesados: ${procesados}, Actualizados: ${actualizados}, Duración: ${duracionSegundos}s`);
            
        } catch (error) {
            console.error('Error en sincronización de contratos:', error);
            throw error;
        }
    }
}

export default SincronizacionService; 