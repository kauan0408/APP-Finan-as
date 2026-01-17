// src/pages/HistoricoPage.jsx
import React, { useMemo, useState } from "react";
import { useFinance } from "../App.jsx";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ✅ parse robusto: aceita ISO string, timestamp number, timestamp string ("1700000000000")
function parseDateValue(value) {
  if (value == null) return new Date(NaN);

  if (typeof value === "number") return new Date(value);

  const s = String(value).trim();
  if (/^\d+$/.test(s)) return new Date(Number(s));

  return new Date(s);
}

function formatDate(dateValue) {
  const d = parseDateValue(dateValue);
  if (isNaN(d.getTime())) return "Data inválida";
  return d.toLocaleDateString("pt-BR");
}

function formatTime(dateValue) {
  const d = parseDateValue(dateValue);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ✅ normaliza nomes p/ juntar iguais
function normalizarDescricao(desc) {
  return String(desc || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

  // ✅ expandir itens quando agrupado na busca
  const [abertos, setAbertos] = useState({}); // { [groupKey]: true }

  const cartaoNomePorId = useMemo(() => {
    const map = {};
    cartoes.forEach((c) => (map[c.id] = c.nome));
    return map;
  }, [cartoes]);

  const resultado = useMemo(() => {
    // 1) LISTA BASE = tudo que já foi lançado, com filtros
    let listaBase = [...transacoes];

    if (tipoFilter !== "todos") {
      listaBase = listaBase.filter((t) => t.tipo === tipoFilter);
    }
    if (categoriaFilter !== "todas") {
      listaBase = listaBase.filter(
        (t) =>
          (t.categoria || "").toLowerCase() === categoriaFilter.toLowerCase()
      );
    }
    if (formaFilter !== "todas") {
      listaBase = listaBase.filter((t) => t.formaPagamento === formaFilter);
    }
    if (cartaoFilter !== "todos") {
      listaBase = listaBase.filter((t) => t.cartaoId === cartaoFilter);
    }

    // ✅ filtros por data usando parseDateValue (ISO e timestamp)
    if (dataInicio) {
      const di = new Date(dataInicio + "T00:00:00");
      listaBase = listaBase.filter((t) => parseDateValue(t.dataHora) >= di);
    }
    if (dataFim) {
      const df = new Date(dataFim + "T23:59:59");
      listaBase = listaBase.filter((t) => parseDateValue(t.dataHora) <= df);
    }

    // ✅ busca por texto
    const temBusca = !!textoFilter.trim();
    if (temBusca) {
      const txt = textoFilter.toLowerCase();
      listaBase = listaBase.filter((t) =>
        (t.descricao || "").toLowerCase().includes(txt)
      );
    }

    // 2) LISTA PARA O RESUMO (lá de cima)
    // - Se tiver data início/fim, o resumo usa esse período.
    // - Se NÃO tiver datas, o resumo usa só o mês da Visão geral.
    let listaResumo = [...listaBase];

    if (!dataInicio && !dataFim && mesReferencia) {
      const { mes, ano } = mesReferencia;
      listaResumo = listaBase.filter((t) => {
        const dt = parseDateValue(t.dataHora);
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

    // ✅ MODO BUSCA: AGRUPAR (mas com lista detalhada ao clicar)
    let gruposBusca = [];
    if (temBusca) {
      const map = new Map();

      listaBase.forEach((t) => {
        const key = `${t.tipo}::${normalizarDescricao(t.descricao || "Sem descrição")}`;
        const atual = map.get(key) || {
          key,
          tipo: t.tipo,
          descricao: t.descricao || "Sem descrição",
          total: 0,
          count: 0,
          ids: [],
        };
        const v = Number(t.valor || 0);
        atual.total += v;
        atual.count += 1;
        atual.ids.push(t.id);

        // tenta manter a descrição mais "bonita"
        if (
          (!atual.descricao || atual.descricao === "Sem descrição") &&
          t.descricao
        ) {
          atual.descricao = t.descricao;
        }

        map.set(key, atual);
      });

      gruposBusca = Array.from(map.values()).sort((a, b) => b.total - a.total);
    }

    // ✅ MODO NORMAL (SEM BUSCA): AGRUPAMENTO POR DIA, MAS SEM JUNTAR
    const porDia = {};
    listaBase.forEach((t) => {
      const diaStr = formatDate(t.dataHora);
      if (!porDia[diaStr]) porDia[diaStr] = { itens: [], totalDia: 0 };

      porDia[diaStr].itens.push(t);

      const valor = Number(t.valor || 0);
      porDia[diaStr].totalDia += t.tipo === "despesa" ? -valor : valor;
    });

    // ordena itens do dia por hora desc (mais recente primeiro)
    Object.keys(porDia).forEach((diaStr) => {
      porDia[diaStr].itens.sort(
        (a, b) => parseDateValue(b.dataHora) - parseDateValue(a.dataHora)
      );
    });

    const diasOrdenados = Object.keys(porDia).sort((a, b) => {
      const [da, ma, aa] = a.split("/").map(Number);
      const [db, mb, ab] = b.split("/").map(Number);
      return new Date(ab, mb - 1, db) - new Date(aa, ma - 1, da);
    });

    return {
      temBusca,
      gruposBusca,
      porDia,
      diasOrdenados,
      totalDespesasResumo,
      totalReceitasResumo,
      totalTransacoesResumo: listaResumo.length,
      totalTransacoesLista: listaBase.length,
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
    temBusca,
    gruposBusca,
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
  ][mesReferencia?.mes ?? new Date().getMonth()];

  // 🔧 abrir modal de edição
  const abrirEdicao = (t) => {
    setEditando(t);
    setDescricaoEdit(t.descricao || "");

    const valorTotal =
      t.groupId && t.parcelaTotal && t.parcelaTotal > 1
        ? t.totalCompra ||
          Number(t.valor || 0) * Number(t.parcelaTotal || 1)
        : t.valor || "";

    setValorEdit(String(valorTotal));
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

    const t = editando;

    const v = parseFloat(String(valorEdit).replace(",", "."));
    if (isNaN(v) || v <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    // 🔥 SE FOR PARCELA → EDITA TODAS DO GRUPO
    if (t.groupId && t.parcelaTotal && t.parcelaTotal > 1) {
      const parcelas = transacoes
        .filter((p) => p.groupId === t.groupId)
        .sort((a, b) => parseDateValue(a.dataHora) - parseDateValue(b.dataHora));

      const totalParcelas = parcelas.length || t.parcelaTotal;
      const valorParcela = v / totalParcelas;

      parcelas.forEach((p) => {
        atualizarTransacao(p.id, {
          descricao: descricaoEdit,
          tipo: tipoEdit,
          categoria: tipoEdit === "despesa" ? categoriaEdit : null,
          formaPagamento: formaEdit,
          cartaoId: formaEdit === "credito" ? cartaoEdit || null : null,
          valor: Number(valorParcela.toFixed(2)),
          totalCompra: v,
        });
      });

      fecharEdicao();
      return;
    }

    // 🧾 TRANSAÇÃO NORMAL
    const dadosAtualizados = {
      tipo: tipoEdit,
      valor: v,
      descricao: descricaoEdit,
      categoria: tipoEdit === "despesa" ? categoriaEdit : null,
      formaPagamento: formaEdit,
      cartaoId: formaEdit === "credito" ? cartaoEdit || null : null,
      totalCompra: v,
    };

    atualizarTransacao(editando.id, dadosAtualizados);
    fecharEdicao();
  };

  // 🗑️ confirmar exclusão
  const confirmarApagar = () => {
    if (!confirmandoExclusao) return;

    const t = confirmandoExclusao;

    // Se for parcela com groupId → apaga TODAS as parcelas
    if (t.groupId && t.parcelaTotal && t.parcelaTotal > 1) {
      const grupoId = t.groupId;
      const doGrupo = transacoes.filter((p) => p.groupId === grupoId);
      doGrupo.forEach((p) => removerTransacao(p.id));
    } else {
      removerTransacao(t.id);
    }

    if (editando && (editando.id === t.id || (t.groupId && editando.groupId === t.groupId))) {
      fecharEdicao();
    }

    setConfirmandoExclusao(null);
  };

  const cancelarApagar = () => setConfirmandoExclusao(null);

  const toggleAbrir = (key) => {
    setAbertos((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="page">
      <h2 className="page-title">Histórico</h2>

      {/* Resumo */}
      <div className="card history-summary">
        <h3>
          Resumo de {nomeMes} / {mesReferencia?.ano ?? new Date().getFullYear()}
        </h3>
        {totalTransacoesResumo === 0 ? (
          <p className="muted small">
            Nenhuma transação nesse período (mês ou datas escolhidas).
          </p>
        ) : (
          <div className="history-summary-grid">
            <div>
              <p className="history-summary-label">Transações</p>
              <p className="history-summary-value">{totalTransacoesResumo}</p>
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
            className={"chip " + (tipoFilter === "todos" ? "chip-active" : "")}
            onClick={() => setTipoFilter("todos")}
          >
            Todos
          </button>
          <button
            type="button"
            className={"chip " + (tipoFilter === "despesa" ? "chip-active" : "")}
            onClick={() => setTipoFilter("despesa")}
          >
            Despesas
          </button>
          <button
            type="button"
            className={"chip " + (tipoFilter === "receita" ? "chip-active" : "")}
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
                placeholder="Ex.: uber, aluguel..."
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
            <p className="muted small" style={{ marginTop: 6 }}>
              {textoFilter.trim()
                ? "Busca ativa: resultados ficam AGRUPADOS (clique para ver itens)."
                : "Sem busca: histórico mostra tudo INDIVIDUAL por dia."}
            </p>
          </div>
        </div>
      </div>

      {/* LISTA */}
      {totalTransacoesLista === 0 ? (
        <p className="muted mt">Nenhuma transação encontrada.</p>
      ) : temBusca ? (
        // ✅ MODO BUSCA (AGRUPADO)
        <div className="card mt">
          <h3>Resultados agrupados</h3>

          <ul className="list">
            {gruposBusca.map((g) => {
              const aberto = !!abertos[g.key];
              const itens = g.ids
                .map((id) => transacoes.find((t) => t.id === id))
                .filter(Boolean)
                .sort((a, b) => parseDateValue(b.dataHora) - parseDateValue(a.dataHora));

              return (
                <li key={g.key} className="list-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div>
                      <span className="badge">{g.tipo === "despesa" ? "Despesa" : "Receita"}</span>{" "}
                      <strong>{g.descricao}</strong>
                      <span className="muted small"> · {g.count}x</span>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className={"number small " + (g.tipo === "despesa" ? "negative" : "positive")}>
                        {formatCurrency(g.total)}
                      </span>
                      <button type="button" className="chip" onClick={() => toggleAbrir(g.key)}>
                        {aberto ? "▲ Fechar" : "▼ Ver itens"}
                      </button>
                    </div>
                  </div>

                  {aberto && (
                    <div style={{ marginTop: 10, borderTop: "1px solid rgba(31, 41, 55, 0.6)", paddingTop: 10 }}>
                      <ul className="list">
                        {itens.map((t) => (
                          <li key={t.id} className="list-item list-item-history">
                            <div>
                              <div>
                                <span className="muted small">
                                  {formatDate(t.dataHora)} • {formatTime(t.dataHora)}
                                </span>
                              </div>
                              <div className="muted small">
                                {(t.formaPagamento || "").toUpperCase()}
                                {t.cartaoId && ` · ${cartaoNomePorId[t.cartaoId] || "Cartão"}`}
                                {t.categoria && ` · ${(t.categoria || "").toString()}`}
                              </div>
                            </div>

                            <div className="align-right">
                              <span
                                className={
                                  "number small " +
                                  (t.tipo === "despesa" ? "negative" : "positive")
                                }
                              >
                                {formatCurrency(t.valor)}
                              </span>

                              <div style={{ marginTop: 4, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                <button type="button" className="chip" onClick={() => abrirEdicao(t)}>
                                  ✏️ Editar
                                </button>
                                <button type="button" className="chip" onClick={() => setConfirmandoExclusao(t)}>
                                  🗑️ Apagar
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        // ✅ MODO NORMAL (INDIVIDUAL POR DIA)
        diasOrdenados.map((dia) => {
          const bloco = porDia[dia];
          const totalDia = bloco.totalDia;

          return (
            <div key={dia} className="card mt history-day-card">
              <div className="history-day-header">
                <div>
                  <h3>{dia}</h3>
                  <p className="muted small">{bloco.itens.length} transação(ões)</p>
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
                  <li key={t.id} className="list-item list-item-history">
                    <div>
                      <span className="badge">
                        {t.tipo === "despesa" ? "Despesa" : "Receita"}
                      </span>{" "}
                      <span>{t.descricao || "Sem descrição"}</span>

                      <div className="muted small">
                        {(t.formaPagamento || "").toUpperCase()}
                        {t.cartaoId && ` · ${cartaoNomePorId[t.cartaoId] || "Cartão"}`}
                        {t.categoria && ` · ${(t.categoria || "").toString()}`}
                      </div>

                      {t.parcelaTotal && t.parcelaTotal > 1 && (
                        <div className="muted small">
                          Compra parcelada em {t.parcelaTotal}x · total{" "}
                          <strong>
                            {formatCurrency(
                              t.totalCompra ||
                                Number(t.valor || 0) * Number(t.parcelaTotal || 1)
                            )}
                          </strong>
                        </div>
                      )}
                    </div>

                    <div className="align-right">
                      <span
                        className={
                          "number small " +
                          (t.tipo === "despesa" ? "negative" : "positive")
                        }
                      >
                        {formatCurrency(t.valor)}
                      </span>

                      <div className="muted small">{formatTime(t.dataHora)}</div>

                      <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                        <button type="button" className="chip" onClick={() => abrirEdicao(t)}>
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

            {editando.groupId && editando.parcelaTotal > 1 && (
              <p className="muted small" style={{ marginTop: 4 }}>
                Compra parcelada em {editando.parcelaTotal}x. <br />
                Você está editando o <strong>valor TOTAL</strong> da compra;
                todas as parcelas serão atualizadas.
              </p>
            )}

            <div className="field">
              <label>Descrição</label>
              <input
                type="text"
                value={descricaoEdit}
                onChange={(e) => setDescricaoEdit(e.target.value)}
              />
            </div>

            <div className="field">
              <label>
                {editando.groupId && editando.parcelaTotal > 1
                  ? "Valor total da compra (R$)"
                  : "Valor (R$)"}
              </label>
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
              <button type="button" className="primary-btn" onClick={salvarEdicao}>
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
              <strong>{formatCurrency(confirmandoExclusao.valor)}</strong>
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
