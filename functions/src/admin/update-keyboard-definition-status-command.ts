import AbstractCommand from '../abstract-command';
import { ERROR_KEYBOARD_DEFINITION_NOT_FOUND, IResult } from '../utils/types';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
  ValidateIncludes,
  ValidateRequired,
} from '../utils/decorators';
import { notifyWithGAS } from '../utils/notification';
import { CallableRequest, CallableResponse } from 'firebase-functions/https';

export class UpdateKeyboardDefinitionStatusCommand extends AbstractCommand {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  @ValidateRequired(['id', 'status', 'rejectReason'])
  @ValidateIncludes({
    status: ['draft', 'in_review', 'rejected', 'approved'],
  })
  async execute(
    request: CallableRequest,
    _response: CallableResponse | undefined,
    secrets: {
      jwtSecret: string;
      notificationUrl: string;
    }
  ): Promise<IResult> {
    const documentSnapshot = await this.db
      .collection('keyboards')
      .doc('v2')
      .collection('definitions')
      .doc(request.data.id)
      .get();
    if (!documentSnapshot.exists) {
      return {
        success: false,
        errorCode: ERROR_KEYBOARD_DEFINITION_NOT_FOUND,
        errorMessage: `Keyboard Definition not found: ${request.data.id}`,
      };
    }
    await documentSnapshot.ref.update({
      status: request.data.status,
      reject_reason: request.data.rejectReason,
      updated_at: new Date(),
    });
    const userRecord = await this.auth.getUser(
      documentSnapshot.data()!.author_uid
    );
    const providerData = userRecord.providerData[0];
    const payload = {
      messageType: 'change',
      email: providerData.email,
      displayName: providerData.displayName,
      keyboard: documentSnapshot.data()!.name,
      status: request.data.status,
      definitionId: documentSnapshot.id,
    };
    await notifyWithGAS(payload, secrets.jwtSecret, secrets.notificationUrl);
    return {
      success: true,
    };
  }
}
