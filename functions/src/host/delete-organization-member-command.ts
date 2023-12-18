import AbstractCommand from '../abstract-command';
import {
  ERROR_DELETING_ORGANIZATION_MEMBER_FAILED,
  ERROR_ORGANIZATION_NOT_FOUND,
  IResult,
} from '../utils/types';
import {
  NeedAuthentication,
  NeedOrganizationMember,
  ValidateRequired,
} from '../utils/decorators';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export class DeleteOrganizationMemberCommand extends AbstractCommand<IResult> {
  @NeedAuthentication()
  @NeedOrganizationMember()
  @ValidateRequired(['organizationId', 'uid'])
  async execute(
    data: any,
    _context: functions.https.CallableContext
  ): Promise<IResult> {
    try {
      const organizationId = data.organizationId;
      const uid = data.uid;
      const organizationDocumentSnapshot = await admin
        .firestore()
        .collection('organizations')
        .doc('v1')
        .collection('profiles')
        .doc(organizationId)
        .get();
      if (!organizationDocumentSnapshot.exists) {
        return {
          success: false,
          errorCode: ERROR_ORGANIZATION_NOT_FOUND,
          errorMessage: `Organization not found: ${organizationId}`,
        };
      }
      const members = organizationDocumentSnapshot.data()!.members;
      const newMembers = members.filter(
        (memberUid: string) => memberUid !== uid
      );
      await organizationDocumentSnapshot.ref.update({
        members: newMembers,
      });
      return {
        success: true,
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        errorCode: ERROR_DELETING_ORGANIZATION_MEMBER_FAILED,
        errorMessage: `Deleting an organization member failed: ${error}`,
      };
    }
  }
}
