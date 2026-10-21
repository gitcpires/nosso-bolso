// Verificação simples de funcionamento. Não acessa dados nem revela segredos.
exports.handler = async () => ({
  statusCode: 200,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  body: JSON.stringify({ ok: true, service: "nosso-bolso-functions" })
});
