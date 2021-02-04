import { Server } from "socket.io";
import {Message, UserMessage} from "./Message.js";
import Logger from "./Logger.js";

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
        this._io = new Server(server, {
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
            Logger.userConnectedToServer(socket.id, socket.handshake.query.clientName)
            socket.emit('connected', `You have connected to server`)

            socket.on('join_room', args => {
                Logger.eventInvoked('join_room')
                this.joinRoom(args, socket)
            })
            socket.on('add_room', args => {
                Logger.eventInvoked('add_room')
                this.addRoom(args, socket)
            })
            socket.on('new_message', args => {
                Logger.eventInvoked('new_message')
                this.newMessage(args, socket)
            })
            socket.on('leave_room', args => {
                Logger.eventInvoked('leave_room')
                this.leaveRoom(args, socket)
            })
            socket.on('disconnect', () => {
                Logger.eventInvoked('disconnect')
                this.disconnectUser(socket)
            })
        })
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
     * @emits user_list_changed - sends new system message about joined user.
     * @emits room_users_list - sends actual list of connected users for the rest in room.
     */
    leaveRoom(args, socket){
        socket.leave(args.roomName)
        this.removeUserFromServerStorage(args, socket)
        Logger.userLeftRoom(socket.handshake.query.clientName, socket.id, args.roomName)
        const message = new Message(`User ${socket.handshake.query.clientName} has left chat`, args.roomName)
        Logger.newSystemMessage(message.text, message.roomName)
        socket.to(args.roomName).emit('user_list_changed', message.toJson())
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
     * @emits user_list_changed - sends new system message about joined user. 'Successful' event.
     * @emits room_users_list - sends updated list with users connected to this room for
     * everyone in room. 'Successful' event.
     * @emits room_not_exit - fires only if room is not present on server. Contains error text. 'Unsuccessful' event.
     */
    joinRoom(args, socket){
        if (!this.userAlreadyInRoom(args, socket)){
            if (this._rooms.has(args.roomName)) {
                socket.join(args.roomName)
                this.addUserToServerStorage(args, socket)
                Logger.userJoinedRoom(socket.handshake.query.clientName, socket.id, args.roomName)
                socket.emit('room_joined', { //roomName is unique so React will render them correctly
                    roomName: args.roomName,
                })
                const message = new Message(`User ${socket.handshake.query.clientName} has joined chat room`, args.roomName)
                Logger.newSystemMessage(message.text, message.roomName)
                socket.to(args.roomName).emit('user_list_changed', message.toJson())
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
     * @returns {boolean} returns 'true' if user is already joined and 'false' if not.
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
            Logger.roomAlreadyExist(socket.handshake.query.clientName, socket.id, args.roomName)
            socket.emit('room_already_exist', "Room with this name already exist")
        } else {
            this._rooms.add(args.roomName)
            socket.join(args.roomName)
            this.addUserToServerStorage(args, socket)
            Logger.roomCreated(socket.handshake.query.clientName, socket.id, args.roomName)
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
     */
    removeUserFromServerStorage(args, socket){
        const currentUsers = this._chatUsers.get(args.roomName)
        const userIndex = currentUsers.findIndex(entry => entry.userId === socket.id)
        if (userIndex !== -1){
            currentUsers.splice(userIndex, 1)
            this._chatUsers.set(args.roomName, currentUsers)
        }
    }

    /**
     * @method disconnectUser()
     * @param socket - current socket.
     *
     * Method handles removing disconnected user from user lists in all rooms.
     *
     * @emits user_list_changed - sends new system message about disconnected user.
     * @emits room_users_list - sends updated list with users connected to this room for everyone in room.
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
            const message = new Message(`User ${socket.handshake.query.clientName} has disconnected`, room[0])
            Logger.userDisconnected(socket.handshake.query.clientName, socket.id, room[0])
            Logger.newSystemMessage(message.text, room[0])
            this._io.to(room[0]).emit('user_list_changed', message.toJson())
            this._io.to(room[0]).emit('room_users_list', {  //TODO: refactor
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
        const message = new UserMessage(args.messageText, args.messageRoomName, socket.handshake.query.clientName)//TODO: change clientName to ID
        Logger.newMessageInRoom(socket.handshake.query.clientName, socket.id, args.messageText, args.roomName)
        this._io.in(args.messageRoomName).emit('new_message_in_room', message.toJson())
    }
}

export default SocketHandler
