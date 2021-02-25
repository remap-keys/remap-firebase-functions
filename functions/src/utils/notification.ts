import * as functions from 'firebase-functions';
import * as jwt from 'jsonwebtoken';
import * as axios from 'axios';
import * as admin from 'firebase-admin';

const DISCORD_WEBHOOK_URL = functions.config().discord.webhook;

export type INotificationData = {
  name: string;
  product_name: string;
  author_uid: string;
  status: string;
};

export const notifyMessageToDiscord = async (
  definitionId: string,
  message: string
): Promise<void> => {
  const docUrl = `https://admin.remap-keys.app/review/${definitionId}`;
  await axios.default.post<void>(DISCORD_WEBHOOK_URL, {
    content: `${message} ${docUrl}`,
  });
};

export const notifyReviewStatusChangeMessageToDiscordAndGAS = async (
  definitionId: string,
  data: INotificationData
): Promise<void> => {
  const message = `The review status has been changed (${data.status}): ${data.name}(${data.product_name})`;
  await notifyMessageToDiscord(definitionId, message);
  const userRecord = await admin.auth().getUser(data.author_uid);
  const providerData = userRecord.providerData[0];
  const payload = {
    messageType: 'received',
    email: providerData.email,
    displayName: providerData.displayName,
    keyboard: data.name,
    status: data.status,
    definitionId,
  };
  await notifyWithGAS(payload);
};

export const notifyWithGAS = async (payload: any): Promise<void> => {
  const jwtSecret = functions.config().jwt.secret;
  const jwtOptions: jwt.SignOptions = {
    algorithm: 'HS256',
    expiresIn: '3m',
  };
  const token = jwt.sign(payload, jwtSecret, jwtOptions);
  await axios.default.post<void>(functions.config().notification.url, {
    token,
    payload,
  });
};
