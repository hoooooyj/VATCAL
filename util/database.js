
"use strict";
var mongoose    = require('mongoose');
var log = require('./logging');

// CONNECT TO MONGODB SERVER
var db = mongoose.connection;


exports.init = function(){
    setRunOptionsImmutable();
    initDatabase();
};

function setRunOptionsImmutable(){
    Object.freeze(global.runOptions);
}

exports.getProjectName = function(req, res){
    res.send({
        status : "ok",
        projectName :  global.runOptions.databaseName
    });
};

exports.deleteDexterDatabase = function(){
    // TODO : root account info from server.conf
    global.runOptions.databaseAdminUser = 'dexterAdmin';
    global.runOptions.databaseAdminPassword = "dex2admin";

    util.getLocalhostIp(function(localhostIp){
        var scripts = [
                "DROP DATABASE " + global.runOptions.databaseName
        ];

        runMysqlScript(scripts, 0);
    });
};


function initDatabase(){
    db.on('error', console.error);
    db.once('open', function(){
        // CONNECTED TO MONGODB SERVER
        log.info("Connected to mongod server");
    });
    mongoose.connect('mongodb://localhost/mongodb_tutorial');

}

function runMysqlScript(scripts, index){
    if(scripts.length <= index){
        return;
    }

    var cmd = "mysql -h " + global.runOptions.databaseHost
        + " -u " + global.runOptions.databaseAdminUser
        + " -p" + global.runOptions.databaseAdminPassword + " -e \"" + scripts[index] + "\"";

    logging.info(cmd);

    var exec = require('child_process').exec;
    exec(cmd, function(error, stdout, stderr){
        if(error){
            if(error.code != 1){
                logging.error(error);
                logging.error("Execute Failed: " + cmd);
                return;
            }

            logging.error(error);
            process.exit(2);
        }

        logging.info("Executed: " + cmd);

        if(++index >= scripts.length){
            execMysqlScript(process.cwd() + "/config/ddl_lines.sql");
        } else {
            runMysqlScript(scripts, index);
        }
    });
}


function execMysqlScript(scriptFilePath){
    var cmd = "mysql -h " + global.runOptions.databaseHost
        + " -u " + global.runOptions.databaseUser
        + " -p" + global.runOptions.databasePassword
        + " " + global.runOptions.databaseName + " < " + scriptFilePath;

    var exec = require('child_process').exec;
    exec(cmd, function(error, stdout, stderr){
        if(error){
            /*
            if(error.code != 1){
                logging.error(error);
                logging.error("Execute Failed: " + cmd);
                return;
            }
            */

            logging.error(error);
            process.exit(3);
        }

        logging.info("Executed: " + cmd);
        initDbPool();
    });
}

exports.getDatabaseName = function(){
    return global.runOptions.databaseName;
};

exports.exec = function (sql, callback){
    _databasePool.getConnection(function(err, connection){
        if(err){
            logging.error(err.message);
        }

        if(connection){
            if(connection.isClosed){
                logging.error("Invalid DB Connection : closed");
            }

            var query = connection.query(sql, callback);
            logging.debug(sql);
            connection.release();
        }
    });
};

exports.execV2 = function (sql, args){
    var deferred = Q.defer();
    _databasePool.getConnection(function(err, connection){
        if(err){
            logging.error(err.message);
            deferred.reject(new Error());
        } else {
            if(connection.isClosed){
                var con_err = {message : "Invalid DB Connection : closed"};
                logging.error(con_err.message);
                deferred.reject(new Error(con_err));
            } else {
                logging.debug(sql);
                var query = connection.query(sql, args, function(err, rows){
                    connection.release();
                    if(err){
                        logging.error(err.message);
                        deferred.reject(new Error(err));
                    } else {
                        deferred.resolve(rows);
                    }
                })
            }
        }
    });
    return deferred.promise;
};

exports.execute = function (sql, args){
    var deferred = Q.defer();
    _databasePool.getConnection(function(err, connection){
        if (err) {
            logging.error(err.message);
            deferred.reject(new Error(err));
        } else {
            if(connection.isClosed){
                var con_err = {message : "Invalid DB Connection : closed"};
                logging.error(con_err.message);
                deferred.reject(new Error(con_err));
            } else {
                logging.debug(sql);
                var query = connection.query(sql, args, function(err, rows) {
                    connection.release();
                    if (err) {
                        logging.error(err.message);
                        deferred.reject(new Error(err));
                    } else {
                        deferred.resolve(rows);
                    }
                });
            }
        }
    });
    return deferred.promise;
};

exports.execTx = function (connection, sql, callback){
    if(connection){
        if(connection.isClosed){
            logging.error("Invalid DB Connection : closed");
        }

        var query = connection.query(sql, callback);
        logging.debug(sql);
    }
};

exports.toSqlValue = function(value){
    if(value == undefined || value =='undefined'|| value == null || value === 'null' || value === ''){
        return "null";
    } else {
        var str = "" + value;
        return "'" + str.replace(/\'/g, "/") + "'";
    }
};

exports.compareEqual = function(value){
    if(value == undefined || value =='undefined' || value == 'null' || value == null || value == ''){
        return " is null ";
    } else {
        return " = '" + value + "'";
    }
};

exports.getDateTime = function(value){
    var retValue;

    if(typeof value.getTime === 'function'){
        retValue = value.getTime();
    } else if (typeof value === 'number'){
        retValue = value;
    } else if(typeof value === 'string') {
        if(value.indexOf("T") !== -1){
            var date = parseDate(value);
            retValue = date.getTime();
        } else {
            retValue = value;
        }
    } else {
        logging.error("Invalid value at database.js getDateTime : " + value + " , typeof:" + typeof value);
        retValue = 0;
    }

    return retValue;
};

exports.getDateTimeEx = function(value) {
    var retValue;
    if(typeof value.getTime === 'function'){
        retValue = "FROM_UNIXTIME(" + Math.floor(value.getTime()/1000) + ")";
    } else if(typeof value === 'number') {
        retValue = "FROM_UNIXTIME(" + Math.floor(value/1000) + ")";
    } else if(typeof value === 'string') {
        if(value.indexOf("T") !== -1){
            var date = parseDate(value);
            retValue = "FROM_UNIXTIME(" + Math.floor(date.getTime()/1000) + ")";
        } else {
            retValue = "FROM_UNIXTIME(" + Math.floor(value/1000) + ")";
        }
    } else {
        logging.error("Invalid value at database.js getDateTimeEx : " + value + " , typeof:" + typeof value)
        retValue = "0";
    }

    return retValue;
};
