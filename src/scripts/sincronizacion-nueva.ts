import SincronizacionService from '../services/sincronizacion.service';

/**
 * Script para ejecutar la sincronización inicial de los datos de REX
 */
async function ejecutarNuevaSincronizacion() {
    console.log('Iniciando nueva sincronización de datos REX...');
    try {
        await SincronizacionService.sincronizacionMasivaNueva();
        console.log('Nueva sincronización completada exitosamente');
    } catch (error) {
        console.error('Error en nueva sincronización:', error);
        process.exit(1);
    }
}

// Ejecutar la sincronización
ejecutarNuevaSincronizacion(); 