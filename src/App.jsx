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
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

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

/* Valores padrão */
const DEFAULT_PROFILE = {
  nome: "",
  rendaMensal: "",
  limiteGastoMensal: "",
  metaReservaMensal: "",
  reservaAcumulada: "",
  diaPagamento: "",
  avatarBase64: "",
};

const DEFAULT_RESERVA = {
  metaMensal: 0,
  locais: [],
  movimentos: [],
};

/* ---------------- COMPONENTE PRINCIPAL ---------------- */

export default function App() {
  // 🔐 Usuário logado (Google)
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 🔁 FLAG: já carreguei dados iniciais (nuvem/local) pra este usuário?
  const [dadosCarregados, setDadosCarregados] = useState(false);

  // Perfil (nome, renda mensal, limite de gasto, dia pagamento, etc.)
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  // Transações (despesas/receitas)
  const [transacoes, setTransacoes] = useState([]);

  // Cartões de crédito
  const [cartoes, setCartoes] = useState([]);

  // Reserva de emergência
  const [reserva, setReserva] = useState(DEFAULT_RESERVA);

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
      setDadosCarregados(false);
    });

    return () => unsub();
  }, []);

  /* ------- 1) CARREGAR PRIMEIRO DA NUVEM, DEPOIS LOCAL (SE PRECISAR) ------- */

  useEffect(() => {
    if (!user) return;

    let unsubSnapshot = null;

    (async () => {
      const uid = user.uid;
      const userDocRef = doc(db, "users", uid);

      try {
        // 1) Tenta buscar da NUVEM (Firestore)
        const snap = await getDoc(userDocRef);

        if (snap.exists()) {
          const data = snap.data();

          const perfilCloud = data.profile || DEFAULT_PROFILE;
          const transacoesCloud = data.transacoes || [];
          const cartoesCloud = data.cartoes || [];
          const reservaCloud = data.reserva || DEFAULT_RESERVA;

          // Atualiza estado com o que está na nuvem
          setProfile(perfilCloud);
          setTransacoes(transacoesCloud);
          setCartoes(cartoesCloud);
          setReserva(reservaCloud);

          // Também guarda isso no localStorage (cópia)
          saveToStorage(`profile_${uid}`, perfilCloud);
          saveToStorage(`transacoes_${uid}`, transacoesCloud);
          saveToStorage(`cartoes_${uid}`, cartoesCloud);
          saveToStorage(`reserva_${uid}`, reservaCloud);
        } else {
          // 2) Se NÃO existir nada na nuvem, tenta buscar do LOCAL
          const storedProfile = loadFromStorage(`profile_${uid}`, null);
          const storedTransacoes = loadFromStorage(`transacoes_${uid}`, null);
          const storedCartoes = loadFromStorage(`cartoes_${uid}`, null);
          const storedReserva = loadFromStorage(`reserva_${uid}`, null);

          const perfilInicial = storedProfile || DEFAULT_PROFILE;
          const transacoesIniciais = storedTransacoes || [];
          const cartoesIniciais = storedCartoes || [];
          const reservaInicial = storedReserva || DEFAULT_RESERVA;

          setProfile(perfilInicial);
          setTransacoes(transacoesIniciais);
          setCartoes(cartoesIniciais);
          setReserva(reservaInicial);

          // E joga ISSO pra nuvem (primeiro cadastro desse usuário)
          await setDoc(
            userDocRef,
            {
              profile: perfilInicial,
              transacoes: transacoesIniciais,
              cartoes: cartoesIniciais,
              reserva: reservaInicial,
            },
            { merge: true }
          );
        }

        // Marca que já carregamos dados iniciais
        setDadosCarregados(true);

        // 3) Ouvir em tempo real (sincroniza entre dispositivos)
        unsubSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (!docSnap.exists()) return;
          const data = docSnap.data();

          if (data.profile) setProfile(data.profile);
          if (data.transacoes) setTransacoes(data.transacoes);
          if (data.cartoes) setCartoes(data.cartoes);
          if (data.reserva) setReserva(data.reserva);
        });
      } catch (err) {
        console.error("Erro ao carregar dados iniciais do Firestore:", err);
        // Em caso de erro, pelo menos tenta local
        const uid = user.uid;
        const storedProfile = loadFromStorage(`profile_${uid}`, DEFAULT_PROFILE);
        const storedTransacoes = loadFromStorage(`transacoes_${uid}`, []);
        const storedCartoes = loadFromStorage(`cartoes_${uid}`, []);
        const storedReserva = loadFromStorage(`reserva_${uid}`, DEFAULT_RESERVA);

        setProfile(storedProfile);
        setTransacoes(storedTransacoes);
        setCartoes(storedCartoes);
        setReserva(storedReserva);
        setDadosCarregados(true);
      }
    })();

    return () => {
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [user]);

  /* ------- 2) SEMPRE QUE MUDAR (DEPOIS DE CARREGAR), SALVAR NA NUVEM ------- */

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

    // Sempre mantém backup local
    saveToStorage(`profile_${uid}`, profile);
    saveToStorage(`transacoes_${uid}`, transacoes);
    saveToStorage(`cartoes_${uid}`, cartoes);
    saveToStorage(`reserva_${uid}`, reserva);

    // Sem internet → guarda como pendência
    if (!navigator.onLine) {
      console.log("Sem internet: salvando atualização pendente no storage.");
      saveToStorage(`pendingSync_${uid}`, payload);
      return;
    }

    // Com internet → manda pro Firestore
    setDoc(userDocRef, payload, { merge: true })
      .then(() => {
        saveToStorage(`pendingSync_${uid}`, null);
      })
      .catch((err) => {
        console.error("Erro ao salvar dados no Firestore:", err);
        saveToStorage(`pendingSync_${uid}`, payload);
      });
  }, [user, dadosCarregados, profile, transacoes, cartoes, reserva]);

  /* ------- 3) SINCRONIZAR PENDÊNCIAS QUANDO VOLTAR A INTERNET ------- */

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

  const adicionarTransacao = (dados) => {
    const nova = {
      ...dados,
      id: generateId(),
      dataHora: dados.dataHora || new Date().toISOString(),
    };
    setTransacoes((prev) => [nova, ...prev]);
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

      mesReferencia,
      mudarMesReferencia,
      irParaMesAtual,

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
