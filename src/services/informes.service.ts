import { obtenerUsuarioPorId } from '../models/usuario.model';
import { obtenerActividadesPorRango, obtenerActividadesSupervisados } from '../models/actividad.model';
import { obtenerProyectoPorId } from '../models/proyecto.model';
import { esSupervisadoPor } from '../models/usuario.model';
// Nota: Es necesario instalar la dependencia exceljs con: npm install exceljs
// import ExcelJS from 'exceljs';
// Usamos require para evitar errores de TypeScript mientras se instala la dependencia
const ExcelJS = require('exceljs');
import { Readable } from 'stream';
import { Cell } from 'exceljs';
import supabase from '../config/supabase';

// Interfaces
interface InformeSupervisadoParams {
  supervisadoId: string;
  supervisorId: string;
  proyectoId?: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  formato: 'excel' | 'csv' | 'pdf';
  agruparPor: 'none' | 'day' | 'week' | 'month';
  incluirInactivos: boolean;
  esAdmin: boolean;
}

interface InformePorFechasParams {
  usuarioId: string;
  fechaInicio: Date;
  fechaFin: Date;
  proyectoId?: string;
  formato: 'excel' | 'csv' | 'pdf';
  agruparPor: 'none' | 'day' | 'week' | 'month';
  incluirInactivos: boolean;
}

interface InformePorProyectoParams {
  proyectoId: string;
  usuarioId: string;
  usuariosIds?: string[];
  fechaInicio?: Date;
  fechaFin?: Date;
  formato: 'excel' | 'csv' | 'pdf';
  agruparPor: 'none' | 'day' | 'week' | 'month' | 'user';
  incluirInactivos: boolean;
}

/**
 * Genera un informe de actividades de un supervisado en formato Excel, CSV o PDF
 */
export const generarInformeSupervisado = async (params: InformeSupervisadoParams): Promise<Buffer> => {
  const {
    supervisadoId,
    supervisorId,
    proyectoId,
    fechaInicio,
    fechaFin,
    formato,
    agruparPor,
    incluirInactivos,
    esAdmin
  } = params;

  // Verificar que el usuario sea supervisado por el supervisor
  if (!esAdmin) {
    const esSupervisado = await esSupervisadoPor(supervisadoId, supervisorId);
    if (!esSupervisado) {
      throw new Error('No tienes permisos para acceder a este informe');
    }
  }

  // Obtener información del supervisado
  const supervisado = await obtenerUsuarioPorId(supervisadoId);
  if (!supervisado) {
    throw new Error('Supervisado no encontrado');
  }

  // Obtener información del supervisor
  const supervisor = await obtenerUsuarioPorId(supervisorId);
  if (!supervisor) {
    throw new Error('Supervisor no encontrado');
  }

  // Obtener información del proyecto si se especificó
  let proyecto = null;
  if (proyectoId) {
    proyecto = await obtenerProyectoPorId(proyectoId);
    if (!proyecto) {
      throw new Error('Proyecto no encontrado');
    }

    // Si el proyecto no está activo y no se incluyen inactivos, lanzar error
    if (!proyecto.activo && !incluirInactivos) {
      throw new Error('El proyecto seleccionado está inactivo');
    }
  }

  // Definir fechas por defecto si no se especificaron
  const hoy = new Date();
  const fechaInicioReal = fechaInicio || new Date(hoy.getFullYear(), hoy.getMonth(), 1); // Primer día del mes actual
  const fechaFinReal = fechaFin || hoy;

  // Obtener actividades del supervisado en el rango de fechas
  const actividades = await obtenerActividadesPorRango(
    supervisadoId,
    fechaInicioReal,
    fechaFinReal
  );

  // Agregar logs para depuración
  console.log(`Actividades obtenidas: ${actividades.length}`);
  console.log('Estados de actividades:', actividades.map(a => a.estado));
  
  // Filtrar actividades por proyecto si se especificó y solo incluir actividades enviadas
  const actividadesFiltradas = actividades
    .filter(actividad => {
      // Verificar si la actividad tiene estado y si es 'enviada' o 'enviado'
      const estadoValido = actividad.estado === 'enviado';
      console.log(`Actividad ${actividad.id}: estado=${actividad.estado}, válido=${estadoValido}`);
      return estadoValido;
    })
    .filter(actividad => {
      // Filtrar por proyecto si se especificó
      const proyectoValido = !proyectoId || actividad.id_proyecto === proyectoId;
      console.log(`Actividad ${actividad.id}: proyecto=${actividad.id_proyecto}, proyectoId=${proyectoId}, válido=${proyectoValido}`);
      return proyectoValido;
    });

  console.log(`Actividades filtradas: ${actividadesFiltradas.length}`);

  // Crear un libro de Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Gestión de Actividades';
  workbook.lastModifiedBy = 'Sistema de Gestión de Actividades';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Crear una hoja de trabajo
  const worksheet = workbook.addWorksheet('Informe de Actividades', {
    properties: {
      tabColor: { argb: '4F81BD' }
    },
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.7, right: 0.7,
        top: 0.75, bottom: 0.75,
        header: 0.3, footer: 0.3
      }
    }
  });

  // Definir colores y estilos
  const colorPrimario = '4F81BD'; // Azul corporativo
  const colorSecundario = 'D0D8E8'; // Azul claro
  const colorTerciario = 'E9EDF4'; // Azul muy claro
  const colorTextoOscuro = '333333'; // Casi negro
  const colorTextoClaro = 'FFFFFF'; // Blanco

  // Función para formatear fechas en formato dd/mm/aaaa
  const formatearFecha = (fecha: Date): string => {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  // Título del informe
  const nombreSupervisado = `${supervisado.nombres} ${supervisado.appaterno} ${supervisado.apmaterno}`;
  const nombreProyectoStr = proyecto ? proyecto.nombre : 'Todos los proyectos';
  const periodoStr = `${formatearFecha(fechaInicioReal)} al ${formatearFecha(fechaFinReal)}`;
  
  // Determinar si se debe incluir la columna de proyecto
  const incluirColumnaProyecto = !proyectoId;
  
  // Determinar el número de columnas y el rango de celdas para fusionar
  const numColumnas = incluirColumnaProyecto ? 7 : 6;
  const rangoTitulo = `A1:${String.fromCharCode(64 + numColumnas)}3`; // A1:G3 o A1:F3
  const rangoSubtitulo = `A4:${String.fromCharCode(64 + numColumnas)}4`; // A4:G4 o A4:F4
  
  // Fusionar celdas para el título
  worksheet.mergeCells(rangoTitulo);
  const tituloCell = worksheet.getCell('A1');
  tituloCell.value = 'INFORME DE ACTIVIDADES';
  tituloCell.font = {
    name: 'Calibri',
    size: 24,
    bold: true,
    color: { argb: colorPrimario }
  };
  tituloCell.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };
  tituloCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF' }
  };
  
  // Información del informe
  worksheet.mergeCells(rangoSubtitulo);
  const subtituloCell = worksheet.getCell('A4');
  subtituloCell.value = `Supervisado: ${nombreSupervisado} | Proyecto: ${nombreProyectoStr} | Período: ${periodoStr}`;
  subtituloCell.font = {
    name: 'Calibri',
    size: 12,
    bold: true,
    color: { argb: colorTextoOscuro }
  };
  subtituloCell.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };
  subtituloCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: colorSecundario }
  };
  
  // Información de generación
  worksheet.mergeCells('A5:C5');
  const fechaGeneracionCell = worksheet.getCell('A5');
  fechaGeneracionCell.value = `Fecha de generación: ${formatearFecha(new Date())}`;
  fechaGeneracionCell.font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: colorTextoOscuro }
  };
  
  const rangoGeneradoPor = incluirColumnaProyecto ? 'E5:G5' : 'D5:F5';
  worksheet.mergeCells(rangoGeneradoPor);
  const generadoPorCell = worksheet.getCell(rangoGeneradoPor.split(':')[0]);
  generadoPorCell.value = `Generado por: ${supervisor.nombres} ${supervisor.appaterno}`;
  generadoPorCell.font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: colorTextoOscuro }
  };
  generadoPorCell.alignment = {
    horizontal: 'right'
  };
  
  // Espacio antes de la tabla
  worksheet.addRow([]);
  
  // Configurar encabezados de la tabla
  let headerColumns: string[];
  
  // Incluir columna de proyecto solo si no se especificó un proyecto
  if (incluirColumnaProyecto) {
    headerColumns = ['Fecha', 'Usuario', 'Proyecto', 'Actividad', 'Tipo', 'Horas', 'Comentarios'];
  } else {
    headerColumns = ['Fecha', 'Usuario', 'Actividad', 'Tipo', 'Horas', 'Comentarios'];
  }
  
  const headerRow = worksheet.addRow(headerColumns);
  headerRow.height = 30;
  headerRow.eachCell((cell: Cell) => {
    cell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: colorTextoClaro }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorPrimario }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: colorPrimario } },
      left: { style: 'thin', color: { argb: colorPrimario } },
      bottom: { style: 'thin', color: { argb: colorPrimario } },
      right: { style: 'thin', color: { argb: colorPrimario } }
    };
  });
  
  // Ajustar anchos de columna según si se incluye la columna de proyecto o no
  if (incluirColumnaProyecto) {
    worksheet.columns = [
      { key: 'fecha', width: 15 },
      { key: 'usuario', width: 25 },
      { key: 'proyecto', width: 20 },
      { key: 'actividad', width: 40 },
      { key: 'tipo', width: 15 },
      { key: 'horas', width: 10 },
      { key: 'comentarios', width: 40 }
    ];
  } else {
    worksheet.columns = [
      { key: 'fecha', width: 15 },
      { key: 'usuario', width: 25 },
      { key: 'actividad', width: 40 },
      { key: 'tipo', width: 20 },
      { key: 'horas', width: 10 },
      { key: 'comentarios', width: 40 }
    ];
  }

  // Agrupar actividades según el parámetro agruparPor
  let actividadesAgrupadas = actividadesFiltradas;
  
  if (agruparPor !== 'none') {
    // Implementar lógica de agrupación según agruparPor
    actividadesAgrupadas.sort((a, b) => {
      const fechaA = new Date(a.fecha);
      const fechaB = new Date(b.fecha);
      
      if (agruparPor === 'day') {
        return fechaA.getTime() - fechaB.getTime();
      } else if (agruparPor === 'week') {
        const weekA = getWeekNumber(fechaA);
        const weekB = getWeekNumber(fechaB);
        return weekA - weekB;
      } else if (agruparPor === 'month') {
        const monthA = fechaA.getMonth();
        const monthB = fechaB.getMonth();
        return monthA - monthB;
      }
      
      return 0;
    });
  }

  // Agregar datos a la hoja de trabajo
  let rowIndex = 0;
  for (const actividad of actividadesAgrupadas) {
    // Obtener nombre completo del usuario
    const nombreUsuario = actividad.usuarios ? 
      `${actividad.usuarios.nombres || ''} ${actividad.usuarios.appaterno || ''} ${actividad.usuarios.apmaterno || ''}`.trim() : 
      'Usuario desconocido';
    
    // Preparar los datos de la fila según si se incluye la columna de proyecto o no
    let rowData: any[];
    
    if (incluirColumnaProyecto) {
      rowData = [
        formatearFecha(new Date(actividad.fecha)),
        nombreUsuario,
        actividad.proyectos?.nombre || 'Sin proyecto',
        actividad.descripcion,
        actividad.tipos_actividad?.nombre || 'Sin tipo',
        actividad.horas || calcularHoras(actividad.hora_inicio, actividad.hora_fin),
        actividad.comentarios || ''
      ];
    } else {
      rowData = [
        formatearFecha(new Date(actividad.fecha)),
        nombreUsuario,
        actividad.descripcion,
        'N/A', // Ya que no tenemos tipos_actividad
        actividad.horas || calcularHoras(actividad.hora_inicio, actividad.hora_fin),
        actividad.comentarios || ''
      ];
    }
    
    const dataRow = worksheet.addRow(rowData);
    
    // Aplicar estilos a las filas de datos
    dataRow.eachCell((cell: Cell) => {
      cell.font = {
        name: 'Calibri',
        size: 11,
        color: { argb: colorTextoOscuro }
      };
      cell.alignment = {
        vertical: 'middle',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'DDDDDD' } },
        left: { style: 'thin', color: { argb: 'DDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'DDDDDD' } },
        right: { style: 'thin', color: { argb: 'DDDDDD' } }
      };
    });
    
    // Alternar colores de fondo para las filas
    if (rowIndex % 2 === 0) {
      dataRow.eachCell((cell: Cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorTerciario }
        };
      });
    } else {
      dataRow.eachCell((cell: Cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF' }
        };
      });
    }
    
    // Alineación específica para algunas columnas
    dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // Fecha
    
    // Alineación para la columna de horas (posición varía según si se incluye la columna de proyecto)
    const horasColumnIndex = incluirColumnaProyecto ? 5 : 4;
    dataRow.getCell(horasColumnIndex).alignment = { horizontal: 'center', vertical: 'middle' };
    
    rowIndex++;
  }

  // Agregar resumen al final
  worksheet.addRow([]);
  
  const totalHoras = actividadesAgrupadas.reduce((sum, act) => sum + (act.horas || 0), 0);
  const totalActividades = actividadesAgrupadas.length;
  
  // Sección de resumen - Título
  const rangoResumenTitulo = `A${worksheet.rowCount + 1}:${String.fromCharCode(64 + numColumnas)}${worksheet.rowCount + 1}`;
  worksheet.mergeCells(rangoResumenTitulo);
  const resumenTitleCell = worksheet.getCell(`A${worksheet.rowCount}`);
  resumenTitleCell.value = 'RESUMEN';
  resumenTitleCell.font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: colorTextoClaro }
  };
  resumenTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: colorPrimario }
  };
  resumenTitleCell.alignment = {
    horizontal: 'center',
    vertical: 'middle'
  };
  
  // Crear una fila para el resumen con un diseño más compacto
  const resumenRow = worksheet.addRow(['', '', '', '']);
  resumenRow.height = 30;
  
  // Dividir la fila en dos secciones
  const columnaMedia = Math.ceil(numColumnas / 2);
  
  // Sección izquierda - Total de horas
  worksheet.mergeCells(`A${worksheet.rowCount}:B${worksheet.rowCount}`);
  const horasLabelCell = worksheet.getCell(`A${worksheet.rowCount}`);
  horasLabelCell.value = 'Total de horas:';
  horasLabelCell.font = {
    name: 'Calibri',
    size: 12,
    bold: true,
    color: { argb: colorTextoOscuro }
  };
  horasLabelCell.alignment = {
    horizontal: 'right',
    vertical: 'middle'
  };
  horasLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: colorSecundario }
  };
  horasLabelCell.border = {
    top: { style: 'thin', color: { argb: colorPrimario } },
    left: { style: 'thin', color: { argb: colorPrimario } },
    bottom: { style: 'thin', color: { argb: colorPrimario } },
    right: { style: 'thin', color: { argb: colorPrimario } }
  };
  
  worksheet.mergeCells(`C${worksheet.rowCount}:${String.fromCharCode(64 + columnaMedia)}${worksheet.rowCount}`);
  const horasValueCell = worksheet.getCell(`C${worksheet.rowCount}`);
  horasValueCell.value = totalHoras;
  horasValueCell.font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: colorPrimario }
  };
  horasValueCell.alignment = {
    horizontal: 'center',
    vertical: 'middle'
  };
  horasValueCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF' }
  };
  horasValueCell.border = {
    top: { style: 'thin', color: { argb: colorPrimario } },
    left: { style: 'thin', color: { argb: colorPrimario } },
    bottom: { style: 'thin', color: { argb: colorPrimario } },
    right: { style: 'thin', color: { argb: colorPrimario } }
  };
  
  // Sección derecha - Total de actividades
  const letraInicio = String.fromCharCode(64 + columnaMedia + 1);
  const letraFin = String.fromCharCode(64 + columnaMedia + 2);
  worksheet.mergeCells(`${letraInicio}${worksheet.rowCount}:${letraFin}${worksheet.rowCount}`);
  const actividadesLabelCell = worksheet.getCell(`${letraInicio}${worksheet.rowCount}`);
  actividadesLabelCell.value = 'Total de actividades:';
  actividadesLabelCell.font = {
    name: 'Calibri',
    size: 12,
    bold: true,
    color: { argb: colorTextoOscuro }
  };
  actividadesLabelCell.alignment = {
    horizontal: 'right',
    vertical: 'middle'
  };
  actividadesLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: colorSecundario }
  };
  actividadesLabelCell.border = {
    top: { style: 'thin', color: { argb: colorPrimario } },
    left: { style: 'thin', color: { argb: colorPrimario } },
    bottom: { style: 'thin', color: { argb: colorPrimario } },
    right: { style: 'thin', color: { argb: colorPrimario } }
  };
  
  const letraInicioValor = String.fromCharCode(64 + columnaMedia + 3);
  const letraFinValor = String.fromCharCode(64 + numColumnas);
  worksheet.mergeCells(`${letraInicioValor}${worksheet.rowCount}:${letraFinValor}${worksheet.rowCount}`);
  const actividadesValueCell = worksheet.getCell(`${letraInicioValor}${worksheet.rowCount}`);
  actividadesValueCell.value = totalActividades;
  actividadesValueCell.font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: colorPrimario }
  };
  actividadesValueCell.alignment = {
    horizontal: 'center',
    vertical: 'middle'
  };
  actividadesValueCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF' }
  };
  actividadesValueCell.border = {
    top: { style: 'thin', color: { argb: colorPrimario } },
    left: { style: 'thin', color: { argb: colorPrimario } },
    bottom: { style: 'thin', color: { argb: colorPrimario } },
    right: { style: 'thin', color: { argb: colorPrimario } }
  };
  
  // Agregar pie de página
  worksheet.addRow([]);
  const rangoPiePagina = `A${worksheet.rowCount}:${String.fromCharCode(64 + numColumnas)}${worksheet.rowCount}`;
  worksheet.mergeCells(rangoPiePagina);
  const footerCell = worksheet.getCell(`A${worksheet.rowCount}`);
  footerCell.value = 'Sistema de Gestión de Actividades - Informe generado automáticamente';
  footerCell.font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: '888888' }
  };
  footerCell.alignment = {
    horizontal: 'center'
  };

  // Generar el archivo según el formato solicitado
  let buffer: Buffer;
  
  if (formato === 'csv') {
    buffer = await workbook.csv.writeBuffer() as Buffer;
  } else if (formato === 'pdf') {
    // Para PDF, se podría usar una librería adicional como pdfkit
    // Por ahora, devolvemos Excel como fallback
    buffer = await workbook.xlsx.writeBuffer() as Buffer;
  } else {
    // Excel por defecto
    buffer = await workbook.xlsx.writeBuffer() as Buffer;
  }

  return buffer;
};

// Función auxiliar para obtener el número de semana de una fecha
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

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

// Función auxiliar para calcular horas
function calcularHoras(horaInicio: string, horaFin: string): number {
  try {
    if (!horaInicio || !horaFin) return 0;
    
    // Convertir a minutos desde el inicio del día
    const [inicioHoras, inicioMinutos] = horaInicio.split(':').map(Number);
    const [finHoras, finMinutos] = horaFin.split(':').map(Number);
    
    const inicioTotalMinutos = inicioHoras * 60 + inicioMinutos;
    const finTotalMinutos = finHoras * 60 + finMinutos;
    
    // Calcular diferencia en horas
    const diferenciaMinutos = finTotalMinutos - inicioTotalMinutos;
    return Math.round((diferenciaMinutos / 60) * 100) / 100; // Redondear a 2 decimales
  } catch (error) {
    console.error('Error al calcular horas:', error);
    return 0;
  }
}

/**
 * Genera un informe de actividades por rango de fechas en formato Excel, CSV o PDF
 */
export const generarInformePorFechas = async (params: InformePorFechasParams): Promise<Buffer> => {
  const {
    usuarioId,
    fechaInicio,
    fechaFin,
    proyectoId,
    formato,
    agruparPor,
    incluirInactivos
  } = params;

  console.log('Generando informe por fechas con parámetros:', {
    usuarioId,
    fechaInicio: fechaInicio.toISOString(),
    fechaFin: fechaFin.toISOString(),
    proyectoId,
    formato,
    agruparPor,
    incluirInactivos
  });

  // Obtener información del usuario
  const usuario = await obtenerUsuarioPorId(usuarioId);
  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }

  // Verificar si el usuario es supervisor
  const esSupervisor = usuario.rol === 'supervisor' || usuario.rol === 'admin';
  console.log(`Usuario ${usuarioId} es supervisor: ${esSupervisor}`);

  // Obtener información del proyecto si se especificó
  let proyecto = null;
  if (proyectoId) {
    proyecto = await obtenerProyectoPorId(proyectoId);
    if (!proyecto) {
      throw new Error('Proyecto no encontrado');
    }

    // Si el proyecto no está activo y no se incluyen inactivos, lanzar error
    if (!proyecto.activo && !incluirInactivos) {
      throw new Error('El proyecto seleccionado está inactivo');
    }
  }

  try {
    let actividades = [];

    // Decidir qué tipo de consulta realizar según el rol
    if (esSupervisor) {
      console.log('Obteniendo actividades de supervisados...');
      // Usar la función de actividades de supervisados en lugar de la función por rango
      actividades = await obtenerActividadesSupervisados(
        usuarioId,
        fechaInicio,
        fechaFin,
        undefined, // usuarioId (supervisado) - undefined para traer todos
        proyectoId,
        'enviado' // Solo actividades enviadas
      );
    } else {
      console.log('Obteniendo actividades del usuario...');
      // Si no es supervisor, obtener solo las actividades del usuario
      actividades = await obtenerActividadesPorRango(
        usuarioId,
        fechaInicio,
        fechaFin,
        ['enviado'] // Corregido para usar solo 'enviado', no 'enviada'
      );
    }

    console.log(`Actividades recuperadas antes de filtrar: ${actividades.length}`);

    // Filtrar actividades por proyecto si se especificó
    const actividadesFiltradas = actividades
      .filter(actividad => {
        // Filtrar por proyecto si se especificó
        if (!proyectoId) return true;
        
        const proyectoValido = actividad.id_proyecto === proyectoId;
        if (!proyectoValido) {
          console.log(`Actividad ${actividad.id} excluida por proyecto: actividad.id_proyecto=${actividad.id_proyecto}, proyectoId=${proyectoId}`);
        }
        return proyectoValido;
      });

    // Agregar logs para depuración
    console.log(`Total de actividades obtenidas: ${actividades.length}`);
    console.log(`Total de actividades filtradas: ${actividadesFiltradas.length}`);
    
    if (actividadesFiltradas.length === 0) {
      console.log('No se encontraron actividades que cumplan con los criterios de filtrado.');
      
      if (esSupervisor) {
        console.log('Verificando todos los supervisados disponibles:');
        const { data: supervisados } = await supabase
          .from('usuarios')
          .select('id, nombres, appaterno')
          .eq('id_supervisor', usuarioId);
        
        console.log('Supervisados encontrados:', supervisados?.length || 0);
        if (supervisados && supervisados.length > 0) {
          console.log('Lista de supervisados:', supervisados.map(s => `${s.nombres} ${s.appaterno} (${s.id})`));
        }
      }
    }

    // Crear un libro de Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Gestión de Actividades';
    workbook.lastModifiedBy = 'Sistema de Gestión de Actividades';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Crear una hoja de trabajo
    const worksheet = workbook.addWorksheet('Informe de Actividades', {
      properties: {
        tabColor: { argb: '4F81BD' }
      },
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.7, right: 0.7,
          top: 0.75, bottom: 0.75,
          header: 0.3, footer: 0.3
        }
      }
    });

    // Definir colores y estilos
    const colorPrimario = '4F81BD'; // Azul corporativo
    const colorSecundario = 'D0D8E8'; // Azul claro
    const colorTerciario = 'E9EDF4'; // Azul muy claro
    const colorTextoOscuro = '333333'; // Casi negro
    const colorTextoClaro = 'FFFFFF';

    // Función para formatear fechas en formato dd/mm/aaaa
    const formatearFecha = (fecha: Date): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      return `${dia}/${mes}/${anio}`;
    };

    // Título del informe
    const nombreUsuario = `${usuario.nombres} ${usuario.appaterno} ${usuario.apmaterno}`;
    const nombreProyectoStr = proyecto ? proyecto.nombre : 'Todos los proyectos';
    const periodoStr = `${formatearFecha(fechaInicio)} al ${formatearFecha(fechaFin)}`;
    
    // Determinar si se debe incluir la columna de proyecto
    const incluirColumnaProyecto = !proyectoId;
    
    // Determinar el número de columnas y el rango de celdas para fusionar
    const numColumnas = incluirColumnaProyecto ? 7 : 6;
    const rangoTitulo = `A1:${String.fromCharCode(64 + numColumnas)}3`; // A1:G3 o A1:F3
    const rangoSubtitulo = `A4:${String.fromCharCode(64 + numColumnas)}4`; // A4:G4 o A4:F4
    
    // Fusionar celdas para el título
    worksheet.mergeCells(rangoTitulo);
    const tituloCell = worksheet.getCell('A1');
    tituloCell.value = 'INFORME DE ACTIVIDADES POR FECHAS';
    tituloCell.font = {
      name: 'Calibri',
      size: 24,
      bold: true,
      color: { argb: colorPrimario }
    };
    tituloCell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
    tituloCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF' }
    };
    
    // Información del informe
    worksheet.mergeCells(rangoSubtitulo);
    const subtituloCell = worksheet.getCell('A4');
    subtituloCell.value = `Usuario: ${nombreUsuario} | Proyecto: ${nombreProyectoStr} | Período: ${periodoStr}`;
    subtituloCell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: colorTextoOscuro }
    };
    subtituloCell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
    subtituloCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorSecundario }
    };
    
    // Información de generación
    worksheet.mergeCells('A5:C5');
    const fechaGeneracionCell = worksheet.getCell('A5');
    fechaGeneracionCell.value = `Fecha de generación: ${formatearFecha(new Date())}`;
    fechaGeneracionCell.font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: colorTextoOscuro }
    };
    
    // Espacio antes de la tabla
    worksheet.addRow([]);
    
    // Configurar encabezados de la tabla
    let headerColumns: string[];
    
    // Incluir columna de proyecto solo si no se especificó un proyecto
    if (incluirColumnaProyecto) {
      headerColumns = ['Fecha', 'Usuario', 'Proyecto', 'Actividad', 'Tipo', 'Horas', 'Comentarios'];
    } else {
      headerColumns = ['Fecha', 'Usuario', 'Actividad', 'Tipo', 'Horas', 'Comentarios'];
    }
    
    const headerRow = worksheet.addRow(headerColumns);
    headerRow.height = 30;
    headerRow.eachCell((cell: Cell) => {
      cell.font = {
        name: 'Calibri',
        size: 12,
        bold: true,
        color: { argb: colorTextoClaro }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colorPrimario }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: colorPrimario } },
        left: { style: 'thin', color: { argb: colorPrimario } },
        bottom: { style: 'thin', color: { argb: colorPrimario } },
        right: { style: 'thin', color: { argb: colorPrimario } }
      };
    });
    
    // Ajustar anchos de columna según si se incluye la columna de proyecto o no
    if (incluirColumnaProyecto) {
      worksheet.columns = [
        { key: 'fecha', width: 15 },
        { key: 'usuario', width: 25 },
        { key: 'proyecto', width: 20 },
        { key: 'actividad', width: 40 },
        { key: 'tipo', width: 15 },
        { key: 'horas', width: 10 },
        { key: 'comentarios', width: 40 }
      ];
    } else {
      worksheet.columns = [
        { key: 'fecha', width: 15 },
        { key: 'usuario', width: 25 },
        { key: 'actividad', width: 40 },
        { key: 'tipo', width: 20 },
        { key: 'horas', width: 10 },
        { key: 'comentarios', width: 40 }
      ];
    }

    // Agrupar actividades según el parámetro agruparPor
    let actividadesAgrupadas = actividadesFiltradas;
    
    if (agruparPor !== 'none') {
      // Implementar lógica de agrupación según agruparPor
      actividadesAgrupadas.sort((a, b) => {
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        
        if (agruparPor === 'day') {
          return fechaA.getTime() - fechaB.getTime();
        } else if (agruparPor === 'week') {
          const weekA = getWeekNumber(fechaA);
          const weekB = getWeekNumber(fechaB);
          return weekA - weekB;
        } else if (agruparPor === 'month') {
          const monthA = fechaA.getMonth();
          const monthB = fechaB.getMonth();
          return monthA - monthB;
        }
        
        return 0;
      });
    }

    // Agregar datos a la hoja de trabajo
    let rowIndex = 0;
    for (const actividad of actividadesAgrupadas) {
      // Obtener nombre completo del usuario
      const nombreUsuario = actividad.usuarios ? 
        `${actividad.usuarios.nombres || ''} ${actividad.usuarios.appaterno || ''} ${actividad.usuarios.apmaterno || ''}`.trim() : 
        'Usuario desconocido';
      
      // Preparar los datos de la fila según si se incluye la columna de proyecto o no
      let rowData: any[];
      
      if (incluirColumnaProyecto) {
        rowData = [
          formatearFecha(new Date(actividad.fecha)),
          nombreUsuario,
          actividad.proyectos?.nombre || 'Sin proyecto',
          actividad.descripcion,
          actividad.tipos_actividad?.nombre || 'Sin tipo',
          actividad.horas || calcularHoras(actividad.hora_inicio, actividad.hora_fin),
          actividad.comentarios || ''
        ];
      } else {
        rowData = [
          formatearFecha(new Date(actividad.fecha)),
          nombreUsuario,
          actividad.descripcion,
          'N/A', // Ya que no tenemos tipos_actividad
          actividad.horas || calcularHoras(actividad.hora_inicio, actividad.hora_fin),
          actividad.comentarios || ''
        ];
      }
      
      const dataRow = worksheet.addRow(rowData);
      
      // Aplicar estilos a las filas de datos
      dataRow.eachCell((cell: Cell) => {
        cell.font = {
          name: 'Calibri',
          size: 11,
          color: { argb: colorTextoOscuro }
        };
        cell.alignment = {
          vertical: 'middle',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'DDDDDD' } },
          left: { style: 'thin', color: { argb: 'DDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'DDDDDD' } },
          right: { style: 'thin', color: { argb: 'DDDDDD' } }
        };
      });
      
      // Alternar colores de fondo para las filas
      if (rowIndex % 2 === 0) {
        dataRow.eachCell((cell: Cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorTerciario }
          };
        });
      } else {
        dataRow.eachCell((cell: Cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF' }
          };
        });
      }
      
      // Alineación específica para algunas columnas
      dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // Fecha
      
      // Alineación para la columna de horas (posición varía según si se incluye la columna de proyecto)
      const horasColumnIndex = incluirColumnaProyecto ? 5 : 4;
      dataRow.getCell(horasColumnIndex).alignment = { horizontal: 'center', vertical: 'middle' };
      
      rowIndex++;
    }

    // Agregar resumen al final
    worksheet.addRow([]);
    
    const totalHoras = actividadesAgrupadas.reduce((sum, act) => sum + (act.horas || 0), 0);
    const totalActividades = actividadesAgrupadas.length;
    
    // Sección de resumen - Título
    const rangoResumenTitulo = `A${worksheet.rowCount + 1}:${String.fromCharCode(64 + numColumnas)}${worksheet.rowCount + 1}`;
    worksheet.mergeCells(rangoResumenTitulo);
    const resumenTitleCell = worksheet.getCell(`A${worksheet.rowCount}`);
    resumenTitleCell.value = 'RESUMEN';
    resumenTitleCell.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: colorTextoClaro }
    };
    resumenTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorPrimario }
    };
    resumenTitleCell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };
    
    // Crear una fila para el resumen con un diseño más compacto
    const resumenRow = worksheet.addRow(['', '', '', '']);
    resumenRow.height = 30;
    
    // Dividir la fila en dos secciones
    const columnaMedia = Math.ceil(numColumnas / 2);
    
    // Sección izquierda - Total de horas
    worksheet.mergeCells(`A${worksheet.rowCount}:B${worksheet.rowCount}`);
    const horasLabelCell = worksheet.getCell(`A${worksheet.rowCount}`);
    horasLabelCell.value = 'Total de horas:';
    horasLabelCell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: colorTextoOscuro }
    };
    horasLabelCell.alignment = {
      horizontal: 'right',
      vertical: 'middle'
    };
    horasLabelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorSecundario }
    };
    horasLabelCell.border = {
      top: { style: 'thin', color: { argb: colorPrimario } },
      left: { style: 'thin', color: { argb: colorPrimario } },
      bottom: { style: 'thin', color: { argb: colorPrimario } },
      right: { style: 'thin', color: { argb: colorPrimario } }
    };
    
    worksheet.mergeCells(`C${worksheet.rowCount}:${String.fromCharCode(64 + columnaMedia)}${worksheet.rowCount}`);
    const horasValueCell = worksheet.getCell(`C${worksheet.rowCount}`);
    horasValueCell.value = totalHoras;
    horasValueCell.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: colorPrimario }
    };
    horasValueCell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };
    horasValueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF' }
    };
    horasValueCell.border = {
      top: { style: 'thin', color: { argb: colorPrimario } },
      left: { style: 'thin', color: { argb: colorPrimario } },
      bottom: { style: 'thin', color: { argb: colorPrimario } },
      right: { style: 'thin', color: { argb: colorPrimario } }
    };
    
    // Sección derecha - Total de actividades
    const letraInicio = String.fromCharCode(64 + columnaMedia + 1);
    const letraFin = String.fromCharCode(64 + columnaMedia + 2);
    worksheet.mergeCells(`${letraInicio}${worksheet.rowCount}:${letraFin}${worksheet.rowCount}`);
    const actividadesLabelCell = worksheet.getCell(`${letraInicio}${worksheet.rowCount}`);
    actividadesLabelCell.value = 'Total de actividades:';
    actividadesLabelCell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: colorTextoOscuro }
    };
    actividadesLabelCell.alignment = {
      horizontal: 'right',
      vertical: 'middle'
    };
    actividadesLabelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorSecundario }
    };
    actividadesLabelCell.border = {
      top: { style: 'thin', color: { argb: colorPrimario } },
      left: { style: 'thin', color: { argb: colorPrimario } },
      bottom: { style: 'thin', color: { argb: colorPrimario } },
      right: { style: 'thin', color: { argb: colorPrimario } }
    };
    
    const letraInicioValor = String.fromCharCode(64 + columnaMedia + 3);
    const letraFinValor = String.fromCharCode(64 + numColumnas);
    worksheet.mergeCells(`${letraInicioValor}${worksheet.rowCount}:${letraFinValor}${worksheet.rowCount}`);
    const actividadesValueCell = worksheet.getCell(`${letraInicioValor}${worksheet.rowCount}`);
    actividadesValueCell.value = totalActividades;
    actividadesValueCell.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: colorPrimario }
    };
    actividadesValueCell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };
    actividadesValueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF' }
    };
    actividadesValueCell.border = {
      top: { style: 'thin', color: { argb: colorPrimario } },
      left: { style: 'thin', color: { argb: colorPrimario } },
      bottom: { style: 'thin', color: { argb: colorPrimario } },
      right: { style: 'thin', color: { argb: colorPrimario } }
    };
    
    // Agregar pie de página
    worksheet.addRow([]);
    const rangoPiePagina = `A${worksheet.rowCount}:${String.fromCharCode(64 + numColumnas)}${worksheet.rowCount}`;
    worksheet.mergeCells(rangoPiePagina);
    const footerCell = worksheet.getCell(`A${worksheet.rowCount}`);
    footerCell.value = 'Sistema de Gestión de Actividades - Informe generado automáticamente';
    footerCell.font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: '888888' }
    };
    footerCell.alignment = {
      horizontal: 'center'
    };

    // Generar el archivo según el formato solicitado
    let buffer: Buffer;
    
    if (formato === 'csv') {
      buffer = await workbook.csv.writeBuffer();
    } else if (formato === 'pdf') {
      // Implementar generación de PDF si se requiere
      throw new Error('Formato PDF no implementado');
    } else {
      buffer = await workbook.xlsx.writeBuffer();
    }
    
    return buffer;
  } catch (error) {
    console.error('Error al generar el informe:', error);
    throw error;
  }
};

/**
 * Genera un informe de actividades por proyecto en formato Excel, CSV o PDF
 */
export const generarInformePorProyecto = async (params: InformePorProyectoParams): Promise<Buffer> => {
  const {
    proyectoId,
    usuarioId,
    usuariosIds,
    fechaInicio,
    fechaFin,
    formato,
    agruparPor,
    incluirInactivos
  } = params;

  console.log('Generando informe por proyecto con parámetros:', {
    proyectoId,
    usuarioId,
    usuariosIds: usuariosIds?.length,
    fechaInicio: fechaInicio?.toISOString(),
    fechaFin: fechaFin?.toISOString(),
    formato,
    agruparPor,
    incluirInactivos
  });

  // Obtener información del usuario solicitante
  const usuario = await obtenerUsuarioPorId(usuarioId);
  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }

  // Verificar si el usuario es supervisor
  const esSupervisor = usuario.rol === 'supervisor' || usuario.rol === 'admin';
  console.log(`Usuario ${usuarioId} es supervisor: ${esSupervisor}`);

  // Obtener información del proyecto
  const proyecto = await obtenerProyectoPorId(proyectoId);
  if (!proyecto) {
    throw new Error('Proyecto no encontrado');
  }

  // Si el proyecto no está activo y no se incluyen inactivos, lanzar error
  if (!proyecto.activo && !incluirInactivos) {
    throw new Error('El proyecto seleccionado está inactivo');
  }

  try {
    // Verificar si el usuario tiene acceso a este proyecto
    // (implementar en una función futura si es necesaria una validación más estricta)

    // Consultar actividades del proyecto según los filtros
    let query = supabase
      .from('actividades')
      .select(`
        *,
        usuarios:id_usuario (id, nombres, appaterno, apmaterno, email),
        proyectos:id_proyecto (id, nombre, descripcion)
      `)
      .eq('id_proyecto', proyectoId)
      .eq('estado', 'enviado')
      .order('fecha', { ascending: false });

    // Aplicar filtro de usuarios si se especificaron
    if (usuariosIds && usuariosIds.length > 0) {
      query = query.in('id_usuario', usuariosIds);
    }

    // Aplicar filtro de fechas si se especificaron
    if (fechaInicio) {
      query = query.gte('fecha', formatearFechaParaDB(fechaInicio));
    }
    if (fechaFin) {
      query = query.lte('fecha', formatearFechaParaDB(fechaFin));
    }

    const { data: actividades, error } = await query;

    if (error) {
      console.error('Error al obtener actividades del proyecto:', error);
      throw new Error('Error al obtener actividades del proyecto');
    }

    console.log(`Total de actividades obtenidas: ${actividades?.length || 0}`);
    
    if (!actividades || actividades.length === 0) {
      console.log('No se encontraron actividades que cumplan con los criterios de filtrado.');
      throw new Error('No se encontraron actividades para el proyecto con los filtros seleccionados');
    }

    // Crear un libro de Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Gestión de Actividades';
    workbook.lastModifiedBy = 'Sistema de Gestión de Actividades';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Crear una hoja de trabajo
    const worksheet = workbook.addWorksheet('Informe del Proyecto', {
      properties: {
        tabColor: { argb: '4F81BD' }
      },
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.7, right: 0.7,
          top: 0.75, bottom: 0.75,
          header: 0.3, footer: 0.3
        }
      }
    });

    // Definir colores y estilos
    const colorPrimario = '4F81BD'; // Azul corporativo
    const colorSecundario = 'D0D8E8'; // Azul claro
    const colorTerciario = 'E9EDF4'; // Azul muy claro
    const colorTextoOscuro = '333333'; // Casi negro
    const colorTextoClaro = 'FFFFFF';

    // Función para formatear fechas en formato dd/mm/aaaa
    const formatearFecha = (fecha: Date): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      return `${dia}/${mes}/${anio}`;
    };

    // Definir el período del informe
    const periodoStr = fechaInicio && fechaFin
      ? `${formatearFecha(fechaInicio)} al ${formatearFecha(fechaFin)}`
      : 'Todo el período';
    
    // Definir el número de columnas para encabezados fusionados
    const numColumnas = 7;
    const rangoTitulo = `A1:${String.fromCharCode(64 + numColumnas)}3`; // A1:G3
    const rangoSubtitulo = `A4:${String.fromCharCode(64 + numColumnas)}4`; // A4:G4
    
    // Fusionar celdas para el título
    worksheet.mergeCells(rangoTitulo);
    const tituloCell = worksheet.getCell('A1');
    tituloCell.value = 'INFORME DE PROYECTO';
    tituloCell.font = {
      name: 'Calibri',
      size: 24,
      bold: true,
      color: { argb: colorPrimario }
    };
    tituloCell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
    tituloCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF' }
    };
    
    // Información del informe
    worksheet.mergeCells(rangoSubtitulo);
    const subtituloCell = worksheet.getCell('A4');
    subtituloCell.value = `Proyecto: ${proyecto.nombre} | Período: ${periodoStr}`;
    subtituloCell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: colorTextoOscuro }
    };
    subtituloCell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
    subtituloCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorSecundario }
    };
    
    // Información de generación
    worksheet.mergeCells('A5:C5');
    const fechaGeneracionCell = worksheet.getCell('A5');
    fechaGeneracionCell.value = `Fecha de generación: ${formatearFecha(new Date())}`;
    fechaGeneracionCell.font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: colorTextoOscuro }
    };
    
    worksheet.mergeCells('E5:G5');
    const generadoPorCell = worksheet.getCell('E5');
    generadoPorCell.value = `Generado por: ${usuario.nombres} ${usuario.appaterno}`;
    generadoPorCell.font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: colorTextoOscuro }
    };
    generadoPorCell.alignment = {
      horizontal: 'right'
    };
    
    // Espacio antes de la tabla
    worksheet.addRow([]);
    
    // Configurar encabezados de la tabla
    const headerColumns = ['Fecha', 'Usuario', 'Actividad', 'Tipo', 'Horas', 'Estado', 'Comentarios'];
    
    const headerRow = worksheet.addRow(headerColumns);
    headerRow.height = 30;
    headerRow.eachCell((cell: Cell) => {
      cell.font = {
        name: 'Calibri',
        size: 12,
        bold: true,
        color: { argb: colorTextoClaro }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colorPrimario }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: colorPrimario } },
        left: { style: 'thin', color: { argb: colorPrimario } },
        bottom: { style: 'thin', color: { argb: colorPrimario } },
        right: { style: 'thin', color: { argb: colorPrimario } }
      };
    });
    
    // Ajustar anchos de columna
    worksheet.columns = [
      { key: 'fecha', width: 15 },
      { key: 'usuario', width: 25 },
      { key: 'actividad', width: 40 },
      { key: 'tipo', width: 15 },
      { key: 'horas', width: 10 },
      { key: 'estado', width: 15 },
      { key: 'comentarios', width: 40 }
    ];

    // Agrupar actividades según el parámetro agruparPor
    let actividadesAgrupadas = [...actividades];
    
    if (agruparPor !== 'none') {
      if (agruparPor === 'user') {
        // Agrupar por usuario
        actividadesAgrupadas.sort((a, b) => {
          const usuarioA = a.usuarios ? `${a.usuarios.nombres} ${a.usuarios.appaterno}` : '';
          const usuarioB = b.usuarios ? `${b.usuarios.nombres} ${b.usuarios.appaterno}` : '';
          return usuarioA.localeCompare(usuarioB);
        });
      } else if (agruparPor === 'day') {
        // Agrupar por día
        actividadesAgrupadas.sort((a, b) => {
          const fechaA = new Date(a.fecha);
          const fechaB = new Date(b.fecha);
          return fechaA.getTime() - fechaB.getTime();
        });
      } else if (agruparPor === 'week') {
        // Agrupar por semana
        actividadesAgrupadas.sort((a, b) => {
          const fechaA = new Date(a.fecha);
          const fechaB = new Date(b.fecha);
          const weekA = getWeekNumber(fechaA);
          const weekB = getWeekNumber(fechaB);
          return weekA - weekB;
        });
      } else if (agruparPor === 'month') {
        // Agrupar por mes
        actividadesAgrupadas.sort((a, b) => {
          const fechaA = new Date(a.fecha);
          const fechaB = new Date(b.fecha);
          const monthA = fechaA.getMonth() + fechaA.getFullYear() * 12;
          const monthB = fechaB.getMonth() + fechaB.getFullYear() * 12;
          return monthA - monthB;
        });
      }
    }

    // Función para obtener el valor de agrupación de una actividad
    const getValorAgrupacion = (actividad: any): string => {
      if (agruparPor === 'user') {
        return actividad.usuarios ? `${actividad.usuarios.nombres} ${actividad.usuarios.appaterno}` : 'Sin usuario';
      } else if (agruparPor === 'day') {
        return formatearFecha(new Date(actividad.fecha));
      } else if (agruparPor === 'week') {
        const fecha = new Date(actividad.fecha);
        const weekNumber = getWeekNumber(fecha);
        const year = fecha.getFullYear();
        return `Semana ${weekNumber}, ${year}`;
      } else if (agruparPor === 'month') {
        const fecha = new Date(actividad.fecha);
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
      }
      return '';
    };

    // Agregar datos a la hoja de trabajo
    let rowIndex = 0;
    let grupoActual = '';
    
    for (const actividad of actividadesAgrupadas) {
      // Verificar si se debe agregar una cabecera de grupo
      if (agruparPor !== 'none') {
        const valorGrupo = getValorAgrupacion(actividad);
        if (valorGrupo !== grupoActual) {
          grupoActual = valorGrupo;
          // Agregar fila de grupo
          worksheet.addRow([]);
          const rangoGrupo = `A${worksheet.rowCount}:${String.fromCharCode(64 + numColumnas)}${worksheet.rowCount}`;
          worksheet.mergeCells(rangoGrupo);
          const grupoCell = worksheet.getCell(`A${worksheet.rowCount}`);
          grupoCell.value = grupoActual;
          grupoCell.font = {
            name: 'Calibri',
            size: 12,
            bold: true,
            color: { argb: colorTextoOscuro }
          };
          grupoCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorSecundario }
          };
          grupoCell.alignment = {
            horizontal: 'left',
            vertical: 'middle'
          };
        }
      }
      
      // Obtener nombre completo del usuario
      const nombreUsuario = actividad.usuarios ? 
        `${actividad.usuarios.nombres || ''} ${actividad.usuarios.appaterno || ''} ${actividad.usuarios.apmaterno || ''}`.trim() : 
        'Usuario desconocido';
      
      // Obtener estado legible
      const estadoLegible = (() => {
        switch(actividad.estado) {
          case 'enviado': return 'Enviado';
          case 'borrador': return 'Borrador';
          case 'rechazado': return 'Rechazado';
          case 'aprobado': return 'Aprobado';
          default: return actividad.estado || 'Desconocido';
        }
      })();
      
      // Preparar los datos de la fila
      const rowData = [
        formatearFecha(new Date(actividad.fecha)),
        nombreUsuario,
        actividad.descripcion,
        'N/A', // Ya que no tenemos tipos_actividad
        actividad.horas || calcularHoras(actividad.hora_inicio, actividad.hora_fin),
        estadoLegible,
        actividad.comentarios || ''
      ];
      
      const dataRow = worksheet.addRow(rowData);
      
      // Aplicar estilos a las filas de datos
      dataRow.eachCell((cell: Cell) => {
        cell.font = {
          name: 'Calibri',
          size: 11,
          color: { argb: colorTextoOscuro }
        };
        cell.alignment = {
          vertical: 'middle',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'DDDDDD' } },
          left: { style: 'thin', color: { argb: 'DDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'DDDDDD' } },
          right: { style: 'thin', color: { argb: 'DDDDDD' } }
        };
      });
      
      // Alternar colores de fondo para las filas
      if (rowIndex % 2 === 0) {
        dataRow.eachCell((cell: Cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorTerciario }
          };
        });
      } else {
        dataRow.eachCell((cell: Cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF' }
          };
        });
      }
      
      // Alineación específica para algunas columnas
      dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // Fecha
      dataRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }; // Horas
      dataRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }; // Estado
      
      rowIndex++;
    }

    // Agregar resumen al final
    worksheet.addRow([]);
    
    const totalHoras = actividadesAgrupadas.reduce((sum, act) => {
      const horas = act.horas || calcularHoras(act.hora_inicio, act.hora_fin);
      return sum + (parseFloat(horas) || 0);
    }, 0);
    const totalActividades = actividadesAgrupadas.length;
    
    // Sección de resumen - Título
    const rangoResumenTitulo = `A${worksheet.rowCount + 1}:${String.fromCharCode(64 + numColumnas)}${worksheet.rowCount + 1}`;
    worksheet.mergeCells(rangoResumenTitulo);
    const resumenTitleCell = worksheet.getCell(`A${worksheet.rowCount}`);
    resumenTitleCell.value = 'RESUMEN';
    resumenTitleCell.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: colorTextoClaro }
    };
    resumenTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorPrimario }
    };
    resumenTitleCell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };
    
    // Crear una fila para el resumen con un diseño más compacto
    const resumenRow = worksheet.addRow(['', '', '', '']);
    resumenRow.height = 30;
    
    // Dividir la fila en dos secciones
    const columnaMedia = Math.ceil(numColumnas / 2);
    
    // Sección izquierda - Total de horas
    worksheet.mergeCells(`A${worksheet.rowCount}:B${worksheet.rowCount}`);
    const horasLabelCell = worksheet.getCell(`A${worksheet.rowCount}`);
    horasLabelCell.value = 'Total de horas:';
    horasLabelCell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: colorTextoOscuro }
    };
    horasLabelCell.alignment = {
      horizontal: 'right',
      vertical: 'middle'
    };
    horasLabelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorSecundario }
    };
    horasLabelCell.border = {
      top: { style: 'thin', color: { argb: colorPrimario } },
      left: { style: 'thin', color: { argb: colorPrimario } },
      bottom: { style: 'thin', color: { argb: colorPrimario } },
      right: { style: 'thin', color: { argb: colorPrimario } }
    };
    
    worksheet.mergeCells(`C${worksheet.rowCount}:${String.fromCharCode(64 + columnaMedia)}${worksheet.rowCount}`);
    const horasValueCell = worksheet.getCell(`C${worksheet.rowCount}`);
    horasValueCell.value = totalHoras;
    horasValueCell.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: colorPrimario }
    };
    horasValueCell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };
    horasValueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF' }
    };
    horasValueCell.border = {
      top: { style: 'thin', color: { argb: colorPrimario } },
      left: { style: 'thin', color: { argb: colorPrimario } },
      bottom: { style: 'thin', color: { argb: colorPrimario } },
      right: { style: 'thin', color: { argb: colorPrimario } }
    };
    
    // Sección derecha - Total de actividades
    const letraInicio = String.fromCharCode(64 + columnaMedia + 1);
    const letraFin = String.fromCharCode(64 + columnaMedia + 2);
    worksheet.mergeCells(`${letraInicio}${worksheet.rowCount}:${letraFin}${worksheet.rowCount}`);
    const actividadesLabelCell = worksheet.getCell(`${letraInicio}${worksheet.rowCount}`);
    actividadesLabelCell.value = 'Total de actividades:';
    actividadesLabelCell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: colorTextoOscuro }
    };
    actividadesLabelCell.alignment = {
      horizontal: 'right',
      vertical: 'middle'
    };
    actividadesLabelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorSecundario }
    };
    actividadesLabelCell.border = {
      top: { style: 'thin', color: { argb: colorPrimario } },
      left: { style: 'thin', color: { argb: colorPrimario } },
      bottom: { style: 'thin', color: { argb: colorPrimario } },
      right: { style: 'thin', color: { argb: colorPrimario } }
    };
    
    const letraInicioValor = String.fromCharCode(64 + columnaMedia + 3);
    const letraFinValor = String.fromCharCode(64 + numColumnas);
    worksheet.mergeCells(`${letraInicioValor}${worksheet.rowCount}:${letraFinValor}${worksheet.rowCount}`);
    const actividadesValueCell = worksheet.getCell(`${letraInicioValor}${worksheet.rowCount}`);
    actividadesValueCell.value = totalActividades;
    actividadesValueCell.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: colorPrimario }
    };
    actividadesValueCell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };
    actividadesValueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF' }
    };
    actividadesValueCell.border = {
      top: { style: 'thin', color: { argb: colorPrimario } },
      left: { style: 'thin', color: { argb: colorPrimario } },
      bottom: { style: 'thin', color: { argb: colorPrimario } },
      right: { style: 'thin', color: { argb: colorPrimario } }
    };
    
    // Agregar pie de página
    worksheet.addRow([]);
    const rangoPiePagina = `A${worksheet.rowCount}:${String.fromCharCode(64 + numColumnas)}${worksheet.rowCount}`;
    worksheet.mergeCells(rangoPiePagina);
    const footerCell = worksheet.getCell(`A${worksheet.rowCount}`);
    footerCell.value = 'Sistema de Gestión de Actividades - Informe generado automáticamente';
    footerCell.font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: '888888' }
    };
    footerCell.alignment = {
      horizontal: 'center'
    };

    // Generar el archivo según el formato solicitado
    let buffer: Buffer;
    
    if (formato === 'csv') {
      buffer = await workbook.csv.writeBuffer();
    } else if (formato === 'pdf') {
      // Implementar generación de PDF si se requiere
      throw new Error('Formato PDF no implementado');
    } else {
      buffer = await workbook.xlsx.writeBuffer();
    }
    
    return buffer;
  } catch (error) {
    console.error('Error al generar el informe por proyecto:', error);
    throw error;
  }
}; 