import { Request, Response, NextFunction } from 'express';
import { generarInformeSupervisado, generarInformePorFechas, generarInformePorProyecto } from '../services/informes.service';

/**
 * Formatea una fecha para DB ajustando específicamente para la zona horaria de Chile
 * Devuelve una fecha en formato YYYY-MM-DD
 */
function formatearFechaParaDB(fecha: Date): string {
  // Para Chile (zona horaria UTC-3/UTC-4), necesitamos compensar específicamente
  // Clone la fecha para no modificar la original
  const fechaClone = new Date(fecha);
  
  // Sumar 1 día para compensar la diferencia de zona horaria
  // Esto es específico para Chile donde una fecha seleccionada como '2023-05-18'
  // a menudo se convierte en '2023-05-17' por problema de zona horaria
  fechaClone.setDate(fechaClone.getDate() + 1);
  
  // Extraer año, mes y día usando los métodos locales
  const año = fechaClone.getFullYear();
  const mes = String(fechaClone.getMonth() + 1).padStart(2, '0');
  const dia = String(fechaClone.getDate()).padStart(2, '0');
  
  // Formato YYYY-MM-DD para la BD
  return `${año}-${mes}-${dia}`;
}

/**
 * Exporta un informe de actividades de un supervisado en formato Excel
 */
export const exportarInformeSupervisado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params; // ID del supervisado
    const { proyecto, fechaInicio, fechaFin, formato = 'excel', agruparPor = 'none', incluirInactivos = 'true' } = req.query;
    
    // Verificar que el usuario autenticado sea un supervisor
    const usuarioId = req.usuario?.id;
    const esSupervisor = req.usuario?.rol === 'supervisor';
    
    if (!usuarioId) {
      res.status(401).json({
        status: 'error',
        message: 'Usuario no autenticado'
      });
      return;
    }
    
    // Validar parámetros
    if (!id) {
      res.status(400).json({
        status: 'error',
        message: 'Se requiere el ID del supervisado'
      });
      return;
    }
    
    // Convertir parámetros
    const incluirInactivosBoolean = incluirInactivos === 'true';
    
    // Generar el informe
    const informe = await generarInformeSupervisado({
      supervisadoId: id,
      supervisorId: usuarioId,
      proyectoId: proyecto as string | undefined,
      fechaInicio: fechaInicio ? new Date(fechaInicio as string) : undefined,
      fechaFin: fechaFin ? new Date(fechaFin as string) : undefined,
      formato: formato as 'excel' | 'csv' | 'pdf',
      agruparPor: agruparPor as 'none' | 'day' | 'week' | 'month',
      incluirInactivos: incluirInactivosBoolean,
      esAdmin: esSupervisor
    });
    
    // Configurar encabezados según el formato
    let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    let extension = 'xlsx';
    
    if (formato === 'csv') {
      contentType = 'text/csv';
      extension = 'csv';
    } else if (formato === 'pdf') {
      contentType = 'application/pdf';
      extension = 'pdf';
    }
    
    // Configurar encabezados de respuesta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=informe_supervisado_${id}_${new Date().toISOString().split('T')[0]}.${extension}`);
    
    // Enviar el archivo
    res.send(informe);
  } catch (error) {
    console.error('Error al exportar informe de supervisado:', error);
    
    // Si es un error controlado, devolver el mensaje específico
    if (error instanceof Error) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Error al exportar informe de supervisado'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Error al exportar informe de supervisado'
      });
    }
  }
};

/**
 * Exporta un informe de actividades por rango de fechas
 */
export const exportarInformePorFechas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fechaInicio, fechaFin, proyecto, formato = 'excel', agruparPor = 'none', incluirInactivos = 'true' } = req.query;
    
    // Verificar que el usuario esté autenticado
    const usuarioId = req.usuario?.id;
    const usuarioRol = req.usuario?.rol;
    
    if (!usuarioId) {
      res.status(401).json({
        status: 'error',
        message: 'Usuario no autenticado'
      });
      return;
    }
    
    console.log(`Usuario autenticado: ${usuarioId}, rol: ${usuarioRol}`);
    
    // Validar parámetros
    if (!fechaInicio || !fechaFin) {
      res.status(400).json({
        status: 'error',
        message: 'Se requiere el rango de fechas'
      });
      return;
    }

    // Convertir y validar fechas
    let fechaInicioDate: Date;
    let fechaFinDate: Date;
    
    try {
      fechaInicioDate = new Date(fechaInicio as string);
      fechaFinDate = new Date(fechaFin as string);
      
      // Validar que las fechas sean válidas
      if (isNaN(fechaInicioDate.getTime()) || isNaN(fechaFinDate.getTime())) {
        throw new Error('Fechas inválidas');
      }
      
      // Validar que la fecha de inicio no sea posterior a la fecha fin
      if (fechaInicioDate > fechaFinDate) {
        throw new Error('La fecha de inicio no puede ser posterior a la fecha fin');
      }

      console.log('Fechas procesadas:', {
        fechaInicio: fechaInicioDate.toISOString(),
        fechaFin: fechaFinDate.toISOString(),
        usuario: usuarioId,
        proyecto: proyecto
      });
      
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: 'Formato de fechas inválido'
      });
      return;
    }
    
    // Convertir parámetros
    const incluirInactivosBoolean = incluirInactivos === 'true';
    
    try {
      // Verificar si es necesario actualizar la fecha de inicio para evitar conflictos con la restricción
      // de fecha en la tabla actividades
      // Si la fecha de inicio es anterior a hoy, intentar buscar de todas formas pero advertir
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      if (fechaInicioDate < hoy) {
        console.log('ADVERTENCIA: La fecha de inicio es anterior a la fecha actual. Esto podría resultar en un conjunto vacío debido a la restricción de la tabla actividades.');
      }
      
      // Generar el informe
      const informe = await generarInformePorFechas({
        usuarioId,
        fechaInicio: fechaInicioDate,
        fechaFin: fechaFinDate,
        proyectoId: proyecto as string | undefined,
        formato: formato as 'excel' | 'csv' | 'pdf',
        agruparPor: agruparPor as 'none' | 'day' | 'week' | 'month',
        incluirInactivos: incluirInactivosBoolean
      });
      
      // Verificar que el informe no sea vacío
      if (!informe || !Buffer.isBuffer(informe) || informe.length === 0) {
        res.status(404).json({
          status: 'error',
          message: 'No se encontraron actividades para el período seleccionado'
        });
        return;
      }
      
      // Verificar tamaño del informe
      console.log(`Tamaño del informe generado: ${informe.length} bytes`);
      
      // Configurar encabezados según el formato
      let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      let extension = 'xlsx';
      
      if (formato === 'csv') {
        contentType = 'text/csv';
        extension = 'csv';
      } else if (formato === 'pdf') {
        contentType = 'application/pdf';
        extension = 'pdf';
      }
      
      // Configurar encabezados de respuesta
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=informe_${fechaInicioDate.toISOString().split('T')[0]}_${fechaFinDate.toISOString().split('T')[0]}.${extension}`);
      
      // Enviar el archivo
      res.send(informe);
    } catch (error) {
      console.error('Error al exportar informe por fechas:', error);
      
      // Si es un error controlado, devolver el mensaje específico
      if (error instanceof Error) {
        if (error.message.includes('no encontraron actividades')) {
          res.status(404).json({
            status: 'error',
            message: error.message
          });
        } else {
          res.status(500).json({
            status: 'error',
            message: error.message || 'Error al exportar informe por fechas'
          });
        }
      } else {
        res.status(500).json({
          status: 'error',
          message: 'Error al exportar informe por fechas'
        });
      }
    }
  } catch (error) {
    console.error('Error general en exportarInformePorFechas:', error);
    
    // Si es un error controlado, devolver el mensaje específico
    if (error instanceof Error) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Error al exportar informe por fechas'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Error al exportar informe por fechas'
      });
    }
  }
};

/**
 * Exporta un informe de actividades por proyecto
 */
export const exportarInformePorProyecto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params; // ID del proyecto
    const { fechaInicio, fechaFin, usuarios, formato = 'excel', agruparPor = 'user', incluirInactivos = 'true' } = req.query;
    
    // Verificar que el usuario esté autenticado
    const usuarioId = req.usuario?.id;
    
    if (!usuarioId) {
      res.status(401).json({
        status: 'error',
        message: 'Usuario no autenticado'
      });
      return;
    }
    
    // Validar parámetros
    if (!id) {
      res.status(400).json({
        status: 'error',
        message: 'Se requiere el ID del proyecto'
      });
      return;
    }
    
    // Procesar parámetros
    const incluirInactivosBoolean = incluirInactivos === 'true';
    
    // Procesar usuarios (pueden llegar como array o como string simple)
    let usuariosArray: string[] = [];
    if (usuarios) {
      if (Array.isArray(usuarios)) {
        usuariosArray = usuarios as string[];
      } else {
        usuariosArray = [usuarios as string];
      }
    }
    
    // Procesar fechas si se proporcionaron
    let fechaInicioDate: Date | undefined;
    let fechaFinDate: Date | undefined;
    
    if (fechaInicio) {
      try {
        fechaInicioDate = new Date(fechaInicio as string);
        if (isNaN(fechaInicioDate.getTime())) {
          throw new Error('Fecha de inicio inválida');
        }
      } catch (error) {
        res.status(400).json({
          status: 'error',
          message: 'Formato de fecha de inicio inválido'
        });
        return;
      }
    }
    
    if (fechaFin) {
      try {
        fechaFinDate = new Date(fechaFin as string);
        if (isNaN(fechaFinDate.getTime())) {
          throw new Error('Fecha de fin inválida');
        }
      } catch (error) {
        res.status(400).json({
          status: 'error',
          message: 'Formato de fecha de fin inválido'
        });
        return;
      }
    }
    
    // Validar rango de fechas si se proporcionaron ambas
    if (fechaInicioDate && fechaFinDate && fechaInicioDate > fechaFinDate) {
      res.status(400).json({
        status: 'error',
        message: 'La fecha de inicio no puede ser posterior a la fecha de fin'
      });
      return;
    }
    
    // Generar el informe
    const informe = await generarInformePorProyecto({
      proyectoId: id,
      usuarioId,
      usuariosIds: usuariosArray.length > 0 ? usuariosArray : undefined,
      fechaInicio: fechaInicioDate,
      fechaFin: fechaFinDate,
      formato: formato as 'excel' | 'csv' | 'pdf',
      agruparPor: agruparPor as 'none' | 'day' | 'week' | 'month' | 'user',
      incluirInactivos: incluirInactivosBoolean
    });
    
    // Configurar encabezados según el formato
    let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    let extension = 'xlsx';
    
    if (formato === 'csv') {
      contentType = 'text/csv';
      extension = 'csv';
    } else if (formato === 'pdf') {
      contentType = 'application/pdf';
      extension = 'pdf';
    }
    
    // Configurar nombre de archivo
    const fechaActual = new Date().toISOString().split('T')[0];
    const nombreArchivo = `informe_proyecto_${id}_${fechaActual}.${extension}`;
    
    // Configurar encabezados de respuesta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${nombreArchivo}`);
    
    // Enviar el archivo
    res.send(informe);
  } catch (error) {
    console.error('Error al exportar informe por proyecto:', error);
    
    // Si es un error controlado, devolver el mensaje específico
    if (error instanceof Error) {
      const codigo = error.message.includes('no encontraron actividades') ? 404 : 500;
      res.status(codigo).json({
        status: 'error',
        message: error.message || 'Error al exportar informe por proyecto'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Error al exportar informe por proyecto'
      });
    }
  }
}; 