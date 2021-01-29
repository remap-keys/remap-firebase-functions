# remap-discord-notifier

This project provides a notification mechanism for Remap review process.

## Prepare

You need to create a `.env` file before deploying this project. The `.env` file is a plain text file with the following values:

* `discord.webhook=<DISCORD_WEBHOOK_URL>` - The webhook URL to send a notification to Discord.
* `firestore.definition_document_url=<FIRESTORE_DEFINITION_DOCUMENT_URL>` - The URL to open the target document of the keyboard definition on Firesore console.
