const admin = require("firebase-admin");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawCredentials) throw new Error("Variavel FIREBASE_SERVICE_ACCOUNT ausente.");
    
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(rawCredentials.replace(/\\n/g, '\n'));
    } catch (err) {
      const projectIdMatch = rawCredentials.match(/"project_id"\s*:\s*"([^"]+)"/);
      const clientEmailMatch = rawCredentials.match(/"client_email"\s*:\s*"([^"]+)"/);
      const privateKeyMatch = rawCredentials.match(/"private_key"\s*:\s*"([^"]+)"/);
      if (!projectIdMatch || !clientEmailMatch || !privateKeyMatch) throw new Error("Chave corrompida.");
      serviceAccount = { projectId: projectIdMatch[1], clientEmail: clientEmailMatch[1], privateKey: privateKeyMatch[1].replace(/\\n/g, '\n') };
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const firebaseAdmin = getFirebaseAdmin();
    const db = firebaseAdmin.firestore();
    
    const authHeader = event.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new Error("Token ausente.");

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(match[1]);
    const uid = decodedToken.uid;
    const expectedAdminUid = process.env.ADMIN_UID; 

    const userRef = db.collection('usuarios').doc(uid);
    const userDoc = await userRef.get();

    // REGRA VIP: Se for você (Administrador)
    if (uid === expectedAdminUid) {
      await userRef.set({ email: decodedToken.email, status: 'admin', ultimoAcesso: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mensagem: "Bem-vindo, Chefe! Acesso VIP liberado." }) };
    }

    if (!userDoc.exists) {
      await userRef.set({ email: decodedToken.email, status: 'pendente', dataCriacao: admin.firestore.FieldValue.serverTimestamp() });
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Conta criada! Aguardando a aprovação do Administrador." }) };
    }

    if (userDoc.data().status === 'pendente') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Sua conta ainda está em análise pelo Administrador." }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mensagem: "Acesso liberado!" }) };
  } catch (error) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: error.message }) };
  }
};
