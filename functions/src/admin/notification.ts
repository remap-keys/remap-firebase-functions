import * as functions from 'firebase-functions';
import * as jwt from 'jsonwebtoken';
import * as axios from 'axios';

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
