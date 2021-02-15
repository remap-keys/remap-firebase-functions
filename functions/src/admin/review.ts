import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
import { notifyToDiscord } from '../utils/notification';

export const review = async (
  message: functions.pubsub.Message,
  db: firestore.Firestore
): Promise<void> => {
  const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
  const definitionId = data.definitionId;

  const definitionDocumentSnapshot = await db
    .collection('keyboards')
    .doc('v2')
    .collection('definitions')
    .doc(definitionId)
    .get();
  if (!definitionDocumentSnapshot.exists) {
    console.error(`The keyboard definition not found: ${definitionId}`);
    return;
  }
  const vendorId = definitionDocumentSnapshot.data()!.vendor_id;
  const productId = definitionDocumentSnapshot.data()!.product_id;
  const productName = definitionDocumentSnapshot.data()!.product_name;
  const definitionQuerySnapshot = await db
    .collection('keyboards')
    .doc('v2')
    .collection('definitions')
    .where('vendor_id', '==', vendorId)
    .where('product_id', '==', productId)
    .get();
  if (definitionQuerySnapshot.size === 0) {
    console.error(`Illegal state error: ${vendorId} ${productId}`);
    return;
  }
  if (definitionQuerySnapshot.size === 1) {
    await approve(definitionDocumentSnapshot);
    return;
  }
  const sameProductNameExists = definitionQuerySnapshot.docs.some((doc) => {
    return (
      doc.id !== definitionId && doc.data()!.product_name.endsWith(productName)
    );
  });
  if (sameProductNameExists) {
    await reject(
      definitionDocumentSnapshot,
      'The same keyboard definition (Vendor ID, Product ID and Product Name) already exists.'
    );
    return;
  }
  await approve(definitionDocumentSnapshot);
};

const approve = async (
  definitionDocument: firestore.DocumentSnapshot
): Promise<void> => {
  await definitionDocument.ref.update({
    status: 'approved',
    updated_at: new Date(),
  });
  await notifyToDiscord(definitionDocument.id, {
    name: definitionDocument.data()!.name,
    author_uid: definitionDocument.data()!.author_uid,
    product_name: definitionDocument.data()!.product_name,
    status: 'approved',
  });
};

const reject = async (
  definitionDocument: firestore.DocumentSnapshot,
  reason: string
): Promise<void> => {
  await definitionDocument.ref.update({
    status: 'rejected',
    reject_reason: reason,
    updated_at: new Date(),
  });
  await notifyToDiscord(definitionDocument.id, {
    name: definitionDocument.data()!.name,
    author_uid: definitionDocument.data()!.author_uid,
    product_name: definitionDocument.data()!.product_name,
    status: 'rejected',
  });
};
