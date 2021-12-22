"use strict";

const puppeteer = require("puppeteer");

process.on("unhandledRejection", (reason, promise) => {
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
    throw new Error("Script failed!");
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const screen = (page, name) =>  page.screenshot({ path: `${name}.png` });

const log = (output) => console.log(output);

const user = process.argv[2];

const password = process.argv[3];

const currentDate = process.argv[4];

const newDate = process.argv[5];


// 15h - 18h
const fst = makeReservation("15", 3);
// 11h - 15h
const sec = makeReservation("11", 4);
// 9h - 11h
const lst = makeReservation("9", 2);

const all = Promise.all([fst, sec, lst]);
all.then(() => console.log("Script executed with success!"));


// Test 
// const a = makeReservation("8", 2);
// const test = Promise.all([a]);
// test.then(() => console.log("Test executed with success!"));

// Login 
 async function login (page, usr, pass) {
        const user = "input[name='username']";
     const password = "input[name='password']";
     const loginBtn = "#pwdLoginBtn";
     await page.waitForSelector(user);
     await page.evaluate((user, usr) => { 
         const inputUsr = document.querySelector(user);
         inputUsr.value = usr;
         }, user, usr);
     await page.waitForSelector(password);
     await page.evaluate((password, pass) => { 
         const inputPass = document.querySelector(password);
         inputPass.value = pass;
         }, password, pass);    
     // click on login
     await page.click(loginBtn);
}
 

// Wait for and click selector
async function clickSelector (page, selector) {
          try {
               await page.waitForSelector(selector, {timeout: 120000});
               await page.click(selector);
          } catch (e) {
               await page.reload({waitUntil: "networkidle0"});
               await page.waitForSelector(selector, {timeout: 120000});
               await page.click(selector);
          }
}


// replace page URL
async function replaceURL(page, cDate, nDate) {
    const url = await page.evaluate(() => location.href);
    // replace url string
    const newUrl = url.replace(cDate, nDate);
    return newUrl;
}


async function waitForResource(page, selector) {
    try {
        await page.waitForSelector(selector, {timeout: 120000});
    } catch (e) {
        await page.reload({waitUntil: "networkidle0"});
        await page.waitForSelector(selector, {timeout: 120000});
    }
}

// Async Generator function for Resource IDs 
async function* generateResourceID(page, seatNumbers) {
    for (const seat of seatNumbers) {
        try {
            const resourceId = await page.evaluate((title) => {
                const nodes = document.querySelectorAll(".KURT-Item-Title");
                const arr = Array.from(nodes);
                const index = arr.findIndex(el => el.innerText.includes(title));
                const nodeItem = nodes.item(index);
                const resource = nodeItem.closest(".KURT-Item");
                const id = "#" + resource.id;
                return id;
                }, `Seat 0${seat}`);
            yield resourceId;
            } catch (e) {
                // Continue on error
                continue;
                }
        }
}

// Async generator function for timeslot IDs
async function* generateResourceTime(page, dataHour, resources) {
    for (const resourceId of resources) {
        try {
            const timeslotId = await page.evaluate((resourceId, dataHour) => {
                const seat = document.querySelector(resourceId);
                const timeslot = seat.querySelector(dataHour);
                const id = (timeslot.innerText.includes("A")) ? "#" + timeslot.id : undefined;
                return id;
                }, resourceId, dataHour);
            if(timeslotId) {
                const resourceTimeMap = new Map([
                    ["resourceId", resourceId],
                    ["timeslotId", timeslotId]
                    ]);
                yield resourceTimeMap;
                } else {
                    continue;
                    }
            } catch (e) {
                continue;
                }
        }
}

// Generate Array from generator sequence
async function generateArray(generator) {
    let ct = 0;
    const selected = [];
    for await (const value of generator) {
        if (value !== null && value !== undefined) {
            selected[ct]  = value;
            ct++;
            } 
        }
    return selected;
}

// Get value from map
async function getMapValue(array, key) {
    let ct = 0;
    const selected = [];
    for await (const map of array) {
        selected[ct]  = array[ct].get(key);
        ct++;
    } 
    return selected;
}

async function* generateReserveBtn(page, availableResources, lengthOfStay) {
        
    for await (const resourceId of availableResources) {
        try {
            const reserveBtn = await page.evaluate((resourceId, lengthOfStay) => {
                const resource = document.querySelector(resourceId);
                const durationItems = resource.querySelectorAll(".KURT-Duration-Item-Container");
                const selectedItemContainer = durationItems[lengthOfStay - 1];
                const selectedItem = selectedItemContainer.firstElementChild;
                // Select the duration item eg. the last node element (8h)
                selectedItem.onclick();
                const div =  resource.querySelector(".KURT-Button-Reserve");
                const btn = div.firstElementChild;
                const btnId = "#" + btn.id;
                return btnId;
                }, resourceId, lengthOfStay);
            yield reserveBtn;
            } catch (e) {
                continue;
                }
        }    
}

// Display Hours
async function displayHours (page, availableTimeslots) {
    for await (const id  of availableTimeslots) {
            try {
               await page.waitForSelector(id, {visible: true});
               await page.click(id);    
            } catch (e) {
                continue;
            }
        }
}    

// Click on reservation button
async function clickReserveBtn (page, availableBtns ) { 
    if (availableBtns !== null && availableBtns !== undefined) {
        btnLoop:
         for await (const id of availableBtns) {
             try {
                 await page.waitForSelector(id, {visible: true});
                 // const btn = await page.$eval(id, (el) => el.parentElement);
                 await page.click(id);
                 break btnLoop;
             } catch (e) {
                 continue btnLoop;
             }
         }
    } else {
        throw new Error("no available btns");
    }
}


// Async function Params: Seat Number eg. 06 or 21, the starting hour, duration of stay in hours
async function makeReservation(hour, lengthOfStay, usr = user, pass = password, cDate = currentDate, nDate = newDate) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Change default timeout for navigation methods (goto, waitForNavigation etc.)
    const setNT = await page.setDefaultNavigationTimeout(120000);
    // Change default timeout 
    const setT = await page.setDefaultTimeout(45000);
    // Set viewport width and height
    const setV = await page.setViewport({ width: 1280, height: 1800 });

    // Navigate to Study places
    // await page.goto("https://www-sso.groupware.kuleuven.be/sites/KURT/Pages/default.aspx?pid=201310");
   const gotoUrl = await page.goto("https://www-sso.groupware.kuleuven.be/sites/KURT/Pages/default.aspx?pid=201426&showresults=true");
   const waitForNav = await page.waitForNavigation({waitUntil: "networkidle0"});

        // Await login
   const userLogin = await login(page, usr, pass);
   const waitForLoginNav = await page.waitForNavigation({waitUntil: "networkidle0"});
    
     // Replace page URL
     const newUrl = await replaceURL(page, cDate, nDate);
    // goto new url
     const gotoNewUrl =  await page.goto(newUrl, {waitUntil: ["networkidle0", "domcontentloaded"]});
   
    // wait for resource title   
    const waitSelector = await page.waitForSelector(".KURT-Item-Title");
        
    // Preferred seat numbers
    const seatNumbers = ["05", "15", "13", "14", "12", "06", "23", "21", "22", "20", "32", "31", "33", "34"];
        // Get selector id for preferred resources
    const generatorResource = generateResourceID(page, seatNumbers);

    // Populate an array with non-null resource IDs
    const selectedResources = await generateArray(generatorResource);

    // data-hour selector for timeslots
    const dataHour = `div[data-hour="${hour}:00"]`;

    // Return array with timeslot id and duration id    
    const generatorResourceTime = generateResourceTime(page, dataHour, selectedResources);

    // Populate an array with ResourceId, timeslotId map
    const selectedResourceTimes = await generateArray(generatorResourceTime);

    const availableResources = await getMapValue(selectedResourceTimes, "resourceId");

    const availableTimeslots = await getMapValue(selectedResourceTimes, "timeslotId");

    // Click on starting time slot
    const awaitHours = await displayHours(page, availableTimeslots);
        
        // Get reservation buttons for resources with available timeslot
    const generatorReserveBtn = generateReserveBtn(page, availableResources, lengthOfStay);
    const availableBtns =  await generateArray(generatorReserveBtn);

    // Click the reserve button
    const awaitReserveBtn =  await page.waitForSelector(".KURT-Button-Reserve", {timeout: 60000});
    const awaitClickReserveBtn = await clickReserveBtn(page, availableBtns);
    // Wait for navigation to submission form
    const subject = "#kurtResourceSubject";
    const checkbox = "#complyConditionsCheckbox";
    const awaitSubject = await page.waitForSelector(subject, {timeout: 60000});
    const awaitCheckBox = await page.waitForSelector(checkbox, {timeout: 60000});
    const awaitStudy = await page.$eval(subject, el => el.value = "Study");
    const awaitChecked = await page.$eval(checkbox, el => el.checked = true);
    const submitBtn = "#submitReservationButton";
    const awaitSubmitBtn = await page.waitForSelector(submitBtn, {timeout: 60000});
    const awaitClickSubmitBtn = await page.click(submitBtn);
    const awaitCloseBrowser = await browser.close();
}
