# remap-firebase-functions

This project has some Firebase Functions to provide backend logics for Remap. 

## Prepare

You need to create a `.env` file before deploying this project. The `.env` file is a plain text file with the following values:

* `discord.webhook=<DISCORD_WEBHOOK_URL>` - The webhook URL to send a notification to Discord.
* `firestore.definition_document_url=<FIRESTORE_DEFINITION_DOCUMENT_URL>` - The URL to open the target document of the keyboard definition on Firestore console.
