const firebaseConfig = {
  apiKey: "AIzaSyDMR6Aq9KoDGPkZLZueBgIo7AhNx5Gj08Q",
  authDomain: "nosso-bolso-c8d29.firebaseapp.com",
  projectId: "nosso-bolso-c8d29",
  storageBucket: "nosso-bolso-c8d29.firebasestorage.app",
  messagingSenderId: "812166717623",
  appId: "1:812166717623:web:ba3a4c0db18484be47ad32"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let usuarioAtualUid = null;
let workspaceIdAtual = "7420";
let mesSelecionado = "Outubro 2026";
let transactions = [];
let membrosDoGrupo = {};
let tipoTxAtual = "EXPENSE";
let chartPieInstance = null;
let chartBarInstance = null;

function aplicarTemaInicial() {
  document.documentElement.classList.add('dark');
}
aplicarTemaInicial();

// FORÇA A ABERTURA IMEDIATA DO PAINEL SEMPRE
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.replace("index.html");
    return;
  }
  usuarioAtualUid = user.uid;

  // Fecha imediatamente qualquer ecrã de carregamento
  document.getElementById('loadingScreen')?.classList.add('hidden');
  document.getElementById('pendingScreen')?.classList.add('hidden');
  document.getElementById('setupWorkspaceModal')?.classList.add('hidden');

  inicializarPainel();
});

function logout() {
  auth.signOut().then(() => window.location.replace("index.html"));
}

function inicializarPainel() {
  const elemCode = document.getElementById('profileWorkspaceCodeDisplay');
  if (elemCode) elemCode.innerText = workspaceIdAtual;
  
  const elemWelcome = document.getElementById('headerWelcomeMsg');
  if (elemWelcome) elemWelcome.innerText = `Grupo: ${workspaceIdAtual}`;
  
  ouvirTransacoes();
  carregarMural();
}

function switchTab(tabName) {
  ['resumo', 'extrato', 'invest', 'mural'].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.add('hidden');
    const btnNav = document.getElementById(`bottomNav${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btnNav) {
      btnNav.className = "flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95 py-0.5";
    }
  });

  document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');
  const btnAtivo = document.getElementById(`bottomNav${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (btnAtivo) {
    btnAtivo.className = "flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 transition active:scale-95 py-0.5";
  }
}

function changeActiveMonth(mes) {
  mesSelecionado = mes;
  processarDadosEstatisticas();
}

function ouvirTransacoes() {
  db.collection('transacoes')
    .onSnapshot((snapshot) => {
      transactions = [];
      snapshot.forEach(doc => {
        transactions.push({ id: doc.id, ...doc.data() });
      });
      processarDadosEstatisticas();
    }, (err) => {
      console.error(err);
      processarDadosEstatisticas();
    });
}

function openNewTxModal() {
  document.getElementById('txForm')?.reset();
  const dateInput = document.getElementById('txDate');
  if (dateInput) dateInput.valueAsDate = new Date();
  document.getElementById('newTxModal')?.classList.remove('hidden');
}

function closeNewTxModal() {
  document.getElementById('newTxModal')?.classList.add('hidden');
}

function selecionarTipoTx(tipo) {
  tipoTxAtual = tipo;
  const lEntrada = document.getElementById('labelTabEntrada');
  const lSaida = document.getElementById('labelTabSaida');
  if (tipo === 'INCOME') {
    if (lEntrada) lEntrada.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer bg-white dark:bg-[#121c38] text-emerald-600 shadow-2xs transition";
    if (lSaida) lSaida.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer text-slate-500 transition";
  } else {
    if (lSaida) lSaida.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer bg-white dark:bg-[#121c38] text-rose-600 shadow-2xs transition";
    if (lEntrada) lEntrada.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer text-slate-500 transition";
  }
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  const descricao = document.getElementById('txDesc').value.trim();
  const valor = parseFloat(document.getElementById('txAmount').value);
  const data = document.getElementById('txDate').value;
  const categoria = document.getElementById('txCat').value;
  const subcategoria = document.getElementById('txSubcat').value;

  try {
    await db.collection('transacoes').add({
      workspaceId: workspaceIdAtual,
      membroId: usuarioAtualUid,
      mesAno: mesSelecionado,
      tipo: tipoTxAtual,
      descricao,
      valor,
      data,
      categoria,
      subcategoria,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeNewTxModal();
  } catch (err) {
    alert("Erro ao guardar transação.");
  }
}

async function eliminarTransacao(id) {
  if (confirm("Deseja eliminar este lançamento?")) {
    try {
      await db.collection('transacoes').doc(id).delete();
    } catch (err) {
      alert("Erro ao eliminar.");
    }
  }
}

function processarDadosEstatisticas() {
  const txsMes = transactions.filter(t => t.mesAno === mesSelecionado);
  
  let totalIncome = 0;
  let totalExpense = 0;
  let catTotals = { "Gastos Fixos": 0, "Gastos Gerais": 0, "Lazer": 0, "Investimentos": 0 };
  let totalInvestMonth = 0;

  txsMes.forEach(t => {
    const val = Number(t.valor) || 0;
    if (t.tipo === 'INCOME') {
      totalIncome += val;
    } else {
      totalExpense += val;
      if (catTotals[t.categoria] !== undefined) {
        catTotals[t.categoria] += val;
      }
      if (t.categoria === 'Investimentos') {
        totalInvestMonth += val;
      }
    }
  });

  const saldo = totalIncome - totalExpense;

  if (document.getElementById('statIncome')) document.getElementById('statIncome').innerText = `R$ ${totalIncome.toFixed(2)}`;
  if (document.getElementById('statExpense')) document.getElementById('statExpense').innerText = `R$ ${totalExpense.toFixed(2)}`;
  if (document.getElementById('statBalance')) document.getElementById('statBalance').innerText = `R$ ${saldo.toFixed(2)}`;
  if (document.getElementById('monthInvestTotalHeader')) document.getElementById('monthInvestTotalHeader').innerText = `R$ ${totalInvestMonth.toFixed(2)}`;

  renderTransactionsList(txsMes);
  renderizarGraficos(catTotals, totalExpense);
  renderizarProgressoMetas(catTotals, totalExpense);
}

function renderTransactionsList(lista) {
  const container = document.getElementById('txListContainer');
  if (!container) return;

  const termoPesquisa = document.getElementById('searchExpense')?.value.toLowerCase() || '';
  const filtroMembro = document.getElementById('filterMember')?.value || '';
  const filtroCat = document.getElementById('filterCategory')?.value || '';
  const filtroSubcat = document.getElementById('filterSubcat')?.value || '';

  const filtradas = lista.filter(t => {
    const matchPesquisa = t.descricao.toLowerCase().includes(termoPesquisa);
    const matchMembro = filtroMembro ? t.membroId === filtroMembro : true;
    const matchCat = filtroCat ? t.categoria === filtroCat : true;
    const matchSubcat = filtroSubcat ? t.subcategoria === filtroSubcat : true;
    return matchPesquisa && matchMembro && matchCat && matchSubcat;
  });

  container.innerHTML = '';
  if (filtradas.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 text-center py-6">Nenhum lançamento encontrado.</div>`;
    return;
  }

  filtradas.forEach(tx => {
    const tagSubcat = tx.subcategoria ? `<span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[9px] font-extrabold ml-1">${tx.subcategoria}</span>` : '';
    container.innerHTML += `
      <div class="flex items-center justify-between bg-white dark:bg-[#121c38] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <div class="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
            ${tx.descricao} ${tagSubcat}
          </div>
          <div class="text-[10px] text-slate-400">${tx.data} • ${tx.categoria}</div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-xs font-black ${tx.tipo === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}">
            ${tx.tipo === 'INCOME' ? '+' : '-'} R$ ${Number(tx.valor).toFixed(2)}
          </div>
          <button onclick="eliminarTransacao('${tx.id}')" class="text-slate-400 hover:text-rose-500 transition"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
      </div>
    `;
  });
}

function renderizarGraficos(catTotals, totalExpense) {
  const ctxPie = document.getElementById('categoryPieChart')?.getContext('2d');
  const ctxBar = document.getElementById('categoryBarChart')?.getContext('2d');
  if (!ctxPie || !ctxBar) return;

  const dados = [catTotals["Gastos Fixos"], catTotals["Gastos Gerais"], catTotals["Lazer"], catTotals["Investimentos"]];
  const cores = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b'];

  if (chartPieInstance) chartPieInstance.destroy();
  chartPieInstance = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: ['Fixos', 'Gerais', 'Lazer', 'Invest.'],
      datasets: [{ data: dados, backgroundColor: cores, borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  if (chartBarInstance) chartBarInstance.destroy();
  chartBarInstance = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: ['Fixos', 'Gerais', 'Lazer', 'Invest.'],
      datasets: [{ data: dados, backgroundColor: cores, borderRadius: 6 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { display: false } } }
  });
}

function renderizarProgressoMetas(catTotals, totalExpense) {
  const container = document.getElementById('cardsCategoryContainer');
  if (!container) return;

  const cats = [
    { nome: 'Gastos Fixos', val: catTotals["Gastos Fixos"], cor: 'bg-blue-500' },
    { nome: 'Gastos Gerais', val: catTotals["Gastos Gerais"], cor: 'bg-emerald-500' },
    { nome: 'Lazer', val: catTotals["Lazer"], cor: 'bg-purple-500' },
    { nome: 'Investimentos', val: catTotals["Investimentos"], cor: 'bg-amber-500' }
  ];

  container.innerHTML = '';
  cats.forEach(c => {
    const perc = totalExpense > 0 ? ((c.val / totalExpense) * 100).toFixed(0) : 0;
    container.innerHTML += `
      <div class="bg-slate-50 dark:bg-[#0b132b] p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
        <div class="flex justify-between text-[10px] font-bold">
          <span class="text-slate-600 dark:text-slate-300">${c.nome}</span>
          <span class="text-slate-900 dark:text-white">R$ ${c.val.toFixed(2)}</span>
        </div>
        <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div class="${c.cor} h-full rounded-full transition-all duration-500" style="width: ${Math.min(perc, 100)}%"></div>
        </div>
      </div>
    `;
  });
}

function openProfileModal() {
  document.getElementById('profileModal')?.classList.remove('hidden');
}

function closeProfileModal() {
  document.getElementById('profileModal')?.classList.add('hidden');
}

function copyWorkspaceCountCode() {
  navigator.clipboard.writeText(workspaceIdAtual);
  alert("Código de convite copiado!");
}

function salvarMetasGrupoConfig(e) {
  e.preventDefault();
  closeProfileModal();
}

function carregarMural() {}
async function escreverNaLousa(e) { e.preventDefault(); }
async function apagarLousa() {}
function atualizarContador() {}
function mudarModoMetas() {}
function calcularConversaoMetas() {}
