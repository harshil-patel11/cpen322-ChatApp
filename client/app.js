var profile = {
	username: "Harshil"
}

var Service = {
	origin: window.location.origin,
	getAllRooms: async function () {
		// https://stackoverflow.com/questions/67955033/async-await-with-fetch-js
		const response = await fetch(Service.origin + "/chat");
		if (!response.ok){
			throw new Error(await response.text());
		}
		else{
			const arr = await response.json();
			return arr;
		}
	},
	addRoom : async function (data) {
		const response = await fetch(Service.origin + "/chat",
		{
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(data)
	})

	if (!response.ok){
		throw new Error(await response.text());
	}
	else{
		const ret = await response.json();
		return ret;
	}
	},

	getLastConversation: async function(roomId, before){
		const response = await fetch(`${Service.origin}/chat/${roomId}/messages?before=${before}`);

		if (!response.ok){
			throw new Error(await response.text());
		}
		else{
			const res = await response.json();
			return res;
		}
	},

	getProfile: async function(){
		const response = await fetch(`${Service.origin}/profile`);

		if (!response.ok){
			throw new Error(await response.text());
		}
		else{
			const res = await response.json();
			return res;
		}
	}
}

// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM(elem) {
  while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM(htmlString) {
  let template = document.createElement("template");
  template.innerHTML = htmlString.trim();
  return template.content.firstChild;
}

function main() {

  var lobby = new Lobby();
  var lobbyView = new LobbyView(lobby);

  var socket = new WebSocket("ws://99.79.42.146:3000");
  var chatView = new ChatView(socket);
  var profileView = new ProfileView();

  profile.username = Service.getProfile();

  socket.addEventListener('message', (message) => {
	var messageObj = JSON.parse(message.data);
	console.log(messageObj);
	var roomObj = lobby.getRoom(messageObj.roomId);
	roomObj.addMessage(messageObj.username, messageObj.text);
  })

  function refreshLobby () {
	  Service.getAllRooms()
	  .then((rooms) => {
		  for (let room of rooms){
			if (room._id in lobby.rooms){
				lobby.rooms[room._id].name = room.name;
				lobby.rooms[room._id].image = room.image;
			}
			else{
				lobby.addRoom(room._id, room.name, room.image, room.messages);
			}
		  }
	  }
	  )
	}

  refreshLobby();
  setInterval(refreshLobby, 7000);

  function renderRoute() { 
    var url = window.location.hash.split('/'); 
	// console.log(url);
	var roomId = url[2];

    if (url[1] === "") {
      var pageView = document.getElementById("page-view");
      emptyDOM(pageView);
      var content = lobbyView.elem;
      pageView.appendChild(content);
    } 
	
	else if (url[1] === "chat") {
      var pageView2 = document.getElementById("page-view");
      emptyDOM(pageView2);
      var chat_content = chatView.elem;
      pageView2.appendChild(chat_content);

	  var room = lobby.getRoom(roomId);
	  
	  if (room !== null && room !==undefined){
	  	chatView.setRoom(room);
	  }
	  else {
		  throw {
			  exception: "Null room exception"
		  }
	  }
    }

	else if (url[1] === "profile"){
		var pageView3 = document.getElementById("page-view");
		emptyDOM(pageView3);
		var profile_content = profileView.elem;
		pageView3.appendChild(profile_content);
	}

	window.addEventListener("popstate", renderRoute, false);

	}
	renderRoute();

	cpen322.export(arguments.callee, { renderRoute, lobbyView, chatView, profileView, lobby, refreshLobby, socket });
}

window.addEventListener("load", main, false);


class LobbyView {
	constructor(lobby){
		this.lobby = lobby;
		this.lobby.onNewRoom = (room) => {
			var link = `<li><a href="#/chat/${room.id}"> ${room.name} </a></li>`;
			this.listElem.append(createDOM(link));
			// this.redrawList();
		}
		this.elem = createDOM(
		`<div class = "content">
		<ul class = "room-list">
		  <li><a href="#/chat"> Everyone in CPEN 322 </a></li>
		  <li><a href="#/chat"> Foodies only </a></li>
		  <li><a href="#/chat"> Gamers unite </a></li>
		  <li><a href="#/chat"> Canucks Fans </a></li>
		</ul>

		<div class = "page-control">
		  <input type="text" name="">
		  <button> Create Room </button>
		</div>
	  </div>`);

	  this.listElem = this.elem.querySelector("ul.room-list");

	  this.inputElem = this.elem.querySelector("div.page-control input");
	//   console.log(this.inputElem);

	  this.buttonElem = this.elem.querySelector("div.page-control button");

	  this.redrawList();

	  this.buttonElem.addEventListener("click", async ()=>
	  {
		var input = this.inputElem.value;
		Service.addRoom({name: input, image: "New Room"})
		.then(async (room) => {
			this.lobby.addRoom(room._id, room.name, room.image, room.messages);
		})
		this.inputElem.value = "";
	  }
	 
	  , false);
	}

	redrawList(){
		emptyDOM(this.listElem);
		// console.log(this.listElem);

		for (var room in this.lobby.rooms){
			// console.log(this.lobby.rooms[room]);
			var link = `<li><a href="#/chat/${this.lobby.rooms[room].id}"> ${this.lobby.rooms[room].name} </a></li>`;
			this.listElem.appendChild(createDOM(link));
		}
	}

}

class ChatView {
	constructor(socket){
		this.socket = socket;
		this.elem = createDOM(
			`<div class = "content">
				<h4 class = "room-name"> Room Name </h4>
				<div class = "message-list">
					<div class = "message" overflow = "scroll"> 
						<span class = "message-user"> Username </span>
						<span class="message-text"> Message </span>
					</div>

					<div class = "message my-message">
						<span class = "message-user"> My Username </span>
						<span class="message-text"> My Message </span>
					</div>
				</div>

				<div class = "page-control">
					<textarea name="message-input" id="" cols="30" rows="5"></textarea>
					<button> Send </button>
				</div>
			</div>`);

		this.titleElem = this.elem.querySelector("div.content h4");

		this.chatElem = this.elem.querySelector("div.message-list");

		this.inputElem = this.elem.querySelector("div.page-control textarea");

		this.buttonElem = this.elem.querySelector("div.page-control button");

		this.room = null;

		this.buttonElem.addEventListener('click', () => {
			this.sendMessage();
		});

		this.inputElem.addEventListener('keyup', (event) => {
			if (event.keyCode === 13 && !event.shiftKey){
				this.sendMessage();
			}
		});

		this.chatElem.addEventListener('wheel', (event) => {
			if (event.deltaY < 0 && this.chatElem.scrollTop <= 0){
				if (this.room.canLoadConversation == true){
				this.room.getLastConversation.next();
				}
			}
		});
	}

	sendMessage(){
		var text = this.inputElem.value;
		this.room.addMessage(profile.username, text);
		this.inputElem.value = "";

		var message = {
			roomId: this.room.id,
			username: profile.username,
			text: text
		}
		this.socket.send(JSON.stringify(message));
	}

	setRoom(room){
		this.room = room;
		// console.log(this.room)
		this.titleElem.innerHTML = room.name;
		emptyDOM(this.chatElem);

		for (let message of this.room.messages){
			if (message.username === profile.username) {
			  let msg = 
			    `<div class="message my-message">
			      <span class="message-user">${message.username}</span>
			      <span class="message-text">${message.text}</span>
			    </div>`
	  
			  this.chatElem.appendChild(createDOM(msg));
			} else {
			  let msg = 
			    `<div class="message">
			      <span class="message-user">${message.username}</span>
			      <span class="message-text">${message.text}</span>
			    </div>`
	  
			  this.chatElem.appendChild(createDOM(msg));
			}
		}

		this.room.onNewMessage = (message) => {
			// message.text = message.text.replace('<', "&lt;").replace('>', "&gt;");
			console.log("message is: ", message)
			if (message.username === profile.username) {
				let msg = 
				  `<div class="message my-message">
					<span class="message-user">${message.username}</span>
					<span class="message-text">${message.text}</span>
				  </div>`
		
				this.chatElem.appendChild(createDOM(msg));
			  } else {
				let msg = 
				  `<div class="message">
					<span class="message-user">${message.username}</span>
					<span class="message-text">${message.text}</span>
				  </div>`
		
				this.chatElem.appendChild(createDOM(msg));
			  }
		}

		this.room.onFetchConversation = (conv) => {
			let scroll_start = this.chatElem.scrollHeight;
			let message = '';

			for (var i = 0; i < conv.messages.length; i++){
				if (conv.messages[i].username == profile.username){
					message+= `<div class = "message my-message"><span class="message-user">${profile.username}</span><span class = "message-text">${conv.messages[i].text}</span>`;
				}
				else{
					message+=`<div class="message"><span class="message-user">${conv.messages[i].username}</span><span class="message-text">${conv.messages[i].text}</span></div>`;
				}
			}
			this.chatElem.innerHTML = message + this.chatElem.innerHTML;
			var scroll_end = this.chatElem.scrollHeight;
			this.chatElem.scrollTop = scroll_end - scroll_start;
		}
	}
}

class ProfileView {
	constructor(){
		this.elem = createDOM(
			`<div class = "content">
			<div class = "profile-form">
				<div class = "form-field">
					<label for="username"> Username </label>
					<input id = "username" type="text">
					<br>

					<label for="password"> Password </label>
					<input id = "password" type="password">
					<br>

					<label id = "avatar-image"> </label>
					<input id = "avatar-image" type="file">
					<br>

					<label for="about"> About </label>
					<br>
					<textarea name="about" id="" cols="30" rows="10"></textarea>
				</div>
			</div>

			<div class = "page-control">
				<button> Save </button>
			</div>
		</div>`);
	}

}

function* makeConversationLoader(room){
	var last_convo_timestamp = room.timestamp;
	// room.canLoadConversation = false;
	var flag = false;

	while(!flag){
		room.canLoadConversation = false;
		yield new Promise((resolve, reject) => {
			Service.getLastConversation(room.id, last_convo_timestamp)
			.then(
				(convo) => {
					if (convo != null){
						last_convo_timestamp = convo.timestamp;
						room.addConversation(convo);
						room.canLoadConversation = true;
						resolve(convo);
					}
					else{
						flag = true;
						resolve(null);
					}
				})
		})
	}
}

class Room {
	constructor(id, name, image = "assets/everyone-icon.png", messages = []){
		this.id = id;
		this.name = name;
		this.image = image;
		this.messages = messages;
		this.timestamp = Date.now();
		this.canLoadConversation = true;
		// this.onNewMessage = (messages) => {};
		this.getLastConversation = makeConversationLoader(this);
	}

	addMessage(username, text){

		var message = {
			username: username,
			text: text
		}
		
		if (text.trim() === ""){
			return;
		}
		else {
			// message.text = message.text.replace('<', "&lt;").replace('>', "&gt;");
			this.messages.push(message);
		}

		if (this.onNewMessage !== undefined){
			this.onNewMessage(message);
		}
	}

	addConversation(conversation){
		for (var i = 0; i < conversation.messages.length; i++){
			this.messages.push(conversation.messages[i]);
		}
		this.onFetchConversation(conversation);
	}
}

class Lobby {
	constructor(){
		this.rooms = {
			// room1: new Room('room1', "Room 1"),
			// room2: new Room('room2', "Room 2"),
			// room3: new Room('room3', "Room 3"),
			// room4: new Room('room4', "Room 4")
		};
	}

	getRoom(roomId){
		return this.rooms[roomId];
	}

	addRoom(id, name, image, messages){
		this.rooms[id] = new Room(id, name, image, messages);

		if (this.onNewRoom !== undefined){
			this.onNewRoom(this.rooms[id]);
		}
	}

}