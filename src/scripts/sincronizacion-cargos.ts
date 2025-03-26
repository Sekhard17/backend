import supabase from '../config/supabase';
import { API_CONFIG } from '../config/api.config';

// Interfaz para los cargos provenientes de la API
interface CargoRex {
    id: number;
    fecha_creacion?: string;
    fecha_modificacion?: string;
    item: string; // Este es el código del cargo
    nombre: string;
    valora?: string;
    valorb?: string;
    valorc?: string;
    datoAdic?: string;
}

// Interfaz para inserción en la tabla
interface CargoSimplificado {
    codigo: string;
    nombre: string;
    fecha_creacion: string;
    fecha_modificacion: string;
    activo: boolean;
}

const headers = {
    'Authorization': `Token ${API_CONFIG.TOKEN}`,
    'Accept': 'application/json'
};

async function obtenerCargosDesdeApi(): Promise<CargoRex[]> {
    console.log('Obteniendo cargos desde la API...');
    
    try {
        const url = `${API_CONFIG.BASE_URL}/cargos`;
        console.log(`Consultando URL: ${url}`);
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            console.error(`Error al obtener cargos: ${response.status}`);
            return [];
        }
        
        const responseText = await response.text();
        
        try {
            const data = JSON.parse(responseText);
            
            if (data && data.objetos && Array.isArray(data.objetos)) {
                console.log(`Se obtuvieron ${data.objetos.length} cargos desde la API`);
                return data.objetos;
            } else {
                console.error('La respuesta no tiene el formato esperado (objetos)');
                console.log(`Respuesta: ${responseText.substring(0, 200)}...`);
                return [];
            }
        } catch (parseError) {
            console.error('Error al parsear la respuesta JSON:', parseError);
            console.log(`Respuesta raw: ${responseText.substring(0, 200)}...`);
            return [];
        }
    } catch (error) {
        console.error('Error al obtener cargos desde la API:', error);
        return [];
    }
}

async function sincronizarCargos() {
    console.log('Iniciando sincronización de cargos...');
    const startTime = new Date();
    
    try {
        // Obtener cargos desde la API
        const cargos = await obtenerCargosDesdeApi();
        
        if (cargos.length === 0) {
            console.log('No se encontraron cargos para sincronizar');
            return;
        }
        
        console.log(`Procesando ${cargos.length} cargos...`);
        
        let procesados = 0;
        let actualizados = 0;
        let errores = 0;
        
        // Fecha actual para registro
        const fechaActual = new Date().toISOString();
        
        // Procesar cada cargo
        for (const cargo of cargos) {
            try {
                if (!cargo.item || !cargo.nombre) {
                    console.log(`Cargo ${cargo.id} no tiene código o nombre, se omite`);
                    continue;
                }
                
                // Preparar datos para inserción
                const cargoParaInsertar: CargoSimplificado = {
                    codigo: cargo.item,
                    nombre: cargo.nombre,
                    fecha_creacion: cargo.fecha_creacion || fechaActual,
                    fecha_modificacion: cargo.fecha_modificacion || fechaActual,
                    activo: true
                };
                
                // Insertar o actualizar en la base de datos
                const { error } = await supabase
                    .from('cargos_rex')
                    .upsert(cargoParaInsertar, {
                        onConflict: 'codigo'
                    });
                
                if (error) {
                    console.error(`Error al guardar cargo ${cargo.item}:`, error);
                    errores++;
                } else {
                    console.log(`Cargo ${cargo.item} - ${cargo.nombre} guardado correctamente`);
                    actualizados++;
                }
            } catch (error) {
                console.error(`Error al procesar cargo ID ${cargo.id}:`, error);
                errores++;
            }
            
            procesados++;
            
            // Mostrar progreso cada 10 cargos o al final
            if (procesados % 10 === 0 || procesados === cargos.length) {
                console.log(`Progreso: ${procesados}/${cargos.length} (${actualizados} actualizados, ${errores} errores)`);
            }
        }
        
        const endTime = new Date();
        const duration = (endTime.getTime() - startTime.getTime()) / 1000;
        
        console.log(`Sincronización de cargos completada en ${duration.toFixed(2)} segundos:`);
        console.log(`- Cargos procesados: ${procesados}`);
        console.log(`- Cargos actualizados: ${actualizados}`);
        console.log(`- Errores: ${errores}`);
        
    } catch (error) {
        console.error('Error general en sincronización de cargos:', error);
    }
}

// Ejecutar la función
sincronizarCargos()
    .then(() => {
        console.log('Proceso de sincronización de cargos finalizado');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error fatal en sincronización de cargos:', error);
        process.exit(1);
    }); 