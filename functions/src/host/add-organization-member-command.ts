import AbstractCommand from '../abstract-command';
import {
  ERROR_ADDING_ORGANIZATION_MEMBER_FAILED,
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

export class AddOrganizationMemberCommand extends AbstractCommand<IResult> {
  @NeedAuthentication()
  @ValidateRequired(['organizationId', 'email'])
  @NeedOrganizationMember()
  async execute(
    data: any,
    _context: functions.https.CallableContext
  ): Promise<IResult> {
    try {
      const email = data.email;
      const organizationId = data.organizationId;
      const userRecord = await admin.auth().getUserByEmail(email);
      if (
        !userRecord.providerData.some(
          (data) => data.providerId === 'github.com'
        )
      ) {
        return {
          success: false,
          errorCode: ERROR_ADDING_ORGANIZATION_MEMBER_FAILED,
          errorMessage: `The user[${email}] is not logged in to Remap with GitHub account`,
        };
      }
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
      if (!members.includes(userRecord.uid)) {
        members.push(userRecord.uid);
        await organizationDocumentSnapshot.ref.update({
          members,
        });
      }
      return {
        success: true,
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        errorCode: ERROR_ADDING_ORGANIZATION_MEMBER_FAILED,
        errorMessage: `Adding an organization member failed: ${error}`,
      };
    }
  }
}
