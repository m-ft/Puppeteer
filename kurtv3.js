"use strict";

const puppeteer = require("puppeteer");

process.on("unhandledRejection", (reason, promise) => {
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
    throw new Error("Script failed!");
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const screen = (page, name) =>  page.screenshot({ path: `${name}.png` });

const user = process.argv[2];

const password = process.argv[3];

const date = process.argv[4];


// 15h - 23h
const fst = makeReservation("23","15", "23");
// 11h - 15h
const sec = makeReservation("23","11", "15");
// 9h - 11h
const lst = makeReservation("23","09", "11");

const all = Promise.allSettled([fst, sec, lst]);
all.then(() => console.log("Script executed with success!"));

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

async function fillForm(page) {
    const subject = "#kurtResourceSubject";
    const checkbox = "#complyConditionsCheckbox";
    await page.waitForSelector(subject, {timeout: 60000});
    await page.waitForSelector(checkbox, {timeout: 60000});
    await page.$eval(subject, el => el.value = "Study");
    await page.$eval(checkbox, el => el.checked = true);
}

async function submitForm (page) {
    const submitBtn = "#submitReservationButton";
    await page.waitForSelector(submitBtn, {timeout: 60000});
    await page.click(submitBtn);
}


// Async function 
async function makeReservation(seatID, startTime, endTime, usr = user, pass = password, bookingDate = date) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Change default timeout for navigation methods (goto, waitForNavigation etc.)
    await page.setDefaultNavigationTimeout(60000);
    // Change default timeout 
    await page.setDefaultTimeout(45000);

    // Set viewport width and height
    await page.setViewport({ width: 1280, height: 1800 });
    await page.goto(`https://www-sso.groupware.kuleuven.be/sites/KURT/Pages/NEW-Reservation.aspx?StartDateTime=${bookingDate}T${startTime}:00:00&EndDateTime=${bookingDate}T${endTime}:00:00&ID=1010${seatID}&type=b&sessionId=`);
    await page.waitForNavigation({waitUntil: "networkidle0"});
    // Await login
    await login(page, usr, pass);
    await page.waitForNavigation({waitUntil: "networkidle0"});
    // fill submission form
    await fillForm(page);
    await wait(601000);
    await submitForm(page);
    await browser.close();
}

