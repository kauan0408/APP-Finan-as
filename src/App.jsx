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

// Valores padrão centralizados
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

// Mescla arrays de objetos pelo campo id (remote + offline, sem perder nada)
function mergeById(remote = [], offline = []) {
  const map = new Map();
  remote.forEach((item) => {
    if (item && item.id) map.set(item.id, item);
    else map.set(Symbol(), item);
  });
  offline.forEach((item) => {
    if (item && item.id) map.set(item.id, item); // offline sobrescreve mesmo id
    else map.set(Symbol(), item);
  });
  return Array.from(map.values());
}

/* ---------------- COMPONENTE PRINCIPAL ---------------- */

export default function App() {
  // 🔐 Usuário logado (Google)
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 👇 trava pra não salvar no Firebase antes de carregar de lá
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
      // sempre que trocar de usuário, zera a flag
      setDadosCarregados(false);
    });

    return () => unsub();
  }, []);

  /* ------- CARREGAR DADOS DA CONTA CERTA (LOCALSTORAGE – BACKUP) ------- */

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;

    const storedProfile = loadFromStorage(`profile_${uid}`, DEFAULT_PROFILE);
    const storedTransacoes = loadFromStorage(`transacoes_${uid}`, []);
    const storedCartoes = loadFromStorage(`cartoes_${uid}`, []);
    const storedReserva = loadFromStorage(`reserva_${uid}`, DEFAULT_RESERVA);

    setProfile(storedProfile);
    setTransacoes(storedTransacoes);
    setCartoes(storedCartoes);
    setReserva(storedReserva);
  }, [user]);

  /* ------- CARREGAR/SINCRONIZAR COM FIRESTORE (users/{uid}) ------- */
  // MODO SEGURO: mescla o que está no Firestore com o que ficou pendente offline

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    const userDocRef = doc(db, "users", uid);
    let unsub;

    (async () => {
      try {
        // 1) Busca dados pendentes (offline) se existir
        const pendente = loadFromStorage(`pendingSync_${uid}`, null);

        // 2) Busca dados remotos atuais
        const snap = await getDoc(userDocRef);

        let remoto = {
          profile: DEFAULT_PROFILE,
          transacoes: [],
          cartoes: [],
          reserva: DEFAULT_RESERVA,
        };

        if (snap.exists()) {
          const data = snap.data();
          remoto = {
            profile: data.profile || DEFAULT_PROFILE,
            transacoes: data.transacoes || [],
            cartoes: data.cartoes || [],
            reserva: data.reserva || DEFAULT_RESERVA,
          };
        } else {
          // Se nunca existiu doc, cria padrão
          await setDoc(userDocRef, remoto);
        }

        // 3) Mesclar com o que estava pendente offline (se tiver)
        let finalProfile = remoto.profile;
        let finalTransacoes = remoto.transacoes;
        let finalCartoes = remoto.cartoes;
        let finalReserva = remoto.reserva;

        if (pendente) {
          // profile e reserva: offline sobrescreve se existir
          if (pendente.profile) {
            finalProfile = { ...finalProfile, ...pendente.profile };
          }
          if (pendente.reserva) {
            finalReserva = { ...finalReserva, ...pendente.reserva };
          }

          // transações e cartões: unir remoto + offline (sem perder nada)
          if (pendente.transacoes) {
            finalTransacoes = mergeById(remoto.transacoes, pendente.transacoes);
          }
          if (pendente.cartoes) {
            finalCartoes = mergeById(remoto.cartoes, pendente.cartoes);
          }
        }

        // 4) Atualiza o estado do app com o resultado mesclado
        setProfile(finalProfile);
        setTransacoes(finalTransacoes);
        setCartoes(finalCartoes);
        setReserva(finalReserva);

        // 5) Se tiver pendente e tiver internet, manda versão mesclada pro Firestore
        if (pendente && navigator.onLine) {
          await setDoc(
            userDocRef,
            {
              profile: finalProfile,
              transacoes: finalTransacoes,
              cartoes: finalCartoes,
              reserva: finalReserva,
            },
            { merge: false } // grava doc inteiro já mesclado
          );
          saveToStorage(`pendingSync_${uid}`, null);
          console.log("Pendências offline mescladas e sincronizadas no Firestore.");
        }

        // 6) Marca que os dados do Firestore já foram carregados
        setDadosCarregados(true);

        // 7) Ouvir em tempo real (sincroniza entre dispositivos)
        unsub = onSnapshot(userDocRef, (docSnap) => {
          if (!docSnap.exists()) return;
          const data = docSnap.data();

          setProfile(data.profile || DEFAULT_PROFILE);
          setTransacoes(data.transacoes || []);
          setCartoes(data.cartoes || []);
          setReserva(data.reserva || DEFAULT_RESERVA);
        });
      } catch (err) {
        console.error("Erro ao carregar dados do Firestore:", err);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  /* ------- SALVAR DADOS POR CONTA (LOCALSTORAGE – BACKUP) ------- */

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

  /* ------- SALVAR NO FIRESTORE (COM SUPORTE OFFLINE) ------- */
  // Se estiver offline, guarda um "pacote pendente" no localStorage

  useEffect(() => {
    if (!user || !dadosCarregados) return;

    const uid = user.uid;

    const payload = {
      profile,
      transacoes,
      cartoes,
      reserva,
    };

    // Sem internet → não tenta falar com o Firebase
    if (!navigator.onLine) {
      console.log("Sem internet: salvando atualização pendente no storage.");
      saveToStorage(`pendingSync_${uid}`, payload);
      return;
    }

    const userDocRef = doc(db, "users", uid);

    setDoc(userDocRef, payload, { merge: true })
      .then(() => {
        // Deu certo, limpa qualquer pendência antiga
        saveToStorage(`pendingSync_${uid}`, null);
      })
      .catch((err) => {
        console.error("Erro ao salvar dados no Firestore:", err);
        // Se der erro (internet caiu), guarda como pendente
        saveToStorage(`pendingSync_${uid}`, payload);
      });
  }, [user, dadosCarregados, profile, transacoes, cartoes, reserva]);

  /* ------- SINCRONIZAR PENDÊNCIAS QUANDO VOLTAR A INTERNET ------- */

  useEffect(() => {
    if (!user || !dadosCarregados) return;

    const uid = user.uid;

    const syncPendentes = async () => {
      const pendente = loadFromStorage(`pendingSync_${uid}`, null);
      if (!pendente) return;
      if (!navigator.onLine) return;

      try {
        const userDocRef = doc(db, "users", uid);
        // Aqui usamos merge:true porque o pendente já foi mesclado antes, se necessário
        await setDoc(userDocRef, pendente, { merge: true });
        console.log("Pendências sincronizadas com sucesso (on online event).");
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

  // 🔧 EDITAR UMA TRANSAÇÃO
  const atualizarTransacao = (id, dadosAtualizados) => {
    setTransacoes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...dadosAtualizados } : t))
    );
  };

  // 🗑️ APAGAR UMA TRANSAÇÃO
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
                    alert(
                      "Sem internet. Conecte-se para fazer login com Google."
                    );
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
