import { notifyReviewStatusChangeMessageToDiscordAndGAS } from '../utils/notification';
import { PubSub } from '@google-cloud/pubsub';
import { firestore } from 'firebase-admin';
import { Auth } from 'firebase-admin/auth';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const FUNCTIONS_REGION = 'asia-northeast1';

const pubsub = new PubSub();

const sendMessageToReviewQueue = async (
  definitionId: string
): Promise<void> => {
  const message = {
    definitionId,
  };
  const dataBuffer = Buffer.from(JSON.stringify(message));
  const messageId = await pubsub
    .topic('review')
    .publishMessage({ data: dataBuffer });
  console.log(`The message was sent to the topic(review): ${messageId}`);
};

export const definitionUpdateHook = async (
  event: FirestoreEvent<
    Change<QueryDocumentSnapshot> | undefined,
    { definitionId: string }
  >,
  auth: Auth,
  discordWebhook: string,
  jwtSecret: string,
  notificationUrl: string
) => {
  const beforeData = event.data!.before.data()!;
  const afterData = event.data!.after.data()!;
  if (
    ['draft', 'rejected'].includes(beforeData.status) &&
    afterData.status === 'in_review'
  ) {
    await notifyReviewStatusChangeMessageToDiscordAndGAS(
      auth,
      event.params.definitionId,
      {
        name: afterData.name,
        author_uid: afterData.author_uid,
        product_name: afterData.product_name,
        status: afterData.status,
      },
      discordWebhook,
      jwtSecret,
      notificationUrl
    );
    await sendMessageToReviewQueue(event.params.definitionId);
  }
};

export const definitionCreateHook = async (
  event: FirestoreEvent<
    QueryDocumentSnapshot | undefined,
    { definitionId: string }
  >,
  auth: Auth,
  discordWebhook: string,
  jwtSecret: string,
  notificationUrl: string
) => {
  const data = event.data!.data()!;
  if (data.status === 'in_review') {
    await notifyReviewStatusChangeMessageToDiscordAndGAS(
      auth,
      event.params.definitionId,
      {
        name: data.name,
        author_uid: data.author_uid,
        product_name: data.product_name,
        status: data.status,
      },
      discordWebhook,
      jwtSecret,
      notificationUrl
    );
    await sendMessageToReviewQueue(event.params.definitionId);
  }
};

const client = new firestore.v1.FirestoreAdminClient();
const bucket = 'gs://remap-firestore-backup-production';

export const backupFirestore = onSchedule(
  { region: FUNCTIONS_REGION, schedule: 'every 24 hours' },
  async (_event) => {
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
  }
);
