import * as functions from 'firebase-functions';
import AbstractCommand from '../abstract-command';
import { ERROR_NOT_ADMINISTRATOR, ERROR_VALIDATION } from '../utils/types';

export function NeedAuthentication() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const context = args[1] as functions.https.CallableContext;
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Unauthenticated.'
        );
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

export function NeedAdministratorPermission() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const self = this;
      return new Promise((resolve, reject) => {
        const context = args[1] as functions.https.CallableContext;
        const uid = context.auth!.uid;
        (self as AbstractCommand).checkUserIsAdministrator
          .apply(self, [uid])
          .then((result) => {
            if (result) {
              resolve(originalMethod.apply(self, args));
            } else {
              resolve({
                success: false,
                errorCode: ERROR_NOT_ADMINISTRATOR,
                errorMessage: `User[${uid}] is not an administrator.`,
              });
            }
          })
          .catch((reason) => {
            throw new Error(reason);
          });
      });
    };
    return descriptor;
  };
}

export function ValidateRequired(targets: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const data = args[0];
      for (const name of targets) {
        const value = data[name];
        if (value === undefined) {
          return {
            success: false,
            errorCode: ERROR_VALIDATION,
            errorMessage: `The "${name}" is required.`,
          };
        }
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

export function ValidateIncludes(rules: { [p: string]: any[] }) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const data = args[0];
      for (const name of Object.keys(rules)) {
        const value = data[name];
        if (value && !rules[name].includes(value)) {
          return {
            success: false,
            errorCode: ERROR_VALIDATION,
            errorMessage: `The "${name}" must be included in ${rules[name]}.`,
          };
        }
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}
