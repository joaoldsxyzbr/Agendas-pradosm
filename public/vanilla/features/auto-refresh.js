// Evita recriar a interface quando os dados consultados nao mudaram.
export function observeGet(api, onRead) {
  return async (url, options = {}) => {
    const result = await api(url, options);
    if ((options.method || "GET").toUpperCase() === "GET" && url.startsWith("/api/")) {
      onRead({ url, signature: JSON.stringify(result) });
    }
    return result;
  };
}

// Se uma consulta falhar, quem chamou mantem a interface atual e tenta novamente depois.
export async function hasViewChanged(snapshot, api) {
  if (!snapshot.length) return false;
  const updated = await Promise.all(snapshot.map(entry => api(entry.url)));
  return updated.some((data, index) => JSON.stringify(data) !== snapshot[index].signature);
}
