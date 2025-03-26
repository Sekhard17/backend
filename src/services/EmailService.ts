import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configurar el transporter de nodemailer
    this.transporter = nodemailer.createTransport({
      service: 'gmail',  // Más fácil que configurar host y port
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // Usa la contraseña de aplicación aquí
      },
    });
  }

  public async sendEmail(options: EmailOptions): Promise<void> {
    try {
      // Leer la plantilla
      const templatePath = path.join(__dirname, '../templates', `${options.template}.hbs`);
      const template = fs.readFileSync(templatePath, 'utf-8');
      
      // Compilar la plantilla con handlebars
      const compiledTemplate = handlebars.compile(template);
      const html = compiledTemplate(options.context);

      // Enviar el correo
      await this.transporter.sendMail({
        from: process.env.SMTP_USER, // Usamos el mismo correo como remitente
        to: options.to,
        subject: options.subject,
        html,
      });
    } catch (error) {
      console.error('Error enviando correo:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService(); 