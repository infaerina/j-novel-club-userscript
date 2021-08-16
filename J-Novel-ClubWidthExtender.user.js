// ==UserScript==
// @name         J-Novel Club Enhancements
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Added part completion to J-Novel-Club as well as an i-frame extender to tc_width_percent value.
// @downloadURL  https://github.com/infaerina/j-novel-club-userscript/raw/master/J-Novel-ClubWidthExtender.user.js
// @author       Infaerina
// @match        https://j-novel.club/read/*
// @match        https://j-novel.club/series/*
// @icon         https://www.google.com/s2/favicons?domain=j-novel.club
// @grant        none
// @run-at       document-idle
// ==/UserScript==

var tc_width_percent = 95;
var tc_css_selector = '.ftutoe9';
var tc_user_id;
var tc_parts_json;
var tc_current_parts_json;
var tc_parts;

async function getParts(){
    tc_user_id = document.cookie.split('; ').find(row=>row.startsWith('userId=')).split('=')[1].replace('s%3A','').split('.')[0];
    let s = 'https://api.j-novel.club/api/users/' + tc_user_id + '/readParts?format=json';
    await fetch(
        s,
        {
            credentials: 'include',
            method: 'GET'
        }).then((response)=> response.json()).then((json) => tc_parts_json = json).catch((err)=>{console.log(err)
    });
}
async function getCurrentParts(){
    let slug = __NEXT_DATA__.query.slug;
    let s = 'https://api.j-novel.club/api/series/findOne?filter=%7B%22where%22%3A%7B%22titleslug%22%3A%22' + slug + '%22%7D%2C%22include%22%3A%5B%7B%22volumes%22%3A%5B%22publishInfos%22%5D%7D%2C%7B%22relation%22%3A%22parts%22%2C%22scope%22%3A%7B%22fields%22%3A%5B%22id%22%2C%22title%22%2C%22titleslug%22%2C%22created%22%2C%22expired%22%2C%22expirationDate%22%2C%22partNumber%22%2C%22preview%22%2C%22launchDate%22%2C%22serieId%22%2C%22volumeId%22%5D%7D%7D%5D%7D';
    await fetch(
        s,
        {
            credentials: 'include',
            method: 'GET'
        }).then((response)=> response.json()).then((json) => tc_current_parts_json = json).catch((err)=>{console.log(err)
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
                completion: comp
            }
        pTemp.push(t);
    }
    tc_parts = pTemp;
}

async function setupParts(){
    await getParts();
    await getCurrentParts();
    populatePartsArray();
    //Get all of the element containers for each book.
    var list = document.querySelectorAll('.novel');
    //First element is useless (title block)
    for (let i = 1; i < list.length; i++){
        let ps = tc_parts.filter(r=>r.volume == list[i].innerText.split('\n')[0].toLowerCase())
        let pe = list[i].querySelectorAll('.block');
        //First element is "parts available"
        for (let j = 1; j < pe.length; j++){
            let comp = ps.find(r=>r.part =='part ' + j).completion;
            if (comp >= 97) {
                comp = 100;
                pe[j].style.background = "green";
                pe[j].style.color = "lightgreen";
            } else if (comp >= 1){
                pe[j].style.background = "DeepSkyBlue";
                pe[j].style.color = "AliceBlue";
            }
            // Instead of this, I want to add a new span.
            let e = document.createElement('span');
            let t = document.createTextNode('  ' + comp + '%');
            e.appendChild(t);
            pe[j].appendChild(e);
        }
    }
}

function setup(){
    //Increase width (in reader area only)
    if(!document.querySelector(tc_css_selector)) return;
    document.querySelector(tc_css_selector).setAttribute('style', 'max-width: ' + tc_width_percent + '% !important');
    setupParts();
}

setup();