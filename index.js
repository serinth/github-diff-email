var https = require('https');
var crypto = require('crypto');
var config = require('./config.json');
var parse = require('parse-diff');
var nodemailer = require('nodemailer');

exports.handler = (event, context, callback) => {
    
    var githubHmac = event.params.header['X-Hub-Signature'].replace('sha1=','');
    var lambdaHmac = crypto.createHmac('sha1',config.github.secret).update(JSON.stringify(event['body-json'])).digest('hex');

    if(githubHmac !== lambdaHmac){
        context.fail("Invalid GitHub Secret",null);
    } else { 

        var commits = event['body-json'].commits;

        commits.forEach(function(e,i,a){
            getDiffFromGitHub(e.url)
            .then((diff)=>{
                var files = parse(diff);
                var email = '<html><body>';
                
                email += 'Branch: ' + event['body-json'].ref + '<br/>';
                email += 'Compare: <a href="' + event['body-json'].compare + '">' + event['body-json'].compare + '</a><br/>'
                files.forEach(function(file){
                    email += '<hr>' + file.to + '</hr>'; //file modified name
                    email += '<table>';

                    file.chunks.forEach(function(chunk){
                        chunk.changes.forEach(function(change,idx,array){
                            //Build HTML EMAIL
                            email += '<tr>';                            
                                email += '<td style="border-right:1px solid lightgray;">';
                                email += (change.normal) ? change.ln2 : change.ln;
                                email += '</td>';

                                if(change.add){
                                    email += '<td style="background-color:#ddffdd;">';
                                } else if (change.del){
                                    email += '<td style="background-color:#ffdddd;">';
                                } else if (change.normal){
                                    email += '<td>';
                                }                         
                                
                                email += change.content;
                                email += '</td>';

                            email += '</tr>';
                        });              
                    });

                    email+='</table><br/>';
                });
                email+='</body></html>';
                return Promise.resolve(email);
            })
            .then((email)=>{
                console.log(email);
                sendMail(email);
            })
            .catch((err)=>{
                callback(err);
            });
        });

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

function sendMail(email){ 

    var auth = {
        user: config.mailConfig.username,
        pass: config.mailConfig.password
    };

    var options = {
        host:config.mailConfig.host,
        port: 465,
        secure: true,
        requireTLS: true,
        auth: auth,
        authMethod: 'LOGIN'
    };
    
    var transporter = nodemailer.createTransport(options);

    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: config.mailConfig.from, 
        to: config.mailConfig.to, // can be a command separated list of receivers
        subject: 'GitHub Push Notification', 
        html: email 
    };
    
    transporter.sendMail(mailOptions, function(error, info){
        if(error) console.log(error);
        
        console.log('Message sent: ' + info.response);
        transporter.close(); 
    });
};

