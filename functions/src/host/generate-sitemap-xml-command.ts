import * as admin from 'firebase-admin';
import { SitemapStream, streamToPromise } from 'sitemap';
import { Readable } from 'stream';
import { createGzip } from 'zlib';
import { formatISO } from 'date-fns';
import * as express from 'express';

type IUrlEntry = {
  url: string;
  lastmod?: string;
};

const REMAP_TOP_URL = 'https://remap-keys.app';

export default class GenerateSitemapXmlCommand {
  protected db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async execute(req: express.Request, res: express.Response): Promise<void> {
    const urlEntries: IUrlEntry[] = [
      {
        url: `/`,
      },
      {
        url: '/catalog',
      },
      {
        url: '/docs/terms_of_use',
      },
      {
        url: '/docs/review_policy',
      },
      {
        url: '/docs/faq',
      },
    ];

    const keyboardsSnapshot = await this.db
      .collection('keyboards')
      .doc('v2')
      .collection('definitions')
      .where('status', '==', 'approved')
      .get();
    for (const keyboard of keyboardsSnapshot.docs) {
      urlEntries.push({
        url: `/catalog/${keyboard.id}`,
        lastmod: formatISO(keyboard.data().updated_at.toDate()),
      });
    }

    const stream = new SitemapStream({ hostname: REMAP_TOP_URL });
    const data = await streamToPromise(
      Readable.from(urlEntries).pipe(stream).pipe(createGzip())
    );
    stream.end();
    res.header('Content-Type', 'application/xml');
    res.header('Content-Encoding', 'gzip');
    res.send(data);
  }
}
