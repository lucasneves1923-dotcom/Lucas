import React, { useEffect, useState } from 'react';

// Protótipo visual do app do morador. Sem tela de "criar conta" em nenhum
// lugar — só existe login por telefone + código, e o telefone precisa já
// ter sido cadastrado pelo síndico. Este app não conhece o painel do
// síndico e não tem nenhuma tela, rota ou opção que fale sobre "papel" de
// usuário: o servidor decide isso sozinho.

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || 'http://localhost:3000';

async function chamarApi(caminho, { metodo = 'GET', corpo, token } = {}) {
  const resposta = await fetch(`${API_BASE}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = new Error(dados?.erro || 'falha na requisição');
    erro.status = resposta.status;
    erro.corpo = dados;
    throw erro;
  }
  return dados;
}

function TelaLogin({ onLogado }) {
  const [etapa, setEtapa] = useState('telefone');
  const [telefone, setTelefone] = useState('');
  const [codigo, setCodigo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  async function solicitarCodigo(e) {
    e.preventDefault();
    setCarregando(true);
    setMensagem('');
    try {
      await chamarApi('/auth/morador/solicitar-codigo', { metodo: 'POST', corpo: { telefone } });
      setEtapa('codigo');
      setMensagem('Enviamos um código por SMS/WhatsApp para o seu telefone.');
    } catch {
      setMensagem('Não foi possível enviar o código agora. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  async function verificarCodigo(e) {
    e.preventDefault();
    setCarregando(true);
    setMensagem('');
    try {
      const dados = await chamarApi('/auth/morador/verificar-codigo', {
        metodo: 'POST',
        corpo: { telefone, codigo }
      });
      onLogado(dados.token);
    } catch {
      setMensagem('Código inválido ou expirado.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">Portaria Jardim Aurora</h1>
        <p className="text-sm text-slate-500 mb-6">Entre com o número de telefone cadastrado pelo síndico.</p>

        {etapa === 'telefone' && (
          <form onSubmit={solicitarCodigo} className="space-y-4">
            <input
              type="tel"
              placeholder="(11) 99999-0000"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50"
            >
              {carregando ? 'Enviando...' : 'Receber código'}
            </button>
          </form>
        )}

        {etapa === 'codigo' && (
          <form onSubmit={verificarCodigo} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Código recebido"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50"
            >
              {carregando ? 'Verificando...' : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={() => setEtapa('telefone')}
              className="w-full text-sm text-slate-500 underline"
            >
              usar outro telefone
            </button>
          </form>
        )}

        {mensagem && <p className="text-sm text-slate-600 mt-4">{mensagem}</p>}
      </div>
    </div>
  );
}

function CartaoAbrirPortao({ token, portaoId }) {
  const [cooldownRestante, setCooldownRestante] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (cooldownRestante <= 0) return undefined;
    const id = setInterval(() => setCooldownRestante((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownRestante]);

  async function abrirPortao() {
    setCarregando(true);
    setStatus('');
    try {
      const dados = await chamarApi(`/portao/${portaoId}/abrir`, { metodo: 'POST', token });
      setStatus('Portão aberto!');
      setCooldownRestante(dados.tempoAberturaSeg + dados.tempoCooldownSeg);
    } catch (err) {
      if (err.status === 429) {
        setCooldownRestante(err.corpo?.restanteSeg || 10);
        setStatus('Aguarde o portão terminar o ciclo atual.');
      } else {
        setStatus('Não foi possível abrir o portão agora.');
      }
    } finally {
      setCarregando(false);
    }
  }

  const bloqueado = carregando || cooldownRestante > 0;

  return (
    <div className="bg-white rounded-2xl shadow p-6 text-center">
      <button
        onClick={abrirPortao}
        disabled={bloqueado}
        className={`w-40 h-40 rounded-full mx-auto flex items-center justify-center text-white text-lg font-semibold transition
          ${bloqueado ? 'bg-slate-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}
      >
        {cooldownRestante > 0 ? `${cooldownRestante}s` : 'Abrir portão'}
      </button>
      {status && <p className="text-sm text-slate-600 mt-4">{status}</p>}
    </div>
  );
}

function AbaCamera({ urlStream }) {
  return (
    <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
      {urlStream ? (
        <img src={urlStream} alt="Câmera do portão ao vivo" className="w-full h-full object-cover" />
      ) : (
        <p className="text-slate-400 text-sm">Câmera indisponível no momento.</p>
      )}
    </div>
  );
}

function AbaVisitantes({ token, portaoId }) {
  const [validadeMinutos, setValidadeMinutos] = useState(60);
  const [limiteUsos, setLimiteUsos] = useState(1);
  const [link, setLink] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function gerarLink(e) {
    e.preventDefault();
    setCarregando(true);
    try {
      const dados = await chamarApi('/visitantes/link', {
        metodo: 'POST',
        token,
        corpo: { portaoId, validadeMinutos: Number(validadeMinutos), limiteUsos: Number(limiteUsos) }
      });
      setLink(dados);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Link de acesso para visitante</h2>
      <form onSubmit={gerarLink} className="space-y-3">
        <label className="block text-sm text-slate-600">
          Válido por (minutos)
          <input
            type="number"
            min={5}
            max={1440}
            value={validadeMinutos}
            onChange={(e) => setValidadeMinutos(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
          />
        </label>
        <label className="block text-sm text-slate-600">
          Quantidade de usos permitidos
          <input
            type="number"
            min={1}
            max={20}
            value={limiteUsos}
            onChange={(e) => setLimiteUsos(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
          />
        </label>
        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {carregando ? 'Gerando...' : 'Gerar link'}
        </button>
      </form>

      {link && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm break-all">
          <p className="text-slate-500 mb-1">Compartilhe este link com o visitante:</p>
          <p className="font-mono text-slate-800">{`${window.location.origin}${link.caminho}`}</p>
        </div>
      )}
    </div>
  );
}

function AbaHistorico({ token }) {
  const [aberturas, setAberturas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    chamarApi('/meu-historico', { token })
      .then(setAberturas)
      .finally(() => setCarregando(false));
  }, [token]);

  if (carregando) return <p className="text-sm text-slate-500">Carregando...</p>;

  return (
    <div className="bg-white rounded-2xl shadow divide-y divide-slate-100">
      {aberturas.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhuma abertura ainda.</p>}
      {aberturas.map((a) => (
        <div key={a.id} className="p-4 flex justify-between text-sm">
          <span className="text-slate-700">{new Date(a.criado_em).toLocaleString('pt-BR')}</span>
          <span className={a.resultado === 'sucesso' ? 'text-green-600' : 'text-red-500'}>{a.resultado}</span>
        </div>
      ))}
    </div>
  );
}

export default function CondoAppPrototype({ portaoIdPadrao = 'PORTAO_ID', urlCamera }) {
  const [token, setToken] = useState(null);
  const [aba, setAba] = useState('portao');

  if (!token) return <TelaLogin onLogado={setToken} />;

  const abas = [
    { id: 'portao', rotulo: 'Portão' },
    { id: 'camera', rotulo: 'Câmera' },
    { id: 'visitantes', rotulo: 'Visitantes' },
    { id: 'historico', rotulo: 'Meu histórico' }
  ];

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <header className="bg-white shadow px-4 py-3">
        <h1 className="font-semibold text-slate-800">Portaria Jardim Aurora</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {aba === 'portao' && <CartaoAbrirPortao token={token} portaoId={portaoIdPadrao} />}
        {aba === 'camera' && <AbaCamera urlStream={urlCamera} />}
        {aba === 'visitantes' && <AbaVisitantes token={token} portaoId={portaoIdPadrao} />}
        {aba === 'historico' && <AbaHistorico token={token} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex">
        {abas.map((item) => (
          <button
            key={item.id}
            onClick={() => setAba(item.id)}
            className={`flex-1 py-3 text-sm ${aba === item.id ? 'text-blue-600 font-medium' : 'text-slate-500'}`}
          >
            {item.rotulo}
          </button>
        ))}
      </nav>
    </div>
  );
}
