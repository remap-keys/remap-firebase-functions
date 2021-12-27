export const ERROR_NOT_ADMINISTRATOR = 1;
export const ERROR_VALIDATION = 2;
export const ERROR_KEYBOARD_DEFINITION_NOT_FOUND = 3;
export const ERROR_ORGANIZATION_NOT_FOUND = 4;

export type IKeyboardDefinitionStatus =
  | 'draft'
  | 'in_review'
  | 'rejected'
  | 'approved';
export const KeyboardDefinitionStatus: {
  [p: string]: IKeyboardDefinitionStatus;
} = {
  draft: 'draft',
  in_review: 'in_review',
  rejected: 'rejected',
  approved: 'approved',
};

export type IFirmwareCodePlace = 'qmk' | 'forked' | 'other';
export const FirmwareCodePlace: { [p: string]: IFirmwareCodePlace } = {
  qmk: 'qmk',
  forked: 'forked',
  other: 'other',
};

export interface IKeyboardDefinition {
  readonly id: string;
  readonly authorType: 'individual' | 'organization';
  readonly authorUid: string;
  readonly organizationId: string | undefined;
  readonly name: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly status: IKeyboardDefinitionStatus;
  readonly json: string;
  readonly rejectReason: string | undefined;
  readonly githubUrl: string;
  readonly githubDisplayName: string;
  readonly firmwareCodePlace: IFirmwareCodePlace;
  readonly qmkRepositoryFirstPullRequestUrl: string;
  readonly forkedRepositoryUrl: string;
  readonly forkedRepositoryEvidence: string;
  readonly otherPlaceHowToGet: string;
  readonly otherPlaceSourceCodeEvidence: string;
  readonly otherPlacePublisherEvidence: string;
  readonly organizationEvidence: string;
  readonly contactInformation: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface IKeyboardDefinitionDetail extends IKeyboardDefinition {
  readonly githubUid: string;
  readonly githubDisplayName: string;
  readonly githubEmail: string;
}

export interface IOrganization {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly iconImageUrl: string;
  readonly websiteUrl: string;
  readonly contactEmailAddress: string;
  readonly contactPersonName: string;
  readonly contactTel: string;
  readonly contactAddress: string;
  readonly members: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IResult {
  success: boolean;
  errorCode?: number;
  errorMessage?: string;
}
