// ==UserScript==
// @name         J-Novel Club Enhancements
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Added part completion to J-Novel-Club as well as an i-frame extender to tc_width_percent value.
// @downloadURL  https://github.com/infaerina/j-novel-club-userscript/raw/master/J-Novel-ClubWidthExtender.user.js
// @author       Infaerina
// @match        https://j-novel.club/*
// @icon         https://www.google.com/s2/favicons?domain=j-novel.club
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// Wait for key elements and observe page changes to re-run setup!
var fireOnHashChangesToo    = true;
var pageURLCheckTimer       = setInterval (
    function () {
        if (   this.lastPathStr  !== location.pathname
            || this.lastQueryStr !== location.search
            || (fireOnHashChangesToo && this.lastHashStr !== location.hash)
        ) {
            this.lastPathStr  = location.pathname;
            this.lastQueryStr = location.search;
            this.lastHashStr  = location.hash;
            setup ();
        }
    }
    , 200
);

/*
        Variables!
            Feel free to change these as you see fit!
*/
var tc_width_percent = 95;
var tc_css_selector = '.ftutoe9';
var tc_read_color_background = "green";
var tc_read_color_text = "lightgreen";
var tc_some_color_background = "DeepSkyBlue";
var tc_some_color_text = "AliceBlue";
var tc_current_slug;

//Private variables.
var tc_user_id;
var tc_parts_json;
var tc_current_parts_json;
var tc_parts;

function getParts(){
    tc_user_id = document.cookie.split('; ').find(row=>row.startsWith('userId=')).split('=')[1].replace('s%3A','').split('.')[0];
    let s = 'https://api.j-novel.club/api/users/' + tc_user_id + '/readParts?format=json';
    return fetch(
        s,
        {
            credentials: 'include',
            method: 'GET'
        }).then((response)=> response.json()).catch((err)=>{console.log(err)
    });
}

function getCurrentParts(){
    let slug = document.documentURI.split('series/')[1];
    let s = 'https://api.j-novel.club/api/series/findOne?filter=%7B%22where%22%3A%7B%22titleslug%22%3A%22' + slug + '%22%7D%2C%22include%22%3A%5B%7B%22volumes%22%3A%5B%22publishInfos%22%5D%7D%2C%7B%22relation%22%3A%22parts%22%2C%22scope%22%3A%7B%22fields%22%3A%5B%22id%22%2C%22title%22%2C%22titleslug%22%2C%22created%22%2C%22expired%22%2C%22expirationDate%22%2C%22partNumber%22%2C%22preview%22%2C%22launchDate%22%2C%22serieId%22%2C%22volumeId%22%5D%7D%7D%5D%7D';
    return fetch(
        s,
        {
            credentials: 'include',
            method: 'GET'
        }).then((response)=> response.json()).catch((err)=>{console.log(err)
    });
}

//Populate parts
function populatePartsArray(){
    //create an array equal to the number of parts in current parts.
    var pTemp = [];
    for (let i = 0; i < tc_current_parts_json.parts.length; i++){
        let p = tc_current_parts_json.parts[i];
        var volume = p.titleslug.substring(p.titleslug.search('-volume-') + 1, p.titleslug.search('-part-')).replace('-', ' ');
        var part = p.titleslug.substring(p.titleslug.search('-part-') + 1, p.titleslug.length).replace('-', ' ');
        //Find instead of filter, since each part ID is unique.
        var row = tc_parts_json.find(r=>r.partId == p.id);
        var comp;
        if (row){
            comp = Math.round(row.maxCompletion * 100);
        } else {
            comp = 0;
        }
        let t =
            {
                volume: volume,
                part: part,
                completion: comp,
                titleslug: tc_current_slug
            }
        pTemp.push(t);
    }
    tc_parts = pTemp;
}

function getAPI(){
    return Promise.all([getParts(), getCurrentParts()]);
}
function setupParts(){
    let newSlug = document.documentURI.split('series/')[1];
    //Determine if in a series.
    if(newSlug == undefined) return;
    //Determine if current series is changed
    if(tc_parts !== undefined){
        if(tc_parts[0].titleslug == newSlug){
            //Run setup Percentages in case you loaded home screen, then went back to page.
            setupPercentages();
            return;
        }
    }
    tc_current_slug = newSlug;
    getAPI().then(([parts, currentParts]) =>{
        tc_current_parts_json = currentParts;
        tc_parts_json = parts;
        populatePartsArray();
        setupPercentages();
    });
}

function setupPercentages(){
    //Get all of the element containers for each book.
    var list = document.querySelectorAll('.novel');
    //First element is useless (title block)
    for (let i = 1; i < list.length; i++){
        let ps = tc_parts.filter(r=>r.volume == list[i].innerText.split('\n')[0].toLowerCase())
        let pe = list[i].querySelectorAll('.block');
        //First element is "parts available" (ignore)
        for (let j = 1; j < pe.length; j++){
            //Exit if you've already slipped in a span element.
            if(pe[j].querySelectorAll('span').length > 2) return;
            let comp = ps.find(r=>r.part =='part ' + j).completion;
            if (comp >= 97) {
                comp = 100;
                pe[j].style.background = tc_read_color_background;
                pe[j].style.color = tc_read_color_text;
            } else if (comp >= 1){
                pe[j].style.background = tc_some_color_background;
                pe[j].style.color = tc_some_color_text;
            }
            let e = document.createElement('span');
            let t = document.createTextNode('  ' + comp + '%');
            e.appendChild(t);
            pe[j].appendChild(e);
        }
    }
}

function setup(){
    waitForKeyElements(tc_css_selector, start);
    //This selector will fire EVERY TIME an element appears that matches it, so make sure that's what you want.
    waitForKeyElements('.novel:first-of-type', setupParts);
}

function start(){
    //Increase width (in reader area only)
    if(!document.querySelector(tc_css_selector)) return;
    document.querySelector(tc_css_selector).setAttribute('style', 'max-width: ' + tc_width_percent + '% !important');
}

start();