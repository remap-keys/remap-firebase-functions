import AbstractCommand from '../abstract-command';
import { ERROR_UNCOMPLETED_TASK_EXISTS, IResult } from '../utils/types';
import { NeedAuthentication, ValidateRequired } from '../utils/decorators';
import { CloudTasksClient } from '@google-cloud/tasks';
import { google } from '@google-cloud/tasks/build/protos/protos';
import HttpMethod = google.cloud.tasks.v2.HttpMethod;
import * as functions from 'firebase-functions';

const PROJECT_ID = 'remap-b2d08';
const LOCATION = 'asia-northeast1';
const QUEUE = 'build-task-queue';
const BUILD_SERVER_URL = 'https://build.remap-keys.app';
const BUILD_SERVER_AUTH_SA_EMAIL = `remap-build-server-task-auth@${PROJECT_ID}.iam.gserviceaccount.com`;

export class CreateFirmwareBuildingTaskCommand extends AbstractCommand<IResult> {
  @NeedAuthentication()
  @ValidateRequired(['firmwareId', 'description', 'parametersJson'])
  async execute(
    data: any,
    context: functions.https.CallableContext
  ): Promise<IResult> {
    const firmwareId = data.firmwareId;
    const description = data.description;
    const parametersJson = data.parametersJson;
    const uid = context.auth!.uid;

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

    const task = {
      httpRequest: {
        headers: {
          'Content-Type': 'text/plain',
        },
        httpMethod: HttpMethod.GET,
        url: `${BUILD_SERVER_URL}/build?uid=${uid}&taskId=${taskId}`,
        oidcToken: {
          serviceAccountEmail: BUILD_SERVER_AUTH_SA_EMAIL,
        },
      },
    };
    const request = {
      parent,
      task,
    };
    const [response] = await client.createTask(request);
    console.log(
      `Creating the firmware building task was successfully. The response.name is ${response.name}`
    );

    return { success: true };
  }
}
