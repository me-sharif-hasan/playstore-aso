import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let db;

function initFirebase() {
  if (admin.apps.length) return;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH not set');
  }

  const serviceAccount = JSON.parse(
    readFileSync(resolve(serviceAccountPath), 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

initFirebase();

db = admin.firestore();

export { admin, db };
