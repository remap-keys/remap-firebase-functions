import { ERROR_KEYBOARD_DEFINITION_NOT_FOUND, IResult } from '../utils/types';
import AbstractCommand from '../abstract-command';
import { NeedAuthentication, ValidateRequired } from '../utils/decorators';
import * as functions from 'firebase-functions';

type IKeyboardStatistics = {
  counts_of_opening_keyboard: {
    labels: string[];
    values: number[];
  };
  counts_of_flashing_keymap: {
    labels: string[];
    values: number[];
  };
};

type ICreateKeyboardStatisticsResult = {
  statistics?: IKeyboardStatistics;
} & IResult;

const UNIQUE_USER_COUNT_THRESHOLD: number = 2;

export class CreateKeyboardStatisticsCommand extends AbstractCommand<ICreateKeyboardStatisticsResult> {
  @NeedAuthentication()
  @ValidateRequired(['keyboardDefinitionId'])
  async execute(
    data: any,
    context: functions.https.CallableContext
  ): Promise<ICreateKeyboardStatisticsResult> {
    const keyboardDefinitionId = data.keyboardDefinitionId;
    const uid = context.auth!.uid;

    const result = await this.checkWhetherUserIsOwnerOfKeyboardDefinition(
      uid,
      keyboardDefinitionId
    );
    if (!result.success) {
      return result;
    }

    // Get the operation logs within the last 90 days.
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const querySnapshot = await this.db
      .collection('logs')
      .doc('v1')
      .collection('operations')
      .where('keyboardDefinitionId', '==', keyboardDefinitionId)
      .where('createdAt', '>=', ninetyDaysAgo)
      .orderBy('createdAt', 'asc')
      .get();

    const openingKeyboardDateValueMap: { [key: string]: number } =
      CreateKeyboardStatisticsCommand.createDefaultDateValueMap();
    const flashingKeymapDateValueMap: { [key: string]: number } =
      CreateKeyboardStatisticsCommand.createDefaultDateValueMap();

    const uniqueUserIds: Set<string> = new Set();
    for (const doc of querySnapshot.docs) {
      uniqueUserIds.add(doc.data().uid);
    }

    // If there is only one user, the statistics is not returned because of a privacy issue.
    if (UNIQUE_USER_COUNT_THRESHOLD <= uniqueUserIds.size) {
      for (const doc of querySnapshot.docs) {
        const createdAt = doc.data().createdAt.toDate();
        const date = createdAt.toISOString().substring(0, 10);
        if (doc.data().operation === 'configure/open') {
          if (openingKeyboardDateValueMap[date] == undefined) {
            openingKeyboardDateValueMap[date] = 0;
          }
          openingKeyboardDateValueMap[date] += 1;
        } else if (doc.data().operation === 'configure/flash') {
          if (flashingKeymapDateValueMap[date] == undefined) {
            flashingKeymapDateValueMap[date] = 0;
          }
          flashingKeymapDateValueMap[date] += 1;
        }
      }
    }

    const statistics: IKeyboardStatistics = {
      counts_of_opening_keyboard: {
        labels: Object.keys(openingKeyboardDateValueMap).sort(),
        values: Object.keys(openingKeyboardDateValueMap)
          .sort()
          .map((date) => openingKeyboardDateValueMap[date]),
      },
      counts_of_flashing_keymap: {
        labels: Object.keys(flashingKeymapDateValueMap).sort(),
        values: Object.keys(flashingKeymapDateValueMap)
          .sort()
          .map((date) => flashingKeymapDateValueMap[date]),
      },
    };

    return {
      success: true,
      statistics,
    };
  }

  static createDefaultDateValueMap(): { [key: string]: number } {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const result: { [key: string]: number } = {};
    for (
      let date = ninetyDaysAgo;
      date <= now;
      date.setDate(date.getDate() + 1)
    ) {
      result[date.toISOString().substring(0, 10)] = 0;
    }
    return result;
  }

  private async checkWhetherUserIsOwnerOfKeyboardDefinition(
    uid: string,
    keyboardDefinitionId: string
  ): Promise<IResult> {
    const keyboardDefinitionSnapshot = await this.db
      .collection('keyboards')
      .doc('v2')
      .collection('definitions')
      .doc(keyboardDefinitionId)
      .get();
    if (!keyboardDefinitionSnapshot.exists) {
      return {
        success: false,
        errorCode: ERROR_KEYBOARD_DEFINITION_NOT_FOUND,
        errorMessage: `The keyboard definition ${keyboardDefinitionId} is not found.`,
      };
    }
    const keyboardDefinition = keyboardDefinitionSnapshot.data()!;
    if (keyboardDefinition.author_type === 'organization') {
      const organizationId = keyboardDefinition.organization_id;
      const result = await this.checkUserIsOrganizationMember(
        uid,
        organizationId
      );
      if (!result) {
        return {
          success: false,
          errorCode: ERROR_KEYBOARD_DEFINITION_NOT_FOUND,
          errorMessage: `The user is not a member of the organization ${organizationId}.`,
        };
      }
    } else {
      if (keyboardDefinition.author_uid !== uid) {
        return {
          success: false,
          errorCode: ERROR_KEYBOARD_DEFINITION_NOT_FOUND,
          errorMessage: `The user is not an owner of the keyboard definition ${keyboardDefinitionId}.`,
        };
      }
    }
    return {
      success: true,
    };
  }
}
