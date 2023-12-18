import AbstractCommand from '../abstract-command';
import { ERROR_KEYBOARD_DEFINITION_NOT_FOUND, IResult } from '../utils/types';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
  ValidateIncludes,
  ValidateRequired,
} from '../utils/decorators';
import * as admin from 'firebase-admin';
import { notifyWithGAS } from '../utils/notification';
import * as functions from 'firebase-functions';

export class UpdateKeyboardDefinitionStatusCommand extends AbstractCommand {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  @ValidateRequired(['id', 'status', 'rejectReason'])
  @ValidateIncludes({
    status: ['draft', 'in_review', 'rejected', 'approved'],
  })
  async execute(
    data: any,
    _context: functions.https.CallableContext
  ): Promise<IResult> {
    const documentSnapshot = await this.db
      .collection('keyboards')
      .doc('v2')
      .collection('definitions')
      .doc(data.id)
      .get();
    if (!documentSnapshot.exists) {
      return {
        success: false,
        errorCode: ERROR_KEYBOARD_DEFINITION_NOT_FOUND,
        errorMessage: `Keyboard Definition not found: ${data.id}`,
      };
    }
    await documentSnapshot.ref.update({
      status: data.status,
      reject_reason: data.rejectReason,
      updated_at: new Date(),
    });
    const userRecord = await admin
      .auth()
      .getUser(documentSnapshot.data()!.author_uid);
    const providerData = userRecord.providerData[0];
    const payload = {
      messageType: 'change',
      email: providerData.email,
      displayName: providerData.displayName,
      keyboard: documentSnapshot.data()!.name,
      status: data.status,
      definitionId: documentSnapshot.id,
    };
    await notifyWithGAS(payload);
    return {
      success: true,
    };
  }
}
