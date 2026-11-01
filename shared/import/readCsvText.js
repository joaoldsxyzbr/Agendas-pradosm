// A agenda exportada no Windows pode vir em UTF-8, Windows-1252 ou UTF-16.
// TextDecoder é nativo e evita dependências adicionais e envio do arquivo ao servidor.
export async function readCsvText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // O UTF-8 inválido é típico do CSV ANSI gerado pelo Excel no Windows.
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
