// Esta constante existe somente na branch preview.
// Em builds da preview, os dados são mockados. Em testes, ela fica desligada
// para preservar os mocks/fetches próprios da suíte existente.
export const PREVIEW_MOCKS_ENABLED = import.meta.env.MODE !== "test";
