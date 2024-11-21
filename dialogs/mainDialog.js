// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { MessageFactory, InputHints } = require('botbuilder');
const { ComponentDialog, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

class MainDialog extends ComponentDialog {
    constructor(cluRecognizer, bookingDialog) {
        super('MainDialog');

        if (!cluRecognizer) throw new Error('[MainDialog]: Missing parameter \'cluRecognizer\' is required');
        this.cluRecognizer = cluRecognizer;

        if (!bookingDialog) throw new Error('[MainDialog]: Missing parameter \'bookingDialog\' is required');

        // Define the main dialog and its related components.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(bookingDialog)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * Handles the initial greeting and prompts the user for input.
     */
    async introStep(stepContext) {
        if (!this.cluRecognizer.isConfigured) {
            const messageText = 'NOTE: CLU is not configured. To enable all capabilities, add `CluAPIKey` and `CluAPIHostName` to the .env file.';
            await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }

        const messageText = stepContext.options.restartMsg ? stepContext.options.restartMsg : 'Hello there! How can I help you today?';
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
    }

    /**
     * Processes the user's intent and entities using CLU and routes to the appropriate child dialog.
     */
    async actStep(stepContext) {
        const bookingDetails = {};

        if (!this.cluRecognizer.isConfigured) {
            // CLU is not configured, we just run the BookingDialog path.
            return await stepContext.beginDialog('bookingDialog', bookingDetails);
        }

        // Call CLU and gather intent and entity data.
        const cluResult = await this.cluRecognizer.executeCluQuery(stepContext.context);
        const intent = this.cluRecognizer.topIntent(cluResult);
        switch (intent) {
            case 'BookFlight':
            case 'BookBus': {
                // Extract the entities based on intent.
                const fromEntities = this.cluRecognizer.getFromEntities(cluResult);
                const toEntities = this.cluRecognizer.getToEntities(cluResult);

                // Show warnings for unsupported locations.
                await this.showWarningForUnsupportedLocations(stepContext.context, fromEntities, toEntities);

                // Populate booking details.
                bookingDetails.bookingType = intent === 'BookFlight' ? 'flight' : 'bus';
                bookingDetails.destination = toEntities.to || toEntities.station;
                bookingDetails.origin = fromEntities.from || fromEntities.station;
                bookingDetails.travelDate = this.cluRecognizer.getTravelDate(cluResult);
                console.log('CLU extracted these booking details:', JSON.stringify(bookingDetails));

                // Run the BookingDialog with the extracted details.
                return await stepContext.beginDialog('bookingDialog', bookingDetails);
            }

            case 'Thanks': {
                const thanksMessageText = 'You’re welcome! Let me know if there’s anything else I can assist you with.';
                await stepContext.context.sendActivity(thanksMessageText, thanksMessageText, InputHints.IgnoringInput);
                break;
            }

            default: {
                // Handle unrecognized intents.
                const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way (intent was ${intent}).`;
                await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
            }
        }

        return await stepContext.next();
    }

    /**
     * Shows a warning if the requested From or To locations are recognized but not supported.
     */
    async showWarningForUnsupportedLocations(context, fromEntities, toEntities) {
        const unsupportedLocations = [];
        if (fromEntities.from && !fromEntities.station && !fromEntities.airport) {
            unsupportedLocations.push(fromEntities.from);
        }

        if (toEntities.to && !toEntities.station && !toEntities.airport) {
            unsupportedLocations.push(toEntities.to);
        }

        if (unsupportedLocations.length) {
            const messageText = `Sorry, but the following locations are not supported: ${unsupportedLocations.join(', ')}`;
            await context.sendActivity(messageText, messageText, InputHints.IgnoringInput);
        }
    }

    /**
     * Wraps up the interaction and restarts the dialog for further assistance.
     */
    async finalStep(stepContext) {
        if (stepContext.result) {
            const result = stepContext.result;
            const timeProperty = new TimexProperty(result.travelDate);
            const travelDateMsg = timeProperty.toNaturalLanguage(new Date(Date.now()));
            const msg = `I have you booked for a ${result.bookingType} to ${result.destination} from ${result.origin} on ${travelDateMsg}.`;
            await stepContext.context.sendActivity(msg, msg, InputHints.IgnoringInput);
        }

        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: 'What else can I do for you?' });
    }
}

module.exports.MainDialog = MainDialog;
