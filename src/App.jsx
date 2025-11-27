// src/App.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import "./styles/global.css";

import FinancasPage from "./pages/FinancasPage.jsx";
import TransacoesPage from "./pages/TransacoesPage.jsx";
import CartoesPage from "./pages/CartoesPage.jsx";
import HistoricoPage from "./pages/HistoricoPage.jsx";
import PerfilPage from "./pages/PerfilPage.jsx";
import ReservaPage from "./pages/ReservaPage.jsx";

// 🔐 Firebase (login Google + banco de dados)
import { auth, loginComGoogle, logout, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

/* ---------------- CONTEXTO DE FINANÇAS ---------------- */

const FinanceContext = createContext(null);

export function useFinance() {
  return useContext(FinanceContext);
}

/* Helpers para localStorage */
function loadFromStorage(key, defaultValue) {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Erro ao ler storage:", key, e);
    return defaultValue;
  }
}

function saveToStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.error("Erro ao salvar storage:", key, e);
  }
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ---------------- COMPONENTE PRINCIPAL ---------------- */

export default function App() {
  // 🔐 Usuário logado (Google)
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 🔁 FLAG: já carreguei dados locais para este usuário?
  const [dadosCarregados, setDadosCarregados] = useState(false);

  // Perfil (nome, renda mensal, limite de gasto, dia pagamento, etc.)
  const [profile, setProfile] = useState({
    nome: "",
    rendaMensal: "",
    limiteGastoMensal: "",
    metaReservaMensal: "",
    reservaAcumulada: "",
    diaPagamento: "",
    avatarBase64: "",
  });

  // Transações (despesas/receitas)
  const [transacoes, setTransacoes] = useState([]);

  // Cartões de crédito
  const [cartoes, setCartoes] = useState([]);

  // Reserva de emergência
  const [reserva, setReserva] = useState({
    metaMensal: 0,
    locais: [], // { id, nome, valor }
    movimentos: [], // histórico de adições
  });

  // 🔄 MÊS DE REFERÊNCIA GLOBAL (para a visão mensal)
  const hoje = new Date();
  const [mesReferencia, setMesReferencia] = useState({
    mes: hoje.getMonth(), // 0 = Janeiro, 11 = Dezembro
    ano: hoje.getFullYear(),
  });

  const irParaMesAtual = () => {
    const h = new Date();
    setMesReferencia({ mes: h.getMonth(), ano: h.getFullYear() });
  };

  const mudarMesReferencia = (delta) => {
    setMesReferencia((prev) => {
      let novoMes = prev.mes + delta;
      let novoAno = prev.ano;

      if (novoMes < 0) {
        novoMes = 11;
        novoAno--;
      } else if (novoMes > 11) {
        novoMes = 0;
        novoAno++;
      }

      return { mes: novoMes, ano: novoAno };
    });
  };

  // Aba atual do menu inferior
  const [abaAtiva, setAbaAtiva] = useState("financas");

  /* ------- MONITORA LOGIN / LOGOUT (Firebase) ------- */

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || null);
      setAuthLoading(false);
      // sempre que trocar de usuário, zera a flag
      setDadosCarregados(false);
    });

    return () => unsub();
  }, []);

  /* ------- 1) CARREGAR PRIMEIRO DO LOCALSTORAGE (MODO A) ------- */

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;

    const storedProfile = loadFromStorage(`profile_${uid}`, null);
    const storedTransacoes = loadFromStorage(`transacoes_${uid}`, null);
    const storedCartoes = loadFromStorage(`cartoes_${uid}`, null);
    const storedReserva = loadFromStorage(`reserva_${uid}`, null);

    setProfile(
      storedProfile || {
        nome: "",
        rendaMensal: "",
        limiteGastoMensal: "",
        metaReservaMensal: "",
        reservaAcumulada: "",
        diaPagamento: "",
        avatarBase64: "",
      }
    );

    setTransacoes(storedTransacoes || []);
    setCartoes(storedCartoes || []);
    setReserva(
      storedReserva || {
        metaMensal: 0,
        locais: [],
        movimentos: [],
      }
    );

    // ✅ marca que dados locais já foram carregados
    setDadosCarregados(true);
  }, [user]);

  /* ------- 2) SINCRONIZAR COM FIRESTORE (LOCAL MANDA PRIMEIRO) ------- */

  useEffect(() => {
    if (!user || !dadosCarregados) return;

    const uid = user.uid;
    const userDocRef = doc(db, "users", uid);

    const payload = {
      profile,
      transacoes,
      cartoes,
      reserva,
    };

    // Sem internet → guarda como "pendência"
    if (!navigator.onLine) {
      console.log("Sem internet: salvando atualização pendente no storage.");
      saveToStorage(`pendingSync_${uid}`, payload);
      return;
    }

    // Com internet → manda o estado ATUAL (local) pro Firestore
    setDoc(userDocRef, payload, { merge: true })
      .then(() => {
        // Deu certo, limpa pendência
        saveToStorage(`pendingSync_${uid}`, null);
      })
      .catch((err) => {
        console.error("Erro ao salvar dados no Firestore:", err);
        // Se falhar, guarda como pendência
        saveToStorage(`pendingSync_${uid}`, payload);
      });

    // Depois que mandamos o local pro Firestore, ligamos o snapshot
    const unsub = onSnapshot(userDocRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();

      // Aqui o Firestore já recebeu o "local", então não deve sobrescrever com coisa velha.
      if (data.profile) setProfile(data.profile);
      if (data.transacoes) setTransacoes(data.transacoes);
      if (data.cartoes) setCartoes(data.cartoes);
      if (data.reserva) setReserva(data.reserva);
    });

    return () => {
      unsub();
    };
  }, [user, dadosCarregados]); // dispara quando terminar de carregar local

  /* ------- 3) BACKUP LOCAL POR CONTA (sempre que mudar) ------- */

  useEffect(() => {
    if (!user) return;
    saveToStorage(`profile_${user.uid}`, profile);
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;
    saveToStorage(`transacoes_${user.uid}`, transacoes);
  }, [user, transacoes]);

  useEffect(() => {
    if (!user) return;
    saveToStorage(`cartoes_${user.uid}`, cartoes);
  }, [user, cartoes]);

  useEffect(() => {
    if (!user) return;
    saveToStorage(`reserva_${user.uid}`, reserva);
  }, [user, reserva]);

  /* ------- 4) SINCRONIZAR PENDÊNCIAS QUANDO VOLTAR A INTERNET ------- */

  useEffect(() => {
    if (!user || !dadosCarregados) return;

    const uid = user.uid;

    const syncPendentes = async () => {
      const pendente = loadFromStorage(`pendingSync_${uid}`, null);
      if (!pendente) return;
      if (!navigator.onLine) return;

      try {
        const userDocRef = doc(db, "users", uid);
        await setDoc(userDocRef, pendente, { merge: true });
        console.log("Pendências sincronizadas com sucesso.");
        saveToStorage(`pendingSync_${uid}`, null);
      } catch (err) {
        console.error("Erro ao enviar pendências ao Firestore:", err);
      }
    };

    // Tenta sincronizar na hora que o app abre
    syncPendentes();

    // E também sempre que a conexão voltar
    window.addEventListener("online", syncPendentes);
    return () => {
      window.removeEventListener("online", syncPendentes);
    };
  }, [user, dadosCarregados]);

  /* ------- FUNÇÕES PARA O CONTEXTO ------- */

  const atualizarProfile = (novosDados) => {
    setProfile((prev) => ({ ...prev, ...novosDados }));
  };

  // 🔁 AQUI ESTÁ A MUDANÇA: suporte a parcelamento até 24x no crédito
  const adicionarTransacao = (dados) => {
    let parcelas = Number(dados.parcelas || 1);
    const valorTotal = Number(dados.valor || 0);

    // garante mínimo 1 e máximo 24
    if (isNaN(parcelas) || parcelas < 1) parcelas = 1;
    if (parcelas > 24) parcelas = 24;

    // Se NÃO for compra parcelada no crédito, ou não for despesa → transação única
    if (
      parcelas === 1 ||
      dados.formaPagamento !== "credito" ||
      dados.tipo !== "despesa"
    ) {
      const nova = {
        ...dados,
        id: generateId(),
        dataHora: dados.dataHora || new Date().toISOString(),
        parcelaAtual: 1,
        parcelas: 1,
      };
      setTransacoes((prev) => [nova, ...prev]);
      return;
    }

    // 💳 COMPRA PARCELADA NO CRÉDITO (até 24x)
    const valorPorParcela = valorTotal / parcelas;
    const novasParcelas = [];

    for (let i = 0; i < parcelas; i++) {
      const data = new Date(dados.dataHora || new Date());
      data.setMonth(data.getMonth() + i);

      novasParcelas.push({
        ...dados,
        id: generateId(),
        valor: Number(valorPorParcela.toFixed(2)),
        parcelaAtual: i + 1,
        parcelas,
        dataHora: data.toISOString(),
      });
    }

    setTransacoes((prev) => [...novasParcelas, ...prev]);
  };

  const atualizarTransacao = (id, dadosAtualizados) => {
    setTransacoes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...dadosAtualizados } : t))
    );
  };

  const removerTransacao = (id) => {
    setTransacoes((prev) => prev.filter((t) => t.id !== id));
  };

  const adicionarCartao = (dados) => {
    const novo = {
      id: generateId(),
      nome: dados.nome,
      limite: Number(dados.limite || 0),
      diaFechamento: Number(dados.diaFechamento || 1),
    };
    setCartoes((prev) => [...prev, novo]);
  };

  const atualizarCartoes = (lista) => {
    setCartoes(lista);
  };

  const atualizarReserva = (novosDados) => {
    setReserva((prev) => ({ ...prev, ...novosDados }));
  };

  const contexto = useMemo(
    () => ({
      user,
      profile,
      atualizarProfile,
      transacoes,
      adicionarTransacao,
      atualizarTransacao,
      removerTransacao,
      cartoes,
      adicionarCartao,
      atualizarCartoes,
      reserva,
      setReserva: atualizarReserva,

      // 🔄 mês global
      mesReferencia,
      mudarMesReferencia,
      irParaMesAtual,

      // login
      loginComGoogle,
      logout,
    }),
    [user, profile, transacoes, cartoes, reserva, mesReferencia]
  );

  /* ------- ESCOLHE PÁGINA DA ABA ATUAL ------- */

  let pagina;
  switch (abaAtiva) {
    case "financas":
      pagina = <FinancasPage />;
      break;
    case "reserva":
      pagina = <ReservaPage />;
      break;
    case "transacoes":
      pagina = <TransacoesPage />;
      break;
    case "cartoes":
      pagina = <CartoesPage />;
      break;
    case "historico":
      pagina = <HistoricoPage />;
      break;
    case "perfil":
      pagina = <PerfilPage />;
      break;
    default:
      pagina = <FinancasPage />;
  }

  /* ------- TELA ENQUANTO VERIFICA LOGIN ------- */

  if (authLoading) {
    return (
      <div className="app-root">
        <div className="app-overlay">
          <header className="app-header">
            <h1 className="app-title">Finanças Offline</h1>
          </header>
          <main className="app-main">
            <div className="card">
              <p>Carregando...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /* ------- TELA DE LOGIN SE NÃO TIVER USUÁRIO ------- */

  if (!user) {
    return (
      <div className="app-root">
        <div className="app-overlay">
          <header className="app-header">
            <h1 className="app-title">Finanças Offline</h1>
          </header>

          <main className="app-main">
            <div className="card profile-card">
              <h2 className="page-title">Entrar</h2>
              <p className="muted small">
                Faça login com sua conta Google para usar o app e salvar
                seus dados com segurança.
              </p>

              <button
                className="primary-btn"
                style={{ marginTop: 12 }}
                onClick={() => {
                  if (!navigator.onLine) {
                    alert("Sem internet. Conecte-se para fazer login com Google.");
                    return;
                  }
                  loginComGoogle();
                }}
              >
                🔐 Entrar com Google
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /* ------- APP NORMAL QUANDO ESTÁ LOGADO ------- */

  return (
    <FinanceContext.Provider value={contexto}>
      <div className="app-root">
        {/* FUNDO ANIMADO – BOLINHAS CAINDO */}
        <div className="bolinhas-background">
          {Array.from({ length: 60 }).map((_, i) => (
            <span
              key={i}
              className="bolinha"
              style={{
                left: `${Math.random() * 100}%`,
                animationDuration: `${4 + Math.random() * 6}s`,
                animationDelay: `${Math.random() * 8}s`,
                transform: `scale(${0.5 + Math.random() * 1.2})`,
              }}
            />
          ))}
        </div>

        {/* CONTEÚDO EM CIMA DO FUNDO */}
        <div className="app-overlay">
          <header className="app-header">
            <h1 className="app-title">Finanças Offline</h1>
          </header>

          <main className="app-main">{pagina}</main>

          {/* MENU INFERIOR */}
          <nav className="bottom-nav">
            <button
              className={
                "bottom-nav-item " +
                (abaAtiva === "financas" ? "bottom-nav-item-active" : "")
              }
              onClick={() => setAbaAtiva("financas")}
            >
              💰 Finanças
            </button>
            <button
              className={
                "bottom-nav-item " +
                (abaAtiva === "reserva" ? "bottom-nav-item-active" : "")
              }
              onClick={() => setAbaAtiva("reserva")}
            >
              🛟 Reserva
            </button>
            <button
              className={
                "bottom-nav-item " +
                (abaAtiva === "transacoes"
                  ? "bottom-nav-item-active"
                  : "")
              }
              onClick={() => setAbaAtiva("transacoes")}
            >
              📥 Transações
            </button>
            <button
              className={
                "bottom-nav-item " +
                (abaAtiva === "cartoes" ? "bottom-nav-item-active" : "")
              }
              onClick={() => setAbaAtiva("cartoes")}
            >
              💳 Cartões
            </button>
            <button
              className={
                "bottom-nav-item " +
                (abaAtiva === "historico"
                  ? "bottom-nav-item-active"
                  : "")
              }
              onClick={() => setAbaAtiva("historico")}
            >
              📜 Histórico
            </button>
            <button
              className={
                "bottom-nav-item " +
                (abaAtiva === "perfil" ? "bottom-nav-item-active" : "")
              }
              onClick={() => setAbaAtiva("perfil")}
            >
              👤 Perfil
            </button>
          </nav>
        </div>
      </div>
    </FinanceContext.Provider>
  );
}
