// 🔥 App.jsx – MODO A (Offline sempre vence)
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

import { auth, loginComGoogle, logout, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

/* --------------------------------------------- */
/*        CONFIGURAÇÕES E VALORES PADRÃO         */
/* --------------------------------------------- */

const FinanceContext = createContext(null);
export function useFinance() {
  return useContext(FinanceContext);
}

const DEFAULT_PROFILE = {
  nome: "",
  rendaMensal: "",
  limiteGastoMensal: "",
  metaReservaMensal: "",
  reservaAcumulada: "",
  diaPagamento: "",
  avatarBase64: "",
};

const DEFAULT_RESERVA = { metaMensal: 0, locais: [], movimentos: [] };

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
}

/* --------------------------------------------- */
/*                COMPONENTE APP                 */
/* --------------------------------------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [transacoes, setTransacoes] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [reserva, setReserva] = useState(DEFAULT_RESERVA);

  const hoje = new Date();
  const [mesReferencia, setMesReferencia] = useState({
    mes: hoje.getMonth(),
    ano: hoje.getFullYear(),
  });

  const [abaAtiva, setAbaAtiva] = useState("financas");
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [snapshotAtivo, setSnapshotAtivo] = useState(false);

  /* LOGIN / LOGOUT */
  useEffect(() => {
    return onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser || null);
      setAuthLoading(false);
      setDadosCarregados(false);
      setSnapshotAtivo(false);
    });
  }, []);

  /* CARREGAR DO LOCALSTORAGE (PRIMEIRO SEMPRE) */
  useEffect(() => {
    if (!user) return;

    const uid = user.uid;

    setProfile(lsGet(`profile_${uid}`, DEFAULT_PROFILE));
    setTransacoes(lsGet(`transacoes_${uid}`, []));
    setCartoes(lsGet(`cartoes_${uid}`, []));
    setReserva(lsGet(`reserva_${uid}`, DEFAULT_RESERVA));

    setDadosCarregados(true);
  }, [user]);

  /* SINCRONIZAR COM FIRESTORE SOMENTE DEPOIS DE CARREGAR O LOCAL */
  useEffect(() => {
    if (!user || !dadosCarregados) return;

    const uid = user.uid;
    const userDocRef = doc(db, "users", uid);

    async function sincronizar() {
      if (!navigator.onLine) return;

      setSincronizando(true);

      try {
        const localData = {
          profile,
          transacoes,
          cartoes,
          reserva,
        };

        await setDoc(userDocRef, localData, { merge: true });

        setSnapshotAtivo(true);
      } catch (err) {
        console.error("Erro ao sincronizar:", err);
      }

      setSincronizando(false);
    }

    sincronizar();
  }, [user, dadosCarregados]);

  /* SNAPSHOT SÓ ATIVA DEPOIS DA PRIMEIRA SINCRONIZAÇÃO */
  useEffect(() => {
    if (!snapshotAtivo || !user) return;

    const uid = user.uid;
    const userDocRef = doc(db, "users", uid);

    return onSnapshot(userDocRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      setProfile(data.profile || DEFAULT_PROFILE);
      setTransacoes(data.transacoes || []);
      setCartoes(data.cartoes || []);
      setReserva(data.reserva || DEFAULT_RESERVA);
    });
  }, [snapshotAtivo, user]);

  /* SALVAR LOCAL SEMPRE QUE ALTERAR */
  useEffect(() => {
    if (user) lsSet(`profile_${user.uid}`, profile);
  }, [profile]);

  useEffect(() => {
    if (user) lsSet(`transacoes_${user.uid}`, transacoes);
  }, [transacoes]);

  useEffect(() => {
    if (user) lsSet(`cartoes_${user.uid}`, cartoes);
  }, [cartoes]);

  useEffect(() => {
    if (user) lsSet(`reserva_${user.uid}`, reserva);
  }, [reserva]);

  /* FUNÇÕES DO CONTEXTO */
  const addTransacao = (t) =>
    setTransacoes((prev) => [
      { ...t, id: generateId(), dataHora: new Date().toISOString() },
      ...prev,
    ]);

  const contexto = {
    user,
    profile,
    setProfile,
    transacoes,
    addTransacao,
    setTransacoes,
    cartoes,
    setCartoes,
    reserva,
    setReserva,
    mesReferencia,
    setMesReferencia,
    loginComGoogle,
    logout,
  };

  /* TELAS */
  let pagina = <FinancasPage />;
  if (abaAtiva === "reserva") pagina = <ReservaPage />;
  if (abaAtiva === "transacoes") pagina = <TransacoesPage />;
  if (abaAtiva === "cartoes") pagina = <CartoesPage />;
  if (abaAtiva === "historico") pagina = <HistoricoPage />;
  if (abaAtiva === "perfil") pagina = <PerfilPage />;

  /* CARREGANDO */
  if (authLoading) {
    return <div className="center">Carregando...</div>;
  }

  /* LOGIN */
  if (!user) {
    return (
      <div className="center">
        <h1>Finanças Offline</h1>
        <button
          onClick={() => {
            if (!navigator.onLine) {
              alert("Conecte-se à internet para fazer login");
              return;
            }
            loginComGoogle();
          }}
        >
          Entrar com Google
        </button>
      </div>
    );
  }

  /* APP */
  return (
    <FinanceContext.Provider value={contexto}>
      <div className="app-root">
        <main className="app-main">{pagina}</main>

        {/* MENU */}
        <nav className="bottom-nav">
          <button onClick={() => setAbaAtiva("financas")}>💰</button>
          <button onClick={() => setAbaAtiva("reserva")}>🛟</button>
          <button onClick={() => setAbaAtiva("transacoes")}>📥</button>
          <button onClick={() => setAbaAtiva("cartoes")}>💳</button>
          <button onClick={() => setAbaAtiva("historico")}>📜</button>
          <button onClick={() => setAbaAtiva("perfil")}>👤</button>
        </nav>
      </div>
    </FinanceContext.Provider>
  );
}
