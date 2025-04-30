import * as jwt from 'jsonwebtoken';
import * as axios from 'axios';
import { Auth } from 'firebase-admin/auth';

export type INotificationData = {
  name: string;
  product_name: string;
  author_uid: string;
  status: string;
};

export const notifyMessageToDiscord = async (
  definitionId: string,
  message: string,
  discordWebhook: string
): Promise<void> => {
  const docUrl = `https://admin.remap-keys.app/review/${definitionId}`;
  await axios.default.post<void>(discordWebhook, {
    content: `${message} ${docUrl}`,
  });
};

export const notifyReviewStatusChangeMessageToDiscordAndGAS = async (
  auth: Auth,
  definitionId: string,
  data: INotificationData,
  discordWebhook: string,
  jwtSecret: string,
  notificationUrl: string
): Promise<void> => {
  const message = `The review status has been changed (${data.status}): ${data.name}(${data.product_name})`;
  await notifyMessageToDiscord(definitionId, message, discordWebhook);
  const userRecord = await auth.getUser(data.author_uid);
  const providerData = userRecord.providerData[0];
  const payload = {
    messageType: 'received',
    email: providerData.email,
    displayName: providerData.displayName,
    keyboard: data.name,
    status: data.status,
    definitionId,
  };
  await notifyWithGAS(payload, jwtSecret, notificationUrl);
};

export const notifyWithGAS = async (
  payload: any,
  jwtSecret: string,
  notificationUrl: string
): Promise<void> => {
  const jwtOptions: jwt.SignOptions = {
    algorithm: 'HS256',
    expiresIn: '3m',
  };
  const token = jwt.sign(payload, jwtSecret, jwtOptions);
  await axios.default.post<void>(notificationUrl, {
    token,
    payload,
  });
};
