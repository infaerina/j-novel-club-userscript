// ==UserScript==
// @name         J-Novel Club Enhancements
// @namespace    http://tampermonkey.net/
// @version      0.11
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
var tc_percent_complete = 95;
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

var tc_type;

function getParts(){
    tc_user_id = document.cookie.split('; ').find(row=>row.startsWith('userId=')).split('=')[1].replace('s%3A','').split('.')[0];
    var s;
    if(document.querySelectorAll('.novel').length>0){
        tc_type = 'novel';
        s = 'https://api.j-novel.club/api/users/' + tc_user_id + '/readParts?format=json';
    } else if (document.querySelectorAll('.manga').length>0){
        tc_type = 'manga';
        s = 'https://api.j-novel.club/api/users/' + tc_user_id + '/mangaReadParts?format=json';
    } else {
        return;
    }
    return fetch(
        s,
        {
            credentials: 'include',
            method: 'GET'
        }).then((response)=> response.json()).catch((err)=>{console.log(err)
    });
}

function getCurrentParts(){
    //Always seems to be series.
    let slug = document.documentURI.split('series/')[1];
    if(slug.includes('#'))  slug = slug.substring(0, slug.search('#'));
    var s;
    if(document.querySelectorAll('.novel').length>0){
        tc_type = 'novel';
        s = 'https://api.j-novel.club/api/series/findOne?filter={"where":{"titleslug":"' + slug + '"},"include":["volumes","parts"]}';
    } else if (document.querySelectorAll('.manga').length>0){
        tc_type = 'manga';
        s = 'https://api.j-novel.club/api/mangaSeries/findOne?filter={"where":{"titleslug":"' + slug + '"},"include":["mangaVolumes","mangaParts"]}';
    } else {
        return;
    }
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
    //Do this to handle manga/novel types
    var typeSelectorV;
    var typeSelectorP;
    var typeSelectorVID;
    var typeSelectorPID;
    if (tc_type == "novel"){
        typeSelectorV = 'volumes';
        typeSelectorP = 'parts'
        typeSelectorVID = "volumeId"
        typeSelectorPID = 'partId';
    } else if (tc_type == "manga"){
        typeSelectorV = 'mangaVolumes';
        typeSelectorP = 'mangaParts';
        typeSelectorVID = "mangaVolumeId";
        typeSelectorPID = 'mangaPartId';
    } else {
        return;
    }
    for (let i = 0; i < tc_current_parts_json[typeSelectorP].length; i++){
        let p = tc_current_parts_json[typeSelectorP][i];
        //Remove all non-alpha numeric characters /[^a-zA-Z0-9 -]/
        var mainTitle = tc_current_parts_json.title.replace(/[^A-Za-z0-9]/g,' ').replace(/\s+/g, " ").trim();
        var partTitle = p.title.replace(/[^A-Za-z0-9]/g,' ').replace(/\s+/g, " ").trim();
        var volumeTitle = tc_current_parts_json[typeSelectorV].find(r=>r.id == p[typeSelectorVID]).title.replace(/[^A-Za-z0-9]/g,' ').replace(/\s+/g, " ").trim();
        var volume = volumeTitle.replace(mainTitle,'').trim();
        var part = partTitle.replace(mainTitle,'').replace(volume,'').trim();
        //Find instead of filter, since each part ID is unique.
        var row = tc_parts_json.find(r=>r[typeSelectorPID] == p.id);
        var comp;
        //If it is a manga it will be page number, not percentage.
        /*
            They do not store max pages in manga parts, making it impossible to tell if it's fully read. FFS.
        */
        if (row){
            if(tc_type == 'novel'){
                comp = Math.round(row.maxCompletion * 100);
            } else if (tc_type == 'manga'){
                comp = row.maxCompletion;
            }
        } else {
            comp = 0;
        }
        let t =
            {
                volume: volume.toLowerCase(),
                part: part.toLowerCase(),
                completion: comp,
                titleslug: tc_current_slug.toLowerCase()
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
    var list;
    if (tc_type == 'novel'){
        list = document.querySelectorAll('.novel');
    } else if (tc_type == 'manga'){
        list = document.querySelectorAll('.manga');
    } else {
        return;
    }
    //First element is useless (title block)
    for (let i = 1; i < list.length; i++){
        let ps = tc_parts.filter(r=>r.volume == list[i].querySelector('h2 > a').innerText.toLowerCase())
        if (ps.length == 0) continue;
        let pe = list[i].querySelectorAll('.block');
        //First element is "parts available" (ignore)
        for (let j = 1; j < pe.length; j++){
            //Exit if you've already slipped in a span element.
            if(pe[j].querySelectorAll('span').length > 2) return;
            var comp;
            let v = list[i].querySelectorAll('a.link')[j].innerText.replace('\n', ' ').toLowerCase().trim();
            //This can be Chapter, Part, or Pt. or just the number.
            if(v.includes('pt.')) v = v.replace('pt.', 'part')
            if(/^\d+$/.test(v)){
                if(tc_type == 'novel') v = 'part ' + v;
                if(tc_type == 'manga') v = 'chapter ' + v;
            }
            if(ps.find(r=>r.part == v)){
                comp = ps.find(r=>r.part == v).completion;
            } else {
                comp = 0;
                continue;
            }
            if(tc_type == 'novel'){
                if (comp >= tc_percent_complete) {
                    comp = 100;
                    pe[j].style.background = tc_read_color_background;
                    pe[j].style.color = tc_read_color_text;
                } else if (comp >= 1){
                    pe[j].style.background = tc_some_color_background;
                    pe[j].style.color = tc_some_color_text;
                } else if (comp == 0){
                    continue;
                }
                let e = document.createElement('span');
                let t = document.createTextNode('  ' + comp + '%');
                e.appendChild(t);
                pe[j].appendChild(e);
            } else if (tc_type == 'manga'){
                if(comp >= 1){
                    pe[j].style.background = tc_some_color_background;
                    pe[j].style.color = tc_some_color_text;
                    let e = document.createElement('span');
                    let t = document.createTextNode(' pg ' + comp);
                    e.appendChild(t);
                    pe[j].appendChild(e);
                }
            }
        }
    }
}

function setup(){
    waitForKeyElements(tc_css_selector, start);
    //This selector will fire EVERY TIME an element appears that matches it, so make sure that's what you want.
    waitForKeyElements('.novel:first-of-type,.manga:first-of-type', setupParts);
}

function start(){
    //Increase width (in reader area only)
    if(!document.querySelector(tc_css_selector)) return;
    document.querySelector(tc_css_selector).setAttribute('style', 'max-width: ' + tc_width_percent + '% !important');
}

start();