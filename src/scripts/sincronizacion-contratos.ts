import supabase from '../config/supabase';
import { API_CONFIG } from '../config/api.config';

// Interfaz para los contratos provenientes de la API
interface ContratoRex {
    id?: number;
    numerocontrato?: string;
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

async function obtenerEmpleadosActivos(): Promise<string[]> {
    console.log('Obteniendo empleados activos de la base de datos...');
    
    try {
        const { data, error } = await supabase
            .from('empleados_rex')
            .select('rut')
            .eq('situacion', 'A');
            
        if (error) {
            throw error;
        }
        
        if (!data || data.length === 0) {
            console.log('No se encontraron empleados activos en la base de datos');
            return [];
        }
        
        console.log(`Se encontraron ${data.length} empleados activos en la base de datos`);
        return data.map(e => e.rut);
    } catch (error) {
        console.error('Error al obtener empleados activos:', error);
        throw error;
    }
}

async function obtenerContratoEmpleado(rut: string): Promise<ContratoRex | null> {
    console.log(`Obteniendo contratos para empleado ${rut}...`);
    
    try {
        // URL para obtener todos los contratos del empleado
        const url = `${API_CONFIG.BASE_URL}/empleados/rut/${rut}/contratos`;
        console.log(`Consultando URL: ${url}`);
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            console.error(`Error al obtener contratos para ${rut}: ${response.status}`);
            return null;
        }
        
        // Extraer el texto de la respuesta para debug
        const responseText = await response.text();
        
        try {
            // Convertir la respuesta a JSON
            const data = JSON.parse(responseText);
            
            // Determinar si tenemos un array o un objeto
            if (Array.isArray(data)) {
                console.log(`Se encontraron ${data.length} contratos para ${rut}`);
                
                // Si hay contratos, devolver el más reciente (asumiendo que es el primero)
                if (data.length > 0) {
                    // Ordenar por fecha de inicio descendente
                    const contratosOrdenados = [...data].sort((a, b) => {
                        const fechaA = a.fechaInic ? new Date(a.fechaInic).getTime() : 0;
                        const fechaB = b.fechaInic ? new Date(b.fechaInic).getTime() : 0;
                        return fechaB - fechaA;
                    });
                    
                    return contratosOrdenados[0];
                }
            } else if (data && typeof data === 'object') {
                console.log(`Se encontró un contrato para ${rut}`);
                return data;
            }
            
            console.log(`No se encontraron contratos para ${rut}`);
            return null;
        } catch (parseError) {
            console.error(`Error al procesar respuesta para ${rut}:`, parseError);
            console.log(`Respuesta cruda: ${responseText.substring(0, 200)}...`);
            return null;
        }
    } catch (error) {
        console.error(`Error al obtener contrato para ${rut}:`, error);
        return null;
    }
}

async function sincronizarContratos() {
    console.log('Iniciando sincronización de contratos...');
    
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
        for (const rut of empleadosActivos) {
            try {
                // 3. Obtener contrato del empleado
                const contrato = await obtenerContratoEmpleado(rut);
                
                if (!contrato) {
                    console.log(`No se encontró contrato para empleado ${rut}`);
                    continue;
                }
                
                // 4. Preparar datos para inserción
                const contratoSimplificado: ContratoSimplificado = {
                    rut_empleado: rut,
                    numero_contrato: contrato.numerocontrato || contrato.contrato || '1',
                    rut_supervisor: contrato.supervisor || null,
                    cargo_codigo: contrato.cargo || null,
                    centro_costo_codigo: contrato.centroCost || contrato.centro_distribucion || null,
                    fecha_inicio: contrato.fechaInic ? new Date(contrato.fechaInic).toISOString().split('T')[0] : fechaRegistro,
                    fecha_termino: contrato.fechaTerm && contrato.fechaTerm !== '3000-01-01' ? 
                        new Date(contrato.fechaTerm).toISOString().split('T')[0] : null,
                    estado: (contrato.estado || 'A')[0],
                    tipo_contrato: contrato.tipoCont || null,
                    sueldo_base: contrato.sueldoBase ? parseFloat(contrato.sueldoBase) : null,
                    empresa_id: contrato.empresa || null,
                    sede: contrato.sede || null,
                    fecha_registro: fechaRegistro,
                    activo: true
                };
                
                // 5. Insertar o actualizar en la base de datos
                console.log(`Guardando contrato para empleado ${rut}`);
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
                console.error(`Error al procesar contrato para ${rut}:`, error);
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
sincronizarContratos()
    .then(() => {
        console.log('Proceso de sincronización de contratos finalizado');
    })
    .catch(error => {
        console.error('Error fatal en sincronización de contratos:', error);
        process.exit(1);
    }); 