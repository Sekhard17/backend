import SincronizacionService from '../services/sincronizacion.service';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function ejecutarSincronizacionInicial() {
    console.log('Iniciando sincronización inicial de datos REX...');
    try {
        await SincronizacionService.sincronizacionMasiva();
        console.log('Sincronización inicial completada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('Error en sincronización inicial:', error);
        process.exit(1);
    }
}

ejecutarSincronizacionInicial(); 