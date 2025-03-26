import supabase from '../config/supabase';
import { API_CONFIG } from '../config/api.config';

interface Empleado {
    rut: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno?: string;
    email?: string;
}

// Obtener datos de un empleado desde la API
async function obtenerEmpleadoDesdeApi(rut: string): Promise<Empleado | null> {
    try {
        const headers = {
            'Authorization': `Token ${API_CONFIG.TOKEN}`,
            'Accept': 'application/json'
        };

        const url = `${API_CONFIG.BASE_URL}/empleados/${rut}`;
        console.log(`Consultando API para el RUT ${rut}: ${url}`);
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            console.error(`Error al obtener datos del empleado ${rut}: ${response.status}`);
            return null;
        }
        
        // Obtener respuesta como texto para depuración
        const responseText = await response.text();
        console.log(`Respuesta para ${rut} (primeros 100 caracteres): ${responseText.substring(0, 100)}...`);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error(`Error al parsear JSON para ${rut}:`, parseError);
            return null;
        }
        
        // Log para ver estructura de la respuesta
        console.log(`Estructura de la respuesta para ${rut}:`, Object.keys(data));
        
        // Validar que sea el empleado correcto usando el campo "empleado"
        if (data && data.empleado && data.empleado === rut) {
            console.log(`Encontrado empleado ${rut}: ${data.nombre} ${data.apellidoPate}`);
            
            return {
                rut: rut,
                nombres: data.nombre || '',
                apellido_paterno: data.apellidoPate || '',
                apellido_materno: data.apellidoMate || '',
                email: data.email || data.emailPersonal || ''
            };
        }
        
        console.error(`No se pudo encontrar información para el RUT ${rut} en la respuesta de la API`);
        return null;
    } catch (error) {
        console.error(`Error al obtener datos del empleado ${rut} desde la API:`, error);
        return null;
    }
}

// Crear un usuario en Supabase Auth
async function crearUsuarioAuth(email: string, password: string, userData: any, maxRetries = 3): Promise<any> {
    let retryCount = 0;
    let lastError: any = null;
    
    while (retryCount < maxRetries) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: userData
                }
            });
            
            if (error) {
                // Manejo específico para error de límite de tasa
                if (error.status === 429 || error.message.includes('rate limit') || error.code === 'over_request_rate_limit') {
                    console.log(`Error de límite de tasa alcanzado para ${email}. Esperando antes de reintentar...`);
                    // Esperar un tiempo mayor para rate limits (aumenta exponencialmente)
                    const waitTime = Math.pow(4, retryCount + 1) * 1000; // 4s, 16s, 64s
                    console.log(`Esperando ${waitTime/1000} segundos antes del siguiente intento...`);
                    await pausa(waitTime);
                    retryCount++;
                    continue;
                }
                
                // Si el usuario ya existe, podemos intentar iniciar sesión
                if (error.message.includes('already exists')) {
                    console.log(`El usuario con email ${email} ya existe en Auth, intentando iniciar sesión...`);
                    
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });
                    
                    if (signInError) {
                        // Si encontramos rate limit en el inicio de sesión
                        if (signInError.status === 429 || signInError.message.includes('rate limit')) {
                            console.log(`Error de límite de tasa al iniciar sesión para ${email}. Esperando...`);
                            const waitTime = Math.pow(3, retryCount + 1) * 1000;
                            await pausa(waitTime);
                            retryCount++;
                            continue;
                        }
                        
                        console.error(`Error al iniciar sesión con usuario existente ${email}:`, signInError);
                        throw signInError;
                    }
                    
                    return signInData.user;
                }
                
                throw error;
            }
            
            if (!data.user) {
                throw new Error(`No se pudo crear el usuario para ${email}`);
            }
            
            return data.user;
        } catch (err) {
            const error = err as any;
            console.error(`Intento ${retryCount + 1}/${maxRetries} fallido al crear usuario en Auth:`, error);
            lastError = error;
            retryCount++;
            
            // Esperar un poco antes del siguiente intento
            if (retryCount < maxRetries) {
                // Si es un error de rate limit, esperar más tiempo
                const isRateLimit = 
                    (error.status === 429) || 
                    (typeof error.message === 'string' && error.message.includes('rate limit')) ||
                    (error.code === 'over_request_rate_limit');
                
                const waitTime = isRateLimit 
                    ? Math.pow(5, retryCount) * 1000  // Tiempo más largo para rate limits
                    : 2000 * retryCount;              // Tiempo normal para otros errores
                
                console.log(`Esperando ${waitTime/1000} segundos antes del siguiente intento...`);
                await pausa(waitTime);
            }
        }
    }
    
    throw lastError;
}

// Insertar el usuario en la tabla usuarios
async function insertarUsuarioEnTabla(usuario: any) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .insert([usuario])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error al insertar usuario en tabla:', error);
        throw error;
    }
}

// Limpiar texto para nombres de usuario y emails (remover caracteres no permitidos)
function limpiarTexto(texto: string): string {
    if (!texto) return '';
    // Convertir a minúsculas
    let limpio = texto.toLowerCase();
    // Remover acentos
    limpio = limpio.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Remover caracteres especiales y espacios
    limpio = limpio.replace(/[^a-z0-9]/g, '');
    return limpio;
}

// Crear un nombre de usuario con formato inicial+apellido
function crearNombreUsuario(nombres: string, apellido: string): string {
    if (!nombres || !apellido) return 'usuario' + Math.floor(Math.random() * 10000);
    
    // Obtener primer nombre
    const primerNombre = nombres.trim().split(' ')[0];
    // Obtener la primera inicial del primer nombre
    const inicial = primerNombre.charAt(0);
    // Limpiar y convertir a minúsculas el apellido
    const apellidoLimpio = limpiarTexto(apellido);
    
    if (!inicial || !apellidoLimpio) {
        return 'usuario' + Math.floor(Math.random() * 10000);
    }
    
    return `${inicial}${apellidoLimpio}`;
}

// Generar un email basado en el nombre
function generarEmail(nombres: string, apellido: string): string {
    if (!nombres || !apellido) return `usuario${Math.floor(Math.random() * 10000)}@socoepa.cl`;
    
    // Obtener primer nombre
    const primerNombre = nombres.trim().split(' ')[0];
    const nombreLimpio = limpiarTexto(primerNombre);
    const apellidoLimpio = limpiarTexto(apellido);
    
    if (!nombreLimpio || !apellidoLimpio) {
        return `usuario${Math.floor(Math.random() * 10000)}@socoepa.cl`;
    }
    
    return `${nombreLimpio}.${apellidoLimpio}@socoepa.cl`;
}

// Crear un usuario (supervisor o funcionario)
async function crearUsuario(rut: string, rol: 'supervisor' | 'funcionario', idSupervisor?: string): Promise<boolean> {
    try {
        // Verificar si ya existe un usuario con este RUT
        const { data: usuarioExistente, error: errorBusqueda } = await supabase
            .from('usuarios')
            .select('*')
            .eq('rut', rut)
            .single();
        
        if (!errorBusqueda && usuarioExistente) {
            console.log(`Ya existe un usuario para el RUT ${rut}, actualizando rol a ${rol}`);
            
            // Actualizar el rol y el supervisor si es necesario
            const updates: any = { rol };
            if (idSupervisor) updates.id_supervisor = idSupervisor;
            
            const { data: usuarioActualizado, error: errorActualizar } = await supabase
                .from('usuarios')
                .update(updates)
                .eq('id', usuarioExistente.id)
                .single();
            
            if (errorActualizar) {
                console.error(`Error al actualizar usuario ${rut}:`, errorActualizar);
            } else {
                console.log(`Usuario ${rut} actualizado correctamente`);
            }
            
            return true;
        }
        
        // Obtener datos del empleado desde la API
        const empleado = await obtenerEmpleadoDesdeApi(rut);
        
        // Si no hay datos, crear un usuario básico con el RUT
        let nombreEmpleado = 'Usuario';
        let apellidoEmpleado = rut.replace('-', ''); // Usar el RUT como apellido
        let emailEmpleado = '';
        
        if (empleado) {
            nombreEmpleado = empleado.nombres || 'Usuario';
            apellidoEmpleado = empleado.apellido_paterno || rut.replace('-', '');
            emailEmpleado = empleado.email || '';
        } else {
            console.log(`No se pudieron obtener datos desde la API para el RUT ${rut}, usando valores básicos`);
        }
        
        // Generar nombre de usuario
        const nombreUsuario = crearNombreUsuario(nombreEmpleado, apellidoEmpleado);
        
        // Generar email si no tiene
        let email = emailEmpleado;
        if (!email || email.trim() === '') {
            email = generarEmail(nombreEmpleado, apellidoEmpleado);
        }
        
        // Usar contraseña fija: 'practica'
        const password = 'practica';
        
        console.log(`Creando usuario para ${nombreEmpleado} ${apellidoEmpleado} (${rut})`);
        console.log(`Rol: ${rol}`);
        console.log(`Email: ${email}`);
        console.log(`Nombre de usuario: ${nombreUsuario}`);
        console.log(`Contraseña: ${password}`);
        
        try {
            // Crear usuario en Auth
            const authUser = await crearUsuarioAuth(email, password, {
                nombre_usuario: nombreUsuario,
                nombres: nombreEmpleado,
                appaterno: apellidoEmpleado,
                apmaterno: empleado?.apellido_materno || null,
                rol
            });
            
            // Esperar un momento para asegurarse de que el usuario se ha creado completamente en auth.users
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Insertar en la tabla de usuarios
            const usuarioData = {
                id: authUser?.id,
                rut: rut,
                nombres: nombreEmpleado,
                appaterno: apellidoEmpleado,
                apmaterno: empleado?.apellido_materno || null,
                email: email,
                rol: rol,
                nombre_usuario: nombreUsuario,
                id_supervisor: idSupervisor || null
            };
            
            const { data: usuarioInsertado, error: errorInsercion } = await supabase
                .from('usuarios')
                .insert([usuarioData])
                .select()
                .single();
            
            if (errorInsercion) {
                console.error(`Error al insertar usuario ${rut} en tabla:`, errorInsercion);
                return false;
            }
            
            console.log(`Usuario ${rol} creado exitosamente: ${usuarioInsertado.id}`);
            
            // Guardar la información en un archivo de registro
            const { data: registroGuardado, error: errorRegistro } = await supabase
                .from('usuario_registros')
                .insert([{
                    rut: rut,
                    email: email,
                    nombre_usuario: nombreUsuario,
                    password: password,
                    fecha_creacion: new Date().toISOString()
                }]);
            
            if (errorRegistro) {
                console.error('Error al guardar registro de usuario:', errorRegistro);
            }
            
            return true;
        } catch (authError) {
            console.error(`Error al crear usuario en Auth para ${rut}:`, authError);
            return false;
        }
    } catch (error) {
        console.error(`Error al crear usuario ${rut}:`, error);
        return false;
    }
}

// Función para pausar la ejecución
function pausa(ms: number): Promise<void> {
    console.log(`Pausando ejecución por ${ms/1000} segundos...`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función principal
async function main() {
    try {
        console.log('Iniciando creación masiva de usuarios...');
        
        // Obtener todos los contratos activos
        console.log('Obteniendo contratos...');
        const { data: contratos, error: errorContratos } = await supabase
            .from('contratos_rex')
            .select('rut_empleado, rut_supervisor')
            .eq('activo', true)
            .not('rut_empleado', 'is', null);
        
        if (errorContratos) {
            throw new Error(`Error al obtener contratos: ${errorContratos.message}`);
        }
        
        console.log(`Se encontraron ${contratos.length} contratos activos`);
        
        // Extraer RUTs únicos de supervisores y empleados
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
        
        // Primero crear todos los supervisores
        console.log('\n=== CREANDO SUPERVISORES ===');
        const supervisoresCreados: Record<string, string> = {}; // rut -> id
        
        // Procesar supervisores en lotes de 5
        const rutsSupervisores = Array.from(supervisoresRuts);
        const tamanoLote = 5;
        
        for (let i = 0; i < rutsSupervisores.length; i += tamanoLote) {
            const lote = rutsSupervisores.slice(i, i + tamanoLote);
            console.log(`\nProcesando lote de supervisores ${i + 1} a ${Math.min(i + tamanoLote, rutsSupervisores.length)} de ${rutsSupervisores.length}`);
            
            for (const rutSupervisor of lote) {
                console.log(`\n--- Procesando supervisor: ${rutSupervisor} ---`);
                
                // Primero verificar si ya existe
                const { data: supervisorExistente } = await supabase
                    .from('usuarios')
                    .select('*')
                    .eq('rut', rutSupervisor)
                    .single();
                
                if (supervisorExistente) {
                    console.log(`Supervisor ${rutSupervisor} ya existe con ID: ${supervisorExistente.id}`);
                    supervisoresCreados[rutSupervisor] = supervisorExistente.id;
                    continue;
                }
                
                const resultado = await crearUsuario(rutSupervisor, 'supervisor');
                
                if (resultado) {
                    // Obtener el ID del supervisor recién creado
                    const { data: nuevoSupervisor } = await supabase
                        .from('usuarios')
                        .select('id')
                        .eq('rut', rutSupervisor)
                        .single();
                    
                    if (nuevoSupervisor) {
                        supervisoresCreados[rutSupervisor] = nuevoSupervisor.id;
                    }
                }
                
                // Pequeña pausa entre cada supervisor
                await pausa(3000);
            }
            
            // Pausa más larga entre lotes para evitar límites de tasa
            if (i + tamanoLote < rutsSupervisores.length) {
                await pausa(10000);
            }
        }
        
        // Luego crear los empleados y asociarlos a sus supervisores
        console.log('\n=== CREANDO FUNCIONARIOS ===');
        let funcionariosCreados = 0;
        let funcionariosFallidos = 0;
        
        // Convertir a array para procesar por lotes
        const entradasRelaciones = Object.entries(relaciones);
        
        for (let i = 0; i < entradasRelaciones.length; i++) {
            const [rutSupervisor, empleados] = entradasRelaciones[i];
            
            // Obtener el ID del supervisor
            const idSupervisor = supervisoresCreados[rutSupervisor];
            
            if (!idSupervisor) {
                console.log(`No se encontró ID para el supervisor ${rutSupervisor}, omitiendo sus empleados`);
                continue;
            }
            
            console.log(`\nProcesando ${empleados.length} empleados del supervisor ${rutSupervisor} (${i + 1}/${entradasRelaciones.length})`);
            
            // Procesar empleados en lotes más pequeños
            for (let j = 0; j < empleados.length; j += tamanoLote) {
                const loteEmpleados = empleados.slice(j, j + tamanoLote);
                console.log(`Procesando lote de empleados ${j + 1} a ${Math.min(j + tamanoLote, empleados.length)} de ${empleados.length}`);
                
                for (const rutEmpleado of loteEmpleados) {
                    console.log(`\n--- Procesando funcionario: ${rutEmpleado} ---`);
                    
                    const resultado = await crearUsuario(rutEmpleado, 'funcionario', idSupervisor);
                    
                    if (resultado) {
                        funcionariosCreados++;
                    } else {
                        funcionariosFallidos++;
                    }
                    
                    // Pequeña pausa entre cada empleado
                    await pausa(3000);
                }
                
                // Pausa más larga entre lotes para evitar límites de tasa
                if (j + tamanoLote < empleados.length) {
                    await pausa(10000);
                }
            }
            
            // Pausa entre supervisores
            if (i < entradasRelaciones.length - 1) {
                await pausa(5000);
            }
        }
        
        console.log('\n=== RESUMEN ===');
        console.log(`Supervisores procesados: ${supervisoresRuts.size}`);
        console.log(`Funcionarios creados: ${funcionariosCreados}`);
        console.log(`Funcionarios fallidos: ${funcionariosFallidos}`);
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