// src/pages/CartoesPage.jsx
import React, { useMemo, useState } from "react";
import { useFinance } from "../App.jsx";

function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function parseMoney(v) {
  const n = Number(String(v || "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export default function CartoesPage() {
  const {
    cartoes,
    transacoes,
    adicionarCartao,
    atualizarCartoes,
    adicionarTransacao, // ✅ necessário para registrar pagamentos
    mesReferencia, // mesmo mês da tela Finanças
  } = useFinance();

  // ✅ marcador pra você bater o olho e saber que é o arquivo certo
  // (se não quiser, pode apagar depois)

  const [mostrarFormNovo, setMostrarFormNovo] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [limiteNovo, setLimiteNovo] = useState("");
  const [diaFechamentoNovo, setDiaFechamentoNovo] = useState("");
  const [diaVencimentoNovo, setDiaVencimentoNovo] = useState("");

  const [cartaoEditando, setCartaoEditando] = useState(null);
  const [cartaoParaExcluir, setCartaoParaExcluir] = useState(null);

  // Modal pagamento (adiantar / pagar agora)
  const [modalPagamento, setModalPagamento] = useState(null);
  // modalPagamento = { cartaoId, valorSugerido, titulo }

  const hoje = new Date();

  // Transações somente do mês/ano selecionado (para “gasto no mês” / “fatura do mês”)
  const transacoesDoMes = useMemo(() => {
    const { mes, ano } = mesReferencia;
    return transacoes.filter((t) => {
      if (!t?.dataHora) return false;
      const d = new Date(t.dataHora);
      return d.getMonth() === mes && d.getFullYear() === ano;
    });
  }, [transacoes, mesReferencia]);

  // Transações desde o mês selecionado (para limite comprometido “de agora pra frente”)
  const transacoesDesdeMes = useMemo(() => {
    const { mes, ano } = mesReferencia;
    const inicioMes = new Date(ano, mes, 1);
    return transacoes.filter((t) => {
      if (!t?.dataHora) return false;
      const d = new Date(t.dataHora);
      return d >= inicioMes;
    });
  }, [transacoes, mesReferencia]);

  // Resumo por cartão com pagamentos abatendo compras
  const resumoCartoes = useMemo(() => {
    return cartoes.map((cartao) => {
      const cartaoId = cartao.id;

      // compras no mês (parcelas que caem no mês escolhido)
      const comprasMes = transacoesDoMes.filter(
        (t) =>
          t.tipo === "despesa" &&
          t.formaPagamento === "credito" &&
          t.cartaoId === cartaoId
      );
      const totalComprasMes = comprasMes.reduce(
        (s, t) => s + Number(t.valor || 0),
        0
      );

      // pagamentos no mês (pagamentoCartao)
      const pagamentosMes = transacoesDoMes.filter(
        (t) => t.tipo === "pagamentoCartao" && t.cartaoId === cartaoId
      );
      const totalPagamentosMes = pagamentosMes.reduce(
        (s, t) => s + Number(t.valor || 0),
        0
      );

      // “fatura” do mês (não deixa ficar negativa)
      const faturaMesAberta = Math.max(0, totalComprasMes - totalPagamentosMes);

      // compras desse mês em diante (compromete limite)
      const comprasComp = transacoesDesdeMes.filter(
        (t) =>
          t.tipo === "despesa" &&
          t.formaPagamento === "credito" &&
          t.cartaoId === cartaoId
      );
      const totalComprasComp = comprasComp.reduce(
        (s, t) => s + Number(t.valor || 0),
        0
      );

      // pagamentos desse mês em diante (libera limite)
      const pagamentosComp = transacoesDesdeMes.filter(
        (t) => t.tipo === "pagamentoCartao" && t.cartaoId === cartaoId
      );
      const totalPagamentosComp = pagamentosComp.reduce(
        (s, t) => s + Number(t.valor || 0),
        0
      );

      // limite comprometido “real”
      const totalComprometido = Math.max(0, totalComprasComp - totalPagamentosComp);

      const percComprometido =
        cartao.limite > 0
          ? Math.min(100, (totalComprometido / cartao.limite) * 100)
          : 0;

      const limiteDisponivel = Number(cartao.limite || 0) - totalComprometido;

      // vencimento: se não existir, default 1 (você pode editar depois)
      const diaVencimento = Number(cartao.diaVencimento || 1);

      // quando chegar no vencimento do mês atual, mostra botão “pagou?”
      const vencimentoChegou = hoje.getDate() >= diaVencimento;

      return {
        ...cartao,
        diaVencimento,
        totalComprasMes,
        totalPagamentosMes,
        faturaMesAberta,
        totalComprometido,
        percComprometido,
        limiteDisponivel,
        vencimentoChegou,
      };
    });
  }, [cartoes, transacoesDoMes, transacoesDesdeMes]);

  function handleCadastrarCartao(e) {
    e.preventDefault();
    if (!nomeNovo.trim()) return;

    const limite = parseMoney(limiteNovo);
    const fechamento = clamp(parseInt(diaFechamentoNovo || "1", 10) || 1, 1, 31);
    const vencimento = clamp(parseInt(diaVencimentoNovo || "1", 10) || 1, 1, 31);

    adicionarCartao({
      nome: nomeNovo.trim(),
      limite,
      diaFechamento: fechamento,
      diaVencimento: vencimento, // ✅ novo
    });

    setNomeNovo("");
    setLimiteNovo("");
    setDiaFechamentoNovo("");
    setDiaVencimentoNovo("");
    setMostrarFormNovo(false);
  }

  function iniciarEdicao(cartao) {
    setCartaoEditando({
      id: cartao.id,
      nome: cartao.nome,
      limite: cartao.limite,
      diaFechamento: cartao.diaFechamento || 1,
      diaVencimento: cartao.diaVencimento || 1,
    });
  }

  function salvarEdicao() {
    if (!cartaoEditando) return;
    const { id, nome, limite, diaFechamento, diaVencimento } = cartaoEditando;

    const novos = cartoes.map((c) =>
      c.id === id
        ? {
            ...c,
            nome: (nome || "").trim(),
            limite: Number(limite || 0),
            diaFechamento: clamp(Number(diaFechamento || 1), 1, 31),
            diaVencimento: clamp(Number(diaVencimento || 1), 1, 31),
          }
        : c
    );

    atualizarCartoes(novos);
    setCartaoEditando(null);
  }

  function cancelarEdicao() {
    setCartaoEditando(null);
  }

  function pedirExclusao(cartaoId) {
    setCartaoParaExcluir(cartaoId);
  }

  function confirmarExclusao() {
    if (!cartaoParaExcluir) return;
    atualizarCartoes(cartoes.filter((c) => c.id !== cartaoParaExcluir));
    setCartaoParaExcluir(null);
  }

  function cancelarExclusao() {
    setCartaoParaExcluir(null);
  }

  function abrirModalPagamento(cartao, titulo) {
    if (!adicionarTransacao) {
      alert(
        "Erro: adicionarTransacao não está disponível no useFinance().\n" +
          "Você precisa expor essa função no App.jsx."
      );
      return;
    }

    setModalPagamento({
      cartaoId: cartao.id,
      titulo,
      valorSugerido: cartao.faturaMesAberta || 0,
      valorDigitado: cartao.faturaMesAberta || 0,
    });
  }

  function fecharModalPagamento() {
    setModalPagamento(null);
  }

  function confirmarPagamento() {
    if (!modalPagamento) return;

    const cartaoId = modalPagamento.cartaoId;
    const valor = parseMoney(modalPagamento.valorDigitado);

    if (valor <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    const cartao = cartoes.find((c) => c.id === cartaoId);
    const nome = cartao?.nome || "Cartão";

    // ✅ registra pagamento como transação
    adicionarTransacao({
      tipo: "pagamentoCartao",
      valor,
      descricao: `Pagamento cartão - ${nome}`,
      categoria: null,
      formaPagamento: "outros",
      cartaoId,
      fixo: false,
      dataHora: new Date().toISOString(),
    });

    fecharModalPagamento();
  }

  return (
    <div className="page">
      <h2 className="page-title">Cartões</h2>

      <p style={{ color: "yellow", fontSize: 12, marginTop: -6 }}>{VERSAO}</p>

      {/* CARD DE CADASTRO COM BOTÃO + */}
      <div className="card card-cadastro-cartao">
        <div className="card-header-row">
          <h3>Cartões de crédito</h3>
          <button
            type="button"
            className={"icon-btn " + (mostrarFormNovo ? "icon-btn-active" : "")}
            onClick={() => setMostrarFormNovo((v) => !v)}
          >
            {mostrarFormNovo ? "−" : "+"}
          </button>
        </div>

        {mostrarFormNovo && (
          <form className="form form-slide" onSubmit={handleCadastrarCartao}>
            <div className="field">
              <label>Nome do cartão</label>
              <input
                type="text"
                value={nomeNovo}
                onChange={(e) => setNomeNovo(e.target.value)}
                placeholder="Ex.: Nubank, Inter..."
              />
            </div>

            <div className="field">
              <label>Limite de crédito (R$)</label>
              <input
                type="number"
                step="0.01"
                value={limiteNovo}
                onChange={(e) => setLimiteNovo(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Dia de fechamento da fatura</label>
              <input
                type="number"
                min="1"
                max="31"
                value={diaFechamentoNovo}
                onChange={(e) => setDiaFechamentoNovo(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Dia de vencimento (pagamento)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={diaVencimentoNovo}
                onChange={(e) => setDiaVencimentoNovo(e.target.value)}
              />
              <p className="muted small">
                Quando chegar esse dia, o app mostra o botão <strong>“Pagar fatura agora?”</strong>.
              </p>
            </div>

            <button className="primary-btn" type="submit">
              Cadastrar cartão
            </button>
          </form>
        )}
      </div>

      {/* LISTA DE CARTÕES */}
      {resumoCartoes.length === 0 ? (
        <p className="muted mt">
          Nenhum cartão cadastrado. Use o botão <strong>+</strong> acima para
          adicionar.
        </p>
      ) : (
        resumoCartoes.map((cartao) => {
          const emEdicao = cartaoEditando && cartaoEditando.id === cartao.id;

          return (
            <div key={cartao.id} className="card mt">
              {!emEdicao ? (
                <>
                  <div className="history-day-header">
                    <div>
                      <h3>{cartao.nome}</h3>

                      <p className="muted small">
                        Limite total: {formatCurrency(cartao.limite)} · Fechamento: dia{" "}
                        {cartao.diaFechamento || 1} · Vencimento: dia{" "}
                        {cartao.diaVencimento || 1}
                      </p>

                      <p className="muted small">
                        Limite disponível (compras − pagamentos):{" "}
                        {formatCurrency(cartao.limiteDisponivel)}
                      </p>

                      <p className="muted small">
                        Fatura do mês (aberta):{" "}
                        <strong>{formatCurrency(cartao.faturaMesAberta)}</strong>
                      </p>
                    </div>

                    <div className="align-right">
                      <p className="history-summary-label">Compras neste mês</p>
                      <p className="history-summary-value negative">
                        {formatCurrency(cartao.totalComprasMes)}
                      </p>
                      {cartao.totalPagamentosMes > 0 && (
                        <p className="muted small" style={{ marginTop: 2 }}>
                          Pagamentos: {formatCurrency(cartao.totalPagamentosMes)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="progress-container">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${cartao.percComprometido.toFixed(0)}%` }}
                      />
                    </div>
                    <span className="progress-label">
                      {cartao.percComprometido.toFixed(0)}% do limite está comprometido (parcelas deste mês e próximos, menos pagamentos).
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 10,
                      justifyContent: "flex-end",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* ✅ Botão adiantamento (pode pagar parcial ou total) */}
                    <button
                      type="button"
                      className="toggle-btn"
                      onClick={() => abrirModalPagamento(cartao, "Adiantar pagamento")}
                    >
                      💸 Adiantar pagamento
                    </button>

                    {/* ✅ Quando chega o vencimento, pergunta se pagou */}
                    {cartao.vencimentoChegou && cartao.faturaMesAberta > 0 && (
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ width: "auto", padding: "8px 14px" }}
                        onClick={() => abrirModalPagamento(cartao, "Pagar fatura agora?")}
                      >
                        ✅ Pagar fatura agora?
                      </button>
                    )}

                    <button
                      type="button"
                      className="toggle-btn"
                      onClick={() => iniciarEdicao(cartao)}
                    >
                      ✏️ Editar
                    </button>

                    <button
                      type="button"
                      className="toggle-btn"
                      onClick={() => pedirExclusao(cartao.id)}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3>Editar cartão</h3>

                  <div className="field">
                    <label>Nome do cartão</label>
                    <input
                      type="text"
                      value={cartaoEditando.nome}
                      onChange={(e) =>
                        setCartaoEditando((prev) => ({ ...prev, nome: e.target.value }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Limite de crédito (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cartaoEditando.limite}
                      onChange={(e) =>
                        setCartaoEditando((prev) => ({ ...prev, limite: e.target.value }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Dia de fechamento da fatura</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cartaoEditando.diaFechamento}
                      onChange={(e) =>
                        setCartaoEditando((prev) => ({
                          ...prev,
                          diaFechamento: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Dia de vencimento (pagamento)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cartaoEditando.diaVencimento}
                      onChange={(e) =>
                        setCartaoEditando((prev) => ({
                          ...prev,
                          diaVencimento: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 10,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button type="button" className="toggle-btn" onClick={cancelarEdicao}>
                      Cancelar
                    </button>
                    <button type="button" className="primary-btn" onClick={salvarEdicao}>
                      Salvar alterações
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })
      )}

      {/* MODAL DE PAGAMENTO (adiantar / pagar agora) */}
      {modalPagamento && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>{modalPagamento.titulo}</h3>

            <p className="muted small">
              Você pode pagar <strong>uma parte</strong> ou <strong>tudo</strong>.
            </p>

            <div className="field" style={{ marginTop: 10 }}>
              <label>Valor pago (R$)</label>
              <input
                type="number"
                step="0.01"
                value={modalPagamento.valorDigitado}
                onChange={(e) =>
                  setModalPagamento((prev) => ({
                    ...prev,
                    valorDigitado: e.target.value,
                  }))
                }
              />
              <p className="muted small" style={{ marginTop: 6 }}>
                Sugerido: {formatCurrency(modalPagamento.valorSugerido)}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="toggle-btn" onClick={fecharModalPagamento}>
                Cancelar
              </button>
              <button type="button" className="primary-btn" onClick={confirmarPagamento}>
                Confirmar pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {cartaoParaExcluir && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Excluir cartão?</h3>
            <p className="muted small" style={{ marginBottom: 14 }}>
              Tem certeza de que deseja excluir este cartão? As transações antigas continuarão existindo,
              mas não estarão mais ligadas a um cartão cadastrado.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
              <button type="button" className="toggle-btn" onClick={cancelarExclusao}>
                Cancelar
              </button>
              <button type="button" className="primary-btn" onClick={confirmarExclusao}>
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

