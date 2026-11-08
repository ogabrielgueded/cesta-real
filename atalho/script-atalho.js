// Script do atalho "Cesta Real" (app Atalhos do iPhone).
// Roda na página da nota, depois de tocar em "Visualizar".
// Copia a página com o CPF mascarado; o atalho cola no Cesta Real.
var pagina = document.documentElement.outerHTML.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***.***.***-**");
completion(pagina);
