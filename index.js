const express = require('express')
const app = express()
const axios = require('axios')
const cheerio = require('cheerio')
const NodeCache = require( "node-cache" );
const appCache = new NodeCache(
    {   stdTTL: 600, 
        checkperiod: 600, 
        errorOnMissing: false, 
        useClones: true, 
        deleteOnExpire: true 
    });
const TOP_DRINKER_CACHE_KEY = 'topDrinkers';
const MEMBERS_CACHE_KEY = 'members';

const PORT = process.env.PORT || 3000

var bodyParser = require('body-parser')

app.use(bodyParser.json()) // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })) // support encoded bodies


app.get('/', function (req, res) {
    res.send('cheers!');
});

app.get('/topdrinkers', async (req, res) => {
    //grab data from the cache if it's there
    appCache.get(TOP_DRINKER_CACHE_KEY, function(err, value){
        if(!err){
            if(value == undefined){
                //fetch from server
                axios.get('http://www.mahaffeyspub.com/beer/td.php')
                .then(response => {
                    const data = parseTopDrinkers(response.data);
                    appCache.set( TOP_DRINKER_CACHE_KEY, data);
                    res.header('Content-Type', 'application/json');
                    res.send(JSON.stringify(data, null, 2));
                })
                .catch( error => {
                    console.log(error);
                    res.send('oopsie');
                });
            }
            else{
                //fetch from the cache
                res.send(JSON.stringify(value, null, 2));
            }
            return value;
        }
    });
 });

 app.get('/members', async (req, res) => {
    //grab data from the cache if it's there
    appCache.get(MEMBERS_CACHE_KEY, function(err, value){
        if(!err){
            if(value == undefined){
                //fetch from server
                axios.get('http://www.mahaffeyspub.com/beer/member_list.php')
                .then(response => {
                    const data = parseMembers(response.data);
                    appCache.set( MEMBERS_CACHE_KEY, data);
                    res.header('Content-Type', 'application/json');
                    res.send(JSON.stringify(data, null, 2));
                })
                .catch( error => {
                    console.log(error);
                    res.send('oopsie');
                });
            }
            else{
                //fetch from the cache
                res.send(JSON.stringify(value, null, 2));
            }
            return value;
        }
    });
 });

var server = app.listen(PORT, function () {
	var host = server.address().address;
	host = (host === '::' ? 'localhost' : host);
	var port = server.address().port;

	console.log('listening at http://%s:%s', host, port);
});

const parseTopDrinkers = html => {
    let data = [];

    const $ = cheerio.load(html);
    $('body').contents().each((i, elem) => {
        if(elem.type == 'text'){
            let arr = elem.data.split('..........');
            let name = arr[1] + '';
            data.push({
                name: name.replace('\n', ''),
                beerCount:  arr[0]
            });
        }
    });
    return data;
}

const parseMembers = html => {
    let data = [];

    const $ = cheerio.load(html);
    $('body').contents().each((i, elem) => {
        if(elem.type == 'text'){
            let arr = elem.data.split('--');
            let name = arr[0] + '';
            let memberId = arr[1] + '';
            data.push({
                name: name.replace('\n', ''),
                memberId:  memberId.replace('\n', '')
            });
        }
    });
    data.splice(0, 12); //yes 12 is a magic number, get used to it
    data.splice(data.length - 1, 1);
    return data;
}