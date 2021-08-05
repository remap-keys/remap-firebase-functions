import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as qs from 'qs';

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

type IEscapeParam = {
  value: string;
  escape: boolean;
};

export default class GenerateCatalogPageCommand {
  protected db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async execute(
    req: functions.Request,
    res: functions.Response
  ): Promise<void> {
    const path = req.path;
    const queryParams = req.query;
    const referrer = req.get('Referrer');
    if (referrer) {
      queryParams.referrer = referrer;
    }
    const query = qs.stringify(queryParams, { addQueryPrefix: true });
    const regexp = /^\/catalog\/([a-zA-Z0-9]+)/;
    const m = path.match(regexp);
    let definitionDocumentId = undefined;
    if (m) {
      definitionDocumentId = m[1];
    }
    if (definitionDocumentId) {
      const result = await this.fetchDefinitionDocument(definitionDocumentId);
      if (result.exists) {
        res.send(
          this.replacePlaceholders(INDEX_HTML, {
            TITLE: {
              value: `${result.definition!.name} - Remap`,
              escape: true,
            },
            DESCRIPTION: {
              value: result.definition!.description,
              escape: true,
            },
            IMAGE: { value: result.definition!.image, escape: true },
            URL: {
              value: `https://remap-keys.app/catalog/${result.definition!.id}`,
              escape: true,
            },
            REDIRECT: {
              value: this.createRedirectUrl(path, query),
              escape: false,
            },
          })
        );
      } else {
        res.send(
          this.replacePlaceholders(INDEX_HTML, {
            ...STANDARD_OGP,
            REDIRECT: {
              value: this.createRedirectUrl(path, query),
              escape: false,
            },
          })
        );
      }
    } else {
      res.send(
        this.replacePlaceholders(INDEX_HTML, {
          ...STANDARD_OGP,
          REDIRECT: {
            value: this.createRedirectUrl(path, query),
            escape: false,
          },
        })
      );
    }
  }

  createRedirectUrl(path: string, query: string): string {
    return `https://remap-keys.app/_${path.substring(1)}${query}`;
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
          description = this.curStringLength(description, 120);
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

  curStringLength(source: string, length: number): string {
    let trimmed = source.slice(0, length);
    if (source.length !== trimmed.length) {
      trimmed = `${trimmed}...`;
    }
    return trimmed;
  }

  replacePlaceholders(
    template: string,
    params: { [p: string]: IEscapeParam }
  ): string {
    let result = template;
    for (const key of Object.keys(params)) {
      let param = params[key];
      if (!param) {
        param = STANDARD_OGP[key];
      }
      result = result
        .split(`%${key}%`)
        .join(param.escape ? this.escapeHtml(param.value) : param.value);
    }
    return result;
  }

  escapeHtml(text: string): string {
    const map: { [p: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

const STANDARD_OGP: { [p: string]: IEscapeParam } = {
  TITLE: { value: 'Remap', escape: true },
  DESCRIPTION: {
    value:
      'Remap allows you to configure key mappings and lighting of your keyboard with QMK firmware in Web Browser.',
    escape: true,
  },
  IMAGE: { value: 'https://remap-keys.app/ogp_image.png', escape: true },
  URL: { value: 'https://remap-keys.app', escape: true },
};

const INDEX_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head prefix="og: http://ogp.me/ns#">
    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag('js', new Date());
    </script>

    <meta charset="utf-8" />
    <link rel="icon" href="https://remap-keys.app/favicon.ico" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
    />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/icon?family=Material+Icons"
    />

    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <meta name="theme-color" content="#000000" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Remap" />

    <meta property="og:title" content="%TITLE%" data-rh="true" />
    <meta
      name="description"
      content="%DESCRIPTION%"
      data-rh="true"
    />
    <meta
      property="og:description"
      content="%DESCRIPTION%"
      data-rh="true"
    />
    <meta property="og:url" content="%URL%" data-rh="true" />
    <meta
      property="og:image"
      content="%IMAGE%"
      data-rh="true"
    />

    <title>%TITLE%</title>

    <link rel="apple-touch-icon" href="https://remap-keys.app/logo192.png" />
    <link rel="manifest" href="https://remap-keys.app/manifest.json" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Remap",
        "description": "Remap allows you to configure key mappings and lighting of your keyboard with QMK firmware in Web Browser.",
        "url": "https://remap-keys.app",
        "image": "https://remap-keys.app/ogp_image.png",
        "applicationCategory": "UtilitiesApplication",
        "operatingSystem": "Chromium-based Web Browsers",
        "offers": {
          "@type": "Offer",
          "price": "0"
        },
        "browserRequirements": "requires Chrome or Edge 89 or higher",
        "featureList": "Customize a key mapping of your keyboard, Save/restore/share your key mappings with other users, Test key switch matrix, Control LEDs",
        "releaseNotes": "https://github.com/remap-keys/remap/wiki/Release-notes",
        "keywords": "remap,keyboard,keymap,qmk,via,customize,led,diy,webhid"
      }
    </script>
  </head>
  <body>
    <script type="text/javascript">
      setTimeout(() => {
        location.href = "%REDIRECT%";
      }, 0);
    </script>
  </body>
</html>
`;
