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
    mesReferencia, // 👈 mesmo mês da tela Finanças
  } = useFinance();

  const [mostrarFormNovo, setMostrarFormNovo] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [limiteNovo, setLimiteNovo] = useState("");
  const [diaFechamentoNovo, setDiaFechamentoNovo] = useState("");

  const [cartaoEditando, setCartaoEditando] = useState(null);
  const [cartaoParaExcluir, setCartaoParaExcluir] = useState(null);

  // 🔄 Transações SOMENTE do mês/ano selecionado (para "gasto no mês")
  const transacoesDoMes = useMemo(() => {
    const { mes, ano } = mesReferencia;
    return transacoes.filter((t) => {
      if (!t.dataHora) return false;
      const d = new Date(t.dataHora);
      return d.getMonth() === mes && d.getFullYear() === ano;
    });
  }, [transacoes, mesReferencia]);

  // 🔄 Transações de crédito DESSE mês em diante (para limite comprometido)
  const transacoesDesdeMes = useMemo(() => {
    const { mes, ano } = mesReferencia;
    const inicioMes = new Date(ano, mes, 1);
    return transacoes.filter((t) => {
      if (!t.dataHora) return false;
      const d = new Date(t.dataHora);
      // tudo que é desse mês ou futuro conta pro limite
      return d >= inicioMes;
    });
  }, [transacoes, mesReferencia]);

  // resumo de cada cartão:
  // - totalGastoMes: só parcelas que caem no mês escolhido
  // - totalComprometido: parcelas desse mês em diante (mês atual + futuros)
  const resumoCartoes = useMemo(() => {
    return cartoes.map((cartao) => {
      // 📌 GASTO NO MÊS (apenas as parcelas do mês atual)
      const comprasMes = transacoesDoMes.filter(
        (t) =>
          t.tipo === "despesa" &&
          t.formaPagamento === "credito" &&
          t.cartaoId === cartao.id
      );

      const totalGastoMes = comprasMes.reduce(
        (soma, t) => soma + Number(t.valor || 0),
        0
      );

      // 📌 LIMITE COMPROMETIDO (todas parcelas desse mês em diante)
      const comprasComprometidas = transacoesDesdeMes.filter(
        (t) =>
          t.tipo === "despesa" &&
          t.formaPagamento === "credito" &&
          t.cartaoId === cartao.id
      );

      const totalComprometido = comprasComprometidas.reduce(
        (soma, t) => soma + Number(t.valor || 0),
        0
      );

      const percComprometido =
        cartao.limite > 0
          ? Math.min(100, (totalComprometido / cartao.limite) * 100)
          : 0;

      const limiteDisponivel = cartao.limite - totalComprometido;

      return {
        ...cartao,
        totalGastoMes,
        totalComprometido,
        percComprometido,
        limiteDisponivel,
      };
    });
  }, [cartoes, transacoesDoMes, transacoesDesdeMes]);

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
                        Limite total: {formatCurrency(cartao.limite)} ·
                        Fechamento: dia {cartao.diaFechamento || 1}
                      </p>
                      <p className="muted small">
                        Limite disponível (parcelas atuais + futuras):{" "}
                        {formatCurrency(cartao.limiteDisponivel)}
                      </p>
                    </div>
                    <div className="align-right">
                      <p className="history-summary-label">Gasto neste mês</p>
                      <p className="history-summary-value negative">
                        {formatCurrency(cartao.totalGastoMes)}
                      </p>
                    </div>
                  </div>

                  <div className="progress-container">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${cartao.percComprometido.toFixed(0)}%`,
                        }}
                      />
                    </div>
                    <span className="progress-label">
                      {cartao.percComprometido.toFixed(0)}% do limite está
                      comprometido com parcelas deste mês e dos próximos.
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
    </div>
  );
}
