import { notifyReviewStatusChangeMessageToDiscordAndGAS } from '../utils/notification';
import * as functions from 'firebase-functions';
import { PubSub } from '@google-cloud/pubsub';
import { firestore } from 'firebase-admin';

const FUNCTIONS_REGION = 'asia-northeast1';

const pubsub = new PubSub();

const sendMessageToReviewQueue = async (
  definitionId: string
): Promise<void> => {
  const message = {
    definitionId,
  };
  const dataBuffer = Buffer.from(JSON.stringify(message));
  const messageId = await pubsub.topic('review').publish(dataBuffer);
  console.log(`The message was sent to the topic(review): ${messageId}`);
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
      await notifyReviewStatusChangeMessageToDiscordAndGAS(
        context.params.definitionId,
        {
          name: afterData.name,
          author_uid: afterData.author_uid,
          product_name: afterData.product_name,
          status: afterData.status,
        }
      );
      await sendMessageToReviewQueue(context.params.definitionId);
    }
  });

export const definitionCreateHook = functions
  .region(FUNCTIONS_REGION)
  .firestore.document('keyboards/v2/definitions/{definitionId}')
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data()!;
    if (data.status === 'in_review') {
      await notifyReviewStatusChangeMessageToDiscordAndGAS(
        context.params.definitionId,
        {
          name: data.name,
          author_uid: data.author_uid,
          product_name: data.product_name,
          status: data.status,
        }
      );
      await sendMessageToReviewQueue(context.params.definitionId);
    }
  });

const client = new firestore.v1.FirestoreAdminClient();
const bucket = 'gs://remap-firestore-backup-production';

export const backupFirestore = functions
  .region(FUNCTIONS_REGION)
  .pubsub.schedule('every 24 hours')
  .onRun((_context) => {
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (projectId == undefined) {
      throw new Error('Project ID not found');
    }
    const databaseName = client.databasePath(projectId, '(default)');
    return client
      .exportDocuments({
        name: databaseName,
        outputUriPrefix: bucket,
        collectionIds: [],
      })
      .then((responses: any) => {
        const response = responses[0];
        console.log(`Operation Name: ${response['name']}`);
      })
      .catch((err: any) => {
        console.error(err);
        throw new Error('Export operation failed');
      });
  });
