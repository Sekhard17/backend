import supabase from '../config/supabase';

// Script simplificado para crear rápidamente todos los usuarios
async function main() {
    try {
        console.log('Iniciando creación rápida de usuarios...');
        
        // 1. Obtener todos los contratos activos
        console.log('Obteniendo contratos...');
        const { data: contratos, error: errorContratos } = await supabase
            .from('contratos_rex')
            .select('rut_empleado, rut_supervisor, cargo_codigo')
            .eq('activo', true)
            .not('rut_empleado', 'is', null);
        
        if (errorContratos) {
            throw new Error(`Error al obtener contratos: ${errorContratos.message}`);
        }
        
        console.log(`Se encontraron ${contratos.length} contratos activos`);
        
        // 2. Extraer RUTs únicos de supervisores y empleados
        const supervisoresRuts = new Set<string>();
        const empleadosRuts = new Set<string>();
        const relaciones: Record<string, string[]> = {}; // supervisor -> [empleados]
        
        contratos.forEach((contrato: any) => {
            // Agregar el empleado a la lista
            if (contrato.rut_empleado) {
                empleadosRuts.add(contrato.rut_empleado);
            }
            
            // Agregar el supervisor a la lista si existe
            if (contrato.rut_supervisor) {
                supervisoresRuts.add(contrato.rut_supervisor);
                
                // También registrar la relación supervisor-empleado
                if (!relaciones[contrato.rut_supervisor]) {
                    relaciones[contrato.rut_supervisor] = [];
                }
                
                if (contrato.rut_empleado && !relaciones[contrato.rut_supervisor].includes(contrato.rut_empleado)) {
                    relaciones[contrato.rut_supervisor].push(contrato.rut_empleado);
                }
            }
        });
        
        console.log(`Se identificaron ${supervisoresRuts.size} supervisores únicos`);
        console.log(`Se identificaron ${empleadosRuts.size} empleados únicos`);
        
        // 3. Obtener usuarios existentes para no duplicarlos
        console.log('Obteniendo usuarios existentes...');
        const { data: usuariosExistentes, error: errorUsuarios } = await supabase
            .from('usuarios')
            .select('rut, id, rol, id_supervisor');
        
        if (errorUsuarios) {
            throw new Error(`Error al obtener usuarios: ${errorUsuarios.message}`);
        }
        
        const usuariosMap = new Map();
        usuariosExistentes?.forEach((usuario: any) => {
            usuariosMap.set(usuario.rut, { 
                id: usuario.id, 
                rol: usuario.rol,
                id_supervisor: usuario.id_supervisor
            });
        });
        
        console.log(`Se encontraron ${usuariosMap.size} usuarios existentes`);
        
        // 4. Crear todos los supervisores de una vez en la tabla usuarios 
        console.log('\n=== CREANDO SUPERVISORES ===');
        
        // Verificar si tenemos la tabla auth.users
        console.log('Verificando existencia de tabla auth.users...');
        const { data: authExists, error: authError } = await supabase
            .from('information_schema.tables')
            .select('table_schema, table_name')
            .eq('table_schema', 'auth')
            .eq('table_name', 'users');
        
        const authUsersExists = authExists && authExists.length > 0;
        console.log(`Tabla auth.users ${authUsersExists ? 'existe' : 'no existe'}`);
        
        // Obtener todos los usuarios existentes en auth.users si existe
        let authUsersMap = new Map();
        if (authUsersExists) {
            console.log('Obteniendo usuarios de auth.users...');
            try {
                const { data: authUsers, error: authUsersError } = await supabase
                    .from('auth.users')
                    .select('id, email');
                
                if (authUsersError) {
                    console.error('Error al obtener usuarios de auth:', authUsersError);
                } else if (authUsers) {
                    authUsers.forEach((user: any) => {
                        authUsersMap.set(user.email, user.id);
                    });
                    console.log(`Se encontraron ${authUsersMap.size} usuarios en auth.users`);
                }
            } catch (error) {
                console.error('Error al consultar auth.users:', error);
            }
        }
        
        const supervisoresNuevos = Array.from(supervisoresRuts)
            .filter(rut => !usuariosMap.has(rut))
            .map(rut => {
                // Extraer la parte numérica del RUT para el nombre de usuario
                const rutNumerico = rut.replace('-', '').replace(/\./g, '');
                const nombreUsuario = `s${rutNumerico}`;
                const email = `${nombreUsuario}@socoepa.cl`;
                
                // Si existe en auth.users, usar ese ID
                const authId = authUsersMap.get(email);
                
                return {
                    // No incluir ID, dejar que la BD lo genere
                    rut: rut,
                    nombres: `Supervisor ${rut}`,
                    appaterno: 'REX',
                    email: email,
                    rol: 'supervisor',
                    nombre_usuario: nombreUsuario
                };
            });
        
        console.log(`Creando ${supervisoresNuevos.length} supervisores nuevos...`);
        
        if (supervisoresNuevos.length > 0) {
            // Crear la SQL directamente para saltarse la restricción de clave foránea
            // Esto inserta usuario con default id
            const { data: supervisoresCreados, error: errorCrear } = await supabase
                .from('usuarios')
                .insert(supervisoresNuevos)
                .select('id, rut');
            
            if (errorCrear) {
                console.error('Error al crear supervisores:', errorCrear);
            } else {
                console.log(`Se crearon ${supervisoresCreados?.length} supervisores`);
                
                // Actualizar el mapa de usuarios
                supervisoresCreados?.forEach((supervisor: any) => {
                    usuariosMap.set(supervisor.rut, { id: supervisor.id, rol: 'supervisor' });
                });
            }
        }
        
        // 5. Actualizar los supervisores existentes si es necesario
        const supervisoresParaActualizar = Array.from(supervisoresRuts)
            .filter(rut => usuariosMap.has(rut) && usuariosMap.get(rut).rol !== 'supervisor')
            .map(rut => ({
                id: usuariosMap.get(rut).id,
                rol: 'supervisor'
            }));
        
        if (supervisoresParaActualizar.length > 0) {
            console.log(`Actualizando ${supervisoresParaActualizar.length} usuarios a rol supervisor...`);
            
            for (const supervisor of supervisoresParaActualizar) {
                const { error } = await supabase
                    .from('usuarios')
                    .update({ rol: 'supervisor' })
                    .eq('id', supervisor.id);
                
                if (error) {
                    console.error(`Error al actualizar supervisor ${supervisor.id}:`, error);
                }
            }
        }
        
        // 6. Crear empleados y actualizar sus supervisores
        console.log('\n=== CREANDO FUNCIONARIOS ===');
        
        // Preparar todos los funcionarios nuevos
        const funcionariosNuevos = [];
        const funcionariosParaActualizar = [];
        
        for (const [rutSupervisor, empleados] of Object.entries(relaciones)) {
            // Obtener el ID del supervisor
            const supervisorInfo = usuariosMap.get(rutSupervisor);
            
            if (!supervisorInfo) {
                console.log(`No se encontró información para el supervisor ${rutSupervisor}, omitiendo sus empleados`);
                continue;
            }
            
            const idSupervisor = supervisorInfo.id;
            
            // Procesar cada empleado
            for (const rutEmpleado of empleados) {
                // Si ya existe el empleado, solo actualizar su supervisor
                if (usuariosMap.has(rutEmpleado)) {
                    const empleadoInfo = usuariosMap.get(rutEmpleado);
                    
                    // Solo actualizar si es diferente
                    if (empleadoInfo.id_supervisor !== idSupervisor) {
                        funcionariosParaActualizar.push({
                            id: empleadoInfo.id,
                            id_supervisor: idSupervisor
                        });
                    }
                } else {
                    // Crear nuevo funcionario
                    const rutNumerico = rutEmpleado.replace('-', '').replace(/\./g, '');
                    const nombreUsuario = `f${rutNumerico}`;
                    
                    funcionariosNuevos.push({
                        // No incluir ID, dejar que la BD lo genere
                        rut: rutEmpleado,
                        nombres: `Funcionario ${rutEmpleado}`,
                        appaterno: 'REX',
                        email: `${nombreUsuario}@socoepa.cl`,
                        rol: 'funcionario',
                        nombre_usuario: nombreUsuario,
                        id_supervisor: idSupervisor
                    });
                }
            }
        }
        
        console.log(`Creando ${funcionariosNuevos.length} funcionarios nuevos...`);
        
        // Crear funcionarios en bloques de 50 para evitar problemas
        const TAMANO_LOTE = 50;
        for (let i = 0; i < funcionariosNuevos.length; i += TAMANO_LOTE) {
            const lote = funcionariosNuevos.slice(i, i + TAMANO_LOTE);
            console.log(`Procesando lote ${i/TAMANO_LOTE + 1} de ${Math.ceil(funcionariosNuevos.length/TAMANO_LOTE)}`);
            
            const { data: funcionariosCreados, error: errorCrear } = await supabase
                .from('usuarios')
                .insert(lote);
            
            if (errorCrear) {
                console.error(`Error al crear lote de funcionarios:`, errorCrear);
            } else {
                console.log(`Se crearon ${lote.length} funcionarios en este lote`);
            }
        }
        
        // Actualizar funcionarios existentes
        console.log(`Actualizando ${funcionariosParaActualizar.length} funcionarios existentes...`);
        
        for (const funcionario of funcionariosParaActualizar) {
            const { error } = await supabase
                .from('usuarios')
                .update({ id_supervisor: funcionario.id_supervisor })
                .eq('id', funcionario.id);
            
            if (error) {
                console.error(`Error al actualizar funcionario ${funcionario.id}:`, error);
            }
        }
        
        console.log('\n=== CREANDO REGISTROS DE ACCESO ===');
        
        // Crear registros de acceso con la contraseña estándar
        const usuariosCreados = [...supervisoresNuevos, ...funcionariosNuevos];
        const registrosAcceso = usuariosCreados.map(usuario => ({
            rut: usuario.rut,
            email: usuario.email,
            nombre_usuario: usuario.nombre_usuario,
            password: 'practica',
            fecha_creacion: new Date().toISOString()
        }));
        
        if (registrosAcceso.length > 0) {
            console.log(`Guardando ${registrosAcceso.length} registros de acceso...`);
            
            // Insertar en lotes para evitar problemas
            for (let i = 0; i < registrosAcceso.length; i += TAMANO_LOTE) {
                const lote = registrosAcceso.slice(i, i + TAMANO_LOTE);
                
                const { error } = await supabase
                    .from('usuario_registros')
                    .insert(lote);
                
                if (error) {
                    console.error(`Error al guardar lote de registros de acceso:`, error);
                } else {
                    console.log(`Se guardaron ${lote.length} registros de acceso en este lote`);
                }
            }
        }
        
        console.log('\n=== RESUMEN ===');
        console.log(`Supervisores procesados: ${supervisoresRuts.size}`);
        console.log(`Supervisores nuevos creados: ${supervisoresNuevos.length}`);
        console.log(`Supervisores actualizados: ${supervisoresParaActualizar.length}`);
        console.log(`Funcionarios nuevos creados: ${funcionariosNuevos.length}`);
        console.log(`Funcionarios actualizados: ${funcionariosParaActualizar.length}`);
        console.log('Proceso completado correctamente');
        
    } catch (error) {
        console.error('Error en la ejecución del script:', error);
    }
}

// Ejecutar el script
main()
    .then(() => {
        console.log('Proceso finalizado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    }); 