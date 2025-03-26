import supabase from '../config/supabase';

async function alterarTablaEmpleados() {
    console.log('Intentando alterar la tabla empleados_rex...');
    
    try {
        // Primero, obtener la estructura actual de la tabla
        const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
            table_name: 'empleados_rex'
        });
        
        if (columnsError) {
            console.error('Error al obtener columnas:', columnsError);
            throw columnsError;
        }
        
        console.log('Estructura actual de la tabla:', columns);
        
        // Intentar ejecutar SQL directamente para cambiar la columna situacion a TEXT
        const { error: alterError } = await supabase.rpc('execute_sql', {
            sql_query: 'ALTER TABLE empleados_rex ALTER COLUMN situacion TYPE TEXT'
        });
        
        if (alterError) {
            console.error('Error al alterar la tabla:', alterError);
            
            // Plan B: Insertar empleados sin estrictamente validar el tipo
            console.log('Intentando método alternativo...');
            
            const { data, error } = await supabase.from('empleados_rex').insert({
                rut: 'TEST-00000',
                nombres: 'PRUEBA',
                apellido_paterno: 'DE',
                apellido_materno: 'SISTEMA',
                email: 'test@example.com',
                fecha_nacimiento: null,
                situacion: 'A',
                supervisa: false,
                empresa_id: null,
                direccion: 'TEST',
                ciudad: 'TEST',
                telefono: '123456789'
            });
            
            if (error) {
                console.error('Error en método alternativo:', error);
                throw error;
            } else {
                console.log('Inserción de prueba exitosa');
                
                // Eliminar el registro de prueba
                await supabase.from('empleados_rex').delete().eq('rut', 'TEST-00000');
            }
        } else {
            console.log('Tabla alterada exitosamente');
        }
        
    } catch (error) {
        console.error('Error en la función alterarTablaEmpleados:', error);
        throw error;
    }
}

// Ejecutar la función
alterarTablaEmpleados()
    .then(() => {
        console.log('Proceso completado');
    })
    .catch((error) => {
        console.error('Error en el proceso:', error);
        process.exit(1);
    }); 