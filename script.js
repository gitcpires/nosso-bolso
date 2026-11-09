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
    alert(`Metas de ${activeMonth} atualizadas para todo o grupo com sucesso!`);
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
      const confirmacao = confirm("Atenção: Você é o último utilizador deste grupo. Se sair, todos os dados financeiros e recados serão apagados permanentemente. Deseja continuar?");
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
  if (tipoCartaoEl) tipoCartaoEl.value = tx.tipoCartao || 'AVista';
  
  toggleParcelasUI();

  setTimeout(() => {
    document.getElementById('txCat').value = tx.cat;
  }, 50);

  document.getElementById('newTxModal').classList.remove('hidden');
}

function closeNewTxModal() { 
  document.getElementById('newTxModal').classList.add('hidden'); 
  editingTxId = null;
}

function toggleParcelasUI() {
  const paymentMethod = document.getElementById('txPaymentMethod').value;
  const container = document.getElementById('containerParcelas');
  if (paymentMethod === 'Cartão de Crédito') {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
    document.getElementById('txTipoCartao').value = 'AVista';
    toggleNumeroParcelas();
  }
}

function toggleNumeroParcelas() {
  const tipo = document.getElementById('txTipoCartao').value;
  const containerNum = document.getElementById('containerNumParcelas');
  if (tipo === 'Parcelado') {
    containerNum.classList.remove('hidden');
  } else {
    containerNum.classList.add('hidden');
  }
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  const radioChecked = document.querySelector('input[name="txType"]:checked');
  const type = radioChecked ? radioChecked.value : 'EXPENSE';
  const descOriginal = document.getElementById('txDesc').value.trim();
  const amountTotal = parseFloat(document.getElementById('txAmount').value);
  const dateStr = document.getElementById('txDate').value; 
  const cat = document.getElementById('txCat').value;
  
  const subCat = type === 'INCOME' ? '' : (document.getElementById('txSubCat')?.value || 'Outros');
  const paymentMethod = document.getElementById('txPaymentMethod').value;

  const tipoCartao = paymentMethod === 'Cartão de Crédito' ? document.getElementById('txTipoCartao').value : 'AVista';
  let qtdParcelas = 1;
  if (paymentMethod === 'Cartão de Crédito' && tipoCartao === 'Parcelado') {
    qtdParcelas = parseInt(document.getElementById('txQtdParcelas').value, 10) || 1;
    if (qtdParcelas < 1) qtdParcelas = 1;
  }

  const partesData = dateStr.split('-');
  let anoBase = parseInt(partesData[0], 10);
  let mesIndexBase = parseInt(partesData[1], 10) - 1;
  const diaOriginal = partesData[2] || '01';

  try {
    const batch = db.batch();

    if (editingTxId) {
      const txData = {
        desc: descOriginal,
        amount: amountTotal,
        type, cat, subCat, paymentMethod, tipoCartao,
        month: `${mesesNomes[mesIndexBase]} ${anoBase}`,
        date: dateStr,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('transacoes').doc(editingTxId).update(txData);
    } else {
      const parcelaGroupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      for (let i = 0; i < qtdParcelas; i++) {
        let mesCalculadoIndex = mesIndexBase + i;
        let anoCalculado = anoBase + Math.floor(mesCalculadoIndex / 12);
        mesCalculadoIndex = mesCalculadoIndex % 12;

        const mesNomeCalculado = mesesNomes[mesCalculadoIndex];
        const mesStringFinal = `${mesNomeCalculado} ${anoCalculado}`;

        const mesNumStr = String(mesCalculadoIndex + 1).padStart(2, '0');
        const dataParcelaStr = `${anoCalculado}-${mesNumStr}-${diaOriginal}`;

        const valorParcela = Math.round((amountTotal / qtdParcelas) * 100) / 100;
        const descFinal = qtdParcelas > 1 ? `${descOriginal} (${i + 1}/${qtdParcelas})` : descOriginal;

        const novoDocRef = db.collection('transacoes').doc();
        const txData = {
          desc: descFinal,
          amount: valorParcela,
          type, 
          cat, 
          subCat,
          paymentMethod,
          tipoCartao,
          month: mesStringFinal,
          date: dataParcelaStr,
          confirmado: false,
          parcelaGroupId: qtdParcelas > 1 ? parcelaGroupId : null,
          userId: currentUser.id,
          userEmail: currentUser.email,
          workspaceId: currentWorkspace.id,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        batch.set(novoDocRef, txData);
      }
      await batch.commit();
    }

    closeNewTxModal();
    document.getElementById('txForm').reset();
    toggleParcelasUI();
    editingTxId = null;

    alert(qtdParcelas > 1 ? `Compra parcelada em ${qtdParcelas}x gerada com sucesso nos respetivos meses!` : "Lançamento guardado com sucesso!");

  } catch (err) {
    console.error("Erro ao salvar transação:", err);
    alert("Erro ao guardar o lançamento. Tente novamente.");
  }
}

async function toggleConfirmTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  const novoStatus = !tx.confirmado;
  try {
    await db.collection('transacoes').doc(id).update({
      confirmado: novoStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    alert("Erro ao alterar o estado de confirmação.");
  }
}

async function deleteTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) {
    if (confirm("Deseja remover este lançamento?")) {
      await db.collection('transacoes').doc(id).delete();
    }
    return;
  }

  if (tx.parcelaGroupId && tx.parcelaGroupId.trim() !== '') {
    const escolha = confirm(
      "Esta é uma compra parcelada!\n\n" +
      "• Clique em [OK] para apagar TODAS as parcelas desta compra em todos os meses.\n" +
      "• Clique em [Cancelar] se deseja apagar APENAS esta parcela do mês atual."
    );

    if (escolha) {
      try {
        const batch = db.batch();
        const parcelasQuery = await db.collection('transacoes').where('workspaceId', '==', currentWorkspace.id).where('parcelaGroupId', '==', tx.parcelaGroupId).get();
        
        parcelasQuery.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        return;
      } catch (err) {
        console.error("Erro ao apagar parcelas em lote:", err);
        alert("Erro ao tentar remover o lote de parcelas.");
        return;
      }
    } else {
      try {
        await db.collection('transacoes').doc(id).delete();
        return;
      } catch (err) {
        console.error("Erro ao apagar parcela individual:", err);
        alert("Erro ao tentar remover o lançamento.");
        return;
      }
    }
  }

  if (confirm("Deseja remover este lançamento?")) {
    try {
      await db.collection('transacoes').doc(id).delete();
    } catch (err) {
      console.error("Erro ao apagar transação:", err);
      alert("Erro ao tentar remover o lançamento.");
    }
  }
}

function selecionarTipoTx(tipo) {
  const radio = document.querySelector(`input[name="txType"][value="${tipo}"]`);
  if (radio) {
    radio.checked = true;
    toggleTxTypeUI();
  }
}

function toggleTxTypeUI() {
  const radioEntrada = document.querySelector('input[name="txType"][value="INCOME"]');
  const labelEntrada = document.getElementById('labelTabEntrada');
  const labelSaida = document.getElementById('labelTabSaida');
  const selectCat = document.getElementById('txCat');
  const containerSubCat = document.getElementById('containerSubCat');
  const selectPayment = document.getElementById('txPaymentMethod');

  if (!selectCat || !selectPayment) return;

  if (radioEntrada && radioEntrada.checked) {
    if (labelEntrada) labelEntrada.className = "w-1/2 text-center py-3 text-xs font-extrabold rounded-[1.2rem] cursor-pointer bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm transition";
    if (labelSaida) labelSaida.className = "w-1/2 text-center py-3 text-xs font-extrabold rounded-[1.2rem] cursor-pointer text-slate-500 dark:text-slate-400 transition";
    
    if (containerSubCat) containerSubCat.classList.add('hidden');

    selectPayment.innerHTML = `
      <option value="PIX">⚡ PIX</option>
      <option value="Transferência">🏦 Transferência</option>
      <option value="Outros">🔄 Outros</option>
    `;

    selectCat.innerHTML = `
      <option value="Salário">💰 Salário</option>
      <option value="Renda Extra">💵 Renda Extra</option>
    `;
  } else {
    if (labelSaida) labelSaida.className = "w-1/2 text-center py-3 text-xs font-extrabold rounded-[1.2rem] cursor-pointer bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm transition";
    if (labelEntrada) labelEntrada.className = "w-1/2 text-center py-3 text-xs font-extrabold rounded-[1.2rem] cursor-pointer text-slate-500 dark:text-slate-400 transition";
    
    if (containerSubCat) containerSubCat.classList.remove('hidden');

    selectPayment.innerHTML = `
      <option value="PIX">⚡ PIX</option>
      <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
      <option value="Outros">🔄 Outros</option>
    `;

    selectCat.innerHTML = `
      <option value="Gastos Fixos">🏠 Gastos Fixos</option>
      <option value="Gastos Gerais">🛒 Gastos Gerais</option>
      <option value="Lazer">🎉 Lazer</option>
      <option value="Investimentos">📈 Investimentos</option>
    `;
  }
  toggleParcelasUI();
}

async function importarGastosFixosMesAnterior() {
  const [nomeMesAtual, anoAtualStr] = activeMonth.split(' ');
  const indexMesAtual = mesesNomes.indexOf(nomeMesAtual);
  
  let indexMesAnterior = indexMesAtual - 1;
  let anoAnterior = parseInt(anoAtualStr, 10);
  
  if (indexMesAnterior < 0) {
    indexMesAnterior = 11;
    anoAnterior -= 1;
  }
  const mesAnteriorStr = `${mesesNomes[indexMesAnterior]} ${anoAnterior}`;

  const jaExistemNoAtual = transactions.some(t => t.month === activeMonth && t.cat === 'Gastos Fixos');
  if (jaExistemNoAtual) {
    alert(`⚠️ Os gastos fixos deste mês (${activeMonth}) já foram importados anteriormente.`);
    return;
  }

  const gastosFixosAnteriores = transactions.filter(t => t.month === mesAnteriorStr && t.cat === 'Gastos Fixos');

  if (gastosFixosAnteriores.length === 0) {
    alert(`Nenhum gasto fixo encontrado no mês anterior (${mesAnteriorStr}) para importar.`);
    return;
  }

  const confirmacao = confirm(`Deseja importar ${gastosFixosAnteriores.length} gasto(s) fixo(s) de ${mesAnteriorStr} para ${activeMonth}? Eles entrarão como pendentes.`);
  if (!confirmacao) return;

  try {
    const batch = db.batch();

    gastosFixosAnteriores.forEach(txAntiga => {
      const novoDocRef = db.collection('transacoes').doc();
      
      let novaDataStr = txAntiga.date;
      if (novaDataStr && novaDataStr.length === 10) {
        const partesDia = novaDataStr.split('-');
        const diaOriginal = partesDia[2];
        const novoMesNum = String(indexMesAtual + 1).padStart(2, '0');
        novaDataStr = `${anoAtualStr}-${novoMesNum}-${diaOriginal}`;
      } else {
        novaDataStr = new Date().toISOString().split('T')[0];
      }

      const novaTx = {
        desc: txAntiga.desc,
        amount: txAntiga.amount,
        type: txAntiga.type || 'EXPENSE',
        cat: 'Gastos Fixos',
        subCat: txAntiga.subCat || 'Outros',
        paymentMethod: txAntiga.paymentMethod || 'PIX',
        month: activeMonth,
        date: novaDataStr,
        confirmado: false,
        userId: currentUser.id,
        userEmail: currentUser.email,
        workspaceId: currentWorkspace.id,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      batch.set(novoDocRef, novaTx);
    });

    await batch.commit();
    alert(`Gastos fixos importados com sucesso para ${activeMonth}!`);
    
  } catch (err) {
    console.error("Erro ao importar gastos fixos:", err);
    alert("Erro ao tentar importar os gastos fixos. Tente novamente.");
  }
}

function renderAll() {
  const currentTxConfirmadas = transactions.filter(t => t.month === activeMonth && t.confirmado);

  const income = currentTxConfirmadas.filter(t => t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra').reduce((s, t) => s + t.amount, 0);
  const expense = currentTxConfirmadas.filter(t => t.type === 'EXPENSE' && t.cat !== 'Salário' && t.cat !== 'Renda Extra').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const statIncome = document.getElementById('statIncome');
  const statExpense = document.getElementById('statExpense');
  const statBalance = document.getElementById('statBalance');

  if (statIncome) statIncome.innerText = `R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (statExpense) statExpense.innerText = `R$ ${expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (statBalance) statBalance.innerText = `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const fixed = currentTxConfirmadas.filter(t => t.cat === 'Gastos Fixos').reduce((a, b) => a + b.amount, 0);
  const general = currentTxConfirmadas.filter(t => t.cat === 'Gastos Gerais').reduce((a, b) => a + b.amount, 0);
  const leisure = currentTxConfirmadas.filter(t => t.cat === 'Lazer').reduce((a, b) => a + b.amount, 0);
  const invest = currentTxConfirmadas.filter(t => t.cat === 'Investimentos').reduce((a, b) => a + b.amount, 0);

  const metas = getMetasAtuais();
  const baseEntradas = income > 0 ? income : 1; 

  const criarCardMetaSoftUI = (titulo, icone, corTexto, corBarra, gasto, pctMeta) => {
    const metaEmReais = baseEntradas * (pctMeta / 100);
    const pctGasto = metaEmReais > 0 ? (gasto / metaEmReais) * 100 : 0;
    const barraPreenchida = Math.min(pctGasto, 100);
    
    return `
      <div class="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 flex flex-col justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <i class="fa-solid ${icone} ${corTexto} text-base"></i>
            <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">${titulo}</span>
          </div>
          <div class="text-sm font-black text-slate-900 dark:text-white">R$ ${gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <div class="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-1 mb-3">Meta: R$ ${metaEmReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="flex items-center gap-2 mt-auto">
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300" style="width: ${barraPreenchida}%; background-color: ${corBarra};"></div>
          </div>
          <span class="text-[10px] font-black text-slate-700 dark:text-slate-300">${pctGasto.toFixed(1)}%</span>
        </div>
      </div>
    `;
  };

  const containerCat = document.getElementById('cardsCategoryContainer');
  if (containerCat) {
    containerCat.innerHTML = `
      ${criarCardMetaSoftUI('Gastos Fixos', 'fa-bullseye', 'text-blue-600', '#2563eb', fixed, metas.fixos)}
      ${criarCardMetaSoftUI('Gastos Gerais', 'fa-star', 'text-amber-500', '#10b981', general, metas.gerais)}
      ${criarCardMetaSoftUI('Lazer', 'fa-cart-shopping', 'text-purple-500', '#a855f7', leisure, metas.lazer)}
      ${criarCardMetaSoftUI('Investimentos', 'fa-chart-column', 'text-amber-500', '#f59e0b', invest, metas.invest)}
    `;
  }

  const currentTxMes = transactions.filter(t => t.month === activeMonth);
  renderTransactionsList(currentTxMes);
  renderInvestments(currentTxMes);
  
  const tabGraficos = document.getElementById('tab-graficos');
  if (tabGraficos && !tabGraficos.classList.contains('hidden')) {
    renderCharts(fixed, general, leisure, invest);
    renderSubCategoryChart(currentTxMes);
    renderPaymentMethodChart(currentTxMes);
  }
}

function renderCharts(fixed, general, leisure, invest) {
  const ctxPie = document.getElementById('categoryPieChart');
  if (ctxPie) {
    if (categoryPieChartInstance) categoryPieChartInstance.destroy();
    categoryPieChartInstance = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: ['Fixos', 'Gerais', 'Lazer', 'Invest'],
        datasets: [{
          data: [fixed, general, leisure, invest],
          backgroundColor: ['#2563eb', '#10b981', '#a855f7', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        events: [], 
        plugins: { 
          legend: { 
            position: 'right', 
            onClick: null, 
            labels: { boxWidth: 10, font: { size: 10, family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' }, padding: 12, usePointStyle: true, pointStyle: 'circle' } 
          },
          tooltip: { enabled: false } 
        }
      }
    });
  }

  const ctxBar = document.getElementById('categoryBarChart');
  if (ctxBar) {
    if (categoryBarChartInstance) categoryBarChartInstance.destroy();
    categoryBarChartInstance = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: ['Fixos', 'Gerais', 'Lazer', 'Invest'],
        datasets: [{
          data: [fixed, general, leisure, invest],
          backgroundColor: ['#2563eb', '#10b981', '#a855f7', '#f59e0b'],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        events: [], 
        plugins: { 
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          y: { display: false, beginAtZero: true },
          x: { grid: { display: false }, border: {display: false}, ticks: { font: { size: 9, weight: 'bold' } } }
        }
      }
    });
  }
}

function renderSubCategoryChart(currentTx) {
  const ctxSubBar = document.getElementById('subCategoryBarChart');
  if (!ctxSubBar) return;

  const despesasComSubCat = currentTx.filter(t => t.type === 'EXPENSE' && t.confirmado && subcategoriasDisponiveis.includes(t.subCat));

  const totaisPorSubCat = {};
  subcategoriasDisponiveis.forEach(sub => {
    totaisPorSubCat[sub] = 0;
  });

  despesasComSubCat.forEach(t => {
    if (totaisPorSubCat[t.subCat] !== undefined) {
      totaisPorSubCat[t.subCat] += t.amount;
    }
  });

  const labels = Object.keys(totaisPorSubCat);
  const dados = Object.values(totaisPorSubCat);

  if (subCategoryBarChartInstance) subCategoryBarChartInstance.destroy();

  subCategoryBarChartInstance = new Chart(ctxSubBar, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Gasto (R$)',
        data: dados,
        backgroundColor: '#2563eb',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      events: [], 
      plugins: { 
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: { display: false, beginAtZero: true },
        y: { grid: { display: false }, border: {display: false}, ticks: { font: { size: 10, weight: 'bold' } } }
      }
    }
  });
}

function renderPaymentMethodChart(currentTx) {
  const ctxPaymentBar = document.getElementById('paymentMethodBarChart');
  if (!ctxPaymentBar) return;

  const despesasMes = currentTx.filter(t => t.type === 'EXPENSE' && t.confirmado);

  let totalPix = 0;
  let totalCartao = 0;
  let totalOutros = 0;

  despesasMes.forEach(t => {
    const metodo = (t.paymentMethod || '').trim();
    if (metodo === 'PIX') {
      totalPix += t.amount;
    } else if (metodo === 'Cartão de Crédito') {
      totalCartao += t.amount;
    } else {
      totalOutros += t.amount;
    }
  });

  if (paymentMethodBarChartInstance) paymentMethodBarChartInstance.destroy();

  paymentMethodBarChartInstance = new Chart(ctxPaymentBar, {
    type: 'bar',
    data: {
      labels: ['PIX', 'Cartão de Crédito', 'Outros'],
      datasets: [{
        label: 'Gasto (R$)',
        data: [totalPix, totalCartao, totalOutros],
        backgroundColor: ['#0ea5e9', '#6366f1', '#64748b'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      events: [], 
      plugins: { 
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: { grid: { display: false }, border: {display: false}, ticks: { font: { size: 10, weight: 'bold' } } },
        y: { display: false, beginAtZero: true }
      }
    }
  });
}

function renderTransactionsList(currentTx) {
  const container = document.getElementById('txListContainer');
  if (!container) return;

  const transacoesDoMesAtivo = transactions.filter(t => t.month === activeMonth);

  const search = (document.getElementById('searchExpense')?.value || '').toLowerCase();
  const filtroMembro = document.getElementById('filterMember')?.value || '';
  const filtroCat = document.getElementById('filterCategory')?.value || '';
  
  const checkboxesSubCat = document.querySelectorAll('.subcat-filter-checkbox');
  const subCatsSelecionadas = Array.from(checkboxesSubCat).filter(cb => cb.checked).map(cb => cb.value);
  
  const filtroPaymentMethod = document.getElementById('filterPaymentMethod')?.value || '';

  container.innerHTML = '';
  
  const filtered = transacoesDoMesAtivo.filter(t => {
    const matchSearch = t.desc.toLowerCase().includes(search) || t.cat.toLowerCase().includes(search) || (t.subCat && t.subCat.toLowerCase().includes(search));
    const matchMembro = filtroMembro === '' || t.userEmail === filtroMembro;
    const matchCat = filtroCat === '' || t.cat === filtroCat;
    const matchSubCat = subCatsSelecionadas.length === 0 || subCatsSelecionadas.includes(t.subCat);
    const matchPayment = filtroPaymentMethod === '' || t.paymentMethod === filtroPaymentMethod;

    return matchSearch && matchMembro && matchCat && matchSubCat && matchPayment;
  });

  filtered.sort((a, b) => {
    const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
    const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return new Date(b.date) - new Date(a.date);
  });

  const filterTotalBox = document.getElementById('filterTotalBox');
  const filterTotalValue = document.getElementById('filterTotalValue');
  const isAlgumFiltroAtivo = search !== '' || filtroMembro !== '' || filtroCat !== '' || subCatsSelecionadas.length > 0 || filtroPaymentMethod !== '';
  
  if (isAlgumFiltroAtivo) {
    const somaFiltro = filtered.reduce((acc, t) => {
      const ehEntrada = t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra';
      return ehEntrada ? acc + t.amount : acc - t.amount;
    }, 0);

    if (filterTotalValue) filterTotalValue.innerText = `R$ ${somaFiltro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (filterTotalBox) filterTotalBox.classList.remove('hidden');
  } else {
    if (filterTotalBox) filterTotalBox.classList.add('hidden');
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-sm font-bold text-slate-400 bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-sm">Nenhuma movimentação encontrada neste mês.</div>`;
    return;
  }

  filtered.forEach(t => {
    const isIncome = t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra';
    const autorNome = t.userEmail ? t.userEmail.split('@')[0] : 'Membro';
    const confirmado = t.confirmado === true;
    
    const catBadge = t.cat ? `<span class="text-[9px] bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">${t.cat}</span>` : '';
    const subCatBadge = t.subCat ? `<span class="text-[9px] bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">${t.subCat}</span>` : '';
    const paymentBadge = t.paymentMethod ? `<span class="text-[9px] bg-amber-50 dark:bg-slate-800 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">${t.paymentMethod}</span>` : '';
    const userBadge = `<span class="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-semibold"><i class="fa-solid fa-user text-[8px] mr-1"></i>${autorNome}</span>`;

    container.innerHTML += `
      <div class="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-[1.5rem] shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:border dark:border-slate-800">
        <div class="space-y-1.5 pr-2 overflow-hidden w-full">
          <div class="text-sm font-extrabold text-slate-900 dark:text-white truncate">${t.desc}</div>
          
          <div class="flex flex-wrap items-center gap-1.5">
            ${catBadge}
            ${subCatBadge}
            ${paymentBadge}
            ${userBadge}
          </div>

          <div class="text-[10px] text-slate-500 flex items-center gap-2 pt-1">
            <span class="font-bold"><i class="fa-regular fa-calendar mr-1"></i>${t.date.split('-').reverse().join('/')}</span>
            <button onclick="toggleConfirmTransaction('${t.id}')" class="text-[9px] font-extrabold px-2 py-0.5 rounded-md transition ${
              confirmado 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
            }">
              ${confirmado ? '✓ Registado' : '⏳ Pendente'}
            </button>
          </div>
        </div>

        <div class="flex flex-col items-end pl-2 shrink-0">
          <span class="text-sm sm:text-base font-black whitespace-nowrap ${isIncome ? 'text-text-entrada dark:text-emerald-400' : 'text-text-saida dark:text-rose-400'}">
            ${isIncome ? '+' : '-'} R$ ${Number(t.amount).toFixed(2).replace('.', ',')}
          </span>
          <div class="flex items-center gap-3 mt-2">
            <button onclick="openEditTransaction('${t.id}')" class="text-slate-400 hover:text-blue-600 p-1 transition" title="Editar">
              <i class="fa-solid fa-pen-to-square text-sm"></i>
            </button>
            <button onclick="deleteTransaction('${t.id}')" class="text-slate-400 hover:text-rose-600 p-1 transition" title="Excluir">
              <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
}

function renderInvestments(currentTx) {
  const investConfirmadosMes = currentTx.filter(t => t.cat === 'Investimentos' && t.confirmado);
  const totalMes = investConfirmadosMes.reduce((s, t) => s + t.amount, 0);

  const monthInvestEl = document.getElementById('monthInvestTotalHeader');
  if (monthInvestEl) monthInvestEl.innerText = `R$ ${totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const anoAtualSelecionado = activeMonth.split(' ')[1] || '2026';
  const totalYearInvested = transactions
    .filter(t => t.cat === 'Investimentos' && t.type === 'EXPENSE' && t.confirmado && (t.month.includes(anoAtualSelecionado) || (t.date && t.date.startsWith(anoAtualSelecionado))))
    .reduce((sum, t) => sum + t.amount, 0);

  const yearHeader = document.getElementById('yearInvestTotalHeader');
  if (yearHeader) {
    yearHeader.innerText = `R$ ${totalYearInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }

  const investList = document.getElementById('monthInvestmentsList');
  if (!investList) return;

  const invests = currentTx.filter(t => t.cat === 'Investimentos');
  invests.sort((a, b) => {
    const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
    const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
    if (timeA !== timeB) return timeB - timeA;
    return new Date(b.date) - new Date(a.date);
  });

  if (invests.length === 0) {
    investList.innerHTML = `<div class="p-6 text-center text-sm font-bold text-slate-400 bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-sm">Nenhum aporte registrado neste mês.</div>`;
    return;
  }

  investList.innerHTML = '';
  invests.forEach(t => {
    const confirmado = t.confirmado === true;
    investList.innerHTML += `
      <div class="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-[1.5rem] shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:border dark:border-slate-800">
        <div class="space-y-1.5 pr-2 overflow-hidden w-full">
          <div class="text-sm font-extrabold text-slate-900 dark:text-white">${t.desc}</div>
          <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-1">
            <span class="font-bold"><i class="fa-regular fa-calendar mr-1"></i>${t.date.split('-').reverse().join('/')}</span>
            <button onclick="toggleConfirmTransaction('${t.id}')" class="text-[9px] font-extrabold px-2 py-0.5 rounded-md transition ${
              confirmado ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            }">
              ${confirmado ? '✓ Registado' : '⏳ Pendente'}
            </button>
          </div>
        </div>

        <div class="flex flex-col items-end pl-2 shrink-0">
          <span class="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
            R$ ${Number(t.amount).toFixed(2).replace('.', ',')}
          </span>
          <div class="flex items-center gap-3 mt-2">
            <button onclick="openEditTransaction('${t.id}')" class="text-slate-400 hover:text-blue-600 p-1 transition" title="Editar">
              <i class="fa-solid fa-pen-to-square text-sm"></i>
            </button>
            <button onclick="deleteTransaction('${t.id}')" class="text-slate-400 hover:text-rose-600 p-1 transition" title="Excluir">
              <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
}

function exportarParaExcel() {
  const currentTx = transactions.filter(t => t.month === activeMonth);
  if (currentTx.length === 0) {
    alert("Não existem lançamentos neste mês para exportar.");
    return;
  }

  let csvContent = "\uFEFFData;Descrição;Tipo;Categoria;Subcategoria;Forma Pagamento;Valor (R$);Estado;Membro\n";

  currentTx.forEach(t => {
    const tipoFormatado = (t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra') ? 'Entrada' : 'Saída';
    const valorFormatado = Number(t.amount).toFixed(2).replace('.', ',');
    const statusFormatado = t.confirmado ? 'Registado' : 'Pendente';
    const membro = t.userEmail ? t.userEmail.split('@')[0] : '';
    const descLimpa = `"${(t.desc || '').replace(/"/g, '""')}"`;
    const cat = `"${t.cat || ''}"`;
    const subCat = `"${t.subCat || ''}"`;
    const pagamento = `"${t.paymentMethod || ''}"`;

    csvContent += `${t.date};${descLimpa};${tipoFormatado};${cat};${subCat};${pagamento};${valorFormatado};${statusFormatado};${membro}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `NossoBolso_${activeMonth.replace(' ', '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function switchTab(tab) {
  ['resumo', 'extrato', 'invest', 'graficos'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`tab-${tab}`);
  if (activeEl) activeEl.classList.remove('hidden');

  if (tab === 'extrato') {
    renderTransactionsList(transactions.filter(t => t.month === activeMonth));
  }

  ['resumo', 'extrato', 'invest', 'graficos'].forEach(name => {
    const btn = document.getElementById(`bottomNav${name.charAt(0).toUpperCase() + name.slice(1)}`);
    const indicator = document.getElementById(`indicator${name.charAt(0).toUpperCase() + name.slice(1)}`);
    
    if (btn) {
      if (name === tab) {
        btn.className = 'relative flex flex-col items-center justify-center text-blue-600 transition active:scale-95';
        if (indicator) indicator.classList.remove('hidden');
      } else {
        btn.className = 'relative flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 transition active:scale-95';
        if (indicator) indicator.classList.add('hidden');
      }
    }
  });

  renderAll();
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('nossoBolsoDarkMode', isDark ? 'enabled' : 'disabled');
  atualizarIconeDarkMode(isDark);
}

function atualizarIconeDarkMode(isDark) {
  const icon = document.getElementById('darkModeIcon');
  if (icon) {
    icon.className = isDark ? 'fa-solid fa-sun text-sm text-amber-400' : 'fa-solid fa-moon text-sm text-white';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const darkModePref = localStorage.getItem('nossoBolsoDarkMode');
  if (darkModePref === 'enabled') {
    document.documentElement.classList.add('dark');
    atualizarIconeDarkMode(true);
  }
});

function copyWorkspaceCountCode() { navigator.clipboard.writeText(currentWorkspace.code).then(() => alert(`Código ${currentWorkspace.code} copiado com sucesso!`)); }
function logout() { auth.signOut().then(() => window.location.replace('index.html')); }


// ==========================================
// FUNÇÕES DA CARTEIRA LIVRE (POR MÊS)
// ==========================================

function openCarteiraLivreModal() {
  document.getElementById('carteiraLivreModal').classList.remove('hidden');
  renderCarteiraLivre();
}

function closeCarteiraLivreModal() {
  document.getElementById('carteiraLivreModal').classList.add('hidden');
  document.getElementById('containerEditSaldoLivre').classList.add('hidden');
}

function toggleEditSaldoLivre() {
  const container = document.getElementById('containerEditSaldoLivre');
  container.classList.toggle('hidden');
  if (!container.classList.contains('hidden')) {
    document.getElementById('inputNovoSaldoLivre').value = carteiraLivreSaldos[activeMonth] || 0;
  }
}

async function salvarSaldoLivre() {
  const novoValor = parseFloat(document.getElementById('inputNovoSaldoLivre').value) || 0;
  try {
    carteiraLivreSaldos[activeMonth] = novoValor;
    
    await db.collection('users').doc(currentUser.id).set({
      carteiraLivreSaldos: carteiraLivreSaldos
    }, { merge: true });
    
    toggleEditSaldoLivre();
    renderCarteiraLivre();
  } catch(err) {
    alert("Erro ao salvar saldo livre do mês. Tente novamente.");
  }
}

function ouvinteCarteiraLivre() {
  if (!currentUser.id) return;
  
  db.collection('carteira_livre')
    .where('userId', '==', currentUser.id)
    .onSnapshot(snapshot => {
      gastosLivresGlobais = [];
      snapshot.forEach(doc => {
        gastosLivresGlobais.push({ id: doc.id, ...doc.data() });
      });
      gastosLivresGlobais.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      renderCarteiraLivre();
    });
}

async function adicionarGastoLivre(e) {
  e.preventDefault();
  const desc = document.getElementById('descGastoLivre').value.trim();
  const amount = parseFloat(document.getElementById('valorGastoLivre').value);
  
  if(!desc || isNaN(amount)) return;

  try {
    await db.collection('carteira_livre').add({
      userId: currentUser.id,
      desc: desc,
      amount: amount,
      date: new Date().toISOString().split('T')[0],
      month: activeMonth, 
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('descGastoLivre').value = '';
    document.getElementById('valorGastoLivre').value = '';
  } catch (err) {
    alert("Erro ao registrar gasto na carteira livre.");
  }
}

async function deletarGastoLivre(id) {
  if(confirm("Excluir este gasto do seu histórico privado?")) {
    try {
      await db.collection('carteira_livre').doc(id).delete();
    } catch(err) {
      alert("Erro ao excluir.");
    }
  }
}

function renderCarteiraLivre() {
  const modalMesEl = document.getElementById('modalCarteiraMes');
  if(modalMesEl) modalMesEl.innerText = activeMonth;

  const saldoBaseMes = carteiraLivreSaldos[activeMonth] || 0;
  const gastosDoMes = gastosLivresGlobais.filter(g => g.month === activeMonth);
  
  const totalGastoNoMes = gastosDoMes.reduce((acc, curr) => acc + curr.amount, 0);
  const saldoAtual = saldoBaseMes - totalGastoNoMes;
  
  const displayEl = document.getElementById('displaySaldoLivre');
  if(displayEl) {
    displayEl.innerText = `R$ ${saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if(saldoAtual < 0) {
      displayEl.className = "text-2xl font-black text-rose-600 dark:text-rose-400";
    } else {
      displayEl.className = "text-2xl font-black text-emerald-700 dark:text-emerald-400";
    }
  }

  const lista = document.getElementById('listaGastosLivres');
  if(!lista) return;

  lista.innerHTML = '';
  
  if(gastosDoMes.length === 0) {
    lista.innerHTML = '<p class="text-xs font-bold text-slate-400 text-center py-5 bg-white rounded-2xl shadow-sm">Nenhum gasto livre registrado neste mês.</p>';
    return;
  }

  gastosDoMes.forEach(g => {
    const dataFormatada = g.date ? g.date.split('-').reverse().join('/') : '';
    
    lista.innerHTML += `
      <div class="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm dark:border dark:border-slate-700">
        <div class="truncate pr-2 w-full">
          <span class="text-sm font-extrabold text-slate-800 dark:text-slate-200 block truncate">${g.desc}</span>
          <span class="text-[10px] font-bold text-slate-500 mt-1 block"><i class="fa-regular fa-calendar mr-1"></i>${dataFormatada}</span>
        </div>
        <div class="flex items-center gap-3 shrink-0 pl-2">
          <span class="text-sm font-black text-rose-600 dark:text-rose-400">- R$ ${g.amount.toFixed(2).replace('.', ',')}</span>
          <button onclick="deletarGastoLivre('${g.id}')" class="text-slate-400 hover:text-rose-500 transition p-1"><i class="fa-solid fa-trash-can text-sm"></i></button>
        </div>
      </div>
    `;
  });
}
