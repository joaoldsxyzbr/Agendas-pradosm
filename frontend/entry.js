import { createMigratedApplication } from "./application.js";

const root = document.getElementById("root");
if (!root) throw Error("Elemento #root ausente.");
const app = createMigratedApplication({ root });
app.start().catch(error => {
  console.error("Falha ao iniciar a interface nativa.", error);
  root.replaceChildren();
  const message = document.createElement("p");
  message.className = "form-error";
  message.setAttribute("role", "alert");
  message.textContent = "Não foi possível carregar o sistema. Atualize a página e tente novamente.";
  root.appendChild(message);
});