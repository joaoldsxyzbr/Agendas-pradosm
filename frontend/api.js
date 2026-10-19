// Conversão fiel de src/lib/api.ts da main. Nenhum endpoint novo.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  static async fromResponse(response) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      // A resposta de erro pode não ter corpo JSON.
    }
    return new ApiError(
      response.status,
      typeof body?.error === "string" ? body.error : null,
      typeof body?.message === "string" ? body.message : "Não foi possível concluir a operação."
    );
  }
}

export async function apiFetch(url, init = {}) {
  const response = await fetch(url, { ...init, credentials: "include" });
  if (!response.ok) throw await ApiError.fromResponse(response);
  if (response.status === 204) return undefined;
  return response.json();
}