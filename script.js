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

let currentWorkspace = { id: '', code: '', metas: { fixos: 50, gerais: 30, lazer: 10, invest: 10 } };
let currentUser = { id: '', name: '', email: '' };
let transactions = [];
const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const agora = new Date();
let activeMonth = `${mesesNomes[agora.getMonth()]} ${agora.getFullYear()}`;

let categoryPieChartInstance = null;
let categoryBarChartInstance = null;
let lousaDocId = null;
let modoMetasAtual = 'perc';
let editingTxId = null;

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

function openProfileModal() {
  document.getElementById('profileModal').classList.remove('hidden');
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
    btnPerc.className = "px-2.5 py-1 text-[10px] font-bold rounded-md bg-blue-600 text-white transition";
    btnDinheiro.className = "px-2.5 py-1 text-[10px] font-bold rounded-md text-slate-600 transition";
  } else {
    btnDinheiro.className = "px-2.5 py-1 text-[10px] font-bold rounded-md bg-blue-600 text-white transition";
    btnPerc.className = "px-2.5 py-1 text-[10px] font-bold rounded-md text-slate-600 transition";
  }
  carregarDadosMetasNoConfig();
  calcularConversaoMetas('fixos');
}

function carregarDadosMetasNoConfig() {
  const metas = currentWorkspace.metas || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };
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
    const novasMetas = { fixos, gerais, lazer, invest };
    // Salva as metas diretamente no documento do Workspace partilhado
    await db.collection('workspaces').doc(currentWorkspace.id).set({
      metas: novasMetas
    }, { merge: true });

    currentWorkspace.metas = novasMetas;
    closeProfileModal();
    renderAll();
    alert("Metas atualizadas para todo o grupo com sucesso!");
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
      const confirmacao = confirm("Atenção: Você é o último utilizador deste grupo. Se sair, todos os dados financeiros e recados do mural serão apagados permanentemente. Deseja continuar?");
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

      const lousaQuery = await db.collection('lousa').where('workspaceId', '==', wsIdAtual).get();
      lousaQuery.forEach(doc => batch.delete(doc.ref));

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

    // Cria o documento do workspace compartilhado
    await db.collection('workspaces').doc(workspaceId).set({
      code: novoCodigo,
      metas: metasPadrao,
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
    currentWorkspace.metas = metasPadrao;

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
    const metasGrupo = wsData.metas || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

    await db.collection('users').doc(currentUser.id).set({
      workspaceId: targetWorkspaceId,
      workspaceCode: codigoInput,
      email: currentUser.email,
      status: 'approved'
    }, { merge: true });

    currentWorkspace.id = targetWorkspaceId;
    currentWorkspace.code = codigoInput;
    currentWorkspace.metas = metasGrupo;

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
    tipo === 'erro' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
  }`;
  div.innerText = texto;
  div.classList.remove('hidden');
}

function initUserSession() {
  document.getElementById('selectMonth').value = activeMonth;

  document.getElementById('headerUserName').innerText = currentUser.name;
  document.getElementById('headerWelcomeMsg').innerText = `Grupo: ${currentWorkspace.code}`;
  document.getElementById('profileWorkspaceCodeDisplay').innerText = currentWorkspace.code;

  ['badgeExtrato', 'badgeInvest', 'badgeMural'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  renderAll();
  carregarDadosDoBanco();
  ouvinteWorkspaceMetas(); // Ouve atualizações de metas em tempo real
  carregarMembrosDoGrupo();
  ouvinteLousaGrupo();
}

// Ouve em tempo real qualquer alteração nas metas do workspace partilhado
function ouvinteWorkspaceMetas() {
  if (!currentWorkspace.id) return;
  db.collection('workspaces').doc(currentWorkspace.id)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data.metas) {
          currentWorkspace.metas = data.metas;
          renderAll(); // Atualiza a tela automaticamente para todos do grupo
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
      selectFiltroMembro.innerHTML = `<option value="">👤 Todos os Membros</option>`;
    }

    if (membrosSnapshot.empty) {
      containerMembros.innerHTML = `<div class="text-slate-400 text-center py-1">Nenhum membro encontrado.</div>`;
      return;
    }

    membrosSnapshot.forEach(doc => {
      const dadosMembro = doc.data();
      const emailMembro = dadosMembro.email || 'Utilizador';
      const nomeMembro = emailMembro.split('@')[0];
      const ehVoce = emailMembro === currentUser.email ? ' (Você)' : '';

      containerMembros.innerHTML += `
        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
          <span class="font-bold text-slate-700 truncate text-[11px]"><i class="fa-solid fa-user-circle text-blue-500 mr-1.5"></i>${emailMembro}${ehVoce}</span>
          <span class="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold">Ativo</span>
        </div>
      `;

      if (selectFiltroMembro) {
        selectFiltroMembro.innerHTML += `<option value="${emailMembro}">${nomeMembro}</option>`;
      }
    });
  } catch (err) {
    containerMembros.innerHTML = `<div class="text-rose-500 text-center py-1">Erro ao carregar membros.</div>`;
  }
}

function atualizarContador(input) {
  const restantes = 25 - input.value.length;
  document.getElementById('charCount').innerText = `${restantes} restantes`;
}

function ouvinteLousaGrupo() {
  if (!currentWorkspace.id) return;
  db.collection('lousa')
    .where('workspaceId', '==', currentWorkspace.id)
    .onSnapshot((snapshot) => {
      const lousaConteudo = document.getElementById('lousaConteudo');
      const lousaAutorContainer = document.getElementById('lousaAutorContainer');
      const lousaAutorNome = document.getElementById('lousaAutorNome');
      const btnLimparLousa = document.getElementById('btnLimparLousa');

      if (snapshot.empty) {
        lousaDocId = null;
        lousaConteudo.innerHTML = `<p class="text-xs text-slate-500 italic">Mural limpo. Escreva um recado!</p>`;
        lousaAutorContainer.classList.add('hidden');
        btnLimparLousa.classList.add('hidden');
        return;
      }

      const docLousa = snapshot.docs[0];
      lousaDocId = docLousa.id;
      const dados = docLousa.data();
      const autor = dados.userEmail ? dados.userEmail.split('@')[0] : 'Membro';

      lousaConteudo.innerHTML = `
        <div class="py-4 bg-white/90 backdrop-blur-xs rounded-2xl p-4 shadow-sm border border-slate-200 inline-block max-w-full">
          <p class="text-xl sm:text-2xl font-extrabold tracking-wide text-slate-900 fonte-manuscrita break-words">"${dados.texto}"</p>
        </div>
      `;
      
      lousaAutorNome.innerText = autor;
      lousaAutorContainer.classList.remove('hidden');
      btnLimparLousa.classList.remove('hidden');
    });
}

async function escreverNaLousa(e) {
  e.preventDefault();
  const input = document.getElementById('inputLousaTexto');
  const texto = input.value.trim();

  if (!texto || texto.length > 25) {
    alert("O recado deve ter no máximo 25 caracteres.");
    return;
  }

  if (!currentWorkspace.id) {
    alert("Erro de segurança: Utilizador sem grupo válido.");
    return;
  }

  try {
    if (lousaDocId) {
      await db.collection('lousa').doc(lousaDocId).update({
        texto: texto,
        userId: currentUser.id,
        userEmail: currentUser.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await db.collection('lousa').add({
        workspaceId: currentWorkspace.id,
        userId: currentUser.id,
        userEmail: currentUser.email,
        texto: texto,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    input.value = '';
    document.getElementById('charCount').innerText = '25 restantes';
  } catch (err) {
    alert("Erro ao escrever na lousa.");
  }
}

async function apagarLousa() {
  if (!lousaDocId) return;
  const confirmacao = confirm("Deseja limpar o mural para que outro membro possa escrever?");
  if (!confirmacao) return;

  try {
    await db.collection('lousa').doc(lousaDocId).delete();
    lousaDocId = null;
  } catch (err) {
    alert("Erro ao limpar a lousa.");
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

  const isIncome = tx.type === 'INCOME' || tx.cat === 'Salário' || tx.cat === 'Renda Extra';
  selecionarTipoTx(isIncome ? 'INCOME' : 'EXPENSE');

  setTimeout(() => {
    document.getElementById('txCat').value = tx.cat;
  }, 50);

  document.getElementById('newTxModal').classList.remove('hidden');
}

function closeNewTxModal() { 
  document.getElementById('newTxModal').classList.add('hidden'); 
  editingTxId = null;
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  const radioChecked = document.querySelector('input[name="txType"]:checked');
  const type = radioChecked ? radioChecked.value : 'EXPENSE';
  const desc = document.getElementById('txDesc').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const dateStr = document.getElementById('txDate').value; 
  const cat = document.getElementById('txCat').value;

  const partesData = dateStr.split('-');
  const ano = partesData[0];
  const mesIndex = parseInt(partesData[1], 10) - 1;
  const mesCalculado = `${mesesNomes[mesIndex]} ${ano}`;

  const txData = {
    desc, amount, type, cat,
    month: mesCalculado,
    date: dateStr,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (editingTxId) {
    await db.collection('transacoes').doc(editingTxId).update(txData);
  } else {
    txData.confirmado = false;
    txData.userId = currentUser.id;
    txData.userEmail = currentUser.email;
    txData.workspaceId = currentWorkspace.id;
    txData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('transacoes').add(txData);
  }

  closeNewTxModal();
  document.getElementById('txForm').reset();
  editingTxId = null;
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
  if (confirm("Deseja remover este lançamento?")) {
    await db.collection('transacoes').doc(id).delete();
  }
}

function changeActiveMonth(m) {
  activeMonth = m;
  renderAll();
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

  if (!selectCat) return;

  if (radioEntrada && radioEntrada.checked) {
    if (labelEntrada) labelEntrada.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer bg-white text-emerald-600 shadow-2xs transition";
    if (labelSaida) labelSaida.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer text-slate-500 transition";
    
    selectCat.innerHTML = `
      <option value="Salário">💰 Salário</option>
      <option value="Renda Extra">💵 Renda Extra</option>
    `;
  } else {
    if (labelSaida) labelSaida.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer bg-white text-rose-600 shadow-2xs transition";
    if (labelEntrada) labelEntrada.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer text-slate-500 transition";
    
    selectCat.innerHTML = `
      <option value="Gastos Fixos">🏠 Gastos Fixos</option>
      <option value="Gastos Gerais">🛒 Gastos Gerais</option>
      <option value="Lazer">🎉 Lazer</option>
      <option value="Investimentos">📈 Investimentos</option>
    `;
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

  const metas = currentWorkspace.metas || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

  const baseEntradas = income > 0 ? income : 1; 
  const metaFixosVal = baseEntradas * (metas.fixos / 100);
  const metaGeraisVal = baseEntradas * (metas.gerais / 100);
  const metaLazerVal = baseEntradas * (metas.lazer / 100);
  const metaInvestVal = baseEntradas * (metas.invest / 100);

  const gerarBarraProgressoEStatus = (gasto, meta) => {
    if (meta <= 0) return { html: `<div class="w-full bg-slate-200 h-1.5 rounded-full mt-1"></div>`, texto: `<span class="text-[9px] text-slate-400 font-semibold">Sem renda cadastrada</span>` };
    
    const pctGasto = (gasto / meta) * 100;
    const larguraVerde = Math.min(pctGasto, 100);
    let larguraVermelha = 0;
    if (pctGasto > 100) {
      larguraVermelha = Math.min(pctGasto - 100, 100);
    }

    const diferenca = meta - gasto;
    let textoStatus = '';
    if (diferenca >= 0) {
      textoStatus = `<span class="text-[9px] text-emerald-600 font-bold">Faltam R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`;
    } else {
      textoStatus = `<span class="text-[9px] text-rose-600 font-bold">Passou R$ ${Math.abs(diferenca).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`;
    }

    const htmlBarra = `
      <div class="w-full bg-slate-200 h-1.5 rounded-full mt-1 relative overflow-hidden flex">
        <div class="bg-emerald-500 h-full transition-all duration-300" style="width: ${larguraVerde}%"></div>
        <div class="bg-rose-600 h-full transition-all duration-300" style="width: ${larguraVermelha}%"></div>
      </div>
    `;

    return { html: htmlBarra, texto: textoStatus };
  };

  const resFixos = gerarBarraProgressoEStatus(fixed, metaFixosVal);
  const resGerais = gerarBarraProgressoEStatus(general, metaGeraisVal);
  const resLazer = gerarBarraProgressoEStatus(leisure, metaLazerVal);
  const resInvest = gerarBarraProgressoEStatus(invest, metaInvestVal);

  const containerCat = document.getElementById('cardsCategoryContainer');
  if (containerCat) {
    containerCat.innerHTML = `
      <div class="rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs space-y-1">
        <span class="text-[9px] font-extrabold text-slate-400 uppercase block">Gastos Fixos</span>
        <div class="text-xs sm:text-sm font-black text-slate-900">R$ ${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="text-[9px] text-slate-500 font-bold">Meta (${metas.fixos.toFixed(1)}%): R$ ${metaFixosVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div>${resFixos.texto}</div>
        ${resFixos.html}
      </div>
      <div class="rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs space-y-1">
        <span class="text-[9px] font-extrabold text-slate-400 uppercase block">Gastos Gerais</span>
        <div class="text-xs sm:text-sm font-black text-slate-900">R$ ${general.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="text-[9px] text-slate-500 font-bold">Meta (${metas.gerais.toFixed(1)}%): R$ ${metaGeraisVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div>${resGerais.texto}</div>
        ${resGerais.html}
      </div>
      <div class="rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs space-y-1">
        <span class="text-[9px] font-extrabold text-slate-400 uppercase block">Lazer</span>
        <div class="text-xs sm:text-sm font-black text-slate-900">R$ ${leisure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="text-[9px] text-slate-500 font-bold">Meta (${metas.lazer.toFixed(1)}%): R$ ${metaLazerVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div>${resLazer.texto}</div>
        ${resLazer.html}
      </div>
      <div class="rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs space-y-1">
        <span class="text-[9px] font-extrabold text-slate-400 uppercase block">Investimentos</span>
        <div class="text-xs sm:text-sm font-black text-emerald-600">R$ ${invest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="text-[9px] text-slate-500 font-bold">Meta (${metas.invest.toFixed(1)}%): R$ ${metaInvestVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div>${resInvest.texto}</div>
        ${resInvest.html}
      </div>
    `;
  }

  const currentTxMes = transactions.filter(t => t.month === activeMonth);
  renderTransactionsList(currentTxMes);
  renderInvestments(currentTxMes);
  renderCharts(fixed, general, leisure, invest);
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
          backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 2 },
        plugins: { 
          legend: { 
            position: 'bottom', 
            labels: { boxWidth: 8, font: { size: 9 }, padding: 8, usePointStyle: true } 
          } 
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
          label: 'Gasto (R$)',
          data: [fixed, general, leisure, invest],
          backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 9 }, callback: val => 'R$ ' + val } },
          x: { grid: { display: false }, ticks: { font: { size: 9 } } }
        }
      }
    });
  }
}

function renderTransactionsList(currentTx) {
  const container = document.getElementById('txListContainer');
  if (!container) return;

  const search = (document.getElementById('searchExpense')?.value || '').toLowerCase();
  const filtroMembro = document.getElementById('filterMember')?.value || '';
  const filtroCat = document.getElementById('filterCategory')?.value || '';

  container.innerHTML = '';
  
  const filtered = currentTx.filter(t => {
    const matchSearch = t.desc.toLowerCase().includes(search) || t.cat.toLowerCase().includes(search);
    const matchMembro = filtroMembro === '' || t.userEmail === filtroMembro;
    const matchCat = filtroCat === '' || t.cat === filtroCat;
    return matchSearch && matchMembro && matchCat;
  });

  filtered.sort((a, b) => {
    const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
    const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return new Date(b.date) - new Date(a.date);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Nenhuma movimentação encontrada neste mês com estes filtros.</div>`;
    return;
  }

  filtered.forEach(t => {
    const isIncome = t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra';
    const autorNome = t.userEmail ? t.userEmail.split('@')[0] : 'Membro';
    const confirmado = t.confirmado === true;

    container.innerHTML += `
      <div class="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div class="text-xs font-extrabold text-slate-900">${t.desc} 
            <span class="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">${t.cat}</span>
            <span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1"><i class="fa-solid fa-user text-[8px] mr-0.5"></i>${autorNome}</span>
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
            <span><i class="fa-regular fa-calendar mr-1"></i>${t.date}</span>
            <button onclick="toggleConfirmTransaction('${t.id}')" class="text-[9px] font-extrabold px-2 py-0.5 rounded transition ${
              confirmado 
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200 animate-pulse'
            }">
              ${confirmado ? '✓ Registado' : '⏳ Pendente (Clique p/ Confirmar)'}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-black ${isIncome ? 'text-emerald-600' : 'text-rose-600'}">
            ${isIncome ? '+' : '-'} R$ ${Number(t.amount).toFixed(2).replace('.', ',')}
          </span>
          <button onclick="openEditTransaction('${t.id}')" class="text-slate-400 hover:text-blue-600 p-1" title="Editar"><i class="fa-solid fa-pen-to-square text-xs"></i></button>
          <button onclick="deleteTransaction('${t.id}')" class="text-slate-400 hover:text-rose-600 p-1" title="Excluir"><i class="fa-solid fa-trash-can text-xs"></i></button>
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

  const totalYearInvested = transactions
    .filter(t => t.cat === 'Investimentos' && t.type === 'EXPENSE' && t.confirmado && (t.month.includes('2026') || (t.date && t.date.startsWith('2026'))))
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
    investList.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Nenhum aporte registrado neste mês.</div>`;
    return;
  }

  investList.innerHTML = '';
  invests.forEach(t => {
    const confirmado = t.confirmado === true;
    investList.innerHTML += `
      <div class="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div class="text-xs font-extrabold text-slate-900">${t.desc}</div>
          <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
            <span>${t.date}</span>
            <button onclick="toggleConfirmTransaction('${t.id}')" class="text-[9px] font-extrabold px-1.5 py-0.2 rounded transition ${
              confirmado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }">
              ${confirmado ? '✓ Registado' : '⏳ Pendente'}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-black text-rose-600">R$ ${Number(t.amount).toFixed(2).replace('.', ',')}</span>
          <button onclick="openEditTransaction('${t.id}')" class="text-slate-400 hover:text-blue-600 p-1" title="Editar"><i class="fa-solid fa-pen-to-square text-xs"></i></button>
          <button onclick="deleteTransaction('${t.id}')" class="text-slate-400 hover:text-rose-600 p-1" title="Excluir"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>
      </div>
    `;
  });
}

function switchTab(tab) {
  ['resumo', 'extrato', 'invest', 'mural'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.classList.add('hidden');
  });

  const activeEl = document.getElementById(`tab-${tab}`);
  if (activeEl) activeEl.classList.remove('hidden');

  if (tab === 'extrato') {
    renderTransactionsList(transactions.filter(t => t.month === activeMonth));
  }

  ['resumo', 'extrato', 'invest', 'mural'].forEach(name => {
    const btn = document.getElementById(`bottomNav${name.charAt(0).toUpperCase() + name.slice(1)}`);
    if (btn) {
      btn.className = name === tab ? 'relative flex flex-col items-center justify-center text-blue-600 transition active:scale-95 py-0.5' : 'relative flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95 py-0.5';
    }
  });

  if (tab === 'resumo') renderAll();
}

function copyWorkspaceCountCode() { navigator.clipboard.writeText(currentWorkspace.code).then(() => alert(`Código ${currentWorkspace.code} copiado com sucesso!`)); }
function logout() { auth.signOut().then(() => window.location.replace('index.html')); }
