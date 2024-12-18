// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { InputHints, MessageFactory } = require('botbuilder');
const { ConfirmPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { DateResolverDialog } = require('./dateResolverDialog');

const CONFIRM_PROMPT = 'confirmPrompt';
const DATE_RESOLVER_DIALOG = 'dateResolverDialog';
const TEXT_PROMPT = 'textPrompt';
const WATERFALL_DIALOG = 'waterfallDialog';

class BookingDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id || 'bookingDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new DateResolverDialog(DATE_RESOLVER_DIALOG))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.bookingTypeStep.bind(this),
                this.destinationStep.bind(this),
                this.originStep.bind(this),
                this.travelDateStep.bind(this),
                this.confirmStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * Prompt for the type of booking (bus or flight).
     */
    async bookingTypeStep(stepContext) {
        const bookingDetails = stepContext.options;

        if (!bookingDetails.bookingType) {
            const messageText = 'Are you booking a bus or a flight?';
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(bookingDetails.bookingType);
    }

    /**
     * If a destination has not been provided, prompt for one.
     */
    async destinationStep(stepContext) {
        const bookingDetails = stepContext.options;

        bookingDetails.bookingType = stepContext.result;
        if (!bookingDetails.destination) {
            const messageText = `To what ${bookingDetails.bookingType === 'bus' ? 'station' : 'city'} would you like to travel?`;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(bookingDetails.destination);
    }

    /**
     * If an origin has not been provided, prompt for one.
     */
    async originStep(stepContext) {
        const bookingDetails = stepContext.options;

        bookingDetails.destination = stepContext.result;
        if (!bookingDetails.origin) {
            const messageText = `From what ${bookingDetails.bookingType === 'bus' ? 'station' : 'city'} will you be travelling?`;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(bookingDetails.origin);
    }

    /**
     * If a travel date has not been provided, prompt for one using DATE_RESOLVER_DIALOG.
     */
    async travelDateStep(stepContext) {
        const bookingDetails = stepContext.options;

        bookingDetails.origin = stepContext.result;
        if (!bookingDetails.travelDate || this.isAmbiguous(bookingDetails.travelDate)) {
            return await stepContext.beginDialog(DATE_RESOLVER_DIALOG, { date: bookingDetails.travelDate });
        }
        return await stepContext.next(bookingDetails.travelDate);
    }

    /**
     * Confirm the information the user has provided.
     */
    async confirmStep(stepContext) {
        const bookingDetails = stepContext.options;

        bookingDetails.travelDate = stepContext.result;
        const messageText = `Please confirm, I have you traveling by ${bookingDetails.bookingType} to: ${bookingDetails.destination} from: ${bookingDetails.origin} on: ${bookingDetails.travelDate}. Is this correct?`;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);

        return await stepContext.prompt(CONFIRM_PROMPT, { prompt: msg });
    }

    /**
     * Complete the interaction and end the dialog.
     */
    async finalStep(stepContext) {
        if (stepContext.result === true) {
            const bookingDetails = stepContext.options;
            return await stepContext.endDialog(bookingDetails);
        }
        return await stepContext.endDialog();
    }

    isAmbiguous(timex) {
        const timexProperty = new TimexProperty(timex);
        return !timexProperty.types.has('definite');
    }
}

module.exports.BookingDialog = BookingDialog;
