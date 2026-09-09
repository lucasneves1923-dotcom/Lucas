import React, { useEffect, useState } from 'react';

// Protótipo visual do painel do síndico. Sistema separado do app do
// morador (outro código, potencialmente outro domínio) — o morador não
// tem como chegar nesta tela a partir do próprio app dele. O login exige
// os dois fatores (código + PIN); o servidor é quem decide, a cada
// chamada, se quem está autenticado realmente é síndico.

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
  const [pin, setPin] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  async function solicitarCodigo(e) {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    try {
      await chamarApi('/auth/sindico/solicitar-codigo', { metodo: 'POST', corpo: { telefone } });
      setEtapa('segundo-fator');
    } catch {
      setErro('Não foi possível enviar o código agora.');
    } finally {
      setCarregando(false);
    }
  }

  async function verificarSegundoFator(e) {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    try {
      const dados = await chamarApi('/auth/sindico/verificar-codigo', {
        metodo: 'POST',
        corpo: { telefone, codigo, pin }
      });
      onLogado({ token: dados.token, pinPendente: !dados.usuario?.pinConfigurado });
    } catch {
      setErro('Código ou PIN inválidos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">Painel do síndico</h1>
        <p className="text-sm text-slate-500 mb-6">Portaria Jardim Aurora — acesso restrito.</p>

        {etapa === 'telefone' && (
          <form onSubmit={solicitarCodigo} className="space-y-4">
            <input
              type="tel"
              placeholder="Telefone cadastrado"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              required
            />
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50"
            >
              {carregando ? 'Enviando...' : 'Continuar'}
            </button>
          </form>
        )}

        {etapa === 'segundo-fator' && (
          <form onSubmit={verificarSegundoFator} className="space-y-4">
            <div>
              <label className="text-sm text-slate-600">Código recebido</label>
              <input
                type="text"
                inputMode="numeric"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">PIN de administrador</label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="deixe em branco no primeiro acesso"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
              />
            </div>
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50"
            >
              {carregando ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        )}

        {erro && <p className="text-sm text-red-600 mt-4">{erro}</p>}
      </div>
    </div>
  );
}

function TelaDefinirPin({ token, temPin, onDefinido }) {
  const [pinAtual, setPinAtual] = useState('');
  const [pinNovo, setPinNovo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    try {
      await chamarApi('/admin/definir-pin', { metodo: 'POST', token, corpo: { pinAtual, pinNovo } });
      onDefinido();
    } catch {
      setErro('Não foi possível salvar o PIN. Confira o PIN atual e tente de novo.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
        <h1 className="text-lg font-semibold text-slate-800 mb-4">
          {temPin ? 'Trocar PIN de administrador' : 'Defina seu PIN de administrador'}
        </h1>
        <form onSubmit={salvar} className="space-y-4">
          {temPin && (
            <input
              type="password"
              placeholder="PIN atual"
              value={pinAtual}
              onChange={(e) => setPinAtual(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          )}
          <input
            type="password"
            placeholder="Novo PIN (4 a 6 dígitos)"
            value={pinNovo}
            onChange={(e) => setPinNovo(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            required
          />
          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50"
          >
            {carregando ? 'Salvando...' : 'Salvar PIN'}
          </button>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </form>
      </div>
    </div>
  );
}

function TabelaMoradores({ token }) {
  const [moradores, setMoradores] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');

  async function recarregar() {
    setCarregando(true);
    try {
      const dados = await chamarApi('/admin/moradores', { token });
      setMoradores(dados);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cadastrar(e) {
    e.preventDefault();
    await chamarApi('/admin/moradores', { metodo: 'POST', token, corpo: { nome: novoNome, telefone: novoTelefone } });
    setNovoNome('');
    setNovoTelefone('');
    recarregar();
  }

  async function revogar(id) {
    await chamarApi(`/admin/moradores/${id}/revogar`, { metodo: 'POST', token });
    recarregar();
  }

  const filtrados = moradores.filter(
    (m) => m.nome.toLowerCase().includes(busca.toLowerCase()) || m.telefone.includes(busca)
  );

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Moradores</h2>

      <form onSubmit={cadastrar} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <input
          placeholder="Nome"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2"
          required
        />
        <input
          placeholder="Telefone"
          value={novoTelefone}
          onChange={(e) => setNovoTelefone(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2"
          required
        />
        <button type="submit" className="bg-blue-600 text-white rounded-lg py-2 font-medium">
          Cadastrar morador
        </button>
      </form>

      <input
        placeholder="Buscar por nome ou telefone"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4"
      />

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="py-2">Nome</th>
              <th>Telefone</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((m) => (
              <tr key={m.id} className="border-b border-slate-50">
                <td className="py-2">{m.nome}</td>
                <td>{m.telefone}</td>
                <td className={m.ativo ? 'text-green-600' : 'text-slate-400'}>{m.ativo ? 'ativo' : 'revogado'}</td>
                <td>
                  {m.ativo && (
                    <button onClick={() => revogar(m.id)} className="text-red-600 text-xs underline">
                      revogar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TabelaHistorico({ token }) {
  const [aberturas, setAberturas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    chamarApi('/admin/historico', { token })
      .then(setAberturas)
      .finally(() => setCarregando(false));
  }, [token]);

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Histórico de acessos</h2>
      {carregando ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {aberturas.map((a) => (
            <div key={a.id} className="py-2 flex justify-between text-sm">
              <span className="text-slate-700">{new Date(a.criado_em).toLocaleString('pt-BR')}</span>
              <span className="text-slate-500">{a.origem}</span>
              <span className={a.resultado === 'sucesso' ? 'text-green-600' : 'text-red-500'}>{a.resultado}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoRelatorio({ token }) {
  const [relatorio, setRelatorio] = useState(null);

  useEffect(() => {
    chamarApi('/admin/relatorios/anomalias', { token }).then(setRelatorio);
  }, [token]);

  if (!relatorio) return null;

  const { anomalias } = relatorio;

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Relatório — últimos {relatorio.periodo.dias} dias</h2>
      <p className="text-sm text-slate-600 mb-2">Total de aberturas: {relatorio.totalAberturas}</p>

      <div className="mt-3">
        <h3 className="text-sm font-medium text-slate-700">Aberturas fora do horário habitual</h3>
        {anomalias.aberturasForaDeHorario.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma.</p>
        ) : (
          <p className="text-sm text-amber-600">{anomalias.aberturasForaDeHorario.length} ocorrência(s)</p>
        )}
      </div>

      <div className="mt-3">
        <h3 className="text-sm font-medium text-slate-700">Usuários com tentativas bloqueadas repetidas</h3>
        {anomalias.usuariosComTentativasRepetidas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum.</p>
        ) : (
          <p className="text-sm text-amber-600">{anomalias.usuariosComTentativasRepetidas.length} usuário(s)</p>
        )}
      </div>
    </div>
  );
}

export default function AdminPanelPrototype() {
  const [sessao, setSessao] = useState(null);
  const [aba, setAba] = useState('moradores');

  if (!sessao) return <TelaLogin onLogado={setSessao} />;

  if (sessao.pinPendente) {
    return (
      <TelaDefinirPin
        token={sessao.token}
        temPin={false}
        onDefinido={() => setSessao({ ...sessao, pinPendente: false })}
      />
    );
  }

  const abas = [
    { id: 'moradores', rotulo: 'Moradores' },
    { id: 'historico', rotulo: 'Histórico' },
    { id: 'relatorios', rotulo: 'Relatórios' }
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="font-semibold">Painel do síndico — Jardim Aurora</h1>
        <nav className="flex gap-4 text-sm">
          {abas.map((item) => (
            <button
              key={item.id}
              onClick={() => setAba(item.id)}
              className={aba === item.id ? 'text-white font-medium' : 'text-slate-400'}
            >
              {item.rotulo}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {aba === 'moradores' && <TabelaMoradores token={sessao.token} />}
        {aba === 'historico' && <TabelaHistorico token={sessao.token} />}
        {aba === 'relatorios' && <CartaoRelatorio token={sessao.token} />}
      </main>
    </div>
  );
}
