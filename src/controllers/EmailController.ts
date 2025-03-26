import { Request, Response } from 'express';
import { emailService } from '../services/EmailService';

export class EmailController {
  public static async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const { to, subject, message, title, actionUrl, actionText } = req.body;

      await emailService.sendEmail({
        to,
        subject,
        template: 'notification',
        context: {
          title,
          message,
          actionUrl,
          actionText,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Correo enviado exitosamente',
      });
    } catch (error) {
      console.error('Error en EmailController.sendNotification:', error);
      res.status(500).json({
        success: false,
        message: 'Error al enviar el correo',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }
} 