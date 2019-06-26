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
    //res.send('cheers!');
    res.redirect('/docs');
});
app.use(express.static('public'))

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

 app.get('/members/beers/:memberId', async (req, res) => {
    const memberId = req.params.memberId;
    //grab data from the cache if it's there
    //appCache.get(MEMBERS_CACHE_KEY, function(err, value){
        //if(!err){
            //if(value == undefined){
                //fetch from server
                const formData = 'member_id_num=' + memberId;
                axios.post('http://www.mahaffeyspub.com/beer/beers_consumed.php', formData)
                .then(response => {
                    const data = parseMemberBeers(response.data);
                    //appCache.set( MEMBERS_CACHE_KEY, data);
                    res.header('Content-Type', 'application/json');
                    res.send(JSON.stringify(data, null, 2));
                })
                .catch( error => {
                    console.log(error);
                    res.send('oopsie');
                });
            //}
            //else{
                //fetch from the cache
                //res.send(JSON.stringify(value, null, 2));
            //}
            //return value;
        //}
    });

    app.get('/members/beers/todrink/:memberId', async (req, res) => {
        const memberId = req.params.memberId;
        //grab data from the cache if it's there
        //appCache.get(MEMBERS_CACHE_KEY, function(err, value){
            //if(!err){
                //if(value == undefined){
                    //fetch from server
                    const formData = 'member_id_num=' + memberId;
                    axios.get('http://www.mahaffeyspub.com/beer/beers_to_drink.php?member_id_num=' + memberId)
                    .then(response => {
                        const data = parseBeersToDrink(response.data);
                        //appCache.set( MEMBERS_CACHE_KEY, data);
                        res.header('Content-Type', 'application/json');
                        res.send(JSON.stringify(data, null, 2));
                    })
                    .catch( error => {
                        console.log(error);
                        res.send('oopsie');
                    });
                //}
                //else{
                    //fetch from the cache
                    //res.send(JSON.stringify(value, null, 2));
                //}
                //return value;
            //}
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

    //the page is split into two sections and effectively duplicates the data.
    //we use this flag to know when we've hit the second section (the ordered list of users)
    //and can begin collecting the data
    let collectData = false;
    const $ = cheerio.load(html);
    $('body').contents().each((i, elem) => {
        if(elem.type == 'text'){
            let arr = elem.data.split('--');
            let memberId = arr[0].trim() + '';
            let name = arr[1] + '';
            if(collectData == false && memberId == '1'){
                collectData = true;
            }
            if(collectData == true){
                data.push({
                    name: name.replace('\n', ''),
                    memberId:  memberId.replace('\n', '')
                });
            }
        }
    });
    data.splice(data.length - 1, 1);
    return data;
}

const parseMemberBeers = html => {
    let data = [];
    const $ = cheerio.load(html);
    $('p').contents().each((i, elem) => {
        if(elem.type == 'text'){
            let value = elem.data.trim();
            let beerServeStyle = '';
            const beerServeStyleCode = value.substring(0, 3);
            switch (beerServeStyleCode){
                case '(D)':
                    beerServeStyle = 'Draft';
                    break;
                case '(C)':
                    beerServeStyle = 'Cask';
                    break;
                case '(B)':
                    beerServeStyle = 'Bottle/Can';
                    break;
            }

            //this will help filter out anything that is not a beer list entry
            if(beerServeStyle != ''){
                const beerName = value.substring(4);
                data.push({
                    beerName: beerName, //filter out the dumb sql escapes
                    beerServeStyle: beerServeStyle,
                    beerServeStyleCode: beerServeStyleCode
                });
            }
        }
    });
    return data;
}

const parseBeersToDrink = html => {
    let data = [];
    const $ = cheerio.load(html);
    $('p').contents().each((i, elem) => {
        if(elem.type == 'text'){
            let value = elem.data.trim();
            let beerServeStyle = '';
            const beerServeStyleCode = value.substring(0, 3);
            switch (beerServeStyleCode){
                case '(D)':
                    beerServeStyle = 'Draft';
                    break;
                case '(C)':
                    beerServeStyle = 'Cask';
                    break;
                case '(B)':
                    beerServeStyle = 'Bottle/Can';
                    break;
            }

            //this will help filter out anything that is not a beer list entry
            if(beerServeStyle != ''){
                const beerName = value.substring(4);
                data.push({
                    beerName: beerName, //filter out the dumb sql escapes
                    beerServeStyle: beerServeStyle,
                    beerServeStyleCode: beerServeStyleCode
                });
            }
        }
    });
    return data;
}