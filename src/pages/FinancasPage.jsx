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

  const refDate = new Date(refAno, refMes, 1);
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
    let despesas = 0;
    let gastosCartao = 0;

    let categorias = {
      essencial: 0,
      besteira: 0,
      lazer: 0,
    };

    const semanas = [0, 0, 0, 0];
    const gastosFixos = [];

    transacoes.forEach((t) => {
      const dt = new Date(t.dataHora);
      if (dt.getMonth() === mes && dt.getFullYear() === ano) {
        const valor = Number(t.valor || 0);

        if (t.tipo === "receita") {
          receitas += valor;
        } else if (t.tipo === "despesa") {
          despesas += valor;

          if (t.formaPagamento === "credito") {
            gastosCartao += valor;
          }

          const cat = (t.categoria || "").toLowerCase();
          if (cat === "essencial") categorias.essencial += valor;
          if (cat === "besteira") categorias.besteira += valor;
          if (cat === "lazer") categorias.lazer += valor;

          const dia = dt.getDate();
          const semanaIndex = Math.min(3, Math.floor((dia - 1) / 7));
          semanas[semanaIndex] += valor;

          if (t.fixo) gastosFixos.push(t);
        }
      }
    });

    const saldo = receitas - despesas;

    const topDespesas = transacoes
      .filter((t) => {
        const dt = new Date(t.dataHora);
        return (
          t.tipo === "despesa" &&
          dt.getMonth() === mes &&
          dt.getFullYear() === ano
        );
      })
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5);

    const totalCat =
      categorias.essencial + categorias.besteira + categorias.lazer || 1;

    return {
      receitas,
      despesas,
      saldo,
      gastosCartao,
      categorias,
      pEssencial: (categorias.essencial / totalCat) * 100,
      pBesteira: (categorias.besteira / totalCat) * 100,
      pLazer: (categorias.lazer / totalCat) * 100,
      semanas,
      maxSemana: Math.max(...semanas, 1),
      topDespesas,
      gastosFixos,
    };
  }, [transacoes, mesReferencia]); // 👈 AQUI ESTAVA O ERRO (antes estava mesRef)

  /* VARIÁVEIS DO PERFIL */
  const salarioFixo = Number(profile.rendaMensal || 0);
  const limiteGastoMensal = Number(profile.limiteGastoMensal || 0);
  const diaPagamento = profile.diaPagamento || "";

  const proximoPag = diaPagamento
    ? calcularProximoPagamento(
        diaPagamento,
        mesReferencia.mes,
        mesReferencia.ano
      )
    : null;

  // quanto sobrou/faltou só considerando salário - despesas
  const resultadoSalario =
    salarioFixo > 0 ? salarioFixo - resumo.despesas : null;

  // 👉 NOVO: saldo exibido começa do salário
  // se tiver salário definido: salário + outras receitas - despesas
  // se não tiver salário: continua sendo só receitas - despesas
  const saldoComSalario =
    salarioFixo > 0
      ? salarioFixo + resumo.receitas - resumo.despesas
      : resumo.saldo;

  const pizzaStyle = {
    backgroundImage: `conic-gradient(
      #8FA3FF 0 ${resumo.pEssencial}%,
      #6D83F2 ${resumo.pEssencial}% ${
        resumo.pEssencial + resumo.pBesteira
      }%,
      #4C5ACF ${resumo.pEssencial + resumo.pBesteira}% 100%
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
          <button
            className="toggle-btn"
            onClick={() => mudarMesReferencia(-1)}
          >
            ◀ Mês anterior
          </button>

          <button className="toggle-btn toggle-active" onClick={irParaMesAtual}>
            ● Atual
          </button>

          <button
            className="toggle-btn"
            onClick={() => mudarMesReferencia(1)}
          >
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
              {salarioFixo
                ? formatCurrency(salarioFixo)
                : "Defina na aba Perfil"}
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

        {/* Resultado salário */}
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
            <p className="resumo-number positive">
              {formatCurrency(resumo.receitas)}
            </p>
          </div>

          <div>
            <p className="resumo-label">Despesas do mês</p>
            <p className="resumo-number negative">
              {formatCurrency(resumo.despesas)}
            </p>
          </div>

          <div>
            <p className="resumo-label">Saldo</p>
            <p
              className={
                "resumo-number " +
                (saldoComSalario >= 0 ? "positive" : "negative")
              }
            >
              {formatCurrency(saldoComSalario)}
            </p>
          </div>

          <div>
            <p className="resumo-label">Crédito usado</p>
            <p className="resumo-number negative">
              {formatCurrency(resumo.gastosCartao)}
            </p>
          </div>
        </div>
      </div>

      {/* LIMITE */}
      <div className="card mt">
        <h3>Limite de gasto mensal</h3>
        {limiteGastoMensal ? (
          <>
            <p className="muted small">
              Limite: {formatCurrency(limiteGastoMensal)}
            </p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${percLimite}%` }}
              />
            </div>
            <span className="progress-label">
              {percLimite.toFixed(0)}% utilizado
            </span>
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
                <span>{t.descricao}</span>
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
              <span className="legend-color legend-fun" />
              Besteira ({resumo.pBesteira.toFixed(0)}%)
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
                  <div
                    className="bar"
                    style={{ height: `${height || 2}%` }}
                  />
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
