import AbstractCommand from '../abstract-command';
import * as functions from 'firebase-functions';
import {
  ERROR_KEYBOARD_DEFINITION_NOT_FOUND,
  IKeyboardDefinitionDetail,
  IResult,
} from '../utils/types';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
  ValidateRequired,
} from './decorators';
import * as admin from 'firebase-admin';

interface IFetchKeyboardDefinitionByIdCommandResult extends IResult {
  keyboardDefinitionDetail?: IKeyboardDefinitionDetail;
}

export class FetchKeyboardDefinitionByIdCommand extends AbstractCommand<IFetchKeyboardDefinitionByIdCommandResult> {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  @ValidateRequired(['id'])
  async execute(
    data: any,
    context: functions.https.CallableContext
  ): Promise<IFetchKeyboardDefinitionByIdCommandResult> {
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
    const userRecord = await admin
      .auth()
      .getUser(documentSnapshot.data()!.author_uid);
    const providerData = userRecord.providerData[0];
    return {
      success: true,
      keyboardDefinitionDetail: {
        id: documentSnapshot.id,
        authorUid: documentSnapshot.data()!.uid,
        createdAt: documentSnapshot.data()!.created_at.toDate().getTime(),
        json: documentSnapshot.data()!.json,
        name: documentSnapshot.data()!.name,
        productId: documentSnapshot.data()!.product_id,
        productName: documentSnapshot.data()!.product_name,
        rejectReason: documentSnapshot.data()!.reject_reason,
        status: documentSnapshot.data()!.status,
        updatedAt: documentSnapshot.data()!.updated_at.toDate().getTime(),
        vendorId: documentSnapshot.data()!.vendor_id,
        githubUrl: documentSnapshot.data()!.github_url,
        firmwareCodePlace: documentSnapshot.data()!.firmware_code_place,
        qmkRepositoryFirstPullRequestUrl: documentSnapshot.data()!
          .qmk_repository_first_pull_request_url,
        forkedRepositoryUrl: documentSnapshot.data()!.forked_repository_url,
        forkedRepositoryEvidence: documentSnapshot.data()!
          .forked_repository_evidence,
        otherPlaceHowToGet: documentSnapshot.data()!.other_place_how_to_get,
        otherPlaceSourceCodeEvidence: documentSnapshot.data()!
          .other_place_source_code_evidence,
        otherPlacePublisherEvidence: documentSnapshot.data()!
          .other_place_publisher_evidence,
        githubUid: providerData.uid,
        githubDisplayName: providerData.displayName,
        githubEmail: providerData.email,
      },
    };
  }
}
