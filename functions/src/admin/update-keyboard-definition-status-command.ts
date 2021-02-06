import AbstractCommand from '../abstract-command';
import { CallableContext } from 'firebase-functions/lib/providers/https';
import { ERROR_KEYBOARD_DEFINITION_NOT_FOUND, IResult } from '../types';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
  ValidateIncludes,
  ValidateRequired,
} from './decorators';

export class UpdateKeyboardDefinitionStatusCommand extends AbstractCommand {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  @ValidateRequired(['id', 'status', 'rejectReason'])
  @ValidateIncludes({
    status: ['draft', 'in_review', 'rejected', 'approved'],
  })
  async execute(data: any, context: CallableContext): Promise<IResult> {
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
    return {
      success: true,
    };
  }
}
