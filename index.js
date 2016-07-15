var https = require('https');
var crypto = require('crypto');
var config = require('./config.json');
var parse = require('diff-parse');
var nodemailer = require('nodemailer');
var escape = require('escape-html');

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
                email += 'Home: <a href="' + event['body-json'].repository.html_url + '">' + event['body-json'].repository.html_url + '</a><br/>';
                email += 'Commit: <a href="' + e.url + '">' + e.id + '</a><br/>';
                email += 'Author: <a href="mailto:' + e.author.email + '">' + e.author.name + '</a><br/>';
                email += 'Compare: <a href="' + event['body-json'].compare + '">' + event['body-json'].compare + '</a><br/>';
                

                files.forEach(function(file){
                
                    email += '<hr>' + file.to + '</hr>'; //file modified name
                    email += '<table style="font-family: monospace, \'Courier New\', Courier; font-size: 12px; margin: 0;">';

                    for(var i = 0; i < file.lines.length; i++){
                        //Build HTML EMAIL
                        var change = file.lines[i];

                        if(change.add){
                            email += '<tr style="background-color:#ddffdd;">';
                        } else if (change.del){
                            email += '<tr style="background-color:#ffdddd;">';
                        } else if (change.normal){
                            email += '<tr">';
                        }                

                        if(change.add || change.del || change.normal){
                            email += '<td style="border-right:1px solid lightgray;">';
                            email += (change.normal) ? change.ln2 : change.ln;
                            email += '</td>';   
                            //Deal with tabs and spaces for emails
                            var content = escape(change.content);
                            content = content.replace(/\t/g,'\u00a0 \u00a0'); 
                            content = content.replace(/ /g, '\u00a0');   

                            if(change.add === true){
                                email += '<td>+' + content + '</td>';
                            } else if (change.del){
                                email += '<td>-' + content + '</td>';   
                            } else {
                                email += '<td>' + content + '</td>';   
                            }
                            email += '</tr>';
                        }
                            
                        
                    };
                                   
                    email+='</table><br/>';
                });

                email+='</body></html>';
                return Promise.resolve({email:email,commit:e});
            })
            .then((c)=>{
                var subject = '[' + event['body-json'].repository.full_name + '] ' + c.commit.id.substring(0,6) + ': ' + c.commit.message;
                var from = c.commit.author.name + '<' + c.commit.author.email + '>';                
                sendMail(c.email, subject, from);
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

