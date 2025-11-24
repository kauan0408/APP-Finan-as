import React from "react";
import { useFinance } from "../App.jsx";
import { auth, logout } from "../firebase";

export default function PerfilPage() {
  const { profile, atualizarProfile } = useFinance();
  const user = auth.currentUser; // conta Google atual (se estiver logada)

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

      <div className="card mt">
        <h3>Configurações financeiras</h3>

        <div className="field">
          <label>Renda mensal fixa (R$)</label>
          <input
            type="number"
            step="0.01"
            value={profile.rendaMensal || ""}
            onChange={handleChange("rendaMensal")}
          />
        </div>

        <div className="field">
          <label>Limite de gasto mensal (R$)</label>
          <input
            type="number"
            step="0.01"
            value={profile.limiteGastoMensal || ""}
            onChange={handleChange("limiteGastoMensal")}
          />
        </div>

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
      </div>
    </div>
  );
}
