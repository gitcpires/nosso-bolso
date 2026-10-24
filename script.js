async function handleSaveTransaction(e) {
  e.preventDefault();
  const type = document.querySelector('input[name="txType"]:checked').value;
  const desc = document.getElementById('txDesc').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const date = document.getElementById('txDate').value;
  const cat = document.getElementById('txCat').value;

  // Seleciona o botão de submit do modal de transação para ativar o loading
  const btnSubmit = document.querySelector('#newTxModal button[type="submit"]');
  const textoOriginal = btnSubmit ? btnSubmit.innerText : '';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
    btnSubmit.innerText = "A GUARDAR...";
  }

  try {
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
  } catch (err) {
    console.error("Erro ao guardar transação:", err);
    alert("Erro ao guardar a transação. Tente novamente.");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
      btnSubmit.innerText = textoOriginal;
    }
  }
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

  const btnMeta = document.querySelector('#metasModal button[type="submit"]');
  const textoOriginal = btnMeta ? btnMeta.innerText : '';
  if (btnMeta) {
    btnMeta.disabled = true;
    btnMeta.classList.add('opacity-50', 'cursor-not-allowed');
    btnMeta.innerText = "A SALVAR...";
  }

  try {
    const novasMetas = { fixos, gerais, lazer, invest };
    await db.collection('users').doc(currentUser.id).update({ metas: novasMetas });
    currentWorkspace.metas = novasMetas;

    closeMetasModal();
    renderAll();
    alert("Metas atualizadas com sucesso!");
  } catch (err) {
    alert("Erro ao salvar metas.");
  } finally {
    if (btnMeta) {
      btnMeta.disabled = false;
      btnMeta.classList.remove('opacity-50', 'cursor-not-allowed');
      btnMeta.innerText = textoOriginal;
    }
  }
}

async function criarNovoWorkspace() {
  const btnCriar = document.getElementById('btnCriarWs'); // Opcional caso queira mapear o ID
  try {
    const novoCodigo = Math.floor(1000 + Math.random() * 9000).toString();
    const workspaceId = 'ws_' + currentUser.id;
    const metasPadrao = { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

    mostrarSetupMsg("A criar novo grupo...", "info");

    await db.collection('users').doc(currentUser.id).update({
      workspaceId: workspaceId,
      workspaceCode: novoCodigo,
      metas: metasPadrao
    });

    currentWorkspace.id = workspaceId;
    currentWorkspace.code = novoCodigo;
    currentWorkspace.metas = metasPadrao;

    document.getElementById('setupWorkspaceModal').classList.add('hidden');
    initUserSession();
  } catch (err) {
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

    await db.collection('users').doc(currentUser.id).update({
      workspaceId: targetWorkspaceId,
      workspaceCode: codigoInput,
      metas: metasGrupo
    });

    currentWorkspace.id = targetWorkspaceId;
    currentWorkspace.code = codigoInput;
    currentWorkspace.metas = metasGrupo;

    document.getElementById('setupWorkspaceModal').classList.add('hidden');
    initUserSession();
  } catch (err) {
    mostrarSetupMsg("Erro ao entrar no grupo.", "erro");
  }
}
