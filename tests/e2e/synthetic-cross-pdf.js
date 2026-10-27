/**
 * PDF Scm405 inteiramente sintético para testar o extrator WASM no navegador.
 * Gerado com objetos PDF 1.4 nativos; nenhum arquivo empresarial é versionado.
 */
export function syntheticCrossPdf(date, description = "PRODUTO IMPORTADO VIA PDF") {
  const displayDate = date.split("-").reverse().join("/");
  const lines = [
    "TODAS AS EMPRESAS " + displayDate,
    "Scm405",
    "Codigo Descricao GTIN Pedido Cod. expedicao Embe Qnt. expedicao Separar",
    "EMPRESA DO PEDIDO : 1 - LOJA SINTETICA 01",
    "DEPARTAMENTO : 1 - MERCEARIA",
    "12345 " + description + " 7896007811298 80776 27896007811292 24 1,000 24,000",
    "TOTAL DA EMPRESA DO PEDIDO (1) 1,000 24,000",
    "TOTAL GERAL (1) 1,000 24,000"
  ];
  const escape = value => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const stream = ["BT", "/F1 12 Tf", "30 790 Td", "20 TL",
    ...lines.flatMap(line => [`(${escape(line)}) Tj`, "T*"]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 850] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, "ascii");
}
