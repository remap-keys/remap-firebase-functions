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
import { CallableRequest, CallableResponse } from 'firebase-functions/https';

interface IFetchOrganizationByIdCommandResult extends IResult {
  organization?: IOrganization;
  organizationMembers?: IOrganizationMember[];
}

export class FetchOrganizationByIdCommand extends AbstractCommand<IFetchOrganizationByIdCommandResult> {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  @ValidateRequired(['id'])
  async execute(
    request: CallableRequest,
    _response: CallableResponse | undefined
  ): Promise<IFetchOrganizationByIdCommandResult> {
    const documentSnapshot = await this.db
      .collection('organizations')
      .doc('v1')
      .collection('profiles')
      .doc(request.data.id)
      .get();
    if (!documentSnapshot.exists) {
      return {
        success: false,
        errorCode: ERROR_ORGANIZATION_NOT_FOUND,
        errorMessage: `Organization not found: ${request.data.id}`,
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
      createdAt: documentSnapshot.data()!.created_at.toDate().getTime(),
      updatedAt: documentSnapshot.data()!.updated_at.toDate().getTime(),
    };
    const members: IOrganizationMember[] = [];
    for (const memberUid of organization.members) {
      const userRecord = await this.auth.getUser(memberUid);
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
