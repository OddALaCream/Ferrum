import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * MailAdapter (C3): envío por SMTP con Nodemailer.
 * En desarrollo apunta a Mailpit (docker compose), que captura los correos
 * y los muestra en http://localhost:8025 sin enviarlos a nadie.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('MAIL_FROM');
    const user = config.get<string>('SMTP_USER');
    this.transporter = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT', 1025),
      secure: config.get<boolean>('SMTP_SECURE', false),
      auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    const info = await this.transporter.sendMail({ from: this.from, ...message });
    this.logger.log(`Correo enviado a ${[message.to].flat().join(', ')} (id ${info.messageId})`);
  }

  /** Comprueba la conexión con el servidor SMTP. */
  async verify(): Promise<void> {
    await this.transporter.verify();
  }
}
