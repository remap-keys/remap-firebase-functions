import * as axios from 'axios';
import * as admin from 'firebase-admin';
import { notifyWithGAS } from '../utils/notification';
import * as functions from 'firebase-functions';

const DISCORD_WEBHOOK_URL = functions.config().discord.webhook;

const FUNCTIONS_REGION = 'asia-northeast1';

const notifyToDiscord = async (
  definitionId: string,
  data: any
): Promise<void> => {
  const docUrl = `https://admin.remap-keys.app/review/${definitionId}`;
  const message = `We have received a new review request: ${data.name}(${data.product_name}) ${docUrl}`;
  await axios.default.post<void>(DISCORD_WEBHOOK_URL, {
    content: message,
  });
  const userRecord = await admin.auth().getUser(data.author_uid);
  const providerData = userRecord.providerData[0];
  const payload = {
    messageType: 'received',
    email: providerData.email,
    displayName: providerData.displayName,
    keyboard: data.name,
    status: data.status,
    definitionId,
  };
  await notifyWithGAS(payload);
};

export const definitionUpdateHook = functions
  .region(FUNCTIONS_REGION)
  .firestore.document('keyboards/v2/definitions/{definitionId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data()!;
    const afterData = change.after.data()!;
    if (
      ['draft', 'rejected'].includes(beforeData.status) &&
      afterData.status === 'in_review'
    ) {
      await notifyToDiscord(context.params.definitionId, afterData);
    }
  });

export const definitionCreateHook = functions
  .region(FUNCTIONS_REGION)
  .firestore.document('keyboards/v2/definitions/{definitionId}')
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data()!;
    if (data.status === 'in_review') {
      await notifyToDiscord(context.params.definitionId, data);
    }
  });
