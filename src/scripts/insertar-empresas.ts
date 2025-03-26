import supabase from '../config/supabase';

const empresas = [
    { codigo: '1', rut: '81.125.900-6', nombre: 'COOPERATIVA ELECTRICA PAILLACO LTDA' },
    { codigo: '2', rut: '96.631.560-5', nombre: 'COMERCIAL SOCOEPA SA' },
    { codigo: '3', rut: '96.879.060-8', nombre: 'FISO SA' },
    { codigo: '4', rut: '96.691.900-5', nombre: 'EMPRESA DISTRIBUIDORA ENERGIA ELECTR.PAILLACO SA' },
    { codigo: '5', rut: '96.889.370-4', nombre: 'INDUSTRIA DE PREFABRICADOS SOCOEPA SA' },
    { codigo: '6', rut: '99.548.570-7', nombre: 'SOLUCIONES ECOLOGICAS Y MEDIO AMBIENTALES SA' },
    { codigo: '7', rut: '96.943.420-4', nombre: 'TRANSPORTES ECOLOGICOS SA' },
    { codigo: '8', rut: '76.144.547-9', nombre: 'SERVICIOS SOCOEPA SA' },
    { codigo: '9', rut: '76.044.388-K', nombre: 'INMOBILIARIA SOCOEPA SA' },
    { codigo: '10', rut: '76.126.301-9', nombre: 'INMOBILIARIA E INVERSIONES CHOSHUENCO S A' }
];

async function insertarEmpresas() {
    console.log('Iniciando inserción de empresas...');
    
    try {
        const { data, error } = await supabase
            .from('empresas_rex')
            .upsert(empresas, { onConflict: 'codigo' })
            .select();
        
        if (error) {
            console.error('Error al insertar empresas:', error);
            throw error;
        }
        
        console.log(`Se insertaron/actualizaron ${data?.length || 0} empresas correctamente`);
        return data;
    } catch (error) {
        console.error('Error en la función insertarEmpresas:', error);
        throw error;
    }
}

// Ejecutar la función
insertarEmpresas()
    .then(() => {
        console.log('Proceso completado exitosamente');
    })
    .catch((error) => {
        console.error('Error en el proceso:', error);
        process.exit(1);
    }); 