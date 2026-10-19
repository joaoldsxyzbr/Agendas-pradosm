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

/*
 * Preserva os nós DOM de cada página durante o refresh de dados.
 * Diferente de innerHTML=..., atualiza apenas textos, atributos e linhas que mudaram.
 * Novos botões recebem handlers das funções de renderização de cada página.
 */
function stableKey(node) {
  if (!node || node.nodeType !== 1) return null;
  for (const name of ["data-store-id", "data-appointment-id"]) {
    if (node.hasAttribute(name)) return name + ":" + node.getAttribute(name);
  }
  return null;
}

function compatible(existing, desired) {
  return existing && existing.nodeType === desired.nodeType &&
    (existing.nodeType !== 1 || existing.tagName === desired.tagName);
}

function syncNode(existing, desired) {
  if (existing.nodeType === 3 || existing.nodeType === 8) {
    if (existing.nodeValue !== desired.nodeValue) existing.nodeValue = desired.nodeValue;
    return;
  }
  if (existing.nodeType !== 1) return;
  for (const attr of [...existing.attributes]) {
    if (!desired.hasAttribute(attr.name)) existing.removeAttribute(attr.name);
  }
  for (const attr of [...desired.attributes]) {
    if (existing.getAttribute(attr.name) !== attr.value)
      existing.setAttribute(attr.name, attr.value);
  }
  patchChildren(existing, desired);
  // Atualiza propriedades de controles sem descartar o próprio elemento nem o foco.
  if (existing !== existing.ownerDocument.activeElement) {
    if (existing.matches("input,textarea,select") && existing.value !== desired.value)
      existing.value = desired.value;
  }
  if (existing.matches("input[type=checkbox],input[type=radio]"))
    existing.checked = desired.checked;
}

function patchChildren(existing, desired) {
  const wanted = [...desired.childNodes];
  let index = 0;
  for (const future of wanted) {
    let current = existing.childNodes[index];
    const key = stableKey(future);
    if (key && stableKey(current) !== key) {
      const matching = [...existing.childNodes].slice(index + 1)
        .find(node => compatible(node, future) && stableKey(node) === key);
      if (matching) {
        existing.insertBefore(matching, current || null);
        current = matching;
      } else {
        existing.insertBefore(future.cloneNode(true), current || null);
        index++;
        continue;
      }
    }
    if (!compatible(current, future) || (!key && stableKey(current))) {
      if (current) current.replaceWith(future.cloneNode(true));
      else existing.appendChild(future.cloneNode(true));
    } else {
      syncNode(current, future);
    }
    index++;
  }
  while (existing.childNodes.length > index) existing.lastChild.remove();
}

export function patchMarkup(root, html) {
  const template = root.ownerDocument.createElement("template");
  template.innerHTML = html;
  patchChildren(root, template.content);
}

// Proxy mantém querySelector, querySelectorAll e todas as APIs originais do elemento.
// Somente o setter innerHTML é trocado pelo patch incremental.
export function incrementalRoot(root) {
  return new Proxy(root, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, property, value) {
      if (property === "innerHTML") {
        patchMarkup(target, String(value));
        return true;
      }
      return Reflect.set(target, property, value, target);
    }
  });
}