// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.qnAMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions)
       
        // create a DentistScheduler connector
        this.dentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration)

        // create a IntentRecognizer connector
        this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration)


        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.qnAMaker.getAnswers(context);

            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await'
            const luisResult = await this.intentRecognizer.executeLuisQuery(context)
                     
            // determine which service to respond with based on the results from LUIS //
            if (luisResult.luisResult.prediction.topIntent === "GetAvailability" &&
                luisResult.intents.GetAvailability.score > .5) {
                
                const msgAvailability = await this.dentistScheduler.getAvailability()
                const message = "Yes, we can schedule a visit! " + msgAvailability

                await context.sendActivity(message);
                console.log(message)
                await next();
                return;
            } else if(  luisResult.luisResult.prediction.topIntent === "ScheduleAppointment" &&
                        luisResult.intents.ScheduleAppointment.score > .5 &&
                        luisResult.entities.$instance &&
                        luisResult.entities.$instance.datetime &&
                        luisResult.entities.$instance.datetime[0]) {
                        
                        const response = await this.dentistScheduler.scheduleAppointment(luisResult.entities.$instance.datetime[0].text)

                        await context.sendActivity(response);
                        console.log(response)
                        await next();
                        return;
            }

            if(qnaResults[0]){
                await context.sendActivity(`${qnaResults[0].answer}`);
            } else {
                // If no answers were returned from QnA Maker, reply with help.
                await context.sendActivity(`I'm not sure I can answer your question`
                    + 'I can answer questions about who can access our services,'
                    + `gives info about availability of the Dental Office and schedule an appointment`);
            }

            // if(top intent is intentA and confidence greater than 50){
            //  doSomething();
            //  await context.sendActivity();
            //  await next();
            //  return;
            // }
            // else {...}
             
            await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = 'Welcome to the Dental Office Virtual Assistant service. You can ask me questions about availability and scheduling visits.';
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;
