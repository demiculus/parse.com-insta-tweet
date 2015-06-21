/*************************************Head*********************************************/

// Include all of the modules
var background_job = require('cloud/background_job.js');

/*
    TODO Enter what it does
*/
Parse.Cloud.job("startBackgroundJob", background_job.startBackgroundJob);
