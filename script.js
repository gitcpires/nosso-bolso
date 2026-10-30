Const firebaseConfig = {
  ApiKey: "AIzaSyDMR6Aq9KoDGPkZLZueBgIo7AhNx5Gj08Q",
  authDomain: "nosso-bolso-c8d29.firebaseapp.com",
  projectId: "nosso-bolso-c8d29",
  storageBucket: "nosso-bolso-c8d29.firebasestorage.app",
  messagingSenderId: "812166717623",
  appId: "1:812166717623:web:ba3a4c0db18484be47ad32"
};

If (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

Let currentWorkspace = { id: '', code: '', metas: { fixos: 50, gerais: 30, lazer: 10, invest: 10 } };
let currentUser = { id: '', name: '', email: '' };
let transactions = [];
const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const agora = new Date();
let activeMonth = `${mesesNomes[agora.getMonth()]} ${agora.getFullYear()}`;

Let categoryPieChartInstance = null;
let categoryBarChartInstance = null;
let lousaDocId = null;
let modoMetasAtual = 'perc';

Auth.onAuthStateChanged(async (userAuth) => {
  If (!userAuth) {
    Window.location.href = 'index.html';
    Return;
  }

  Const uid = userAuth.uid;
  Const email = userAuth.email;
  currentUser.id = uid;
  currentUser.email = email;
  currentUser.name = email.split('@')[0];

  Try {
    Const userDocRef = db.collection('users').doc(uid);
    Let userDoc = await userDocRef.get();
    
    If (!userDoc.exists) {
      Await userDocRef.set({
        Email: email,
        Status: 'pending',
        CreatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      UserDoc = await userDocRef.get();
    }

    Const userData = userDoc.data();
    
    If (userData.status !== 'approved') {
      Document.getElementById('loadingScreen').classList.add('hidden');
      Document.getElementById('pendingScreen').classList.remove('hidden');
      Return;
    }

    If (!userData.workspaceId) {
      Document.getElementById('loadingScreen').classList.add('hidden');
      Document.getElementById('setupWorkspaceModal').classList.remove('hidden');
      Return;
    }

    CurrentWorkspace.id = userData.workspaceId;
    CurrentWorkspace.code = userData.workspaceCode || '----';

    If (userData.metas) {
      CurrentWorkspace.metas = userData.metas;
    }

    Document.getElementById('loadingScreen').classList.add('hidden');
    initUserSession();

  } catch (err) {
    Console.error(err);
    Document.getElementById('loadingScreen').innerHTML = `<p class="text-xs text-rose-600 font-bold">Erro ao carregar dados. Tente atualizar a página.</p>`;
  }
});

Function openProfileModal() {
  Document.getElementById('profileModal').classList.remove('hidden');
  carregarMembrosDoGrupo();
  carregarDadosMetasNoConfig();
  calcularConversaoMetas('fixos');
}

Function closeProfileModal() {
  Document.getElementById('profileModal').classList.add('hidden');
}

Function mudarModoMetas(modo) {
  ModoMetasAtual = modo;
  Const btnPerc = document.getElementById('btnModoPerc');
  Const btnDinheiro = document.getElementById('btnModoDinheiro');
  
  If (modo === 'perc') {
    BtnPerc.className = "px-2.5 py-1 text-[10px] font-bold rounded-md bg-blue-600 text-white transition";
    BtnDinheiro.className = "px-2.5 py-1 text-[10px] font-bold rounded-md text-slate-600 transition";
  } else {
    BtnDinheiro.className = "px-2.5 py-1 text-[10px] font-bold rounded-md bg-blue-600 text-white transition";
    BtnPerc.className = "px-2.5 py-1 text-[10px] font-bold rounded-md text-slate-600 transition";
  }
  carregarDadosMetasNoConfig();
  calcularConversaoMetas('fixos');
}

Function carregarDadosMetasNoConfig() {
  Const metas = currentWorkspace.metas || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };
  Const currentTx = transactions.filter(t => t.month === activeMonth);
  Const income = currentTx.filter(t => (t.cat === 'Salário' || t.cat === 'Renda Extra' || t.type === 'INCOME') && t.confirmado === true).reduce((s, t) => s + t.amount, 0);
  Const baseEntradas = income > 0 ? income : 1;

  ['Fixos', 'Gerais', 'Lazer', 'Invest'].forEach(catKey => {
    Const keyLower = catKey.toLowerCase();
    Const pct = metas[keyLower] || 0;
    Const valorDinheiro = baseEntradas * (pct / 100);

    Const labelEl = document.getElementById(`labelUnidade${catKey}`);
    If (labelEl) labelEl.innerText = modoMetasAtual === 'perc' ? '%' : 'R$';
    
    Const inputEl = document.getElementById(`cfgMeta${catKey}`);
    Const subEl = document.getElementById(`subMeta${catKey}`);

    If (inputEl && subEl) {
      If (modoMetasAtual === 'perc') {
        InputEl.value = pct > 0 ? pct.toFixed(1) : '';
        SubEl.innerText = `= R$ ${valorDinheiro.toFixed(2)}`;
      } else {
        InputEl.value = valorDinheiro > 0 ? valorDinheiro.toFixed(2) : '';
        SubEl.innerText = `= ${pct.toFixed(1)}%`;
      }
    }
  });

  Const errEl = document.getElementById('metaConfigErrorMsg');
  If (errEl) errEl.classList.add('hidden');
}

Function calcularConversaoMetas(catKey) {
  Const currentTx = transactions.filter(t => t.month === activeMonth);
  Const income = currentTx.filter(t => (t.cat === 'Salário' || t.cat === 'Renda Extra' || t.type === 'INCOME') && t.confirmado === true).reduce((s, t) => s + t.amount, 0);
  Const baseEntradas = income > 0 ? income : 1;

  Const inputEl = document.getElementById(`cfgMeta${catKey.charAt(0).toUpperCase() + catKey.slice(1)}`);
  Const subEl = document.getElementById(`subMeta${catKey.charAt(0).toUpperCase() + catKey.slice(1)}`);
  If (!inputEl || !subEl) return;

  Const val = parseFloat(inputEl.value) || 0;

  If (modoMetasAtual === 'perc') {
    Const emDinheiro = baseEntradas * (val / 100);
    SubEl.innerText = `= R$ ${emDinheiro.toFixed(2)}`;
  } else {
    Const emPerc = (val / baseEntradas) * 100;
    SubEl.innerText = `= ${emPerc.toFixed(1)}%`;
  }

  Const fixosVal = parseFloat(document.getElementById('cfgMetaFixos')?.value) || 0;
  Const geraisVal = parseFloat(document.getElementById('cfgMetaGerais')?.value) || 0;
  Const lazerVal = parseFloat(document.getElementById('cfgMetaLazer')?.value) || 0;
  Const investVal = parseFloat(document.getElementById('cfgMetaInvest')?.value) || 0;

  Const spanRestante = document.getElementById('metaTotalRestante');
  If (spanRestante) {
    If (modoMetasAtual === 'perc') {
      Const somaPerc = fixosVal + geraisVal + lazerVal + investVal;
      Const diferencaPerc = 100 - somaPerc;
      
      If (Math.abs(diferencaPerc) < 0.01) {
        SpanRestante.innerHTML = `<span class="text-emerald-600 font-extrabold">✓ Total: 100%</span>`;
      } else if (diferencaPerc > 0) {
        SpanRestante.innerHTML = `<span class="text-amber-600 font-bold">Faltam ${diferencaPerc.toFixed(1)}%</span>`;
      } else {
        SpanRestante.innerHTML = `<span class="text-rose-600 font-bold">Passou ${Math.abs(diferencaPerc).toFixed(1)}%</span>`;
      }
    } else {
      Const somaDinheiro = fixosVal + geraisVal + lazerVal + investVal;
      Const diferencaDinheiro = baseEntradas - somaDinheiro;

      If (Math.abs(diferencaDinheiro) < 0.01) {
        SpanRestante.innerHTML = `<span class="text-emerald-600 font-extrabold">✓ Total: R$ ${baseEntradas.toFixed(2)}</span>`;
      } else if (diferencaDinheiro > 0) {
        SpanRestante.innerHTML = `<span class="text-amber-600 font-bold">Faltam R$ ${diferencaDinheiro.toFixed(2)}</span>`;
      } else {
        SpanRestante.innerHTML = `<span class="text-rose-600 font-bold">Passou R$ ${Math.abs(diferencaDinheiro).toFixed(2)}</span>`;
      }
    }
  }
}

Async function salvarMetasGrupoConfig(e) {
  E.preventDefault();
  Const currentTx = transactions.filter(t => t.month === activeMonth);
  Const income = currentTx.filter(t => (t.cat === 'Salário' || t.cat === 'Renda Extra' || t.type === 'INCOME') && t.confirmado === true).reduce((s, t) => s + t.amount, 0);
  Const baseEntradas = income > 0 ? income : 1;

  Let fixosInput = document.getElementById('cfgMetaFixos').value;
  Let geraisInput = document.getElementById('cfgMetaGerais').value;
  Let lazerInput = document.getElementById('cfgMetaLazer').value;
  Let investInput = document.getElementById('cfgMetaInvest').value;

  Const errorDiv = document.getElementById('metaConfigErrorMsg');

  If (fixosInput === '' || geraisInput === '' || lazerInput === '' || investInput === '') {
    ErrorDiv.innerText = "Preencha obrigatoriamente todos os 4 campos de metas.";
    ErrorDiv.classList.remove('hidden');
    Return;
  }

  Let fixos = parseFloat(fixosInput);
  Let gerais = parseFloat(geraisInput);
  Let lazer = parseFloat(lazerInput);
  Let invest = parseFloat(investInput);

  Let somaCalculada = 0;
  If (modoMetasAtual === 'dinheiro') {
    Const somaDinheiro = fixos + gerais + lazer + invest;
    SomaCalculada = Math.round((somaDinheiro / baseEntradas) * 10000) / 100;
    Fixos = (fixos / baseEntradas) * 100;
    Gerais = (gerais / baseEntradas) * 100;
    Lazer = (lazer / baseEntradas) * 100;
    Invest = (invest / baseEntradas) * 100;
  } else {
    SomaCalculada = Math.round((fixos + gerais + lazer + invest) * 100) / 100;
  }

  If (Math.abs(somaCalculada - 100) > 0.1) {
    ErrorDiv.innerText = `A soma total das metas deve ser exatamente 100%. Atualmente está em ${somaCalculada.toFixed(1)}%.`;
    ErrorDiv.classList.remove('hidden');
    Return;
  }

  ErrorDiv.classList.add('hidden');

  Try {
    Const novasMetas = { fixos, gerais, lazer, invest };
    Await db.collection('users').doc(currentUser.id).update({ metas: novasMetas });
    CurrentWorkspace.metas = novasMetas;

    CloseProfileModal();
    RenderAll();
    Alert("Metas atualizadas com sucesso!");
  } catch (err) {
    Alert("Erro ao salvar metas.");
  }
}

Async function deixarGrupo() {
  Try {
    Const wsIdAtual = currentWorkspace.id;
    Const uidAtual = currentUser.id;

    Const membrosSnapshot = await db.collection('users').where('workspaceId', '==', wsIdAtual).get();
    Const éOUltimo = membrosSnapshot.size <= 1;

    If (éOUltimo) {
      Const confirmacao = confirm("Atenção: Você é o último utilizador deste grupo. Se sair, todos os dados financeiros e recados do mural serão apagados permanentemente. Deseja continuar?");
      If (!confirmacao) return;
    } else {
      Const confirmacao = confirm("Tem certeza que deseja sair deste grupo?");
      If (!confirmacao) return;
    }

    Await db.collection('users').doc(uidAtual).update({
      WorkspaceId: firebase.firestore.FieldValue.delete(),
      WorkspaceCode: firebase.firestore.FieldValue.delete(),
      Metas: firebase.firestore.FieldValue.delete()
    });

    If (éOUltimo) {
      Const batch = db.batch();
      Const txsQuery = await db.collection('transacoes').where('workspaceId', '==', wsIdAtual).get();
      TxsQuery.forEach(doc => batch.delete(doc.ref));

      Const lousaQuery = await db.collection('lousa').where('workspaceId', '==', wsIdAtual).get();
      LousaQuery.forEach(doc => batch.delete(doc.ref));

      Await batch.commit();
    }

    Alert("Você saiu do grupo com sucesso.");
    Window.location.reload();
  } catch (err) {
    Console.error(err);
    Alert("Erro ao tentar deixar o grupo. Tente novamente.");
  }
}

Async function criarNovoWorkspace() {
  Try {
    MostrarSetupMsg("A gerar novo grupo...", "info");
    Let novoCodigo = '';
    Let codigoExiste = true;
    Let tentativas = 0;

    While (codigoExiste && tentativas < 10) {
      NovoCodigo = Math.floor(1000 + Math.random() * 9000).toString();
      Const checkQuery = await db.collection('users').where('workspaceCode', '==', novoCodigo).get();
      If (checkQuery.empty) {
        CodigoExiste = false;
      }
      Tentativas++;
    }

    Const workspaceId = 'ws_' + currentUser.id;
    Const metasPadrao = { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

    Await db.collection('users').doc(currentUser.id).set({
      WorkspaceId: workspaceId,
      WorkspaceCode: novoCodigo,
      Metas: metasPadrao,
      Email: currentUser.email,
      Status: 'approved'
    }, { merge: true });

    CurrentWorkspace.id = workspaceId;
    CurrentWorkspace.code = novoCodigo;
    CurrentWorkspace.metas = metasPadrao;

    Document.getElementById('setupWorkspaceModal').classList.add('hidden');
    initUserSession();
  } catch (err) {
    Console.error("Erro detalhado ao criar grupo:", err);
    MostrarSetupMsg("Erro: " + (err.message || "Tente novamente."), "erro");
  }
}

Async function entrarGrupoExistente() {
  Const codigoInput = document.getElementById('inputWorkspaceCode').value.trim();
  If (!codigoInput || codigoInput.length < 4) {
    MostrarSetupMsg("Digite um código válido de 4 dígitos.", "erro");
    Return;
  }

  Try {
    MostrarSetupMsg("A procurar grupo...", "info");
    Const wsQuery = await db.collection('users').where('workspaceCode', '==', codigoInput).get();

    If (wsQuery.empty) {
      MostrarSetupMsg("Código de grupo não encontrado. Verifique com o seu familiar/sócio.", "erro");
      Return;
    }

    Const wsData = wsQuery.docs[0].data();
    Const targetWorkspaceId = wsData.workspaceId;
    Const metasGrupo = wsData.metas || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

    Await db.collection('users').doc(currentUser.id).set({
      WorkspaceId: targetWorkspaceId,
      WorkspaceCode: codigoInput,
      Metas: metasGrupo,
      Email: currentUser.email,
      Status: 'approved'
    }, { merge: true });

    CurrentWorkspace.id = targetWorkspaceId;
    CurrentWorkspace.code = codigoInput;
    CurrentWorkspace.metas = metasGrupo;

    Document.getElementById('setupWorkspaceModal').classList.add('hidden');
    initUserSession();
  } catch (err) {
    Console.error("Erro detalhado ao entrar no grupo:", err);
    MostrarSetupMsg("Erro: " + (err.message || "Tente novamente."), "erro");
  }
}

Function mostrarSetupMsg(texto, tipo) {
  Const div = document.getElementById('setupMsg');
  Div.className = `text-xs font-semibold text-center p-2 rounded-xl block mt-2 ${
    Tipo === 'erro' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
  }`;
  Div.innerText = texto;
  Div.classList.remove('hidden');
}

Function initUserSession() {
  Document.getElementById('selectMonth').value = activeMonth;

  Document.getElementById('headerUserName').innerText = currentUser.name;
  Document.getElementById('headerWelcomeMsg').innerText = `Grupo: ${currentWorkspace.code}`;
  Document.getElementById('profileWorkspaceCodeDisplay').innerText = currentWorkspace.code;

  RenderAll();
  carregarDadosDoBanco();
  carregarMembrosDoGrupo();
  ouvinteLousaGrupo();
}

Async function carregarMembrosDoGrupo() {
  Const containerMembros = document.getElementById('workspaceMembersList');
  Const selectFiltroMembro = document.getElementById('filterMember');
  If (!containerMembros || !currentWorkspace.id) return;

  Try {
    Const membrosSnapshot = await db.collection('users').where('workspaceId', '==', currentWorkspace.id).get();
    ContainerMembros.innerHTML = '';
    If (selectFiltroMembro) {
      SelectFiltroMembro.innerHTML = `<option value="">👤 Todos os Membros</option>`;
    }

    If (membrosSnapshot.empty) {
      ContainerMembros.innerHTML = `<div class="text-slate-400 text-center py-1">Nenhum membro encontrado.</div>`;
      Return;
    }

    MembrosSnapshot.forEach(doc => {
      Const dadosMembro = doc.data();
      Const emailMembro = dadosMembro.email || 'Utilizador';
      Const nomeMembro = emailMembro.split('@')[0];
      Const ehVoce = emailMembro === currentUser.email ? ' (Você)' : '';

      ContainerMembros.innerHTML += `
        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
          <span class="font-bold text-slate-700 truncate text-[11px]"><i class="fa-solid fa-user-circle text-blue-500 mr-1.5"></i>${emailMembro}${ehVoce}</span>
          <span class="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold">Ativo</span>
        </div>
      `;

      If (selectFiltroMembro) {
        SelectFiltroMembro.innerHTML += `<option value="${emailMembro}">${nomeMembro}</option>`;
      }
    });
  } catch (err) {
    ContainerMembros.innerHTML = `<div class="text-rose-500 text-center py-1">Erro ao carregar membros.</div>`;
  }
}

Function atualizarContador(input) {
  Const restantes = 25 - input.value.length;
  Document.getElementById('charCount').innerText = `${restantes} restantes`;
}

Function ouvinteLousaGrupo() {
  If (!currentWorkspace.id) return;
  Db.collection('lousa')
    .where('workspaceId', '==', currentWorkspace.id)
    .onSnapshot((snapshot) => {
      Const lousaConteudo = document.getElementById('lousaConteudo');
      Const lousaAutorContainer = document.getElementById('lousaAutorContainer');
      Const lousaAutorNome = document.getElementById('lousaAutorNome');
      Const btnLimparLousa = document.getElementById('btnLimparLousa');

      If (snapshot.empty) {
        LousaDocId = null;
        LousaConteudo.innerHTML = `<p class="text-xs text-slate-500 italic">Mural limpo. Escreva um recado!</p>`;
        LousaAutorContainer.classList.add('hidden');
        BtnLimparLousa.classList.add('hidden');
        Return;
      }

      Const docLousa = snapshot.docs[0];
      LousaDocId = docLousa.id;
      Const dados = docLousa.data();
      Const autor = dados.userEmail ? dados.userEmail.split('@')[0] : 'Membro';

      LousaConteudo.innerHTML = `
        <div class="py-4 bg-white/90 backdrop-blur-xs rounded-2xl p-4 shadow-sm border border-slate-200 inline-block max-w-full">
          <p class="text-xl sm:text-2xl font-extrabold tracking-wide text-slate-900 fonte-manuscrita break-words">"${dados.texto}"</p>
        </div>
      `;
      
      LousaAutorNome.innerText = autor;
      LousaAutorContainer.classList.remove('hidden');
      BtnLimparLousa.classList.remove('hidden');
    });
}

Async function escreverNaLousa(e) {
  E.preventDefault();
  Const input = document.getElementById('inputLousaTexto');
  Const texto = input.value.trim();

  If (!texto || texto.length > 25) {
    Alert("O recado deve ter no máximo 25 caracteres.");
    Return;
  }

  If (!currentWorkspace.id) {
    Alert("Erro de segurança: Utilizador sem grupo válido.");
    Return;
  }

  Try {
    If (lousaDocId) {
      Await db.collection('lousa').doc(lousaDocId).update({
        Texto: texto,
        UserId: currentUser.id,
        UserEmail: currentUser.email,
        UpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      Await db.collection('lousa').add({
        WorkspaceId: currentWorkspace.id,
        UserId: currentUser.id,
        UserEmail: currentUser.email,
        Texto: texto,
        CreatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    Input.value = '';
    Document.getElementById('charCount').innerText = '25 restantes';
  } catch (err) {
    Alert("Erro ao escrever na lousa.");
  }
}

Async function apagarLousa() {
  If (!lousaDocId) return;
  Const confirmacao = confirm("Deseja limpar o mural para que outro membro possa escrever?");
  If (!confirmacao) return;

  Try {
    Await db.collection('lousa').doc(lousaDocId).delete();
    LousaDocId = null;
  } catch (err) {
    Alert("Erro ao limpar a lousa.");
  }
}

Function carregarDadosDoBanco() {
  If (!currentWorkspace.id) return;
  Db.collection('transacoes')
    .where('workspaceId', '==', currentWorkspace.id)
    .onSnapshot((snapshot) => {
      Transactions = [];
      Snapshot.forEach((doc) => {
        Transactions.push({ id: doc.id, ...doc.data() });
      });
      RenderAll();
    });
}

Async function handleSaveTransaction(e) {
  E.preventDefault();
  Const radioChecked = document.querySelector('input[name="txType"]:checked');
  Const type = radioChecked ? radioChecked.value : 'EXPENSE';
  Const desc = document.getElementById('txDesc').value.trim();
  Const amount = parseFloat(document.getElementById('txAmount').value);
  Const date = document.getElementById('txDate').value;
  Const cat = document.getElementById('txCat').value;

  Const newTx = {
    Desc, amount, type, cat,
    UserId: currentUser.id,
    UserEmail: currentUser.email,
    WorkspaceId: currentWorkspace.id,
    Month: activeMonth,
    Date,
    Confirmado: false
  };

  Await db.collection('transacoes').add(newTx);
  CloseNewTxModal();
  Document.getElementById('txForm').reset();
}

Async function alternarConfirmacaoTx(id, estadoAtual) {
  Try {
    Await db.collection('transacoes').doc(id).update({
      Confirmado: !estadoAtual
    });
  } catch (err) {
    Alert("Erro ao alterar o estado de confirmação.");
  }
}

Async function deleteTransaction(id) {
  If (confirm("Deseja remover este lançamento?")) {
    Await db.collection('transacoes').doc(id).delete();
  }
}

Function changeActiveMonth(m) {
  ActiveMonth = m;
  RenderAll();
}

Function selecionarTipoTx(tipo) {
  Const radio = document.querySelector(`input[name="txType"][value="${tipo}"]`);
  If (radio) {
    Radio.checked = true;
    ToggleTxTypeUI();
  }
}

Function toggleTxTypeUI() {
  Const radioEntrada = document.querySelector('input[name="txType"][value="INCOME"]');
  Const labelEntrada = document.getElementById('labelTabEntrada');
  Const labelSaida = document.getElementById('labelTabSaida');

  If (radioEntrada && radioEntrada.checked) {
    If (labelEntrada) labelEntrada.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer bg-white text-emerald-600 shadow-2xs transition";
    If (labelSaida) labelSaida.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer text-slate-500 transition";
  } else {
    If (labelSaida) labelSaida.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer bg-white text-rose-600 shadow-2xs transition";
    If (labelEntrada) labelEntrada.className = "w-1/2 text-center py-2 text-xs font-extrabold rounded-lg cursor-pointer text-slate-500 transition";
  }
}

Function renderAll() {
  Const currentTx = transactions.filter(t => t.month === activeMonth);
  Const txConfirmadas = currentTx.filter(t => t.confirmado === true);

  // Considera tanto o tipo INCOME quanto as categorias de Salário e Renda Extra como entradas
  Const income = txConfirmadas.filter(t => t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra').reduce((s, t) => s + t.amount, 0);
  Const expense = txConfirmadas.filter(t => t.type === 'EXPENSE' && t.cat !== 'Salário' && t.cat !== 'Renda Extra').reduce((s, t) => s + t.amount, 0);
  Const balance = income - expense;

  Const statIncome = document.getElementById('statIncome');
  Const statExpense = document.getElementById('statExpense');
  Const statBalance = document.getElementById('statBalance');

  If (statIncome) statIncome.innerText = `R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  If (statExpense) statExpense.innerText = `R$ ${expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  If (statBalance) statBalance.innerText = `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  Const fixed = txConfirmadas.filter(t => t.cat === 'Gastos Fixos' && t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
  Const general = txConfirmadas.filter(t => t.cat === 'Gastos Gerais' && t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
  Const leisure = txConfirmadas.filter(t => t.cat === 'Lazer' && t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
  Const invest = txConfirmadas.filter(t => t.cat === 'Investimentos' && t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);

  Const metas = currentWorkspace.metas || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };

  Const baseEntradas = income > 0 ? income : 1; 
  Const metaFixosVal = baseEntradas * (metas.fixos / 100);
  Const metaGeraisVal = baseEntradas * (metas.gerais / 100);
  Const metaLazerVal = baseEntradas * (metas.lazer / 100);
  Const metaInvestVal = baseEntradas * (metas.invest / 100);

  Const gerarBarraProgressoEStatus = (gasto, meta) => {
    If (meta <= 0) return { html: `<div class="w-full bg-slate-200 h-1.5 rounded-full mt-1"></div>`, texto: `<span class="text-[9px] text-slate-400 font-semibold">Sem renda cadastrada</span>` };
    
    Const pctGasto = (gasto / meta) * 100;
    Const larguraVerde = Math.min(pctGasto, 100);
    Let larguraVermelha = 0;
    If (pctGasto > 100) {
      LarguraVermelha = Math.min(pctGasto - 100, 100);
    }

    Const diferenca = meta - gasto;
    Let textoStatus = '';
    If (diferenca >= 0) {
      TextoStatus = `<span class="text-[9px] text-emerald-600 font-bold">Faltam R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`;
    } else {
      TextoStatus = `<span class="text-[9px] text-rose-600 font-bold">Passou R$ ${Math.abs(diferenca).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`;
    }

    Const htmlBarra = `
      <div class="w-full bg-slate-200 h-1.5 rounded-full mt-1 relative overflow-hidden flex">
        <div class="bg-emerald-500 h-full transition-all duration-300" style="width: ${larguraVerde}%"></div>
        <div class="bg-rose-600 h-full transition-all duration-300" style="width: ${larguraVermelha}%"></div>
      </div>
    `;

    Return { html: htmlBarra, texto: textoStatus };
  };

  Const resFixos = gerarBarraProgressoEStatus(fixed, metaFixosVal);
  Const resGerais = gerarBarraProgressoEStatus(general, metaGeraisVal);
  Const resLazer = gerarBarraProgressoEStatus(leisure, metaLazerVal);
  Const resInvest = gerarBarraProgressoEStatus(invest, metaInvestVal);

  Const containerCat = document.getElementById('cardsCategoryContainer');
  If (containerCat) {
    ContainerCat.innerHTML = `
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

  RenderTransactionsList(currentTx);
  renderInvestments(currentTx);
  renderCharts(fixed, general, leisure, invest);
}

Function renderCharts(fixed, general, leisure, invest) {
  Const ctxPie = document.getElementById('categoryPieChart');
  If (ctxPie) {
    If (categoryPieChartInstance) categoryPieChartInstance.destroy();
    CategoryPieChartInstance = new Chart(ctxPie, {
      Type: 'doughnut',
      Data: {
        Labels: ['Fixos', 'Gerais', 'Lazer', 'Invest'],
        Datasets: [{
          Data: [fixed, general, leisure, invest],
          BackgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
          BorderWidth: 0
        }]
      },
      Options: {
        Responsive: true,
        MaintainAspectRatio: false,
        Layout: { padding: 2 },
        Plugins: { 
          Legend: { 
            Position: 'bottom', 
            Labels: { boxWidth: 8, font: { size: 9 }, padding: 8, usePointStyle: true } 
          } 
        }
      }
    });
  }

  Const ctxBar = document.getElementById('categoryBarChart');
  If (ctxBar) {
    If (categoryBarChartInstance) categoryBarChartInstance.destroy();
    CategoryBarChartInstance = new Chart(ctxBar, {
      Type: 'bar',
      Data: {
        Labels: ['Fixos', 'Gerais', 'Lazer', 'Invest'],
        Datasets: [{
          Label: 'Gasto (R$)',
          Data: [fixed, general, leisure, invest],
          BackgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
          BorderRadius: 4
        }]
      },
      Options: {
        Responsive: true,
        MaintainAspectRatio: false,
        Plugins: { legend: { display: false } },
        Scales: {
          Y: { beginAtZero: true, ticks: { font: { size: 9 }, callback: val => 'R$ ' + val } },
          X: { grid: { display: false }, ticks: { font: { size: 9 } } }
        }
      }
    });
  }
}

Function renderTransactionsList(currentTx) {
  Const container = document.getElementById('txListContainer');
  If (!container) return;

  Const search = (document.getElementById('searchExpense')?.value || '').toLowerCase();
  Const filtroMembro = document.getElementById('filterMember')?.value || '';
  Const filtroCat = document.getElementById('filterCategory')?.value || '';

  Container.innerHTML = '';
  
  Const filtered = currentTx.filter(t => {
    Const matchSearch = t.desc.toLowerCase().includes(search) || t.cat.toLowerCase().includes(search);
    Const matchMembro = filtroMembro === '' || t.userEmail === filtroMembro;
    Const matchCat = filtroCat === '' || t.cat === filtroCat;
    Return matchSearch && matchMembro && matchCat;
  });

  If (filtered.length === 0) {
    Container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Nenhuma movimentação encontrada neste mês com estes filtros.</div>`;
    Return;
  }

  Filtered.forEach(t => {
    Const isIncome = t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra';
    Const autorNome = t.userEmail ? t.userEmail.split('@')[0] : 'Membro';
    Const isConfirmed = t.confirmado === true;

    Container.innerHTML += `
      <div class="flex items-center justify-between bg-white p-3.5 rounded-2xl border ${isConfirmed ? 'border-slate-200' : 'border-amber-300 bg-amber-50/30'} shadow-2xs">
        <div>
          <div class="text-xs font-extrabold text-slate-900">${t.desc} 
            <span class="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">${t.cat}</span>
            <span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold ml-1"><i class="fa-solid fa-user text-[8px] mr-0.5"></i>${autorNome}</span>
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
            <span><i class="fa-regular fa-calendar mr-1"></i>${t.date}</span>
            ${!isConfirmed ? '<span class="text-[9px] text-amber-700 font-extrabold bg-amber-100 px-1.5 py-0.2 rounded">Pendente</span>' : '<span class="text-[9px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.2 rounded">Confirmado</span>'}
          </div>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="text-xs font-black ${isIncome ? 'text-emerald-600' : 'text-slate-900'}">
            ${isIncome ? '+' : '-'} R$ ${Number(t.amount).toFixed(2).replace('.', ',')}
          </span>
          
          ${!isConfirmed ? `
            <button onclick="alternarConfirmacaoTx('${t.id}', false)" title="Confirmar lançamento" class="px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-amber-500 text-white hover:bg-amber-600 animate-pulse transition shadow-2xs">
              Confirmar
            </button>
          ` : ''}

          <button onclick="deleteTransaction('${t.id}')" class="text-slate-400 hover:text-rose-600 p-1" title="Excluir"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>
      </div>
    `;
  });
}

Function renderInvestments(currentTx) {
  Const investConfirmadosMes = currentTx.filter(t => t.cat === 'Investimentos' && t.confirmado === true);
  Const totalMes = investConfirmadosMes.reduce((s, t) => s + t.amount, 0);

  Const monthInvestEl = document.getElementById('monthInvestTotalHeader');
  If (monthInvestEl) monthInvestEl.innerText = `R$ ${totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  Const totalYearInvested = transactions
    .filter(t => t.cat === 'Investimentos' && t.type === 'EXPENSE' && t.confirmado === true && (t.month.includes('2026') || (t.date && t.date.startsWith('2026'))))
    .reduce((sum, t) => sum + t.amount, 0);

  Const yearHeader = document.getElementById('yearInvestTotalHeader');
  If (yearHeader) {
    YearHeader.innerText = `R$ ${totalYearInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }

  Const investList = document.getElementById('monthInvestmentsList');
  If (!investList) return;

  Const invests = currentTx.filter(t => t.cat === 'Investimentos');

  If (invests.length === 0) {
    InvestList.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Nenhum aporte registrado neste mês.</div>`;
    Return;
  }

  InvestList.innerHTML = '';
  Invests.forEach(t => {
    Const isConfirmed = t.confirmado === true;
    InvestList.innerHTML += `
      <div class="flex items-center justify-between bg-white p-3 rounded-2xl border ${isConfirmed ? 'border-slate-200' : 'border-amber-300 bg-amber-50/30'} shadow-2xs">
        <div>
          <div class="text-xs font-extrabold text-slate-900">${t.desc}</div>
          <div class="text-[10px] text-slate-500">${t.date} ${!isConfirmed ? '• <span class="text-amber-700 font-bold">Pendente</span>' : ''}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-black text-emerald-600">R$ ${Number(t.amount).toFixed(2).replace('.', ',')}</span>
          ${!isConfirmed ? `
            <button onclick="alternarConfirmacaoTx('${t.id}', false)" class="px-2 py-0.5 rounded-lg text-[9px] font-extrabold bg-amber-500 text-white animate-pulse">Confirmar</button>
          ` : ''}
          <button onclick="deleteTransaction('${t.id}')" class="text-slate-400 hover:text-rose-600 p-1"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>
      </div>
    `;
  });
}

Function switchTab(tab) {
  ['resumo', 'extrato', 'invest', 'mural'].forEach(t => {
    Const el = document.getElementById(`tab-${t}`);
    If (el) el.classList.add('hidden');
  });

  Const activeEl = document.getElementById(`tab-${tab}`);
  If (activeEl) activeEl.classList.remove('hidden');

  ['resumo', 'extrato', 'invest', 'mural'].forEach(name => {
    Const btn = document.getElementById(`bottomNav${name.charAt(0).toUpperCase() + name.slice(1)}`);
    If (btn) {
      Btn.className = name === tab ? 'flex flex-col items-center justify-center text-blue-600 transition active:scale-95 py-0.5' : 'flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95 py-0.5';
    }
  });

  If (tab === 'extrato') renderTransactionsList(transactions.filter(t => t.month === activeMonth));
  If (tab === 'resumo') renderAll();
}

Function openNewTxModal() { 
  Const txDate = document.getElementById('txDate');
  If (txDate) txDate.value = new Date().toISOString().split('T')[0];
  ToggleTxTypeUI();
  Document.getElementById('newTxModal').classList.remove('hidden'); 
}
function closeNewTxModal() { document.getElementById('newTxModal').classList.add('hidden'); }
function copyWorkspaceCountCode() { navigator.clipboard.writeText(currentWorkspace.code).then(() => alert(`Código ${currentWorkspace.code} copiado com sucesso!`)); }
function logout() { auth.signOut().then(() => window.location.href = 'index.html'); }
