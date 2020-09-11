import { AzureFunction, Context } from "@azure/functions"
const Airtable = require('airtable')
const axios = require('axios')
const cheerio = require('cheerio')
const baseUrl = 'https://forums.redflagdeals.com'
const moment = require('moment')
const sendgrid = require('@sendgrid/mail')

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
    var timeStamp = new Date().toISOString();
    
    if (myTimer.isPastDue)
    {
        context.log('Timer function is running late!');
    }

    const base = new Airtable({apiKey: process.env['AIRTABLE_API_KEY']}).base(process.env['AIRTABLE_BASE']);;

    sendgrid.setApiKey(process.env['SENDGRID_API_KEY'])

    const response = await axios.get('https://forums.redflagdeals.com/hot-deals-f9/?st=0&rfd_sk=tt&sd=d')
    const $ = cheerio.load(response.data)
    const posts = $('.row.topic:not(.sticky)')

    const rows = await base('redflag').select({
        maxRecords: 100,
        view: "Grid view"
    }).firstPage();

    posts.each(async(i, post) => {
        const postedDate = moment($(post).find('.first-post-time').text() + ' -0300', 'MMM Do, YYYY h:mm a Z', true)
        const currentDate = moment().subtract(1, 'hours')

        if (postedDate.diff(currentDate, 'hours') < -1) {
            return false
        }

        const title: string = $(post).find('.topic_title_link').text().trim()

        const found = rows.some((row) => title.toLowerCase().includes(row.fields.keyword))

        if (!found) {
            return
        }

        let link = baseUrl + $(post).find('.topic_title_link').attr('href')

        let msg = {
            to: 'dude.wallace@gmail.com',
            from: 'spencer.wallace@outlook.com',
            subject: 'Redflag',
            html: `<a href="${link}"><h1>${title}</h1></a>`
        }

        try {
            await sendgrid.send(msg)
        } catch (error) {
            console.log(error)
        }
    })
    context.log('Timer trigger function ran!', timeStamp);   
};

export default timerTrigger;
