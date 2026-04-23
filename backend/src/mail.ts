import nodemailer from "nodemailer"

type MailOptions = {
  to: string
  subject: string
  text: string
  html: string
}

function getMailConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT ?? 465)
  const secure = (process.env.SMTP_SECURE ?? "true").toLowerCase() === "true"
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS
  const from = process.env.MAIL_FROM?.trim()

  if (!host || !user || !pass || !from || Number.isNaN(port)) {
    throw new Error("SMTP mail configuration is incomplete")
  }

  return { host, port, secure, user, pass, from }
}

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter

  const config = getMailConfig()
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  })

  return transporter
}

export async function sendMail(options: MailOptions) {
  const config = getMailConfig()

  console.log("[mail] config loaded", {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    from: config.from,
    to: options.to,
  })

  const transporter = getTransporter()

  console.log("[mail] about to send")
  const info = await transporter.sendMail({
    from: config.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  })
  console.log("[mail] send success", info)

  return info
}
