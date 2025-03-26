import supabase from '../config/supabase';
import { API_CONFIG } from '../config/api.config';

// Definir interfaz para los empleados provenientes de la API
interface EmpleadoRex {
    empleado?: string;
    nombre?: string;
    apellidoPate?: string;
    apellidoMate?: string;
    situacion?: string;
    [key: string]: any; // Para otros campos
}

const headers = {
    'Authorization': `Token ${API_CONFIG.TOKEN}`
};

async function obtenerEmpleados(): Promise<EmpleadoRex[]> {
    console.log('Solicitando empleados a la API...');
    
    try {
        const response = await fetch('https://socoepa.rexmas.cl/api/v2/empleados?paginar=0', { headers });
        
        if (!response.ok) {
            throw new Error(`Error al obtener empleados: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log(`Respuesta recibida, longitud: ${responseText.length} caracteres`);
        
        const data = JSON.parse(responseText);
        
        if (!data.objetos || !Array.isArray(data.objetos)) {
            throw new Error('Formato de respuesta inesperado, no contiene objetos');
        }
        
        return data.objetos as EmpleadoRex[];
    } catch (error) {
        console.error('Error al obtener empleados:', error);
        throw error;
    }
}

// Datos simplificados para inserción
interface EmpleadoSimplificado {
    rut: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string;
    situacion: string;
}

async function sincronizarEmpleadosMinimal() {
    console.log('Iniciando sincronización mínima de empleados...');
    
    try {
        const empleados = await obtenerEmpleados();
        console.log(`Obtenidos ${empleados.length} empleados.`);
        
        let insertados = 0;
        let errores = 0;
        
        // Procesar por lotes para evitar sobrecarga
        const tamanoLote = 10;
        
        for (let i = 0; i < empleados.length; i += tamanoLote) {
            const lote = empleados.slice(i, i + tamanoLote);
            
            console.log(`Procesando lote ${i/tamanoLote + 1}/${Math.ceil(empleados.length/tamanoLote)}, ${lote.length} empleados`);
            
            const empleadosSimplificados = lote.map((emp: EmpleadoRex): EmpleadoSimplificado | null => {
                // Solo usar campos absolutamente necesarios
                const rut = emp.empleado || '';
                
                if (!rut) {
                    console.log('Empleado sin RUT, saltando');
                    return null;
                }
                
                return {
                    rut: rut,
                    nombres: (emp.nombre || '').substring(0, 50),
                    apellido_paterno: (emp.apellidoPate || '').substring(0, 50),
                    apellido_materno: (emp.apellidoMate || '').substring(0, 50),
                    situacion: 'A' // Valor fijo para evitar problemas
                };
            }).filter(Boolean) as EmpleadoSimplificado[]; // Eliminar nulls
            
            if (empleadosSimplificados.length === 0) {
                console.log('Lote sin datos válidos, saltando');
                continue;
            }
            
            // Intentar insertar el lote
            try {
                const { data, error } = await supabase
                    .from('empleados_rex')
                    .upsert(empleadosSimplificados);
                
                if (error) {
                    console.error(`Error al insertar lote: ${error.message}`);
                    
                    // Si falla el lote, intentar uno por uno
                    console.log('Intentando insertar empleados individualmente...');
                    
                    for (const emp of empleadosSimplificados) {
                        try {
                            const { error: errorIndividual } = await supabase
                                .from('empleados_rex')
                                .upsert(emp);
                            
                            if (errorIndividual) {
                                console.error(`Error al insertar empleado ${emp.rut}: ${errorIndividual.message}`);
                                errores++;
                            } else {
                                console.log(`Empleado ${emp.rut} insertado correctamente`);
                                insertados++;
                            }
                        } catch (e) {
                            console.error(`Error al insertar empleado ${emp.rut}:`, e);
                            errores++;
                        }
                    }
                } else {
                    console.log(`Lote insertado correctamente, ${lote.length} empleados`);
                    insertados += lote.length;
                }
            } catch (error) {
                console.error('Error al procesar lote:', error);
                errores += lote.length;
            }
            
            // Pequeña pausa para no sobrecargar la base de datos
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`Sincronización completada.`);
        console.log(`Empleados insertados: ${insertados}`);
        console.log(`Errores: ${errores}`);
        
    } catch (error) {
        console.error('Error general en sincronización:', error);
    }
}

// Ejecutar la función
sincronizarEmpleadosMinimal()
    .then(() => {
        console.log('Proceso finalizado');
    })
    .catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    }); 