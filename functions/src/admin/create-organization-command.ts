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
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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
    data: any,
    context: functions.https.CallableContext
  ): Promise<IResult> {
    try {
      const memberEmailAddress = data.memberEmailAddress;
      const userRecord = await admin.auth().getUserByEmail(memberEmailAddress);
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
