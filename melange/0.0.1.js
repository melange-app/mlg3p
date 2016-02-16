// Check to see if Angular is Running
(function() {
    // Common URL
    var common = "http://common.local.getmelange.com:7776"
    var application = "http://app.local.getmelange.com:7776"

    // Angular Functions
    if (window.angular) {
        // Define UI Components
        var melangeUi = angular.module('melangeUi', []);

        // TODO: Fix format giving alias `undefined`.
        melangeUi.directive('parseTo', function() {
            return {
    		restrict : 'A',
    		require: 'ngModel',
    		link: function(scope, element, attr, ngModel) {
    		    function parse(string) {
                        if(string === "" || string === undefined) {
                            var obj = [];
                            obj.public = true;
                            return obj;
                        } else {
                            var comp = string.split(",");
                            var obj = [];
                            for (var i in comp) {
                                obj.push({
                                    alias: comp[i].alias,
                                })
                            }
                            obj.public = false;
                            return obj;
                        }
    		    }

    		    function format(data) {
                        if(data === undefined || data.length === 0) {
                            return "";
                        } else {
                            var out = "";
                            for (var i in data) {
                                if(i != 0) {
                                    out += ","
                                }

                                out += data[i].alias
                            }

                            return out;
                        }
    		    }
    		    ngModel.$parsers.push(parse);
    		    ngModel.$formatters.push(format);
    		}
            };
        });

        // mlgToField Creates an Access Control Pane
        melangeUi.directive("mlgToField", function () {
            return {
                require: 'ngModel',
                restrict: 'E',
                scope: { ngModel: "=" },
                template: "<div class=\"input-group\"><span class=\"input-group-addon\"><i class=\"fa fa-group\"></i></span><input ng-model=\"ngModel\" class=\"form-control\" type=\"text\" placeholder=\"Public\" parse-to></div>",
                link: function(scope, elem, attr, ngModel) {
                    if(!angular.isDefined(scope.ngModel)) {
                        var obj = [];
                        obj.public = true;
                        scope.ngModel = obj;
                    } else {
                        scope.ngModel.public = (scope.ngModel.length == 0)
                    }
                }
            }
        });
    }

    var getIdentifier = function() {
        var hash = window.location.hash;
        var index = hash.indexOf('id=') + 3;
        
        return hash.substr(index);
    }

    // Wrap PostMessage
    var identifier = getIdentifier();
    function messenger(type, context) {
        window.top.postMessage({
            id: identifier,
            type: type,
            context: context,
        }, application);
    }

    // Receivers
    var receivers = {};
    function receiveMessage(e) {
        if (e.origin !== application) {
            return;
        }
        if (typeof e.data["context"] !== "object" || typeof e.data["type"] !== "string") {
            console.log("Error", e.data.type)
            return;
        }
        if (typeof receivers[e.data.type] !== "function") {
            console.log("Couldn't receive message type " + e.data.type);
            console.dir(e);
            return
        }

        if (e.data["context"].error !== undefined && e.data["context"].error.code !== 0) {
            throw e.data["context"].error.message
        }

        receivers[e.data.type](e.data.context)
    }
    window.addEventListener("message", receiveMessage, false);

    function callback(fn, data) {
        setTimeout(function() {
            fn(data);
        }, 0);
    }

    var realtimeSubscribers = [];
    receivers["realtimeUpdate"] = function(data) {
        try {
            console.log(data)
                if(!(data.subscriber in realtimeSubscribers)) { return }

            realtimeSubscribers[data.subscriber].callback(data.message);
        } catch(e) {
            console.log("Subscriber left the plugin.")
                console.log(e)
                delete realtimeSubscribers[data.subscriber];
        }
    };
    messenger("pluginInit", {});
    
    var melange = {
        viewer: function(fn) {
            // msg is a JS Object-literal where the Keys and Values are translated to AD Directly
            receivers["viewerMessage"] = function(data) {
                delete receivers["viewerMessage"]
                callback(function(data) {
                    fn(data);
                    melange.refreshViewer();
                }, data);
            }
            setTimeout(function() {
                melange.refreshViewer(true);
            }, 0);
        },
        refreshViewer: function(sendMsg) {
            if(sendMsg === undefined) { sendMsg = false; }
            messenger("viewerUpdate",
                      {
                          height: document.body.scrollHeight,
                          sendMsg: sendMsg,
                      });
        },
        setViewerLink: function(link) {
            messenger("setViewerLink", {
                link: link,
            });
        },
        // New Messages
        createMessage: function(msg, fn) {
            // msg is a JS Object-literal where the Keys and Values are translated to AD Directly
            receivers["createdMessage"] = function(data) {
                delete receivers["createdMessage"]
                callback(fn, data);
            }
            messenger("createMessage", msg);
        },
        // Get Messages
        findMessages: function(fields, predicate, fn, realtimeFunc) {
            var rt = false;
            if(arguments.length == 4) {
                // ENABLE REALTIME SUPPORT
                rt = realtimeSubscribers.length;
                realtimeSubscribers.push({
                    callback: realtimeFunc,
                });
            }

            receivers["foundMessages"] = function(data) {
                delete receivers["foundMessages"]
                callback(fn, data);
            }
            messenger("findMessages", {
                realtime: rt,
                fields: fields,
                predicate: predicate,
            });
        },
        updateMessage: function(newMsg, id, fn) {
            // update a message with id
            receivers["updatedMessage"] = function(data) {
                delete receivers["updatedMessage"]
                callback(fn, data);
            }
            messenger("updateMessage", {
                newMsg: newMsg,
                id: id,
            });
        },
        // Remote Messages
        downloadMessage: function(addr, id, fn) {
            // will lookup a message at a specific address by name
            receivers["downloadedMessage"] = function(data) {
                delete receivers["downloadedMessage"]
                callback(fn, data);
            }
            messenger("downloadMessage", {
                alias: addr,
                id: id,
            });
        },
        downloadPublicMessages: function(fields, predicate, addr, fn) {
            // will lookup all public messages at an address
            receivers["downloadedPublicMessages"] = function(data) {
                delete receivers["downloadedPublicMessages"]
                callback(fn, data);
            }
            messenger("downloadPublicMessages", {
                addr: addr,
                fields: fields,
                predicate: predicate,
            });
        },
        // User Management
        currentUser: function(fn) {
            // msg is a JS Object-literal where the Keys and Values are translated to AD Directly
            receivers["currentUser"] = function(data) {
                delete receivers["currentUser"]
                callback(fn, data);
            }
            messenger("currentUser", {});
        },
        // Link Management
        openLink: function(url) {
            messenger("openLink", {
                url: url,
            });
        },
        // Helper Methods
        angularCallback: function(scope, fn) {
            return function(data) {
                scope.$apply(function() { fn(data) })
            };
        },
    }
    window.melange = melange;

    document.addEventListener('DOMContentLoaded', function(){
        melange.refreshViewer();
    });

})();
    
    
// // Example Message Object
//
// // Example Predicate
// {
//   contains: [["airdispat.ch/message/subject"]],
//   from: "",
//   to: "",
// }
//
// exports.api = melange;
