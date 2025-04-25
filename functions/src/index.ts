import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { IResult } from './utils/types';
import AbstractCommand from './abstract-command';
import { FetchKeyboardDefinitionListByStatusCommand } from './admin/fetch-keyboard-definition-list-by-status-command';
import { FetchKeyboardDefinitionByIdCommand } from './admin/fetch-keyboard-definition-by-id-command';
import { UpdateKeyboardDefinitionStatusCommand } from './admin/update-keyboard-definition-status-command';
import {
  backupFirestore,
  definitionCreateHook,
  definitionUpdateHook,
} from './firestore/event-handler';
import { review } from './admin/review';
import { FetchKeyboardDefinitionStatsCommand } from './admin/fetch-keyboard-definition-stats-command';
import { FetchOrganizationByIdCommand } from './admin/fetch-organization-by-id-command';
import GenerateSitemapXmlCommand from './host/generate-sitemap-xml-command';
import GenerateCatalogPageCommand from './host/generate-catalog-page-command';
import { FetchOrganizationMembersCommand } from './host/fetch-organization-members-command';
import { AddOrganizationMemberCommand } from './host/add-organization-member-command';
import { DeleteOrganizationMemberCommand } from './host/delete-organization-member-command';
import { FetchOrganizationsCommand } from './admin/fetch-organizations-command';
import { CreateOrganizationCommand } from './admin/create-organization-command';
import { CreateFirmwareBuildingTaskCommand } from './keyboards/create-firmware-building-task-command';
import { CreateKeyboardStatisticsCommand } from './keyboards/create-keyboard-statistics-command';
import { CreateWorkbenchBuildingTaskCommand } from './keyboards/create-workbench-building-task-command';
import { setGlobalOptions } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import {
  onDocumentCreated,
  onDocumentUpdated,
} from 'firebase-functions/firestore';
import { OrderCreateCommand } from './workbench/order-create-command';
import { CaptureOrderCommand } from './workbench/capture-order-command';

const FUNCTIONS_REGION_ASIA = 'asia-northeast1';
const FUNCTIONS_REGION_US = 'us-central1';

const discordWebhook = defineSecret('DISCORD_WEBHOOK');
const notificationUrl = defineSecret('NOTIFICATION_URL');
const jwtSecret = defineSecret('JWT_SECRET');

// PayPal API credentials for Production
const paypalClientId = defineSecret('PAYPAL_CLIENT_ID');
const paypalClientSecret = defineSecret('PAYPAL_CLIENT_SECRET');

// PayPal API credentials for Sandbox
// const paypalClientId = defineSecret('SANDBOX_PAYPAL_CLIENT_ID');
// const paypalClientSecret = defineSecret('SANDBOX_PAYPAL_CLIENT_SECRET');

setGlobalOptions({
  region: FUNCTIONS_REGION_ASIA,
});

const app = initializeApp();

const db = getFirestore(app);
const auth = getAuth(app);

const commandMap: { [p: string]: AbstractCommand } = {
  fetchKeyboardDefinitionListByStatus:
    new FetchKeyboardDefinitionListByStatusCommand(db, auth),
  fetchKeyboardDefinitionDetailById: new FetchKeyboardDefinitionByIdCommand(
    db,
    auth
  ),
  updateKeyboardDefinitionStatus: new UpdateKeyboardDefinitionStatusCommand(
    db,
    auth
  ),
  fetchKeyboardDefinitionStats: new FetchKeyboardDefinitionStatsCommand(
    db,
    auth
  ),
  fetchOrganizationById: new FetchOrganizationByIdCommand(db, auth),
  fetchOrganizationMembers: new FetchOrganizationMembersCommand(db, auth),
  addOrganizationMember: new AddOrganizationMemberCommand(db, auth),
  deleteOrganizationMember: new DeleteOrganizationMemberCommand(db, auth),
  fetchOrganizations: new FetchOrganizationsCommand(db, auth),
  createOrganization: new CreateOrganizationCommand(db, auth),
  createFirmwareBuildingTask: new CreateFirmwareBuildingTaskCommand(db, auth),
  createKeyboardStatistics: new CreateKeyboardStatisticsCommand(db, auth),
  createWorkbenchBuildingTask: new CreateWorkbenchBuildingTaskCommand(db, auth),
  orderCreate: new OrderCreateCommand(db, auth),
  captureOrder: new CaptureOrderCommand(db, auth),
};

const funcMap = Object.keys(commandMap).reduce(
  (map, functionName) => {
    map[functionName] = onCall(
      {
        region: FUNCTIONS_REGION_ASIA,
        secrets: [
          jwtSecret,
          notificationUrl,
          paypalClientId,
          paypalClientSecret,
        ],
      },
      async (request, response): Promise<IResult> => {
        return await commandMap[functionName].execute(request, response, {
          jwtSecret: jwtSecret.value(),
          notificationUrl: notificationUrl.value(),
          paypalClientId: paypalClientId.value(),
          paypalClientSecret: paypalClientSecret.value(),
        });
      }
    );
    return map;
  },
  {} as { [p: string]: any }
);

funcMap['definitionCreateHook'] = onDocumentCreated(
  {
    document: 'keyboards/v2/definitions/{definitionId}',
    secrets: [discordWebhook, notificationUrl, jwtSecret],
  },
  async (event) => {
    definitionCreateHook(
      event,
      auth,
      discordWebhook.value(),
      jwtSecret.value(),
      notificationUrl.value()
    );
  }
);

funcMap['definitionUpdateHook'] = onDocumentUpdated(
  {
    document: 'keyboards/v2/definitions/{definitionId}',
    secrets: [discordWebhook, notificationUrl, jwtSecret],
  },
  async (event) => {
    definitionUpdateHook(
      event,
      auth,
      discordWebhook.value(),
      jwtSecret.value(),
      notificationUrl.value()
    );
  }
);

funcMap['review'] = onMessagePublished(
  { topic: 'review', secrets: [discordWebhook] },
  async (message) => {
    await review(
      message,
      db,
      auth,
      discordWebhook.value(),
      jwtSecret.value(),
      notificationUrl.value()
    );
  }
);

funcMap['backupFirestore'] = backupFirestore;

funcMap['sitemap'] = onRequest(
  { memory: '1GiB', region: FUNCTIONS_REGION_US },
  async (req, res) => {
    await new GenerateSitemapXmlCommand(db).execute(req, res);
  }
);

funcMap['catalog'] = onRequest(
  { memory: '1GiB', region: FUNCTIONS_REGION_US },
  async (req, res) => {
    await new GenerateCatalogPageCommand(db).execute(req, res);
  }
);

export = funcMap;
