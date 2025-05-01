import { notifyReviewStatusChangeMessageToDiscordAndGAS } from '../utils/notification';
import { CloudEvent } from 'firebase-functions';
import { MessagePublishedData } from 'firebase-functions/pubsub';
import { Firestore, DocumentSnapshot } from 'firebase-admin/firestore';
import { Auth } from 'firebase-admin/auth';

export const review = async (
  message: CloudEvent<MessagePublishedData>,
  db: Firestore,
  auth: Auth,
  discordWebhook: string,
  jwtSecret: string,
  notificationUrl: string
): Promise<void> => {
  const data = JSON.parse(
    Buffer.from(message.data.message.data, 'base64').toString()
  );
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
    requestIsUnique(definitionDocumentSnapshot);
    return;
  }
  const sameProductNameExists = definitionQuerySnapshot.docs.some((doc) => {
    return (
      doc.id !== definitionId &&
      doc.data()!.product_name === productName &&
      doc.data()!.status === 'approved'
    );
  });
  if (sameProductNameExists) {
    await reject(
      auth,
      definitionDocumentSnapshot,
      'The same keyboard definition (Vendor ID, Product ID and Product Name) already exists.',
      discordWebhook,
      jwtSecret,
      notificationUrl
    );
    return;
  }
  requestIsUnique(definitionDocumentSnapshot);
};

const requestIsUnique = (definitionDocument: DocumentSnapshot): void => {
  const data = definitionDocument.data()!;
  const message = `The Vendor ID, Product ID and Product Name of the keyboard ${data.name}(${data.product_name}) (${definitionDocument.id}) is unique.`;
  console.log(message);
};

const reject = async (
  auth: Auth,
  definitionDocument: DocumentSnapshot,
  reason: string,
  discordWebhook: string,
  jwtSecret: string,
  notificationUrl: string
): Promise<void> => {
  await definitionDocument.ref.update({
    status: 'rejected',
    reject_reason: reason,
    updated_at: new Date(),
  });
  await notifyReviewStatusChangeMessageToDiscordAndGAS(
    auth,
    definitionDocument.id,
    {
      name: definitionDocument.data()!.name,
      author_uid: definitionDocument.data()!.author_uid,
      product_name: definitionDocument.data()!.product_name,
      status: 'rejected',
    },
    discordWebhook,
    jwtSecret,
    notificationUrl
  );
};
