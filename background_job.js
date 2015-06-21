var _ = require('underscore');
var utils = require("cloud/utils/utils.js");
var state = utils.cloudConfig();
var push_notifications = require('cloud/push_notifications/push_notifications.js');


module.exports = {
    startBackgroundJob: function (request, status) {
        startBackgroundJob(request, status);
    }
};

function sendPushNotificationIfCommentIsLiked() {
    function getNotificationActiveUsersWhoHasntLogedInForADay() {
        var promise = new Parse.Promise();
        console.log('2');
        var d = new Date();
        var oneDayAgo = new Date(d.getTime() -  (24 * 60 * 60 * 1000)); 

        var query = new Parse.Query("_User");
        query.limit(1000);
        query.exists('Installations');
        query.lessThanOrEqualTo("LoginDate", oneDayAgo);
        query.find(function(users) {
            console.log('3');
            promise.resolve(users);
        }, function(err) {
            console.log('4');
            promise.reject();
        }); 
        return promise;
    }

    function getRecentCommentLikesForUsers(userIdPointers) {
        console.log('8');
        var promise = new Parse.Promise();   

        var d = new Date();
        var oneDayAgo = new Date(d.getTime() -  (24 * 60 * 60 * 1000));      
        console.log('8.1: one day ago: ' + JSON.stringify(oneDayAgo));
        var query = new Parse.Query('Comments');
        query.limit(1000);
        query.containedIn("UserId", userIdPointers);
        query.greaterThanOrEqualTo('LikeCount', 1);
        query.greaterThanOrEqualTo('updatedAt', oneDayAgo);
        query.find(function(comments) {
            console.log('9 comments: ' + JSON.stringify(comments));
            promise.resolve(comments);
        }, function(err) {
            console.log('10');
            promise.reject();
        });

        return promise;
    }

    function getInstallationList(commenterUserIds) {
        console.log('13');
        var promise = new Parse.Promise(); 

        var query = new Parse.Query('_User');
        query.limit(1000);
        query.containedIn('objectId', commenterUserIds);
        query.find(function(userObjects) {
            var installationList = [];
            for(var i = 0; i < userObjects.length; i++) {
                installationList.push(userObjects[i].get('Installations'));
            }
            console.log('14 installations are : ' + installationList);
            promise.resolve(installationList);

        }, function(err) {
            console.log('15');
            promise.reject;
        });

        return promise;
    }
    console.log('1');
    var promise = new Parse.Promise();

    getNotificationActiveUsersWhoHasntLogedInForADay().then(function(userObjects) {
        console.log('5');
        var userIdPointers = [];
        for(var i = 0; i < userObjects.length; i++) {
            var userPointer =  {__type: "Pointer", className: "_User", objectId: userObjects[i].id};
            userIdPointers.push(userPointer);
        }
        console.log('6 users are: ' + JSON.stringify(userObjects));
        console.log('7 user ids are: ' + JSON.stringify(userIdPointers));
        getRecentCommentLikesForUsers(userIdPointers).then(function(commentObjects) {
            console.log('11 commentObjects: ' + JSON.stringify(commentObjects));
            var commenterUserIds = [];
            if (commentObjects !== null && commentObjects !== undefined) {
                console.log('11.3')
                for(var i = 0; i < commentObjects.length; i++) {
                commenterUserIds.push(commentObjects[i].get('UserId').id);
                }    
            } else {
                console.log('11.5')
                promise.reject();
            }
            
            console.log('12 commenterUserIds: ' + JSON.stringify(commenterUserIds));
            getInstallationList(commenterUserIds).then(function(installationList) {
                console.log('16');
                var text = "Your comment is getting liked";
                push_notifications.sendPush(installationList, text);
                // Furkan çalışıyor bu, fakat cidden push yolladı mı telefona bilmiorm, bi telefonda test etmek lazım
                // Ote yandan 108. satırdaki functiondan sonra .then(function() { promise.resolve(); });
                // 113. satırdaki resolve .then içine alınmalı. Fakat onu yapamadım bi baksana
                console.log('17');
                promise.resolve();
            }, 
            function (error) {
                console.log('18');
                promise.reject();
            });
        }, 
        function (error) {
            console.log('19');
            promise.reject();
        });
    }, 
    function (error) {
        console.log('20');
        promise.reject();
    });
    console.log('1.1');
    // addToNotificationObjects(); 
    // furkan bu functionu yazmadım çünkü bu işlemi direk birileri
    // commentlike ettiğinde direk yollasak daha iyi
    // Burada sadece push notification yollayalım adama

    return promise;
}

// Saves the deleted card info to google docs
function wizardDeleteContentGoogleDocs(object) {
    var promise = new Parse.Promise();
    var contentType = '';

    if (object.get("Category") === undefined || object.get("Category") === null) {
    } else {
        contentType = object.get('Category');
    }

    var spreadCount = object.get('SpreadCount');
    var skipCount = object.get('SkipCount');
    var commentCount = object.get('CommentCount');
    var shareCount = object.get('ShareCount');

    var doc_url = "https://docs.google.com/forms/d/1jbqXuWaqd6pVFG9gu8Dtkr3U1WfLyt1EIa19uAucEIk/formResponse";

    Parse.Cloud.httpRequest({
        method: 'POST',
        url: doc_url,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            //'Content-length' : log_data.length,
        },
        body: {
            'entry_1966721809': contentType,
            'entry_772660888': spreadCount, 
            'entry_1661734137': skipCount, 
            'entry_1554160269': commentCount,
            'entry_1604921171': shareCount,
        },
    }).then(function(httpResponse) {
        promise.resolve();
    }, 
    function (error) {
        promise.reject();
    });
    return promise;
}

// Makes Deleted column true, of cards with passed duedates
function makeDueDatePassedCardsDeletedTrue() {
    var promises = [];

    // Get Current Date
    var d = new Date();
    var currentDate = new Date(d.getTime()); 

    var query = new Parse.Query("ODTU");
    query.limit(1000);
    query.exists('DueDate');
    query.notEqualTo("Deleted", true);
    query.lessThanOrEqualTo("DueDate", currentDate);
    promises.push(
        query.find().then(function(results) {
            var promises2 = [];

            results.forEach(function(object) {

                function makeDeletedTrue(object) {
                    object.set("Deleted", true);
                    return object.save();
                }

                promises2.push(makeDeletedTrue(object)); 
            });
            return Parse.Promise.when(promises2);
        })
    );
    return Parse.Promise.when(promises);
}

// Delets all 'Deleted = true' cards with their spread skip & comments
function deleteAllDeletedTrueCards() {
    Parse.Cloud.useMasterKey();
    var promise = new Parse.Promise();
    var promises1 = [];
    var promises2 = [];

    // Gets Deleted = true card ids
    var query = new Parse.Query("ODTU");
    query.limit(5);
    query.equalTo("Deleted", true);

    query.find().then(function(results) {

        // Deletes all comments
        // Deletes all spreads
        // Deletes all skips
        results.forEach(function(card) {

            function callQueryAndDeleteObjects(className, cardId) {
                var promise1 = new Parse.Promise();
                var promises3 = [];
                
                var query = new Parse.Query(className);
                query.equalTo("ContentId", { __type: "Pointer", className: "ODTU", objectId: cardId });
                query.limit(1000);

                query.find().then(function(results) {

                    function deleteObject(object) {
                        promises2.push(
                            object.destroy({
                                success: function(myObject) {
                                    return Parse.Promise.as();
                                // The object was deleted from the Parse Cloud.
                                },
                                error: function(myObject, error) {
                                    return Parse.Promise.error();
                                }
                            })
                        );
                    }

                    for(var i = 0; i< results.length; i++) {
                        var object = results[i];
                        deleteObject(object);
                    }

                    return Parse.Promise.when(promises2).then(function() {
                        promise1.resolve();
                    });
                });
                  
                return promise1;
            }

            // Records the deleted file in google docs
            if(state["deployment"]) {
                wizardDeleteContentGoogleDocs(card);
            } 

            promises1.push(callQueryAndDeleteObjects('Comments', card.id));
            promises1.push(callQueryAndDeleteObjects('Content_Spread', card.id));
            promises1.push(callQueryAndDeleteObjects('Content_Skip', card.id));
        });

        // After comments, spreads & skips are deleted, deletes the card
        Parse.Promise.when(promises1).then(function() {
            var promises4 = [];

            function deleteCard(object) {
                promises4.push(
                    object.destroy({
                        success: function(myObject) {
                            return Parse.Promise.as();
                        // The object was deleted from the Parse Cloud.
                        },
                        error: function(myObject, error) {
                            return Parse.Promise.error();
                        }
                    })
                );
            }

            results.forEach(function(object) {
                deleteCard(object);
                // Set the card count etc.. 
            });
            return Parse.Promise.when(promises4);
        }).then(function() {
            promise.resolve();
        });
    });
    
    return promise;
}

function createWeatherCard() {
    var promise = new Parse.Promise();
    var xmlreader = require('cloud/libs/xmlreader.js');

    Parse.Cloud.httpRequest({
        url: 'http://weather.yahooapis.com/forecastrss?w=2343732&u=c',
        success: function(httpResponse) {

            xmlreader.read(httpResponse.text, function (err, xmldata) {
                if(err) {
                    promise.resolve();
                    return ;
                }

                // Gets test or development mode of the app & sets IDs
                var userId = '';
                if(state["test"]) {
                    userId = "zWca3Kx6jv";
                } else if (state["deployment"]) {
                    userId = "uJ06JkOKlF";
                }

                function convertIconToDay(iconCode) {
                    var nightCodes = ['27', '29', '31', '33'];

                    if (_.contains(nightCodes, iconCode)) {
                        return (parseInt(iconCode) + 1).toString();
                    }    
                    return iconCode.toString();
                }
    
                // Save Expiration - 17 hours from now
                var expirationDate = utils.cardExpirationDate(0,0,17,0); // Year, day, hour, min

                // TODO: delete cardData and Text when everybody has 1.3.2
                var cardData = 
                "ODTU Weather " + xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().date + "\n" + 
                "Temperature: " + xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().low + "° / " + xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().high + "°\n" +
                "Status: " + xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().text;

                var cardMisc = JSON.stringify(xmldata.rss.channel);
                var cardMisc = {
                                "wind" : {
                                    "chill" : xmldata.rss.channel['yweather:wind'].attributes().chill,
                                    "direction" : xmldata.rss.channel['yweather:wind'].attributes().direction,
                                    "speed" : xmldata.rss.channel['yweather:wind'].attributes().speed
                                },
                                "atmosphere" : {
                                    "humidity" : xmldata.rss.channel['yweather:atmosphere'].attributes().humidity,
                                    "pressure" : xmldata.rss.channel['yweather:atmosphere'].attributes().pressure
                                },
                                "astronomy" : {
                                    "sunrise" : xmldata.rss.channel['yweather:astronomy'].attributes().sunrise,
                                    "sunset" : xmldata.rss.channel['yweather:astronomy'].attributes().sunset
                                },
                                "location" : {
                                    "city" : xmldata.rss.channel['yweather:location'].attributes().city,
                                    "country" : xmldata.rss.channel['yweather:location'].attributes().country
                                },
                                "condition" : {
                                    "text" : xmldata.rss.channel.item['yweather:condition'].attributes().text,
                                    "code" : convertIconToDay(xmldata.rss.channel.item['yweather:condition'].attributes().code),
                                    "temp" : xmldata.rss.channel.item['yweather:condition'].attributes().temp,
                                    "date" : xmldata.rss.channel.item['yweather:condition'].attributes().date                                    
                                },
                                "forecasts" : [
                                    {
                                        // "day1" : {
                                            "day" : xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().day,
                                            "date" : xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().date,
                                            "low" : xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().low,
                                            "high" : xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().high,
                                            "text" : xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().text,
                                            "code" : convertIconToDay(xmldata.rss.channel.item['yweather:forecast'].at(0).attributes().code)
                                        // }
                                    },
                                    {
                                        // "day2" : {
                                            "day" : xmldata.rss.channel.item['yweather:forecast'].at(1).attributes().day,
                                            "date" : xmldata.rss.channel.item['yweather:forecast'].at(1).attributes().date,
                                            "low" : xmldata.rss.channel.item['yweather:forecast'].at(1).attributes().low,
                                            "high" : xmldata.rss.channel.item['yweather:forecast'].at(1).attributes().high,
                                            "text" : xmldata.rss.channel.item['yweather:forecast'].at(1).attributes().text,
                                            "code" : convertIconToDay(xmldata.rss.channel.item['yweather:forecast'].at(1).attributes().code)
                                        // }
                                    },
                                    {
                                        // "day3" : {
                                            "day" : xmldata.rss.channel.item['yweather:forecast'].at(2).attributes().day,
                                            "date" : xmldata.rss.channel.item['yweather:forecast'].at(2).attributes().date,
                                            "low" : xmldata.rss.channel.item['yweather:forecast'].at(2).attributes().low,
                                            "high" : xmldata.rss.channel.item['yweather:forecast'].at(2).attributes().high,
                                            "text" : xmldata.rss.channel.item['yweather:forecast'].at(2).attributes().text,
                                            "code" : convertIconToDay(xmldata.rss.channel.item['yweather:forecast'].at(2).attributes().code)
                                        // }
                                    },
                                    {
                                        // "day4" : {
                                            "day" : xmldata.rss.channel.item['yweather:forecast'].at(3).attributes().day,
                                            "date" : xmldata.rss.channel.item['yweather:forecast'].at(3).attributes().date,
                                            "low" : xmldata.rss.channel.item['yweather:forecast'].at(3).attributes().low,
                                            "high" : xmldata.rss.channel.item['yweather:forecast'].at(3).attributes().high,
                                            "text" : xmldata.rss.channel.item['yweather:forecast'].at(3).attributes().text,
                                            "code" : convertIconToDay(xmldata.rss.channel.item['yweather:forecast'].at(3).attributes().code)
                                        // }
                                    },
                                    {
                                        // "day5" : {
                                            "day" : xmldata.rss.channel.item['yweather:forecast'].at(4).attributes().day,
                                            "date" : xmldata.rss.channel.item['yweather:forecast'].at(4).attributes().date,
                                            "low" : xmldata.rss.channel.item['yweather:forecast'].at(4).attributes().low,
                                            "high" : xmldata.rss.channel.item['yweather:forecast'].at(4).attributes().high,
                                            "text" : xmldata.rss.channel.item['yweather:forecast'].at(4).attributes().text,
                                            "code" : convertIconToDay(xmldata.rss.channel.item['yweather:forecast'].at(4).attributes().code)
                                        // }
                                    }
                                ]
                            };

                var ODTU = Parse.Object.extend("ODTU");
                var weatherCard = new ODTU();
                weatherCard.set("Text", cardData);
                weatherCard.set("Misc", JSON.stringify(cardMisc));
                weatherCard.set("UserId",  { __type: "Pointer", className: "_User", objectId: userId });
                weatherCard.set("CommentCount", 0);
                weatherCard.set("SpreadCount", 0);
                weatherCard.set("SkipCount", 0);
                weatherCard.set("ShareCount", 0);
                weatherCard.set("Anonymous", false);
                weatherCard.set("DueDate", expirationDate);
                weatherCard.set("Category", 'Weather');
                weatherCard.save(null, {
                    success: function(obj) {
                        // Increases TotalUploadCount of Weather Wizard
                        Parse.Cloud.useMasterKey();
                        var query = new Parse.Query("User");
                        query.get(userId).then(function(results){
                            var userObject = results;  
                            userObject.increment("TotalUploadCount", 1);
                            return userObject.save();
                        }).then(function() {
                            promise.resolve();  
                        });
                    },
                    error: function(obj, error) {
                        promise.reject();
                    }
                });
            });
        },
        error: function(httpResponse) {
            // status.error("Weather Card Error");
            promise.reject();
        }
    });
    return promise;
}

function createCafeteriaCard() {
    var xmlreader = require('cloud/libs/xmlreader.js');
    var _ = require('underscore');

    var ogleMealTitle = [];
    var ogleFoodTitles = [];
    var ogleFoodImageURLS = [];

    var aksamMealTitle = [];
    var aksamFoodTitles = [];
    var aksamFoodImageURLS = [];

    var promise = new Parse.Promise();

    var url = "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D'kafeterya.metu.edu.tr'&format=xml&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys";
    Parse.Cloud.httpRequest({
        url: url,
        success: function(httpResponse) {
            xmlreader.read(httpResponse.text, function (err, xmldata) {
                if(err) return console.log("Error Ocurred\n\n" + err);

                var thereIsLunch = false;
                var thereIsSupper = false;
                var promises = [];

                if (xmldata.query.results.body.div.at(0).div.at(1).div.at(1).h3.text() === 'Öğle Yemeği') {
                    thereIsLunch = true;
                }

                if (xmldata.query.results.body.div.at(0).div.at(1).div.at(3).h3.text() === 'Akşam Yemeği') {
                    thereIsSupper = true;
                }

                function saveCards(expirationHour, mealCardData, mealType) {
                    var promise = new Parse.Promise();
                    var userId = ''; 

                    // Gets test or development mode of the app & sets IDs
                    if(state["test"]) {
                        userId = "N8I09vj3kA";
                    } else if (state["deployment"]) {
                        userId = "7st1rkewdk";
                    } 

                    // Save Expiration
                    var expirationDate = utils.cardExpirationDate(0,0,expirationHour,0); // Year, day, hour, min

                    var ODTU = Parse.Object.extend("ODTU");
                    var mealCard = new ODTU();
                    mealCard.set("Text", mealCardData);
                    mealCard.set("UserId",  { __type: "Pointer", className: "_User", objectId: userId });
                    mealCard.set("CommentCount", 0);
                    mealCard.set("SpreadCount", 0);
                    mealCard.set("SkipCount", 0);
                    mealCard.set("ShareCount", 0);
                    mealCard.set("Anonymous", false);
                    mealCard.set("DueDate", expirationDate);
                    mealCard.set("Category", mealType);

                    mealCard.save(null, {
                        success: function(obj) {
                            // Increases TotalUploadCount of Cafeteria Wizard
                            Parse.Cloud.useMasterKey();
                            var query = new Parse.Query("User");
                            query.get(userId).then(function(results){
                                var userObject = results;  
                                userObject.increment("TotalUploadCount", 1);
                                return userObject.save();
                            }).then(function() {
                                promise.resolve();
                            });
                        },
                        error: function(obj, error) {
                            promise.reject();
                        }
                    });
                    return promise;
                }

                if (thereIsSupper) {
                    aksamMealTitle = xmldata.query.results.body.div.at(0).div.at(1).div.at(3).h3.text();

                    aksamFoodTitles.push(xmldata.query.results.body.div.at(0).div.at(1).div.at(3).div.at(0).span.img.attributes().alt);
                    aksamFoodTitles.push(xmldata.query.results.body.div.at(0).div.at(1).div.at(3).div.at(1).span.img.attributes().alt);
                    aksamFoodTitles.push(xmldata.query.results.body.div.at(0).div.at(1).div.at(3).div.at(2).span.img.attributes().alt);
                    aksamFoodTitles.push(xmldata.query.results.body.div.at(0).div.at(1).div.at(3).div.at(3).span.img.attributes().alt);

                    aksamFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + xmldata.query.results.body.div.at(0).div.at(1).div.at(3).div.at(0).span.img.attributes().src);
                    aksamFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + xmldata.query.results.body.div.at(0).div.at(1).div.at(3).div.at(1).span.img.attributes().src);
                    aksamFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + xmldata.query.results.body.div.at(0).div.at(1).div.at(3).div.at(2).span.img.attributes().src);
                    aksamFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + xmldata.query.results.body.div.at(0).div.at(1).div.at(3).div.at(3).span.img.attributes().src);  
                    
                    var supperCardData = 'ODTU Cafeteria - ' + 
                    aksamMealTitle + "\n" + 
                    aksamFoodTitles[0] + "\n" + 
                    aksamFoodTitles[1] + "\n" + 
                    aksamFoodTitles[2] + "\n" + 
                    aksamFoodTitles[3] 
                    // + aksamFoodImageURLS

                    promises.push(saveCards(12, supperCardData, 'CafeteriaEvening'));
                }

                if (thereIsLunch) {
                    ogleMealTitle = xmldata.query.results.body.div.at(0).div.at(1).div.at(1).h3.text();

                    ogleFoodTitles.push(xmldata.query.results.body.div.at(0).div.at(1).div.at(1).div.at(0).span.img.attributes().alt);
                    ogleFoodTitles.push(xmldata.query.results.body.div.at(0).div.at(1).div.at(1).div.at(1).span.img.attributes().alt);
                    ogleFoodTitles.push(xmldata.query.results.body.div.at(0).div.at(1).div.at(1).div.at(2).span.img.attributes().alt);
                    ogleFoodTitles.push(xmldata.query.results.body.div.at(0).div.at(1).div.at(1).div.at(3).span.img.attributes().alt);

                    ogleFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + xmldata.query.results.body.div.at(0).div.at(1).div.at(1).div.at(0).span.img.attributes().src);
                    ogleFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + xmldata.query.results.body.div.at(0).div.at(1).div.at(1).div.at(1).span.img.attributes().src);
                    ogleFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + xmldata.query.results.body.div.at(0).div.at(1).div.at(1).div.at(2).span.img.attributes().src);
                    ogleFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + xmldata.query.results.body.div.at(0).div.at(1).div.at(1).div.at(3).span.img.attributes().src);
                    
                    var lunchCardData = 'ODTU Cafeteria - ' + 
                    ogleMealTitle + "\n" + 
                    ogleFoodTitles[0] + "\n" + 
                    ogleFoodTitles[1] + "\n" + 
                    ogleFoodTitles[2] + "\n" + 
                    ogleFoodTitles[3] 
                    //+ ogleFoodImageURLS

                    promises.push(saveCards(8, lunchCardData, 'CafeteriaNoon'));
                }
                    // TODO Burda çalışmayan şey _.each functionının dönderdiği değer.. div de yanlışlık var..
                    // _.each(xmldata.query.results.body.div.at(0).div.at(1).div.at(1).div, function(food) {
                    //     console.log('3.5' + JSON.stringify(xmldata.query.results.body.div.at(0).div.at(1).div.at(1)));
                    //     console.log('3.5' + JSON.stringify(food));
                    //     console.log('foot ' + JSON.stringify(food.span));
                    //     console.log('foot ' + JSON.stringify(food.span.img));
                    //     console.log('foot ' + JSON.stringify(food.span.img.attributes().alt));
                    //     ogleFoodTitles.push(food.span.img.attributes().alt);
                    //     ogleFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + food.span.img.attributes().src);
                    // });

                    
                    // _.each(xmldata.query.results.body.div.at(0).div.at(1).div.at(3).div, function(food) {
                    //     aksamFoodTitles.push(food.span.img.attributes().alt);
                    //     aksamFoodImageURLS.push("http://kafeterya.metu.edu.tr/" + food.span.img.attributes().src);
                    // })

                    // console.log(ogleMealTitle);
                    // console.log(ogleFoodTitles);
                    // console.log(ogleFoodImageURLS);
                    // console.log("-----------------");
                    // console.log(aksamMealTitle);
                    // console.log(aksamFoodTitles);
                    // console.log(aksamFoodImageURLS);
                
                    Parse.Promise.when(promises).then(function() {
                        promise.resolve();
                    });
            });
        },
        error: function(err) {
        }
    });

    return promise;
}


function getTweetsFromLocation() {
    var tweetPromise = new Parse.Promise();

    var oauth = require('cloud/libs/oauth.js');
    var sha = require('cloud/libs/sha1.js'); 

    // Source: https://github.com/sreejithbnaick/Twitter-OAuth-1.1-Signature-Generator-js
    var urlLink = 'https://api.twitter.com/1.1/search/tweets.json?q=%3F&geocode=39.891838,32.783348,1.8km&count=100';

    var consumerSecret = "p9ABnhrIm5qtGRMpzaZLJAGGqWvFR4GmsvV9IsUQSxRShy8uKK";
    var tokenSecret = "Wj6RxWQz6zy058e2M4zNXPRfqrEn4VlcxSNbuv7d410lo";
    var oauth_consumer_key = "hKHVs8mDhW1rvZaPSLV9NywDS";
    var oauth_token = "2900478017-RUQFnvSL7Vh1WohOBLbkswx55vtcgbnaexNt6ed";

    var nonce = oauth.nonce(32);
    var ts = Math.floor(new Date().getTime() / 1000);
    var timestamp = ts.toString();

    var accessor = {
        "consumerSecret": consumerSecret,
        "tokenSecret": tokenSecret
    };


    var params = {
        "oauth_version": "1.0",
        "oauth_consumer_key": oauth_consumer_key,
        "oauth_token": oauth_token,
        "oauth_timestamp": timestamp,
        "oauth_nonce": nonce,
        "oauth_signature_method": "HMAC-SHA1"
    };
    var message = {
        "method": "GET",
        "action": urlLink,
        "parameters": params
    };


    //lets create signature
    oauth.SignatureMethod.sign(message, accessor);
    var normPar = oauth.SignatureMethod.normalizeParameters(message.parameters);
    // console.log("Normalized Parameters: " + normPar);
    var baseString = oauth.SignatureMethod.getBaseString(message);
    // console.log("BaseString: " + baseString);
    var sig = oauth.getParameter(message.parameters, "oauth_signature") + "=";
    // console.log("Non-Encode Signature: " + sig);
    var encodedSig = oauth.percentEncode(sig); //finally you got oauth signature
    // console.log("Encoded Signature: " + encodedSig);

    Parse.Cloud.httpRequest({
        method: 'GET',
        url: urlLink,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": 'OAuth oauth_consumer_key="' + oauth_consumer_key + '", oauth_nonce=' + nonce + ', oauth_signature=' + encodedSig + ', oauth_signature_method="HMAC-SHA1", oauth_timestamp=' + timestamp + ',oauth_token="' + oauth_token + '", oauth_version="1.0"'
        },
        body: {
        },
        success: function(httpResponse) {
            var promises = [];
            var tweets = JSON.parse(httpResponse.text);

            // Gets test or development mode of the app & sets IDs
            var userId = '';
            if(state["test"]) {
                userId = "VInSjjxan7";
            } else if (state["deployment"]) {
                userId = "BT9bsuKKsk";
            }

            _.each(tweets.statuses, function(tweet) {
                var tweetId = tweet.id_str;
                var createdAt = new Date(tweet.created_at);
                var tweetText = tweet.text;
                var retweetCount = tweet.retweet_count;
                var favoriteCount = tweet.favorite_count;
                var name = tweet.user.name;
                var screenName = tweet.user.screen_name;
                var profilePicture = tweet.user.profile_image_url;
                var isReply = tweet.in_reply_to_status_id;
                var isMentioned = tweet.entities.user_mentions.length;
                var cardText = tweetText + '\n\n' + name;

                var isRT = tweet.retweeted_status;
                if (isRT === undefined) {
                    isRT = 1;
                } else {
                    isRT = tweet.retweeted_status.length;
                }

                var isPostNew = new Date().getTime() - (24 * 60 * 60 * 1000) < createdAt.getTime();

                if (!isReply && !isMentioned && isRT === 1 && retweetCount + favoriteCount > 5 && isPostNew) {
                    // Create Card
                    var ODTU = Parse.Object.extend("ODTU");
                    var tweetCard = new ODTU();

                    var promise = new Parse.Promise();
                    promises.push(promise);

                    var query = new Parse.Query("ODTU");
                    query.equalTo("Misc", tweetId);
                    query.find().then(function(objects) {
                    if (objects.length == 0) {
                        return Parse.Promise.as();
                    } else {
                        return Parse.Promise.error();
                    }

                    }).then(function() {
                        console.log("Query bitti");
                        try {
                            var media = tweet.entities.media;
                            var mediaURL = media[0].media_url;
                            console.log("mediaURL " + JSON.stringify(mediaURL));

                            var lastIndex = cardText.lastIndexOf(" ")
                            cardText = cardText.substring(0, lastIndex);

                            Parse.Cloud.httpRequest({ url: mediaURL }).then(function(response) {  
                                var base64 = response.buffer.toString("base64");
                                var parseFile = new Parse.File("tweetImage.jpg", { base64: base64 });
                                parseFile.save().then(function() {
                                    console.log("buffer girdi");
                                    console.log("tweetCard " + JSON.stringify(tweetCard));

                                    tweetCard.set("File", parseFile);
                                    tweetCard.set("Text", cardText);
                                    tweetCard.set("UserId",  { __type: "Pointer", className: "_User", objectId: userId });
                                    tweetCard.set("CommentCount", 0);
                                    tweetCard.set("SpreadCount", 0);
                                    tweetCard.set("SkipCount", 0);
                                    tweetCard.set("ShareCount", 0);
                                    tweetCard.set("Anonymous", false);
                                    tweetCard.set("Category", 'Tweet');
                                    tweetCard.set("Misc", tweetId);

                                    tweetCard.save().then(function() {
                                        promise.resolve();
                                    });
                                });                         
                            });
                        } catch(err) {
                            console.log("err");
                        
                            tweetCard.set("Text", cardText);
                            tweetCard.set("UserId",  { __type: "Pointer", className: "_User", objectId: userId });
                            tweetCard.set("CommentCount", 0);
                            tweetCard.set("SpreadCount", 0);
                            tweetCard.set("SkipCount", 0);
                            tweetCard.set("ShareCount", 0);
                            tweetCard.set("Anonymous", false);
                            tweetCard.set("Category", 'Tweet');
                            tweetCard.set("Misc", tweetId);

                            tweetCard.save().then(function() {
                                promise.resolve();
                            });
                        }  
                    }, function(err) {
                        promise.resolve();
                    });                       
                }
            });

            Parse.Promise.when(promises).then(function() {
                tweetPromise.resolve();
            }, function(error) {
                tweetPromise.reject();
            });
        },
        error: function(httpResponse) {
            response.error('Request failed with response ' + httpResponse.status + ' , ' + JSON.stringify(httpResponse));
            tweetPromise.reject();
        }
    });
    return tweetPromise;
}

function getTweetsFrom(screen_name, count) {
    var oauth = require('cloud/libs/oauth.js');
    var sha = require('cloud/libs/sha1.js'); 

    var tweetPromise = new Parse.Promise();

    var urlLink = 'https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name='+screen_name+'&count='+count;

    var consumerSecret = "p9ABnhrIm5qtGRMpzaZLJAGGqWvFR4GmsvV9IsUQSxRShy8uKK";
    var tokenSecret = "Wj6RxWQz6zy058e2M4zNXPRfqrEn4VlcxSNbuv7d410lo";
    var oauth_consumer_key = "hKHVs8mDhW1rvZaPSLV9NywDS";
    var oauth_token = "2900478017-RUQFnvSL7Vh1WohOBLbkswx55vtcgbnaexNt6ed";

    var nonce = oauth.nonce(32);
    var ts = Math.floor(new Date().getTime() / 1000);
    var timestamp = ts.toString();

    var accessor = {
        "consumerSecret": consumerSecret,
        "tokenSecret": tokenSecret
    };

    var params = {
        "oauth_version": "1.0",
        "oauth_consumer_key": oauth_consumer_key,
        "oauth_token": oauth_token,
        "oauth_timestamp": timestamp,
        "oauth_nonce": nonce,
        "oauth_signature_method": "HMAC-SHA1"
    };
    var message = {
        "method": "GET",
        "action": urlLink,
        "parameters": params
    };

    //lets create signature
    oauth.SignatureMethod.sign(message, accessor);
    var normPar = oauth.SignatureMethod.normalizeParameters(message.parameters);
    // console.log("Normalized Parameters: " + normPar);
    var baseString = oauth.SignatureMethod.getBaseString(message);
    // console.log("BaseString: " + baseString);
    var sig = oauth.getParameter(message.parameters, "oauth_signature") + "=";
    // console.log("Non-Encode Signature: " + sig);
    var encodedSig = oauth.percentEncode(sig); //finally you got oauth signature
    // console.log("Encoded Signature: " + encodedSig);

    Parse.Cloud.httpRequest({
        method: 'GET',
        url: urlLink,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": 'OAuth oauth_consumer_key="' + oauth_consumer_key + '", oauth_nonce=' + nonce + ', oauth_signature=' + encodedSig + ', oauth_signature_method="HMAC-SHA1", oauth_timestamp=' + timestamp + ',oauth_token="' + oauth_token + '", oauth_version="1.0"'
        },
        body: {
        },
        success: function(httpResponse) {
            var promises = [];
            var tweets = JSON.parse(httpResponse.text);
            var userId = '';

            if (screen_name === "parodyrektor") {
                if(state["test"]) {
                    userId = "UoJtTrEdty";
                } else if (state["deployment"]) {
                    userId = "q0y2ZIWqtn";
                }
            } else if (screen_name === "odtuogrencileri") {
                if(state["test"]) {
                    userId = "fOYCZdAtno";
                } else if (state["deployment"]) {
                    userId = "nVtPoZXYy8";
                }                
            } else if (screen_name === "thrcimen") {
                if(state["test"]) {
                    userId = "84uBKavWz4";
                } else if (state["deployment"]) {
                    userId = "1JMTZRJxuH";
                }                
            }

            _.each(tweets, function(tweet) {
                // console.log("Tweet :" + JSON.stringify(tweet));

                // var retweetCount = tweet.retweet_count;
                // var favoriteCount = tweet.favorite_count;
                var createdAt = new Date(tweet.created_at);
                var tweetId = tweet.id_str;
                var tweetText = tweet.text;
                // var name = tweet.user.name;
                // var screenName = tweet.user.screen_name;
                // var profilePicture = tweet.user.profile_image_url;
                var isReply = tweet.in_reply_to_status_id;
                var cardText = tweetText.trim();

                var isPostNew = new Date().getTime() - (24 * 60 * 60 * 1000) < createdAt.getTime();

                if (!isReply && isPostNew) {
                    // Create Card
                    var ODTU = Parse.Object.extend("ODTU");
                    var tweetCard = new ODTU();

                    var promise = new Parse.Promise();
                    promises.push(promise);

                    var query = new Parse.Query("ODTU");
                    query.equalTo("Misc", tweetId);
                    query.find().then(function(objects) {
                        if (objects.length == 0) {
                            return Parse.Promise.as();
                        } else {
                            return Parse.Promise.error();
                        }
                    }).then(function() {
                        console.log("Query bitti");
                        try {
                            var media = tweet.entities.media;
                            var mediaURL = media[0].media_url;
                            console.log("mediaURL " + JSON.stringify(mediaURL));

                            var lastIndex = cardText.lastIndexOf(" ")
                            cardText = (cardText.substring(0, lastIndex)).trim();

                            Parse.Cloud.httpRequest({ url: mediaURL }).then(function(response) {  
                                var base64 = response.buffer.toString("base64");
                                var parseFile = new Parse.File("tweetImage.jpg", { base64: base64 });
                                parseFile.save().then(function() {
                                    console.log("buffer girdi");
                                    console.log("tweetCard " + JSON.stringify(tweetCard));

                                    tweetCard.set("File", parseFile);
                                    tweetCard.set("Text", cardText);
                                    tweetCard.set("UserId",  { __type: "Pointer", className: "_User", objectId: userId });
                                    tweetCard.set("CommentCount", 0);
                                    tweetCard.set("SpreadCount", 0);
                                    tweetCard.set("SkipCount", 0);
                                    tweetCard.set("ShareCount", 0);
                                    tweetCard.set("Anonymous", false);
                                    tweetCard.set("Category", 'Tweet');
                                    tweetCard.set("Misc", tweetId);

                                    tweetCard.save().then(function() {
                                        promise.resolve();
                                    });

                                });                         
                            });
                        } catch(err) {
                            console.log("err");
                        
                            tweetCard.set("Text", cardText);
                            tweetCard.set("UserId",  { __type: "Pointer", className: "_User", objectId: userId });
                            tweetCard.set("CommentCount", 0);
                            tweetCard.set("SpreadCount", 0);
                            tweetCard.set("SkipCount", 0);
                            tweetCard.set("ShareCount", 0);
                            tweetCard.set("Anonymous", false);
                            tweetCard.set("Category", 'Tweet');
                            tweetCard.set("Misc", tweetId);

                            tweetCard.save().then(function() {
                                promise.resolve();
                            });
                        }  
                    }, function(err) {
                        promise.resolve();
                    });                       
                }
            });

            Parse.Promise.when(promises).then(function() {
                tweetPromise.resolve();
            }, function(error) {
                tweetPromise.reject();
            });
        },
        error: function(httpResponse) {
            console.log('Request failed with response ' + httpResponse.status + ' , ' + httpResponse);
            tweetPromise.reject();
        }
    });

    return tweetPromise;
}


function getInstagramPosts(locationId) {
    var promise = new Parse.Promise();

    var instaModule = require('cloud/libs/instagram-v1-1.0.js');
    instaModule.initialize('7bc0d3fd25034dd1855f90edbb4cd9de');
    instaModule.setAccessToken('217473186.7bc0d3f.4c6c208612554a2487b46b5212233879');

    instaModule.getRecentMediaByLocation(locationId, {
        count: '15',
    }).then(function(httpResponse) {
        var promises = [];

        var data = httpResponse.data.data;
        var userId = "";

        if(state["test"]) {
            userId = "HU9hiPvMHw";
        } else if (state["deployment"]) {
            userId = "nhuTNX1F38";
        }

        var ts = Math.floor( (new Date().getTime() - (12 * 60 * 60 * 1000)) / 1000) ;
        var timestamp = ts.toString();

        _.each(data, function(post) {
            var type = post.type;
            var createdAt = post.created_time;
            var location = post.location.name;
            var commentCount = post.comments.count;
            var likeCount = post.likes.count;

            if (post.user.full_name === undefined || post.user.full_name === '') {
                var userName = post.user.username;
            } else {
                var userName = post.user.full_name;
            }

            var instaId = post.id;
            var instaPromise = new Parse.Promise();

            if (type == "image" && timestamp < createdAt) {
                promises.push(instaPromise);

                // var imageURL = post.images.low_resolution.url;
                var imageURL = post.images.standard_resolution.url;
                var caption = undefined;
                if (post.caption !== null) {
                    caption = post.caption.text + '\n\n';
                } else {
                    caption = "";
                }
                var cardText = (caption + "From " + userName + "\n@" + location).trim();

                var hashtag = cardText.split('#');

                if (hashtag.length - 1 < 7) {
                    var query = new Parse.Query("ODTU");
                    query.equalTo("Category", "Instagram");
                    query.equalTo("Misc", instaId);
                    query.find().then(function(objects) {
                        if (objects.length == 0) {
                            return Parse.Promise.as();
                        } else {
                            return Parse.Promise.error();
                        }
                    }).then(function() {

                        Parse.Cloud.httpRequest({ url: imageURL }).then(function(response) {  
                            var base64 = response.buffer.toString("base64");
                            var parseFile = new Parse.File("instaImage.jpg", { base64: base64 });
                            parseFile.save().then(function() {
                                var ODTU = Parse.Object.extend("ODTU");
                                var instaCard = new ODTU();

                                instaCard.set("File", parseFile);
                                instaCard.set("Text", cardText);
                                instaCard.set("UserId",  { __type: "Pointer", className: "_User", objectId: userId });
                                instaCard.set("CommentCount", 0);
                                instaCard.set("SpreadCount", 0);
                                instaCard.set("SkipCount", 0);
                                instaCard.set("ShareCount", 0);
                                instaCard.set("Anonymous", false);
                                instaCard.set("Category", 'Instagram');
                                instaCard.set("Misc", instaId);

                                instaCard.save().then(function() {
                                    instaPromise.resolve();
                                }, function(err) {
                                    instaPromise.reject();
                                });

                            });   
                        }, function(err) {
                            instaPromise.reject();
                        });    
                    }, function(err) {
                        instaPromise.resolve();
                    }); 
                }

                                 

            } else {
                // No video yet
            }
        });

        if (promises.length == 0) {
            promise.resolve();
        } else {
            Parse.Promise.when(promises).then(function() {
                promise.resolve();
            }, function(err) {
                promise.reject();
            });
        }

    }, function(error) {
        promise.reject();
    });

    return promise;
}

function makeInstaCardDeleteTrue() {
    var promise1 = new Parse.Promise();
    var promise2 = new Parse.Promise();
    // Get Current Date
    var d = new Date();
    var twentyFiveHours = 25 * 3600 * 1000;
    var twentyFiveHoursAgo = new Date(d.getTime() - (twentyFiveHours)); 
    var thirteenHours = 12 * 3600 * 1000;
    var thirteenHoursAgo = new Date(d.getTime() - (thirteenHours));


    var query = new Parse.Query("ODTU");
    query.limit(1000);
    query.notEqualTo("Deleted", true);
    query.equalTo("Category", "Instagram");
    query.lessThanOrEqualTo("createdAt", twentyFiveHoursAgo);

    query.find().then(function(results) {

        _.each(results, function(object) {
            var spreadCount = object.get('SpreadCount');
            var skipCount = object.get('SkipCount');
            var commentCount = object.get('CommentCount');

            if (spreadCount/(spreadCount+skipCount) > 0.2 || commentCount > 0) {    
                // Do nothing
            } else {
                // Set deleted true
                object.set("Deleted", true);
            }
        });
        Parse.Object.saveAll(results).then(function() {
            promise1.resolve();
        }, function() {
            promise1.reject();
        });
    });

    var query2 = new Parse.Query("ODTU");
    query2.limit(1000);
    query2.notEqualTo("Deleted", true);
    query2.equalTo("Category", "Instagram");
    query2.lessThanOrEqualTo("createdAt", thirteenHoursAgo);

    query2.find().then(function(results) {

        _.each(results, function(object) {
            var spreadCount = object.get('SpreadCount');
            var skipCount = object.get('SkipCount');

            if (spreadCount/(spreadCount+skipCount) > 0.1) {    
                // Do nothing
            } else {
                // Set deleted true
                object.set("Deleted", true);
            }
        });
        Parse.Object.saveAll(results).then(function() {
            promise2.resolve();
        }, function() {
            promise2.reject();
        });
    });

    var promises = [];
    promises.push(promise1);
    promises.push(promise2);

    return Parse.Promise.when(promises);
}

function pushUsernameToWhoColumn() {
    Parse.Cloud.useMasterKey();
    var promise = new Parse.Promise();
    console.log('1');

    var query = new Parse.Query("User");
    query.limit(1000);
    query.exists('Nickname');
    query.doesNotExist('Who');
    query.find().then(function(results) {
        console.log('Length is: ' + results.length);
        _.each(results, function(object) {
            var nickname = object.get('Nickname');
            console.log('Nickname is: ' + nickname);
            object.set('Who', nickname);
        });

        Parse.Object.saveAll(results).then(function() {
            promise.resolve();
        }, function() {
            promise.reject();
        });

    });

    return promise;
}


// Deletes all of the due date passed cards
// Creates cafeteria card
// Creates weather card
function startBackgroundJob(request, status) {
    var d = new Date();
    var currentHour = d.getHours(); // 0-23
    var currentDay = d.getDay(); // 0-6 (0: sunday, 1: monday, 2: tuesday..)
    var currentMinute = d.getMinutes(); // 0-59

    var promises = [];

    var instagramLocations = [
        "6903506", // ODTÜ Bilgisayar Mühendisliği
        "12761602", // Odtü Elektrik-Elektronik Muhendisliği Bölümü E Binası
        "173120818", // ODTU Bilgisayar Mühendisliği Kantini
        "469345475", // METU Computer Center
        "612117313", // METU, Computer Engineering
        "439021040", // ODTÜ Bilgisayar Mühendisliği BMB1
        "195226028", // ODTÜ-TEKPOL
        "16297541", // ODTÜ Bilgi İşlem Daire Başkanlığı
        "34861325", // ODTÜ MM Kantin
        "511824502", // ODTÜ EEE Bülent Kerim Altay
        "167947626", // Odtü Elektrik-Elektronik Muhendisliği Çalışma Salonu
        "53016074", // ODTÜ Elektrik-Elektronik Mühendisliği D Blok
        "44908810", // Metu CC
        "515160023", // ODTU EEE Bulent Kerim Altay Salonu
        "80322592", // ODTÜ Mühendislik Fakültesi Dekanlığı
        "7349135", // Odtü MM
        "14301571", // ODTU MM25 Amfisi
        "450995367", // Odtu Genetik
        "54427380", // ODTU Mimarlik Fakultesi
        "251251785", // Odtü Mimari Fakültesi
        "41066284", // ODTÜ Mimarlık 1. Sınıf Stüdyosu
        "54513854", // Odtü mimarlık 3.sınıf stüdyosu
        "412377797", // METU Department of Arch
        "147557431", // Mimarlik Stüdyo 1
        "7783871", // ODTU Mimarlik Fakultesi
        "38836617", // Odtu Mimarlik Tasarim Studyosu1
        "50211157", // Mimarlik 4.sinif Studiosu
        "8083946", // ODTÜ Mimarlık Kantini
        "38631348", // Mimarlik 2. sinif studyosu
        "310157999", // ODTÜ merkezi kütüphane
        "50052089", // ODTÜ İşletme G111
        "180313082", // ODTU GİMER
        "228575971", // ODTÜ YDYO G BLOK
        "644555118", // ODTÜ YDYO G BLOK
        "145312740", // ODTU Avrupa Calismalari Merkezi
        "151180480", // Odtu Isletme G110
        "13599007", // ODTÜ Uluslararası İlişkiler
        "140783354", // METU-Business Adm.
        "180081256", // ODTU Kapali Havuz
        "232167103", // 100.Yl si Bloklar
        "177617804", // ODTÜ aynalı salon
        "341703547", // Odtu Susam Simit
        "25377770", // Odtu Stadyum Kortlari
        "133201351", // ODTÜ Aynalı Spor Salonu
        "199374940", // ODTÜ Çarşı Çimlerinin En Tenha Yerindeki Yiyişme Bankı
        "109320294", // Odtü Stadyum
        "357427850", // ODTU Makıne Muhendıslıgı kantını
        "461213680", // ODTU Kongre Merkezi
        "160026338", // ODTU Bankalar
        "376751363", // ODT Bolonez Cafe
        "177965361", // ODTÜ IIBF B Binasi Okuma Odasi
        "81100470", // ODTÜ İşletme Topluluğu
        "76069320", // Bolonez Cafe
        "184215866", // Middle East Technical University Department of International Relations
        "7225241", // ODTÜ İşletme
        "40453441", // G102
        "311847001", // ODTU Bolonez
        "504396767", // Finans Kongresi
        "238885237", // ODTÜ İşletme Bölümü
        "91355472", // G106
        "225194287", // Odtu Isletme, Bolonez Cafe
        "68561648", // G104
        "231446998", // 6.Girişimcilik Zirvesi
        "442273736", // ODTÜ GGT Ofis
        "37405280", // ODTÜ Işletme Kantini
        "170812275", // G206
        "417772642", // ODTÜ İşletme G202
        "53007311", // G204
        "82182297", // ODT Kz Konukevi Yurt n
        "180920861", // Odtu Kiz Konukevi Sami Kirdar Bloku
        "80497974", // Odt Kz Konukevi S
        "251076742", // ODT Arkabahe
        "98094413", // ODT Kz Konukevi alma Salonu
        "94976376", // Odtu Cisa
        "7873906", // ODT - Arka Bahe
        "51054954", // odtu kiz konukevi
        "150996613", // Odt Kz Konukevi Danma
        "45967342", // Arkabahe
        "45974004", // Arka Bahe
        "435073214", // METU Faculty of Economics and Administrative Sciences
        "21089286", // Odt Kz Konukevi
        "162978684", // 3. Yurt Yangn Merdiveni
        "515983807", // Melis&Ezgi's Room
        "4792736", // Radyo ODT
        "229890810", // ODT Dou Yurtlar
        "274749230", // Radyo ODTÜ 103.1
        "5486724", // Resim-Heykel Atlyesi
        "469662273", // Odtu A4 Barakasi
        "433073314", // Odt Kz Konukevi Tv Salon
        "15285673", // Odt Yznc Yl Kaps
        "148929723", // ODT Arkabahe
        "642779797", // Odtü 19.Yurt
        "401905357", // Odtü 19.Yurt
        "434953149", // ODTU 19. Yurt Çalışma Salonu
        "45987812", // ODTÜ Refika Aksoy Yurdu
        "419644469", // Bilim Kantini Refika Aksoy Yurdu
        "176522026", // Refika Aksoy Yurdu 3. Kat Mutfağı
        "233237721", // ODTÜ Refika Aksoy Yurdu Kantini
        "404978327", // Refika Aksoy
        "401894936", // Odtü 19.yurt
        "49457900", // ODTU Refika Aksoy Yurdu
        "245865969", // ODTÜ TEPE
        "144444468", // ODTU Faika Demiray Kafeteryası
        "6376405", // ODTÜ Havacılık ve Uzay Mühendisliği
        "159608388", // Faika Demiray Çimleri
        "7855326", // ODTÜ Faika Demiray Yurdu
        "17860499", // Faika
        "13394626", // ODTÜ İsa Demiray Yurdu
        "192016448", // METU Faika Demiray Dormitory
        "72451853", // Demiray dormitory
        "244649356", // ODTÜ İsa Demiray Yurdu Çimler
        "252796610", // Ortadoğu Teknik Üniversitesi İsa Demiray Yurdu
        "465172638", // Odtu Fizik Cimleri
        "414200671", // Faika Demiray Kantini
        "285624758", // 5. Yurt Cimleri
        "229090305", // Odtü Sağlık ve Rehberlik Merkezi
        "9697846", // Orta Dogu Teknik Universitesi
        "282420842", // Odtü Sağlık Ve Rehberlik Merkezi
        "37392985", // Odtu Medico
        "269759681", // Odtu Doyurucu Cafe
        "234327817", // Computer Lab
        "102038549", // Tenis Kortlar n
        "234398022", // ODTU 1. Yurt Lab
        "552051138", // Odtu Esli Danslar
        "26842647", // Odt 1. Yurt
        "194611519", // 1.Yurt alma Salonu
        "49154487", // ODT Medico Kln. Mikrobiyoloji ve Biyokimya Lab.
        "120601714", // ODT 1. Yurt Kantin
        "196748651", // 1. Yurt s
        "534281336", // ODT 3.Yurt alma Salonu
        "407620537", // Odt Basket Sahas
        "321323502", // ODTU Mezuniyet Treni
        "95501449", // Odt Vinelik
        "702883786", // ODTU Visnelik Cim Anfi
        "293726362", // Vinelik ODT Mezunlar Dernei
        "90469691", // ODT Vinelik im Amfi
        "29379314", // Vinelik
        "251883659", // OMD Athletics Center
        "3834690", // ODT Vinelik Tesisleri
        "19050916", // Vinelik
        "18567699", // Odt Vinelik im Amfi
        "459531871", // AIAC,ODTU KKM
        "467024931", // Devrim
        "96840884", // ODT Bahar enlii
        "64676786", // Odtu C Heykeli
        "187932283", // ODT Ring
        "15188350", // Odt enlik
        "218715903", // Devrim
        "321016837", // Odtu Devrim Stadnda Diploma Treni
        "321468575", // Odtu Mezuniyet Toreni...
        "17099224", // ODT Genlik Ant (C Heykeli)
        "235057742", // ODT Devrim Stadyumu
        "693531573", // Computer Engineering
        "15055712", // Odtu Senlik Alani
        "218578584", // Odt Devrim Stadi
        "37591023", // Odt Devrim
        "274049163", // ODT Bahar enlikleri
        "237926268", // Devrim Stad
        "41529456", // ODT Kafeterya (Yemekhane)
        "259802744", // METUCON
        "58359265", // Odtu Yemekhane
        "221141224", // ODT Kafeterya
        "7248919", // Odtu Matematik
        "682222311", // Otdu
        "263100733", // ODT Dolmu Duraklar
        "145978204", // ODT Sosyal Tesisler Mdrlg
        "373862677", // ODT Dolmu Dura
        "101630234", // ODTU
        "226838", // Orta Dou Teknik niversitesi
        "89375122", // ODT Alakart Yemekhane
        "645221983", // Odtu Mm25 Amfisi
        "415316799", // ODTU BKFT
        "157561828", // kimya imleri
        "63321144", // Odtu Baraka
        "47665305", // Odtu kimya amfi
        "50379906", // K.Aud
        "463682466", // Chemistry Auditorium
        "40294082", // U1 Amfisi
        "55241372", // ODT U2
        "146192182", // U3
        "37848813", // Odt U3
        "166140414", // Odt Resim Atlyesi
        "178422705", // odtu fizik u2
        "160616589", // Odtu Fizik U1
        "503243479", // Fizik P2 Amfisi
        "250409539", // ODTÜ Rektörlük Binası
        "466271946", // Odtü Matemetik Çimleri
        "122563664", // Odt l amfi
        "21683491", // ODTU Fizik U3
        "38022235", // Odtu Fizik Otoparki
        "45554144", // ODT Atatrk Ant
        "51569824", // ODT Modern Diller
        "449587071", // Odt Fizik Blm Kantini
        "174339737", // ODT Fen Edebiyat Fakltesi
        "10986893", // ODT Fizik imleri
        "244494494", // Odtu Library
        "47895856", // ODT Ktphane KAREL
        "42488980", // METU Library
        "3377616", // ODTU Ktphane
        "164377387", // METU Library A Block
        "241508817", // Metu computer engineering department
        "53564077", // ODTU Kutuphane B3
        "65839651", // ODT Ktphane A1
        "80588894", // Odtu kutuphane a2
        "440317365", // ODTÜ Matematik M-05
        "98346536", // Krmz Koltukcuklarmz
        "17586903", // Odtu Kutuphane Krmz Koltuklar
        "48103406", // ODT Ktphane Sesli Balkon
        "448491893", // ODT Ktphanesi A Blok
        "232999337", // ODT Ktphanesi B Blok
        "227833631", // METU Blackball Billiards Sports Centre
        "77523478", // ODT Ktphane A3
        "169220004", // ODTU Kutuphane Kirmizi Koltuklar 1.Koltuk Takimi Cam Kenari
        "139914968", // Middle East Technical University
        "229064500", // METU Library B2
        "53005058", // Odtu maden müh. kantini
        "434773956", // Odtü Maden Mühendisliği PC Labı
        "392284797", // Maden Muh.
        "6766316", // Odtu Maden muhendisligi
        "51020425", // ODTU M.AUD
        "344367562", // Odtü Ydyo e blok
        "348766892", // ODTÜ maden mühendisliği manzara
        "507061451", // ODTÜ Maden Mühendisliği Çalışma Salonu
        "390107114", // ODTU Maden Muh,Fak.
        "218645831", // ODTU Maden Muhendisligi Tepesi
        "132280104", // ODTÜ Bilket Manzarası
        "50421107", // Odtü Maden Mühendisliği Otoparkı
        "7953028", // ODTU Bankalar
        "258709657", // Odtu Maden Tepesi
        "255457683", // ODTU Maden
        "256891237", // ODTÜ jeoloji mühendisliği pc labı
        "453933648", // Ortadogu Teknik Universitesi
        "665883504", // Odtu Petrol Otopark
        "213283080", // Maden tepe
        "230144900", // ODTÜ Jeoloji Mühendisliği Bölümü
        "34204528", // ODTU YDYO F binasi
        "40017400", // ODT YDYO E Binas
        "82823303", // ODT YDYO INT23
        "212134186", // Odt BF G263
        "15139705", // ODTU (Middle East Technical University)
        "16175781", // Odtu HaZirlik
        "173399222", // ODTU baraka
        "164606451", // metu social sciences
        "53505036", // Odt Sem
        "252017892", // Just Marketing//14 #JustMarketing14
        "160946507", // ODT Yabanc Diller Eitim Fakltesi
        "279093499", // ODTU IBF B Otopark
        "149990793", // ODTU Temel Ingilizce Bolumu
        "231328213", // Sunshine
        "536782662", // Cybersoft
        "157046118", // Starbucks
        "295741965", // Odtu Elit
        "47540235", // Hazrlk A Binasi
        "504360010", // Finans Kongresi'14
        "32538421", // Metu Foreign Language School
        "42486687", // Mavi Salon
        "420195803", // ODT l Amfi
        "615276647", // METU Sac
        "237373895", // odt metrosu
        "308467262", // nteraktif Ar-Ge
        "235552539", // odt general chemistry lab.
        "53818061", // ODTU Iktisat Kantini Cimleri
        "741524957", // Edward's Coffee
        "432681330", // Metu Business Administration
        "82983645", // ODT Mimarlk Fakltesi
        "431452114", // Metu, Econ
        "267560161", // Odt Mnazara / Metu Debate
        "84695529", // G111
        "257979037", // ODT
        "372795372", // odt yabanc diller Yksek Okulu
        "17813863", // ODT GSAM
        "43856014", // ODT YDYO G Binas
        "113440385", // F16
        "485134216", // Odt iletme G101
        "402983535", // Ring
        "238822054", // Fz14
        "108246624", // ODT YDYO G Binasi Kantini
        "94418026", // odt mimarlk fakltesi
        "37852639", // ODTU IIBF B Binasi kantin
        "171547289", // Odtu Isletme G208
        "50681636", // METU Dbe G Building
        "145742093", // METU Department of Foreign Languages
        "52332781", // Orta Dou Teknik niversitesi
        "10746747", // ODT BF B Binas
        "146471664", // Rutil Caf
        "95314737", // BF A alma Salonu
        "54934447", // METU DBE G BUILDING
        "743131251", // Odt Sosyal Bilimler Fakltesi
        "165024112", // ODTU YDYO F-G Kantini
        "16737097", // ODTU YDYO B binasi
        "339125946", // ODTU YDYO AUDITORIUM I
        "185547812", // Odt Elit Cafe
        "586018202", // Beevler Ankara
        "234186418", // ODTU Isletme Okuma Odasi
        "171106740", // ODT BF A Binas okuma salonu
        "439393467", // Tutuncu's Home
        "458522444", // ODTU YDYO E Binasi El 47
        "18273507", // ODT YDYO A Binas
        "10654773", // ODT ktisat FZ17
        "84710598", // SAC (Self Access Center)
        "217978975", // ODTU Gisam
        "468039796", // F14
        "191610312", // tahsin banguoglu ogrenci yurdu yemekhane
        "234828835", // Department of Basic English
        "70582908", // Metu - Department of Basic English
        "156883218", // Gizli Bahe Kafeterya
        "151139860", // G108
        "170951820", // ODT Hazrlk
        "213804447", // Odt Baraka Stdyosu
        "1313973", // ODTU Teknokent
        "240975671", // ODT ktisadi Ve dari Bilimler Fakultesi A Binasi Calisma Salonu
        "248058251", // Metu Edu
        "176577386", // ODT
        "210280914", // Elit Cafe
        "45565626", // ODTU YDYO D Binas
        "57324234", // ODTU Department of Basic English
        "8903313", // Odtu
        "166900576", // ODT Kemal Kurda Konser Salonu
        "93967242", // G110
        "44596669", // ODTU IIBF B Binasi G110 Amfisi
        "54194795", // Odtu hazirlik
        "49154186", // Somewhere over the rainbow
        "169793689", // gidecek yerim yokken buraya kerdim ;)
        "38933222", // Metu Dbe
        "91655464", // Odtu isletme otoparki
        "47195236", // odtu sac
        "321510695", // Middle Earth Technical Unviversity
        "41533683", // ODT Cafe Elit
        "450339696", // ODTU YDYO C BInas
        "150846635", // ODTU YDYO E Kantini
        "419587096", // ODTU Kimya Analitik Kimya Laboratuvari
        "149152668", // ODT M-105
        "383461609", // Department of Chemistry
        "253042743", // ODT Mezunlar Dernei - Vinelik
        "69195850", // ODT Kltr ve Kongre Merkezi
        "109248868", // ODT Mezuniyet Treni 2013
        "219950890", // Otd
        "102309206", // Tubitak Uzay
        "12107763", // Odt Ziyafet
        "109294567", // Odt devrim stadyumu
        "274260815", // ODT enlik Alan
        "220689569", // ODTU Osman Yazc Kz Konukev
        "245549727", // burger king Odtu Carsi
        "534105493", // ODT naat
        "88508701", // ODTU Mimarlik Ara Bahce
        "73622844", // Odtu Ritmik Jimnastik Kulubu
        "4723080", // Merkez Mhendislik Binas
        "557778629", // Uluslararas Ticaret Ve Lojistik Topluluu
        "413125245", // Odt Devrim Stadi
        "27514761", // ODTU Beseri
        "286885004", // ODTU Merkez Camii
        "78591387", // Yurtlar blgesi
        "38022480", // ODT Fizik Akvaryum
        "37448014", // Osman Yazc Kz Konuk Evi
        "436887805", // PLUS+4
        "23600076", // Odtu Doyurucu
        "338172655", // ODT Fizik P2
        "147885607", // odt 1. Yurt Bahesi
        "473627600", // Odt Informatics Institute
        "275514207", // Terra City
        "262380591", // Odt Biyolojik Bilimler ardak
        "507050148", // ODT Ktphanesi Sesli
        "334469904", // Odtu Visnelik Havuz Keyfii
        "168795225", // Odt Mimarlk Seramik Atlyesi
        "335615873", // Mini Devrim
        "377282103", // Odtu Ak Tepesi
        "241251818", // ODTU Bilgisayar Muhendisligi
        "238655153", // Kebap1956 Odt
        "95780201", // CC Heykeli
        "732671583", // Odtu Tanitim Fuari
        "278634261", // Ebi 2
        "69100403", // Odt Mimarlk Tasarm Stdyosu 2
        "460060948", // Uygulamal Matematik Enstits (IAM)
        "115778067", // ODT Bilisel Psikoloji Laboratuvar - METU CogLab
        "58272591", // Kortlar enlik Alan
        "562860484", // ODT physics building
        "11477996", // ODT Kimya Blm
        "477493377", // Odtu Biyoloji Lab 206
        "231657521", // kimya muhendisligi bilgisayar labi
        "379522718", // ODT Mezunlar Dernei- Vinelik Tesisleri
        "113836711", // IEEE ODT Topluluk Odas
        "112505650", // Odtu Trk Halk Bilimi Topluluu
        "321342121", // Odt naat Party Alan
        "177937579", // ODT Makina Mhendislii G Kantin
        "91685179", // ODT CRP 1. snf Stdyosu
        "427478502", // elf yolu
        "21119373", // Odt Kimya Muhendisligi
        "287319501", // Odtu Mm-25
        "46402642", // Odt renci Ileri
        "197220358", // ODT Sedirland
        "321911431", // ODT Stad
        "236631944", // UD Studio
        "37579880", // Odt,Ankara
        "710483022", // Odtu Cayir Cimen:))
        "641768526", // Mimarlik Anfisi Odtu
        "464827564", // Uluslararas renci Ofisi
        "406610949", // ODT Alveri Merkezi
        "9994209", // Odtu Rektorluk
        "118585950", // ODT Ktphane 3. Kat Ara Krmz Koltuklar
        "34049310", // ODT Makina Mhendislii E Blok
        "86578235", // Orta Dou Teknik niversitesi YDYO
        "42478472", // ODTU 7.Yurt
        "433094970", // Odtu
        "461542906", // Gryffindor Ortak Salon
        "73668718", // Odt 4. Yurt
        "535694742", // Odt Kimya Blm B 24 Laboratuar
        "216395654", // ODT KKM C Salonu
        "180301067", // Home Sweat Home
        "292904002", // Odt Hidromekanik Lab.
        "93326792", // Sosyal Bina imleri
        "574205164", // OMD Gym Club @ Visnelik
        "89500288", // Odtu topluluk odalari
        "477192371", // METU Sport Center
        "20168234", // ODT
        "211002432", // Odtu 9. Yurt Esli Danslar Toplulugu Odasi
        "89101415", // odtu havuz
        "217952358", // METU BookStore
        "449978163", // Ahmet Bahadr lhan lk retim Okulu
        "47893917", // ODT Kimya D-149
        "6426215", // ODTU Cati
        "50127791", // ODT Ktphane Zemin Kat
        "84220384", // ODT Fizik P1
        "427361178", // ODTU Kuafr
        "238312919", // Restorasyon Yuksek Lisans Studyosu
        "15850047", // Faika demiray yurdu
        "229740626", // tadimpizza
        "713884435", // Ii Bloklar 1540.sk Odt Visnelik Yan
        "146141539", // OTD
        "86580569", // ODTU KONUKEVI 1
        "28278763", // Adonis Stdyo Evleri
        "381371984", // Udemy Trkiye
        "271010335", // ODT Felsefe
        "237343677", // ODTU Fizik P-421
        "332275361", // Odtu Cimleri
        "232907324", // BGG'14 ODT
        "252242344", // BACK FOREST
        "59375835", // Ebi 1 Lobi
        "439187533", // Odtu Doyurucu
        "234487216", // Odt Yurtlar Blgesi
        "241134214", // odt
        "366749165", // Balkon
        "161820916", // Samsun Bulvar
        "141355003", // Odt Mimarlk ats
        "223351552", // ODT, Ankara
        "187930535", // ODT BAP Koordinatrl
        "370621762", // sabriler
        "45630443", // Odt Kemal Kurda Kltr ve Kongre Merkezi
        "69381823", // Dereaz fotokopi
        "150483016", // Murat Abi'nin Yeri
        "219434393", // 5.yurt tv odas
        "14990167", // ODT Stadyum
        "5313934", // ODTU Beeri Kantini
        "45367292", // ODT Biyolojik Bilimler Kantini
        "71569676", // ODTU YMG
        "531352999", // Odtu Mimarlik Fakultesin
        "33018939", // ODT EB 1
        "635379573", // ODT Arkeoloji Topluluu
        "134136077", // Fareli Ky
        "245982717", // Civil Engineering K1
        "183273654", // ODT Olimpik Kapal Yzme Havuzu
        "140432146", // Odt Ring
        "5884969", // ODT Mimarlk Fakltesi
        "194644556", // Aslan Saray :)
        "261544345", // ODT Elektrik-Elektronik Mhendislii
        "258507315", // Sado's Place
        "71682048", // Odtu 3. Yurt Calisma Salonu
        "407796090", // GGT ODT Topluluk Standi
        "85577923", // Odt Rock Sahnesi
        "17114589", // ODT Ktphane Reference
        "48989018", // ODT Kimya Mhendislii A Blok
        "256920665", // Odtu Ebi2 Konukevi
        "181609523", // II - B123
        "517174879", // Odtu U1
        "419238004", // Odtu Fizik Optik Lab
        "94404345", // ODT Gda Mhendislii
        "168092725", // Odt Biyoloji
        "456146375", // Metu Mathematic
        "750014158", // 1. Yurt s
        "11284617", // ODT Baraka Spor Salonu
        "91965608", // Caz Sahnesi - ODT Caz Topluluu
        "167665897", // ODT 8. Yurt Kantin
        "18269801", // Odt 5.yurt
        "61600728", // DOB Residance
        "39240726", // AEE-128
        "44005966", // Kimya Mhendislii D Blok
        "177945227", // ODT MM-125 Amfi
        "44612111", // Bilkent University Concert Hall
        "45609912", // odt mimarlk amfisi
        "274783284", // Odtu Teknokent Ikizler Binasi Rutil Cafe
        "254637698", // ODTU cati
        "10166844", // ODT Fizik P-6
        "45228053", // ODT 7. Yurt Kantin
        "184902076", // ODT Biyoloji Blm
        "86068308", // Karakusunlar imkb anadolu teknik lisesi
        "249294160", // Meric, Edirne
        "341602401", // ODTU Hassan Waffle
        "94125506", // ODT Beeri B05
        "67057122", // METU Dormitories- 11. Dorm- Kantin
        "39864495", // Odtu Kutuphane B 2
        "78106019", // ODT KKM Sergi Alan
        "64216438", // Pizzac Altan
        "254759371", // ODT Iletme Topluluu Odas
        "437837498", // ODTU Biology Physiology Lab
        "201207948", // Ayhan Sicimoglu konseri ODTU
        "80837242", // Chocolate..<3
        "246517391", // Odtu Makina
        "582247708", // Orfoz Restaurant
        "165888798", // ODTU 7.yurt Mutfak
        "257799369", // ODTU Teras Cafe
        "135181381", // ODT Makina Mhendislii G Blok alma Salonu
        "48509787", // Esinti 2 Cafe - Ebi 2
        "275972149", // Odtu Kkm Otoparki
        "195039627", // Doyurucu
        "272641685", // Chemical Engineering Building , Odtu
        "15900867", // ODT Matematik imler
        "521089571", // Yiit's Room
        "5299585", // Byk Spor Salonu
        "19870219", // ODT Ktphane B1
        "227655007", // OMD Koumbeli Tiyatro Salonu
        "122943146", // Odt MM at
        "294268888", // Odtu Visnelik Duman Konseri
        "517984967", // Radyo Odtu
        "261464163", // METU, Department Of Chemical Engineering
        "489816749", // yeni yol
        "233671720", // Odt Yuva Ve Anaokulu
        "749239183", // Metucon
        "196115769", // Oda 1609
        "162724750", // Odt Cati Cafe
        "266749282", // ODT Endstri Mhendislii
        "234919282", // METU ID - ODT Endstri rnleri Tasarm Blm
        "10166836", // Odtu Fizik Kantini
        "168474662", // METU ID 4th Year Studio
        "286132667", // Siyaset Bilimi ve Kamu yonetimi
        "12523964", // METU
        "120539039", // ODT Plaj Voleybolu Sahas
        "24582304", // Odtu Ak Yzme Havuzu
        "39850270", // ODT Fizik P 2
        "103319081", // Odtu Devrim Stadyumu
        "528540904", // Odt statistik Bilgisayar Lab
        "156998330", // ODT 6. Yurt Kantin
        "636944130", // ODT Teras Cafe Restaurant
        "41102032", // ODTU Sociology
        "222026149", // ODT at Kafe
        "251307879", // ODT Sunshine
        "229148254", // ankara
        "62136819", // ODT Faika Demiray Yurdu .S.
        "49754280", // METU Confucius Institute
        "218584003", // Odt Basketbol Sahas
        "9417552", // ODT KKM - Kemal Kurda Salonu
        "269693362", // Flat
        "10858090", // Burger King
        "82361498", // Metu Faculty Of Arch. Digital Design Studio
        "146102336", // Odt Vinelik Paintball
        "48834349", // ODTU KKM Ring duragi
        "315272095", // Limanli Bahce / Bahceli
        "227718816", // 11.Uluslararas Odt Robot Gnleri
        "46463278", // Park Rnesan
        "330051970", // thbt---40. yil arasi
        "233333801", // ODT YDYO D Binas
        "711283373", // Odt Kkm
        "156880456", // ODT Biyolojik Bilimler Z-08 Lab
        "150561928", // odt teras
        "236054668", // ODTU A4 Kapisi
        "188529693", // MetuMech
        "247983593", // METU Trail Run
        "428464329", // ODT Mimarlk Fakltesi Yeni Bina
        "631971591", // Elit Cafe
        "530754439", // Balo 2015 Mimarlk ODT
        "231716063", // Osman Yazc S
        "44911089", // ODT MM125
        "446831429", // Bek's House
        "517854583", // Kahkahalar
        "182300047", // Odt- Gksel Konseri
        "70588289", // Ebi-1 Kantin
        "182062388", // Electrical & Electronics Engineering E Building Labs
        "72771324", // Vinelik Residans-abikomlar :)
        "59645895", // Visnelik Residences
        "36300939", // ODT-BLTR Merkezi
        "181620427", // ODT Arkeoloji Topluluu
        "123463587", // Deniz'in Evi
        "75246978", // ODT KTMT
        "620603063", // Odt Makina D Blok
        "419564061", // Orta Dou Teknik niversitesi Makine Mhendislii Blm E Binas
        "48660205", // ODTU kutuphane otopark
        "465112850", // OMD Athletics
        "111915202", // 100. Yl renci Bloklar - ODT
        "87805778", // Odt Civil Engineering Department
        "337665748", // ODTU Makina Muh. Akkanlar Lab
        "80392013", // MATPUM
        "142917092", // ODT-UTEST-Mimarlik Fakultesi
        "566242480", // Odt Beeri B14
        "13905548", // ODT Tenis Kortlar imleri
        "44480566", // ODTU ID 1. Sinif Studyosu
        "280549061", // ODTU Solmaz Izdemir Hall
        "113120588", // Genlik Park
        "229097952", // Kamps Geliim Gnleri '14
        "641762708", // Ynetim ve Mhendislik Gnleri
        "24786819", // ODT KKM A Salonu
        "217675267", // ODT
        "45202389", // ODTU Amfi P-4
        "34891463", // ODT Makina Mh. Kontrol Lab
        "584246778", // Odt Srm
        "230872527", // Odtu Matematik M-04
        "73415423", // Galata Kulesi
        "146070344", // Esli Danslar Odasi
        "128768217", // ODT
        "444689541", // METU International Student Association - MISA
        "552056587", // Odtu P1 Amfisi
        "64999899", // ODTU nsaat Muh. Hidromekanik Lab
        "135117593", // odt ite
        "353646777", // Odt Kimya Blm C-50 Labi
        "459982848", // Odtu Merkezi Arastirma Laboratuvari
        "272569746", // Fizik
        "452278505", // Gamze,Esra en's home
        "298483747", // ODT 7. Yurt Kantini
        "199155869", // Hazal&Naile nin Evi
        "1318805", // Sunshine
        "413807330", // Odt 8.yurt
        "146850092", // Odtu Tenis Kafe
        "196561628", // S
        "81255303", // Cupy Cupcakes
        "733044430", // ODT Kamps
        "157539905", // ODTU Guzel Sanatlar ve Muzik Bolumu
        "275521993", // ODT ENLK
        "24414613", // Ankara Ev
        "358159242", // Odt Sosyal Bilimler Fakltesi
        "227989824", // Otd Vinelik
        "307826917", // Odt Inaat Mhendisligi ats
        "675439453", // Odtu Cafe Cisa
        "742110903", // ODT KKM - Kemal Kurda Salonu
        "220506821", // Odtu Susam
        "95179362", // Bestankara
        "40895056", // Yurtlar Blgesi imleri
        "44400891", // Hocam Piknik
        "71031209", // ODT Makina Mhendislii G Blok
        "48998156", // ODT Matematik Kantini
        "87675077", // ODTU Hal Saha
        "3349887", // ODTU Makine
        "220131460", // ODT Olimpik Kapal Yzme Havuzu
        "15850937", // ODT CERN Sergisi
        "393540696", // fitintime
        "45226350", // ktisat Kantini
        "18211005", // ODTU Visnelik Tesisleri Duman Konseri
        "40676153", // Cafe Cisa
        "158469859", // Metu Open
        "338204661", // METU Physics
        "234851249", // Odt Inaat Mhendislii
        "460143639", // Odtu Kariyer Fuari
        "4876949", // Odtu Blackball
        "10035882", // ODT Makina Mhendislii A Blok
        "468709336", // Nabu
        "554312424", // Odtu Futbol Sahasi
        "73691340", // ODTU Susam
        "621552768", // Evde Uyuyorrr
        "229066762", // ODT BF
        "18706577", // METU
        "5524690", // ODT Teknokent Spor Merkezi
        "277479549", // ODT BAHAR ENL 2014
        "227569551", // sparta
        "397940807", // Dou Yurt Ring Dura
        "174776724", // KarHane
        "80861342", // ODT 2. Yurt Lab
        "465183476", // Makina E Otopark
        "51857581", // ODTU Cati
        "137443676", // ODT Vinelik / Milonga Gecesi
        "170731471", // ODT Fen Bilimleri Enstits
        "21264550", // ODTU Camlik Tenis Kortlari
        "491058863", // ODTU 6.Yurt alma Odas
        "205494397", // ODT Makina 407 Lab (G150)
        "272645396", // Odt 3. Yurt Kantini
        "212840594", // THBT 40.Yl
        "193194638", // ODT Kimya K-05
        "346169018", // METU 1st Dormitory
        "433275849", // Hard Rock House
        "656002659", // METU
        "527867223", // METU- Department of Chemistry - Working Room
        "406734182", // Odtu Amfi P-5
        "146813362", // ODT 5. Yurt imleri
        "171251270", // Odtkent Konukevi 2
        "91386212", // Odt Radyo Topluluu enlik Alan
        "39656085", // ODTU PSKOLOJ
        "148569278", // lab 103
        "409027350", // Bobby Baris's Car
        "48219402", // Atl Records
        "235120949", // 3. Yurt izim Salonu
        "91724336", // Odtu Balikci
        "637354834", // mimarlik otopark
        "231337365", // Sosyal Bilimler Binas
        "111918778", // 100. YIL 1540. SK .ODT VNELK TESS ALTI
        "266056992", // Middle East Technival University
        "193146798", // Domaia
        "243939308", // ODTU Ebi 1 Konukevi
        "258602173", // ODT KTMT- Klasik Trk Mzii Topluluu
        "88099200", // METU, 5th Dorm
        "289075845", // ODTU
        "81080333", // ODT Makina G103 Amfisi
        "651748323", // at Cafe
        "10444605", // Odtu Carsi Cimleri
        "281212875", // Android Developer Days
        "194004347", // at kafe
        "24405120", // ODT 8. Yurt
        "190744976", // ODT Kimya Mhendislii Avlusu
        "663748139", // Odt renci Servisi
        "490215077", // Odt 8. Yurt Mutfa
        "49081361", // ODTU ID 2.sinif studyosu
        "313350375", // ODT 8. Yurt S
        "165077318", // ODT KKM D Salonu
        "62227015", // Odt Fizik Lab.
        "133193221", // ODT IE 324
        "241989535", // ODT Kimya alma salonu
        "368146579", // demiraylar dorms
        "51474955", // ODT Makina Mhendislii B Blok alma Salonu
        "278510310", // Odt Fizik Fakltesi
        "81775529", // ODT ar imleri
        "259639990", // Odt Aa enlii Ahlatlbel
        "183718324", // Chemical engineering laboratory
        "61143175", // Anadolu Efes Biraclk ve Malt Sanayi
        "734403140", // Odtu Yalncak Orman
        "518120751", // Afyon kbal Tesisleri Marmaris Yolculari
        "35504677", // ODTU Balks
        "145730476", // Kalabalk
        "7250544", // ODT Kltr ve Kongre Merkezi
        "273589420", // Metu Campus
        "274924383", // Odt Susam
        "246260912", // Zeynel illi Cafe Odt
        "78275651", // ODT Osman Yazc Konukevi
        "305085097", // ODTU Carsi Aspava
        "106030065", // ODT 2. Yurt Kantin
        "526732042", // ODTU ile 100.YIL n pt yer
        "49845881", // Insaat Muhendisligi Calisma Salonu
        "199733150", // 6. yurt alma Salonu
        "43333221", // Sally htiya Giderme Blgesi
        "465148087", // ODT Makina G s
        "193229916", // ODT Kimya Mhendislii Bilgisayar Lab
        "74861039", // ODT Elektrik Elektronik S
        "369920365", // miami Beach
        "6985271", // ODTU KKM Kemal Kurdas Salonu
        "535472711", // Odt Uygulamal Matematik Enstits
        "659218879", // ODTU Visnelik Zaz Konseri
        "33849975", // Kazakhs Place
        "78301129", // Hakan Grsu Park
        "20187824", // Meniz's
        "140413793", // Odt Kimya Mhendislii Temel lemler Lab.
        "96808109", // ODT KKM imleri
        "407709716", // ODT Verimlilik Topluluu Tantm Stand
        "21997807", // ODT Mescidi
        "74443753", // Odtu-tsk modsmmer
        "83803446", // ODT ARI
        "117972704", // ODT kimya lab 20
        "74274190", // ATN Imar Insaat
        "114505639", // ODT Fizik imleri
        "119280454", // ODTU / Teras-Cafe Restaurant
        "220561798", // ODT KTMT kthane stand
        "154246568", // ayyolu (ANKARA,TRKYE)
        "5465877", // ODT Endstri Mhendislii
        "419364013", // Physical Chemistry Laboratory
        "667006951", // ODTU KKM 16. Uluslararasi Ankara Caz Festivali
        "154573130", // Zula
        "169645656", // Mavi Amfi
        "61449259", // ODT Kimya Kantini
        "274167655", // Odtu Susam Cafe
        "476418644", // Cahit Arf Amfisi
        "155645309", // ODT Spor Merkezi
        "169227910", // ODTU 9.Yurt Muzikal Toplulugu Odasi
        "235419842", // ODTU DEVRM'de
        "492048005", // ODT Endstri Mhendislii Teras
        "246338741", // Odtu Orman
        "1466393", // ODT Kltr ve Kongre Merkezi
        "143990392", // Topluluk Oryantasyon Alan #odtuyemerhaba
        "343430000", // ODT Bilgi lem Daire Bakanl
        "510037526", // Odt at Cafe'de Ziyafet
        "218148332", // Odtu Matematik Bolumu
        "199367289", // ODTU Sok Supermarket
        "329741347", // GUNAM otopark
        "83803942", // ODTU Spor Tesisleri
        "437060036", // Jolly Joker
        "150636633", // Merkez Ring Dura
        "32529368", // Odtu Doyurucu Cafe Restaurant
        "478894514", // Odt makine mhendislii c blok
        "236260415", // Beseri Kantini
        "584047011", // Amatem Hastahanesi Ankara
        "217137269", // ODT Makina G108 Amfisi
        "53627607", // Blackball
        "20759541", // TBTAK Uzay Teknolojileri Aratrma Enstits
        "525709958", // FL12 A
        "71325101", // Kutuphane Kahve Otomatlari
        "518823281", // Sinop Hamsilos
        "8765638", // Odtu
        "13120292", // ODT 9. Yurt
        "465977477", // ODT Sosyal Bili
        "110267350", // ODT Beeri B06
        "46270695", // Entas Bahesi
        "286044441", // Sunshine Cafe , ODTU
        "199378102", // 1601
        "178268832", // Odtu Crp 2. Snf Studyosu
        "160946734", // iekli da
        "227979328", // LostInTown
        "38213298", // Sun Shine Cafe
        "5773604", // Odt Mzik Ve Gzel Sanatlar Blm
        "47508192", // ODT Uluslararas birlii Ofisi
        "163376443", // zge Optik
        "17731581", // Piyata
        "93930263", // MGSB Prof Erdal nn Oda Mzii Salonu
        "2503693", // Middle East Technical University
        "332509521", // ODTU Uptown
        "109188519", // ODT Elektrik Elektronik Muhendislii Kantini
        "137347083", // Structure Lab.
        "71591158", // METU Swimming Pool
        "284684947", // Odt ktisat Kantini
        "177613666", // ODT Verimlilik Topluluu Topluluk Odas
        "20031490", // Aksu Aiyan Evleri
        "251960195", // Odtu Piyata
        "57337945", // Odt 6. Yurt
        "477091214", // ODT Merkez Laboratuvar
        "236762506", // Odt Matematik Binasi
        "12282142", // ODTU Biyoloji
        "6745231", // ODT Beeri Bilimler Binas
        "3828210", // at Cafe
        "162653900", // KKM nndeki otobs dura
        "430137551", // Odt 8. Yurt
        "254750231", // ODT Klasik Trk Mzii Topluluu
        "2791716", // DRUNKPUB
        "45793812", // ODT ktphane arkasndaki en ok meyve veren erik aacnn altndaki bank
        "12186023", // METU Informatics
        "4956561", // Odtu Fizik Bolumu
        "145966506", // Odt Beeri B114
        "464353297", // Bring Food and Beer
        "415061932", // Mechanical Engineering G Building
        "638516908", // METU
        "33898894", // Onur's residence
        "685601227", // Odt Kimya Lab149
        "168309347", // ODT Biyolojik Bilimler Z05
        "233807100", // Mimarlk UPL Studio
        "562967559", // Odt Bulvar
        "689333535", // Metu Biological Sciences
        "167414331", // Odtu-Makara
        "197974599", // Linden Digital Interactive Media Suite
        "224675183", // Odtu Mimarlik Amfisi
        "468022688", // odt matematik lab
        "717236557", // ODT Kltr Ve Kongre Merkezi
        "140062618", // Odtkent Konukevi 1
        "435743192", // ankaya Klaslan Salk Meslek Lisesi
        "76158488", // Ortadogu Teknk Unverstes
        "8904047", // Odtu kizler
        "147870525", // ODTU Mimarlik Master Studyosu
        "220979369", // Odt Mimarlk R43
        "376770761", // ODT Fizik Kantin
        "150976376", // ODTU Endustri Muhendisligi
        "173632550", // ODT Trk Halk Bilimi Topluluu
        "415196075", // Organic Chemistry Lab
        "246941226", // Odt 5. Yurt s
        "337376534", // Tbitak Uzay
        "78536896", // Metu Faculty Of Arch R89
        "253913601", // at Cafe - ODT
        "58351903", // ODTU KKM B Salonu
        "497487981", // ODT 7. yurt alma salonu
        "441822873", // 5. th Avenue New York
        "268392011", // ODT Kemal Kurda Kltr Kongre Merkezi
        "488206677", // Odt Biomaten
        "91954736", // Odtu Insaat cs
        "11365391", // ODTU Engineering Management
        "131538400", // ODT Fizik P3
        "214299202", // Orta Dou Teknik niversitesi
        "749208767", // ODT Devrim
        "639608770", // 15.Ynetim ve Mhendislik Gnleri
        "3849968", // odtu mimarlk amfisi
        "442434079", // ODT naat Mh. Hidromekanik Laboratuvar
        "516494209", // ODT Olimpik Kapal Yzme Havuzu
        "103352742", // Vinelik Residans
        "37704956", // Odt Kalabalk
        "69907573", // halasinin evi
        "156667177", // ODT Endstri rnleri Tasarm 1. Snf Stdyosu
        "635675812", // Ortadou Teknik niversitesi
        "250405676", // Faculty of Architecture
        "48656069", // Optics & Waves Lab.
        "65363870", // Odt Tarih
        "44962887", // Fizik imleri
        "188667940", // Odtu Makina Muhendisligi Akiskan Mekanigi Lab
        "370652051", // Model Konseri
        "316791374", // Odtu Kkm- Dance Upon A Time
        "58575674", // Odtu Lojmanlar
        "143590544", // ODTU Ayasli Research Center
        "93417274", // Bengisu & Gizem & Bra's Home =)
        "735885295", // Yreginin Sesinde Huzurda
        "157772273", // ODTU Sosyal Bina
        "169457854", // ODT Matematik alma Salonu
        "183267266", // AEGEE-Ankara Ofisi
        "161833798", // ODT 5. Yurt Kantin
        "140744431", // Bat berlin
        "516488098", // ok Hasta
        "234524964", // Odtu Byk Spor Salonu
        "105029045", // 0DT (Ortadogu ve Teknik niversitesi) - BF
        "45796488", // Odt Kimya Lab.
        "276463504", // Metu Spring Festival
        "22546056", // Dingonun Ahr
        "43734121", // Odt 3. Yurt
        "138971521", // Adatepe ODT
        "417543013", // Polymer Chemistry Lab
        "36784875", // ODTU ARGET
        "12279963", // A-206
        "450195569", // MT Topluluk Odas
        "552756666", // Odt Inaat Mhendislii Klas
        "391277052", // Metu Eee
        "433999135", // ODT Gastronomi Topluluu Tanma Toplants
        "14208456", // ODT Enformatik Enstits
        "534898848", // Servisin Ii
        "323131167", // nail ler
        "449426146", // ODT Kkm - A Salonu
        "2819039", // Devrim Stadyumu
        "404208439", // ODT Robot Topluluu
        "239980819", // kl's home
        "95075011", // 124/1
        "363538964", // Ahmet Bahadr lhan Ortaokulu
        "112149545", // ipo's sweet home
        "141093984", // Odt l
        "94103141", // ODTU Istatistik Z-22
        "382385143", // Odt Makina Mh. Akkanlar Lab
        "16931381", // Asiyan Evleri
        "199517982", // ODTU KKM Ring duragi
        "160978485", // ODTU Kimya lab
        "368841867", // Odtu Makina CFD Lab
        "297392814", // Matematik Kantini
        "81468848", // Odtu Halisaha ( Metu Carpet Field)
        "451309878", // Erol Sayan Konser Salonu
        "10033826", // ODT Makina Mhendislii B Blok
        "248515625", // Hobby Bahcelievler
        "53034604", // ODT Yurtlar Bolgesi Otobs Dura
        "160926849", // B14
        "216411447", // Cenk's Land
        "206845710", // EAwonderland
        "274415046", // Odt Tenis Kortlari
        "40635438", // Visnelik Residences
        "227169677", // Vinelik Residance
        "358250993", // ODT Fitness Salonu
        "13787911", // Odtu Carsi Onu Cim Alan
        "231392440", // TUBITAK ENERJI ENSTITS (ODT)
        "76723074", // 7. Yurt S
        "92115682", // Sunshine
        "38945346", // Nerdeyim Lan Ben?
        "351036545", // Panorama
        "311949983", // 100.Yil Saglik Ocagi
        "430702380", // Berfuana
        "39997713", // ODT Fizik P4
        "414121419", // odtu organik kimya arastirma laboratuvari
        "527848347", // Odt Elektrik Elektronik Mhendislii Vlsi Lab
        "272125843", // ODT Mzik ve Gzel Sanatlar Blm
        "98246766", // Lab 148 - Biological Sciences Metu
        "225308442", // Cahit Arf Amfisi (M-13)
        "170822358", // ODT 7.Yurt S
        "147742586", // EA206
        "138799514", // Odtu Electronics Lab
        "181662343", // Sako's Residence..!!
        "64686990", // Odt Kamps
        "91119511", // Metu social sciences
        "290498202", // ODTU Mimarlik Amfisi
        "129227526", // Doa Sitesi
        "174786005", // ODT Mimarlk Atlye
        "120756265", // Odt Yama Parat Grubu Topluluk Odas
        "160586843", // ODT Biyolojik Bilimler Z07
        "84525889", // Doyurucu
        "21116178", // ZAZ Konseri
        "168817842", // Odt 3.yurt s
        "522651795", // Odt Kkm B Salonu
        "9132796", // ODT EB-2 Konukevi
        "44169259", // Odtu Insaat Muhendisligi DR-1 Amfisi
        "358301543", // ODTU Molekuler Biyoloji ve Biyoteknoloji AR-GE
        "77118259", // ODT Sosyoloji
        "198239704", // esperro cafe
        "217118421", // Odt Yurtlar Blgesi Abaza Banklar
        "469778105", // Yzoniki-1
        "8838412", // ODT 2. Yurt
        "79462159", // O.D.T.
        "7498945", // ODT naat Mhendislii Blm
        "78014603", // ODT Makine Mhendislii D Blok
        "352237787", // Bek's Home
        "222215267", // Advanced Physics Lab.
        "458433465", // ODT 2. Yurt Bilgisayar Laboratuar
        "10287603", // Sosyal Bina
        "98120851", // 7. Yurt S
        "320871935", // ODTU PSKOLOJ
        "46311136", // ODT KKM Otopark
        "26652728", // Kayboldumm!
        "52535590", // AEGEE-Ankara
        "677322813", // Odt Makina B Binas
        "435936649", // Odtu Resim Ve Heykel Atolyesi
        "221194047", // ODT 5. Yurt alma Salonu
        "568513296", // Platonik Cafe/Besiktas
        "36369723", // Kebap 1956
        "461607298", // ODT KKM KK Salonu-Boazii Caz Korosu
        "229676099", // Odtu Fizik
        "490685298", // Radyo ODTU 103.1
        "25064662", // ODT Vinelik Havuzu
        "2549976", // ODT Tenis Kortlar
        "685938069", // Odtu Vsnelk Pnk Martn Konser
        "543459189", // 2
        "505553721", // Odtu Fizik U2
        "266140273", // ODTU Mimarlik Amfisi
        "133537523", // Odt Kanal
        "89077757", // odt kre
        "52834191", // ODTU Fizik Masa Tenisi
        "40651542", // Odtu Kutuphane Sesli Kisim
        "45239470", // Kubbealti
        "27929331", // Odtu Kimya C-204
        "114986569", // odtu insaat muhendisligi kantini
        "71016654", // Esinti Cafe
        "35403689", // ODT MD Visnelik Tesisleri Spor Salonu
        "118521601", // Endustri Muhendisligi Manzara
        "286108571", // Mechanical Engineering B Building
        "91522317", // ODT enlikleri
        "187982797", // ODT Biyolojik Bilimler alima Salonu
        "638519169", // Devrim Stadyumu
        "200497793", // ODT Halkla ilikiler Tantm Ofisi
        "4919027", // ODT 9.Yurt
        "499980467", // Karakusunlar MKB Anadolu Teknik Lisesi
        "150018460", // Metu Cultural and Convention Center
        "53793267", // at Cafeterya
        "172136579", // Mickey's Burger
        "267326046", // Odtu Dereagzi
        "248668374", // Odt yuva
        "327695239", // ODT Endstri Mh.
        "379668647", // Odt Mezunlar Dernei Lokali
        "37696017", // Doyurucu
        "159007776", // atlak Kazan
        "223376132", // Teras - Cafe Restaurant
        "147789937", // METU ID 3rd year studio
        "97952239", // ODT Solmaz zdemir Konferans Salonu
        "310186492", // Vinelik
        "267483013", // ODTU Yuva Ve Anaokulu
        "52284059", // Crp 4. Sinif studyosu
        "186235370", // IEEE METU Robotics And Automation Society Lab
        "266821613", // Odt Makina G Binas
        "25961733", // METU Faculty of Arch. R28
        "90610192", // Odtu MD Visnelik Tesisleri Tenis Kortlari
        "699513628", // ODT
        "895973", // Kafes firin
        "493603588", // odt ktphanesinde differansiyel denlemlerle kafay yemek
        "460346111", // Ge Bakma Dura
        "406534537", // Albatros
        "199534879", // Ozgurs
        "59514223", // ODT 3. Yurt Kantin
        "530677101", // ODT Ktphane Mescidi / METU Library Masjid
        "637336436", // Odtu Konferans Salonu in Masali
        "52087525", // Vinelik Tenis Eskrim Spor Kulb
        "472316438", // Odtu Ikizler Blok
        "248571877", // Odt Ebi 2
        "656342909", // Ankara Odt niversitesi
        "39118623", // Endstri Mh. Labi
        "69559849", // Odt Thbt
        "745518943", // Odtu Visnelik Kampusu
        "228387788", // ODT Tenis Kortlari
        "132154519", // Vinelik Residences
        "81094072", // METU Faculty of Arch. R90-B
        "175048519", // 06 BL 5842
        "677272576", // La Maison
        "156055759", // Melis'
        "48683361", // Bo's House
        "93015473", // Isci Bloklari C Blok
        "108454455", // Odtu Visnelik Acik Hava Sinemasi
        "244455036", // Odtu Kortlar
        "227893798", // Lost in Town Party
        "397832921", // ODTU Visnelik Goran Bregovi Konseri
        "72763660", // Odtu Merkez Lab
        "340339782", // Odt naat Malzeme Lab
        "680360245", // Odtu Vinelik Tenis Akademisi
        "197826061", // ODT MATEMATK TOPLULUK ODASI
        "480064439", // Makina Mh. G Blok 407 Lab
        "240520699", // Ktphane Krmz Koltuklar
        "482601241", // ODT Kimya K-15
        "99396065", // Odtu Bahar Senligi
        "66188985", // Karakusunlar MKB Teknik ve Endstri Meslek Lisesi
        "275750170", // Otdu Devrim Stadyumu
        "341593174", // Odt Plaj Voleybolu Sahas
        "170985901", // Yagmurlu Ankara Havasi
        "44239243", // Makara
        "439264353", // Metu Gym
        "86520313", // Ahmet Bahadr lhan O
        "290209825", // Ebi/2 S
        "97438486", // Hassan Abi Waffle
        "22544266", // Pink Martini Konseri
        "107321385", // nye cumhuriyet meydan
        "40020929", // Odt Balikci
        "5669126", // METU Library
        "289063625", // Cisa
        "648802166", // Odt Makina Muhendislii alma Salonu
        "110269828", // Ziyafe Kayseri Mutfa
        "151662612", // ODTU Mimarlk Fakltesi Yeni Bina
        "200607628", // Odtu Iktisat Asma Kat
        "223138488", // 14.YMG ODTU KKM
        "233620965", // ODTU Faculty Club Akademik Yemek Salonu
        "82800012", // ODT Kk Spor Salonu
        "228038653", // Lost in Town Party
        "321477290", // ODT Mezunlar Gn 2014
        "238721413", // Odt Beeri Bilimler
        "63048810", // Global Game Jam 2013
        "118746492", // 3. yurt alma salonu
        "154626568", // Via Veneto
        "177462657", // ODT 4. Yurt Kantin
        "28672163", // ODT
        "251874192", // Alya Apartmani
        "563180321", // Engelsiz Odt Topluluk Odas
        "14871924", // ODTU Radyo Toplulugu Senlik Standi
        "11186647", // EB-1 Konukevi
        "239528654", // Sunshine Odt
        "235778546", // ODT Tenis Kortlari
        "92000623", // ODT enlik Alan
        "212301108", // Berfo Ana Park
        "663921536", // Odtu Makina Muhendisligi B Binasi Otoparki
        "211454241", // Odt Minibs Dura
        "594365871", // Yenikent Asas Stadi
        "10070440", // ODTU Sosyal Bilimler Binasi
        "256800745", // Odt Merkez Mhendislik Binas
        "252765361", // Odtu Ayasli
        "106606712", // Odt
        "136215132", // ODTU Kutuphane Reference
        "439731768", // Odt A1
        "169804378", // ODTU Kutuphanesi Toplanti Salonu
        "195587857", // room207
        "182548832", // ODT Makina Mh. imleri
        "17719626", // Odt at Cafe
        "6902055", // Odt Elektrik Elektronik Mhendislii
        "49005943", // Odt Biyoteknoloji Lab.
        "3590624", // ODT ATI
        "14185415", // METU Sports Center
        "93306723", // Eranl Hukuk
        "314253676", // Ankara , Turkey
        "74416719", // ODT Ktphane Sergi Salonu
        "220700607", // ODT 2.Yurt Binas
        "66798801", // Anneciinin Dizinin Dibinde:))
        "45994536" // Baran's House

    ];

    // Fills out the Who column if it is empty
    if (currentMinute >= 0 && currentMinute <= 15 && currentHour == 0) { // Activates once a day
        promises.push(pushUsernameToWhoColumn());
    }

    // Sends a push notification if the users comment is being liked
    if (currentMinute >= 0 && currentMinute <= 15 && currentHour == 10) { // Activates once a day
        promises.push(sendPushNotificationIfCommentIsLiked());
    }

    // Makes Deleted column true, of cards with passed duedates
    promises.push(makeDueDatePassedCardsDeletedTrue());

    // Delets all 'Deleted = true' cards with their spread skip & comments
    promises.push(deleteAllDeletedTrueCards());

    // Get from twitter
    promises.push(getTweetsFrom('parodyrektor', 15));
    promises.push(getTweetsFrom('odtuogrencileri', 15));
    promises.push(getTweetsFrom('thrcimen', 15));
    promises.push(getTweetsFromLocation());

    // Get from instagram
    _.each(instagramLocations, function(locationId) {
        promises.push(getInstagramPosts(locationId));
    });

    // Makes bad instacards Deleted: true
    promises.push(makeInstaCardDeleteTrue());

    // Creates cafeteria card when conditions below are set
    if (currentMinute >= 0 && currentMinute <= 15 && currentHour == 3) { // Activated between 6.00-7.00AM GMT+3
        if (currentDay >= 0 && currentDay <= 5) { // Activated on weekdays
            promises.push(createCafeteriaCard());
        }
    }

    // Creates weather card when conditions below are set
    if (currentMinute >= 0 && currentMinute <= 15 && currentHour == 3) { // Activated between 06.00-07.00AM GMT+3
        promises.push(createWeatherCard());
    }

    Parse.Promise.when(promises).then(function() {
        console.log('error donmedi');
        status.success("Backgroundjob completed");
    }, function(error) {
        console.log('error dondu');
        status.success("Backgroundjob error occured ");
    });
}
