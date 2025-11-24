// src/pages/HistoricoPage.jsx
import React, { useMemo, useState } from "react";
import { useFinance } from "../App.jsx";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoricoPage() {
  const {
    transacoes,
    cartoes,
    atualizarTransacao,
    removerTransacao,
    mesReferencia, // 👈 mês da Visão geral
  } = useFinance();

  const [tipoFilter, setTipoFilter] = useState("todos");
  const [categoriaFilter, setCategoriaFilter] = useState("todas");
  const [formaFilter, setFormaFilter] = useState("todas");
  const [cartaoFilter, setCartaoFilter] = useState("todos");
  const [textoFilter, setTextoFilter] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // 🔧 estados para edição
  const [editando, setEditando] = useState(null);
  const [descricaoEdit, setDescricaoEdit] = useState("");
  const [valorEdit, setValorEdit] = useState("");
  const [tipoEdit, setTipoEdit] = useState("despesa");
  const [categoriaEdit, setCategoriaEdit] = useState("Essencial");
  const [formaEdit, setFormaEdit] = useState("dinheiro");
  const [cartaoEdit, setCartaoEdit] = useState("");

  // 🗑️ modal de exclusão
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null);

  const cartaoNomePorId = useMemo(() => {
    const map = {};
    cartoes.forEach((c) => (map[c.id] = c.nome));
    return map;
  }, [cartoes]);

  const resultado = useMemo(() => {
    // 1) LISTA BASE = tudo que já foi lançado, com filtros (tipo, categoria, forma, cartão, texto, datas)
    let listaBase = [...transacoes];

    if (tipoFilter !== "todos") {
      listaBase = listaBase.filter((t) => t.tipo === tipoFilter);
    }
    if (categoriaFilter !== "todas") {
      listaBase = listaBase.filter(
        (t) =>
          (t.categoria || "").toLowerCase() ===
          categoriaFilter.toLowerCase()
      );
    }
    if (formaFilter !== "todas") {
      listaBase = listaBase.filter((t) => t.formaPagamento === formaFilter);
    }
    if (cartaoFilter !== "todos") {
      listaBase = listaBase.filter((t) => t.cartaoId === cartaoFilter);
    }
    if (textoFilter.trim()) {
      const txt = textoFilter.toLowerCase();
      listaBase = listaBase.filter((t) =>
        (t.descricao || "").toLowerCase().includes(txt)
      );
    }
    if (dataInicio) {
      const di = new Date(dataInicio + "T00:00:00");
      listaBase = listaBase.filter((t) => new Date(t.dataHora) >= di);
    }
    if (dataFim) {
      const df = new Date(dataFim + "T23:59:59");
      listaBase = listaBase.filter((t) => new Date(t.dataHora) <= df);
    }

    // 2) LISTA PARA O RESUMO (lá de cima)
    // - Se tiver data início/fim, o resumo usa esse período.
    // - Se NÃO tiver datas, o resumo usa só o mês da Visão geral.
    let listaResumo = [...listaBase];

    if (!dataInicio && !dataFim && mesReferencia) {
      const { mes, ano } = mesReferencia;
      listaResumo = listaBase.filter((t) => {
        const dt = new Date(t.dataHora);
        return dt.getMonth() === mes && dt.getFullYear() === ano;
      });
    }

    let totalDespesasResumo = 0;
    let totalReceitasResumo = 0;

    listaResumo.forEach((t) => {
      const valor = Number(t.valor || 0);
      if (t.tipo === "despesa") totalDespesasResumo += valor;
      if (t.tipo === "receita") totalReceitasResumo += valor;
    });

    // 3) AGRUPAMENTO POR DIA PARA A LISTA DE BAIXO (usa TUDO da listaBase)
    const porDia = {};
    listaBase.forEach((t) => {
      const d = formatDate(t.dataHora);
      if (!porDia[d]) porDia[d] = { itens: [], totalDia: 0 };

      porDia[d].itens.push(t);

      const valor = Number(t.valor || 0);
      porDia[d].totalDia += t.tipo === "despesa" ? -valor : valor;
    });

    const diasOrdenados = Object.keys(porDia).sort((a, b) => {
      const [da, ma, aa] = a.split("/").map(Number);
      const [db, mb, ab] = b.split("/").map(Number);
      return new Date(ab, mb - 1, db) - new Date(aa, ma - 1, da);
    });

    return {
      porDia,
      diasOrdenados,
      totalDespesasResumo,
      totalReceitasResumo,
      totalTransacoesResumo: listaResumo.length, // para o card de cima
      totalTransacoesLista: listaBase.length, // para saber se tem algo na lista de baixo
    };
  }, [
    transacoes,
    tipoFilter,
    categoriaFilter,
    formaFilter,
    cartaoFilter,
    textoFilter,
    dataInicio,
    dataFim,
    mesReferencia,
  ]);

  const {
    porDia,
    diasOrdenados,
    totalDespesasResumo,
    totalReceitasResumo,
    totalTransacoesResumo,
    totalTransacoesLista,
  } = resultado;

  const saldoPeriodo = totalReceitasResumo - totalDespesasResumo;

  const nomeMes = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ][mesReferencia.mes];

  // 🔧 abrir modal de edição
  const abrirEdicao = (t) => {
    setEditando(t);
    setDescricaoEdit(t.descricao || "");
    setValorEdit(String(t.valor || ""));
    setTipoEdit(t.tipo || "despesa");
    setCategoriaEdit(t.categoria || "Essencial");
    setFormaEdit(t.formaPagamento || "dinheiro");
    setCartaoEdit(t.cartaoId || "");
  };

  const fecharEdicao = () => {
    setEditando(null);
    setDescricaoEdit("");
    setValorEdit("");
    setTipoEdit("despesa");
    setCategoriaEdit("Essencial");
    setFormaEdit("dinheiro");
    setCartaoEdit("");
  };

  const salvarEdicao = () => {
    if (!editando) return;

    const v = parseFloat(String(valorEdit).replace(",", "."));
    if (isNaN(v) || v <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    const dadosAtualizados = {
      tipo: tipoEdit,
      valor: v,
      descricao: descricaoEdit,
      categoria: tipoEdit === "despesa" ? categoriaEdit : null,
      formaPagamento: formaEdit,
      cartaoId: formaEdit === "credito" ? cartaoEdit || null : null,
    };

    atualizarTransacao(editando.id, dadosAtualizados);
    fecharEdicao();
  };

  // 🗑️ confirmar exclusão
  const confirmarApagar = () => {
    if (!confirmandoExclusao) return;

    removerTransacao(confirmandoExclusao.id);

    if (editando && editando.id === confirmandoExclusao.id) {
      fecharEdicao();
    }

    setConfirmandoExclusao(null);
  };

  const cancelarApagar = () => {
    setConfirmandoExclusao(null);
  };

  return (
    <div className="page">
      <h2 className="page-title">Histórico</h2>

      {/* Resumo (segue mês da Visão Geral ou período das datas) */}
      <div className="card history-summary">
        <h3>
          Resumo de {nomeMes} / {mesReferencia.ano}
        </h3>
        {totalTransacoesResumo === 0 ? (
          <p className="muted small">
            Nenhuma transação nesse período (mês ou datas escolhidas).
          </p>
        ) : (
          <div className="history-summary-grid">
            <div>
              <p className="history-summary-label">Transações</p>
              <p className="history-summary-value">
                {totalTransacoesResumo}
              </p>
            </div>
            <div>
              <p className="history-summary-label">Receitas</p>
              <p className="history-summary-value positive">
                {formatCurrency(totalReceitasResumo)}
              </p>
            </div>
            <div>
              <p className="history-summary-label">Despesas</p>
              <p className="history-summary-value negative">
                {formatCurrency(totalDespesasResumo)}
              </p>
            </div>
            <div>
              <p className="history-summary-label">Saldo</p>
              <p
                className={
                  "history-summary-value " +
                  (saldoPeriodo >= 0 ? "positive" : "negative")
                }
              >
                {formatCurrency(saldoPeriodo)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="card filters-card mt">
        <h3>Filtros</h3>

        <div className="chips-row">
          <button
            type="button"
            className={
              "chip " + (tipoFilter === "todos" ? "chip-active" : "")
            }
            onClick={() => setTipoFilter("todos")}
          >
            Todos
          </button>
          <button
            type="button"
            className={
              "chip " + (tipoFilter === "despesa" ? "chip-active" : "")
            }
            onClick={() => setTipoFilter("despesa")}
          >
            Despesas
          </button>
          <button
            type="button"
            className={
              "chip " + (tipoFilter === "receita" ? "chip-active" : "")
            }
            onClick={() => setTipoFilter("receita")}
          >
            Receitas
          </button>
        </div>

        <div className="filters-grid">
          <div className="field">
            <label>Categoria</label>
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
            >
              <option value="todas">Todas</option>
              <option value="Essencial">Essencial</option>
              <option value="Besteira">Besteira</option>
              <option value="Lazer">Lazer</option>
            </select>
          </div>
          <div className="field">
            <label>Forma de pagamento</label>
            <select
              value={formaFilter}
              onChange={(e) => setFormaFilter(e.target.value)}
            >
              <option value="todas">Todas</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="pix">PIX</option>
              <option value="outros">Outros</option>
            </select>
          </div>
          <div className="field">
            <label>Cartão</label>
            <select
              value={cartaoFilter}
              onChange={(e) => setCartaoFilter(e.target.value)}
            >
              <option value="todos">Todos</option>
              {cartoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Data início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Data fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Buscar texto</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={textoFilter}
                onChange={(e) => setTextoFilter(e.target.value)}
                placeholder="Descrição, forma, cartão..."
              />
              <button
                type="button"
                className="primary-btn"
                style={{ width: "auto", padding: "8px 12px" }}
                onClick={() => {}}
              >
                🔎
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista por dia – aqui vai TUDO (de toda a vida), com filtros, SEM limitar por mês */}
      {totalTransacoesLista === 0 ? (
        <p className="muted mt">Nenhuma transação encontrada.</p>
      ) : (
        diasOrdenados.map((dia) => {
          const bloco = porDia[dia];
          const totalDia = bloco.totalDia;

          return (
            <div key={dia} className="card mt history-day-card">
              <div className="history-day-header">
                <div>
                  <h3>{dia}</h3>
                  <p className="muted small">
                    {bloco.itens.length} transação(ões)
                  </p>
                </div>
                <div className="align-right">
                  <p className="history-summary-label">Saldo do dia</p>
                  <p
                    className={
                      "history-summary-value " +
                      (totalDia >= 0 ? "positive" : "negative")
                    }
                  >
                    {formatCurrency(totalDia)}
                  </p>
                </div>
              </div>

              <ul className="list">
                {bloco.itens.map((t) => (
                  <li
                    key={t.id}
                    className="list-item list-item-history"
                  >
                    <div>
                      <span className="badge">
                        {t.tipo === "despesa" ? "Despesa" : "Receita"}
                      </span>{" "}
                      <span>{t.descricao || "Sem descrição"}</span>
                      <div className="muted small">
                        {(t.formaPagamento || "").toUpperCase()}
                        {t.cartaoId &&
                          ` · ${cartaoNomePorId[t.cartaoId] || "Cartão"}`}
                        {t.categoria &&
                          ` · ${(t.categoria || "").toString()}`}
                      </div>

                      {t.parcelaTotal &&
                        t.parcelaTotal > 1 &&
                        t.parcelaAtual === 1 && (
                          <div className="muted small">
                            Parcela {t.parcelaAtual}/{t.parcelaTotal} ·{" "}
                            <strong>
                              Total da compra:{" "}
                              {formatCurrency(
                                Number(t.valor || 0) *
                                  Number(t.parcelaTotal || 1)
                              )}
                            </strong>
                          </div>
                        )}
                    </div>
                    <div className="align-right">
                      <span
                        className={
                          "number small " +
                          (t.tipo === "despesa"
                            ? "negative"
                            : "positive")
                        }
                      >
                        {formatCurrency(t.valor)}
                      </span>
                      <div className="muted small">
                        {formatTime(t.dataHora)}
                      </div>
                      <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => abrirEdicao(t)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => setConfirmandoExclusao(t)}
                        >
                          🗑️ Apagar
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}

      {/* MODAL DE EDIÇÃO */}
      {editando && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Editar transação</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              {formatDate(editando.dataHora)} • {formatTime(editando.dataHora)}
            </p>

            <div className="field">
              <label>Descrição</label>
              <input
                type="text"
                value={descricaoEdit}
                onChange={(e) => setDescricaoEdit(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={valorEdit}
                onChange={(e) => setValorEdit(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Tipo</label>
              <select
                value={tipoEdit}
                onChange={(e) => setTipoEdit(e.target.value)}
              >
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </div>

            {tipoEdit === "despesa" && (
              <div className="field">
                <label>Categoria</label>
                <select
                  value={categoriaEdit}
                  onChange={(e) => setCategoriaEdit(e.target.value)}
                >
                  <option value="Essencial">Essencial</option>
                  <option value="Besteira">Besteira</option>
                  <option value="Lazer">Lazer</option>
                </select>
              </div>
            )}

            <div className="field">
              <label>Forma de pagamento</label>
              <select
                value={formaEdit}
                onChange={(e) => setFormaEdit(e.target.value)}
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
                <option value="pix">PIX</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            {formaEdit === "credito" && (
              <div className="field">
                <label>Cartão</label>
                <select
                  value={cartaoEdit}
                  onChange={(e) => setCartaoEdit(e.target.value)}
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

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="primary-btn"
                onClick={salvarEdicao}
              >
                💾 Salvar alterações
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{ background: "#374151", color: "#e5e7eb" }}
                onClick={fecharEdicao}
              >
                ✖ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {confirmandoExclusao && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Apagar transação?</h3>
            <p className="muted small">
              {confirmandoExclusao.descricao || "Sem descrição"}
              <br />
              {formatCurrency(confirmandoExclusao.valor)}
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="primary-btn"
                style={{ background: "#f97373", color: "#111827" }}
                onClick={confirmarApagar}
              >
                🗑️ Sim, apagar
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{ background: "#374151", color: "#e5e7eb" }}
                onClick={cancelarApagar}
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
