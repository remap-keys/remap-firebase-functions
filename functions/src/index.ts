import * as functions from 'firebase-functions';
import * as axios from 'axios';

const DISCORD_WEBHOOK_URL = functions.config().discord.webhook;

const notifyToDiscord = async (definitionId: string, data: any): Promise<void> => {
  const docUrl = `${functions.config().firestore.definition_document_url}${definitionId}`;
  await axios.default.post<void>(DISCORD_WEBHOOK_URL, {
    content: `We have received a new review request: ${data.name}(${data.product_name}) ${docUrl}`
  });
};

exports.definitionUpdateHook = functions.firestore
  .document('keyboards/v2/definitions/{definitionId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data()!;
    const afterData = change.after.data()!;
    if (['draft', 'rejected'].includes(beforeData.status) && afterData.status === 'in_review') {
      await notifyToDiscord(context.params.definitionId, afterData);
    }
  });

exports.definitionCreateHook = functions.firestore
  .document('keyboards/v2/definitions/{definitionId}')
  .onCreate(async (snapshot, context) => {
      const data = snapshot.data()!;
      if (data.status === 'in_review') {
        await notifyToDiscord(context.params.definitionId, data);
      }
  });
