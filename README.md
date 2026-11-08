# Cesta Real — teste de captura de NFC-e

Página de teste do Cesta Real: lê o QR code do cupom fiscal (NFC-e) pela câmera,
extrai os itens da nota e mostra uma classificação nutricional preliminar.

Publicada pelo GitHub Pages a partir do arquivo `index.html`.
Os dados lidos ficam apenas no aparelho de quem usa a página.

## Busca automática da nota

O navegador não deixa a página ler o site da SEFAZ diretamente. Por isso a
função `supabase/functions/consulta-nfce` busca a página da nota no servidor e
devolve o conteúdo, com CPF mascarado. Ela só consulta endereços de SEFAZ e
só responde à página publicada. Depois de publicada no Supabase, o endereço
dela vai em `SERVIDOR.url`, no `index.html`.
