async function importarGastosFixosMesAnterior() {
  console.log("Mês ativo atual:", activeMonth);
  
  // 1. Descobrir qual é o mês anterior com base no activeMonth
  const [nomeMesAtual, anoAtualStr] = activeMonth.split(' ');
  const indexMesAtual = mesesNomes.indexOf(nomeMesAtual);
  
  let indexMesAnterior = indexMesAtual - 1;
  let anoAnterior = parseInt(anoAtualStr, 10);
  
  if (indexMesAnterior < 0) {
    indexMesAnterior = 11; // Dezembro
    anoAnterior -= 1;
  }
  const mesAnteriorStr = `${mesesNomes[indexMesAnterior]} ${anoAnterior}`;
  console.log("A procurar gastos fixos no mês anterior:", mesAnteriorStr);

  // 2. Trava de Segurança: Verificar se JÁ existem Gastos Fixos no mês atual
  const jaExistemNoAtual = transactions.some(t => t.month === activeMonth && t.cat === 'Gastos Fixos');
  if (jaExistemNoAtual) {
    alert(`⚠️ Os gastos fixos deste mês (${activeMonth}) já foram importados anteriormente.`);
    return;
  }

  // 3. Filtrar os gastos fixos do mês anterior
  const gastosFixosAnteriores = transactions.filter(t => t.month === mesAnteriorStr && t.cat === 'Gastos Fixos');
  console.log("Gastos fixos encontrados no mês anterior:", gastosFixosAnteriores);

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
        subCat: txAntiga.subCat || 'Cartão de Crédito',
        month: activeMonth,
        date: novaDataStr,
        confirmado: false, // Entram como pendentes
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
    alert("Erro ao tentar importar os gastos fixos. Verifique o console para mais detalhes.");
  }
}
