import { BASE_URL } from "@/config/api"
import { createHttpClient } from "@/services/api/httpClient"
import {
  appleLogin,
  confirmPasswordReset,
  googleLogin,
  login,
  logout,
  requestPasswordReset,
  resendVerification,
  signup,
  verifyEmail,
} from "@/services/api/authApi"
import { clearTokens, getRefreshToken } from "@/services/api/tokenStore"

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

  const signupWithEmail = async (email: string, password: string, username?: string) => {
    const result = await signup(client, email, password, username)
    return { needsVerification: !!result.requiresEmailVerification }
  }

  const resendVerificationEmail = async (email: string) => {
    return resendVerification(client, email)
  }

  const logoutUser = async () => {
    const refreshToken = await getRefreshToken()
    if (refreshToken) {
      try {
        await logout(client, refreshToken)
      } catch {
        // best-effort
      }
    }
    await clearTokens()
  }

  const requestPasswordResetEmail = async (email: string) => {
    return requestPasswordReset(client, email)
  }

  const confirmPasswordResetToken = async (token: string, newPassword: string) => {
    return confirmPasswordReset(client, token, newPassword)
  }

  const verifyEmailWithToken = async (token: string) => {
    return verifyEmail(client, token)
  }

  const loginWithGoogle = async (idToken: string) => {
    return googleLogin(client, idToken)
  }

  const loginWithApple = async (idToken: string) => {
    return appleLogin(client, idToken)
  }

  return {
    offlineNotice: "You can keep working offline. Sync will resume when you're back online.",
    loginWithEmail,
    signupWithEmail,
    resendVerificationEmail,
    logoutUser,
    requestPasswordResetEmail,
    confirmPasswordResetToken,
    verifyEmailWithToken,
    loginWithGoogle,
    loginWithApple,
  }
}
