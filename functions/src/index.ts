import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as axios from 'axios';
import { IResult } from './types';
import AbstractCommand from './abstract-command';
import { FetchKeyboardDefinitionListByStatusCommand } from './admin/fetch-keyboard-definition-list-by-status-command';
import { FetchKeyboardDefinitionByIdCommand } from './admin/fetch-keyboard-definition-by-id-command';
import { UpdateKeyboardDefinitionStatusCommand } from './admin/update-keyboard-definition-status-command';

const FUNCTIONS_REGION = 'asia-northeast1';

admin.initializeApp(functions.config().firebase);

const DISCORD_WEBHOOK_URL = functions.config().discord.webhook;

const db = admin.firestore();

const commandMap: { [p: string]: AbstractCommand } = {
  fetchKeyboardDefinitionListByStatus: new FetchKeyboardDefinitionListByStatusCommand(
    db
  ),
  fetchKeyboardDefinitionDetailById: new FetchKeyboardDefinitionByIdCommand(db),
  updateKeyboardDefinitionStatus: new UpdateKeyboardDefinitionStatusCommand(db),
};

const funcMap = Object.keys(commandMap).reduce((map, functionName) => {
  map[functionName] = functions.region(FUNCTIONS_REGION).https.onCall(
    async (data, context): Promise<IResult> => {
      return await commandMap[functionName].execute(data, context);
    }
  );
  return map;
}, {} as { [p: string]: any });

const notifyToDiscord = async (
  definitionId: string,
  data: any
): Promise<void> => {
  const docUrl = `${
    functions.config().firestore.definition_document_url
  }${definitionId}`;
  await axios.default.post<void>(DISCORD_WEBHOOK_URL, {
    content: `We have received a new review request: ${data.name}(${data.product_name}) ${docUrl}`,
  });
};

funcMap['definitionUpdateHook'] = functions
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

funcMap['definitionCreateHook'] = functions
  .region(FUNCTIONS_REGION)
  .firestore.document('keyboards/v2/definitions/{definitionId}')
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data()!;
    if (data.status === 'in_review') {
      await notifyToDiscord(context.params.definitionId, data);
    }
  });

export = funcMap;
