import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as axios from 'axios';
import { parse } from 'node-html-parser';

type IKeyboardDefinition = {
  id: string;
  name: string;
  description: string;
  image: string;
};

type IFetchDefinitionDocumentResult = {
  exists: boolean;
  definition?: IKeyboardDefinition;
};

export default class GenerateCatalogPageCommand {
  protected db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  private static async fetchRemapIndexHtml(): Promise<string> {
    const response = await axios.default.get('https://remap-keys.app/');
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(`Fetching index.html failed. status=${response.status}`);
    }
  }

  async execute(
    req: functions.Request,
    res: functions.Response
  ): Promise<void> {
    const html = await GenerateCatalogPageCommand.fetchRemapIndexHtml();
    const root = parse(html);
    const path = req.path;
    const regexp = /\/catalog\/([a-zA-Z0-9]+)/;
    const m = path.match(regexp);
    let definitionDocumentId = undefined;
    if (m) {
      definitionDocumentId = m[1];
    }
    if (definitionDocumentId) {
      const result = await this.fetchDefinitionDocument(definitionDocumentId);
      if (result.exists) {
        const title = root.querySelector('title');
        if (title !== null) {
          title.set_content(`${result.definition!.name} - Remap`);
        }
        const ogTitle = root.querySelector('meta[property="og:title"]');
        if (ogTitle !== null) {
          ogTitle.setAttribute('content', `${result.definition!.name} - Remap`);
        }
        if (result.definition!.description) {
          const description = root.querySelector('meta[name="description"]');
          if (description !== null) {
            description.setAttribute('content', result.definition!.description);
          }
          const ogDescription = root.querySelector(
            'meta[property="og:description"]'
          );
          if (ogDescription !== null) {
            ogDescription.setAttribute(
              'content',
              result.definition!.description
            );
          }
        }
        if (result.definition!.image) {
          const ogImage = root.querySelector('meta[property="og:image"]');
          if (ogImage !== null) {
            ogImage.setAttribute('content', result.definition!.image);
          }
        }
        const ogUrl = root.querySelector('meta[property="og:url"]');
        if (ogUrl !== null) {
          ogUrl.setAttribute(
            'content',
            `https://remap-keys.app/catalog/${result.definition!.id}`
          );
        }
      }
    }
    res.send(root.toString());
  }

  async fetchDefinitionDocument(
    id: string
  ): Promise<IFetchDefinitionDocumentResult> {
    try {
      const documentSnapshot = await this.db
        .collection('keyboards')
        .doc('v2')
        .collection('definitions')
        .doc(id)
        .get();
      if (documentSnapshot.exists) {
        let description = documentSnapshot.data()!.description;
        if (description) {
          description = this.cutStringLength(description, 120);
        }
        return {
          exists: true,
          definition: {
            id: documentSnapshot.id,
            name: documentSnapshot.data()!.name,
            description: description,
            image: documentSnapshot.data()!.image_url,
          },
        };
      } else {
        return {
          exists: false,
        };
      }
    } catch (error) {
      console.error(error);
      return {
        exists: false,
      };
    }
  }

  cutStringLength(source: string, length: number): string {
    let trimmed = source.slice(0, length);
    if (source.length !== trimmed.length) {
      trimmed = `${trimmed}...`;
    }
    return trimmed;
  }
}
