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

let currentWorkspace = { id: '', code: '', metasPorMes: {}, cartoes: [] };
let currentUser = { id: '', name: '', email: '' };
let transactions = [];
const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const agora = new Date();
let activeMonth = `${mesesNomes[agora.getMonth()]} ${agora.getFullYear()}`;
let showBigBalance = false; 

// ==========================================
// SISTEMA DE NOTIFICAÇÕES MODERNAS (TOASTS & MODAIS)
// ==========================================

function showToast(msg, tipo = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const cores = {
    success: 'bg-emerald-600 text-white border-emerald-500',
    error: 'bg-rose-600 text-white border-rose-500',
    info: 'bg-slate-800 text-white border-slate-700'
  };
  const icones = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  toast.className = `toast-enter flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-extrabold pointer-events-auto ${cores[tipo] || cores.info}`;
  toast.innerHTML = `<i class="fa-solid ${icones[tipo] || icones.info} text-sm shrink-0"></i><span class="leading-tight">${msg}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -15px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function showConfirmDialog({ title, text, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false, extraButton = null }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customConfirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const textEl = document.getElementById('confirmModalText');
    const iconEl = document.getElementById('confirmModalIcon');
    const btnsEl = document.getElementById('confirmModalButtons');

    titleEl.innerText = title;
    textEl.innerText = text;
    iconEl.className = isDanger 
      ? 'w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl'
      : 'w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl';
    iconEl.innerHTML = isDanger ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-circle-question"></i>';

    btnsEl.innerHTML = '';

    const btnConfirm = document.createElement('button');
    btnConfirm.className = `w-full py-3 rounded-xl text-xs font-extrabold text-white transition ${isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-green hover:bg-emerald-600'}`;
    btnConfirm.innerText = confirmText;
    btnConfirm.onclick = () => { modal.classList.add('hidden'); resolve('confirm'); };
    btnsEl.appendChild(btnConfirm);

    if (extraButton) {
      const btnExtra = document.createElement('button');
      btnExtra.className = 'w-full py-3 rounded-xl text-xs font-extrabold bg-amber-100 text-amber-800 hover:bg-amber-200 transition';
      btnExtra.innerText = extraButton;
      btnExtra.onclick = () => { modal.classList.add('hidden'); resolve('extra'); };
      btnsEl.appendChild(btnExtra);
    }

    const btnCancel = document.createElement('button');
    btnCancel.className = 'w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition';
    btnCancel.innerText = cancelText;
    btnCancel.onclick = () => { modal.classList.add('hidden'); resolve('cancel'); };
    btnsEl.appendChild(btnCancel);

    modal.classList.remove('hidden');
  });
}

// ==========================================
// BANCO DE DICAS E MENSAGENS DIÁRIAS (60 FRASES)
// ==========================================

const mensagensDiarias = [
  { titulo: "Dia de planejar!", subtitulo: "O primeiro passo para o sucesso é o planejamento." },
  { titulo: "Pequenos passos", subtitulo: "Cada economia conta para sua meta maior." },
  { titulo: "Foco no futuro", subtitulo: "Invista hoje para colher amanhã." },
  { titulo: "Você no controle!", subtitulo: "Organização é a chave para a liberdade." },
  { titulo: "Dia de revisar", subtitulo: "Veja se seus gastos estão alinhados com suas metas." },
  { titulo: "Mente milionária", subtitulo: "O segredo é gastar menos do que se ganha." },
  { titulo: "Semana produtiva", subtitulo: "Mantenha o foco e evite compras por impulso." },
  { titulo: "Disciplina é ouro", subtitulo: "Suas escolhas financeiras definem seu futuro." },
  { titulo: "Progresso constante", subtitulo: "Um passo por vez em direção aos seus sonhos." },
  { titulo: "Celebre vitórias", subtitulo: "Atingiu uma meta hoje? Comemore!" },
  { titulo: "Visão além de hoje", subtitulo: "A prosperidade é construída a longo prazo." },
  { titulo: "Controle os impulsos", subtitulo: "A gratificação adiada é um superpoder." },
  { titulo: "Conhecimento é poder", subtitulo: "Quanto mais entende seu dinheiro, mais ele cresce." },
  { titulo: "Equilíbrio financeiro", subtitulo: "Aproveite o hoje sem esquecer de poupar." },
  { titulo: "Orçamento em dia", subtitulo: "Anotar tudo é o que te mantém focado." },
  { titulo: "Aja com sabedoria", subtitulo: "Seu dinheiro é a ferramenta para construir sua vida." },
  { titulo: "Menos é mais", subtitulo: "Reduza o excesso e foque no que importa." },
  { titulo: "Resiliência sempre", subtitulo: "Imprevistos acontecem, reforce a reserva." },
  { titulo: "Você é capaz!", subtitulo: "Qualquer objetivo financeiro é alcançável com tempo." },
  { titulo: "Hábitos enriquecem", subtitulo: "A repetição diária constrói fortunas." },
  { titulo: "Atenção aos detalhes", subtitulo: "Pequenos vazamentos afundam grandes navios." },
  { titulo: "Pense em investir", subtitulo: "Faça seu dinheiro trabalhar por você hoje." },
  { titulo: "Força na reta final", subtitulo: "Mantenha a firmeza para fechar no azul." },
  { titulo: "Educação financeira", subtitulo: "Sempre há algo novo para aprender hoje." },
  { titulo: "Rumo à liberdade", subtitulo: "Cada centavo economizado é um passo a mais." },
  { titulo: "Agradeça sempre", subtitulo: "A gratidão atrai mais prosperidade." },
  { titulo: "Mantenha a rota", subtitulo: "A consistência é o que traz o resultado real." },
  { titulo: "Avalie seus gastos", subtitulo: "O que deu certo? O que pode melhorar?" },
  { titulo: "Mais um passo!", subtitulo: "Parabéns por cuidar bem do seu dinheiro!" },
  { titulo: "Pague-se primeiro", subtitulo: "Guarde uma parte do seu ganho antes de gastar." },
  { titulo: "Regra do 50-30-20", subtitulo: "Uma ótima forma de dividir seu orçamento." },
  { titulo: "Cuidado com o crédito", subtitulo: "Cartão é ferramenta, não extensão do salário." },
  { titulo: "Invista em si mesmo", subtitulo: "O melhor rendimento vem do seu conhecimento." },
  { titulo: "O tempo a seu favor", subtitulo: "Os juros compostos são a oitava maravilha do mundo." },
  { titulo: "Revise assinaturas", subtitulo: "Você realmente usa tudo que paga mensalmente?" },
  { titulo: "Evite dívidas ruins", subtitulo: "Só financie se for para multiplicar capital." },
  { titulo: "Metas claras", subtitulo: "Quem não sabe para onde vai, não chega a lugar nenhum." },
  { titulo: "Dinheiro é energia", subtitulo: "Canalize-o para o que realmente te faz feliz." },
  { titulo: "Diversifique", subtitulo: "Não coloque todos os ovos na mesma cesta." },
  { titulo: "Viva abaixo do limite", subtitulo: "Gaste sempre menos do que você pode pagar." },
  { titulo: "Automatize poupanças", subtitulo: "Facilite o ato de guardar dinheiro." },
  { titulo: "Descontos contam", subtitulo: "Negociar é uma habilidade que gera riqueza." },
  { titulo: "Valorize seu suor", subtitulo: "Pense em quantas horas de trabalho algo custa." },
  { titulo: "Mude a mentalidade", subtitulo: "Pense como investidor, não só como consumidor." },
  { titulo: "Dinheiro não aceita desaforo", subtitulo: "Seja intencional com cada real gasto." },
  { titulo: "Crie novas rendas", subtitulo: "Não dependa de apenas uma fonte de dinheiro." },
  { titulo: "A paciência paga", subtitulo: "Grandes fortunas não nascem da noite para o dia." },
  { titulo: "Seja realista", subtitulo: "Metas impossíveis só geram frustração." },
  { titulo: "Faça listas de compra", subtitulo: "Ir ao mercado com fome e sem lista é perigoso." },
  { titulo: "Você está no caminho", subtitulo: "Apenas continue fazendo o básico bem feito." },
  { titulo: "O poder do não", subtitulo: "Dizer não hoje é dizer sim para o seu futuro." },
  { titulo: "Reveja prioridades", subtitulo: "Onde você gasta mostra o que você valoriza." },
  { titulo: "Elimine os juros", subtitulo: "Quite as dívidas mais caras o quanto antes." },
  { titulo: "Simplifique", subtitulo: "Uma vida financeira simples é uma vida em paz." },
  { titulo: "Foque na solução", subtitulo: "Reclamar não aumenta saldo bancário." },
  { titulo: "Você contra você", subtitulo: "Não compare seus bastidores com o palco dos outros." },
  { titulo: "Cuide da saúde", subtitulo: "Saúde física é o seu maior ativo financeiro." },
  { titulo: "Seja grato", subtitulo: "A abundância começa na mente." },
  { titulo: "Construa o seu império", subtitulo: "Tijolo por tijolo, dia após dia." },
  { titulo: "Amanhã é um novo dia", subtitulo: "Errou no orçamento? Recomece amanhã!" }
];

let currentDicaIndex = 0;
let categoryPieChartInstance = null;
let evolutionBarChartInstance = null;
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
    iniciarMensagemMotivacionalDiaria(); 

  } catch (err) {
    console.error(err);
    document.getElementById('loadingScreen').innerHTML = `<p class="text-xs text-rose-600 font-bold">Erro ao carregar dados. Tente atualizar a página.</p>`;
  }
});

function iniciarMensagemMotivacionalDiaria() {
  const agora = new Date();
  const diaDoAno = Math.floor((agora - new Date(agora.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  currentDicaIndex = diaDoAno % mensagensDiarias.length;
  renderizarDica();
}

function renderizarDica() {
  const msg = mensagensDiarias[currentDicaIndex];
  const tituloEl = document.getElementById('bannerTitulo');
  const subEl = document.getElementById('bannerSubtitulo');
  
  if (tituloEl && subEl) {
    tituloEl.innerText = msg.titulo;
    subEl.innerText = msg.subtitulo;
  }
}

function proximaDica() {
  currentDicaIndex = (currentDicaIndex + 1) % mensagensDiarias.length;
  renderizarDica();
}

function toggleVisibility() {
  showBigBalance = !showBigBalance;
  const icon = document.getElementById('eyeIcon');
  
  if(showBigBalance) {
    icon.className = "fa-solid fa-eye text-[11px]";
  } else {
    icon.className = "fa-solid fa-eye-slash text-[11px] text-white/50";
  }
  
  renderAll(); 
}

// ==========================================
// GESTÃO DE CARTÕES DE CRÉDITO DO GRUPO
// ==========================================

function renderizarCartoesConfig() {
  const lista = document.getElementById('listaCartoesConfig');
  if (!lista) return;

  const cartoes = currentWorkspace.cartoes || [];
  if (cartoes.length === 0) {
    lista.innerHTML = `<p class="text-[10px] text-slate-400 text-center py-1">Nenhum cartão cadastrado (usando padrão).</p>`;
    return;
  }

  lista.innerHTML = '';
  cartoes.forEach((c, idx) => {
    lista.innerHTML += `
      <div class="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700 text-xs">
        <div>
          <span class="font-extrabold text-slate-700 dark:text-slate-200">💳 ${c.nome}</span>
          <span class="text-[10px] text-slate-400 ml-1.5">Fecha dia ${c.fechamento}</span>
        </div>
        <button type="button" onclick="removerCartaoGrupo(${idx})" class="text-slate-400 hover:text-rose-500 p-1"><i class="fa-solid fa-trash-can text-xs"></i></button>
      </div>
    `;
  });
}

async function adicionarCartaoGrupo(e) {
  e.preventDefault();
  const nome = document.getElementById('novoCartaoNome').value.trim();
  const fechamento = parseInt(document.getElementById('novoCartaoFechamento').value, 10);

  if (!nome || isNaN(fechamento) || fechamento < 1 || fechamento > 31) {
    showToast("Informe o nome e um dia de fechamento entre 1 e 31.", "error");
    return;
  }

  const cartoesAtuais = currentWorkspace.cartoes || [];
  if (cartoesAtuais.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
    showToast("Já existe um cartão com esse nome.", "error");
    return;
  }

  cartoesAtuais.push({ nome, fechamento });

  try {
    await db.collection('workspaces').doc(currentWorkspace.id).set({
      cartoes: cartoesAtuais
    }, { merge: true });

    document.getElementById('novoCartaoNome').value = '';
    document.getElementById('novoCartaoFechamento').value = '';
    showToast(`Cartão ${nome} adicionado!`);
  } catch (err) {
    showToast("Erro ao salvar cartão.", "error");
  }
}

async function removerCartaoGrupo(index) {
  const cartoesAtuais = [...(currentWorkspace.cartoes || [])];
  cartoesAtuais.splice(index, 1);

  try {
    await db.collection('workspaces').doc(currentWorkspace.id).set({
      cartoes: cartoesAtuais
    }, { merge: true });
    showToast("Cartão removido.");
  } catch (err) {
    showToast("Erro ao remover cartão.", "error");
  }
}

function atualizarOpcoesPagamentoFiltro() {
  const selectFiltro = document.getElementById('filterPaymentMethod');
  if (!selectFiltro) return;

  const valorAtual = selectFiltro.value;
  let html = `
    <option value="">Todos</option>
    <option value="PIX">⚡ PIX</option>
    <option value="Cartão de Crédito">💳 Cartão (Geral)</option>
  `;

  (currentWorkspace.cartoes || []).forEach(c => {
    html += `<option value="Cartão: ${c.nome}">💳 ${c.nome}</option>`;
  });

  html += `<option value="Outros">🔄 Outros</option>`;
  selectFiltro.innerHTML = html;
  selectFiltro.value = valorAtual;
}

// ==========================================
// METAS E PERFIL
// ==========================================

function getMetasAtuais() {
  if (!currentWorkspace.metasPorMes) currentWorkspace.metasPorMes = {};
  return currentWorkspace.metasPorMes[activeMonth] || { fixos: 50, gerais: 30, lazer: 10, invest: 10 };
}

function openProfileModal() {
  document.getElementById('profileModal').classList.remove('hidden');
  const labelMesModal = document.getElementById('labelModalMetasMes');
  if (labelMesModal) labelMesModal.innerText = `Definir Metas (${activeMonth})`;
  renderizarCartoesConfig();
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
    btnPerc.className = "px-3 py-1 text-[10px] font-bold rounded-md bg-brand-green text-white transition";
    btnDinheiro.className = "px-3 py-1 text-[10px] font-bold rounded-md text-slate-600 dark:text-slate-300 transition";
  } else {
    btnDinheiro.className = "px-3 py-1 text-[10px] font-bold rounded-md bg-brand-green text-white transition";
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
    showToast(`Metas de ${activeMonth} atualizadas!`);
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar metas.", "error");
  }
}

async function deixarGrupo() {
  try {
    const wsIdAtual = currentWorkspace.id;
    const uidAtual = currentUser.id;

    const membrosSnapshot = await db.collection('users').where('workspaceId', '==', wsIdAtual).get();
    const éOUltimo = membrosSnapshot.size <= 1;

    const resp = await showConfirmDialog({
      title: éOUltimo ? 'Apagar Grupo?' : 'Sair do Grupo?',
      text: éOUltimo 
        ? 'Você é o último membro. Se sair, todos os dados financeiros deste grupo serão apagados permanentemente.'
        : 'Tem certeza que deseja sair deste grupo compartilhado?',
      confirmText: 'Sim, Sair',
      isDanger: true
    });

    if (resp !== 'confirm') return;

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

    showToast("Você saiu do grupo.");
    setTimeout(() => window.location.reload(), 800);
  } catch (err) {
    console.error(err);
    showToast("Erro ao tentar deixar o grupo.", "error");
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
      cartoes: [],
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

    await db.collection('users').doc(currentUser.id).set({
      workspaceId: targetWorkspaceId,
      workspaceCode: codigoInput,
      email: currentUser.email,
      status: 'approved'
    }, { merge: true });

    currentWorkspace.id = targetWorkspaceId;
    currentWorkspace.code = codigoInput;
    currentWorkspace.metasPorMes = wsData.metasPorMes || {};
    currentWorkspace.cartoes = wsData.cartoes || [];

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

const subcategoriasDisponiveis = [
  'Transporte',
  'Alimentação',
  'Telefonia',
  'Ticket Alimentação',
  'Serviços Públicos',
  'Outros'
];

function renderSubCatCheckboxes() {
  const container = document.getElementById('filterSubCatCheckboxes');
  if (!container) return;
  container.innerHTML = '';
  subcategoriasDisponiveis.forEach(sub => {
    container.innerHTML += `
      <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
        <input type="checkbox" value="${sub}" onchange="renderTransactionsList(transactions)" class="subcat-filter-checkbox rounded text-brand-green focus:ring-0 w-3.5 h-3.5" />
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
        if (data.metasPorMes) currentWorkspace.metasPorMes = data.metasPorMes;
        currentWorkspace.cartoes = data.cartoes || [];
        renderizarCartoesConfig();
        atualizarOpcoesPagamentoFiltro();
        renderAll();
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
      selectFiltroMembro.innerHTML = `<option value="">Todos</option>`;
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

// ==========================================
// LANÇAMENTOS (NOVO, EDIÇÃO, PARCELAS E RECORRÊNCIA)
// ==========================================

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

  const recEl = document.getElementById('txRecorrente');
  if (recEl) recEl.checked = false;

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

  // Esconde opção de assinatura ao editar
  const containerRec = document.getElementById('containerRecorrencia');
  if (containerRec) containerRec.classList.add('hidden');

  setTimeout(() => {
    document.getElementById('txCat').value = tx.cat;
  }, 50);

  document.getElementById('newTxModal').classList.remove('hidden');
}

function closeNewTxModal() { 
  document.getElementById('newTxModal').classList.add('hidden'); 
  editingTxId = null;
}

function isMetodoCartao(metodo) {
  return metodo === 'Cartão de Crédito' || metodo.startsWith('Cartão: ');
}

function toggleParcelasUI() {
  const paymentMethod = document.getElementById('txPaymentMethod').value;
  const container = document.getElementById('containerParcelas');
  const avisoEl = document.getElementById('avisoFechamentoCartao');
  const recEl = document.getElementById('txRecorrente');

  if (isMetodoCartao(paymentMethod)) {
    container.classList.remove('hidden');
    if (recEl && recEl.checked) {
      recEl.checked = false; // Evita conflito entre parcelado e assinatura
    }

    // Verifica se o cartão tem dia de fechamento configurado
    if (paymentMethod.startsWith('Cartão: ')) {
      const nomeCartao = paymentMethod.replace('Cartão: ', '');
      const cartaoObj = (currentWorkspace.cartoes || []).find(c => c.nome === nomeCartao);
      const dateStr = document.getElementById('txDate').value;
      if (cartaoObj && dateStr) {
        const diaCompra = parseInt(dateStr.split('-')[2], 10);
        if (diaCompra >= cartaoObj.fechamento) {
          avisoEl.innerText = `ℹ️ Fatura fechada (dia ${cartaoObj.fechamento}). A 1ª parcela cairá no próximo mês!`;
          avisoEl.classList.remove('hidden');
        } else {
          avisoEl.innerText = `✓ Fatura aberta (fecha dia ${cartaoObj.fechamento}). Cai neste mês.`;
          avisoEl.classList.remove('hidden');
        }
      } else {
        avisoEl.classList.add('hidden');
      }
    } else {
      avisoEl.classList.add('hidden');
    }
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

function toggleRecorrenciaUI() {
  const recEl = document.getElementById('txRecorrente');
  if (recEl && recEl.checked) {
    const tipoCartaoEl = document.getElementById('txTipoCartao');
    if (tipoCartaoEl && tipoCartaoEl.value === 'Parcelado') {
      tipoCartaoEl.value = 'AVista';
      toggleNumeroParcelas();
    }
  }
}

// Atualiza aviso de fechamento se mudar a data com o modal aberto
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'txDate') {
    toggleParcelasUI();
  }
});

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
  const ehCartao = isMetodoCartao(paymentMethod);
  const ehRecorrente = !editingTxId && type === 'EXPENSE' && document.getElementById('txRecorrente')?.checked;

  const tipoCartao = ehCartao ? document.getElementById('txTipoCartao').value : 'AVista';
  let qtdParcelas = 1;
  if (ehCartao && tipoCartao === 'Parcelado') {
    qtdParcelas = parseInt(document.getElementById('txQtdParcelas').value, 10) || 1;
    if (qtdParcelas < 1) qtdParcelas = 1;
  }

  const partesData = dateStr.split('-');
  let anoBase = parseInt(partesData[0], 10);
  let mesIndexBase = parseInt(partesData[1], 10) - 1;
  const diaOriginal = partesData[2] || '01';
  const diaNum = parseInt(diaOriginal, 10);

  // Lógica de deslocamento de fatura fechada do cartão
  let offsetMesFatura = 0;
  if (!editingTxId && paymentMethod.startsWith('Cartão: ')) {
    const nomeCartao = paymentMethod.replace('Cartão: ', '');
    const cartaoObj = (currentWorkspace.cartoes || []).find(c => c.nome === nomeCartao);
    if (cartaoObj && diaNum >= cartaoObj.fechamento) {
      offsetMesFatura = 1;
    }
  }

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
      showToast("Lançamento atualizado!");
    } else if (ehRecorrente) {
      // Gera 12 meses de assinatura com o valor integral em cada mês
      const groupId = 'ass_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      for (let i = 0; i < 12; i++) {
        let mesCalculadoIndex = mesIndexBase + offsetMesFatura + i;
        let anoCalculado = anoBase + Math.floor(mesCalculadoIndex / 12);
        mesCalculadoIndex = mesCalculadoIndex % 12;

        const mesStringFinal = `${mesesNomes[mesCalculadoIndex]} ${anoCalculado}`;
        const mesNumStr = String(mesCalculadoIndex + 1).padStart(2, '0');
        const dataParcelaStr = `${anoCalculado}-${mesNumStr}-${diaOriginal}`;

        const novoDocRef = db.collection('transacoes').doc();
        batch.set(novoDocRef, {
          desc: `${descOriginal} (Assinatura)`,
          amount: amountTotal,
          type, cat, subCat, paymentMethod, tipoCartao,
          month: mesStringFinal,
          date: dataParcelaStr,
          confirmado: false,
          parcelaGroupId: groupId,
          userId: currentUser.id,
          userEmail: currentUser.email,
          workspaceId: currentWorkspace.id,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      await batch.commit();
      showToast("Assinatura gerada para os próximos 12 meses!");
    } else {
      const parcelaGroupId = qtdParcelas > 1 ? ('grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)) : null;

      for (let i = 0; i < qtdParcelas; i++) {
        let mesCalculadoIndex = mesIndexBase + offsetMesFatura + i;
        let anoCalculado = anoBase + Math.floor(mesCalculadoIndex / 12);
        mesCalculadoIndex = mesCalculadoIndex % 12;

        const mesStringFinal = `${mesesNomes[mesCalculadoIndex]} ${anoCalculado}`;
        const mesNumStr = String(mesCalculadoIndex + 1).padStart(2, '0');
        const dataParcelaStr = `${anoCalculado}-${mesNumStr}-${diaOriginal}`;

        const valorParcela = Math.round((amountTotal / qtdParcelas) * 100) / 100;
        const descFinal = qtdParcelas > 1 ? `${descOriginal} (${i + 1}/${qtdParcelas})` : descOriginal;

        const novoDocRef = db.collection('transacoes').doc();
        batch.set(novoDocRef, {
          desc: descFinal,
          amount: valorParcela,
          type, cat, subCat, paymentMethod, tipoCartao,
          month: mesStringFinal,
          date: dataParcelaStr,
          confirmado: false,
          parcelaGroupId: parcelaGroupId,
          userId: currentUser.id,
          userEmail: currentUser.email,
          workspaceId: currentWorkspace.id,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      await batch.commit();
      showToast(qtdParcelas > 1 ? `Compra em ${qtdParcelas}x gerada com sucesso!` : "Lançamento guardado!");
    }

    closeNewTxModal();
    document.getElementById('txForm').reset();
    toggleParcelasUI();
    editingTxId = null;

  } catch (err) {
    console.error("Erro ao salvar transação:", err);
    showToast("Erro ao guardar o lançamento.", "error");
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
    showToast(novoStatus ? "Lançamento confirmado!" : "Marcado como pendente.", "info");
  } catch (err) {
    showToast("Erro ao alterar status.", "error");
  }
}

async function confirmarTodosPendentes() {
  const pendentesDoMes = transactions.filter(t => t.month === activeMonth && !t.confirmado);
  if (pendentesDoMes.length === 0) return;

  const resp = await showConfirmDialog({
    title: 'Confirmar Pendentes',
    text: `Deseja marcar todos os ${pendentesDoMes.length} lançamentos pendentes de ${activeMonth} como registados?`,
    confirmText: 'Sim, Confirmar Todos'
  });

  if (resp !== 'confirm') return;

  try {
    const batch = db.batch();
    pendentesDoMes.forEach(t => {
      const ref = db.collection('transacoes').doc(t.id);
      batch.update(ref, {
        confirmado: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    showToast(`${pendentesDoMes.length} lançamentos confirmados!`);
  } catch (err) {
    console.error(err);
    showToast("Erro ao confirmar em lote.", "error");
  }
}

async function deleteTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  if (tx.parcelaGroupId && tx.parcelaGroupId.trim() !== '') {
    const resp = await showConfirmDialog({
      title: 'Lançamento Recorrente / Parcelado',
      text: 'Este item faz parte de uma série mensal. Como deseja excluir?',
      confirmText: 'Apagar TODAS as parcelas/meses',
      extraButton: 'Apagar APENAS este mês',
      isDanger: true
    });

    if (resp === 'confirm') {
      try {
        const batch = db.batch();
        const parcelasQuery = await db.collection('transacoes')
          .where('workspaceId', '==', currentWorkspace.id)
          .where('parcelaGroupId', '==', tx.parcelaGroupId)
          .get();
        parcelasQuery.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        showToast("Série completa removida!");
      } catch (err) {
        showToast("Erro ao remover série.", "error");
      }
    } else if (resp === 'extra') {
      try {
        await db.collection('transacoes').doc(id).delete();
        showToast("Lançamento deste mês removido!");
      } catch (err) {
        showToast("Erro ao remover.", "error");
      }
    }
    return;
  }

  const resp = await showConfirmDialog({
    title: 'Excluir Lançamento',
    text: `Deseja remover "${tx.desc}"?`,
    confirmText: 'Sim, Excluir',
    isDanger: true
  });

  if (resp === 'confirm') {
    try {
      await db.collection('transacoes').doc(id).delete();
      showToast("Lançamento removido!");
    } catch (err) {
      showToast("Erro ao apagar transação.", "error");
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
  const containerRec = document.getElementById('containerRecorrencia');
  const selectPayment = document.getElementById('txPaymentMethod');

  if (!selectCat || !selectPayment) return;

  if (radioEntrada && radioEntrada.checked) {
    if (labelEntrada) labelEntrada.className = "w-1/2 text-center py-2.5 text-xs font-extrabold rounded-[1rem] cursor-pointer bg-white dark:bg-slate-900 text-brand-green shadow-sm transition";
    if (labelSaida) labelSaida.className = "w-1/2 text-center py-2.5 text-xs font-extrabold rounded-[1rem] cursor-pointer text-slate-500 dark:text-slate-400 transition";
    
    if (containerSubCat) containerSubCat.classList.add('hidden');
    if (containerRec) containerRec.classList.add('hidden');

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
    if (labelSaida) labelSaida.className = "w-1/2 text-center py-2.5 text-xs font-extrabold rounded-[1rem] cursor-pointer bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm transition";
    if (labelEntrada) labelEntrada.className = "w-1/2 text-center py-2.5 text-xs font-extrabold rounded-[1rem] cursor-pointer text-slate-500 dark:text-slate-400 transition";
    
    if (containerSubCat) containerSubCat.classList.remove('hidden');
    if (containerRec && !editingTxId) containerRec.classList.remove('hidden');

    let opcoesPagamento = `<option value="PIX">⚡ PIX</option>`;
    const cartoes = currentWorkspace.cartoes || [];
    if (cartoes.length > 0) {
      cartoes.forEach(c => {
        opcoesPagamento += `<option value="Cartão: ${c.nome}">💳 ${c.nome}</option>`;
      });
    } else {
      opcoesPagamento += `<option value="Cartão de Crédito">💳 Cartão de Crédito</option>`;
    }
    opcoesPagamento += `<option value="Outros">🔄 Outros</option>`;
    selectPayment.innerHTML = opcoesPagamento;

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
    showToast(`Os gastos fixos de ${activeMonth} já foram importados.`, "info");
    return;
  }

  const gastosFixosAnteriores = transactions.filter(t => t.month === mesAnteriorStr && t.cat === 'Gastos Fixos');

  if (gastosFixosAnteriores.length === 0) {
    showToast(`Nenhum gasto fixo encontrado em ${mesAnteriorStr}.`, "info");
    return;
  }

  const resp = await showConfirmDialog({
    title: 'Importar Gastos Fixos',
    text: `Deseja importar ${gastosFixosAnteriores.length} gasto(s) fixo(s) de ${mesAnteriorStr} para ${activeMonth}?`,
    confirmText: 'Importar'
  });
  if (resp !== 'confirm') return;

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

      batch.set(novoDocRef, {
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
      });
    });

    await batch.commit();
    showToast(`Gastos fixos importados para ${activeMonth}!`);
    
  } catch (err) {
    console.error("Erro ao importar gastos fixos:", err);
    showToast("Erro ao importar gastos fixos.", "error");
  }
}

// ==========================================
// RENDERIZAÇÃO GERAL E GRÁFICOS
// ==========================================

function renderAll() {
  const currentTxConfirmadas = transactions.filter(t => t.month === activeMonth && t.confirmado);

  const income = currentTxConfirmadas.filter(t => t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra').reduce((s, t) => s + t.amount, 0);
  const expense = currentTxConfirmadas.filter(t => t.type === 'EXPENSE' && t.cat !== 'Salário' && t.cat !== 'Renda Extra').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const statIncome = document.getElementById('statIncome');
  const statExpense = document.getElementById('statExpense');
  const statBigBalance = document.getElementById('statBigBalance');

  if (statIncome) statIncome.innerText = showBigBalance ? `R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '•••••';
  if (statExpense) statExpense.innerText = showBigBalance ? `R$ ${expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '•••••';
  if (statBigBalance) statBigBalance.innerText = showBigBalance ? `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `•••••`;

  const fixed = currentTxConfirmadas.filter(t => t.cat === 'Gastos Fixos').reduce((a, b) => a + b.amount, 0);
  const general = currentTxConfirmadas.filter(t => t.cat === 'Gastos Gerais').reduce((a, b) => a + b.amount, 0);
  const leisure = currentTxConfirmadas.filter(t => t.cat === 'Lazer').reduce((a, b) => a + b.amount, 0);
  const invest = currentTxConfirmadas.filter(t => t.cat === 'Investimentos').reduce((a, b) => a + b.amount, 0);

  const metas = getMetasAtuais();
  const baseEntradas = income > 0 ? income : 1; 

  const criarCardMetaVisualNovo = (titulo, icone, corBgIcon, corTextoIcon, corBarra, gasto, pctMeta, extraClass = 'rounded-[1rem]') => {
    const metaEmReais = baseEntradas * (pctMeta / 100);
    const pctGasto = metaEmReais > 0 ? (gasto / metaEmReais) * 100 : 0;
    const barraPreenchida = Math.min(pctGasto, 100);
    
    const txtGasto = showBigBalance ? `R$ ${gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '•••••';
    const txtMeta = showBigBalance ? `R$ ${metaEmReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '•••••';
    const txtPerc = showBigBalance ? `${pctGasto.toFixed(0)}%` : '••%';
    
    return `
      <div onclick="abrirDetalhesCategoria('${titulo}', ${metaEmReais})" class="bg-slate-50 dark:bg-slate-800 p-2 border border-slate-100 dark:border-slate-700 relative cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform flex flex-col justify-between ${extraClass}">
        <div class="flex items-center gap-1.5 mb-1.5">
          <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${corBgIcon} ${corTextoIcon}">
            <i class="fa-solid ${icone}"></i>
          </div>
          <span class="text-[10px] font-bold text-slate-700 dark:text-slate-200">${titulo}</span>
        </div>
        <div>
          <div class="text-[12px] font-black text-slate-900 dark:text-white leading-tight truncate">${txtGasto}</div>
          <div class="text-[8px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 truncate">Meta: ${txtMeta}</div>
        </div>
        <div class="flex items-center gap-1.5 mt-2">
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300" style="width: ${barraPreenchida}%; background-color: ${corBarra};"></div>
          </div>
          <span class="text-[8px] font-black text-slate-600 dark:text-slate-300">${txtPerc}</span>
        </div>
      </div>
    `;
  };

  const containerCat = document.getElementById('cardsCategoryContainer');
  if (containerCat) {
    containerCat.innerHTML = `
      ${criarCardMetaVisualNovo('Gastos Fixos', 'fa-bullseye', 'bg-blue-50 dark:bg-blue-900/30', 'text-blue-600 dark:text-blue-400', '#2563eb', fixed, metas.fixos)}
      ${criarCardMetaVisualNovo('Gastos Gerais', 'fa-star', 'bg-amber-50 dark:bg-amber-900/30', 'text-amber-500 dark:text-amber-400', '#10b981', general, metas.gerais)}
      ${criarCardMetaVisualNovo('Lazer', 'fa-cart-shopping', 'bg-purple-50 dark:bg-purple-900/30', 'text-purple-600 dark:text-purple-400', '#a855f7', leisure, metas.lazer, 'rounded-[1rem] rounded-br-[2rem]')}
      ${criarCardMetaVisualNovo('Investimentos', 'fa-chart-column', 'bg-amber-50 dark:bg-amber-900/30', 'text-amber-500 dark:text-amber-400', '#f59e0b', invest, metas.invest, 'rounded-[1rem] rounded-bl-[2rem]')}
    `;
  }

  const currentTxMes = transactions.filter(t => t.month === activeMonth);
  renderTransactionsList(currentTxMes);
  renderInvestments(currentTxMes);
  
  const tabGraficos = document.getElementById('tab-graficos');
  if (tabGraficos && !tabGraficos.classList.contains('hidden')) {
    renderCharts(fixed, general, leisure, invest);
    renderEvolutionChart();
    renderSubCategoryChart(currentTxMes);
    renderPaymentMethodChart(currentTxMes);
  }
}

function formatarValorTooltip(valor) {
  if (!showBigBalance) return '•••••';
  return `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderCharts(fixed, general, leisure, invest) {
  const totalCategorias = fixed + general + leisure + invest;

  const ctxPie = document.getElementById('categoryPieChart');
  if (ctxPie) {
    if (categoryPieChartInstance) categoryPieChartInstance.destroy();
    categoryPieChartInstance = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: ['Gastos Fixos', 'Gastos Gerais', 'Lazer', 'Investimentos'],
        datasets: [{
          data: [fixed, general, leisure, invest],
          backgroundColor: ['#2563eb', '#10b981', '#a855f7', '#f59e0b'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: { 
          legend: { 
            position: 'right', 
            labels: { boxWidth: 10, font: { size: 11, family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' }, padding: 14, usePointStyle: true, pointStyle: 'circle' } 
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { size: 11, family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
            bodyFont: { size: 12, family: "'Plus Jakarta Sans', sans-serif", weight: '800' },
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label: function(context) {
                const valor = context.parsed || 0;
                const perc = totalCategorias > 0 ? ((valor / totalCategorias) * 100).toFixed(1) : '0.0';
                return ` ${formatarValorTooltip(valor)} (${showBigBalance ? perc + '%' : '••%'})`;
              }
            }
          }
        }
      }
    });
  }
}

// Gráfico Novo: Evolução dos Últimos 6 Meses (Entradas vs Saídas)
function renderEvolutionChart() {
  const ctxEvo = document.getElementById('evolutionBarChart');
  if (!ctxEvo) return;

  const [nomeMesAtual, anoAtualStr] = activeMonth.split(' ');
  const idxAtual = mesesNomes.indexOf(nomeMesAtual);
  const anoAtual = parseInt(anoAtualStr, 10);

  const labels = [];
  const dadosEntradas = [];
  const dadosSaidas = [];

  for (let i = 5; i >= 0; i--) {
    let mIdx = idxAtual - i;
    let y = anoAtual;
    while (mIdx < 0) {
      mIdx += 12;
      y -= 1;
    }
    const mesStr = `${mesesNomes[mIdx]} ${y}`;
    labels.push(mesesNomes[mIdx].substring(0, 3));

    const txsMes = transactions.filter(t => t.month === mesStr && t.confirmado);
    const inc = txsMes.filter(t => t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra').reduce((s, t) => s + t.amount, 0);
    const exp = txsMes.filter(t => t.type === 'EXPENSE' && t.cat !== 'Salário' && t.cat !== 'Renda Extra').reduce((s, t) => s + t.amount, 0);

    dadosEntradas.push(inc);
    dadosSaidas.push(exp);
  }

  if (evolutionBarChartInstance) evolutionBarChartInstance.destroy();

  evolutionBarChartInstance = new Chart(ctxEvo, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Entradas',
          data: dadosEntradas,
          backgroundColor: '#10b981',
          borderRadius: 4
        },
        {
          label: 'Saídas',
          data: dadosSaidas,
          backgroundColor: '#f43f5e',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { boxWidth: 8, font: { size: 10, weight: 'bold' }, usePointStyle: true }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatarValorTooltip(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        y: { display: false, beginAtZero: true },
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
      }
    }
  });
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
        label: 'Gasto',
        data: dados,
        backgroundColor: '#2563eb',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return formatarValorTooltip(context.parsed.x);
            }
          }
        }
      },
      scales: {
        x: { display: false, beginAtZero: true },
        y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
      }
    }
  });
}

function renderPaymentMethodChart(currentTx) {
  const ctxPaymentBar = document.getElementById('paymentMethodBarChart');
  if (!ctxPaymentBar) return;

  const despesasMes = currentTx.filter(t => t.type === 'EXPENSE' && t.confirmado);

  const totaisPagamento = {};
  despesasMes.forEach(t => {
    let metodo = (t.paymentMethod || 'Outros').trim();
    if (metodo.startsWith('Cartão: ')) metodo = metodo.replace('Cartão: ', '');
    totaisPagamento[metodo] = (totaisPagamento[metodo] || 0) + t.amount;
  });

  const labels = Object.keys(totaisPagamento).length > 0 ? Object.keys(totaisPagamento) : ['PIX', 'Cartão', 'Outros'];
  const dados = Object.keys(totaisPagamento).length > 0 ? Object.values(totaisPagamento) : [0, 0, 0];
  const cores = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];

  if (paymentMethodBarChartInstance) paymentMethodBarChartInstance.destroy();

  paymentMethodBarChartInstance = new Chart(ctxPaymentBar, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Gasto',
        data: dados,
        backgroundColor: labels.map((_, i) => cores[i % cores.length]),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return formatarValorTooltip(context.parsed.y);
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } },
        y: { display: false, beginAtZero: true }
      }
    }
  });
}

// ==========================================
// EXTRATO E INVESTIMENTOS
// ==========================================

function renderTransactionsList(currentTx) {
  const container = document.getElementById('txListContainer');
  if (!container) return;

  const transacoesDoMesAtivo = transactions.filter(t => t.month === activeMonth);

  const search = (document.getElementById('searchExpense')?.value || '').toLowerCase();
  const filtroStatus = document.getElementById('filterStatus')?.value || '';
  const filtroMembro = document.getElementById('filterMember')?.value || '';
  const filtroCat = document.getElementById('filterCategory')?.value || '';
  
  const checkboxesSubCat = document.querySelectorAll('.subcat-filter-checkbox');
  const subCatsSelecionadas = Array.from(checkboxesSubCat).filter(cb => cb.checked).map(cb => cb.value);
  
  const filtroPaymentMethod = document.getElementById('filterPaymentMethod')?.value || '';

  container.innerHTML = '';
  
  const filtered = transacoesDoMesAtivo.filter(t => {
    const matchSearch = t.desc.toLowerCase().includes(search) || t.cat.toLowerCase().includes(search) || (t.subCat && t.subCat.toLowerCase().includes(search));
    const matchStatus = filtroStatus === '' || (filtroStatus === 'pending' ? !t.confirmado : t.confirmado === true);
    const matchMembro = filtroMembro === '' || t.userEmail === filtroMembro;
    const matchCat = filtroCat === '' || t.cat === filtroCat;
    const matchSubCat = subCatsSelecionadas.length === 0 || subCatsSelecionadas.includes(t.subCat);
    
    let matchPayment = true;
    if (filtroPaymentMethod === 'Cartão de Crédito') {
      matchPayment = isMetodoCartao(t.paymentMethod || '');
    } else if (filtroPaymentMethod !== '') {
      matchPayment = t.paymentMethod === filtroPaymentMethod;
    }

    return matchSearch && matchStatus && matchMembro && matchCat && matchSubCat && matchPayment;
  });

  // Controla exibição do botão "Confirmar Todos os Pendentes"
  const btnConfirmAllContainer = document.getElementById('btnConfirmAllContainer');
  const countPendentesBtn = document.getElementById('countPendentesBtn');
  if (btnConfirmAllContainer) {
    if (filtroStatus === 'pending' && filtered.length > 0) {
      if (countPendentesBtn) countPendentesBtn.innerText = filtered.length;
      btnConfirmAllContainer.classList.remove('hidden');
    } else {
      btnConfirmAllContainer.classList.add('hidden');
    }
  }

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
  const isAlgumFiltroAtivo = search !== '' || filtroStatus !== '' || filtroMembro !== '' || filtroCat !== '' || subCatsSelecionadas.length > 0 || filtroPaymentMethod !== '';
  
  if (isAlgumFiltroAtivo) {
    const somaFiltro = filtered.reduce((acc, t) => {
      const ehEntrada = t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra';
      return ehEntrada ? acc + t.amount : acc - t.amount;
    }, 0);

    if (filterTotalValue) {
      filterTotalValue.innerText = showBigBalance ? `R$ ${somaFiltro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '•••••';
    }
    if (filterTotalBox) filterTotalBox.classList.remove('hidden');
  } else {
    if (filterTotalBox) filterTotalBox.classList.add('hidden');
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-sm font-bold text-slate-400 bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-sm">Nenhuma movimentação encontrada neste filtro.</div>`;
    return;
  }

  filtered.forEach(t => {
    const isIncome = t.type === 'INCOME' || t.cat === 'Salário' || t.cat === 'Renda Extra';
    const autorNome = t.userEmail ? t.userEmail.split('@')[0] : 'Membro';
    const confirmado = t.confirmado === true;
    const labelPagamento = (t.paymentMethod || '').replace('Cartão: ', '💳 ');
    
    const catBadge = t.cat ? `<span class="text-[9px] bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">${t.cat}</span>` : '';
    const subCatBadge = t.subCat ? `<span class="text-[9px] bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">${t.subCat}</span>` : '';
    const paymentBadge = labelPagamento ? `<span class="text-[9px] bg-amber-50 dark:bg-slate-800 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">${labelPagamento}</span>` : '';
    const userBadge = `<span class="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-semibold"><i class="fa-solid fa-user text-[8px] mr-1"></i>${autorNome}</span>`;

    const valorExibicao = showBigBalance ? `${isIncome ? '+' : '-'} R$ ${Number(t.amount).toFixed(2).replace('.', ',')}` : '•••••';

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
          <span class="text-sm sm:text-base font-black whitespace-nowrap ${isIncome ? 'text-brand-green' : 'text-rose-500 dark:text-rose-400'}">
            ${valorExibicao}
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
  if (monthInvestEl) {
    monthInvestEl.innerText = showBigBalance ? `R$ ${totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '•••••';
  }

  const anoAtualSelecionado = activeMonth.split(' ')[1] || '2026';
  const totalYearInvested = transactions
    .filter(t => t.cat === 'Investimentos' && t.type === 'EXPENSE' && t.confirmado && (t.month.includes(anoAtualSelecionado) || (t.date && t.date.startsWith(anoAtualSelecionado))))
    .reduce((sum, t) => sum + t.amount, 0);

  const yearHeader = document.getElementById('yearInvestTotalHeader');
  if (yearHeader) {
    yearHeader.innerText = showBigBalance ? `R$ ${totalYearInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '•••••';
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
    const valorExibicao = showBigBalance ? `R$ ${Number(t.amount).toFixed(2).replace('.', ',')}` : '•••••';

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
            ${valorExibicao}
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
    showToast("Não existem lançamentos neste mês.", "info");
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
  showToast("Planilha CSV gerada!");
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

function copyWorkspaceCountCode() { 
  navigator.clipboard.writeText(currentWorkspace.code).then(() => showToast(`Código ${currentWorkspace.code} copiado!`)); 
}
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
    showToast("Saldo base atualizado!");
  } catch(err) {
    showToast("Erro ao salvar saldo livre.", "error");
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
    showToast("Gasto descontado da carteira livre!");
  } catch (err) {
    showToast("Erro ao registrar gasto.", "error");
  }
}

async function deletarGastoLivre(id) {
  const resp = await showConfirmDialog({
    title: 'Excluir Gasto Privado',
    text: 'Deseja remover este item do seu histórico privado?',
    confirmText: 'Excluir',
    isDanger: true
  });

  if (resp === 'confirm') {
    try {
      await db.collection('carteira_livre').doc(id).delete();
      showToast("Item removido.");
    } catch(err) {
      showToast("Erro ao excluir.", "error");
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
    lista.innerHTML = '<p class="text-xs font-bold text-slate-400 text-center py-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">Nenhum gasto livre registrado neste mês.</p>';
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

// ==========================================
// DETALHES DE CATEGORIAS (METAS - PRIVACIDADE APLICADA)
// ==========================================

function abrirDetalhesCategoria(nomeCategoria, metaValor) {
  const currentTxConfirmadas = transactions.filter(t => t.month === activeMonth && t.confirmado && t.cat === nomeCategoria);
  
  const totalGasto = currentTxConfirmadas.reduce((s, t) => s + t.amount, 0);
  const diferenca = metaValor - totalGasto;

  document.getElementById('detalheCatTitulo').innerText = nomeCategoria;
  
  let iconeClass = "fa-list";
  let bgIcon = "bg-blue-100 text-blue-600";
  if (nomeCategoria === 'Gastos Fixos') { iconeClass = "fa-bullseye"; bgIcon = "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"; }
  if (nomeCategoria === 'Gastos Gerais') { iconeClass = "fa-star"; bgIcon = "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"; }
  if (nomeCategoria === 'Lazer') { iconeClass = "fa-cart-shopping"; bgIcon = "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400"; }
  if (nomeCategoria === 'Investimentos') { iconeClass = "fa-chart-column"; bgIcon = "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"; }
  
  const iconeEl = document.getElementById('detalheCatIcone');
  iconeEl.className = `w-10 h-10 rounded-full flex items-center justify-center text-lg ${bgIcon}`;
  iconeEl.innerHTML = `<i class="fa-solid ${iconeClass}"></i>`;

  document.getElementById('detalheCatTotalGasto').innerText = showBigBalance 
    ? `R$ ${totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
    : '•••••';
  document.getElementById('detalheCatMetaValor').innerText = showBigBalance 
    ? `R$ ${metaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
    : '•••••';

  const statusEl = document.getElementById('detalheCatStatus');
  if (diferenca >= 0) {
    statusEl.innerText = showBigBalance ? `Sobra: R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Sobra: •••••';
    statusEl.className = "text-[11px] font-extrabold px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400";
  } else {
    statusEl.innerText = showBigBalance ? `Passou: R$ ${Math.abs(diferenca).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Passou: •••••';
    statusEl.className = "text-[11px] font-extrabold px-2 py-1 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400";
  }

  const listaEl = document.getElementById('detalheCatLista');
  listaEl.innerHTML = '';

  if (currentTxConfirmadas.length === 0) {
    listaEl.innerHTML = '<p class="text-xs font-bold text-slate-400 text-center py-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">Nenhum lançamento registado.</p>';
  } else {
    currentTxConfirmadas.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
      const dataFormatada = t.date ? t.date.split('-').reverse().join('/') : '';
      const subCatBadge = t.subCat ? `<span class="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold">${t.subCat}</span>` : '';
      const valorItem = showBigBalance ? `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '•••••';
      
      listaEl.innerHTML += `
        <div class="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-50 dark:border-slate-700">
          <div class="pr-2 truncate w-full">
            <span class="text-xs font-extrabold text-slate-800 dark:text-slate-200 block truncate">${t.desc}</span>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[10px] font-bold text-slate-500"><i class="fa-regular fa-calendar mr-1"></i> ${dataFormatada}</span>
              ${subCatBadge}
            </div>
          </div>
          <span class="text-sm font-black text-rose-600 dark:text-rose-400 shrink-0">${valorItem}</span>
        </div>
      `;
    });
  }

  document.getElementById('detalhesCategoriaModal').classList.remove('hidden');
}

function fecharDetalhesCategoria() {
  document.getElementById('detalhesCategoriaModal').classList.add('hidden');
}

// ==========================================
// NAVEGAÇÃO E GESTOS DE DESLIZAR
// ==========================================

function switchTab(tab) {
  ['resumo', 'extrato', 'invest', 'graficos'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) {
      el.classList.add('hidden');
      el.style = '';
    }
  });

  const activeEl = document.getElementById(`tab-${tab}`);
  if (activeEl) {
    activeEl.classList.remove('hidden');
    activeEl.style = '';
  }

  if (tab === 'extrato') {
    renderTransactionsList(transactions.filter(t => t.month === activeMonth));
  }

  ['resumo', 'extrato', 'invest', 'graficos'].forEach(name => {
    const btn = document.getElementById(`bottomNav${name.charAt(0).toUpperCase() + name.slice(1)}`);
    const indicator = document.getElementById(`indicator${name.charAt(0).toUpperCase() + name.slice(1)}`);
    
    if (btn) {
      if (name === tab) {
        btn.className = 'relative flex flex-col items-center justify-center text-brand-green pb-2 transition active:scale-95';
        if (indicator) indicator.classList.remove('hidden');
      } else {
        btn.className = 'relative flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 pb-2 transition active:scale-95';
        if (indicator) indicator.classList.add('hidden');
      }
    }
  });

  renderAll();
}

const containerSwipe = document.getElementById('mainSwipeContainer');
let inicioX = 0;
let deslizando = false;
const ordemAbas = ['resumo', 'extrato', 'invest', 'graficos'];

if (containerSwipe) {
  containerSwipe.addEventListener('touchstart', (e) => {
    inicioX = e.touches[0].clientX;
    deslizando = true;
  }, { passive: true });

  containerSwipe.addEventListener('touchmove', (e) => {
    if (!deslizando) return;
    
    let movimentoX = e.touches[0].clientX - inicioX;
    let abaAtivaIndex = ordemAbas.findIndex(t => !document.getElementById(`tab-${t}`).classList.contains('hidden'));
    let elAbaAtual = document.getElementById(`tab-${ordemAbas[abaAtivaIndex]}`);
    
    if (elAbaAtual) {
      elAbaAtual.style.transform = `translateX(${movimentoX * 0.2}px)`;
      elAbaAtual.style.opacity = `${1 - Math.abs(movimentoX / window.innerWidth)}`;
    }
  }, { passive: true });

  containerSwipe.addEventListener('touchend', (e) => {
    if (!deslizando) return;
    deslizando = false;
    
    let fimX = e.changedTouches[0].clientX;
    let diferenca = fimX - inicioX;
    let abaAtivaIndex = ordemAbas.findIndex(t => !document.getElementById(`tab-${t}`).classList.contains('hidden'));
    let elAbaAtual = document.getElementById(`tab-${ordemAbas[abaAtivaIndex]}`);
    
    const limite = 50; 

    if (Math.abs(diferenca) > limite) {
       if (diferenca < 0 && abaAtivaIndex < ordemAbas.length - 1) {
         mudarAbaComFade(abaAtivaIndex + 1);
       } else if (diferenca > 0 && abaAtivaIndex > 0) {
         mudarAbaComFade(abaAtivaIndex - 1);
       } else {
         resetarAbaAtual(elAbaAtual);
       }
    } else {
       resetarAbaAtual(elAbaAtual);
    }
  });
}

function resetarAbaAtual(elAba) {
  if(elAba) {
    elAba.style.transform = 'translateX(0px)';
    elAba.style.opacity = '1';
  }
}

function mudarAbaComFade(novoIndex) {
  const abaAtivaIndex = ordemAbas.findIndex(t => !document.getElementById(`tab-${t}`).classList.contains('hidden'));
  const elAbaAtual = document.getElementById(`tab-${ordemAbas[abaAtivaIndex]}`);
  
  if(elAbaAtual) {
     elAbaAtual.style.opacity = '0';
     setTimeout(() => {
        elAbaAtual.style.transform = 'translateX(0px)';
        elAbaAtual.style.opacity = '1';
        switchTab(ordemAbas[novoIndex]);
     }, 150);
  } else {
     switchTab(ordemAbas[novoIndex]);
  }
}
