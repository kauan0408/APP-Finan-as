// src/pages/CartoesPage.jsx
import React, { useMemo, useState } from "react";
import { useFinance } from "../App.jsx";

function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CartoesPage() {
  const {
    cartoes,
    transacoes,
    adicionarCartao,
    atualizarCartoes,
    adicionarTransacao,
  } = useFinance();

  const [mostrarFormNovo, setMostrarFormNovo] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [limiteNovo, setLimiteNovo] = useState("");
  const [diaFechamentoNovo, setDiaFechamentoNovo] = useState("");

  const [cartaoEditando, setCartaoEditando] = useState(null); // {id, nome, limite, diaFechamento}
  const [cartaoParaExcluir, setCartaoParaExcluir] = useState(null); // id

  // 🧱 ESTADO PARA PAGAMENTO DE FATURA (feche data)
  const [pagandoCartao, setPagandoCartao] = useState(null); // { id, nome, valorEmAberto }
  const [valorPagamento, setValorPagamento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");

  // resumo de cada cartão (quanto já foi gasto - quanto já foi pago)
  const resumoCartoes = useMemo(() => {
    return cartoes.map((cartao) => {
      // todas as compras no crédito desse cartão
      const compras = transacoes.filter(
        (t) =>
          t.tipo === "despesa" &&
          t.formaPagamento === "credito" &&
          t.cartaoId === cartao.id
      );
      const totalCompras = compras.reduce(
        (soma, t) => soma + Number(t.valor || 0),
        0
      );

      // todos os pagamentos de fatura desse cartão
      const pagamentos = transacoes.filter(
        (t) => t.tipo === "pagamentoCartao" && t.cartaoId === cartao.id
      );
      const totalPagamentos = pagamentos.reduce(
        (soma, t) => soma + Number(t.valor || 0),
        0
      );

      // quanto ainda está "pendurado" no cartão
      const totalGasto = Math.max(0, totalCompras - totalPagamentos);

      const perc =
        cartao.limite > 0
          ? Math.min(100, (totalGasto / cartao.limite) * 100)
          : 0;

      const limiteDisponivel = cartao.limite - totalGasto;

      return {
        ...cartao,
        totalGasto,
        percGasto: perc,
        limiteDisponivel,
      };
    });
  }, [cartoes, transacoes]);

  function handleCadastrarCartao(e) {
    e.preventDefault();
    if (!nomeNovo.trim()) return;

    adicionarCartao({
      nome: nomeNovo.trim(),
      limite: Number(String(limiteNovo).replace(",", ".")) || 0,
      diaFechamento: Number(diaFechamentoNovo) || 1,
    });

    setNomeNovo("");
    setLimiteNovo("");
    setDiaFechamentoNovo("");
    setMostrarFormNovo(false);
  }

  function iniciarEdicao(cartao) {
    setCartaoEditando({
      id: cartao.id,
      nome: cartao.nome,
      limite: cartao.limite,
      diaFechamento: cartao.diaFechamento,
    });
  }

  function salvarEdicao() {
    if (!cartaoEditando) return;
    const { id, nome, limite, diaFechamento } = cartaoEditando;

    const novos = cartoes.map((c) =>
      c.id === id
        ? {
            ...c,
            nome: nome || "",
            limite: Number(limite || 0),
            diaFechamento: Number(diaFechamento || 1),
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
    const filtrados = cartoes.filter((c) => c.id !== cartaoParaExcluir);
    atualizarCartoes(filtrados);
    setCartaoParaExcluir(null);
  }

  function cancelarExclusao() {
    setCartaoParaExcluir(null);
  }

  // 🧾 INICIAR PAGAMENTO DA FATURA (abre feche data)
  function iniciarPagamento(cartao) {
    const valorEmAberto = cartao.totalGasto > 0 ? cartao.totalGasto : 0;
    setPagandoCartao({
      id: cartao.id,
      nome: cartao.nome,
      valorEmAberto,
    });
    setValorPagamento(
      valorEmAberto ? valorEmAberto.toFixed(2).replace(".", ",") : ""
    );
    setFormaPagamento("dinheiro");
  }

  // ✅ CONFIRMAR PAGAMENTO (cria transação tipo "pagamentoCartao")
  function confirmarPagamentoFatura() {
    if (!pagandoCartao) return;

    const v = parseFloat(String(valorPagamento).replace(",", "."));
    if (isNaN(v) || v <= 0) {
      alert("Informe um valor válido para o pagamento.");
      return;
    }

    if (v > pagandoCartao.valorEmAberto + 0.01) {
      alert("O valor pago não pode ser maior que o valor em aberto.");
      return;
    }

    adicionarTransacao({
      tipo: "pagamentoCartao",
      valor: v,
      descricao: `Pagamento fatura - ${pagandoCartao.nome}`,
      formaPagamento,
      cartaoId: pagandoCartao.id,
      dataHora: new Date().toISOString(),
      parcelaAtual: null,
      parcelaTotal: null,
    });

    setPagandoCartao(null);
    setValorPagamento("");
  }

  function cancelarPagamentoFatura() {
    setPagandoCartao(null);
    setValorPagamento("");
  }

  return (
    <div className="page">
      <h2 className="page-title">Cartões</h2>

      {/* CARD DE CADASTRO COM BOTÃO + */}
      <div className="card card-cadastro-cartao">
        <div className="card-header-row">
          <h3>Cartões de crédito</h3>
          <button
            type="button"
            className={
              "icon-btn " + (mostrarFormNovo ? "icon-btn-active" : "")
            }
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
            <button className="primary-btn" type="submit">
              Cadastrar cartão
            </button>
          </form>
        )}
      </div>

      {/* LISTA DE CARTÕES */}
      {resumoCartoes.length === 0 ? (
        <p className="muted mt">
          Nenhum cartão cadastrado. Use o botão <strong>+</strong> acima
          para adicionar.
        </p>
      ) : (
        resumoCartoes.map((cartao) => {
          const emEdicao =
            cartaoEditando && cartaoEditando.id === cartao.id;

          return (
            <div key={cartao.id} className="card mt">
              {!emEdicao ? (
                <>
                  <div className="history-day-header">
                    <div>
                      <h3>{cartao.nome}</h3>
                      <p className="muted small">
                        Limite: {formatCurrency(cartao.limite)} · Fechamento:
                        dia {cartao.diaFechamento || 1}
                      </p>
                      <p className="muted small">
                        {cartao.limiteDisponivel >= 0
                          ? `Limite disponível: ${formatCurrency(
                              cartao.limiteDisponivel
                            )}`
                          : `Limite disponível: ${formatCurrency(
                              cartao.limiteDisponivel
                            )} (limite estourado)`}
                      </p>
                    </div>
                    <div className="align-right">
                      <p className="history-summary-label">Gasto atual</p>
                      <p className="history-summary-value negative">
                        {formatCurrency(cartao.totalGasto)}
                      </p>
                    </div>
                  </div>

                  <div className="progress-container">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${cartao.percGasto.toFixed(0)}%` }}
                      />
                    </div>
                    <span className="progress-label">
                      {cartao.percGasto.toFixed(0)}% do limite usado.
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
                    <button
                      type="button"
                      className="toggle-btn"
                      onClick={() => iniciarPagamento(cartao)}
                    >
                      💸 Pagar fatura
                    </button>
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
                        setCartaoEditando((prev) => ({
                          ...prev,
                          nome: e.target.value,
                        }))
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
                        setCartaoEditando((prev) => ({
                          ...prev,
                          limite: e.target.value,
                        }))
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

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 10,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      className="toggle-btn"
                      onClick={cancelarEdicao}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={salvarEdicao}
                    >
                      Salvar alterações
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {cartaoParaExcluir && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Excluir cartão?</h3>
            <p className="muted small" style={{ marginBottom: 14 }}>
              Tem certeza de que deseja excluir este cartão? As transações
              antigas continuarão existindo, mas não estarão mais ligadas
              a um cartão cadastrado.
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 10,
              }}
            >
              <button
                type="button"
                className="toggle-btn"
                onClick={cancelarExclusao}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={confirmarExclusao}
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🧱 MODAL DE PAGAMENTO DE FATURA (feche data) */}
      {pagandoCartao && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Pagar fatura do cartão</h3>
            <p className="muted small">
              Cartão: <strong>{pagandoCartao.nome}</strong>
              <br />
              Valor em aberto:{" "}
              <strong>{formatCurrency(pagandoCartao.valorEmAberto)}</strong>
            </p>

            <div className="field" style={{ marginTop: 10 }}>
              <label>Valor do pagamento (R$)</label>
              <input
                type="text"
                value={valorPagamento}
                onChange={(e) => setValorPagamento(e.target.value)}
                placeholder="Ex.: 250,00"
              />
            </div>

            <div className="field">
              <label>Forma de pagamento</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option>
                <option value="pix">PIX</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            <p className="muted small" style={{ marginTop: 6 }}>
              Esse pagamento não cria nova compra no crédito. Ele apenas reduz o{" "}
              <strong>gasto atual</strong> desse cartão.
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
                onClick={confirmarPagamentoFatura}
              >
                ✅ Confirmar pagamento
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{ background: "#374151", color: "#e5e7eb" }}
                onClick={cancelarPagamentoFatura}
              >
                ✖ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
