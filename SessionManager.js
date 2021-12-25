const crypto = require('crypto');
const e = require('express');

class SessionError extends Error {};

function SessionManager (){
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
		/* To be implemented */
		var age;
		var token = crypto.randomBytes(50);
		console.log(token.toString('hex'));

		var metadata = {
			"username": username,
			"timestamp": Date.now(),
			"expiry": Date.now() + maxAge
		};

		sessions[token.toString('hex')] = metadata;

		if (!maxAge){
			age = 1000000000;
		}
		else{
			age = maxAge;
		}

		response.cookie('cpen322-session', token.toString('hex'), {maxAge: age});

		setTimeout(() => {
			delete sessions[token.toString('hex')];
		}, age);
	};

	this.deleteSession = (request) => {
		/* To be implemented */
			if (request.username){
				delete request.username;
			}
			if (request.session){
				if (sessions[request.session]){
					delete sessions[request.session];
				}
				delete request.session;
			}
	};

	this.middleware = (request, response, next) => {
		/* To be implemented */
		// Check if cookie header was found
		if (!request.headers.cookie){
			// call next() to move on to the next middleware
			next(new SessionError());
		}
		else{
			var cookie_info = request.headers.cookie;
			var parsed_cookie = cookie_info.split(';').map(v => v.split('=')).reduce((acc,v) => {
				acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
				return acc;
			}, {});
			
			if (!sessions[parsed_cookie['cpen322-session']]){
				next(new SessionError());
			}
			else{
				request.username = sessions[parsed_cookie['cpen322-session']]['username'];
				// Assign a new property called session to the request object and assign the cookie value to it
				request.session = parsed_cookie['cpen322-session'];
				next();
			}
		}
	};

	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;