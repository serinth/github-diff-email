# github-diff-email
A webhook for GitHub's push events to provide a unified diff in an email. Created as a Lambda function to be used with API Gateway.

For some additional information on some settings in AWS head over here: [http://www.tonytruong.net/getting-github-unified-diff-emails-using-aws-lambda-and-api-gateway/](http://www.tonytruong.net/getting-github-unified-diff-emails-using-aws-lambda-and-api-gateway/)

# Requirements:
AWS Lambda currently supports up to version 4.3.2 but I've built this and packaged it on 5.7+ so that should be fine.
- API Gateway full access
- IAM Execution Role creation access
- Lambda full access
- SMTP server credentials

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

# Overview of How to Deploy
The high level overview of what you need is:

1. Clone this repository and use `npm install --save` and zip up the contents including `node_modules`
2. Create the API Gateway endpoint and point to a lambda function
3. Create the lambda function using the zip file you created with this code
4. Create an IAM Execution role for the lambda function and give the API Gateway permissions to invoke this function
5. Point the API Gateway endpoint to use this lambda function
6. Apply pass-through mappings on the API Gateway so the lambda function can access the headers and body. Use the provided body-mapping for 'application/json' from AWS in the dropdown. It should look similar to this:
![pass-through mapping api gateway](http://www.tonytruong.net/content/images/2016/07/configure_integration_endpoint_to_passthrough_everything.png)
