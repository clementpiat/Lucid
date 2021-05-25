/* 

------------------- IMPORTS AND SETUP -------------------

*/
import { HeartRateSensor } from "heart-rate";
import { Accelerometer } from "accelerometer";
import { vibration } from "haptics";
import { me } from "appbit";
import { listDirSync } from "fs";
import { display } from "display";
import * as fs from "fs";

// Constants
const listDir = listDirSync("/private/data");
const modes = ["Day", "Night"];
const max_log_size = 40; // The maximum length of a list that can be logged in the console
const max_memory_size = 1080; // The maximum length of a list that can fit in memory
const vibrationType = "ping";
const night_mode_starts = 10; // Time when night mode starts in hours

const start_pattern = "19_11_2020"; // Pattern that we are looking for in the filenames
const end_pattern = "acc_std_measures.json";
const estimate_sleep_stage_step = 30; // Number of seconds between sleep phase estimations, muste be higher than window_transform_measures
const record_measures_step = 1; // Number of seconds between measures
const vibration_time_diff = 60 * 60 * 1000; // Number of milliseconds between two consecutive night vibrations
const window_transform_measures = 5; // Number of data before we average hr measures, computes std of acceleration, etc

// TODO: save hr_treshold somewhere, it should be evolutive and depends on people
const avg_hr_treshold = 70; // Threshold for bpm to detect REM sleep
const std_acc_treshold = 4; // Threshold for acceleration to detect REM sleep
const std_hr_treshold = 10; // TODO: estimate that
const hours_threshold = 3; // Vibrate only after 3am

// Global variables
let previous_mode = -1;
let mode = -1;
let hr_avg_measures = []; // Contains average hr measures
let acc_std_measures = []; // Contains standard deviation acceleration measures
let hr_std_measures = []; // Contains hr variability measures
let hr_measures= [];
let acc_measures = [];

let n_measures = 0; // Count the measures in hr_measures
let memory_state = 0; // Count the number of data stored in the different arrays
let record_start = getCurrentTime();
let previous_vibration = 0; // Time of the last vibration


// Fetch UI elements we will need to change
let document = require("document");
let modeLabel = document.getElementById("mode");
let hrLabel = document.getElementById("hrm");
let rcLabel = document.getElementById("rc");
let timeLabel = document.getElementById("time");

// Initialize UI elements 
updateTimeAndMode();

// Fixes
me.appTimeoutEnabled = false; // Disable timeout

/* 

------------------- FUNCTIONS -------------------

*/

// Update Time and Mode
function updateTimeAndMode() {
  //  Time
  var now = new Date();
  var hours = now.getHours();
  timeLabel.text = hours + ":" + now.getMinutes();

  // Mode
  if (hours >= 9 && hours < night_mode_starts){mode = 0;}    
  else {mode = 1;}

  // Don't change UI every time
  if(previous_mode != mode){
    modeLabel.text = "Mode: " + modes[mode];
    previous_mode = mode;
  }
}

// Random vibrations in day mode
function randomVibrations() {
  // Every 3 / 0.03 minutes in average ie every 1h40
  if (mode == 0 && Math.random()<0.03){
    rcLabel.text = "Are you dreaming?";
    display.on = true;
    vibration.start(vibrationType);
    // Discard Reality Check text after 10 seconds
    setTimeout(() => {rcLabel.text="";}, 10*1000)
  }
}

// If current date is 9 October 2020, returns 9_10_2020, used to store the measures of a specific night
function getCurrentDate() {
  var now = new Date();
  return now.getDate() + "_" + (now.getMonth()+1) + "_" + now.getFullYear();
}

function getCurrentTime() {
  var now = new Date();
  return now.getHours() + "h" + now.getMinutes() + "m" + now.getSeconds();
}

// Record BPM and AM measures
function recordMeasures() {
  if (mode == 1) {
    hr_measures.push(hrm.heartRate);
    acc_measures.push(Math.round(am.x**2 + am.y**2 + am.z**2));
    n_measures += 1;

    if (n_measures >= window_transform_measures) {
      hr_avg_measures.push(Math.round(getAverage(hr_measures) * 10)/10);
      hr_std_measures.push(Math.round(getStandardDeviation(hr_measures) * 10)/10);
      acc_std_measures.push(Math.round(getStandardDeviation(acc_measures) * 10)/10);

      hr_measures = [];
      acc_measures = [];
      n_measures = 0;
      memory_state += 3;
    }
    
  
    if (memory_state >= max_memory_size) {
      // Save and reset
      console.log("Saving...");
      var current_time = getCurrentTime();
      fs.writeFileSync(getCurrentDate() + "_" + record_start + "_" + current_time + "_hr_avg_measures.json", hr_avg_measures, "json");
      fs.writeFileSync(getCurrentDate() + "_" + record_start + "_" + current_time + "_hr_std_measures.json", hr_std_measures, "json");
      fs.writeFileSync(getCurrentDate() + "_" + record_start + "_" + current_time + "_acc_std_measures.json", acc_std_measures, "json");
      
      record_start = current_time;
      hr_avg_measures = [];
      hr_std_measures = [];
      acc_std_measures = [];
      memory_state = 0;
      console.log("Saved");
    }
  }
}

// Simple utils function that compute std of an array
function getStandardDeviation (array) {
    var n = array.length;
    var mean = array.reduce((a, b) => a + b) / n;
    return array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n;
  }

function getAverage (array) {
    return array.reduce((a, b) => a + b) / array.length;
}

// Vibrate if we are in REM sleep, ie if heartrate increased and acceleration is constant (only gravity)
function estimateSleepStage() {
    if (mode == 1) {
        const now = new Date();
        // Tricky shift
        if (((now.getHours() - hours_threshold)%24) <= 7 && 
            acc_std_measures[-1] <= std_acc_treshold && 
            hr_avg_measures[-1] >= avg_hr_treshold &&
            hr_std_measures[-1] <= std_hr_treshold &&
            (Date.now() - previous_vibration) >= vibration_time_diff)
            {
                vibration.start(vibrationType);
                previous_vibration = Date.now();
            }

    }
}

/* 

------------------- SETUP SENSORS AND PLAN FUNCTION CALLS -------------------

*/

// Create a new instance of the HeartRateSensor object
var hrm = new HeartRateSensor();
var am = new Accelerometer();

// Declare an event handler that will be called every time a new HR value is received.
hrm.onreading = function() {
  hrLabel.text = "BPM: " + hrm.heartRate;
}

// Begin monitoring the sensor
hrm.start();
am.start();

// Plan functions calls
setInterval(updateTimeAndMode, 60*1000);
setInterval(randomVibrations, 180*1000);
setInterval(recordMeasures, record_measures_step*1000)
setInterval(estimateSleepStage, estimate_sleep_stage_step*1000)

/* 

------------------- DIRECTORY FILES LISTING -------------------

*/

// Log properly a long list of number in the console
function logLongList(list) {
  var n = list.length;
  list = list.map(x => Math.round(x*10)/10);
  for (var i=0; i<n/max_log_size; i++) {
    console.log(list.slice(i*max_log_size, i*max_log_size+max_log_size))
  }
}

var dirIter = null;
var json_object = null;
while((dirIter = listDir.next()) && !dirIter.done) {
  var filename = dirIter.value;
  if (filename.slice(0, start_pattern.length) == start_pattern && filename.slice(-end_pattern.length) == end_pattern) {
    //json_object  = fs.readFileSync(filename, "json");
    console.log(filename);
    //logLongList(json_object);
  }
  // fs.unlinkSync(filename)
}