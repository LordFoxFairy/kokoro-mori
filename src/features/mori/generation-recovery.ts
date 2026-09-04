import type { MoriApi } from "@/lib/mori-api"
import { moriNetworkRequestError } from "@/lib/mori-api-client"

/** Normalize only transport failures raised by the snapshot request itself. */
export async function getGenerationForRecovery(
  api: Pick<MoriApi, "getGeneration">,
  generationRef: string,
) {
  try {
    return await api.getGeneration(generationRef)
  } catch (error) {
    throw moriNetworkRequestError(error) ?? error
  }
}

