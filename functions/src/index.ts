import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
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

const FUNCTIONS_REGION_ASIA = 'asia-northeast1';
const FUNCTIONS_REGION_US = 'us-central1';

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

const commandMap: { [p: string]: AbstractCommand } = {
  fetchKeyboardDefinitionListByStatus:
    new FetchKeyboardDefinitionListByStatusCommand(db),
  fetchKeyboardDefinitionDetailById: new FetchKeyboardDefinitionByIdCommand(db),
  updateKeyboardDefinitionStatus: new UpdateKeyboardDefinitionStatusCommand(db),
  fetchKeyboardDefinitionStats: new FetchKeyboardDefinitionStatsCommand(db),
  fetchOrganizationById: new FetchOrganizationByIdCommand(db),
  fetchOrganizationMembers: new FetchOrganizationMembersCommand(db),
  addOrganizationMember: new AddOrganizationMemberCommand(db),
  deleteOrganizationMember: new DeleteOrganizationMemberCommand(db),
  fetchOrganizations: new FetchOrganizationsCommand(db),
  createOrganization: new CreateOrganizationCommand(db),
  createFirmwareBuildingTask: new CreateFirmwareBuildingTaskCommand(db),
  createKeyboardStatistics: new CreateKeyboardStatisticsCommand(db),
  createWorkbenchBuildingTask: new CreateWorkbenchBuildingTaskCommand(db),
};

const funcMap = Object.keys(commandMap).reduce(
  (map, functionName) => {
    map[functionName] = functions
      .region(FUNCTIONS_REGION_ASIA)
      .https.onCall(async (data, context): Promise<IResult> => {
        return await commandMap[functionName].execute(data, context);
      });
    return map;
  },
  {} as { [p: string]: any }
);

funcMap['definitionCreateHook'] = definitionCreateHook;
funcMap['definitionUpdateHook'] = definitionUpdateHook;
funcMap['review'] = functions
  .region(FUNCTIONS_REGION_ASIA)
  .pubsub.topic('review')
  .onPublish(async (message) => {
    await review(message, db);
  });
funcMap['backupFirestore'] = backupFirestore;
funcMap['sitemap'] = functions
  .runWith({ memory: '1GB' })
  .region(FUNCTIONS_REGION_US)
  .https.onRequest(async (req, res) => {
    await new GenerateSitemapXmlCommand(db).execute(req, res);
  });
funcMap['catalog'] = functions
  .runWith({ memory: '1GB' })
  .region(FUNCTIONS_REGION_US)
  .https.onRequest(async (req, res) => {
    await new GenerateCatalogPageCommand(db).execute(req, res);
  });

export = funcMap;
