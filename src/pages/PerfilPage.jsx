// src/pages/PerfilPage.jsx
import React from "react";
import { useFinance } from "../App.jsx";
import { auth, logout } from "../firebase";

export default function PerfilPage() {
  const { profile, atualizarProfile, adicionarTransacao } = useFinance();
  const user = auth.currentUser; // conta Google atual (se estiver logada)

  // salário digitado para registrar como receita do mês
  const [salarioInput, setSalarioInput] = React.useState("");

  // =========================
  // GASTOS FIXOS (NOVO)
  // =========================
  const hoje = new Date();
  const chaveMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(
    2,
    "0"
  )}`;

  const gastosFixos = Array.isArray(profile.gastosFixos)
    ? profile.gastosFixos
    : [];

  const [gfNome, setGfNome] = React.useState("");
  const [gfValor, setGfValor] = React.useState("");
  const [gfCategoria, setGfCategoria] = React.useState("essencial");

  const [editId, setEditId] = React.useState(null);
  const [editValor, setEditValor] = React.useState("");

  const normalizarNumero = (v) => {
    if (v === null || v === undefined) return 0;
    const num = Number(String(v).replace(",", "."));
    return Number.isFinite(num) ? num : 0;
  };

  const gerarId = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return "gf_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    }
  };

  const adicionarGastoFixo = () => {
    const nome = (gfNome || "").trim();
    const valor = normalizarNumero(gfValor);

    if (!nome) {
      alert("Digite um nome para o gasto fixo.");
      return;
    }
    if (!valor || valor <= 0) {
      alert("Digite um valor válido para o gasto fixo.");
      return;
    }

    // Regra: Educação NÃO entra como gasto fixo automático
    if ((gfCategoria || "").toLowerCase() === "educacao") {
      alert("Gastos de Educação não entram como gasto fixo automático.");
      return;
    }
    if (nome.toLowerCase() === "educação" || nome.toLowerCase() === "educacao") {
      alert("Gastos de Educação não entram como gasto fixo automático.");
      return;
    }

    const novo = {
      id: gerarId(),
      nome,
      categoria: gfCategoria,
      ativo: true,
      valoresPorMes: {
        [chaveMes]: valor,
      },
    };

    atualizarProfile({ gastosFixos: [...gastosFixos, novo] });

    setGfNome("");
    setGfValor("");
    setGfCategoria("essencial");
    alert("Gasto fixo adicionado!");
  };

  const iniciarEdicao = (g) => {
    setEditId(g.id);
    const v = g?.valoresPorMes?.[chaveMes];
    setEditValor(v != null ? String(v) : "");
  };

  const cancelarEdicao = () => {
    setEditId(null);
    setEditValor("");
  };

  const salvarEdicaoValor = (id) => {
    const valor = normalizarNumero(editValor);
    if (!valor || valor <= 0) {
      alert("Digite um valor válido.");
      return;
    }

    const novaLista = gastosFixos.map((g) => {
      if (g.id !== id) return g;

      const valoresPorMes = { ...(g.valoresPorMes || {}) };
      // Regra: muda só o mês atual (e próximos vão herdar)
      valoresPorMes[chaveMes] = valor;

      return { ...g, valoresPorMes };
    });

    atualizarProfile({ gastosFixos: novaLista });
    cancelarEdicao();
    alert("Valor atualizado para este mês (e próximos).");
  };

  const alternarAtivo = (id) => {
    const novaLista = gastosFixos.map((g) =>
      g.id === id ? { ...g, ativo: g.ativo === false ? true : false } : g
    );
    atualizarProfile({ gastosFixos: novaLista });
  };

  const removerGastoFixo = (id) => {
    const ok = confirm("Remover este gasto fixo?");
    if (!ok) return;
    const novaLista = gastosFixos.filter((g) => g.id !== id);
    atualizarProfile({ gastosFixos: novaLista });
  };

  const handleChange = (campo) => (e) => {
    atualizarProfile({ [campo]: e.target.value });
  };

  const handleLogout = async () => {
    try {
      await logout();
      // App.jsx já escuta o logout e volta para a tela de login
    } catch (err) {
      console.error(err);
      alert("Erro ao sair da conta Google.");
    }
  };

  const registrarSalarioMes = () => {
    if (!salarioInput) {
      alert("Digite um valor para o salário.");
      return;
    }

    const valor = Number(salarioInput.replace(",", "."));
    if (!valor || valor <= 0) {
      alert("Digite um valor válido para o salário.");
      return;
    }

    adicionarTransacao({
      tipo: "receita",
      descricao: "Salário do mês",
      valor,
      dataHora: new Date().toISOString(),
      categoria: "salario-fixo",
      formaPagamento: "outros",
    });

    setSalarioInput("");
    alert("Salário deste mês registrado com sucesso!");
  };

  return (
    <div className="page">
      <h2 className="page-title">Perfil</h2>

      {/* CONTA GOOGLE */}
      <div className="card profile-card">
        <h3>Conta Google</h3>

        {user ? (
          <>
            <div className="avatar-wrapper" style={{ marginBottom: 8 }}>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "Avatar"}
                  className="avatar-img"
                />
              ) : (
                <span className="avatar-placeholder">
                  {user.displayName ? user.displayName[0].toUpperCase() : "?"}
                </span>
              )}
            </div>

            <p className="small">
              <strong>{user.displayName || "Usuário sem nome"}</strong>
              <br />
              <span className="muted">{user.email}</span>
            </p>

            <button
              type="button"
              className="primary-btn"
              style={{ marginTop: 10 }}
              onClick={handleLogout}
            >
              Sair / Trocar de conta
            </button>

            <p className="muted small" style={{ marginTop: 6 }}>
              Para entrar com outra conta Google, saia e faça login de novo na
              tela inicial.
            </p>
          </>
        ) : (
          <p className="muted small">Nenhuma conta Google conectada no momento.</p>
        )}
      </div>

      {/* DADOS DO PERFIL FINANCEIRO */}
      <div className="card mt">
        <h3>Dados pessoais</h3>

        <div className="field">
          <label>Nome</label>
          <input
            type="text"
            value={profile.nome || ""}
            onChange={handleChange("nome")}
            placeholder="Seu nome"
          />
        </div>

        <div className="field">
          <label>Idade</label>
          <input
            type="number"
            min="0"
            max="120"
            value={profile.idade || ""}
            onChange={handleChange("idade")}
            placeholder="Ex.: 17"
          />
        </div>

        <div className="field">
          <label>Sexo</label>
          <select value={profile.sexo || ""} onChange={handleChange("sexo")}>
            <option value="">Selecione...</option>
            <option value="Feminino">Feminino</option>
            <option value="Masculino">Masculino</option>
            <option value="Outro">Outro</option>
            <option value="Prefiro não dizer">Prefiro não dizer</option>
          </select>
        </div>
      </div>

      {/* CONFIGURAÇÕES FINANCEIRAS */}
      <div className="card mt">
        <h3>Configurações financeiras</h3>

        {/* Limite de gasto mensal (continua igual) */}
        <div className="field">
          <label>Limite de gasto mensal (R$)</label>
          <input
            type="number"
            step="0.01"
            value={profile.limiteGastoMensal || ""}
            onChange={handleChange("limiteGastoMensal")}
          />
        </div>

        {/* Dia que recebe (continua igual) */}
        <div className="field">
          <label>Dia que você recebe (1 a 31)</label>
          <input
            type="number"
            min="1"
            max="31"
            value={profile.diaPagamento || ""}
            onChange={handleChange("diaPagamento")}
          />
        </div>

        {/* NOVO: registrar salário do mês como transação */}
        <div className="field" style={{ marginTop: 12 }}>
          <label>Salário deste mês (R$)</label>
          <input
            type="number"
            step="0.01"
            value={salarioInput}
            onChange={(e) => setSalarioInput(e.target.value)}
            placeholder="Ex.: 1200"
          />

          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: 8 }}
            onClick={registrarSalarioMes}
          >
            Registrar salário deste mês
          </button>

          <p className="muted small" style={{ marginTop: 6 }}>
            Cada salário registrado conta como receita só desse mês. Alterar
            depois não muda os meses anteriores.
          </p>
        </div>
      </div>

      {/* =========================
          GASTOS FIXOS (NOVO)
          ========================= */}
      <div className="card mt">
        <h3>Gastos fixos</h3>

        <p className="muted small" style={{ marginBottom: 10 }}>
          Você está cadastrando/alterando o valor para: <strong>{chaveMes}</strong>
          <br />
          Se mudar o valor, só muda este mês e os próximos (meses antigos não mudam).
        </p>

        {/* Formulário de adicionar */}
        <div className="field">
          <label>Nome do gasto fixo</label>
          <input
            type="text"
            value={gfNome}
            onChange={(e) => setGfNome(e.target.value)}
            placeholder="Ex.: Aluguel, Internet..."
          />
        </div>

        <div className="field">
          <label>Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={gfValor}
            onChange={(e) => setGfValor(e.target.value)}
            placeholder="Ex.: 250"
          />
        </div>

        <div className="field">
          <label>Categoria</label>
          <select value={gfCategoria} onChange={(e) => setGfCategoria(e.target.value)}>
            <option value="essencial">Essencial</option>
            <option value="lazer">Lazer</option>
            {/* Educação propositalmente NÃO está aqui */}
          </select>

          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: 8 }}
            onClick={adicionarGastoFixo}
          >
            Adicionar gasto fixo
          </button>

          <p className="muted small" style={{ marginTop: 6 }}>
            Educação não entra como gasto fixo automático.
          </p>
        </div>

        {/* Lista */}
        {gastosFixos.length === 0 ? (
          <p className="muted small">Nenhum gasto fixo cadastrado.</p>
        ) : (
          <ul className="list">
            {gastosFixos.map((g) => {
              const ativo = g.ativo !== false;
              const valorMes = g?.valoresPorMes?.[chaveMes];

              return (
                <li key={g.id} className="list-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>
                      <strong>{g.nome}</strong>{" "}
                      <span className="muted small">
                        ({g.categoria || "sem categoria"}) {ativo ? "" : "— desativado"}
                      </span>
                    </span>
                    <span className="muted small">
                      valor deste mês:{" "}
                      <strong>
                        {valorMes != null ? `R$ ${Number(valorMes).toFixed(2)}` : "não definido"}
                      </strong>
                    </span>
                  </div>

                  {/* Edição */}
                  {editId === g.id ? (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        type="number"
                        step="0.01"
                        value={editValor}
                        onChange={(e) => setEditValor(e.target.value)}
                        placeholder="Novo valor"
                        style={{ flex: "1 1 160px" }}
                      />
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => salvarEdicaoValor(g.id)}
                      >
                        Salvar valor
                      </button>
                      <button
                        type="button"
                        className="toggle-btn"
                        onClick={cancelarEdicao}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="toggle-btn"
                        onClick={() => iniciarEdicao(g)}
                      >
                        Alterar valor do mês
                      </button>

                      <button
                        type="button"
                        className="toggle-btn"
                        onClick={() => alternarAtivo(g.id)}
                      >
                        {ativo ? "Desativar" : "Ativar"}
                      </button>

                      <button
                        type="button"
                        className="toggle-btn"
                        onClick={() => removerGastoFixo(g.id)}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
