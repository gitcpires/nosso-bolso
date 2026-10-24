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
let activeMonth = 'Outubro 2026';
let categoryPieChartInstance = null;
let categoryBarChartInstance = null;
let lousaDocId = null;

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

  if (email === 'c.pirespm@gmail.com') {
    window.location.replace("admin.html");
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
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

      if (userData.metas) {
        currentWorkspace.metas = userData.metas;
      }
    } else {
      document.getElementById('loadingScreen').classList.add('hidden');
      document.getElementById('pendingScreen').classList.remove('hidden');
      return;
    }

    document.getElementById('loadingScreen').classList.add('hidden');
    initUserSession();

  } catch (err) {
    console.error(err);
    document.getElementById('loadingScreen').innerHTML = `<p class="text-xs text-rose-600 font-bold">Erro ao carregar dados. Tente atualizar a página.</p>`;
  }
});

function openMetasModal() {
  document.getElementById('metaFixos').value = currentWorkspace.metas.fixos;
  document.getElementById('metaGerais').value = currentWorkspace.metas.gerais;
  document.getElementById('metaLazer').value = currentWorkspace.metas.lazer;
  document.getElementById('metaInvest').value = currentWorkspace.metas.invest;
  document.getElementById('metaErrorMsg').classList.add('hidden');
  document.getElementById('metasModal').classList.remove('hidden');
}

function closeMetasModal() {
  document.getElementById('metasModal').classList.add('hidden');
}

async function salvarMetasGrupo(e) {
  e.preventDefault();
  const fixos = parseFloat(document.getElementById('metaFixos').value) || 0;
  const gerais = parseFloat(document.getElementById('metaGerais').value) || 0;
  const lazer = parseFloat(document.getElementById('metaLazer').value) || 0;
  const invest = parseFloat(document.getElementById('metaInvest').value) || 0;

  const soma = fixos + gerais + lazer + invest;
  const errorDiv = document.getElementById('metaErrorMsg');

  if (soma !== 100) {
    errorDiv.innerText = `A soma das metas deve ser exatamente 100%. Atualmente está em ${soma}%.`;
    errorDiv.classList.remove('hidden');
    return;
  }

  errorDiv.classList.add('hidden');

  try {
    const novasMetas = { fixos, gerais, lazer, invest };
    await db.collection('users').doc(currentUser.id).update({ metas: novasMetas });
    currentWorkspace.metas = novasMetas;

    closeMetasModal();
    renderAll();
    alert("Metas atualizadas com sucesso!");
  } catch (err) {
    alert("Erro ao salvar metas.");
  }
}

async function deixarGrupo() {
  const confirmacao = confirm("Tem certeza absoluta que deseja deixar este grupo?\n\nVocê perderá o acesso imediato a estas finanças e precisará de criar um novo grupo ou inserir um novo código de convite.");
  if (!confirmacao) return;

  try {
    await db.collection('users').doc(currentUser.id).update({
      workspaceId: firebase.firestore.FieldValue.delete(),
      workspaceCode: firebase.firestore.FieldValue.delete(),
      metas: firebase.firestore.FieldValue.delete()
    });

    alert("Você saiu do grupo com sucesso.");
    window.location.reload();
  } catch (err) {
    alert("Erro ao tentar deixar o grupo. Tente novamente.");
  }
}

async function criarNovoWorkspace() {
  try {
    const novoCodigo = Math.floor(1000 + Math.random() * 9000).toString();
    const workspaceId = 'ws_' + currentUser.id;
    const metasPadrao = { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

    mostrarSetupMsg("A criar novo grupo...", "info");

    await db.collection('users').doc(currentUser.id).set({
      workspaceId: workspaceId,
      workspaceCode: novoCodigo,
      metas: metasPadrao,
      email: currentUser.email,
      status: 'approved'
    }, { merge: true });

    currentWorkspace.id = workspaceId;
    currentWorkspace.code = novoCodigo;
    currentWorkspace.metas = metasPadrao;

    document.getElementById('setupWorkspaceModal').classList.add('hidden');
    initUserSession();
  } catch (err) {
    console.error("Erro ao criar grupo:", err);
    mostrarSetupMsg("Erro ao criar grupo. Tente novamente.", "erro");
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
    const wsQuery = await db.collection('users').where('workspaceCode', '==', codigoInput).get();

    if (wsQuery.empty) {
      mostrarSetupMsg("Código de grupo não encontrado. Verifique com o seu familiar/sócio.", "erro");
      return;
    }

    const wsData = wsQuery.docs[0].data();
    const targetWorkspaceId = wsData.workspaceId;
    const metasGrupo = wsData.metas || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

    await db.collection('users').doc(currentUser.id).set({
      workspaceId: targetWorkspaceId,
      workspaceCode: codigoInput,
      metas: metasGrupo,
      email: currentUser.email,
      status: 'approved'
    }, { merge: true });

    currentWorkspace.id = targetWorkspaceId;
    currentWorkspace.code = codigoInput;
    currentWorkspace.metas = metasGrupo;

    document.getElementById('setupWorkspaceModal').classList.add('hidden');
    initUserSession();
  } catch (err) {
    console.error("Erro ao entrar no grupo:", err);
    mostrarSetupMsg("Erro ao entrar no grupo.", "erro");
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
  document.getElementById('headerUserName').innerText = currentUser.name;
  document.getElementById('headerWelcomeMsg').innerText = `Grupo: ${currentWorkspace.code}`;
  document.getElementById('profileWorkspaceCodeDisplay').innerText = currentWorkspace.code;

  renderAll();
  carregarDadosDoBanco();
  carregarMembrosDoGrupo();
  ouvinteLousaGrupo();
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
        <div class="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
          <span class="font-bold text-slate-700 truncate"><i class="fa-solid fa-user-circle text-blue-500 mr-1.5"></i>${emailMembro}${ehVoce}</span>
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
        lousaConteudo.innerHTML = `<p class="text-xs text-slate-400 italic">Mural limpo.</p>`;
        lousaAutorContainer.classList.add('hidden');
        btnLimparLousa.classList.add('hidden');
        return;
      }

      const docLousa = snapshot.docs[0];
      lousaDocId = docLousa.id;
      const dados = docLousa.data();
      const autor = dados.userEmail ? dados.userEmail.split('@')[0] : 'Membro';

      lousaConteudo.innerHTML = `<p class="text-base sm:text-lg font-bold tracking-wide text-amber-300 break-words">"${dados.texto}"</p>`;
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
    const userCheck = await db.collection('users').doc(currentUser.id).get();
    if (!userCheck.exists || userCheck.data().workspaceId !== currentWorkspace.id) {
      alert("Acesso negado: você não pertence a este grupo.");
      return;
    }

    if (lousaDocId) {
      await db.collection('lousa').doc(lousaDocId).update({
        texto: texto,
        userEmail: currentUser.email,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await db.collection('lousa').add({
        workspaceId: currentWorkspace.id,
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
    const userCheck = await db.collection('users').doc(currentUser.id).get();
    if (!userCheck.exists || userCheck.data().workspaceId !== currentWorkspace.id) {
      alert("Acesso negado.");
      return;
    }

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
        transactions.push({ id: doc.id, ...doc.data() });
      });
      renderAll();
    });
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  const type = document.querySelector('input[name="txType"]:checked').value;
  const desc = document.getElementById('txDesc').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const date = document.getElementById('txDate').value;
  const cat = document.getElementById('txCat').value;

  const newTx = {
    desc, amount, type, cat,
    userId: currentUser.id,
    userEmail: currentUser.email,
    workspaceId: currentWorkspace.id,
    month: activeMonth,
    date
  };

  await db.collection('transacoes').add(newTx);
  closeNewTxModal();
  document.getElementById('txForm').reset();
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

function toggleTxTypeUI() {
  const type = document.querySelector('input[name="txType"]:checked').value;
  const catSelect = document.getElementById('txCat');
  if (type === 'INCOME') {
    catSelect.innerHTML = `<option value="Salário">💼 Salário</option><option value="Renda Extra">✨ Renda Extra</option>`;
  } else {
    catSelect.innerHTML = `
      <option value="Gastos Fixos">🏠 Gastos Fixos</option>
      <option value="Gastos Gerais">🛒 Gastos Gerais</option>
      <option value="Lazer">🎉 Lazer</option>
      <option value="Investimentos">📈 Investimentos</option>
    `;
  }
}

function renderAll() {
  const currentTx = transactions.filter(t => t.month === activeMonth);
  const income = currentTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const expense = currentTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  document.getElementById('statIncome').innerText = `R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('statExpense').innerText = `R$ ${expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('statBalance').innerText = `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const fixed = currentTx.filter(t => t.cat === 'Gastos Fixos' && t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
  const general = currentTx.filter(t => t.cat === 'Gastos Gerais' && t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
  const leisure = currentTx.filter(t => t.cat === 'Lazer' && t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
  const invest = currentTx.filter(t => t.cat === 'Investimentos' && t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);

  const metas = currentWorkspace.metas || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

  const baseEntradas = income > 0 ? income : 1; 
  const metaFixosVal = baseEntradas * (metas.fixos / 100);
  const metaGeraisVal = baseEntradas * (metas.gerais / 100);
  const metaLazerVal = baseEntradas * (metas.lazer / 100);
  const metaInvestVal = baseEntradas * (metas.invest / 100);

  const gerarBarraProgressoEStatus = (gasto, meta) => {
    if (meta <= 0) return { html: `<div class="w-full bg-slate-100 h-1.5 rounded-full mt-1"></div>`, texto: `<span class="text-[9px] text-slate-400 font-semibold">Sem renda cadastrada</span>` };
    
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
      <div class="w-full bg-slate-100 h-1.5 rounded-full mt-1 relative overflow-hidden flex">
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
      <div class="rounded-2xl bg-white p-2.5 border border-slate-200 shadow-2xs space-y-0.5">
        <span class="text-[9px] font-bold text-slate-400 uppercase block">Gastos Fixos</span>
        <div class="text-xs sm:text-sm font-black text-slate-900">R$ ${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="text-[9px] text-slate-500 font-semibold">Meta (${metas.fixos}%): R$ ${metaFixosVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div>${resFixos.texto}</div>
        ${resFixos.html}
      </div>
      <div class="rounded-2xl bg-white p-2.5 border border-slate-200 shadow-2xs space-y-0.5">
        <span class="text-[9px] font-bold text-slate-400 uppercase block">Gastos Gerais</span>
        <div class="text-xs sm:text-sm font-black text-slate-900">R$ ${general.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="text-[9px] text-slate-500 font-semibold">Meta (${metas.gerais}%): R$ ${metaGeraisVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div>${resGerais.texto}</div>
        ${resGerais.html}
      </div>
      <div class="rounded-2xl bg-white p-2.5 border border-slate-200 shadow-2xs space-y-0.5">
        <span class="text-[9px] font-bold text-slate-400 uppercase block">Lazer</span>
        <div class="text-xs sm:text-sm font-black text-slate-900">R$ ${leisure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="text-[9px] text-slate-500 font-semibold">Meta (${metas.lazer}%): R$ ${metaLazerVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div>${resLazer.texto}</div>
        ${resLazer.html}
      </div>
      <div class="rounded-2xl bg-white p-2.5 border border-slate-200 shadow-2xs space-y-0.5">
        <span class="text-[9px] font-bold text-slate-400 uppercase block">Investimentos</span>
        <div class="text-xs sm:text-sm font-black text-emerald-600">R$ ${invest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="text-[9px] text-slate-500 font-semibold">Meta (${metas.invest}%): R$ ${metaInvestVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div>${resInvest.texto}</div>
        ${resInvest.html}
      </div>
    `;
  }

  renderTransactionsList(currentTx);
  renderInvestments(currentTx, invest);
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
          backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981'],
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
          backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981'],
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

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl">Nenhuma movimentação encontrada com estes filtros.</div>`;
    return;
  }

  filtered.forEach(t => {
    const isIncome = t.type === 'INCOME';
    const autorNome = t.userEmail ? t.userEmail.split('@')[0] : 'Membro';

    container.innerHTML += `
      <div class="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
        <div>
          <div class="text-xs font-extrabold text-slate-800">${t.desc} 
            <span class="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">${t.cat}</span>
            <span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1"><i class="fa-solid fa-user text-[8px] mr-0.5"></i>${autorNome}</span>
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5"><i class="fa-regular fa-calendar mr-1"></i>${t.date}</div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-black ${isIncome ? 'text-emerald-600' : 'text-slate-900'}">
            ${isIncome ? '+' : '-'} R$ ${Number(t.amount).toFixed(2).replace('.', ',')}
          </span>
          <button onclick="deleteTransaction('${t.id}')" class="text-slate-300 hover:text-rose-500 p-1"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>
      </div>
    `;
  });
}

function renderInvestments(currentTx, totalInvested) {
  document.getElementById('monthInvestTotalHeader').innerText = `R$ ${totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const investList = document.getElementById('monthInvestmentsList');
  const invests = currentTx.filter(t => t.cat === 'Investimentos');

  if (invests.length === 0) {
    investList.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">Nenhum aporte registrado neste mês.</div>`;
    return;
  }

  investList.innerHTML = '';
  invests.forEach(t => {
    investList.innerHTML += `
      <div class="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
        <div>
          <div class="text-xs font-extrabold text-slate-800">${t.desc}</div>
          <div class="text-[10px] text-slate-400">${t.date}</div>
        </div>
        <span class="text-xs font-black text-emerald-600">R$ ${Number(t.amount).toFixed(2).replace('.', ',')}</span>
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

  ['resumo', 'extrato', 'invest', 'mural'].forEach(name => {
    const btn = document.getElementById(`tabBtn-${name}`);
    if (btn) {
      if (name === tab) {
        btn.className = "pb-2 text-xs sm:text-sm font-extrabold text-blue-600 border-b-2 border-blue-600 whitespace-nowrap";
      } else {
        btn.className = "pb-2 text-xs sm:text-sm font-bold text-slate-400 border-b-2 border-transparent whitespace-nowrap";
      }
    }
  });

  ['resumo', 'extrato', 'invest', 'mural'].forEach(name => {
    const btn = document.getElementById(`bottomNav${name.charAt(0).toUpperCase() + name.slice(1)}`);
    if (btn) {
      btn.className = name === tab ? 'flex flex-col items-center justify-center text-blue-600 transition active:scale-95' : 'flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95';
    }
  });

  if (tab === 'extrato') renderTransactionsList(transactions);
  if (tab === 'resumo') renderAll();
}

function openNewTxModal() { 
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
  toggleTxTypeUI();
  document.getElementById('newTxModal').classList.remove('hidden'); 
}
function closeNewTxModal() { document.getElementById('newTxModal').classList.add('hidden'); }
function openProfileModal() { document.getElementById('profileModal').classList.remove('hidden'); carregarMembrosDoGrupo(); }
function closeProfileModal() { document.getElementById('profileModal').classList.add('hidden'); }
function copyWorkspaceCountCode() { navigator.clipboard.writeText(currentWorkspace.code).then(() => alert(`Código ${currentWorkspace.code} copiado com sucesso!`)); }
function logout() { auth.signOut().then(() => window.location.href = 'index.html'); }
