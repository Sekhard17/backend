import { Request, Response, NextFunction, RequestHandler } from 'express';
import RexService from '../services/rex.service';

// Obtener supervisados actuales
export const getSupervisadosActuales: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const rutSupervisor = req.params.rut;
        
        if (!rutSupervisor) {
            res.status(400).json({ message: 'Se requiere el RUT del supervisor' });
            return;
        }

        const supervisados = await RexService.obtenerSupervisadosActuales(rutSupervisor);
        res.json(supervisados);
    } catch (error: any) {
        console.error('Error al obtener supervisados:', error);
        res.status(500).json({ message: error.message || 'Error al obtener supervisados' });
    }
};

// Obtener histórico de supervisados
export const getHistoricoSupervisados: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const rutSupervisor = req.params.rut;
        const { fechaInicio, fechaFin } = req.query;

        if (!rutSupervisor) {
            res.status(400).json({ message: 'Se requiere el RUT del supervisor' });
            return;
        }

        const historico = await RexService.obtenerHistoricoSupervisados(
            rutSupervisor,
            fechaInicio ? new Date(fechaInicio as string) : undefined,
            fechaFin ? new Date(fechaFin as string) : undefined
        );

        res.json(historico);
    } catch (error: any) {
        console.error('Error al obtener histórico de supervisados:', error);
        res.status(500).json({ message: error.message || 'Error al obtener histórico de supervisados' });
    }
};

// Sincronizar empleado con REX
export const sincronizarEmpleado: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { rut } = req.params;

        if (!rut) {
            res.status(400).json({ message: 'Se requiere el RUT del empleado' });
            return;
        }

        await RexService.sincronizarEmpleado(rut);
        res.json({ message: 'Empleado sincronizado exitosamente' });
    } catch (error: any) {
        console.error('Error al sincronizar empleado:', error);
        res.status(500).json({ message: error.message || 'Error al sincronizar empleado' });
    }
};

// Obtener todos los cargos
export const getCargos: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const cargos = await RexService.obtenerCargos();
        res.json(cargos);
    } catch (error: any) {
        console.error('Error al obtener cargos:', error);
        res.status(500).json({ message: error.message || 'Error al obtener cargos' });
    }
};

// Obtener un cargo específico por su código
export const getCargoPorCodigo: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const codigo = req.params.codigo;
        
        if (!codigo) {
            res.status(400).json({ message: 'Se requiere el código del cargo' });
            return;
        }

        const cargo = await RexService.obtenerCargoPorCodigo(codigo);
        
        if (!cargo) {
            res.status(404).json({ message: 'Cargo no encontrado' });
            return;
        }

        res.json(cargo);
    } catch (error: any) {
        console.error('Error al obtener cargo por código:', error);
        res.status(500).json({ message: error.message || 'Error al obtener cargo por código' });
    }
};

// Obtener todos los empleados
export const getEmpleados: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { activo, empresa_id } = req.query;
        
        const filtros: { activo?: boolean, empresaId?: string } = {};
        
        if (activo !== undefined) {
            filtros.activo = activo === 'true';
        }
        
        if (empresa_id) {
            filtros.empresaId = empresa_id as string;
        }

        const empleados = await RexService.obtenerEmpleados(filtros);
        res.json(empleados);
    } catch (error: any) {
        console.error('Error al obtener empleados:', error);
        res.status(500).json({ message: error.message || 'Error al obtener empleados' });
    }
};

// Obtener un empleado específico por su RUT
export const getEmpleadoPorRut: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const rut = req.params.rut;
        
        if (!rut) {
            res.status(400).json({ message: 'Se requiere el RUT del empleado' });
            return;
        }

        const empleado = await RexService.obtenerEmpleadoPorRut(rut);
        
        if (!empleado) {
            res.status(404).json({ message: 'Empleado no encontrado' });
            return;
        }

        res.json(empleado);
    } catch (error: any) {
        console.error('Error al obtener empleado por RUT:', error);
        res.status(500).json({ message: error.message || 'Error al obtener empleado por RUT' });
    }
};

// Obtener contratos de un empleado
export const getContratosEmpleado: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const rut = req.params.rut;
        const soloActivos = req.query.activos === 'true';
        
        if (!rut) {
            res.status(400).json({ message: 'Se requiere el RUT del empleado' });
            return;
        }

        const contratos = await RexService.obtenerContratosEmpleado(rut, soloActivos);
        res.json(contratos);
    } catch (error: any) {
        console.error('Error al obtener contratos del empleado:', error);
        res.status(500).json({ message: error.message || 'Error al obtener contratos del empleado' });
    }
}; 