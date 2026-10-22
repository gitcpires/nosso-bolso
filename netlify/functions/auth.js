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
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };

  try {
    const firebaseAdmin = getFirebaseAdmin();
    const db = firebaseAdmin.firestore();
    
    const authHeader = event.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new Error("Token ausente.");

    // Desencripta a identidade do Google
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(match[1]);
    const uid = decodedToken.uid;

    // O SERVIDOR verifica o banco de dados de forma segura
    const userRef = db.collection('usuarios').doc(uid);
    const userDoc = await userRef.get();

    // Se não existir, é um utilizador novo. O servidor cria como pendente.
    if (!userDoc.exists) {
      await userRef.set({
        email: decodedToken.email,
        status: 'pendente',
        dataCriacao: admin.firestore.FieldValue.serverTimestamp()
      });
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Conta criada! Aguardando a aprovação do Administrador." }) };
    }

    // Se existir, verifica se já foi aprovado
    if (userDoc.data().status === 'pendente') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Sua conta ainda está em análise pelo Administrador." }) };
    }

    // Aprovado!
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, mensagem: "Acesso liberado!" })
    };
  } catch (error) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: error.message }) };
  }
};
