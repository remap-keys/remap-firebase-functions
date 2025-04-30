import AbstractCommand from '../abstract-command';
import {
  ERROR_FETCHING_ORGANIZATIONS_FAILED,
  IOrganization,
  IOrganizationMember,
  IOrganizationWithMembers,
  IResult,
} from '../utils/types';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
} from '../utils/decorators';
import { CallableRequest, CallableResponse } from 'firebase-functions/https';

export interface IFetchOrganizationsResult extends IResult {
  organizations?: IOrganizationWithMembers[];
}

export class FetchOrganizationsCommand extends AbstractCommand<IFetchOrganizationsResult> {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  async execute(
    _request: CallableRequest,
    _response: CallableResponse | undefined
  ): Promise<IFetchOrganizationsResult> {
    try {
      const organizationsQueryDocumentSnapshot = await this.db
        .collection('organizations')
        .doc('v1')
        .collection('profiles')
        .get();
      const organizations: IOrganization[] =
        organizationsQueryDocumentSnapshot.docs.map((doc) => {
          return {
            id: doc.id,
            name: doc.data()!.name,
            description: doc.data()!.description,
            iconImageUrl: doc.data()!.icon_image_url,
            websiteUrl: doc.data()!.website_url,
            contactEmailAddress: doc.data()!.contact_email_address,
            contactPersonName: doc.data()!.contact_person_name,
            contactTel: doc.data()!.contact_tel,
            contactAddress: doc.data()!.contact_address,
            members: doc.data()!.members,
            createdAt: doc.data()!.created_at.toDate().getTime(),
            updatedAt: doc.data()!.updated_at.toDate().getTime(),
          };
        });
      const organizationWithMembersList: IOrganizationWithMembers[] = [];
      for (const organization of organizations) {
        const members: IOrganizationMember[] = [];
        for (const memberUid of organization.members) {
          const userRecord = await this.auth.getUser(memberUid);
          members.push({
            uid: memberUid,
            email: userRecord.email!,
            displayName: userRecord.displayName!,
          });
        }
        organizationWithMembersList.push({
          organization,
          organizationMembers: members,
        });
      }
      return {
        success: true,
        organizations: organizationWithMembersList,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: ERROR_FETCHING_ORGANIZATIONS_FAILED,
        errorMessage: 'Fetching organizations failed',
      };
    }
  }
}
