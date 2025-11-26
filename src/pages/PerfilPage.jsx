// src/pages/PerfilPage.jsx
import React from "react";
import { useFinance } from "../App.jsx";
import { auth, logout } from "../firebase";

export default function PerfilPage() {
  const { profile, atualizarProfile, adicionarTransacao } = useFinance();
  const user = auth.currentUser; // conta Google atual (se estiver logada)

  // salário digitado para registrar como receita do mês
  const [salarioInput, setSalarioInput] = React.useState("");

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
                  {user.displayName
                    ? user.displayName[0].toUpperCase()
                    : "?"}
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
          <p className="muted small">
            Nenhuma conta Google conectada no momento.
          </p>
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
          <select
            value={profile.sexo || ""}
            onChange={handleChange("sexo")}
          >
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
    </div>
  );
}
