let modoMetasAtual = 'perc'; // 'perc' ou 'dinheiro'

function openProfileModal() {
  document.getElementById('profileModal').classList.remove('hidden');
  carregarMembrosDoGrupo();
  carregarDadosMetasNoConfig();
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.add('hidden');
}

function mudarModoMetas(modo) {
  modoMetasAtual = modo;
  const btnPerc = document.getElementById('btnModoPerc');
  const btnDinheiro = document.getElementById('btnModoDinheiro');
  
  if (modo === 'perc') {
    btnPerc.className = "px-2 py-1 text-[10px] font-bold rounded-md bg-blue-600 text-white transition";
    btnDinheiro.className = "px-2 py-1 text-[10px] font-bold rounded-md text-slate-600 transition";
  } else {
    btnDinheiro.className = "px-2 py-1 text-[10px] font-bold rounded-md bg-blue-600 text-white transition";
    btnPerc.className = "px-2 py-1 text-[10px] font-bold rounded-md text-slate-600 transition";
  }
  carregarDadosMetasNoConfig();
}

function carregarDadosMetasNoConfig() {
  const metas = currentWorkspace.metas || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };
  const currentTx = transactions.filter(t => t.month === activeMonth);
  const income = currentTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const baseEntradas = income > 0 ? income : 1;

  if (modoMetasAtual === 'perc') {
    document.getElementById('cfgMetaFixos').value = metas.fixos;
    document.getElementById('cfgMetaGerais').value = metas.gerais;
    document.getElementById('cfgMetaLazer').value = metas.lazer;
    document.getElementById('cfgMetaInvest').value = metas.invest;

    document.getElementById('subMetaFixos').innerText = `= R$ ${(baseEntradas * (metas.fixos / 100)).toFixed(2)}`;
    document.getElementById('subMetaGerais').innerText = `= R$ ${(baseEntradas * (metas.gerais / 100)).toFixed(2)}`;
    document.getElementById('subMetaLazer').innerText = `= R$ ${(baseEntradas * (metas.lazer / 100)).toFixed(2)}`;
    document.getElementById('subMetaInvest').innerText = `= R$ ${(baseEntradas * (metas.invest / 100)).toFixed(2)}`;
  } else {
    document.getElementById('cfgMetaFixos').value = (baseEntradas * (metas.fixos / 100)).toFixed(2);
    document.getElementById('cfgMetaGerais').value = (baseEntradas * (metas.gerais / 100)).toFixed(2);
    document.getElementById('cfgMetaLazer').value = (baseEntradas * (metas.lazer / 100)).toFixed(2);
    document.getElementById('cfgMetaInvest').value = (baseEntradas * (metas.invest / 100)).toFixed(2);

    document.getElementById('subMetaFixos').innerText = `= ${metas.fixos}%`;
    document.getElementById('subMetaGerais').innerText = `= ${metas.gerais}%`;
    document.getElementById('subMetaLazer').innerText = `= ${metas.lazer}%`;
    document.getElementById('subMetaInvest').innerText = `= ${metas.invest}%`;
  }
  document.getElementById('metaConfigErrorMsg').classList.add('hidden');
}

function calcularConversaoMetas(cat) {
  const currentTx = transactions.filter(t => t.month === activeMonth);
  const income = currentTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const baseEntradas = income > 0 ? income : 1;

  const valInput = parseFloat(document.getElementById(`cfgMeta${cat.charAt(0).toUpperCase() + cat.slice(1)}`).value) || 0;

  if (modoMetasAtual === 'perc') {
    const emDinheiro = baseEntradas * (valInput / 100);
    document.getElementById(`subMeta${cat.charAt(0).toUpperCase() + cat.slice(1)}`).innerText = `= R$ ${emDinheiro.toFixed(2)}`;
  } else {
    const emPerc = (valInput / baseEntradas) * 100;
    document.getElementById(`subMeta${cat.charAt(0).toUpperCase() + cat.slice(1)}`).innerText = `= ${emPerc.toFixed(1)}%`;
  }
}

async function salvarMetasGrupoConfig(e) {
  e.preventDefault();
  const currentTx = transactions.filter(t => t.month === activeMonth);
  const income = currentTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const baseEntradas = income > 0 ? income : 1;

  let fixos = parseFloat(document.getElementById('cfgMetaFixos').value) || 0;
  let gerais = parseFloat(document.getElementById('cfgMetaGerais').value) || 0;
  let lazer = parseFloat(document.getElementById('cfgMetaLazer').value) || 0;
  let invest = parseFloat(document.getElementById('cfgMetaInvest').value) || 0;

  if (modoMetasAtual === 'dinheiro') {
    fixos = (fixos / baseEntradas) * 100;
    gerais = (gerais / baseEntradas) * 100;
    lazer = (lazer / baseEntradas) * 100;
    invest = (invest / baseEntradas) * 100;
  }

  const soma = Math.round((fixos + gerais + lazer + invest) * 100) / 100;
  const errorDiv = document.getElementById('metaConfigErrorMsg');

  if (Math.abs(soma - 100) > 0.5) {
    errorDiv.innerText = `A soma total das metas deve ser exatamente 100% (ou equivalente em R$). Atualmente está em ${soma.toFixed(1)}%.`;
    errorDiv.classList.remove('hidden');
    return;
  }

  errorDiv.classList.add('hidden');

  try {
    const novasMetas = { fixos, gerais, lazer, invest };
    await db.collection('users').doc(currentUser.id).update({ metas: novasMetas });
    currentWorkspace.metas = novasMetas;

    closeProfileModal();
    renderAll();
    alert("Metas atualizadas com sucesso!");
  } catch (err) {
    alert("Erro ao salvar metas.");
  }
}
