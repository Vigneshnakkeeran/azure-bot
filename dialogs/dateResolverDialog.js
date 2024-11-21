// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory } = require('botbuilder');
const { DateTimePrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');

const DATETIME_PROMPT = 'datetimePrompt';
const WATERFALL_DIALOG = 'waterfallDialog';

class DateResolverDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id || 'dateResolverDialog');
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT, this.dateTimePromptValidator.bind(this)))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.initialStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * Prompt the user for a travel date if it's not already provided or is ambiguous.
     */
    async initialStep(stepContext) {
        const travelDate = stepContext.options.date;

        const promptMessageText = 'On what date would you like to travel? Please provide the month, day, and year.';
        const promptMessage = MessageFactory.text(promptMessageText, promptMessageText, InputHints.ExpectingInput);

        const repromptMessageText = "I'm sorry, I didn't understand. Please provide the travel date in MM/DD/YYYY format.";
        const repromptMessage = MessageFactory.text(repromptMessageText, repromptMessageText, InputHints.ExpectingInput);

        if (!travelDate) {
            // If no travel date was provided, prompt the user.
            return await stepContext.prompt(DATETIME_PROMPT, {
                prompt: promptMessage,
                retryPrompt: repromptMessage
            });
        }

        // Validate if the provided date is definite or ambiguous.
        const timexProperty = new TimexProperty(travelDate);
        if (!timexProperty.types.has('definite')) {
            // If ambiguous, prompt again.
            return await stepContext.prompt(DATETIME_PROMPT, { prompt: repromptMessage });
        }

        return await stepContext.next([{ timex: travelDate }]);
    }

    /**
     * Finalize the dialog by returning the resolved travel date.
     */
    async finalStep(stepContext) {
        const travelDate = stepContext.result[0].timex;
        return await stepContext.endDialog(travelDate);
    }

    /**
     * Validates the user's input as a valid and definite date.
     */
    async dateTimePromptValidator(promptContext) {
        if (promptContext.recognized.succeeded) {
            // Extract the TIMEX and ensure it's a definite date.
            const timex = promptContext.recognized.value[0].timex.split('T')[0];

            // Check if the TIMEX is a definite date (contains year, month, and day).
            return new TimexProperty(timex).types.has('definite');
        }
        return false;
    }
}

module.exports.DateResolverDialog = DateResolverDialog;
