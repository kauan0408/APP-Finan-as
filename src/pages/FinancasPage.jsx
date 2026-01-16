// src/pages/FinancasPage.jsx
import React, { useMemo } from "react";
import { useFinance } from "../App.jsx";

function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* Cálculo do próximo pagamento */
function calcularProximoPagamento(diaPagamento, refMes, refAno) {
  const dia = Number(diaPagamento);
  if (!dia || dia < 1 || dia > 31) return null;

  let proximo = new Date(refAno, refMes, dia);

  const hoje = new Date();
  if (
    proximo < hoje &&
    refMes === hoje.getMonth() &&
    refAno === hoje.getFullYear()
  ) {
    proximo.setMonth(proximo.getMonth() + 1);
  }

  const diffMs = proximo - hoje;
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return { data: proximo, diasRestantes: diffDias };
}

// pega o valor do gasto fixo no mês selecionado.
// se não tiver valor naquele mês, herda o valor mais recente anterior.
function getValorFixo(valoresPorMes = {}, chaveMes) {
  if (valoresPorMes && valoresPorMes[chaveMes] != null) {
    return Number(valoresPorMes[chaveMes]);
  }
  const meses = Object.keys(valoresPorMes || {}).sort(); // "YYYY-MM" ordena certo
  let ultimo = null;
  for (const m of meses) {
    if (m <= chaveMes) ultimo = m;
  }
  return ultimo ? Number(valoresPorMes[ultimo]) : 0;
}

// ✅ normaliza nomes p/ unificar (Uber, uber, " Uber  " -> "uber")
function normalizarNome(descricao) {
  return String(descricao || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export default function FinancasPage() {
  const {
    transacoes,
    profile,
    mesReferencia,
    mudarMesReferencia,
    irParaMesAtual,
  } = useFinance();

  /* RESUMO DO MÊS ESCOLHIDO */
  const resumo = useMemo(() => {
    const { mes, ano } = mesReferencia;

    let receitas = 0;
    let despesasTransacoes = 0;
    let gastosCartao = 0;

    let categorias = {
      essencial: 0,
      lazer: 0,
    };

    const semanas = [0, 0, 0, 0];

    // chave do mês selecionado: "2026-01", etc.
    const chaveMes = `${ano}-${String(mes + 1).padStart(2, "0")}`;

    // gastos fixos vindo do perfil (não transações)
    const gastosFixosPerfil = (Array.isArray(profile?.gastosFixos)
      ? profile.gastosFixos
      : []
    )
      .filter((g) => g.ativo !== false)
      .filter(
        (g) =>
          (g.nome || "").toLowerCase() !== "educacao" &&
          (g.categoria || "").toLowerCase() !== "educacao"
      )
      .map((g) => ({
        id: g.id,
        descricao: g.nome,
        categoria: (g.categoria || "").toLowerCase(),
        valor: getValorFixo(g.valoresPorMes || {}, chaveMes),
      }))
      .filter((g) => Number(g.valor) > 0);

    // transações do mês
    transacoes.forEach((t) => {
      const dt = new Date(t.dataHora);
      if (dt.getMonth() === mes && dt.getFullYear() === ano) {
        const valor = Number(t.valor || 0);

        if (t.tipo === "receita") {
          receitas += valor;
        } else if (t.tipo === "despesa") {
          despesasTransacoes += valor;

          if (t.formaPagamento === "credito") {
            gastosCartao += valor;
          }

          const cat = (t.categoria || "").toLowerCase();
          if (cat === "essencial") categorias.essencial += valor;
          if (cat === "lazer") categorias.lazer += valor;

          const dia = dt.getDate();
          const semanaIndex = Math.min(3, Math.floor((dia - 1) / 7));
          semanas[semanaIndex] += valor;
        }
      }
    });

    // soma de gastos fixos do mês
    const totalGastosFixos = gastosFixosPerfil.reduce(
      (acc, g) => acc + Number(g.valor || 0),
      0
    );

    // DESPESA FINAL DO MÊS (transações + fixos)
    const despesas = despesasTransacoes + totalGastosFixos;

    // fixos entram na pizza por categoria
    gastosFixosPerfil.forEach((g) => {
      const v = Number(g.valor || 0);
      if (!v) return;

      const cat = (g.categoria || "").toLowerCase();
      if (cat === "essencial") categorias.essencial += v;
      if (cat === "lazer") categorias.lazer += v;
    });

    const saldo = receitas - despesas;

    // ✅ TOP 5 gastos UNIFICADOS por nome (no mês selecionado)
    const mapa = new Map();

    transacoes.forEach((t) => {
      const dt = new Date(t.dataHora);
      if (
        t.tipo === "despesa" &&
        dt.getMonth() === mes &&
        dt.getFullYear() === ano
      ) {
        const key = normalizarNome(t.descricao || "Sem descrição");
        const atual = mapa.get(key) || {
          descricao: t.descricao || "Sem descrição",
          valor: 0,
          count: 0,
        };
        atual.valor += Number(t.valor || 0);
        atual.count += 1;

        // mantém uma descrição “bonita”
        if (
          (!atual.descricao || atual.descricao === "Sem descrição") &&
          t.descricao
        ) {
          atual.descricao = t.descricao;
        }

        mapa.set(key, atual);
      }
    });

    const topDespesas = Array.from(mapa.values())
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5)
      .map((x, idx) => ({
        id: `top-${idx}`,
        descricao: x.descricao,
        valor: x.valor,
        count: x.count,
      }));

    const totalCat = categorias.essencial + categorias.lazer || 1;

    return {
      receitas,
      despesas,
      saldo,
      gastosCartao,
      categorias,
      pEssencial: (categorias.essencial / totalCat) * 100,
      pLazer: (categorias.lazer / totalCat) * 100,
      semanas,
      maxSemana: Math.max(...semanas, 1),
      topDespesas,
      gastosFixos: gastosFixosPerfil,
      totalGastosFixos, // DEBUG
      despesasTransacoes, // DEBUG
    };
  }, [transacoes, mesReferencia, profile?.gastosFixos]);

  /* VARIÁVEIS DO PERFIL */
  const chaveMes = `${mesReferencia.ano}-${String(mesReferencia.mes + 1).padStart(
    2,
    "0"
  )}`;
  const salariosPorMes = profile?.salariosPorMes || {};

  const salarioFixo = Number(
    salariosPorMes[chaveMes] ?? profile?.rendaMensal ?? 0
  );

  const limiteGastoMensal = Number(profile?.limiteGastoMensal || 0);
  const diaPagamento = profile?.diaPagamento || "";

  const proximoPag = diaPagamento
    ? calcularProximoPagamento(
        diaPagamento,
        mesReferencia.mes,
        mesReferencia.ano
      )
    : null;

  const resultadoSalario =
    salarioFixo > 0 ? salarioFixo - resumo.despesas : null;

  const saldoComSalario =
    salarioFixo > 0
      ? salarioFixo + resumo.receitas - resumo.despesas
      : resumo.saldo;

  const pizzaStyle = {
    backgroundImage: `conic-gradient(
      #8FA3FF 0 ${resumo.pEssencial}%,
      #4C5ACF ${resumo.pEssencial}% 100%
    )`,
  };

  const percLimite =
    limiteGastoMensal > 0
      ? Math.min(100, (resumo.despesas / limiteGastoMensal) * 100)
      : 0;

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

  return (
    <div className="page">
      <h2 className="page-title">Visão geral do mês</h2>

      {/* NAVEGAÇÃO DO MÊS */}
      <div className="card" style={{ textAlign: "center", marginBottom: 12 }}>
        <h3>
          {nomeMes} / {mesReferencia.ano}
        </h3>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <button className="toggle-btn" onClick={() => mudarMesReferencia(-1)}>
            ◀ Mês anterior
          </button>

          <button className="toggle-btn toggle-active" onClick={irParaMesAtual}>
            ● Atual
          </button>

          <button className="toggle-btn" onClick={() => mudarMesReferencia(1)}>
            Próximo mês ▶
          </button>
        </div>
      </div>

      {/* BLOCO PRINCIPAL JUNTO (SALÁRIO + DIA + RESULTADO) */}
      <div className="card resumo-card">
        <div className="resumo-top">
          <div>
            <p className="resumo-label">Salário fixo</p>
            <p className="resumo-value">
              {salarioFixo ? formatCurrency(salarioFixo) : "Defina na aba Perfil"}
            </p>
          </div>

          <div className="pill">
            {diaPagamento ? (
              <>
                <span>Dia {diaPagamento}</span>
                {proximoPag && (
                  <span className="pill-sub">
                    Próx. em {proximoPag.diasRestantes} dia(s)
                  </span>
                )}
              </>
            ) : (
              <span>Sem dia definido</span>
            )}
          </div>
        </div>

        <div className="resumo-footer">
          {resultadoSalario === null ? (
            <p className="muted small">
              Defina sua renda mensal fixa na aba Perfil para calcular sobras.
            </p>
          ) : (
            <span
              className={
                "badge badge-pill " +
                (resultadoSalario >= 0 ? "badge-positive" : "badge-negative")
              }
            >
              {resultadoSalario >= 0 ? "Sobrou" : "Faltou"}{" "}
              {formatCurrency(Math.abs(resultadoSalario))}
            </span>
          )}
        </div>
      </div>

      {/* RECEITAS / DESPESAS / SALDO / CRÉDITO */}
      <div className="card mt">
        <div className="resumo-grid">
          <div>
            <p className="resumo-label">Receitas do mês</p>
            <p className="resumo-number positive">{formatCurrency(resumo.receitas)}</p>
          </div>

          <div>
            <p className="resumo-label">Despesas do mês</p>
            <p className="resumo-number negative">{formatCurrency(resumo.despesas)}</p>
          </div>

          <div>
            <p className="resumo-label">Saldo</p>
            <p className={"resumo-number " + (saldoComSalario >= 0 ? "positive" : "negative")}>
              {formatCurrency(saldoComSalario)}
            </p>
          </div>

          <div>
            <p className="resumo-label">Crédito usado</p>
            <p className="resumo-number negative">{formatCurrency(resumo.gastosCartao)}</p>
          </div>
        </div>
      </div>

      {/* LIMITE */}
      <div className="card mt">
        <h3>Limite de gasto mensal</h3>
        {limiteGastoMensal ? (
          <>
            <p className="muted small">Limite: {formatCurrency(limiteGastoMensal)}</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${percLimite}%` }} />
            </div>
            <span className="progress-label">{percLimite.toFixed(0)}% utilizado</span>
          </>
        ) : (
          <p className="muted small">Defina seu limite na aba Perfil.</p>
        )}
      </div>

      {/* GASTOS FIXOS */}
      <div className="card mt">
        <h3>Gastos fixos</h3>
        {resumo.gastosFixos.length === 0 ? (
          <p className="muted small">Nenhum gasto fixo marcado.</p>
        ) : (
          <ul className="list">
            {resumo.gastosFixos.map((t) => (
              <li key={t.id} className="list-item">
                <span>{t.descricao}</span>
                <span>{formatCurrency(t.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* TOP GASTOS */}
      <div className="card mt">
        <h3>Top 5 gastos</h3>
        {resumo.topDespesas.length === 0 ? (
          <p className="muted">Nenhuma despesa ainda.</p>
        ) : (
          <ul className="list">
            {resumo.topDespesas.map((t) => (
              <li key={t.id} className="list-item">
                <span>
                  {t.descricao}
                  {t.count > 1 ? <span className="muted small"> · {t.count}x</span> : null}
                </span>
                <span>{formatCurrency(t.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CATEGORIAS / SEMANAS */}
      <div className="grid-2 mt">
        <div className="card">
          <h3>Gasto por categoria</h3>
          <div className="pizza-chart-wrapper">
            <div className="pizza-chart" style={pizzaStyle} />
          </div>
          <div className="legend">
            <div className="legend-item">
              <span className="legend-color legend-essential" />
              Essencial ({resumo.pEssencial.toFixed(0)}%)
            </div>
            <div className="legend-item">
              <span className="legend-color legend-leisure" />
              Lazer ({resumo.pLazer.toFixed(0)}%)
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Gastos por semana</h3>
          <div className="bar-chart">
            {resumo.semanas.map((v, i) => {
              const height = (v / resumo.maxSemana) * 100;
              return (
                <div className="bar-column" key={i}>
                  <div className="bar" style={{ height: `${height || 2}%` }} />
                  <span className="bar-label">Sem {i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
