import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { IResult } from './utils/types';
import AbstractCommand from './abstract-command';
import { FetchKeyboardDefinitionListByStatusCommand } from './admin/fetch-keyboard-definition-list-by-status-command';
import { FetchKeyboardDefinitionByIdCommand } from './admin/fetch-keyboard-definition-by-id-command';
import { UpdateKeyboardDefinitionStatusCommand } from './admin/update-keyboard-definition-status-command';
import {
  definitionCreateHook,
  definitionUpdateHook,
} from './firestore/event-handler';
import { review } from './admin/review';
import { FetchKeyboardDefinitionStatsCommand } from './admin/fetch-keyboard-definition-stats-command';

const FUNCTIONS_REGION = 'asia-northeast1';

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

const commandMap: { [p: string]: AbstractCommand } = {
  fetchKeyboardDefinitionListByStatus: new FetchKeyboardDefinitionListByStatusCommand(
    db
  ),
  fetchKeyboardDefinitionDetailById: new FetchKeyboardDefinitionByIdCommand(db),
  updateKeyboardDefinitionStatus: new UpdateKeyboardDefinitionStatusCommand(db),
  fetchKeyboardDefinitionStats: new FetchKeyboardDefinitionStatsCommand(db),
};

const funcMap = Object.keys(commandMap).reduce((map, functionName) => {
  map[functionName] = functions.region(FUNCTIONS_REGION).https.onCall(
    async (data, context): Promise<IResult> => {
      return await commandMap[functionName].execute(data, context);
    }
  );
  return map;
}, {} as { [p: string]: any });

funcMap['definitionCreateHook'] = definitionCreateHook;
funcMap['definitionUpdateHook'] = definitionUpdateHook;
funcMap['review'] = functions
  .region(FUNCTIONS_REGION)
  .pubsub.topic('review')
  .onPublish(async (message) => {
    await review(message, db);
  });

export = funcMap;
