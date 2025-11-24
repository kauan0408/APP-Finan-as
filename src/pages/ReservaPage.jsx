import React, { useMemo, useState } from "react";
import { useFinance } from "../App.jsx";

function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function ReservaPage() {
  const { reserva, setReserva } = useFinance();

  const [metaMensalLocal, setMetaMensalLocal] = useState(
    reserva.metaMensal || ""
  );
  const [novoLocalNome, setNovoLocalNome] = useState("");
  const [valorAdicionar, setValorAdicionar] = useState("");
  const [origem, setOrigem] = useState("salario");
  const [localDestinoId, setLocalDestinoId] = useState("");
  const [mensagem, setMensagem] = useState("");

  const locais = Array.isArray(reserva.locais) ? reserva.locais : [];
  const movimentos = Array.isArray(reserva.movimentos)
    ? reserva.movimentos
    : [];

  const totalGuardado = useMemo(
    () =>
      locais.reduce((soma, l) => soma + Number(l.valor || 0), 0),
    [locais]
  );

  const percMeta =
    Number(metaMensalLocal || reserva.metaMensal || 0) > 0
      ? Math.min(
          100,
          (totalGuardado /
            Number(metaMensalLocal || reserva.metaMensal || 0)) *
            100
        )
      : 0;

  function atualizarReserva(dados) {
    setReserva({
      ...reserva,
      ...dados,
    });
  }

  function salvarMetaMensal(e) {
    e.preventDefault();
    const meta = Number(
      String(metaMensalLocal || 0).replace(",", ".")
    );
    atualizarReserva({ metaMensal: meta });
    setMensagem("Meta mensal de reserva atualizada!");
    setTimeout(() => setMensagem(""), 2000);
  }

  function adicionarLocal(e) {
    e.preventDefault();
    if (!novoLocalNome.trim()) return;
    const novo = {
      id: generateId(),
      nome: novoLocalNome.trim(),
      valor: 0,
    };
    atualizarReserva({ locais: [...locais, novo] });
    setNovoLocalNome("");
    if (!localDestinoId) {
      setLocalDestinoId(novo.id);
    }
  }

  function handleAlterarValorLocal(id, valorStr) {
    const valor = Number(String(valorStr).replace(",", ".") || 0);
    const novos = locais.map((l) =>
      l.id === id ? { ...l, valor } : l
    );
    atualizarReserva({ locais: novos });
  }

  function handleAdicionarReserva(e) {
    e.preventDefault();
    const v = Number(String(valorAdicionar).replace(",", "."));
    if (isNaN(v) || v <= 0) {
      setMensagem("Informe um valor válido para adicionar.");
      setTimeout(() => setMensagem(""), 2000);
      return;
    }
    if (!localDestinoId) {
      setMensagem("Escolha onde o dinheiro será guardado.");
      setTimeout(() => setMensagem(""), 2000);
      return;
    }

    const novosLocais = locais.map((l) =>
      l.id === localDestinoId ? { ...l, valor: Number(l.valor || 0) + v } : l
    );

    const movimento = {
      id: generateId(),
      valor: v,
      origem,
      localId: localDestinoId,
      dataHora: new Date().toISOString(),
    };

    atualizarReserva({
      locais: novosLocais,
      movimentos: [movimento, ...movimentos],
    });

    setValorAdicionar("");

    setMensagem(
      `Você adicionou ${formatCurrency(
        v
      )} à sua reserva. Excelente passo para a sua segurança financeira!`
    );
    setTimeout(() => setMensagem(""), 3000);
  }

  function nomeLocal(id) {
    const l = locais.find((x) => x.id === id);
    return l ? l.nome : "Local";
  }

  return (
    <div className="page">
      <h2 className="page-title">Reserva de Emergência</h2>

      {/* META MENSAL */}
      <div className="card">
        <h3>Meta mensal</h3>
        <p className="muted small">
          Defina quanto você quer guardar por mês para emergências. Comece
          com um valor pequeno e aumente aos poucos.
        </p>

        <form className="form" onSubmit={salvarMetaMensal}>
          <div className="field">
            <label>Meta mensal (R$)</label>
            <input
              type="number"
              step="0.01"
              value={metaMensalLocal}
              onChange={(e) => setMetaMensalLocal(e.target.value)}
            />
          </div>
          <button className="primary-btn" type="submit">
            Salvar meta
          </button>
        </form>

        <div className="total-reserva">
          <p className="muted small">
            Total guardado até agora:{" "}
            <strong>{formatCurrency(totalGuardado)}</strong>
          </p>
          {Number(metaMensalLocal || reserva.metaMensal || 0) > 0 && (
            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${percMeta.toFixed(0)}%` }}
                />
              </div>
              <span className="progress-label">
                {percMeta.toFixed(0)}% da meta mensal atingida.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ONDE ESTÁ O DINHEIRO */}
      <div className="card mt">
        <h3>Onde está o dinheiro</h3>
        <p className="muted small">
          Cadastre os lugares onde sua reserva está guardada (poupança, conta
          digital, cofrinho, investimentos...).
        </p>

        {locais.length === 0 ? (
          <p className="muted small">
            Nenhum local cadastrado ainda. Adicione pelo menos um.
          </p>
        ) : (
          <ul className="list">
            {locais.map((l) => (
              <li key={l.id} className="list-item">
                <span>{l.nome}</span>
                <input
                  type="number"
                  step="0.01"
                  value={l.valor}
                  onChange={(e) =>
                    handleAlterarValorLocal(l.id, e.target.value)
                  }
                  style={{ width: "110px" }}
                />
              </li>
            ))}
          </ul>
        )}

        <form
          className="form"
          onSubmit={adicionarLocal}
          style={{ marginTop: 10 }}
        >
          <div className="field">
            <label>Novo local</label>
            <input
              type="text"
              value={novoLocalNome}
              onChange={(e) => setNovoLocalNome(e.target.value)}
              placeholder="Ex.: Poupança, Cofrinho..."
            />
          </div>
          <button className="primary-btn" type="submit">
            Adicionar local
          </button>
        </form>
      </div>

      {/* COMO ADICIONAR DINHEIRO */}
      <div className="card mt">
        <h3>Adicionar dinheiro à reserva</h3>
        <form className="form" onSubmit={handleAdicionarReserva}>
          <div className="field">
            <label>Valor a adicionar (R$)</label>
            <input
              type="number"
              step="0.01"
              value={valorAdicionar}
              onChange={(e) => setValorAdicionar(e.target.value)}
            />
          </div>

          <div className="field">
            <label>De onde veio esse dinheiro?</label>
            <select
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
            >
              <option value="salario">Salário</option>
              <option value="pix">PIX recebido</option>
              <option value="venda">Venda de algo</option>
              <option value="economia">
                Economia de um gasto (cortei uma despesa)
              </option>
              <option value="outros">Outros</option>
            </select>
          </div>

          <div className="field">
            <label>Para onde vai esse dinheiro?</label>
            <select
              value={localDestinoId}
              onChange={(e) => setLocalDestinoId(e.target.value)}
            >
              <option value="">Selecione o local...</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </div>

          <button className="primary-btn" type="submit">
            Adicionar à reserva
          </button>
        </form>

        {mensagem && <p className="feedback">{mensagem}</p>}
      </div>

      {/* HISTÓRICO DE MOVIMENTOS */}
      <div className="card mt">
        <h3>Histórico da reserva</h3>
        {movimentos.length === 0 ? (
          <p className="muted small">
            Nenhum movimento registrado ainda. Cada vez que você adicionar
            dinheiro à reserva, ele aparecerá aqui.
          </p>
        ) : (
          <ul className="list">
            {movimentos.map((m) => (
              <li key={m.id} className="list-item list-item-history">
                <div>
                  <strong>{formatCurrency(m.valor)}</strong>
                  <p className="small muted">
                    {nomeLocal(m.localId)} ·{" "}
                    {m.origem === "salario"
                      ? "Salário"
                      : m.origem === "pix"
                      ? "PIX"
                      : m.origem === "venda"
                      ? "Venda"
                      : m.origem === "economia"
                      ? "Economia de gasto"
                      : "Outros"}
                  </p>
                </div>
                <div className="muted small">
                  {new Date(m.dataHora).toLocaleDateString("pt-BR")}{" "}
                  {new Date(m.dataHora).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
