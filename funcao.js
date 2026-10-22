const form = document.getElementById("mercanteForm");
const arquivoInput = document.getElementById("arquivo");
const origemInput = document.getElementById("origem");
const destinoInput = document.getElementById("destino");
const resultado = document.getElementById("resultado");
const botaoBaixar = document.getElementById("baixar");
const botaoLimpar = document.getElementById("limpar");

let arquivoGerado = null;
let nomeArquivoGerado = "";

// =====================================================
// MENSAGENS E VALIDAÇÕES
// =====================================================

function mostrarMensagem(mensagem, tipo = "sucesso") {
  resultado.textContent = mensagem;
  resultado.className = tipo;
  resultado.hidden = false;
}

function validarCodigo(codigo) {
  return /^(BR)?[A-Z]{3}\d{3}$/.test(codigo);
}

function normalizarCodigo(codigo) {
  codigo = codigo.trim().toUpperCase();

  if (!codigo.startsWith("BR")) {
    codigo = "BR" + codigo;
  }

  return codigo;
}

// =====================================================
// IDENTIFICAR O CABEÇALHO M4I
// =====================================================

function obterDadosCabecalho(conteudo) {
  const linhas = conteudo.split(/\r\n|\n|\r/);

  const indiceCabecalho = linhas.findIndex(
    linha => linha.startsWith("M4I")
  );

  if (indiceCabecalho === -1) {
    throw new Error(
      "Não foi encontrado o registro inicial M4I."
    );
  }

  const cabecalho = linhas[indiceCabecalho];

  // Aceita letra ou número no último caractere do sufixo.
  const padrao =
    /(\d{8})(\d{8})(BR[A-Z]{3})(BR[A-Z]{3})(\d+)(N[A-Z]{3})([A-Z0-9])/;

  const trecho = cabecalho.match(padrao);

  if (!trecho) {
    throw new Error(
      "Não foi possível identificar os portos, a viagem e o sufixo no cabeçalho M4I."
    );
  }

  const prefixoOrigem = trecho[3];
  const prefixoDestino = trecho[4];
  const numeroViagem = trecho[5];
  const sufixoDestino = trecho[6];
  const letraFinalSufixo = trecho[7];

  if (prefixoOrigem === prefixoDestino) {
    throw new Error(
      "Os prefixos de origem e destino são iguais."
    );
  }

  return {
    linhas,
    indiceCabecalho,
    cabecalho,
    prefixoOrigem,
    prefixoDestino,
    numeroViagem,
    sufixoDestino,
    letraFinalSufixo
  };
}

// =====================================================
// IDENTIFICAR OS PORTOS NO NOME DO ARQUIVO
// =====================================================

function identificarPortosNoNome(nomeArquivo) {
  const extensao = nomeArquivo.match(/\.txt$/i)?.[0] || "";

  const nomeBase = extensao
    ? nomeArquivo.slice(0, -extensao.length)
    : nomeArquivo;

  const padrao =
    /^(.*-\d+)([A-Z]{3})(BR[A-Z]{3}\d{3})([A-Z]{3})(BR[A-Z]{3}\d{3})(.*)$/i;

  const partes = nomeBase.match(padrao);

  if (!partes) {
    throw new Error(
      "O nome do arquivo não corresponde à estrutura esperada de navio, viagem e dois segmentos de porto."
    );
  }

  return {
    prefixoNavioViagem: partes[1],
    marcadorOrigem: partes[2].toUpperCase(),
    origemAtual: partes[3].toUpperCase(),
    marcadorDestino: partes[4].toUpperCase(),
    destinoAtual: partes[5].toUpperCase(),
    trechoFinal: partes[6],
    extensao
  };
}

// =====================================================
// VALIDAR E IDENTIFICAR OS PORTOS
// =====================================================

function identificarPortos(conteudo, nomeArquivo) {
  const dadosM4I = obterDadosCabecalho(conteudo);
  const dadosNome = identificarPortosNoNome(nomeArquivo);

  const origemAtual = dadosNome.origemAtual;
  const destinoAtual = dadosNome.destinoAtual;

  if (!origemAtual.startsWith(dadosM4I.prefixoOrigem)) {
    throw new Error(
      "A origem " + origemAtual +
      " do nome do arquivo não corresponde ao prefixo " +
      dadosM4I.prefixoOrigem + " do M4I."
    );
  }

  if (!destinoAtual.startsWith(dadosM4I.prefixoDestino)) {
    throw new Error(
      "O destino " + destinoAtual +
      " do nome do arquivo não corresponde ao prefixo " +
      dadosM4I.prefixoDestino + " do M4I."
    );
  }

  if (!conteudo.includes(origemAtual)) {
    throw new Error(
      "O código completo de origem " + origemAtual +
      " não foi encontrado no TXT."
    );
  }

  if (!conteudo.includes(destinoAtual)) {
    throw new Error(
      "O código completo de destino " + destinoAtual +
      " não foi encontrado no TXT."
    );
  }

  return {
    ...dadosM4I,
    ...dadosNome,
    origemAtual,
    destinoAtual
  };
}

// =====================================================
// SUBSTITUIR CÓDIGOS COMPLETOS NO ARQUIVO INTEIRO
// =====================================================

function atualizarCodigosArquivo(
  conteudo,
  origemAtual,
  destinoAtual,
  novaOrigem,
  novoDestino
) {
  const substituicoes = new Map([
    [origemAtual, novaOrigem],
    [destinoAtual, novoDestino]
  ]);

  return conteudo.replace(
    /BR[A-Z]{3}\d{3}/gi,
    codigo => substituicoes.get(codigo.toUpperCase()) || codigo
  );
}

// =====================================================
// ATUALIZAR O CABEÇALHO M4I
// =====================================================

function atualizarCabecalhoMercante(
  cabecalho,
  novaOrigem,
  novoDestino
) {
  // O último caractere pode ser letra ou número.
  const padrao =
    /(BR[A-Z]{3})(BR[A-Z]{3})(\d+)(N[A-Z]{3})([A-Z0-9])/;

  if (!padrao.test(cabecalho)) {
    throw new Error(
      "Não foi possível atualizar a estrutura do cabeçalho M4I."
    );
  }

  return cabecalho.replace(
    padrao,
    (
      trecho,
      prefixoOrigem,
      prefixoDestino,
      numeroViagem,
      sufixoDestino,
      caractereFinal
    ) => {
      const novoPrefixoOrigem = novaOrigem.slice(0, 5);
      const novoPrefixoDestino = novoDestino.slice(0, 5);

      // Atualiza o sufixo conforme o novo destino,
      // preservando o último caractere original.
      const novoSufixo =
        "N" + novoDestino.slice(2, 5) + caractereFinal;

      return (
        novoPrefixoOrigem +
        novoPrefixoDestino +
        numeroViagem +
        novoSufixo
      );
    }
  );
}

// =====================================================
// GERAR O NOME NOVO DO ARQUIVO
// =====================================================

function gerarNomeArquivo(
  nomeOriginal,
  origemAtual,
  destinoAtual,
  novaOrigem,
  novoDestino
) {
  const dadosNome = identificarPortosNoNome(nomeOriginal);

  if (
    dadosNome.origemAtual !== origemAtual ||
    dadosNome.destinoAtual !== destinoAtual
  ) {
    throw new Error(
      "Os códigos do nome do arquivo não correspondem aos portos identificados."
    );
  }

  const novoMarcador = novaOrigem.slice(2, 5);

  return (
    dadosNome.prefixoNavioViagem +
    novoMarcador +
    novaOrigem +
    novoMarcador +
    novoDestino +
    dadosNome.trechoFinal +
    dadosNome.extensao
  );
}

// =====================================================
// PROCESSAMENTO PRINCIPAL
// =====================================================

form.addEventListener("submit", async function(event) {
  event.preventDefault();

  botaoBaixar.hidden = true;
  arquivoGerado = null;
  nomeArquivoGerado = "";

  const arquivo = arquivoInput.files[0];

  const origemDigitada = origemInput.value.trim().toUpperCase();
  const destinoDigitado = destinoInput.value.trim().toUpperCase();

  if (!arquivo) {
    mostrarMensagem("Selecione um arquivo TXT.", "erro");
    return;
  }

  if (
    !validarCodigo(origemDigitada) ||
    !validarCodigo(destinoDigitado)
  ) {
    mostrarMensagem(
      "Confira os códigos. Utilize SSZ111 ou BRSSZ111, por exemplo.",
      "erro"
    );
    return;
  }

  const novaOrigem = normalizarCodigo(origemDigitada);
  const novoDestino = normalizarCodigo(destinoDigitado);

  if (novaOrigem === novoDestino) {
    mostrarMensagem(
      "Origem e destino não podem ser iguais.",
      "erro"
    );
    return;
  }

  try {
    const conteudoOriginal = await arquivo.text();

    const dados = identificarPortos(
      conteudoOriginal,
      arquivo.name
    );

    const {
      origemAtual,
      destinoAtual,
      numeroViagem
    } = dados;

    const confirmacao =
      "Arquivo: " + arquivo.name + "\n\n" +
      "Viagem: " + numeroViagem + "\n" +
      "Origem atual: " + origemAtual + "\n" +
      "Destino atual: " + destinoAtual + "\n\n" +
      "Nova origem: " + novaOrigem + "\n" +
      "Novo destino: " + novoDestino + "\n\n" +
      "Deseja continuar?";

    if (!window.confirm(confirmacao)) {
      mostrarMensagem("Operação cancelada.", "aviso");
      return;
    }

    // Substitui os códigos completos em todas as linhas.
    let conteudo = atualizarCodigosArquivo(
      conteudoOriginal,
      origemAtual,
      destinoAtual,
      novaOrigem,
      novoDestino
    );

    // Preserva os separadores de linha originais.
    const partes = conteudo.split(/(\r\n|\n|\r)/);

    const indiceCabecalho = partes.findIndex(
      parte => parte.startsWith("M4I")
    );

    if (indiceCabecalho === -1) {
      throw new Error(
        "Não foi possível localizar o cabeçalho M4I."
      );
    }

    // Atualiza os prefixos e o sufixo do M4I.
    partes[indiceCabecalho] = atualizarCabecalhoMercante(
      partes[indiceCabecalho],
      novaOrigem,
      novoDestino
    );

    conteudo = partes.join("");

    // Atualiza o nome do arquivo.
    nomeArquivoGerado = gerarNomeArquivo(
      arquivo.name,
      origemAtual,
      destinoAtual,
      novaOrigem,
      novoDestino
    );

    arquivoGerado = new Blob(
      [conteudo],
      { type: "text/plain;charset=utf-8" }
    );

    mostrarMensagem(
      "Arquivo processado!\n\n" +
      "Viagem preservada: " + numeroViagem + "\n\n" +
      "Origem anterior: " + origemAtual + "\n" +
      "Nova origem: " + novaOrigem + "\n\n" +
      "Destino anterior: " + destinoAtual + "\n" +
      "Novo destino: " + novoDestino + "\n\n" +
      "Arquivo gerado: " + nomeArquivoGerado + "\n\n" +
      "Todas as linhas foram processadas.\n" +
      "Confira o arquivo antes de enviá-lo ao Mercante.",
      "sucesso"
    );

    botaoBaixar.hidden = false;

  } catch (erro) {
    arquivoGerado = null;
    nomeArquivoGerado = "";
    botaoBaixar.hidden = true;

    mostrarMensagem(
      erro.message || "Erro ao processar o arquivo.",
      "erro"
    );
  }
});

// =====================================================
// DOWNLOAD
// =====================================================

botaoBaixar.addEventListener("click", function() {
  if (!arquivoGerado) {
    mostrarMensagem("Nenhum arquivo foi gerado.", "erro");
    return;
  }

  const url = URL.createObjectURL(arquivoGerado);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivoGerado;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// =====================================================
// LIMPAR
// =====================================================

botaoLimpar.addEventListener("click", function() {
  form.reset();

  resultado.hidden = true;
  resultado.textContent = "";
  resultado.className = "";

  botaoBaixar.hidden = true;
  arquivoGerado = null;
  nomeArquivoGerado = "";
});
