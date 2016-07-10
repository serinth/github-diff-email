# github-diff-email
A webhook for GitHub's push events to provide a unified diff in an email. Created as a Lambda function to be used with API Gateway.

For some additional information on some settings in AWS head over here: [http://www.tonytruong.net/getting-github-unified-diff-emails-using-aws-lambda-and-api-gateway/](http://www.tonytruong.net/getting-github-unified-diff-emails-using-aws-lambda-and-api-gateway/)

Make sure you modify the config.json:

```javascript
{
    "mailConfig":{
        "host": "SMTP SERVER",
        "username": "USERNAME",
        "password": "PASSWORD",
        "from": "email@yourdomain.com",
        "to": "email1@yourdomain.com,email2@yourdomain.com"
    },
    "github":{
        "secret": "github web hook secret"
    }
}

```

The code uses Secure SMTP connections to send emails on port 465.
