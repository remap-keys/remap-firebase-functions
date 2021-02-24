export const ERROR_NOT_ADMINISTRATOR = 1;
export const ERROR_VALIDATION = 2;
export const ERROR_KEYBOARD_DEFINITION_NOT_FOUND = 3;

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

export interface IKeyboardDefinition {
  readonly id: string;
  readonly authorUid: string;
  readonly name: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly status: IKeyboardDefinitionStatus;
  readonly json: string;
  readonly rejectReason: string | undefined;
  readonly githubUrl: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface IKeyboardDefinitionDetail extends IKeyboardDefinition {
  readonly githubUid: string;
  readonly githubDisplayName: string;
  readonly githubEmail: string;
}

export interface IResult {
  success: boolean;
  errorCode?: number;
  errorMessage?: string;
}
