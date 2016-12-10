
var express = require('express');
var path = require('path');
var http = require('http');

var database = require("./util/database");
var util = require('./util/dexter-util');
var log = require('./util/logging');
var authUtil = require('./util/auth-util');

var account = require("./routes/account");
var analysis = require("./routes/analysis");
var config = require("./routes/config");
var codeMetrics = require("./routes/codeMetrics");
var functionMetrics = require("./routes/functionMetrics");
var monitor = require("./routes/monitor");
var adminSE = require("./routes/adminSE");

var app = express();

global.runOptions = {
    port:8190,
    databaseHost:'localhost',
    databasePort:4582,
    databaseUser:'',
    databasePassword:'',
    databaseAdminUser:'',
    databaseAdminPassword:'',
    databaseName:'',
    serverName:'vatcal',
    getDbUrl : function(){
        return this.databaseName + "@" + this.databaseHost + ':' + this.databasePort;
    }
};

var auth = authUtil.getBasicAuth;

var noNeedAccessLogUriList = [

];

exports.startServer = startServer;
exports.stopServer = stopServer;

initialize();

function initialize(){
    setRunOptionsByCliOptions();
    setExecutionMode();
    setAppConfigure();
    initModules();
    //initRestAPI();
    startServer();
}

function setRunOptionsByCliOptions(){
    var cliOptions = util.getCliOptions();

    global.runOptions.port = cliOptions.getValue('p', 8190);
    global.runOptions.databaseHost = cliOptions.getValue('database.host', 'localhost');
    global.runOptions.databasePort = cliOptions.getValue('database.port', 4582);
    global.runOptions.databaseUser = cliOptions.getValue('database.user', '');
    global.runOptions.databasePassword = cliOptions.getValue('database.password', '');
    global.runOptions.databaseAdminUser = cliOptions.getValue('database.admin.user', '');
    global.runOptions.databaseAdminPassword = cliOptions.getValue('database.admin.password', '');
    global.runOptions.databaseName = cliOptions.getValue('database.name', '');
    global.runOptions.serverName = cliOptions.getValue('server.name', 'dexter-server-default');
    global.runOptions.serverIP = util.getLocalIPAddress();
}

function setExecutionMode(){
    if(process.env.NODE_ENV === undefined){
        process.env.NODE_ENV = 'production';
    }
}

function setAppConfigure(){
    app.configure(function () {
        app.set("jsonp callback", true);
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'jade');
        app.use(express.static(path.join(__dirname, 'public')));
        app.use(express.json({limit:'300mb'}));
        app.use(express.urlencoded());
        app.use(express.methodOverride());
    });

    app.configure('development', function(){
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true}));
    });


    app.configure('production', function(){
        app.use(express.errorHandler({"dumpExceptions": false, "showStack": false}));
    });


    app.all('*', function(req, res, next){
        setCurrentUserIdAndNoOnRequest(req);
        //addAccessLog(req);
        setResponseHeaderSupporingCORS(res);

        next();
    });
}

function initModules(){
    log.init();
    database.init();
}

function setCurrentUserIdAndNoOnRequest(req, res){
    req.currentUserId = util.getUserId(req);
    req.currentUserNo = account.getUserNo(req.currentUserId);
}

function addAccessLog(req){
    if(isNoNeedToAddAccessLog(req.url)){
        return;
    }

    var parameter = {
        remoteAddress: req.remoteAddress,
        currentUserNo: req.currentUserNo,
        uri: req.url,
        method: req.method,
        query: req.query
    };

    config.addAccessLog(parameter);
}

function isNoNeedToAddAccessLog(url){
    return noNeedAccessLogUriList.indexOf(url) >= 0;
}

// CORS : Cross-Origin Resource Sharing
function setResponseHeaderSupporingCORS(res){
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
}

function initRestAPI(){
    /***** URL to Handler Mapping *****/


}

function startServer(){
    http.globalAgent.maxSockets = Infinity;  // 5, 10, ...
    vatcalServer = http.createServer(app).listen(global.runOptions.port, function(){
        log.info('VATCAL server listening on port ' + global.runOptions.port);
        log.info('VATCAL server location : ' + __dirname);
        log.info("Execution Mode : " + app.get('env'));
    });
}

//use UT Code
function stopServer (req, res){
    var userId = req.currentUserId;

    if(account.checkAdmin(userId) === false) {
        log.info('only administrator can stop the server : ' + userId);
        if(res != undefined) res.send("fail");
        return;
    }

    log.info('VATCAL server is closing on port ' + global.runOptions.port);

    if(res != undefined) res.send("ok");

    vatcalServer.close();
    process.exit(1);
}

exports.forceStopServer = function(){
    vatcalServer.close();
};


function deleteDexterDatabase (req, res){
    var userId = req.currentUserId;

    if(account.checkAdmin(userId) === false) {
        log.info('only administrator can delete Dexter Database : ' + userId);
        if(res != undefined) res.send("fail");
        return;
    }

    log.info('Dexter database will be removed by ' + userId);
    if(res != undefined) res.send("ok");
    database.deleteDexterDatabase();
}

function checkServer (req, res){
    res.status(200);
    res.send("ok");
    //res.send({"isAlive":"ok"});
    //res.writeHead(200, { 'Content-Type': 'application/json' });
    //res.jsonp({"isAlive":"ok"});
}

function checkServer2 (req, res){
    //res.writeHead(200, { 'Content-Type': 'application/json' });
    res.jsonp({"isAlive":"ok"});
}

function getServerDetailedStatus (req, res){
    res.jsonp({
        "isAlive":"ok",
        "pid": process.pid,
        "memory": process.memoryUsage(),
        "uptime": process.uptime(),
        "ip": global.runOptions.serverIP,
        "port": global.runOptions.port
    });
}
