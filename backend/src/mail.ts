import { Resend } from "resend"

type MailOptions = {
  to: string
  subject: string
  text: string
  html: string
}

function getMailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim()

  if (!apiKey || !from) {
    throw new Error("Resend mail configuration is incomplete")
  }

  return { apiKey, from }
}

let client: Resend | null = null

function getClient() {
  if (client) return client

  const config = getMailConfig()
  client = new Resend(config.apiKey)
  return client
}

export async function sendMail(options: MailOptions) {
  const config = getMailConfig()

  try {
    const response = await getClient().emails.send({
      from: config.from,
      to: [options.to],
      subject: options.subject,
      text: options.text,
      html: options.html,
    })

    if (response.error) {
      console.error("[mail] resend send failed", {
        name: response.error.name,
        message: response.error.message,
      })
      throw new Error(`Resend send failed: ${response.error.message}`)
    }

    return response.data
  } catch (error: any) {
    console.error("[mail] resend request failed", {
      message: error?.message ?? "Unknown Resend error",
      name: error?.name,
      statusCode: error?.statusCode,
    })
    throw error instanceof Error ? error : new Error("Resend send failed")
  }
}
