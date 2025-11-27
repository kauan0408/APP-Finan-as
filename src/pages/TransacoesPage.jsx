// src/pages/TransacoesPage.jsx
import React, { useState } from "react";
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
  const {
    adicionarTransacao,
    cartoes,
    mesReferencia, // 🔄 mês selecionado na visão geral
    transacoes, // pra calcular limite de cartão
  } = useFinance();

  const [tipo, setTipo] = useState("despesa");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Essencial");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [cartaoId, setCartaoId] = useState("");
  const [fixo, setFixo] = useState(false);
  const [mensagem, setMensagem] = useState("");

  // 💳 PARCELAMENTO
  const [parcelado, setParcelado] = useState(false);
  const [numeroParcelas, setNumeroParcelas] = useState(2);

  // 📅 DATA DA TRANSAÇÃO (começa no mês selecionado)
  const [dataTransacao, setDataTransacao] = useState(() => {
    const hoje = new Date();
    const ano = mesReferencia?.ano ?? hoje.getFullYear();
    const mes = mesReferencia?.mes ?? hoje.getMonth();
    const dia = hoje.getDate();
    return toInputDate(ano, mes, dia);
  });

  const isDespesa = tipo === "despesa";

  // 🔔 modal de “limite estourado”
  const [mostrarConfirmCredito, setMostrarConfirmCredito] = useState(false);
  const [pendenteCredito, setPendenteCredito] = useState(null);
  // pendenteCredito = {
  //   dados: { ...tudo do formulário já preparado },
  //   excedente,
  //   limite,
  //   gastoAtual,
  //   cartaoNome
  // }

  function mostrarMensagem(texto) {
    setMensagem(texto);
    setTimeout(() => setMensagem(""), 2200);
  }

  // 👉 função que realmente cria as transações (normal ou parcelada)
  const processarTransacao = (dados) => {
    const {
      tipoForm,
      valorForm,
      descricaoForm,
      categoriaForm,
      formaForm,
      cartaoIdForm,
      fixoForm,
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

    // 👉 COMPRA PARCELADA NO CRÉDITO (até 24x)
    if (ehDespesaCreditoLocal && parceladoForm && numeroParcelasForm > 1) {
      let n = parseInt(numeroParcelasForm, 10) || 2;
      if (n < 2) n = 2;
      if (n > 24) n = 24;

      const groupId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(36) + Math.random().toString(36).slice(2);

      const valorParcela = v / n;

      for (let i = 1; i <= n; i++) {
        const dataParcela = new Date(baseDate);
        dataParcela.setMonth(dataParcela.getMonth() + (i - 1));

        listaParaSalvar.push({
          tipo: "despesa",
          valor: Number(valorParcela.toFixed(2)),
          totalCompra: v,
          groupId,
          descricao: descricaoForm?.trim()
            ? `${descricaoForm} (parc. ${i}/${n})`
            : `Parcela ${i}/${n}`,
          categoria: categoriaForm,
          formaPagamento: "credito",
          cartaoId: cartaoIdForm,
          fixo: false, // parcela não é gasto fixo automático
          dataHora: dataParcela.toISOString(),
          parcelaAtual: i,
          parcelaTotal: n,
        });
      }

      mostrarMensagem(`Compra parcelada em ${n}x lançada.`);
    } else {
      // 👉 Lançamento normal (uma única transação)
      listaParaSalvar.push({
        tipo: tipoForm, // "despesa" ou "receita"
        valor: v,
        totalCompra: v,
        groupId: null,
        descricao: descricaoForm,
        categoria: isDespesaLocal ? categoriaForm : null,
        formaPagamento: formaForm,
        cartaoId: formaForm === "credito" ? cartaoIdForm || null : null,
        fixo: isDespesaLocal ? fixoForm : false,
        dataHora: baseDate.toISOString(),
        parcelaAtual: null,
        parcelaTotal: null,
      });
      mostrarMensagem("Transação salva!");
    }

    // Salva tudo no contexto
    listaParaSalvar.forEach((t) => adicionarTransacao(t));

    // limpa o formulário (mantém a data)
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

    // data base escolhida no input
    let baseDate;
    if (dataTransacao) {
      baseDate = new Date(dataTransacao + "T12:00:00"); // meio-dia pra evitar fuso
    } else {
      baseDate = new Date();
    }

    const ehDespesaCredito =
      isDespesa && formaPagamento === "credito" && cartaoId;

    // 🔍 se for despesa no crédito, confere limite do cartão
    if (ehDespesaCredito) {
      const cartao = cartoes.find((c) => c.id === cartaoId);
      const limite = cartao?.limite || 0;

      if (limite > 0) {
        let totalCompras = 0;
        let totalPagamentos = 0;

        transacoes.forEach((t) => {
          if (t.cartaoId === cartaoId) {
            if (
              t.tipo === "despesa" &&
              t.formaPagamento === "credito"
            ) {
              totalCompras += Number(t.valor || 0);
            }
            if (t.tipo === "pagamentoCartao") {
              totalPagamentos += Number(t.valor || 0);
            }
          }
        });

        const gastoAtual = Math.max(0, totalCompras - totalPagamentos);
        const restante = limite - gastoAtual;

        // ⚠️ BANCO CONTA O VALOR TOTAL DA COMPRA (v), NÃO SÓ A PARCELA
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
              fixoForm: fixo,
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
          return; // não lança agora, espera confirmação
        }
      }
    }

    // 👉 se não estourou limite, segue fluxo normal
    processarTransacao({
      tipoForm: tipo,
      valorForm: valor,
      descricaoForm: descricao,
      categoriaForm: categoria,
      formaForm: formaPagamento,
      cartaoIdForm: cartaoId,
      fixoForm: fixo,
      parceladoForm: parcelado,
      numeroParcelasForm: numeroParcelas,
      dataBaseISO: baseDate.toISOString(),
    });
  };

  // Sempre que trocar tipo, faz sentido ajustar coisas
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

  return (
    <div className="page">
      <h2 className="page-title">Transações</h2>

      <div className="card">
        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Tipo</label>
            <div className="toggle-group">
              <button
                type="button"
                className={
                  "toggle-btn " +
                  (tipo === "despesa" ? "toggle-active" : "")
                }
                onClick={() => onChangeTipo("despesa")}
              >
                Despesa
              </button>
              <button
                type="button"
                className={
                  "toggle-btn " +
                  (tipo === "receita" ? "toggle-active" : "")
                }
                onClick={() => onChangeTipo("receita")}
              >
                Receita
              </button>
            </div>
          </div>

          {/* 📅 DATA DA TRANSAÇÃO */}
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
              placeholder={
                isDespesa
                  ? "Ex.: Aluguel, mercado..."
                  : "Ex.: salário, extra"
              }
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
                <option value="Besteira">Besteira</option>
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

          {/* 💳 PARCELAMENTO – só aparece se for despesa no crédito */}
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
                  <strong>1 transação por parcela</strong> em meses
                  diferentes (1/3, 2/3, 3/3...).
                </p>
              </div>

              {parcelado && (
                <div className="field">
                  <label>Número de parcelas</label>
                  <input
                    type="number"
                    min="2"
                    max="24"
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {isDespesa && (
            <div className="field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={fixo}
                  onChange={(e) => setFixo(e.target.checked)}
                  disabled={formaPagamento === "credito" && parcelado}
                />{" "}
                É gasto fixo (conta mensal)?
              </label>
              <p className="muted small">
                Marque para contas que se repetem todo mês, como aluguel,
                água, luz, internet, etc.
              </p>
            </div>
          )}

          <button className="primary-btn" style={{ marginTop: 10 }}>
            Salvar transação
          </button>

          {mensagem && <p className="feedback">{mensagem}</p>}
        </form>
      </div>

      {/* 🧱 MODAL: LIMITE ESTOURADO NO CARTÃO */}
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
    </div>
  );
}
