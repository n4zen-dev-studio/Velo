import Config from "@/config"
import { createApiClient } from "@/services/api/apiClient"
import { login } from "@/services/api/authApi"

export const useAuthViewModel = () => {
  const client = createApiClient(Config.apiUrl)

  const loginWithEmail = async (email: string, password: string) => {
    return login(client, email, password)
  }

  return {
    offlineNotice: "You can keep working offline. Sync will resume when you're back online.",
    loginWithEmail,
  }
}
