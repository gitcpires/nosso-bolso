const firebaseConfig = {
  apiKey: "AIzaSyDMR6Aq9KoDGPkZLZueBgIo7AhNx5Gj08Q",
  authDomain: "nosso-bolso-c8d29.firebaseapp.com",
  projectId: "nosso-bolso-c8d29",
  storageBucket: "nosso-bolso-c8d29.firebasestorage.app",
  messagingSenderId: "812166717623",
  appId: "1:812166717623:web:ba3a4c0db18484be47ad32"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentWorkspace = { id: '', code: '', metasPorMes: {} };
let currentUser = { id: '', name: '', email: '' };
let transactions = [];
const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const agora = new Date();
let activeMonth = `${mesesNomes[agora.getMonth()]} ${agora.getFullYear()}`;

const subcategoriasDisponiveis = [
  'Transporte',
  'Alimentação',
  'Telefonia',
  'Ticket Alimentação',
  'Serviços Públicos',
  'Outros'
];

let categoryPieChartInstance = null;
let categoryBarChartInstance = null;
let subCategoryBarChartInstance = null;
let paymentMethodBarChartInstance = null;
let modoMetasAtual = 'perc';
let editingTxId = null;

let carteiraLivreSaldos = {}; 
let gastosLivresGlobais = []; 

auth.onAuthStateChanged(async (userAuth) => {
  if (!userAuth) {
    window.location.href = 'index.html';
    return;
  }

  const uid = userAuth.uid;
  const email = userAuth.email;
  currentUser.id = uid;
  currentUser.email = email;
  currentUser.name = email.split('@')[0];

  try {
    const userDocRef = db.collection('users').doc(uid);
    let userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      await userDocRef.set({
        email: email,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      userDoc = await userDocRef.get();
    }

    const userData = userDoc.data();
    carteiraLivreSaldos = userData.carteiraLivreSaldos || {}; 
    
    if (userData.status !== 'approved') {
      document.getElementById('loadingScreen').classList.add('hidden');
      document.getElementById('pendingScreen').classList.remove('hidden');
      return;
    }

    if (!userData.workspaceId) {
      document.getElementById('loadingScreen').classList.add('hidden');
      document.getElementById('setupWorkspaceModal').classList.remove('hidden');
      return;
    }

    currentWorkspace.id = userData.workspaceId;
    currentWorkspace.code = userData.workspaceCode || '----';

    document.getElementById('loadingScreen').classList.add('hidden');
    initUserSession();

  } catch (err) {
    console.error(err);
    document.getElementById('loadingScreen').innerHTML = `<p class="text-xs text-rose-600 font-bold">Erro ao carregar dados. Tente atualizar a página.</p>`;
  }
});

function getMetasAtuais() {
  if (!currentWorkspace.metasPorMes) currentWorkspace.metasPorMes = {};
  return currentWorkspace.metasPorMes[activeMonth] || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };
}

function openProfileModal() {
  document.getElementById('profileModal').classList.remove('hidden');
  const labelMesModal = document.getElementById('labelModalMetasMes');
  if (labelMesModal) labelMesModal.innerText = `Definir Metas (${activeMonth})`;
  carregarMembrosDoGrupo();
  carregarDadosMetasNoConfig();
  calcularConversaoMetas('fixos');
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.add('hidden');
}

function mudarModoMetas(modo) {
  modoMetasAtual = modo;
  const btnPerc = document.getElementById('btnModoPerc');
  const btnDinheiro = document.getElementById('btnModoDinheiro');
  
  if (modo === 'perc') {
    btnPerc.className = "px-3 py-1 text-[10px] font-bold rounded-md bg-blue-600 text-white transition";
    btnDinheiro.className = "px-3 py-1 text-[10px] font-bold rounded-md text-slate-600 dark:text-slate-300 transition";
  } else {
    btnDinheiro.className = "px-3 py-1 text-[10px] font-bold rounded-md bg-blue-600 text-white transition";
    btnPerc.className = "px-3 py-1 text-[10px] font-bold rounded-md text-slate-600 dark:text-slate-300 transition";
  }
  carregarDadosMetasNoConfig();
  calcularConversaoMetas('fixos');
}

function carregarDadosMetasNoConfig() {
  const metas = getMetasAtuais();
  const currentTx = transactions.filter(t => t.month === activeMonth && t.confirmado);
  const income = currentTx.filter(t => (t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra')).reduce((s, t) => s + t.amount, 0);
  const baseEntradas = income > 0 ? income : 1;

  ['Fixos', 'Gerais', 'Lazer', 'Invest'].forEach(catKey => {
    const keyLower = catKey.toLowerCase();
    const pct = metas[keyLower] || 0;
    const valorDinheiro = baseEntradas * (pct / 100);

    const labelEl = document.getElementById(`labelUnidade${catKey}`);
    if (labelEl) labelEl.innerText = modoMetasAtual === 'perc' ? '%' : 'R$';
    
    const inputEl = document.getElementById(`cfgMeta${catKey}`);
    const subEl = document.getElementById(`subMeta${catKey}`);

    if (inputEl && subEl) {
      if (modoMetasAtual === 'perc') {
        inputEl.value = pct > 0 ? pct.toFixed(1) : '';
        subEl.innerText = `= R$ ${valorDinheiro.toFixed(2)}`;
      } else {
        inputEl.value = valorDinheiro > 0 ? valorDinheiro.toFixed(2) : '';
        subEl.innerText = `= ${pct.toFixed(1)}%`;
      }
    }
  });

  const errEl = document.getElementById('metaConfigErrorMsg');
  if (errEl) errEl.classList.add('hidden');
}

function calcularConversaoMetas(catKey) {
  const currentTx = transactions.filter(t => t.month === activeMonth && t.confirmado);
  const income = currentTx.filter(t => (t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra')).reduce((s, t) => s + t.amount, 0);
  const baseEntradas = income > 0 ? income : 1;

  const inputEl = document.getElementById(`cfgMeta${catKey.charAt(0).toUpperCase() + catKey.slice(1)}`);
  const subEl = document.getElementById(`subMeta${catKey.charAt(0).toUpperCase() + catKey.slice(1)}`);
  if (!inputEl || !subEl) return;

  const val = parseFloat(inputEl.value) || 0;

  if (modoMetasAtual === 'perc') {
    const emDinheiro = baseEntradas * (val / 100);
    subEl.innerText = `= R$ ${emDinheiro.toFixed(2)}`;
  } else {
    const emPerc = (val / baseEntradas) * 100;
    subEl.innerText = `= ${emPerc.toFixed(1)}%`;
  }

  const fixosVal = parseFloat(document.getElementById('cfgMetaFixos')?.value) || 0;
  const geraisVal = parseFloat(document.getElementById('cfgMetaGerais')?.value) || 0;
  const lazerVal = parseFloat(document.getElementById('cfgMetaLazer')?.value) || 0;
  const investVal = parseFloat(document.getElementById('cfgMetaInvest')?.value) || 0;

  const spanRestante = document.getElementById('metaTotalRestante');
  if (spanRestante) {
    if (modoMetasAtual === 'perc') {
      const somaPerc = fixosVal + geraisVal + lazerVal + investVal;
      const diferencaPerc = 100 - somaPerc;
      
      if (Math.abs(diferencaPerc) < 0.01) {
        spanRestante.innerHTML = `<span class="text-emerald-600 font-extrabold">✓ Total: 100%</span>`;
      } else if (diferencaPerc > 0) {
        spanRestante.innerHTML = `<span class="text-amber-600 font-bold">Faltam ${diferencaPerc.toFixed(1)}%</span>`;
      } else {
        spanRestante.innerHTML = `<span class="text-rose-600 font-bold">Passou ${Math.abs(diferencaPerc).toFixed(1)}%</span>`;
      }
    } else {
      const somaDinheiro = fixosVal + geraisVal + lazerVal + investVal;
      const diferencaDinheiro = baseEntradas - somaDinheiro;

      if (Math.abs(diferencaDinheiro) < 0.01) {
        spanRestante.innerHTML = `<span class="text-emerald-600 font-extrabold">✓ Total: R$ ${baseEntradas.toFixed(2)}</span>`;
      } else if (diferencaDinheiro > 0) {
        spanRestante.innerHTML = `<span class="text-amber-600 font-bold">Faltam R$ ${diferencaDinheiro.toFixed(2)}</span>`;
      } else {
        spanRestante.innerHTML = `<span class="text-rose-600 font-bold">Passou R$ ${Math.abs(diferencaDinheiro).toFixed(2)}</span>`;
      }
    }
  }
}

async function salvarMetasGrupoConfig(e) {
  e.preventDefault();
  const currentTx = transactions.filter(t => t.month === activeMonth && t.confirmado);
  const income = currentTx.filter(t => (t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra')).reduce((s, t) => s + t.amount, 0);
  const baseEntradas = income > 0 ? income : 1;

  let fixosInput = document.getElementById('cfgMetaFixos').value;
  let geraisInput = document.getElementById('cfgMetaGerais').value;
  let lazerInput = document.getElementById('cfgMetaLazer').value;
  let investInput = document.getElementById('cfgMetaInvest').value;

  const errorDiv = document.getElementById('metaConfigErrorMsg');

  if (fixosInput === '' || geraisInput === '' || lazerInput === '' || investInput === '') {
    errorDiv.innerText = "Preencha obrigatoriamente todos os 4 campos de metas.";
    errorDiv.classList.remove('hidden');
    return;
  }

  let fixos = parseFloat(fixosInput);
  let gerais = parseFloat(geraisInput);
  let lazer = parseFloat(lazerInput);
  let invest = parseFloat(investInput);

  let somaCalculada = 0;
  if (modoMetasAtual === 'dinheiro') {
    const somaDinheiro = fixos + gerais + lazer + invest;
    somaCalculada = Math.round((somaDinheiro / baseEntradas) * 10000) / 100;
    fixos = (fixos / baseEntradas) * 100;
    gerais = (gerais / baseEntradas) * 100;
    lazer = (lazer / baseEntradas) * 100;
    invest = (invest / baseEntradas) * 100;
  } else {
    somaCalculada = Math.round((fixos + gerais + lazer + invest) * 100) / 100;
  }

  if (Math.abs(somaCalculada - 100) > 0.1) {
    errorDiv.innerText = `A soma total das metas deve ser exatamente 100%. Atualmente está em ${somaCalculada.toFixed(1)}%.`;
    errorDiv.classList.remove('hidden');
    return;
  }

  errorDiv.classList.add('hidden');

  try {
    const novasMetasMes = { fixos, gerais, lazer, invest };
    if (!currentWorkspace.metasPorMes) currentWorkspace.metasPorMes = {};
    currentWorkspace.metasPorMes[activeMonth] = novasMetasMes;

    await db.collection('workspaces').doc(currentWorkspace.id).set({
      metasPorMes: currentWorkspace.metasPorMes
    }, { merge: true });

    closeProfileModal();
    renderAll();
    alert(`Metas de ${activeMonth} atualizadas com sucesso!`);
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar metas.");
  }
}

async function deixarGrupo() {
  try {
    const wsIdAtual = currentWorkspace.id;
    const uidAtual = currentUser.id;

    const membrosSnapshot = await db.collection('users').where('workspaceId', '==', wsIdAtual).get();
    const éOUltimo = membrosSnapshot.size <= 1;

    if (éOUltimo) {
      const confirmacao = confirm("Atenção: Você é o último utilizador deste grupo. Se sair, todos os dados financeiros serão apagados permanentemente. Deseja continuar?");
      if (!confirmacao) return;
    } else {
      const confirmacao = confirm("Tem certeza que deseja sair deste grupo?");
      if (!confirmacao) return;
    }

    await db.collection('users').doc(uidAtual).update({
      workspaceId: firebase.firestore.FieldValue.delete(),
      workspaceCode: firebase.firestore.FieldValue.delete()
    });

    if (éOUltimo) {
      const batch = db.batch();
      const txsQuery = await db.collection('transacoes').where('workspaceId', '==', wsIdAtual).get();
      txsQuery.forEach(doc => batch.delete(doc.ref));

      const wsRef = db.collection('workspaces').doc(wsIdAtual);
      batch.delete(wsRef);

      await batch.commit();
    }

    alert("Você saiu do grupo com sucesso.");
    window.location.reload();
  } catch (err) {
    console.error(err);
    alert("Erro ao tentar deixar o grupo. Tente novamente.");
  }
}

async function criarNovoWorkspace() {
  try {
    mostrarSetupMsg("A gerar novo grupo...", "info");
    let novoCodigo = '';
    let codigoExiste = true;
    let tentativas = 0;

    while (codigoExiste && tentativas < 10) {
      novoCodigo = Math.floor(1000 + Math.random() * 9000).toString();
      const checkQuery = await db.collection('workspaces').where('code', '==', novoCodigo).get();
      if (checkQuery.empty) {
        codigoExiste = false;
      }
      tentativas++;
    }

    const workspaceId = 'ws_' + currentUser.id;
    const metasPadrao = { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

    await db.collection('workspaces').doc(workspaceId).set({
      code: novoCodigo,
      metasPorMes: { [activeMonth]: metasPadrao },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('users').doc(currentUser.id).set({
      workspaceId: workspaceId,
      workspaceCode: novoCodigo,
      email: currentUser.email,
      status: 'approved'
    }, { merge: true });

    currentWorkspace.id = workspaceId;
    currentWorkspace.code = novoCodigo;
    currentWorkspace.metasPorMes = { [activeMonth]: metasPadrao };

    document.getElementById('setupWorkspaceModal').classList.add('hidden');
    initUserSession();
  } catch (err) {
    console.error("Erro detalhado ao criar grupo:", err);
    mostrarSetupMsg("Erro: " + (err.message || "Tente novamente."), "erro");
  }
}

async function entrarGrupoExistente() {
  const codigoInput = document.getElementById('inputWorkspaceCode').value.trim();
  if (!codigoInput || codigoInput.length < 4) {
    mostrarSetupMsg("Digite um código válido de 4 dígitos.", "erro");
    return;
  }

  try {
    mostrarSetupMsg("A procurar grupo...", "info");
    const wsQuery = await db.collection('workspaces').where('code', '==', codigoInput).get();

    if (wsQuery.empty) {
      mostrarSetupMsg("Código de grupo não encontrado. Verifique com o seu familiar/sócio.", "erro");
      return;
    }

    const wsDoc = wsQuery.docs[0];
    const targetWorkspaceId = wsDoc.id;
    const wsData = wsDoc.data();
    const metasPorMesGrupo = wsData.metasPorMes || {};

    await db.collection('users').doc(currentUser.id).set({
      workspaceId: targetWorkspaceId,
      workspaceCode: codigoInput,
      email: currentUser.email,
      status: 'approved'
    }, { merge: true });

    currentWorkspace.id = targetWorkspaceId;
    currentWorkspace.code = codigoInput;
    currentWorkspace.metasPorMes = metasPorMesGrupo;

    document.getElementById('setupWorkspaceModal').classList.add('hidden');
    initUserSession();
  } catch (err) {
    console.error("Erro detalhado ao entrar no grupo:", err);
    mostrarSetupMsg("Erro: " + (err.message || "Tente novamente."), "erro");
  }
}

function mostrarSetupMsg(texto, tipo) {
  const div = document.getElementById('setupMsg');
  div.className = `text-xs font-semibold text-center p-2 rounded-xl block mt-2 ${
    tipo === 'erro' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
  }`;
  div.innerText = texto;
  div.classList.remove('hidden');
}

function changeActiveMonthCombo() {
  const mesSelect = document.getElementById('selectMonth').value;
  const anoSelect = document.getElementById('selectYear').value;
  activeMonth = `${mesSelect} ${anoSelect}`;
  renderAll();
  renderCarteiraLivre(); 
}

function initUserSession() {
  const partesAtivas = activeMonth.split(' ');
  if (partesAtivas.length === 2) {
    const mEl = document.getElementById('selectMonth');
    const yEl = document.getElementById('selectYear');
    if (mEl) mEl.value = partesAtivas[0];
    if (yEl) yEl.value = partesAtivas[1];
  }

  document.getElementById('headerUserName').innerText = currentUser.name;
  document.getElementById('headerWelcomeMsg').innerText = `Grupo: ${currentWorkspace.code}`;
  document.getElementById('profileWorkspaceCodeDisplay').innerText = currentWorkspace.code;

  renderSubCatCheckboxes();
  renderAll();
  carregarDadosDoBanco();
  ouvinteWorkspaceWorkspace();
  carregarMembrosDoGrupo();
  ouvinteCarteiraLivre();
}

function toggleFiltroAvancado() {
  const caixa = document.getElementById('containerFiltroAvancado');
  if (caixa) {
    caixa.classList.toggle('hidden');
  }
}

function renderSubCatCheckboxes() {
  const container = document.getElementById('filterSubCatCheckboxes');
  if (!container) return;
  container.innerHTML = '';
  subcategoriasDisponiveis.forEach(sub => {
    container.innerHTML += `
      <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
        <input type="checkbox" value="${sub}" onchange="renderTransactionsList(transactions)" class="subcat-filter-checkbox rounded text-blue-600 focus:ring-0 w-3.5 h-3.5" />
        <span class="truncate">${sub}</span>
      </label>
    `;
  });
}

function ouvinteWorkspaceWorkspace() {
  if (!currentWorkspace.id) return;
  db.collection('workspaces').doc(currentWorkspace.id)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data.metasPorMes) {
          currentWorkspace.metasPorMes = data.metasPorMes;
          renderAll();
        }
      }
    });
}

async function carregarMembrosDoGrupo() {
  const containerMembros = document.getElementById('workspaceMembersList');
  const selectFiltroMembro = document.getElementById('filterMember');
  if (!containerMembros || !currentWorkspace.id) return;

  try {
    const membrosSnapshot = await db.collection('users').where('workspaceId', '==', currentWorkspace.id).get();
    containerMembros.innerHTML = '';
    if (selectFiltroMembro) {
      selectFiltroMembro.innerHTML = `<option value="">👤 Todos Membros</option>`;
    }

    if (membrosSnapshot.empty) {
      containerMembros.innerHTML = `<div class="text-slate-400 text-center py-2 text-xs font-bold">Nenhum membro encontrado.</div>`;
      return;
    }

    membrosSnapshot.forEach(doc => {
      const dadosMembro = doc.data();
      const emailMembro = dadosMembro.email || 'Utilizador';
      const nomeMembro = emailMembro.split('@')[0];
      const ehVoce = emailMembro === currentUser.email ? ' (Você)' : '';

      containerMembros.innerHTML += `
        <div class="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <span class="font-extrabold text-slate-700 dark:text-slate-200 truncate text-xs"><i class="fa-solid fa-user-circle text-blue-500 text-sm mr-2"></i>${emailMembro}${ehVoce}</span>
          <span class="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 px-2 py-1 rounded-md font-extrabold">Ativo</span>
        </div>
      `;

      if (selectFiltroMembro) {
        selectFiltroMembro.innerHTML += `<option value="${emailMembro}">${nomeMembro}</option>`;
      }
    });
  } catch (err) {
    console.log("Erro carregar membros", err);
  }
}

function carregarDadosDoBanco() {
  if (!currentWorkspace.id) return;
  db.collection('transacoes')
    .where('workspaceId', '==', currentWorkspace.id)
    .onSnapshot((snapshot) => {
      transactions = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        transactions.push({ id: doc.id, ...data });
      });
      renderAll();
    });
}

function openNewTxModal() { 
  editingTxId = null;
  const modalTitle = document.getElementById('modalTxTitle');
  if (modalTitle) modalTitle.innerText = "Novo Lançamento";

  const txDate = document.getElementById('txDate');
  if (txDate) txDate.value = new Date().toISOString().split('T')[0];

  document.getElementById('txDesc').value = '';
  document.getElementById('txAmount').value = '';
  
  const subCatEl = document.getElementById('txSubCat');
  if (subCatEl) subCatEl.value = 'Transporte';

  selecionarTipoTx('EXPENSE'); 
  document.getElementById('newTxModal').classList.remove('hidden'); 
}

function openEditTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  editingTxId = id;
  const modalTitle = document.getElementById('modalTxTitle');
  if (modalTitle) modalTitle.innerText = "Editar Lançamento";

  document.getElementById('txDesc').value = tx.desc;
  document.getElementById('txAmount').value = tx.amount;
  document.getElementById('txDate').value = tx.date || '';
  
  const subCatEl = document.getElementById('txSubCat');
  if (subCatEl) subCatEl.value = tx.subCat || 'Transporte';

  const isIncome = tx.type === 'INCOME' || tx.cat === 'Salário' || tx.cat === 'Renda Extra';
  selecionarTipoTx(isIncome ? 'INCOME' : 'EXPENSE');

  const paymentMethodEl = document.getElementById('txPaymentMethod');
  if (paymentMethodEl) paymentMethodEl.value = tx.paymentMethod || 'PIX';

  const tipoCartaoEl = document.getElementById('txTipoCartao');
  if (
