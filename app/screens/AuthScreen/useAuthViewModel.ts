import { BASE_URL } from "@/config/api"
import { createHttpClient } from "@/services/api/httpClient"
import { login } from "@/services/api/authApi"

export const useAuthViewModel = () => {
  const client = createHttpClient(BASE_URL)

  const loginWithEmail = async (email: string, password: string) => {
    return login(client, email, password)
  }

  return {
    offlineNotice: "You can keep working offline. Sync will resume when you're back online.",
    loginWithEmail,
  }
}
