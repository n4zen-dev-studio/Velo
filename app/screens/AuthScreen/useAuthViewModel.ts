import { BASE_URL } from "@/config/api"
import { createHttpClient } from "@/services/api/httpClient"
import { login, resendVerification, signup } from "@/services/api/authApi"

export const useAuthViewModel = () => {
  const client = createHttpClient(BASE_URL)

  const loginWithEmail = async (email: string, password: string) => {
    try {
      return await login(client, email, password)
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw { type: "INVALID_CREDENTIALS" } as const
      }
      if (error.response?.status === 403 && error.response?.data?.requiresEmailVerification) {
        throw { type: "EMAIL_NOT_VERIFIED" } as const
      }
      throw error
    }
  }

  const signupWithEmail = async (email: string, password: string) => {
    return signup(client, email, password)
  }

  const resendVerificationEmail = async (email: string) => {
    return resendVerification(client, email)
  }

  return {
    offlineNotice: "You can keep working offline. Sync will resume when you're back online.",
    loginWithEmail,
    signupWithEmail,
    resendVerificationEmail,
  }
}
