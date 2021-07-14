import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { SitemapStream, streamToPromise } from 'sitemap';
import { Readable } from 'stream';
import * as moment from 'moment';
import { createGzip } from 'zlib';

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

  async execute(
    req: functions.Request,
    res: functions.Response
  ): Promise<void> {
    const urlEntries: IUrlEntry[] = [
      {
        url: `/`,
      },
      {
        url: '/catalog',
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
        lastmod: moment(keyboard.data().updated_at.toDate()).toISOString(),
      });
      urlEntries.push({
        url: `/catalog/${keyboard.id}/keymap`,
        lastmod: moment(keyboard.data().updated_at.toDate()).toISOString(),
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
