import supabase from '../config/supabase';
import { API_CONFIG } from '../config/api.config';

// Interfaz para los empleados con su contrato activo
interface EmpleadoRex {
    rut: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string;
    situacion: string;
    contratoActi?: string; // Número de contrato activo
    empresa_id?: string | null;
}

// Interfaz para los contratos provenientes de la API
interface ContratoRex {
    id?: number;
    numerocontrato?: string;
    contrato?: string;
    fechaInic?: string;
    fechaTerm?: string;
    fechaCambInde?: string;
    cargo?: string;
    cargo_id?: string;
    sueldoBase?: string;
    supervisor?: string;
    estado?: string;
    tipoCont?: string;
    centroCost?: string;
    centro_distribucion?: string;
    empresa?: string;
    sede?: string;
    [key: string]: any;
}

// Datos para inserción en BD
interface ContratoSimplificado {
    rut_empleado: string;
    numero_contrato: string;
    rut_supervisor?: string | null;
    cargo_codigo?: string | null;
    centro_costo_codigo?: string | null;
    fecha_inicio: string;
    fecha_termino?: string | null;
    estado: string;
    tipo_contrato?: string | null;
    sueldo_base?: number | null;
    empresa_id?: string | null;
    sede?: string | null;
    fecha_registro: string;
    activo: boolean;
}

const headers = {
    'Authorization': `Token ${API_CONFIG.TOKEN}`
};

async function obtenerEmpleadosActivos(): Promise<EmpleadoRex[]> {
    console.log('Obteniendo empleados activos de la base de datos...');
    
    try {
        const { data, error } = await supabase
            .from('empleados_rex')
            .select('rut, nombres, apellido_paterno, apellido_materno, situacion, empresa_id')
            .eq('situacion', 'A');
            
        if (error) {
            throw error;
        }
        
        if (!data || data.length === 0) {
            console.log('No se encontraron empleados activos en la base de datos');
            return [];
        }
        
        console.log(`Se encontraron ${data.length} empleados activos en la base de datos`);
        return data;
    } catch (error) {
        console.error('Error al obtener empleados activos:', error);
        throw error;
    }
}

async function obtenerNumeroContratoActivo(rut: string): Promise<string | null> {
    console.log(`Obteniendo número de contrato activo para empleado ${rut}...`);
    
    try {
        // URL para obtener datos del empleado y su contrato activo
        const url = `${API_CONFIG.BASE_URL}/empleados/${rut}`;
        console.log(`Consultando URL para contrato activo: ${url}`);
        
        const response = await fetch(url, { 
            // Agregar una cabecera que indica que esperamos JSON
            headers: {
                'Authorization': `Token ${API_CONFIG.TOKEN}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error(`Error al obtener datos del empleado ${rut}: ${response.status}`);
            return null;
        }
        
        // Verificar el tipo de contenido antes de procesar
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`La respuesta para ${rut} no es JSON (${contentType}). Usando número de contrato por defecto`);
            return '1'; // Valor por defecto si la respuesta no es JSON
        }
        
        const responseText = await response.text();
        
        // Verificar si la respuesta contiene HTML
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            console.log(`Respuesta HTML recibida para ${rut}. Usando número de contrato por defecto`);
            return '1'; // Valor por defecto si la respuesta es HTML
        }
        
        try {
            const empleadoData = JSON.parse(responseText);
            console.log(`Datos del empleado obtenidos. Contrato activo: ${empleadoData.contratoActi || 'No disponible'}`);
            
            if (empleadoData.contratoActi) {
                return empleadoData.contratoActi;
            } else {
                console.log(`Empleado ${rut} no tiene contrato activo definido`);
                return '1'; // Valor por defecto si no hay contrato activo
            }
        } catch (parseError) {
            console.error(`Error al parsear datos del empleado ${rut}:`, parseError);
            console.log(`Contenido de la respuesta: ${responseText.substring(0, 200)}...`);
            return '1'; // Valor por defecto en caso de error
        }
    } catch (error) {
        console.error(`Error al obtener contrato activo para ${rut}:`, error);
        return '1'; // Valor por defecto en caso de error
    }
}

async function obtenerContratoEspecifico(rut: string, numeroContrato: string): Promise<ContratoRex | null> {
    console.log(`Obteniendo contrato #${numeroContrato} para empleado ${rut}...`);
    
    try {
        // URL para obtener un contrato específico
        const url = `${API_CONFIG.BASE_URL}/empleados/${rut}/contratos/${numeroContrato}`;
        console.log(`Consultando URL: ${url}`);
        
        const response = await fetch(url, { 
            headers: {
                'Authorization': `Token ${API_CONFIG.TOKEN}`,
                'Accept': 'application/json'
            } 
        });
        
        if (!response.ok) {
            console.error(`Error al obtener contrato #${numeroContrato} para ${rut}: ${response.status}`);
            return null;
        }
        
        // Verificar el tipo de contenido antes de procesar
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`La respuesta para contrato de ${rut} no es JSON (${contentType})`);
            return null;
        }
        
        const responseText = await response.text();
        
        // Verificar si la respuesta contiene HTML
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            console.log(`Respuesta HTML recibida para contrato de ${rut}`);
            return null;
        }
        
        try {
            const contratoData = JSON.parse(responseText);
            console.log(`Contrato #${numeroContrato} para ${rut} obtenido correctamente`);
            return contratoData;
        } catch (parseError) {
            console.error(`Error al parsear contrato para ${rut}:`, parseError);
            console.log(`Respuesta cruda: ${responseText.substring(0, 200)}...`);
            return null;
        }
    } catch (error) {
        console.error(`Error al obtener contrato para ${rut}:`, error);
        return null;
    }
}

async function sincronizarContratosNumerados() {
    console.log('Iniciando sincronización de contratos con números específicos...');
    
    try {
        // 1. Obtener todos los empleados activos
        const empleadosActivos = await obtenerEmpleadosActivos();
        
        if (empleadosActivos.length === 0) {
            console.log('No hay empleados activos para sincronizar contratos');
            return;
        }
        
        console.log(`Procesando contratos para ${empleadosActivos.length} empleados activos`);
        
        let procesados = 0;
        let actualizados = 0;
        let errores = 0;
        
        const fechaRegistro = new Date().toISOString().split('T')[0];
        
        // 2. Procesar cada empleado
        for (const empleado of empleadosActivos) {
            try {
                const rut = empleado.rut;
                
                // 3. Obtener número de contrato activo
                const numeroContrato = await obtenerNumeroContratoActivo(rut);
                
                if (!numeroContrato) {
                    console.log(`No se pudo obtener número de contrato para empleado ${rut}`);
                    continue;
                }
                
                // 4. Obtener contrato específico
                const contrato = await obtenerContratoEspecifico(rut, numeroContrato);
                
                if (!contrato) {
                    console.log(`No se encontró contrato #${numeroContrato} para empleado ${rut}`);
                    continue;
                }
                
                // 5. Preparar datos para inserción
                const contratoSimplificado: ContratoSimplificado = {
                    rut_empleado: rut,
                    numero_contrato: numeroContrato,
                    rut_supervisor: contrato.supervisor || null,
                    cargo_codigo: contrato.cargo || null,
                    centro_costo_codigo: contrato.centroCost || contrato.centro_distribucion || null,
                    fecha_inicio: contrato.fechaInic ? new Date(contrato.fechaInic).toISOString().split('T')[0] : fechaRegistro,
                    fecha_termino: contrato.fechaTerm && contrato.fechaTerm !== '3000-01-01' ? 
                        new Date(contrato.fechaTerm).toISOString().split('T')[0] : null,
                    estado: (contrato.estado || 'A')[0],
                    tipo_contrato: contrato.tipoCont || null,
                    sueldo_base: contrato.sueldoBase ? parseFloat(contrato.sueldoBase) : null,
                    empresa_id: contrato.empresa || empleado.empresa_id || null,
                    sede: contrato.sede || null,
                    fecha_registro: fechaRegistro,
                    activo: true
                };
                
                // 6. Insertar o actualizar en la base de datos
                console.log(`Guardando contrato #${numeroContrato} para empleado ${rut}`);
                const { error } = await supabase
                    .from('contratos_rex')
                    .upsert(contratoSimplificado, {
                        onConflict: 'rut_empleado,numero_contrato,fecha_registro'
                    });
                
                if (error) {
                    console.error(`Error al guardar contrato para ${rut}:`, error);
                    errores++;
                } else {
                    console.log(`Contrato para ${rut} guardado correctamente`);
                    actualizados++;
                }
            } catch (error) {
                console.error(`Error al procesar contrato para ${empleado.rut}:`, error);
                errores++;
            }
            
            procesados++;
            
            // Mostrar progreso
            if (procesados % 10 === 0 || procesados === empleadosActivos.length) {
                console.log(`Progreso: ${procesados}/${empleadosActivos.length} (${actualizados} actualizados, ${errores} errores)`);
            }
            
            // Pequeña pausa para no sobrecargar la API
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`Sincronización de contratos completada:`);
        console.log(`- Empleados procesados: ${procesados}`);
        console.log(`- Contratos actualizados: ${actualizados}`);
        console.log(`- Errores: ${errores}`);
        
    } catch (error) {
        console.error('Error general en sincronización de contratos:', error);
    }
}

// Ejecutar la función
sincronizarContratosNumerados()
    .then(() => {
        console.log('Proceso de sincronización de contratos finalizado');
    })
    .catch(error => {
        console.error('Error fatal en sincronización de contratos:', error);
        process.exit(1);
    }); 