import AbstractCommand from '../abstract-command';
import { IKeyboardDefinition, IResult } from '../utils/types';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
  ValidateIncludes,
  ValidateRequired,
} from '../utils/decorators';
import { CallableRequest, CallableResponse } from 'firebase-functions/https';

interface IFetchKeyboardDefinitionListByStatusCommandResult extends IResult {
  keyboardDefinitionList: IKeyboardDefinition[];
}

export class FetchKeyboardDefinitionListByStatusCommand extends AbstractCommand<IFetchKeyboardDefinitionListByStatusCommandResult> {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  @ValidateRequired(['status'])
  @ValidateIncludes({
    status: ['draft', 'in_review', 'rejected', 'approved'],
  })
  async execute(
    request: CallableRequest,
    _response: CallableResponse | undefined
  ): Promise<IFetchKeyboardDefinitionListByStatusCommandResult> {
    const querySnapshot = await this.db
      .collection('keyboards')
      .doc('v2')
      .collection('definitions')
      .where('status', '==', request.data.status)
      .orderBy('updated_at', 'desc')
      .get();
    return {
      success: true,
      keyboardDefinitionList: querySnapshot.docs.map((doc) => {
        return {
          id: doc.id,
          authorType: doc.data().author_type,
          authorUid: doc.data().uid,
          organizationId: doc.data().organization_id,
          createdAt: doc.data().created_at.toDate().getTime(),
          json: doc.data().json,
          name: doc.data().name,
          productId: doc.data().product_id,
          productName: doc.data().product_name,
          rejectReason: doc.data().reject_reason,
          status: doc.data().status,
          updatedAt: doc.data().updated_at.toDate().getTime(),
          vendorId: doc.data().vendor_id,
          githubUrl: doc.data().github_url,
          githubDisplayName: doc.data().github_display_name,
          firmwareCodePlace: doc.data().firmware_code_place,
          qmkRepositoryFirstPullRequestUrl:
            doc.data().qmk_repository_first_pull_request_url,
          forkedRepositoryUrl: doc.data().forked_repository_url,
          forkedRepositoryEvidence: doc.data().forked_repository_evidence,
          otherPlaceHowToGet: doc.data().other_place_how_to_get,
          otherPlaceSourceCodeEvidence:
            doc.data().other_place_source_code_evidence,
          otherPlacePublisherEvidence:
            doc.data().other_place_publisher_evidence,
          organizationEvidence: doc.data().organization_evidence,
          contactInformation: doc.data().contact_information,
        };
      }),
    };
  }
}
