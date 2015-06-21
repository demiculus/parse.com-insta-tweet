# Get instagram &amp; twitter post from parse.com

With this code you can get;
- instagram posts from specified locations
- tweets from specified locations
- tweets from specified people

### Setting Up Instagram

1. Download the code and add it to your parse.com backend code. 
2. Play around with [instagram api](https://instagram.com/developer/api-console/) and see what you can do 
2. Get [authentication data from instagram](https://instagram.com/developer/authentication/): We will need access_token &  initialize
3. Get the locations you want from instagram. [This guide](https://instagram.com/developer/endpoints/locations/) shows you how you can get them. Add as many instagram locations as you want to the "instagramLocations" array in file "background_jobs.js" in function "startBackgroundJob"
5. Add your access_token & initialize strings in file "background_jobs.js" in function "getInstagramPostsFromLocation"
6. Play around with the code

### Setting Up Twitter

1. Download the code and add it to your parse.com backend code. 
2. Play around with [twitter api](https://dev.twitter.com/rest/tools/console) and see what you can do 
3. Get [authentication data from twitter](https://dev.twitter.com/oauth): We will need consumerSecret, tokenSecret, oauth_consumer_key, oauth_token
4. If you want tweets from specified people get their screen names and add them to your code in functions "startBackgroundJob" and "getTweetsFrom". Our dummy screen names are elonmusk & boredelonmusk so it'll be easier to find.
5. Add your consumerSecret, tokenSecret, oauth_consumer_key, oauth_token in file "background_jobs.js" in function "getTweetsFrom" for specified people & getTweetsFromLocation for locations
6. Play around with the code

####Notes

- Make sure to read twitter & instagram api rules.
- Thanks to: https://github.com/sreejithbnaick/Twitter-OAuth-1.1-Signature-Generator-js

