const admin = require("firebase-admin");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    let acc;
    try { acc = JSON.parse(raw.replace(/\\n/g, '\n')); } 
    catch (e) {
      acc = { 
        projectId: raw.match(/"project_id"\s*:\s*"([^"]+)"/)[1], 
        clientEmail: raw.match(/"client_email"\s*:\s*"([^"]+)"/)[1], 
        privateKey: raw.match(/"private_key"\s*:\s*"([^"]+)"/)[1].replace(/\\n/g, '\n') 
      };
    }
    admin.initializeApp({ credential: admin.credential.cert(acc) });
  }
  return admin;
}

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const firebaseAdmin = getFirebaseAdmin();
    const authHeader = event.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new Error("Acesso negado.");

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(match[1]);
    if (decodedToken.uid !== process.env.ADMIN_UID) throw new Error("Apenas o Administrador pode acessar esta área.");

    const db = firebaseAdmin.firestore();

    if (event.httpMethod === "GET") {
      const snapshot = await db.collection('usuarios').get();
      const usuarios = [];
      snapshot.forEach(doc => {
        if (doc.id !== process.env.ADMIN_UID) usuarios.push({ id: doc.id, ...doc.data() });
      });
      return { statusCode: 200, headers, body: JSON.stringify(usuarios) };
    }

    const body = event.body ? JSON.parse(event.body) : {};

    if (event.httpMethod === "POST") {
      // Apenas aprova o acesso. O usuário define o grupo depois na interface dele.
      await db.collection('usuarios').doc(body.userId).update({
        status: 'aprovado',
        dataAprovacao: admin.firestore.FieldValue.serverTimestamp()
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod === "DELETE") {
      await db.collection('usuarios').doc(body.userId).delete();
      await firebaseAdmin.auth().deleteUser(body.userId);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Método não permitido" }) };
  } catch (error) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: error.message }) };
  }
};
