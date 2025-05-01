import AbstractCommand from '../abstract-command';
import { ERROR_UNCOMPLETED_TASK_EXISTS, IResult } from '../utils/types';
import { NeedAuthentication, ValidateRequired } from '../utils/decorators';
import { CloudTasksClient } from '@google-cloud/tasks';
import { google } from '@google-cloud/tasks/build/protos';
import { CallableRequest, CallableResponse } from 'firebase-functions/https';

const PROJECT_ID = 'remap-b2d08';
const LOCATION = 'asia-northeast1';
const QUEUE = 'build-task-queue';
const BUILD_SERVER_URL = 'https://build.remap-keys.app';
const BUILD_SERVER_AUTH_SA_EMAIL = `remap-build-server-task-auth@${PROJECT_ID}.iam.gserviceaccount.com`;

export class CreateFirmwareBuildingTaskCommand extends AbstractCommand<IResult> {
  @NeedAuthentication()
  @ValidateRequired(['firmwareId', 'description', 'parametersJson'])
  async execute(
    request: CallableRequest,
    _response: CallableResponse | undefined
  ): Promise<IResult> {
    const firmwareId = request.data.firmwareId;
    const description = request.data.description;
    const parametersJson = request.data.parametersJson;
    const uid = request.auth!.uid;

    const querySnapshot = await this.db
      .collection('build')
      .doc('v1')
      .collection('tasks')
      .where('uid', '==', uid)
      .where('status', 'in', ['waiting', 'building'])
      .get();
    if (0 < querySnapshot.size) {
      return {
        success: false,
        errorCode: ERROR_UNCOMPLETED_TASK_EXISTS,
        errorMessage: `The uncompleted task you registered exists.`,
      };
    }

    const ref = await this.db
      .collection('build')
      .doc('v1')
      .collection('tasks')
      .add({
        uid,
        firmwareId,
        status: 'waiting',
        firmwareFilePath: '',
        stdout: '',
        stderr: '',
        description,
        parametersJson,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const taskId = ref.id;

    const client = new CloudTasksClient();
    const parent = client.queuePath(PROJECT_ID, LOCATION, QUEUE);

    const [response] = await client.createTask({
      parent,
      task: {
        httpRequest: {
          headers: {
            'Content-Type': 'text/plain',
          },
          httpMethod: google.cloud.tasks.v2.HttpMethod.GET,
          url: `${BUILD_SERVER_URL}/build?uid=${uid}&taskId=${taskId}`,
          oidcToken: {
            serviceAccountEmail: BUILD_SERVER_AUTH_SA_EMAIL,
          },
        },
      },
    });
    console.log(
      `Creating the firmware building task was successfully. The response.name is ${response.name}`
    );

    return { success: true };
  }
}
