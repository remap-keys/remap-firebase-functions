import AbstractCommand from '../abstract-command';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
  ValidateRequired,
} from '../utils/decorators';
import {
  ERROR_ADDING_ORGANIZATION_MEMBER_FAILED,
  ERROR_CREATING_ORGANIZATION_FAILED,
  IResult,
} from '../utils/types';
import { CallableRequest, CallableResponse } from 'firebase-functions/https';

export class CreateOrganizationCommand extends AbstractCommand<IResult> {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  @ValidateRequired([
    'name',
    'description',
    'websiteUrl',
    'iconImageUrl',
    'contactEmailAddress',
    'contactTel',
    'contactAddress',
    'contactPersonName',
    'memberEmailAddress',
  ])
  async execute(
    request: CallableRequest,
    _response: CallableResponse | undefined
  ): Promise<IResult> {
    try {
      const memberEmailAddress = request.data.memberEmailAddress;
      const userRecord = await this.auth.getUserByEmail(memberEmailAddress);
      if (
        !userRecord.providerData.some(
          (data) => data.providerId === 'github.com'
        )
      ) {
        return {
          success: false,
          errorCode: ERROR_CREATING_ORGANIZATION_FAILED,
          errorMessage: `The user[${memberEmailAddress}] is not logged in to Remap with GitHub account`,
        };
      }
      await this.db
        .collection('organizations')
        .doc('v1')
        .collection('profiles')
        .add({
          name: request.data.name,
          description: request.data.description,
          website_url: request.data.websiteUrl,
          icon_image_url: request.data.iconImageUrl,
          contact_email_address: request.data.contactEmailAddress,
          contact_person_name: request.data.contactPersonName,
          contact_tel: request.data.contactTel,
          contact_address: request.data.contactAddress,
          members: [userRecord.uid],
          created_at: new Date(),
          updated_at: new Date(),
        });
      return {
        success: true,
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        errorCode: ERROR_ADDING_ORGANIZATION_MEMBER_FAILED,
        errorMessage: `Creating an organization failed: ${error}`,
      };
    }
  }
}
