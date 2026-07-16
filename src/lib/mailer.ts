// Not tagged "server-only" — this is intentionally shared with worker/index.ts,
// a standalone Node/tsx process, not a Next.js server context.
import nodemailer from "nodemailer";

let transport: nodemailer.Transporter | null | undefined;

function getTransport() {
  if (transport !== undefined) return transport;
  if (!process.env.SMTP_HOST) {
    console.warn("[mailer] SMTP_HOST not set — email notifications are disabled.");
    transport = null;
    return transport;
  }
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

export async function sendMail(msg: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const t = getTransport();
  if (!t) return; // not configured — silent no-op, not an error
  await t.sendMail({ from: process.env.SMTP_FROM ?? "IDStudio <no-reply@idstudio.haggabasin.com>", ...msg });
}
