// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints } = require('botbuilder');
const { ComponentDialog, DialogTurnStatus } = require('botbuilder-dialogs');

/**
 * This base class watches for common phrases like "help", "cancel", or "quit" and takes action on them
 * BEFORE they reach the normal bot logic.
 */
class CancelAndHelpDialog extends ComponentDialog {
    async onContinueDialog(innerDc) {
        const result = await this.interrupt(innerDc);
        if (result) {
            return result;
        }
        return await super.onContinueDialog(innerDc);
    }

    async interrupt(innerDc) {
        if (innerDc.context.activity.text) {
            const text = innerDc.context.activity.text.toLowerCase();

            switch (text) {
                case 'help':
                case '?': {
                    const helpMessageText = 'I can assist you with booking a bus or flight, modifying a booking, or answering your questions. How can I help you today?';
                    await innerDc.context.sendActivity(helpMessageText, helpMessageText, InputHints.ExpectingInput);
                    return { status: DialogTurnStatus.waiting };
                }
                case 'cancel':
                case 'quit': {
                    const cancelMessageText = 'Cancelling your request. Let me know if there’s anything else I can do for you!';
                    await innerDc.context.sendActivity(cancelMessageText, cancelMessageText, InputHints.IgnoringInput);
                    return await innerDc.cancelAllDialogs();
                }
                case 'thanks':
                case 'thank you': {
                    const thanksMessageText = 'You’re welcome! If you need any further assistance, feel free to ask.';
                    await innerDc.context.sendActivity(thanksMessageText, thanksMessageText, InputHints.IgnoringInput);
                    return { status: DialogTurnStatus.complete };
                }
                case 'welcome': {
                    const welcomeMessageText = 'Welcome to BookingWebsiteBot! I can help you book buses or flights. How can I assist you today?';
                    await innerDc.context.sendActivity(welcomeMessageText, welcomeMessageText, InputHints.ExpectingInput);
                    return { status: DialogTurnStatus.waiting };
                }
                default: {
                    // For any unrecognized input, let the dialog continue.
                    return undefined;
                }
            }
        }
    }
}

module.exports.CancelAndHelpDialog = CancelAndHelpDialog;
