const socketio = require('socket.io')

class SocketHandler{
    /**
     * Class handles socket connections.
     *
     * @param server - http server on top of Express, which is required for socket.io to start.
     * @param client - URL on which app starts on.
     * @class
     */
    constructor(server, client) {

        /**
         * Property is socket.io server instance required to handle incoming and outgoing connections.
         *
         * @type {*}
         * @private
         */
        this._io = socketio(server, {
            cors: {
                origin: client,
                methods: ["POST", "GET"]
            }
        })

        /**
         * Property contains all chat rooms that was created by sockets.
         *
         * @type {Set<any>}
         * @private
         */
        this._rooms = new Set()

        /**
         * Property contains list of sockets with corresponding room names.
         *
         * @type {Map<any, any>}
         * @private
         */
        this._chatUsers = new Map()
    }

    /**
     * @method handleConnection()
     *
     * Method handles socket connection and response for incoming events. Logs incoming events to console.
     */
    handleConnection(){
        this._io.on('connect', socket => {
            socket.emit('connected', `You have connected to server`)
            console.log(`User ${socket.handshake.query.clientName} with ID ${socket.id} has connected`)

            socket.on('join_room', args => {
                console.log("join_room event invoked")
                this.joinRoom(args, socket)
            })
            socket.on('add_room', args => {
                console.log("add_room event invoked")
                this.addRoom(args, socket)
            })
            socket.on('new_message', args => {
                console.log("new_message event invoked")
                this.newMessage(args, socket)
            })
            socket.on('leave_room', args => {
                console.log("leave_room event invoked")
                this.leaveRoom(args, socket)
            })
            socket.on('disconnect', () => {
                console.log('disconnect event invoked')
                this.disconnectUser(socket)
            })
        })
    }

    /**
     * @method getId()
     *
     * Method creates unique ID
     *
     * @returns {string}
     */
    getId(){
        return Math.random().toString(36).substr(2, 15)
    }


    /**
     * @method leaveRoom()
     * @param args - object that contains roomName and userName parameters.
     * @param socket - current socket.
     *
     * Method handles socket leaving a room.
     *
     * Logs information about leaving user and room to the console,
     * removes socket from room and server storage of connected users.
     * Logs information about event in console.
     *
     * @emits user_left_chat - sends system info message for everyone left in room
     * @emits room_users_list - sends actual list of connected users for the rest in room
     */
    leaveRoom(args, socket){
        socket.leave(args.roomName)
        this.removeUserFromServerStorage(args, socket)
        console.log(`User ${socket.handshake.query.clientName} has left room ${args.roomName}`)
        socket.to(args.roomName).emit('user_left_chat', {
            messageId: this.getId(),
            messageText: `User ${socket.handshake.query.clientName} has left chat`,
            messageRoomName: args.roomName,
            messageSystem: true
        })
        this._io.to(args.roomName).emit('room_users_list', {
            chatUsers: this._chatUsers.get(args.roomName),
            roomName: args.roomName
        })
    }

    /**
     * @method joinRoom()
     * @param args - object that contains roomName and userName parameters.
     * @param socket - current socket.
     *
     * Method handles socket joining room.
     *
     * Ensures that desired room is present at server storage. Refuses socket connection if room is not present.
     * Adds socket to server storage in order to connect its ID and nickname.
     * Logs information about socket username and room.
     *
     * Fires either 'successful' events is socket if joined or 'unsuccessful' if this room's record does not exits
     *
     * @emits room_joined - emits only for connecting socket if desired room is present.
     * Contains roomName argument with connected room name. 'Successful' event.
     * @emits new_message_in_room - sends new system message to all socket in room expect newly connected about
     * connected socket. Contains message info with unique messageID, message text, time and room. 'Successful' event.
     * @emits room_users_list - sends updated list with users connected to this room for
     * everyone in room. 'Successful' event.
     * @emits room_not_exit - fires only if room is not present on server. Contains error text. 'Unsuccessful' event.
     */
    joinRoom(args, socket){
        if (!this.userAlreadyInRoom(args, socket)){
            if (this._rooms.has(args.roomName)) {
                socket.join(args.roomName)
                this.addUserToServerStorage(args, socket)
                console.log(`Socket ${socket.handshake.query.clientName} has joined ${args.roomName} room`)
                socket.emit('room_joined', { //roomName is unique so React will render them correctly
                    roomName: args.roomName,
                })
                socket.to(args.roomName).emit('new_message_in_room', {
                    messageId: this.getId(),
                    messageText: `User ${socket.handshake.query.clientName} has joined chat room`,
                    messageRoomName: args.roomName,
                    messageSystem: true
                })
                this._io.to(args.roomName).emit('room_users_list', {
                    chatUsers: this._chatUsers.get(args.roomName),
                    roomName: args.roomName
                })
            } else {
                socket.emit('room_not_exit', "This room doesn't exist")
            }
        }
    }

    /**
     * @method userAlreadyInRoom()
     * @param args - argument containing a unique room name.
     * @param socket - current socket.
     * @returns {boolean} returns 'true' if user is already joined and 'false' if not
     */
    userAlreadyInRoom(args, socket){
        const currentUsers = this._chatUsers.get(args.roomName)
        if (currentUsers){
            const userIndex = currentUsers.findIndex(entry => entry.userId === socket.id)
            if (userIndex !== -1) {
                socket.emit('already_joined', "You have already joined this room")
                return true
            }
        }
        return false
    }

    /**
     * @method addRoom()
     * @param args - object that contains roomName parameter.
     * @param socket - current socket.
     *
     * Method handles new room creation.
     *
     * Ensures that room is not already present in server storage. If room is not present adds room to server storage,
     * logs room creation event and emits 'successful' events. Fires 'unsuccessful' event if this room is already present.
     *
     * @emits room_already_exist - fires to creator only if roomName is already is
     * present in server storage. Contains error text. 'Unsuccessful' event.
     *
     * @emits room_created - fires to creator only on successful room creation.
     * Contains roomName argument with created room name. 'Successful' event.
     *
     * @emits room_users_list - sends updated list with users connected to this room for
     * everyone in room. 'Successful' event.
     */
    addRoom(args, socket){
        if (this._rooms.has(args.roomName)){
            console.log(`Room ${args.roomName} already exist`)
            socket.emit('room_already_exist', "Room with this name already exist")
        } else {
            this._rooms.add(args.roomName)
            socket.join(args.roomName)
            this.addUserToServerStorage(args, socket)
            console.log(`Room ${args.roomName} has been created`)
            socket.emit('room_created', {
                roomName: args.roomName
            })
            socket.emit('room_users_list', {
                chatUsers: this._chatUsers.get(args.roomName),
                roomName: args.roomName
            })
        }
    }

    /**
     * @method addUserToServerStorage()
     * @param args - object with roomName, userName and userId fields.
     * @param socket- current socket.
     *
     * Method handles adding new socket to server storage.
     * Storage mainly required for connecting socket ID, it's nickname and rooms that is connected by it.
     */
    addUserToServerStorage(args, socket){
        const currentUsers = this._chatUsers.get(args.roomName)
        currentUsers ? this._chatUsers.set(args.roomName, [...currentUsers, {userName: socket.handshake.query.clientName, userId: socket.id}]) :
            this._chatUsers.set(args.roomName, [{userName: socket.handshake.query.clientName, userId: socket.id}])
    }

    /**
     * @method removeUserFromServerStorage()
     * @param args - object containing roomName and userId fields.
     * @param socket - current socket.
     *
     * Method handles removing socket from server storage, i.e. removing socket from chat room record.
     * Logs information in console.
     */
    removeUserFromServerStorage(args, socket){
        const currentUsers = this._chatUsers.get(args.roomName)
        const userIndex = currentUsers.findIndex(entry => entry.userId === socket.id)
        if (userIndex !== -1){
            currentUsers.splice(userIndex, 1)
            this._chatUsers.set(args.roomName, currentUsers)
        }
        console.log(`User ${args.userId} has left room ${args.roomName}`)
    }

    /**
     * @method disconnectUser()
     * @param socket - current socket.
     *
     * Method handles removing disconnected user from user lists in all rooms.
     */
    disconnectUser(socket){
        for (let room of this._chatUsers.entries()){
            if (room[1] === undefined) return
            const userIndex = room[1].findIndex(user => user.userId === socket.id)
            if (userIndex !== -1){
                if (room[1].length === 1) room[1] = []
                else room[1].splice(userIndex, 1)
                this._chatUsers.set(room[0], room[1])
            }
            this._io.to(room[0]).emit('user_left_chat', {
                messageId: this.getId(),
                messageText: `User ${socket.handshake.query.clientName} has disconnected`,
                messageRoomName: room[0],
                messageSystem: true
            })
            this._io.to(room[0]).emit('room_users_list', {
                chatUsers: this._chatUsers.get(room[0]),
                roomName: room[0]
            })
        }}

    /**
     * @method newMessage()
     * @param args - object with information about message, such as its text, sender, room, 'system' flag.
     * @param socket - current socket.
     *
     * Method handles adding ID and time for message and sending it to sockets. Logs message info to console.
     *
     * @emits new_message_in_room - adds fields to message and fires to all sockets connected to room.
     */
    newMessage(args, socket){
        const message = new Message(args.messageText, args.roomName, socket.handshake.query.clientName)
        console.log(`New message '${args.messageText}' from ${socket.handshake.query.clientName} to room ${args.messageRoomName}`)
        this._io.in(args.messageRoomName).emit('new_message_in_room', {
            messageId: this.getId(),
            messageTime: new Date().toUTCString(),
            messageRoomName: args.messageRoomName,
            messageText: args.messageText,
            messageSender: socket.handshake.query.clientName,
            messageSystem: args.system
        })
    }
}

module.exports = SocketHandler
