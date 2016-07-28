var https = require('https');
var crypto = require('crypto');
var config = require('./config.json');
var parse = require('diff-parse');
var nodemailer = require('nodemailer');
var escape = require('escape-html');
var async = require('async');

exports.handler = (event, context, callback) => {
    
    var githubHmac = event.params.header['X-Hub-Signature'].replace('sha1=','');
    var lambdaHmac = crypto.createHmac('sha1',config.github.secret).update(JSON.stringify(event['body-json'])).digest('hex');

    if(githubHmac !== lambdaHmac){
        context.fail("Invalid GitHub Secret",null);
    } else { 

        var commits = event['body-json'].commits;
        var email = '<html><body>';
        email += 'Branch: ' + event['body-json'].ref + '<br/>';
        email += 'Home: <a href="' + event['body-json'].repository.html_url + '">' + event['body-json'].repository.html_url + '</a><br/>';
        email += 'Compare: <a href="' + event['body-json'].compare + '">' + event['body-json'].compare + '</a><br/><hr>';

        async.forEach(commits, function(e, callback){
            getDiffFromGitHub(e.url)
            .then((diff)=>{
                var files = parse(diff);                
                
                var commit_msg = '<hr>';
                commit_msg += 'Author: <a href="mailto:' + e.author.email + '">' + e.author.name + '</a><br/>';
                commit_msg += 'Commit: <a href="' + e.url + '">' + e.id + '</a><br/>';
                commit_msg += 'Message: ' + e.message + '<br/>';
                commit_msg += 'Date: ' + e.timestamp + '<br/>';

                for(var k=0; k < files.length; k++){
                    var file = files[k];
                
                    commit_msg += '<hr>' + file.to; //file modified name
                    commit_msg += '<table style="font-family: monospace, \'Courier New\', Courier; font-size: 12px; margin: 0;">';

                    for(var i = 0; i < file.lines.length; i++){
                        //Build HTML EMAIL
                        var change = file.lines[i];

                        if(change.add){
                            commit_msg += '<tr style="background-color:#ddffdd;">';
                        } else if (change.del){
                            commit_msg += '<tr style="background-color:#ffdddd;">';
                        } else if (change.normal){
                            commit_msg += '<tr">';
                        }                

                        if(change.add || change.del || change.normal){
                            commit_msg += '<td style="border-right:1px solid lightgray;">';
                            commit_msg += (change.normal) ? change.ln2 : change.ln;
                            commit_msg += '</td>';   
                            //Deal with tabs and spaces for emails
                            var content = escape(change.content);
                            content = content.replace(/\t/g,'\u00a0 \u00a0'); 
                            content = content.replace(/ /g, '\u00a0');   

                            if(change.add === true){
                                commit_msg += '<td>+' + content + '</td>';
                            } else if (change.del){
                                commit_msg += '<td>-' + content + '</td>';   
                            } else {
                                commit_msg += '<td>' + content + '</td>';   
                            }
                            commit_msg += '</tr>';
                        }
                            
                    };
                                   
                    commit_msg+='</table><br/>';

                };
                //console.log('commit_msg: ' + commit_msg);
                email += commit_msg;
                callback();
            })
            .catch((err)=>{
                console.log("Create message error:" + err);
                callback(err);
            });
        }, function(err) {
            if (err) return next(err);
            //console.log('Final email: ' + email);
            //console.log('sender.url: ' + event['body-json'].sender.url);

            getSenderNameFromGitHub(event['body-json'].sender.url)
            .then((name)=>{
                //console.log('Sender name: ' + name);
                var subject = '[' + event['body-json'].repository.full_name + '] ' + name + ' has pushed changes - ' + event['body-json'].head_commit.message.substring(0,60) + '...';
                var from = name + '<' + event['body-json'].pusher.email + '>';                
                email += '</body></html>';
                sendMail(email, subject, from);
            })
            .catch((err)=>{
                console.log("Get sender info error:" + err);
                callback(err);
            });
        })
    }
};

function getDiffFromGitHub(url){
    var promise = new Promise((resolve,reject)=>{
        https.get(url + '.diff',(res)=>{
            var data='';
            res.on('data',(chunk)=>{
                data+=chunk;
            }); 
            res.on('end',()=>{
                resolve(data);
            });
            
            res.on('err',(err)=>{
                console.log("HTTP GET ERROR GITHUB URL:" + err);
                reject(err); 
            })
            .on('error',(err)=>{
                console.log(err);
                reject(err);
            });
        });
    });

    return promise;
};

function getSenderNameFromGitHub(url){
    var promise = new Promise((resolve,reject)=>{
        https.get(url,(res)=>{
            var data='';
            res.on('data',(chunk)=>{
                data+=chunk;
            }); 
            res.on('end',()=>{
                resolve(JSON.parse(data).name);
            });
            
            res.on('err',(err)=>{
                console.log("HTTP GET ERROR GITHUB URL:" + err);
                reject(err); 
            })
            .on('error',(err)=>{
                console.log(err);
                reject(err);
            });
        });
    });

    return promise;
};

function sendMail(email, subject, from){ 

    var auth = {
        user: config.mailConfig.username,
        pass: config.mailConfig.password
    };

    var options = {
        host:config.mailConfig.host,
        port: config.mailConfig.port,
        secure: config.mailConfig.secure,
        requireTLS: config.mailConfig.requireTLS      
    };

    if(auth.user.length > 0 && auth.pass.length > 0){
        options['auth'] = auth;
        options['authMethod'] = config.mailConfig.authMethod;
    }
    
    var transporter = nodemailer.createTransport(options);

    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: from, 
        to: config.mailConfig.to, // can be a command separated list of receivers
        subject: subject, 
        html: email 
    };
    
    transporter.sendMail(mailOptions, function(error, info){
        if(error) console.log(error);
        
        console.log('Message sent: ' + info.response);
        transporter.close(); 
    });
};

