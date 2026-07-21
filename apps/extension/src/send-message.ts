import type { MessageResponse, RequestMessage } from "@bp/shared";

/**
 * Envolve chrome.runtime.sendMessage em MessageResponse. Sem handler (ou
 * contexto encerrado) a chamada rejeita e cai aqui como {ok:false}, nunca
 * lança para o chamador.
 */
export async function sendMessage(message: RequestMessage): Promise<MessageResponse<unknown>> {
  try {
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse<unknown> | undefined;
    if (!response) return { ok: false, error: "sem resposta do service worker" };
    return response;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "falha ao enviar mensagem" };
  }
}
