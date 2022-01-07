import * as functions from 'firebase-functions';
import {
  ERROR_ORGANIZATION_NOT_FOUND,
  IOrganization,
  IOrganizationMember,
  IResult,
} from '../utils/types';
import AbstractCommand from '../abstract-command';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
  ValidateRequired,
} from '../utils/decorators';
import * as admin from 'firebase-admin';

interface IFetchOrganizationByIdCommandResult extends IResult {
  organization?: IOrganization;
  organizationMembers?: IOrganizationMember[];
}

export class FetchOrganizationByIdCommand extends AbstractCommand<IFetchOrganizationByIdCommandResult> {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  @ValidateRequired(['id'])
  async execute(
    data: any,
    context: functions.https.CallableContext
  ): Promise<IFetchOrganizationByIdCommandResult> {
    const documentSnapshot = await this.db
      .collection('organizations')
      .doc('v1')
      .collection('profiles')
      .doc(data.id)
      .get();
    if (!documentSnapshot.exists) {
      return {
        success: false,
        errorCode: ERROR_ORGANIZATION_NOT_FOUND,
        errorMessage: `Organization not found: ${data.id}`,
      };
    }
    const organization: IOrganization = {
      id: documentSnapshot.id,
      name: documentSnapshot.data()!.name,
      description: documentSnapshot.data()!.description,
      iconImageUrl: documentSnapshot.data()!.icon_image_url,
      websiteUrl: documentSnapshot.data()!.website_url,
      contactEmailAddress: documentSnapshot.data()!.contact_email_address,
      contactPersonName: documentSnapshot.data()!.contact_person_name,
      contactTel: documentSnapshot.data()!.contact_tel,
      contactAddress: documentSnapshot.data()!.contact_address,
      members: documentSnapshot.data()!.members,
      createdAt: documentSnapshot.data()!.created_at,
      updatedAt: documentSnapshot.data()!.updated_at,
    };
    const members: IOrganizationMember[] = [];
    for (const memberUid of organization.members) {
      const userRecord = await admin.auth().getUser(memberUid);
      members.push({
        uid: memberUid,
        email: userRecord.email!,
        displayName: userRecord.displayName!,
      });
    }
    return {
      success: true,
      organization,
      organizationMembers: members,
    };
  }
}
