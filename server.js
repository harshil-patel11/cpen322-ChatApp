const cpen322 = require('./cpen322-tester.js');
const Database = require('./Database.js');

const ws = require("ws");
const broker = new ws.Server({
	port: 8000
});

const path = require('path');
const fs = require('fs');
const express = require('express');
const SessionManager = require('./SessionManager.js');
const crypto = require('crypto');

const messageBlockSize = 10;

var db = new Database("mongodb://localhost:27017", "cpen322-messenger");

var sessionManager = new SessionManager();

function isCorrectPassword(password, saltedHash){
	var salt = saltedHash.substring(0, 20);
	var hash_b64 = saltedHash.substring(20);

	var salted_password = password+salt;
	var sha = crypto.createHash('sha256').update(salted_password).digest('base64');

	if (sha === hash_b64){
		return true;
	}

	return false;
}

var messages = {};

db.getRooms().then((rooms_arr) => {
	for (var i = 0; i < rooms_arr.length; i++){
		messages[rooms_arr[i]._id] = [];
	}
});

function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

broker.on('connection', (clientSocket, req) => {
	// read cookies from the client
	var cookies = req.headers.cookie;
	if (!cookies){
		// (req.session !== cookies)
		console.log("No cookies found");
		// close the connection
		clientSocket.close();
		return;
	}

	var username = sessionManager.getUsername(cookies.split('=')[1]);
	if (!username){
		console.log("No username found");
		// close the connection
		clientSocket.close();
		return;
	}

  	clientSocket.on('message', async (message) => {
	let msg = JSON.parse(message); // Parse retrieved message from clientSocket
	msg.username = username;
	// msg.text = msg.text.replace('<', "&lt;").replace('>', "&gt;");
	messages[msg.roomId].push(msg);
	if (messages[msg.roomId].length === messageBlockSize){
	  var conversation = {
		  room_id: msg.roomId,
		  timestamp: Date.now(),
		  messages: messages[msg.roomId]
	  };

	  db.addConversation(conversation).then((resolve) => {
		  messages[msg.roomId] = [];
	  })
	}
	broker.clients.forEach((client) => {
	  if (client !== clientSocket) {
		client.send(JSON.stringify(msg));
	  }
	});
  });
});

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');

// express app
let app = express();

// app.use('/chat/:room_id/messages', sessionManager.middleware);
// app.use('/chat/:room_id', sessionManager.middleware);
// app.use('/chat', sessionManager.middleware);
app.use('/profile', sessionManager.middleware);
app.use('/app.js', sessionManager.middleware);
// app.use('/index.html', sessionManager.middleware);
// app.use('/index', sessionManager.middleware);
// app.use('/$', sessionManager.middleware);

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

// serve static files (client-side)
app.use('/', express.static(clientApp, { extensions: ['html'] }));
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

app.use((err, req, res, next) => {
	// check if the error is an instance of session manager error
	if (err instanceof SessionManager.Error){
		// If the accept header is application/json
		if (req.headers.accept == 'application/json'){
			res.status(401).send(err.message);
		}
		else{
			return res.redirect('/login');
		}
	}
	else{
		res.status(500).send('Internal Server Error');
	}
});

app.get("/chat", (req, res) => {
	db.getRooms().then((chatrooms) => {
		for (var i = 0; i < chatrooms.length; i++){
			chatrooms[i].messages = messages[chatrooms[i]._id]; 
		}
		res.send(chatrooms);
	})
})

app.get("/chat/:room_id", (req, res) => {
	db.getRoom(req.params.room_id).then((room) => {
		if (room){
			res.send(room);
		}
		else {
			res.status(404).send(`Room ${req.params.room_id} not found`);
		}
	})
		
})

app.post('/chat', (req, res) => {
	db.addRoom(req.body).then((chatroom) => {
		messages[chatroom._id] = [];
		chatroom.messages = messages[chatroom._id];
		res.status(200).send(chatroom);
		
	}).catch((error) => {res.status(400).send("HTTP 400 Bad Request")})

  })

  app.get("/chat/:room_id/messages", (req, res) => {
	var before = parseInt(req.query.before, 10)
	var room_id = req.params.room_id
  
	db.getLastConversation(room_id, before).then(conversation => {res.send(conversation)})
  })

  app.post('/login', (req, res, next) => {
	db.getUser(req.body.username).then((user) => {
		if (user){
			if (isCorrectPassword(req.body.password, user.password)){
				sessionManager.createSession(res, user.username);
				return res.redirect('/');
			}
			else {
				return res.redirect('/login');
			}	
		}
		else{
			return res.redirect('/login');
		}
	})
  })

//   app.get('/profile', sessionManager.middleware, (req, res, next) => {
// 	res.send({
// 		username: req.username
// 	});
//   })

app.get('/profile', (req, res) => {
	if (("cookie" in req.headers) && sessionManager.getUsername(req.headers.cookie.split('=')[1])){
		res.send({
			username: sessionManager.getUsername(req.headers.cookie.split('=')[1])
		});
	}
});

app.get('/logout', (req, res) => {
	// find session associated with request
	sessionManager.deleteSession(req);
	return res.redirect('/login');
});

cpen322.connect('http://99.79.42.146/cpen322/test-a5-server.js');
cpen322.export(__filename, { app, messages, broker, db, messageBlockSize, sessionManager, isCorrectPassword });