import { CallableRequest, CallableResponse } from 'firebase-functions/https';
import AbstractCommand from '../abstract-command';
import {
  NeedAdministratorPermission,
  NeedAuthentication,
} from '../utils/decorators';
import {
  IKeyboardDefinitionStatus,
  IResult,
  KeyboardDefinitionStatus,
} from '../utils/types';

interface IFetchKeyboardDefinitionStatsResult extends IResult {
  totalCount?: number;
  draftCount?: number;
  inReviewCount?: number;
  rejectedCount?: number;
  approvedCount?: number;
}

export class FetchKeyboardDefinitionStatsCommand extends AbstractCommand<IFetchKeyboardDefinitionStatsResult> {
  @NeedAuthentication()
  @NeedAdministratorPermission()
  async execute(
    _request: CallableRequest,
    _response: CallableResponse | undefined
  ): Promise<IFetchKeyboardDefinitionStatsResult> {
    const querySnapshot = await this.db
      .collection('keyboards')
      .doc('v2')
      .collection('definitions')
      .get();
    const docs = querySnapshot.docs;
    const result: IFetchKeyboardDefinitionStatsResult = {
      success: true,
      totalCount: docs.length,
      draftCount: 0,
      inReviewCount: 0,
      rejectedCount: 0,
      approvedCount: 0,
    };
    for (const doc of docs) {
      const status: IKeyboardDefinitionStatus = doc.data().status;
      switch (status) {
        case KeyboardDefinitionStatus.draft:
          result.draftCount!++;
          break;
        case KeyboardDefinitionStatus.in_review:
          result.inReviewCount!++;
          break;
        case KeyboardDefinitionStatus.rejected:
          result.rejectedCount!++;
          break;
        case KeyboardDefinitionStatus.approved:
          result.approvedCount!++;
          break;
      }
    }
    return result;
  }
}
