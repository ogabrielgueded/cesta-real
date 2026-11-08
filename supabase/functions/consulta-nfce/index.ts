// Cesta Real — consulta de NFC-e
//
// Recebe o link do QR code de uma NFC-e, busca a página pública da nota na
// SEFAZ e devolve o HTML para a página de teste. Existe só porque o navegador
// não deixa a página (em github.io) ler o site da SEFAZ diretamente.
//
// Segurança:
//  - só consulta endereços de SEFAZ (*.gov.br com "fazenda", "sefaz" ou "svrs");
//  - só aceita chamadas das origens listadas em ORIGENS;
//  - mascara CPF antes de devolver e não grava nada.

const ORIGENS = [
  "https://ogabrielgueded.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const TAMANHO_MAXIMO = 3 * 1024 * 1024; // 3 MB
const TEMPO_LIMITE_MS = 20_000;

function hostPermitido(host: string): boolean {
  const h = host.toLowerCase();
  return h.endsWith(".gov.br") &&
    (h.includes("fazenda") || h.includes("sefaz") || h.includes("svrs"));
}

function cabecalhosCors(origem: string | null): HeadersInit {
  const permitida = origem && ORIGENS.includes(origem) ? origem : ORIGENS[0];
  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}

function responder(corpo: unknown, status: number, origem: string | null) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhosCors(origem), "Content-Type": "application/json; charset=utf-8" },
  });
}

const mascararCpf = (s: string) =>
  s.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***.***.***-**");

Deno.serve(async (req) => {
  const origem = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cabecalhosCors(origem) });
  }
  if (req.method !== "POST") {
    return responder({ erro: "Use POST." }, 405, origem);
  }
  if (origem && !ORIGENS.includes(origem)) {
    return responder({ erro: "Origem não autorizada." }, 403, origem);
  }

  let link = "";
  try {
    const corpo = await req.json();
    link = String(corpo?.url ?? "").trim();
  } catch {
    return responder({ erro: "Corpo inválido; envie {\"url\": \"...\"}." }, 400, origem);
  }

  let alvo: URL;
  try {
    alvo = new URL(link);
  } catch {
    return responder({ erro: "Link inválido." }, 400, origem);
  }
  if (alvo.protocol !== "https:" && alvo.protocol !== "http:") {
    return responder({ erro: "Link inválido." }, 400, origem);
  }
  if (!hostPermitido(alvo.hostname)) {
    return responder({ erro: "Este link não é de uma SEFAZ." }, 400, origem);
  }

  try {
    const resp = await fetch(alvo.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });

    const final = new URL(resp.url || alvo.toString());
    if (!hostPermitido(final.hostname)) {
      return responder({ erro: "A SEFAZ redirecionou para um endereço não permitido." }, 502, origem);
    }

    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.length > TAMANHO_MAXIMO) {
      return responder({ erro: "Página da nota grande demais." }, 502, origem);
    }

    // Descobre a codificação (algumas SEFAZ ainda usam ISO-8859-1)
    const tipo = resp.headers.get("content-type") ?? "";
    let charset = (tipo.match(/charset=([\w-]+)/i)?.[1] ?? "").toLowerCase();
    if (!charset) {
      const inicio = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
      charset = (inicio.match(/charset=["']?([\w-]+)/i)?.[1] ?? "utf-8").toLowerCase();
    }
    let html: string;
    try {
      html = new TextDecoder(charset).decode(bytes);
    } catch {
      html = new TextDecoder("utf-8").decode(bytes);
    }

    return responder({
      status: resp.status,
      url_final: final.toString(),
      html: mascararCpf(html),
    }, resp.ok ? 200 : 502, origem);
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError"
      ? "A SEFAZ demorou demais para responder."
      : "Não foi possível acessar a SEFAZ agora.";
    return responder({ erro: msg }, 504, origem);
  }
});
