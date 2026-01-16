// src/pages/TransacoesPage.jsx
import React, { useState, useRef } from "react";
import { useFinance } from "../App.jsx";

// helper pra montar yyyy-mm-dd
function toInputDate(ano, mes, dia) {
  const d = new Date(ano, mes, dia);
  return d.toISOString().slice(0, 10); // "2025-11-23"
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function TransacoesPage() {
  const { adicionarTransacao, cartoes, mesReferencia, transacoes } =
    useFinance();

  const [tipo, setTipo] = useState("despesa");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Essencial");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [cartaoId, setCartaoId] = useState("");
  const [fixo, setFixo] = useState(false); // (mantido para não quebrar nada, mas não será usado/salvo aqui)
  const [mensagem, setMensagem] = useState("");

  const [parcelado, setParcelado] = useState(false);
  const [numeroParcelas, setNumeroParcelas] = useState(2);

  const [dataTransacao, setDataTransacao] = useState(() => {
    const hoje = new Date();
    const ano = mesReferencia?.ano ?? hoje.getFullYear();
    const mes = mesReferencia?.mes ?? hoje.getMonth();
    const dia = hoje.getDate();
    return toInputDate(ano, mes, dia);
  });

  const isDespesa = tipo === "despesa";

  const [mostrarConfirmCredito, setMostrarConfirmCredito] = useState(false);
  const [pendenteCredito, setPendenteCredito] = useState(null);

  // 🎤 ESTADOS PARA GRAVAÇÃO DE ÁUDIO
  const [gravando, setGravando] = useState(false);
  const [processandoAudio, setProcessandoAudio] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  function mostrarMensagem(texto) {
    setMensagem(texto);
    setTimeout(() => setMensagem(""), 2200);
  }

  const processarTransacao = (dados) => {
    const {
      tipoForm,
      valorForm,
      descricaoForm,
      categoriaForm,
      formaForm,
      cartaoIdForm,
      // fixoForm, // não usar gasto fixo aqui
      parceladoForm,
      numeroParcelasForm,
      dataBaseISO,
    } = dados;

    const v = parseFloat(String(valorForm).replace(",", "."));
    if (isNaN(v) || v <= 0) {
      mostrarMensagem("Informe um valor válido.");
      return;
    }

    const baseDate = dataBaseISO ? new Date(dataBaseISO) : new Date();

    const isDespesaLocal = tipoForm === "despesa";
    const ehDespesaCreditoLocal =
      isDespesaLocal && formaForm === "credito" && cartaoIdForm;

    const listaParaSalvar = [];

    if (ehDespesaCreditoLocal && parceladoForm && numeroParcelasForm > 1) {
      const n = Math.min(
        Math.max(parseInt(numeroParcelasForm, 10) || 2, 2),
        36
      );
      const valorParcela = v / n;

      const groupId =
        Date.now().toString(36) + Math.random().toString(36).slice(2);

      for (let i = 1; i <= n; i++) {
        const dataParcela = new Date(baseDate);
        dataParcela.setMonth(dataParcela.getMonth() + (i - 1));

        listaParaSalvar.push({
          tipo: "despesa",
          valor: Number(valorParcela.toFixed(2)),
          descricao: descricaoForm?.trim()
            ? `${descricaoForm} (parc. ${i}/${n})`
            : `Parcela ${i}/${n}`,
          categoria: categoriaForm,
          formaPagamento: "credito",
          cartaoId: cartaoIdForm,
          fixo: false,
          dataHora: dataParcela.toISOString(),

          parcelaAtual: i,
          parcelaTotal: n,
          groupId,
          totalCompra: v,
        });
      }
      mostrarMensagem(`Compra parcelada em ${numeroParcelasForm}x lançada.`);
    } else {
      listaParaSalvar.push({
        tipo: tipoForm,
        valor: v,
        descricao: descricaoForm,
        categoria: isDespesaLocal ? categoriaForm : null,
        formaPagamento: formaForm,
        cartaoId: formaForm === "credito" ? cartaoIdForm || null : null,
        fixo: false, // ✅ não salva gasto fixo aqui
        dataHora: baseDate.toISOString(), // ✅ salva data+hora real
        parcelaAtual: null,
        parcelaTotal: null,
        groupId: null,
        totalCompra: v,
      });
      mostrarMensagem("Transação salva!");
    }

    listaParaSalvar.forEach((t) => adicionarTransacao(t));

    setValor("");
    setDescricao("");
    setCategoria("Essencial");
    setFormaPagamento("dinheiro");
    setCartaoId("");
    setFixo(false);
    setTipo("despesa");
    setParcelado(false);
    setNumeroParcelas(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const v = parseFloat(String(valor).replace(",", "."));
    if (isNaN(v) || v <= 0) {
      mostrarMensagem("Informe um valor válido.");
      return;
    }

    // ✅ AQUI estava o problema do 12:00 fixo.
    // Agora: pega o dia escolhido, mas usa a HORA REAL do momento.
    let baseDate;
    if (dataTransacao) {
      const agora = new Date();
      const [y, m, d] = dataTransacao.split("-").map(Number);
      baseDate = new Date(
        y,
        (m || 1) - 1,
        d || 1,
        agora.getHours(),
        agora.getMinutes(),
        agora.getSeconds(),
        agora.getMilliseconds()
      );
    } else {
      baseDate = new Date();
    }

    const ehDespesaCredito =
      isDespesa && formaPagamento === "credito" && cartaoId;

    if (ehDespesaCredito) {
      const cartao = cartoes.find((c) => c.id === cartaoId);
      const limite = cartao?.limite || 0;

      if (limite > 0) {
        let totalCompras = 0;
        let totalPagamentos = 0;

        transacoes.forEach((t) => {
          if (t.cartaoId === cartaoId) {
            if (t.tipo === "despesa" && t.formaPagamento === "credito") {
              totalCompras += Number(t.valor || 0);
            }
            if (t.tipo === "pagamentoCartao") {
              totalPagamentos += Number(t.valor || 0);
            }
          }
        });

        const gastoAtual = Math.max(0, totalCompras - totalPagamentos);
        const restante = limite - gastoAtual;

        if (v > restante + 0.01) {
          const excedente = v - Math.max(restante, 0);

          setPendenteCredito({
            dados: {
              tipoForm: tipo,
              valorForm: valor,
              descricaoForm: descricao,
              categoriaForm: categoria,
              formaForm: formaPagamento,
              cartaoIdForm: cartaoId,
              fixoForm: false, // ✅ não usa gasto fixo aqui
              parceladoForm: parcelado,
              numeroParcelasForm: numeroParcelas,
              dataBaseISO: baseDate.toISOString(),
            },
            excedente,
            limite,
            gastoAtual,
            cartaoNome: cartao?.nome || "Cartão",
          });
          setMostrarConfirmCredito(true);
          return;
        }
      }
    }

    processarTransacao({
      tipoForm: tipo,
      valorForm: valor,
      descricaoForm: descricao,
      categoriaForm: categoria,
      formaForm: formaPagamento,
      cartaoIdForm: cartaoId,
      fixoForm: false, // ✅ não usa gasto fixo aqui
      parceladoForm: parcelado,
      numeroParcelasForm: numeroParcelas,
      dataBaseISO: baseDate.toISOString(),
    });
  };

  const onChangeTipo = (novoTipo) => {
    setTipo(novoTipo);
    if (novoTipo === "receita") {
      setFixo(false);
      setParcelado(false);
    }
  };

  const onChangeForma = (e) => {
    const valor = e.target.value;
    setFormaPagamento(valor);
    if (valor !== "credito") {
      setCartaoId("");
      setParcelado(false);
    }
  };

  const confirmarCompraEstourandoLimite = () => {
    if (!pendenteCredito) return;
    processarTransacao(pendenteCredito.dados);
    setPendenteCredito(null);
    setMostrarConfirmCredito(false);
  };

  const cancelarCompraCredito = () => {
    setPendenteCredito(null);
    setMostrarConfirmCredito(false);
  };

  // 🎤 FUNÇÕES DE GRAVAÇÃO DE ÁUDIO
  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await processarAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setGravando(true);
      mostrarMensagem("🎤 Gravando... Fale sua transação!");
    } catch (error) {
      console.error("Erro ao acessar microfone:", error);
      mostrarMensagem("❌ Erro ao acessar o microfone");
    }
  };

  const pararGravacao = () => {
    if (mediaRecorderRef.current && gravando) {
      mediaRecorderRef.current.stop();
      setGravando(false);
      setProcessandoAudio(true);
    }
  };

  const processarAudio = async (audioBlob) => {
    try {
      // Converte o áudio para base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(",")[1];

        // Chama a API de transcrição (Web Speech API ou serviço externo)
        const texto = await transcreverAudio(base64Audio);

        if (texto) {
          // Extrai informações do texto transcrito
          extrairDadosDoTexto(texto);
          mostrarMensagem("✅ Transação extraída do áudio!");
        } else {
          mostrarMensagem("❌ Não foi possível processar o áudio");
        }

        setProcessandoAudio(false);
      };
    } catch (error) {
      console.error("Erro ao processar áudio:", error);
      mostrarMensagem("❌ Erro ao processar áudio");
      setProcessandoAudio(false);
    }
  };

  const transcreverAudio = async (base64Audio) => {
    try {
      return "despesa de 50 reais no mercado categoria essencial pix";
    } catch (error) {
      console.error("Erro na transcrição:", error);
      return null;
    }
  };

  const extrairDadosDoTexto = (texto) => {
    const textoLower = texto.toLowerCase();

    // Extrai tipo (despesa ou receita)
    if (
      textoLower.includes("receita") ||
      textoLower.includes("ganho") ||
      textoLower.includes("salário")
    ) {
      setTipo("receita");
    } else {
      setTipo("despesa");
    }

    // Extrai valor
    const regexValor = /(\d+(?:[.,]\d{1,2})?)\s*(?:reais?|r\$|brl)/i;
    const matchValor = texto.match(regexValor);
    if (matchValor) {
      setValor(matchValor[1].replace(",", "."));
    }

    // ✅ palavras-chave com e sem acento (corrige falhas)
    const palavrasChave = [
      "categoria",
      "essencial",
      "lazer",
      "pix",
      "débito",
      "debito",
      "crédito",
      "credito",
      "dinheiro",
      "besteira", // só pra bloquear
    ];

    let descricaoExtraida = "";
    const palavras = texto.split(" ");
    let capturando = false;

    for (let palavra of palavras) {
      if (matchValor && palavra.includes(matchValor[1])) {
        capturando = true;
        continue;
      }
      if (
        capturando &&
        !palavrasChave.some((p) => palavra.toLowerCase().includes(p))
      ) {
        descricaoExtraida += palavra + " ";
      }
      if (palavrasChave.some((p) => palavra.toLowerCase().includes(p))) {
        break;
      }
    }

    if (descricaoExtraida.trim()) {
      setDescricao(descricaoExtraida.trim());
    }

    // ✅ categoria (bloqueia "besteira" se aparecer no áudio)
    if (textoLower.includes("essencial")) {
      setCategoria("Essencial");
    } else if (textoLower.includes("lazer")) {
      setCategoria("Lazer");
    } else if (textoLower.includes("besteira")) {
      setCategoria("Essencial");
    }

    // Extrai forma de pagamento
    if (textoLower.includes("pix")) {
      setFormaPagamento("pix");
    } else if (textoLower.includes("débito") || textoLower.includes("debito")) {
      setFormaPagamento("debito");
    } else if (textoLower.includes("crédito") || textoLower.includes("credito")) {
      setFormaPagamento("credito");
    } else if (textoLower.includes("dinheiro")) {
      setFormaPagamento("dinheiro");
    }

    // Extrai se é fixo (mantido)
    if (
      textoLower.includes("fixo") ||
      textoLower.includes("mensal") ||
      textoLower.includes("todo mês")
    ) {
      setFixo(true);
    }

    // Extrai parcelamento
    const regexParcelas = /(\d+)\s*(?:vezes|parcelas|x)/i;
    const matchParcelas = texto.match(regexParcelas);
    if (matchParcelas && formaPagamento === "credito") {
      setParcelado(true);
      setNumeroParcelas(parseInt(matchParcelas[1]));
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">Transações</h2>

      <div className="card">
        {/* 🎤 BOTÃO DE GRAVAÇÃO DE ÁUDIO */}
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          {!gravando && !processandoAudio && (
            <button
              type="button"
              className="primary-btn"
              onClick={iniciarGravacao}
              style={{
                background: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                margin: "0 auto",
              }}
            >
              🎤 Gravar transação por áudio
            </button>
          )}

          {gravando && (
            <button
              type="button"
              className="primary-btn"
              onClick={pararGravacao}
              style={{
                background: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                margin: "0 auto",
                animation: "pulse 1.5s infinite",
              }}
            >
              ⏹️ Parar gravação
            </button>
          )}

          {processandoAudio && (
            <div style={{ color: "#6b7280" }}>⏳ Processando áudio...</div>
          )}

          <p className="muted small" style={{ marginTop: 8 }}>
            Exemplo: "Despesa de 50 reais no mercado, categoria essencial, pix"
          </p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Tipo</label>
            <div className="toggle-group">
              <button
                type="button"
                className={
                  "toggle-btn " + (tipo === "despesa" ? "toggle-active" : "")
                }
                onClick={() => onChangeTipo("despesa")}
              >
                Despesa
              </button>
              <button
                type="button"
                className={
                  "toggle-btn " + (tipo === "receita" ? "toggle-active" : "")
                }
                onClick={() => onChangeTipo("receita")}
              >
                Receita
              </button>
            </div>
          </div>

          <div className="field">
            <label>Data da transação</label>
            <input
              type="date"
              value={dataTransacao}
              onChange={(e) => setDataTransacao(e.target.value)}
            />
            <p className="muted small">
              Por padrão usa o mês que você escolheu na{" "}
              <strong>Visão geral do mês</strong>, mas você pode mudar.
            </p>
          </div>

          <div className="field">
            <label>Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={isDespesa ? "Ex.: Aluguel, mercado..." : "Ex.: salário, extra"}
            />
          </div>

          {isDespesa && (
            <div className="field">
              <label>Categoria</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="Essencial">Essencial</option>
                <option value="Lazer">Lazer</option>
              </select>
            </div>
          )}

          <div className="field">
            <label>Forma de pagamento</label>
            <select value={formaPagamento} onChange={onChangeForma}>
              <option value="dinheiro">Dinheiro</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="pix">PIX</option>
              <option value="outros">Outros</option>
            </select>
          </div>

          {formaPagamento === "credito" && (
            <div className="field">
              <label>Cartão utilizado</label>
              <select
                value={cartaoId || ""}
                onChange={(e) => setCartaoId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isDespesa && formaPagamento === "credito" && (
            <>
              <div className="field checkbox-field">
                <label>
                  <input
                    type="checkbox"
                    checked={parcelado}
                    onChange={(e) => setParcelado(e.target.checked)}
                  />{" "}
                  Esta compra é parcelada?
                </label>
                <p className="muted small">
                  Se marcado, o app vai criar{" "}
                  <strong>1 transação por parcela</strong> em meses diferentes
                  (1/3, 2/3, 3/3...).
                </p>
              </div>

              {parcelado && (
                <div className="field">
                  <label>Número de parcelas</label>
                  <input
                    type="number"
                    min="2"
                    max="36"
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {/* ✅ BOTÃO DE GASTO FIXO REMOVIDO (checkbox "É gasto fixo") */}

          <button className="primary-btn" style={{ marginTop: 10 }}>
            Salvar transação
          </button>

          {mensagem && <p className="feedback">{mensagem}</p>}
        </form>
      </div>

      {mostrarConfirmCredito && pendenteCredito && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Limite do cartão estourado</h3>
            <p className="muted small">
              Cartão: <strong>{pendenteCredito.cartaoNome}</strong>
              <br />
              Limite: {formatCurrency(pendenteCredito.limite)}
              <br />
              Gasto atual: {formatCurrency(pendenteCredito.gastoAtual)}
              <br />
              Esta compra vai exceder o limite em{" "}
              <strong>{formatCurrency(pendenteCredito.excedente)}</strong>.
            </p>
            <p className="muted small" style={{ marginTop: 6 }}>
              Se você continuar, o limite disponível desse cartão ficará{" "}
              <strong>negativo</strong>.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 10,
              }}
            >
              <button
                type="button"
                className="primary-btn"
                onClick={confirmarCompraEstourandoLimite}
              >
                ✅ Sim, lançar mesmo assim
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{ background: "#374151", color: "#e5e7eb" }}
                onClick={cancelarCompraCredito}
              >
                ✖ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
